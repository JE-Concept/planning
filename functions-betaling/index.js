import { initializeApp } from 'firebase-admin/app'
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore'
import { onRequest } from 'firebase-functions/v2/https'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { defineSecret } from 'firebase-functions/params'
import { logger } from 'firebase-functions'
import Stripe from 'stripe'

import { huurTotaal, isLosTeHuren, regelPrijs } from './huurprijs.js'
import { dagenTussen, past } from './vrij.js'

/**
 * Afrekenen voor losse verhuur.
 *
 * ── Waarom dit een eigen codebase is ──────────────────────────────────────
 * Dezelfde reden als `functions-mail/` en `functions-meetings/`: deze functies
 * hangen aan een geheim, en een functions-uitrol faalt in zijn geheel op één
 * ontbrekend geheim. Stond Stripe bij de andere functies, dan zou een
 * ontbrekende sleutel het archief, de agendafeed, AAPI, het portaal en het
 * inloggen van de ploeg meeslepen. Nu blijft dat allemaal in de lucht en is
 * alleen afrekenen tijdelijk dicht — en dat zegt de uitrol ook met zoveel
 * woorden.
 *
 * ── De regel waar alles aan hangt ─────────────────────────────────────────
 * **De browser noemt geen bedragen.** Hij stuurt artikelnummers, aantallen en
 * een periode; de server zoekt de prijzen zelf op, rekent zelf na en zet zelf
 * de Stripe-sessie op. Een bedrag dat van buiten komt, is een wens.
 *
 * Dat is niet theoretisch: wie het formulier openzet in zijn browser kan elk
 * veld veranderen dat meegestuurd wordt. Zou de prijs daarbij zitten, dan
 * huurt iemand een tent voor één euro en heeft hij een geldig betaalbewijs.
 *
 * ── Waarom een optie en geen reservering achteraf ─────────────────────────
 * Tussen "afrekenen" en "betaald" zit een minuut of tien waarin de klant zijn
 * kaartgegevens zoekt. Reserveren we pas na de betaling, dan kan in die minuut
 * iemand anders dezelfde laatste tent kopen, en dan hebben twee mensen betaald
 * voor één tent. Dus leggen we het stuk meteen vast als **optie**, met een
 * vervaldatum. Betaalt hij, dan wordt de optie vast. Betaalt hij niet, dan
 * vervalt ze vanzelf — `vrij.js` telt een vervallen optie niet meer mee, dus
 * de voorraad komt terug zonder dat iemand iets moet opruimen.
 *
 * ── De geheimen ───────────────────────────────────────────────────────────
 *   firebase functions:secrets:set STRIPE_SECRET --project je-planning
 *   firebase functions:secrets:set STRIPE_WEBHOOK_SECRET --project je-planning
 *
 * De eerste is de geheime API-sleutel (`sk_live_…`), de tweede het
 * ondertekeningsgeheim van het webhook-eindpunt (`whsec_…`). Die tweede is
 * geen formaliteit: zonder handtekeningcontrole kan iedereen die het adres
 * kent een "betaald" posten.
 */

const STRIPE_SECRET = defineSecret('STRIPE_SECRET')
const STRIPE_WEBHOOK_SECRET = defineSecret('STRIPE_WEBHOOK_SECRET')

const region = 'europe-west1'

initializeApp()
const db = getFirestore()

/**
 * Hoe lang een onbetaalde optie de voorraad bezet houdt, en hoe lang de
 * betaalpagina openblijft.
 *
 * De optie leeft bewust een paar minuten langer dan de sessie. Vielen ze
 * samen, dan kan een klant die op de laatste seconde betaalt zijn tent al
 * kwijt zijn aan iemand anders — en dan heeft hij betaald voor niets. De
 * ondergrens van een halfuur is van Stripe: korter weigert het.
 */
const SESSIE_MINUTEN = 31
const OPTIE_MINUTEN = 36

