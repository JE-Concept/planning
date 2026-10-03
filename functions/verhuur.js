import { onRequest } from 'firebase-functions/v2/https'
import { FieldValue } from 'firebase-admin/firestore'
import { logger } from 'firebase-functions'
import { beschikbaarheidVan, catalogusVan, categorieenVan } from './verhuur-aanbod.js'
import { leesAanvraag } from './verhuur-aanvraag.js'

/**
 * De leeskant van de verhuur: wat er is, en wanneer het vrij is.
 *
 * ── Waarom dit hier staat en niet bij de betaling ─────────────────────────
 * `functions-betaling/` hangt aan twee Stripe-geheimen en wordt overgeslagen
 * zolang die ontbreken. Stond de catalogus daar, dan zou een ontbrekende
 * betaalsleutel ook de etalage dichtdoen — en een verhuursite die níéts toont
 * is erger dan een die toont maar nog niet laat afrekenen. Hier hangt niets
 * aan een geheim, dus dit staat altijd overeind.
 *
 * ── Waarom er geen Firestore-regels aan te pas komen ──────────────────────
 * De publieke site praat niet met Firestore. Ze kent geen projectsleutel en
 * heeft geen SDK aan boord; ze stelt twee vragen aan dit adres en krijgt JSON
 * terug. Dat scheelt de hele discussie over wat een anonieme lezer in de
 * regels wel en niet mag, en het maakt van `verhuur-aanbod.js` de enige plek
 * waar bepaald wordt welke velden het pand verlaten.
 */

const DAG = /^\d{4}-\d{2}-\d{2}$/

/** Alle dagsleutels van `van` tot en met `tot`, met een harde bovengrens. */
function dagenTussen(van, tot) {
  if (!DAG.test(van) || !DAG.test(tot) || tot < van) return []
  const uit = []
  const d = new Date(`${van}T12:00:00Z`)
  const eind = new Date(`${tot}T12:00:00Z`)
  // Een halfjaar is ruim voor een verhuur; zonder grens maakt een tikfout in
  // een jaartal van dit verzoek een rekening.
  while (d <= eind && uit.length < 180) {
    uit.push(d.toISOString().slice(0, 10))
    d.setUTCDate(d.getUTCDate() + 1)
  }
  return uit
}

/**
 * Welke standen een stuk bezet houden.
 *
 * Dezelfde regel als in de backoffice en aan de kassa: alles behalve afgezegd
 * en een verlopen optie. Bij twijfel bezet — dat kost hoogstens een
 * telefoontje, en het omgekeerde kost een dubbele boeking.
 */
function teltMee(reservatie, nu) {
  if (reservatie?.status === 'geannuleerd') return false
  if (reservatie?.status !== 'optie') return true
  const vervalt = reservatie.optieVervalt?.toDate?.() ?? (reservatie.optieVervalt ? new Date(reservatie.optieVervalt) : null)
  if (!vervalt || Number.isNaN(vervalt.getTime())) return true
  return vervalt > nu
}

