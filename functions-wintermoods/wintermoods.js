import { timingSafeEqual } from 'node:crypto'
import { onRequest } from 'firebase-functions/v2/https'
import { FieldValue } from 'firebase-admin/firestore'
import { defineSecret } from 'firebase-functions/params'
import { logger } from 'firebase-functions'
import { isEventLijst } from './events-bron.js'
import { FORMULES, kaartId, leesAanvraag, omschrijving, titelVan } from './aanvraag.js'

/**
 * Wat er binnenkomt via het reservatieformulier van wintermoods.jeconcept.be.
 *
 * ── Waarom dit een event wordt en geen aanvraagrij ────────────────────────
 * De verhuur zet een aanvraag in `verhuuraanvragen` en laat iemand ze later
 * omzetten, omdat daar eerst beschikbaarheid van losse stukken bij komt
 * kijken. Een Wintermoods-aanvraag is al een datum met een aantal personen en
 * een formule erbij: dat ís het event, alleen nog niet bevestigd. Daarom komt
 * ze meteen op het bord, in de kolom `request` — waar de eventlijst al een
 * kolom voor heeft en waar het team toch naar kijkt. Een aanvraag die in een
 * tweede lijst wacht tot iemand ze overtypt, is een aanvraag die blijft
 * liggen.
 *
 * ── Waarom een gedeeld geheim en geen login ───────────────────────────────
 * De aanroeper is een Cloudflare Pages Function, geen mens en geen browser:
 * er is niemand om in te loggen. Eén geheim in de header, en dat geheim zit
 * aan één kant in Secret Manager en aan de andere in de Pages-omgeving. Zonder
 * geheim is dit adres een formulier dat iedereen op het bord kan zetten.
 *
 * ── Waarom dit een eigen codebase is ──────────────────────────────────────
 * Omdat er een geheim aan hangt. Een functions-uitrol faalt in zijn geheel op
 * één ontbrekend geheim; stond dit bij de standaardfuncties, dan zou een nog
 * niet gezet WINTERMOODS_TOKEN het archief, de agendafeed, AAPI, het portaal
 * en het inloggen van de ploeg meeslepen. Nu rolt `ci.yml` deze codebase
 * alleen uit wanneer het geheim bestaat, en zegt ze het anders met zoveel
 * woorden — zoals bij `mail`, `meetings` en `betaling`. `events-bron.js` is
 * daarom een kopie van die in `functions/`; een test houdt de twee gelijk.
 *
 * ── Waarom één antwoord op elke mislukking ────────────────────────────────
 * Een verkeerde token krijgt 401 en verder niets; of de eventlijst bestaat,
 * of het geheim ooit goed stond, hoort niemand van buiten af te kunnen lezen.
 * Dezelfde regel als bij `portaal.js` en de agendafeed.
 *
 *   firebase functions:secrets:set WINTERMOODS_TOKEN --project je-planning
 */

const WINTERMOODS_TOKEN = defineSecret('WINTERMOODS_TOKEN')

/** De kolom waar een nieuwe aanvraag in hoort, met terugval. */
const KOLOM = 'request'

/**
 * Het event, met dezelfde velden als `createEventFromTemplate` in de browser
 * en als `maakEvent` in `functions/verhuur-orders.js` schrijft. Wat daar
 * staat, moet hier ook staan, anders is dit het ene event op het bord dat
 * zich anders gedraagt.
 */