/**
 * Wie mag hier aankloppen.
 *
 * De verhuursite staat op een ander adres dan de backoffice — dat is met opzet
 * zo, want de backoffice is van ons en de verhuursite is van iedereen. Een
 * open CORS zou betekenen dat elke willekeurige pagina opties kan aanmaken op
 * onze voorraad.
 */
const ORIGINS = new Set([
  'https://rental.jeconcept.be',
  'https://www.jeconcept.be',
  'https://jeconcept.be',
])

/*
  Alleen in de emulator mag een pagina van de eigen machine erbij. Stond
  localhost in de lijst hierboven, dan kon een ontwikkelaar — of iemand die
  hem een link stuurt — vanaf zijn eigen browser opties aanmaken op de echte
  voorraad. Dat is geen theoretische zorg: de verhuursite wordt in een ander
  project gebouwd en die zet vanzelf `http://localhost:5173` in de kop.
*/
if (process.env.FUNCTIONS_EMULATOR === 'true') ORIGINS.add('http://localhost:5173')

function zetCors(req, res) {
  const origin = req.get('origin')
  if (origin && ORIGINS.has(origin)) {
    res.set('Access-Control-Allow-Origin', origin)
    res.set('Vary', 'Origin')
  }
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.set('Access-Control-Allow-Headers', 'Content-Type')
  res.set('Access-Control-Max-Age', '3600')
  return Boolean(origin) && ORIGINS.has(origin)
}

const centen = (euro) => Math.round(Number(euro) * 100)

const tekst = (waarde, max = 200) => String(waarde ?? '').trim().slice(0, max)

/**
 * Wat de browser stuurt, uitgepakt en nagekeken.
 *
 * Alles wat hier niet doorheen komt, krijgt een nette 400 in plaats van een
 * stacktrace: een formulier dat half ingevuld verstuurd wordt, is geen storing.
 */
function leesAanvraag(body) {
  const regels = Array.isArray(body?.regels) ? body.regels : []
  const van = tekst(body?.van, 10)
  const tot = tekst(body?.tot, 10) || van

  if (regels.length === 0) return { fout: 'geen_regels' }
  if (regels.length > 40) return { fout: 'te_veel_regels' }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(van) || !/^\d{4}-\d{2}-\d{2}$/.test(tot)) return { fout: 'geen_datum' }
  if (tot < van) return { fout: 'omgekeerde_datum' }

  const dagen = dagenTussen(van, tot)
  if (dagen.length === 0 || dagen.length > 180) return { fout: 'rare_periode' }

  const gevraagd = []
  for (const regel of regels) {
    const materiaalId = tekst(regel?.materiaalId, 60)
    const aantal = Math.round(Number(regel?.aantal) || 0)
    if (!materiaalId || aantal <= 0 || aantal > 500) return { fout: 'rare_regel' }
    gevraagd.push({ materiaalId, aantal })
  }

  const email = tekst(body?.klant?.email, 160)
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { fout: 'geen_email' }

  return {
    van,
    tot,
    dagen,
    regels: gevraagd,
    klant: {
      naam: tekst(body?.klant?.naam, 120),
      email,
      telefoon: tekst(body?.klant?.telefoon, 40),
      opmerking: tekst(body?.klant?.opmerking, 1000),
    },
  }
}

/**
 * De reservaties die deze periode kunnen raken.
 *
 * Firestore kan niet op twee bereiken tegelijk filteren, dus staat `tot >= van`
 * in de vraag en valt de andere kant in het geheugen weg. Dezelfde afweging als
 * in `src/data/materiaal.js`: liever iets te veel ophalen dan een reservatie
 * missen die over de grens heen loopt.
 */
async function reservatiesRond(transactie, van, tot) {
  const snap = await transactie.get(db.collection('reservaties').where('tot', '>=', van))
  const perMateriaal = new Map()
  snap.forEach((doc) => {
    const r = { id: doc.id, ...doc.data() }
    if ((r.van ?? '') > tot) return
    const rij = perMateriaal.get(r.materiaalId) ?? []
    rij.push(r)
    perMateriaal.set(r.materiaalId, rij)
  })
  return perMateriaal
}

