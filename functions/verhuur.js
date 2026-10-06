import { onRequest } from 'firebase-functions/v2/https'
import { FieldValue } from 'firebase-admin/firestore'
import { logger } from 'firebase-functions'
import { beschikbaarheidVan, catalogusVan, categorieenVan } from './verhuur-aanbod.js'
import { leesAanvraag } from './verhuur-aanvraag.js'
import {
  LINK_MINUTEN,
  SESSIE_DAGEN,
  bearerVan,
  beoordeelLink,
  hashVan,
  leesEmail,
  loginMail,
  nieuwToken,
  sessieGeldig,
} from './verhuur-login.js'

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
        Publiek, en dat staat hier en niet alleen in de workflow. Met
        `invoker: 'private'` zette elke uitrol de functie terug op "Require
        authentication", en omdat de workflow `verhuur` niet opnieuw publiek
        zette (alleen agenda en portaal), gaf /api/verhuur/aanbod op
        rental.jeconcept.be na de uitrol een 403: een lege etalage. De
        uitrolsleutel mag de Cloud Run-binding zetten — de betaalfuncties in
        functions-betaling doen dat al zo. De workflow zet ze daarna nog eens,
        als vangnet. Wie wat mag zien, beslist de functie zelf: alleen de
        velden van het aanbod, nooit inkoopprijs of leverancier.
      */
      invoker: 'public',
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

      /*
        Inloggen — vraag 11 en 12. Drie adressen: de link aanvragen, de link
        gebruiken, en "wat heb ik gehuurd". Zie `verhuur-login.js` voor
        waarom dit een eigen magische link is en geen Firebase Auth.
      */
      if (verzoek.method === 'POST' && pad === 'login') {
        return await linkAanvragen({ db, verzoek, antwoord })
      }
      if (verzoek.method === 'GET' && pad.startsWith('login/')) {
        antwoord.set('Cache-Control', 'no-store')
        return await linkGebruiken({ db, token: pad.slice('login/'.length), antwoord })
      }
      if (verzoek.method === 'GET' && pad === 'mijn') {
        antwoord.set('Cache-Control', 'no-store')
        return await mijnHuren({ db, verzoek, antwoord })
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

/**
 * Een inloglink mailen.
 *
 * Het antwoord is altijd "ok", ook voor een adres dat we niet kennen. Zou het
 * verschil maken, dan is dit adres een manier om onze klantenlijst na te
 * lopen. De mail gaat overigens ook naar een onbekend adres: wie inlogt
 * zonder klant te zijn, ziet gewoon een lege lijst — en zijn volgende huur
 * staat er dan wél.
 */
async function linkAanvragen({ db, verzoek, antwoord }) {
  const email = leesEmail(verzoek.body)
  if (!email) return antwoord.status(400).json({ fout: 'geen_email' })

  const token = nieuwToken()
  await db.collection('verhuurSessies').doc(hashVan(token)).set({
    email,
    linkVervalt: new Date(Date.now() + LINK_MINUTEN * 60 * 1000),
    gebruiktOp: null,
    sessieHash: null,
    sessieVervalt: null,
    createdAt: FieldValue.serverTimestamp(),
  })

  const link = `https://rental.jeconcept.be/login/${token}`
  const { onderwerp, tekst } = loginMail({ link })
  await db.collection('mailQueue').add({
    aan: email,
    soort: 'verhuur-login',
    onderwerp,
    tekst,
    klantMail: true,
    status: 'wachtend',
    pogingen: 0,
    createdAt: FieldValue.serverTimestamp(),
  })

  return antwoord.json({ ok: true })
}

/**
 * De link gebruiken: één keer, binnen de tijd, en dan een sessie terug.
 *
 * In een transactie, want twee tabbladen die dezelfde link openen mogen niet
 * allebei een sessie krijgen. De tweede ziet "al gebruikt" — en heeft, als
 * het dezelfde persoon is, in zijn eerste tabblad al een sessie.
 */
async function linkGebruiken({ db, token, antwoord }) {
  if (!/^[A-Za-z0-9_-]{20,}$/.test(token)) return antwoord.status(400).json({ fout: 'onbekend' })
  const ref = db.collection('verhuurSessies').doc(hashVan(token))

  const uit = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref)
    const oordeel = beoordeelLink(snap.exists ? snap.data() : null)
    if (!oordeel.ok) return oordeel

    const sessie = nieuwToken()
    tx.update(ref, {
      gebruiktOp: FieldValue.serverTimestamp(),
      sessieHash: hashVan(sessie),
      sessieVervalt: new Date(Date.now() + SESSIE_DAGEN * 24 * 60 * 60 * 1000),
    })
    return { ok: true, sessie, email: snap.data().email }
  })

  if (!uit.ok) return antwoord.status(410).json({ fout: uit.reden })

  const klant = await klantBijEmail(db, uit.email)
  return antwoord.json({ sessie: uit.sessie, email: uit.email, naam: klant?.name ?? null })
}

/** De sessie achter een Authorization-kop, of niets. */
export async function sessieVan(db, kop) {
  const token = bearerVan(kop)
  if (!token) return null
  const snap = await db.collection('verhuurSessies').where('sessieHash', '==', hashVan(token)).limit(1).get()
  if (snap.empty) return null
  const sessie = snap.docs[0].data()
  return sessieGeldig(sessie) ? { email: sessie.email } : null
}

async function klantBijEmail(db, email) {
  const snap = await db.collection('customers').where('email', '==', email).limit(1).get()
  return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() }
}

/**
 * Wat deze klant huurde, en huurt.
 *
 * Alleen zijn eigen orders, gezocht op het adres van de sessie en niet op
 * iets wat de browser meestuurt. En alleen wat hij ervan hoeft te zien: geen
 * Stripe-ids, geen reservatie-ids, geen interne stand.
 */
async function mijnHuren({ db, verzoek, antwoord }) {
  const sessie = await sessieVan(db, verzoek.get('authorization'))
  if (!sessie) return antwoord.status(401).json({ fout: 'niet_ingelogd' })

  const klant = await klantBijEmail(db, sessie.email)
  const orders = await db
    .collection('huurorders')
    .where('klant.email', '==', sessie.email)
    .orderBy('createdAt', 'desc')
    .limit(50)
    .get()

  return antwoord.json({
    email: sessie.email,
    naam: klant?.name ?? null,
    kortingPercent: Math.max(0, Math.min(100, Number(klant?.kortingMateriaal) || 0)),
    huren: orders.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((o) => o.status === 'betaald' || o.status === 'nakijken')
      .map((o) => ({
        id: o.id,
        van: o.van,
        tot: o.tot,
        status: o.status,
        regels: (o.regels ?? []).map((r) => ({ naam: r.naam, aantal: r.aantal })),
        teBetalen: o.teBetalen,
        waarborg: o.waarborg,
        waarborgTerug: o.waarborgTerugOp ? (o.waarborgTerugCent ?? 0) / 100 : null,
      })),
  })
}