const volgende = (sleutel) => {
  const d = new Date(`${sleutel}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

/** De dagen die één reservatie bezet houdt, uitlooptijd inbegrepen. */
function dagenVanReservatie(reservatie, uitloopDagen) {
  const van = reservatie.van
  if (!DAG.test(van ?? '')) return []
  const geboekt = DAG.test(reservatie.tot ?? '') ? reservatie.tot : van
  const terug = DAG.test(reservatie.teruggebrachtOp ?? '') ? reservatie.teruggebrachtOp : null
  const tot = terug && terug < geboekt ? terug : geboekt

  const dagen = dagenTussen(van, tot)
  for (let i = 0; i < uitloopDagen; i += 1) dagen.push(volgende(dagen[dagen.length - 1] ?? tot))
  return dagen
}

export function maakVerhuur({ db, region }) {
  return onRequest(
    {
      region,
      cors: false,
      /*
        `invoker: 'private'` zegt alleen tegen de CLI dat ze zelf geen
        IAM-binding moet zetten; publiek bereikbaar wordt dit een stap later in
        de workflow. Dezelfde uitleg als bij `portaal.js` en `agenda.js`, en om
        dezelfde reden: zonder dit strandt de hele uitrol.
      */
      invoker: 'private',
      // Een etalage die rondgaat op sociale media, met een plafond erop: een
      // publiek adres zonder bovengrens is een factuur die iemand anders mag
      // bepalen. Zie `portaal.js` voor dezelfde afweging.
      concurrency: 80,
      maxInstances: 20,
      memory: '256MiB',
    },
    async (verzoek, antwoord) => {
      const pad = String(verzoek.path ?? '').replace(/^\/api\/verhuur/, '').replace(/^\/+|\/+$/g, '')

      /*
        Eén schrijfactie op dit adres: de offerteaanvraag. Ze staat hier en
        niet bij de betaling omdat ze niets met geld te maken heeft en dus
        niet mee hoort te vallen wanneer er een Stripe-sleutel ontbreekt — een
        aanvraag is vaak het begin van een opdracht van duizenden euro's.
      */
      if (verzoek.method === 'POST' && pad === 'aanvraag') {
        return await aanvraagBinnen({ db, verzoek, antwoord })
      }

      if (verzoek.method !== 'GET') return antwoord.status(405).json({ fout: 'alleen_get' })

      /*
        De catalogus mag even blijven hangen bij de CDN — vijf minuten, want
        een prijs die verandert hoeft niet binnen de seconde op het scherm te
        staan. De beschikbaarheid niet: dat is het getal waarop iemand een
        beslissing neemt, en een minuut oude "nog twee vrij" is een minuut
        waarin er eentje verkocht kan zijn.
      */
      try {
        if (pad === 'aanbod') {
          antwoord.set('Cache-Control', 'public, max-age=0, s-maxage=300, stale-while-revalidate=900')
          const snap = await db.collection('materiaal').where('directTeHuren', '==', true).get()
          const catalogus = catalogusVan(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
          return antwoord.json({ artikelen: catalogus, categorieen: categorieenVan(catalogus) })
        }

        if (pad === 'beschikbaar') {
          antwoord.set('Cache-Control', 'public, max-age=0, s-maxage=30')
          const dagen = dagenTussen(String(verzoek.query.van ?? ''), String(verzoek.query.tot ?? ''))
          if (dagen.length === 0) return antwoord.status(400).json({ fout: 'geen_periode' })

          const van = dagen[0]
          const tot = dagen[dagen.length - 1]

          const [stukken, bezetting] = await Promise.all([
            db.collection('materiaal').where('directTeHuren', '==', true).get(),
            // Firestore kan niet op twee bereiken tegelijk filteren, dus staat
            // `tot >= van` in de vraag en valt de andere kant hieronder weg.
            db.collection('reservaties').where('tot', '>=', van).get(),
          ])

          const catalogus = catalogusVan(stukken.docs.map((d) => ({ id: d.id, ...d.data() })))
          const uitloop = new Map(catalogus.map((m) => [m.id, m.uitloopDagen ?? 0]))
          const nu = new Date()

          const perArtikel = new Map()
          bezetting.forEach((doc) => {
            const r = doc.data()
            if ((r.van ?? '') > tot) return
            if (!uitloop.has(r.materiaalId)) return
            if (!teltMee(r, nu)) return

            const kaart = perArtikel.get(r.materiaalId) ?? new Map()
            const aantal = Math.max(0, Math.round(Number(r.aantal) || 0))
            for (const dag of dagenVanReservatie(r, uitloop.get(r.materiaalId))) {
              kaart.set(dag, (kaart.get(dag) ?? 0) + aantal)
            }
            perArtikel.set(r.materiaalId, kaart)
          })

          return antwoord.json({ van, tot, dagen: dagen.length, vrij: beschikbaarheidVan(catalogus, dagen, perArtikel) })
        }
      } catch (fout) {
        /*
          Een stacktrace hoort niet op een publieke pagina: hij vertelt een
          vreemde hoe onze database heet en hoe onze collecties zijn opgebouwd.
          De bezoeker krijgt een code, wij krijgen het hele verhaal in de log.
        */
        logger.error('Verhuur-aanbod ophalen mislukt', fout)
        return antwoord.status(500).json({ fout: 'ophalen_mislukt' })
      }

      return antwoord.status(404).json({ fout: 'niet_gevonden' })
    }
  )
}

/**
 * Een offerteaanvraag van de verhuursite.
 *
 * ── Waarom dit openbaar mag schrijven, en wat dat kost ───────────────────
 * Een formulier zonder drempel krijgt vroeg of laat onzin binnen. Dat is hier
 * de goedkoopste van twee fouten: een drempel kost echte aanvragen, en een
 * aanvraag is het begin van een opdracht. Wat er wél staat:
 *
 * - alles wordt afgekapt op lengte, zodat niemand een document in de database
 *   kan duwen;
 * - er gaan geen velden mee die we niet gevraagd hebben, dus de vorm van het
 *   document ligt vast;
 * - `maxInstances` op deze functie is het plafond op de rekening;
 * - en een lokvakje (`bedrijfsnaam`) dat een mens nooit invult omdat het
 *   verborgen is. Vult iets het toch in, dan is het geen mens — en dan zeggen
 *   we vriendelijk "dank u" en schrijven we niets weg. Een bot die een fout
 *   krijgt, probeert het opnieuw met een andere vorm.
 *
 * Wat hier níét staat is een captcha. Die kost elke eerlijke bezoeker tijd en
 * ergernis, en voor dit volume is het middel erger dan de kwaal. Loopt het
 * uit de hand, dan is dat het moment om er een te zetten — niet eerder.
 */
async function aanvraagBinnen({ db, verzoek, antwoord }) {
  const aanvraag = leesAanvraag(verzoek.body)
  if (aanvraag.fout) return antwoord.status(400).json({ fout: aanvraag.fout })

  // Stilletjes slikken: zie de kop.
  if (aanvraag.lokvink) return antwoord.json({ ok: true })

  await db.collection('verhuuraanvragen').add({
    ...aanvraag.velden,
    status: 'nieuw',
    bron: 'verhuursite',
    eventId: null,
    customerId: null,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  })

  return antwoord.json({ ok: true })
}