/**
 * De korting van een bekende klant.
 *
 * Een klant die al in het boek staat, krijgt op de verhuursite dezelfde
 * korting als op een offerte — anders is het antwoord op "wat kost dat" een
 * ander naargelang wie het vraagt, en dat is precies het soort verschil waar
 * een telefoontje van komt. Gezocht op e-mailadres, want dat is wat een
 * bezoeker intikt.
 *
 * ── Wat hieraan nog niet klopt, en waarom het er toch zo staat ────────────
 * Het e-mailadres is niet bewezen. Wie het adres van een klant met korting
 * kent en intikt, krijgt diens percentage. Dat is geen gat waar iemand rijk
 * van wordt — het gaat om vijf tot vijftien procent op een huur die in de
 * backoffice zichtbaar binnenkomt — maar het is wél een gat, en het hoort
 * hier te staan in plaats van stilletjes mee te gaan.
 *
 * Het sluit zichzelf zodra de verhuursite het klantenlogin krijgt dat in het
 * ontwerp staat: dan komt de korting van de ingelogde klant en niet van een
 * ingetikt veld. Tot dan is dit de minste van twee fouten, want de andere —
 * online een andere prijs tonen dan aan de telefoon — merkt de klant zelf en
 * daar belt hij over.
 */
async function kortingVoor(email) {
  const snap = await db.collection('customers').where('email', '==', email).limit(1).get()
  if (snap.empty) return { kortingPercent: 0, customerId: null, customerName: null }
  const klant = snap.docs[0]
  const percent = Number(klant.get('kortingMateriaal')) || 0
  return {
    kortingPercent: Math.max(0, Math.min(100, percent)),
    customerId: klant.id,
    customerName: klant.get('name') ?? null,
  }
}

/**
 * Afrekenen: de aanvraag nakijken, vastleggen, en een Stripe-sessie openen.
 */