async function maakEvent({ db, aanvraag }) {
  const lijsten = await db.collection('lists').get()
  const lijst = lijsten.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((l) => !l.archived)
    .find(isEventLijst)
  if (!lijst) {
    logger.warn('Geen eventlijst; de Wintermoods-aanvraag komt niet op het bord')
    return null
  }

  const kolom =
    lijst.statuses?.find((s) => s.name === KOLOM) ??
    lijst.statuses?.find((s) => s.kind === 'active') ??
    lijst.statuses?.[0]
  if (!kolom) {
    logger.warn('Eventlijst zonder kolommen; de Wintermoods-aanvraag komt niet op het bord')
    return null
  }

  const dag = (sleutel) => (sleutel ? new Date(`${sleutel}T12:00:00`) : null)
  const naam = aanvraag.naam || aanvraag.email
  const formule = FORMULES[aanvraag.formule]

  /*
    Op de aanvraag-id gesleuteld, niet op een nieuwe id. Een formulier dat twee
    keer vertrekt — een dubbele klik, een herhaling na een time-out die wél
    aankwam — hoort één kaart op te leveren, niet twee die iemand moet
    samenvoegen. Zonder id valt het terug op een gewone nieuwe kaart.
  */
  const id = kaartId(aanvraag)
  const ref = id ? db.collection('tasks').doc(id) : db.collection('tasks').doc()

  const velden = {
    listId: lijst.id,
    listName: lijst.name ?? 'Events',
    spaceId: lijst.spaceId ?? null,
    brandId: lijst.brandId ?? null,
    parentId: null,
    title: titelVan(aanvraag),
    description: omschrijving(aanvraag),
    eventDate: dag(aanvraag.datum),
    eventEndDate: null,
    dueDate: dag(aanvraag.datum),
    startDate: null,
    customerId: null,
    customerName: naam,
    eventType: 'Wintermoods',
    templateId: null,
    priority: null,
    timeEstimateMinutes: null,
    assignees: [],
    position: Date.now(),
    pax: aanvraag.personen,
    // Op locatie is de enige gelegenheid die de plek verandert.
    location: aanvraag.gelegenheid === 'locatie' ? 'Op locatie, bij de klant' : 'Het Vinne, Zoutleeuw',
    locationPlaceId: null,
    locationLat: null,
    locationLng: null,
    formule: formule ?? null,
    formuleId: null,
    formuleKeuzes: null,
    formulePrijsPerPersoon: null,
    formuleBtw: null,
    formuleInclBtw: null,
    quoteAmount: null,
    budget: null,
    bestellijst: [],
    tags: ['wintermoods'],
    archived: false,
    afgesloten: false,
    afgeslotenJaar: null,
    completedAt: null,
    trackedSeconds: 0,
    commentCount: 0,
    statusId: kolom.id,
    statusName: kolom.name,
    statusColor: kolom.color,
    statusKind: kolom.kind,
    open: kolom.kind !== 'done' && kolom.kind !== 'closed',
    // Waar de aanvraag vandaan kwam, en hoe we de klant bereiken zonder de
    // omschrijving te moeten uitpluizen.
    bron: 'wintermoods',
    contactEmail: aanvraag.email,
    contactTelefoon: aanvraag.telefoon || null,
    createdBy: null,
    updatedBy: null,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  }

  /*
    `create` en niet `set`: bestaat de kaart al, dan is dit een herhaalde
    aflevering van dezelfde aanvraag en laten we ze met rust. Met `set` zou een
    kaart die het team intussen naar een andere kolom sleepte terugspringen naar
    `request` — erger dan een dubbele kaart.
  */
  try {
    await ref.create(velden)
  } catch (err) {
    if (err?.code !== 6) throw err // 6 = ALREADY_EXISTS
    logger.info('Wintermoods-aanvraag kwam een tweede keer binnen; kaart ongemoeid', { id: ref.id })
  }

  return ref.id
}

/**
 * De token vergelijken zonder te verraden hoe ver iemand zat.
 *
 * Een gewone `!==` stopt bij het eerste verschillende teken, en dat verschil is
 * meetbaar. Hier duurt elke vergelijking even lang, en lengtes die niet kloppen
 * vallen weg op de lengte en niet op de inhoud.
 */
function klopt(geheim, header) {
  const meegegeven = String(header ?? '').replace(/^Bearer\s+/i, '')
  if (!geheim || !meegegeven) return false
  const a = Buffer.from(geheim)
  const b = Buffer.from(meegegeven)
  return a.length === b.length && timingSafeEqual(a, b)
}

export function maakWintermoods({ db, region }) {
  return onRequest(
    {
      region,
      cors: false,
      secrets: [WINTERMOODS_TOKEN],
      /*
        `invoker: 'private'` zegt alleen tegen de CLI dat ze zelf geen
        IAM-binding moet zetten; publiek bereikbaar wordt dit een stap later in
        de workflow. Dezelfde uitleg als bij `verhuur.js` en `portaal.js`.
      */
      invoker: 'private',
      // Eén formulier op één seizoenssite: een bescheiden plafond volstaat, en
      // een publiek adres zonder bovengrens is een factuur die iemand anders
      // mag bepalen.
      concurrency: 20,
      maxInstances: 3,
      memory: '256MiB',
    },
    async (verzoek, antwoord) => {
      if (verzoek.method !== 'POST') return antwoord.status(405).json({ fout: 'methode' })

      if (!klopt(WINTERMOODS_TOKEN.value(), verzoek.get('authorization'))) {
        return antwoord.status(401).json({ fout: 'geen_toegang' })
      }

      const aanvraag = leesAanvraag(verzoek.body)
      if (aanvraag.fout) return antwoord.status(400).json({ fout: aanvraag.fout })

      const id = await maakEvent({ db, aanvraag: aanvraag.velden })
      /*
        Geen eventlijst is geen fout van de aanroeper. De site heeft de mail al
        verstuurd en de klant al bevestigd; een 500 zou daar niets meer aan
        veranderen en zet alleen "mislukt" in haar logboek. Het staat wel in
        het onze.
      */
      return antwoord.json({ ok: true, eventId: id })
    }
  )
}
