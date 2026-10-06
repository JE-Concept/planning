import { timingSafeEqual } from 'node:crypto'
import { onRequest } from 'firebase-functions/v2/https'
import { FieldValue } from 'firebase-admin/firestore'
import { defineSecret } from 'firebase-functions/params'
import { logger } from 'firebase-functions'
import { berichtId, bronVanToken, effectieveBron, leesEnvelop, leesTokens, wintermoodsNaarEnvelop } from './envelop.js'

/**
 * Messaging: de ene ingang voor alles wat van buiten komt.
 *
 * ── Waarom een log en geen rechtstreekse verwerking ───────────────────────
 * Wintermoods, Bar Vue, Feestbeest en de verhuursite sturen elk aanvragen,
 * boekingen en betalingen. Verwerkt elke bron ze op haar eigen manier, dan
 * staan er na een jaar vijf manieren om "er is iets binnengekomen" te zeggen,
 * en vijf plekken waar een bericht stil kan verdwijnen. Hier komt alles in één
 * collectie `messaging` als onveranderlijke rij, en wat ermee gebeurt doen
 * losse verwerkers in `functions/messaging-verwerking.js`, elk met zijn eigen
 * stand op het bericht. Komt er een verwerker bij (de boekhouding, Lightspeed),
 * dan leest hij dezelfde log; valt er een om, dan staat het bericht er nog en
 * is het te herspelen.
 *
 * Dat is wat een berichtenbroker zou doen, zonder broker: het volume is een
 * handvol per dag, en Firestore-triggers zijn de consumers. Groeit het, dan
 * komt Pub/Sub tussen deze ingang en de log — de envelop en de verwerkers
 * blijven dezelfde.
 *
 * ── Waarom één geheim met een token per bron ──────────────────────────────
 * De afzenders zijn servers, geen mensen: er is niemand om in te loggen. Elke
 * bron heeft haar eigen token, zodat een gelekt token één bron stillegt en
 * niet allemaal. Ze staan samen in één geheim (`MESSAGING_TOKENS`, een
 * JSON-object), want een bron erbij hoort een regel in een geheim te zijn en
 * geen nieuwe uitrol. Zie `leesTokens`.
 *
 * ── Waarom een eigen codebase ─────────────────────────────────────────────
 * Omdat er een geheim aan hangt. Een functions-uitrol faalt in zijn geheel op
 * één ontbrekend geheim; hier staat alleen deze ingang stil zolang het geheim
 * er niet is, en zegt de uitrol dat met zoveel woorden.
 *
 * ── Eén antwoord op elke mislukking ───────────────────────────────────────
 * Een verkeerde token krijgt 401 en verder niets. Een bericht dat al bestaat
 * krijgt `ok` met `herhaald: true`: de afzender hoeft niet te weten dat hij
 * dubbel stuurde, en mag het gerust nog eens doen.
 *
 *   firebase functions:secrets:set MESSAGING_TOKENS --project je-planning
 */

const MESSAGING_TOKENS = defineSecret('MESSAGING_TOKENS')

const gelijk = (a, b) => {
  const x = Buffer.from(String(a))
  const y = Buffer.from(String(b))
  return x.length === y.length && timingSafeEqual(x, y)
}

/** Het id van de kaart die de verwerker voor dit bericht maakt; zie messaging-kaart.js. */
const kaartIdVoor = (envelop) => (envelop.bron === 'wintermoods' ? `wm-${envelop.sleutel}` : null)

async function schrijf(db, envelop) {
  const ref = db.collection('messaging').doc(berichtId(envelop))
  try {
    await ref.create({
      ...envelop,
      ontvangen: FieldValue.serverTimestamp(),
      // Per verwerker een eigen stand; leeg betekent "nog niet gezien".
      verwerking: {},
      versie: 1,
    })
    return { id: ref.id, herhaald: false }
  } catch (err) {
    if (err?.code !== 6) throw err // 6 = ALREADY_EXISTS
    logger.info('Bericht kwam een tweede keer binnen; rij ongemoeid', { id: ref.id })
    return { id: ref.id, herhaald: true }
  }
}

export function maakMessaging({ db, region }) {
  return onRequest(
    {
      region,
      cors: false,
      secrets: [MESSAGING_TOKENS],
      // `invoker: 'private'` zegt alleen tegen de CLI dat ze zelf geen
      // IAM-binding moet zetten; de workflow doet dat een stap later, net als
      // bij `verhuur` en `portaal`.
      invoker: 'private',
      concurrency: 20,
      maxInstances: 3,
      memory: '256MiB',
    },
    async (verzoek, antwoord) => {
      if (verzoek.method !== 'POST') return antwoord.status(405).json({ fout: 'methode' })

      const tokens = leesTokens(MESSAGING_TOKENS.value())
      // Bearer in Authorization; een formulier-plugin die enkel een eigen header kan zetten,
      // mag `X-Messaging-Token` gebruiken. Nooit in de URL: die belandt in logboeken.
      const bron = bronVanToken(tokens, verzoek.get('authorization') || verzoek.get('x-messaging-token'), gelijk)
      if (!bron) return antwoord.status(401).json({ fout: 'geen_toegang' })

      // Het oude platte Wintermoods-contract blijft werken op zijn oude adres.
      const alias = /\/api\/wintermoods(\/|$)/.test(verzoek.path)
      // Een platform (de boekingsapp, Cue) mag zeggen voor welke van zijn sites het bericht is.
      const { bron: voor, via } = effectieveBron(bron, verzoek.body?.bron)
      const gelezen = alias && bron === 'wintermoods' ? wintermoodsNaarEnvelop(verzoek.body) : leesEnvelop(verzoek.body, { bron: voor })
      if (gelezen.envelop && via) gelezen.envelop.via = via
      if (gelezen.fout) return antwoord.status(400).json({ fout: gelezen.fout })

      const { id, herhaald } = await schrijf(db, gelezen.envelop)
      // De kaart-id is afleidbaar, dus de afzender krijgt ze meteen — ook al
      // maakt de verwerker de kaart pas een tel later.
      return antwoord.json({ ok: true, berichtId: id, herhaald, eventId: kaartIdVoor(gelezen.envelop) })
    }
  )
}