export const verhuurAfrekenen = onRequest(
  { region, cors: false, secrets: [STRIPE_SECRET], invoker: 'public' },
  async (req, res) => {
    const bekend = zetCors(req, res)
    if (req.method === 'OPTIONS') return res.status(204).send('')
    if (req.method !== 'POST') return res.status(405).json({ fout: 'alleen_post' })
    if (!bekend) return res.status(403).json({ fout: 'onbekende_herkomst' })

    const aanvraag = leesAanvraag(req.body)
    if (aanvraag.fout) return res.status(400).json({ fout: aanvraag.fout })

    const { van, tot, dagen, klant } = aanvraag
    const korting = await kortingVoor(klant.email)

    let order = null
    try {
      order = await db.runTransaction(async (transactie) => {
        const perMateriaal = await reservatiesRond(transactie, van, tot)
        const nu = new Date()

        const stukken = await Promise.all(
          aanvraag.regels.map((r) => transactie.get(db.collection('materiaal').doc(r.materiaalId)))
        )

        const prijsregels = []
        const vastleggen = []

        for (let i = 0; i < aanvraag.regels.length; i += 1) {
          const gevraagd = aanvraag.regels[i]
          const snap = stukken[i]
          if (!snap.exists) return { fout: 'onbekend_artikel', artikel: gevraagd.materiaalId }

          const materiaal = { id: snap.id, ...snap.data() }
          if (materiaal.archived) return { fout: 'onbekend_artikel', artikel: materiaal.naam }

          // Niet alles wat in het magazijn staat, mag zonder gesprek de deur
          // uit. Een tent moet geplaatst worden; die hoort bij een offerte.
          if (!isLosTeHuren(materiaal)) return { fout: 'niet_los_te_huren', artikel: materiaal.naam }

          const minimum = Math.max(1, Math.round(Number(materiaal.minDagen) || 1))
          if (dagen.length < minimum) {
            return { fout: 'te_kort', artikel: materiaal.naam, minDagen: minimum }
          }

          const ruimte = past({
            materiaal,
            van,
            tot,
            aantal: gevraagd.aantal,
            reservaties: perMateriaal.get(materiaal.id) ?? [],
            nu,
          })
          if (!ruimte.kan) {
            return { fout: 'niet_beschikbaar', artikel: materiaal.naam, vrij: ruimte.vrij }
          }

          const regel = regelPrijs({
            materiaal,
            aantal: gevraagd.aantal,
            dagen,
            kortingPercent: korting.kortingPercent,
          })
          // Kan niet meer gebeuren — `isLosTeHuren` eist een dagprijs — maar
          // een offerte zonder bedrag mag nooit tot een betaling leiden.
          if (regel.geenTarief) return { fout: 'geen_prijs', artikel: materiaal.naam }

          prijsregels.push(regel)
          vastleggen.push({ materiaal, aantal: gevraagd.aantal })
        }

        const totaal = huurTotaal(prijsregels)
        if (totaal.teBetalen <= 0) return { fout: 'geen_bedrag' }

        const orderRef = db.collection('huurorders').doc()
        const vervalt = Timestamp.fromMillis(Date.now() + OPTIE_MINUTEN * 60 * 1000)

        const reservatieIds = vastleggen.map(({ materiaal, aantal }) => {
          const reservatieRef = db.collection('reservaties').doc()
          transactie.set(reservatieRef, {
            materiaalId: materiaal.id,
            materiaalNaam: materiaal.naam ?? '',
            aantal,
            van,
            tot,
            status: 'optie',
            soort: 'verhuur',
            eventId: null,
            eventNaam: null,
            aanvraagId: null,
            orderId: orderRef.id,
            optieVervalt: vervalt,
            createdBy: null,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          })
          return reservatieRef.id
        })

        transactie.set(orderRef, {
          status: 'wacht_op_betaling',
          van,
          tot,
          dagen: dagen.length,
          klant,
          customerId: korting.customerId,
          customerName: korting.customerName,
          kortingPercent: korting.kortingPercent,
          regels: prijsregels,
          exclBtw: totaal.exclBtw,
          btw: totaal.btw,
          inclBtw: totaal.inclBtw,
          waarborg: totaal.waarborg,
          teBetalen: totaal.teBetalen,
          // In centen, want dat is wat Stripe terugmeldt en wat we straks
          // vergelijken. Euro's met komma's vergelijken gaat een keer mis.
          teBetalenCent: centen(totaal.teBetalen),
          reservatieIds,
          sessionId: null,
          betaaldOp: null,
          optieVervalt: vervalt,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        })

        return { id: orderRef.id, totaal, prijsregels }
      })
    } catch (err) {
      logger.error('Afrekenen mislukt bij het vastleggen', err)
      return res.status(500).json({ fout: 'vastleggen_mislukt' })
    }

    if (order.fout) return res.status(409).json(order)

    const stripe = new Stripe(STRIPE_SECRET.value())
    const basis = ORIGINS.has(req.get('origin')) ? req.get('origin') : 'https://rental.jeconcept.be'

    try {
      const sessie = await stripe.checkout.sessions.create(
        {
          mode: 'payment',
          customer_email: klant.email,
          client_reference_id: order.id,
          metadata: { orderId: order.id },
          // Korter dan de standaard van een dag: zolang houden we de voorraad
          // niet vast voor iemand die zijn kaart niet vindt.
          expires_at: Math.floor(Date.now() / 1000) + SESSIE_MINUTEN * 60,
          line_items: stripeRegels(order.totaal),
          success_url: `${basis}/verhuur/gelukt?order=${order.id}`,
          cancel_url: `${basis}/verhuur/afgebroken?order=${order.id}`,
        },
        // Dezelfde order mag nooit twee sessies krijgen, ook niet als de
        // browser het verzoek opnieuw stuurt omdat het antwoord uitbleef.
        { idempotencyKey: `huur-${order.id}` }
      )

      await db.collection('huurorders').doc(order.id).update({
        sessionId: sessie.id,
        updatedAt: FieldValue.serverTimestamp(),
      })

      return res.json({ url: sessie.url, orderId: order.id, teBetalen: order.totaal.teBetalen })
    } catch (err) {
      logger.error('Stripe-sessie aanmaken mislukt', err)
      // De optie blijft staan en vervalt vanzelf binnen het halfuur; opruimen
      // met de hand zou hier een tweede ding zijn dat kan mislukken.
      return res.status(502).json({ fout: 'betaling_niet_gestart', orderId: order.id })
    }
  }
)

/**
 * De regels zoals Stripe ze toont.
 *
 * Btw en waarborg staan als aparte regel en zitten niet in de stukprijs
 * verwerkt. Dat is eerlijker op het scherm — een huurder ziet waarvoor hij
 * tekent — en het maakt de som exact: tel je de regels op, dan staat er wat
 * wij `teBetalen` noemen, zonder afrondingsverschil van een cent.
 */
function stripeRegels(totaal) {
  const regels = totaal.regels.map((r) => ({
    quantity: 1,
    price_data: {
      currency: 'eur',
      unit_amount: centen(r.netto),
      product_data: {
        name: `${r.aantal}× ${r.naam}`,
        description: `${r.dagen} ${r.dagen === 1 ? 'dag' : 'dagen'} huur`,
      },
    },
  }))

  if (totaal.btw > 0) {
    regels.push({
      quantity: 1,
      price_data: { currency: 'eur', unit_amount: centen(totaal.btw), product_data: { name: 'Btw 21%' } },
    })
  }

  if (totaal.waarborg > 0) {
    regels.push({
      quantity: 1,
      price_data: {
        currency: 'eur',
        unit_amount: centen(totaal.waarborg),
        product_data: {
          name: 'Waarborg',
          description: 'Wordt teruggestort bij onbeschadigde teruggave.',
        },
      },
    })
  }

  return regels
}

/**
 * Stripe meldt wat er met de betaling gebeurd is.
 *
 * ── Waarom de handtekening het halve verhaal is ───────────────────────────
 * Dit adres is openbaar. Zonder controle van de handtekening kan iedereen die
 * het kent een "betaald" posten voor een order die nooit betaald is, en dan
 * staat er een tent klaar voor niets. De handtekening is het enige bewijs dat
 * dit bericht van Stripe komt en onderweg niet veranderd is.
 *
 * ── En waarom het bedrag óók nagekeken wordt ──────────────────────────────
 * Een geldige handtekening zegt dat Stripe het stuurde, niet dat er het juiste
 * bedrag binnenkwam. Klopt het bedrag niet met wat wij berekenden, dan gaat de
 * order niet door maar naar `nakijken`: liever een telefoontje dan een stille
 * fout in de boekhouding.
 */
export const verhuurWebhook = onRequest(
  { region, cors: false, secrets: [STRIPE_SECRET, STRIPE_WEBHOOK_SECRET], invoker: 'public' },
  async (req, res) => {
    const stripe = new Stripe(STRIPE_SECRET.value())

    let gebeurtenis
    try {
      gebeurtenis = stripe.webhooks.constructEvent(
        req.rawBody,
        req.get('stripe-signature'),
        STRIPE_WEBHOOK_SECRET.value()
      )
    } catch (err) {
      logger.warn('Webhook met een handtekening die niet klopt', err?.message)
      return res.status(400).send('handtekening klopt niet')
    }

    const sessie = gebeurtenis.data?.object ?? {}
    const orderId = sessie.metadata?.orderId ?? sessie.client_reference_id ?? null
    if (!orderId) return res.status(200).send('geen order')

    try {
      if (gebeurtenis.type === 'checkout.session.completed' && sessie.payment_status === 'paid') {
        await betaald(orderId, sessie)
      } else if (gebeurtenis.type === 'checkout.session.expired') {
        await vervallen(orderId)
      }
    } catch (err) {
      logger.error('Webhook verwerken mislukt', err)
      // Een 500 laat Stripe het opnieuw proberen, en dat is hier gewenst: de
      // afhandeling is idempotent, dus een tweede poging kan geen kwaad.
      return res.status(500).send('mislukt')
    }

    return res.status(200).send('ok')
  }
)

/**
 * De optie wordt vast.
 *
 * In een transactie en met een controle op de stand, want Stripe stuurt
 * hetzelfde bericht gerust twee keer. Is de order al betaald, dan gebeurt er
 * niets — en dat is het goede antwoord, geen fout.
 */
async function betaald(orderId, sessie) {
  await db.runTransaction(async (transactie) => {
    const orderRef = db.collection('huurorders').doc(orderId)
    const snap = await transactie.get(orderRef)
    if (!snap.exists) {
      logger.warn('Betaling voor een order die niet bestaat', orderId)
      return
    }
    const order = snap.data()
    if (order.status === 'betaald' || order.status === 'nakijken') return

    const binnen = Number(sessie.amount_total)
    if (Number.isFinite(binnen) && binnen !== order.teBetalenCent) {
      logger.error('Betaald bedrag wijkt af', { orderId, binnen, verwacht: order.teBetalenCent })
      transactie.update(orderRef, {
        status: 'nakijken',
        betaaldCent: binnen,
        updatedAt: FieldValue.serverTimestamp(),
      })
      return
    }

    for (const id of order.reservatieIds ?? []) {
      transactie.update(db.collection('reservaties').doc(id), {
        status: 'vast',
        // Vast is vast: de vervaldatum hoort er niet meer bij te staan, anders
        // telt `vrij.js` de reservatie ooit nog eens weg.
        optieVervalt: null,
        updatedAt: FieldValue.serverTimestamp(),
      })
    }

    transactie.update(orderRef, {
      status: 'betaald',
      betaaldCent: binnen ?? order.teBetalenCent,
      betaaldOp: FieldValue.serverTimestamp(),
      paymentIntentId: sessie.payment_intent ?? null,
      optieVervalt: null,
      updatedAt: FieldValue.serverTimestamp(),
    })
  })
}

/** De klant rekende niet af. De optie gaat weg en de voorraad komt terug. */
async function vervallen(orderId) {
  await db.runTransaction(async (transactie) => {
    const orderRef = db.collection('huurorders').doc(orderId)
    const snap = await transactie.get(orderRef)
    if (!snap.exists) return
    const order = snap.data()
    if (order.status !== 'wacht_op_betaling') return

    for (const id of order.reservatieIds ?? []) {
      transactie.delete(db.collection('reservaties').doc(id))
    }
    transactie.update(orderRef, {
      status: 'vervallen',
      reservatieIds: [],
      updatedAt: FieldValue.serverTimestamp(),
    })
  })
}

/**
 * Het opruimen van wat Stripe niet meldde.
 *
 * `vrij.js` telt een vervallen optie al niet meer mee, dus de voorraad is
 * meteen terug — dit is er voor het scherm. Zonder deze ronde staat het
 * magazijn vol met blauwe balkjes van mensen die nooit betaald hebben, en dan
 * vertrouwt niemand de kalender nog. Eens per uur is ruim genoeg: een optie
 * leeft iets meer dan een halfuur.
 *
 * De grens ligt vijf minuten in het verleden en niet op nu: een order die net
 * vervalt terwijl de webhook van de betaling onderweg is, mag deze ronde niet
 * voor zijn.
 */
export const verlopenOptiesOpruimen = onSchedule(
  { region, schedule: 'every 60 minutes', timeZone: 'Europe/Brussels' },
  async () => {
    const grens = Timestamp.fromMillis(Date.now() - 5 * 60 * 1000)
    const snap = await db
      .collection('huurorders')
      .where('status', '==', 'wacht_op_betaling')
      .where('optieVervalt', '<', grens)
      .limit(200)
      .get()

    for (const doc of snap.docs) {
      await vervallen(doc.id)
    }

    if (!snap.empty) logger.info(`${snap.size} verlopen huuropties opgeruimd.`)
  }
)
