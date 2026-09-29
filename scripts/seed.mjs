#!/usr/bin/env node
/**
 * De eerste vulling: de merken, de toegangsinstellingen en de borden.
 *
 * Draait bij elke uitrol, en dat stelt één harde eis: **niets overschrijven
 * wat in de app te wijzigen is.** Kolommen op een bord, de punten van een
 * dagelijkse lijst, de naam van een merk — dat staat in de app en dus in de
 * database, en de repo is daar niet de baas over. Een document dat al bestaat
 * blijft hier onaangeroerd; alleen wat ontbreekt wordt aangemaakt.
 *
 * Dat was eerder niet zo: alles werd met merge geschreven, en een merge
 * vervangt een veld dat een lijst is in zijn geheel. Elke uitrol zette de
 * bordkolommen en de dagelijkse lijsten terug naar de versie uit de repo. Met
 * de tool in gebruik is dat gegevensverlies.
 *
 *   GOOGLE_APPLICATION_CREDENTIALS=./service-account.json node scripts/seed.mjs
 */

import { readFileSync } from 'node:fs'
import { applicationDefault, cert, initializeApp } from 'firebase-admin/app'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { CHECKLIST_TEMPLATES } from '../src/lib/checklist-templates.js'
import { DEFAULT_FORMULES } from '../src/lib/formule-templates.js'
import { TASKS_KOLOMMEN, TASKS_LIJST_ID, planHernoeming, taakVelden } from '../src/lib/tasks-kolommen.js'

const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
initializeApp(
  credentialsPath
    ? { credential: cert(JSON.parse(readFileSync(credentialsPath, 'utf8'))) }
    : { credential: applicationDefault() }
)
const db = getFirestore()

const BRANDS = [
  { id: 'je-concept', name: 'JE Concept', color: '#1d57f5' },
  { id: 'bar-vue', name: 'Bar Vue', color: '#b8860b' },
  { id: 'meer', name: 'Meer — Het Vinne', color: '#0f8a5f' },
  { id: 'feestbeest', name: 'Feestbeest', color: '#e8578a' },
  { id: 'maison-folie', name: 'Maison Folie', color: '#7c3aed' },
  { id: 'wintermoods', name: 'Wintermoods', color: '#0ea5e9' },
  { id: 'kjk', name: 'Ken je klanten', color: '#38404f' },
]

/** The pipeline as it runs in ClickUp today, so nobody has to relearn it. */
const OVERVIEW_STATUSES = [
  ['request', '#8593a9', 'open'],
  ['create offer', '#3377ff', 'active'],
  ['offer send', '#7c3aed', 'active'],
  ['offer accepted', '#a855f7', 'active'],
  ['planning ongoing', '#1090e0', 'active'],
  ['planning ready', '#3db88b', 'active'],
  ['ready to invoice', '#0ea5e9', 'active'],
  ['invoiced', '#0d9488', 'done'],
  ['complete', '#008844', 'closed'],
]

const SOCIAL_STATUSES = [
  ['pending', '#87909e', 'open'],
  ['in progress', '#f8ae00', 'active'],
  ['ready for review', '#b660e0', 'active'],
  ['planning', '#5f55ee', 'active'],
  ['done', '#008844', 'closed'],
]

const columns = (rows) =>
  rows.map(([name, color, kind], position) => ({
    id: `seed-${name.replace(/[^a-z]+/gi, '-')}`,
    name,
    color,
    kind,
    position,
  }))

const aangemaakt = []
const overgeslagen = []
const aangevuld = []

/**
 * Schrijft alleen wanneer het document nog niet bestaat.
 *
 * Geen merge: een bestaand document is van de app, niet van de repo.
 */
async function zetAlsNieuw(ref, data, label) {
  const snap = await ref.get()
  if (snap.exists) {
    overgeslagen.push(label)
    return false
  }
  await ref.set({ ...data, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() })
  aangemaakt.push(label)
  return true
}

async function main() {
  // De toegangsinstellingen zijn het enige wat de repo wél mag bijwerken: ze
  // staan nergens in de app en een nieuw teamlid erbij moet hier kunnen.
  await db.collection('config').doc('access').set(
    {
      allowedDomains: ['jeconcept.be', 'kenjeklanten.be'],
      // Wie de lege werkruimte mag claimen. Zonder dit wordt dat "wie het eerst
      // inlogt", en dat is een race die je achteraf niet meer rechtzet.
      bootstrapOwnerEmail: (process.env.OWNER_EMAIL ?? 'jasper@kenjeklanten.be').toLowerCase(),
      // Wie de social content maakt: onderwerpen op de kalender komen bij
      // deze persoon terecht.
      socialOwnerEmail: (process.env.SOCIAL_OWNER_EMAIL ?? 'charish.talento@gmail.com').toLowerCase(),
      // Wie de samenvattingen van het teamoverleg mag lezen.
      meetingViewers: [
        'jasper@kenjeklanten.be',
        'anneleen@kenjeklanten.be',
        'maxine@jeconcept.be',
        'elke@kenjeklanten.be',
      ],
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  )

  // Alles hieronder is in de app te wijzigen — merknamen, bordkolommen, de
  // punten van een dagelijkse lijst. Bestaat het al, dan blijft het zoals het
  // team het gezet heeft.
  for (const [position, brand] of BRANDS.entries()) {
    await zetAlsNieuw(
      db.collection('brands').doc(brand.id),
      { key: brand.id, name: brand.name, color: brand.color, position, archived: false },
      `merk ${brand.name}`
    )
  }

  await zetAlsNieuw(
    db.collection('spaces').doc('je-concept'),
    { name: 'JE Concept', color: '#1d57f5', position: 1, archived: false },
    'ruimte JE Concept'
  )

  await zetAlsNieuw(
    db.collection('lists').doc('overview-planning'),
    {
      spaceId: 'je-concept',
      folderId: null,
      brandId: null,
      name: 'Events',
      description: 'Aanvraag → offerte → planning → facturatie. De hoofdpijplijn.',
      kind: 'tasks',
      position: 1,
      archived: false,
      statuses: columns(OVERVIEW_STATUSES),
    },
    'bord Events'
  )

  await zetAlsNieuw(
    db.collection('lists').doc('socials'),
    {
      spaceId: 'je-concept',
      folderId: null,
      brandId: null,
      name: 'Socials',
      description: 'Contentproductie voor alle merken.',
      kind: 'social',
      position: 2,
      archived: false,
      statuses: columns(SOCIAL_STATUSES),
    },
    'bord Socials'
  )

  // Het bord waarop de overlegverslagen en hun actiepunten landen.
  await zetAlsNieuw(
    db.collection('lists').doc(TASKS_LIJST_ID),
    {
      spaceId: 'je-concept',
      folderId: null,
      brandId: null,
      name: 'Tasks',
      description: 'Losse taken en de verslagen van het teamoverleg, met de actiepunten eronder.',
      kind: 'tasks',
      position: 3,
      archived: false,
      statuses: columns(TASKS_KOLOMMEN.map((k) => [k.name, k.color, k.kind])),
    },
    'bord Tasks'
  )

  for (const [position, template] of CHECKLIST_TEMPLATES.entries()) {
    await zetAlsNieuw(
      db.collection('checklists').doc(template.id),
      {
        key: template.key,
        name: template.name,
        kind: template.kind,
        brandId: null,
        sections: template.sections,
        position,
        archived: false,
      },
      `lijst ${template.name}`
    )
  }

  // De voorbeeldformules. Ook hier geldt: bestaat ze al, dan is ze van de app.
  // Een prijs die het team aanpaste mag geen uitrol overleven — dat zou een
  // verkochte formule stilletjes terugzetten naar wat er in de repo staat.
  for (const [position, formule] of DEFAULT_FORMULES.entries()) {
    const { id: formuleId, ...rest } = formule
    await zetAlsNieuw(db.collection('formules').doc(formuleId), { ...rest, position }, `formule ${formule.name}`)
  }

  await vulMeetveldenAan()

  await hernoemTasksKolommen()

  await vulKlantveldenAan()

  await seedFacturatieRegel()

  console.log(
    aangemaakt.length ? `Aangemaakt: ${aangemaakt.join(', ')}.` : 'Niets nieuws aan te maken.'
  )
  if (aangevuld.length) console.log(`Aangevuld op bestaande documenten — ${aangevuld.join(' | ')}.`)
  if (overgeslagen.length) {
    console.log(`Ongemoeid gelaten (bestaat al, is van de app): ${overgeslagen.join(', ')}.`)
  }
}

/**
 * De eerste business rule, en de reden dat ze bestaan: alles wat op "ready to
 * invoice" komt is werk voor Elke en voor niemand anders.
 *
 * Eén keer, niet bij elke seed. Een regel die iemand bewust weggooide moet niet
 * bij de volgende deploy terugkomen, dus staat er een vinkje in config/seeded.
 * De regel verwijst naar een profiel-id, en dat is de Google-uid van Elke — die
 * bestaat pas nadat ze één keer is ingelogd. Zolang dat niet zo is, slaan we
 * over en zegt de seed dat ook.
 */
/**
 * Geeft bestaande punten hun meetveld, zonder iets anders aan te raken.
 *
 * De lijsten zijn van de database zodra ze bestaan — dat is met opzet, want het
 * team past ze aan en een uitrol hoort dat niet te overschrijven. Maar de
 * FAVV-punten kregen een grens die er eerder niet was ("max 7 °C" in plaats van
 * een vinkje), en die staat in de sjablonen hier.
 *
 * Dit vult alleen aan: een punt dat al een `veld` heeft blijft zoals het is, een
 * punt dat het sjabloon niet kent wordt niet aangeraakt, en er verdwijnt niets.
 * Wat wel gebeurt staat in het logboek van de uitrol, per punt, zodat je achteraf
 * kunt nagaan wat er veranderd is.
 */
async function vulMeetveldenAan() {
  for (const template of CHECKLIST_TEMPLATES) {
    const ref = db.collection('checklists').doc(template.id)
    const snap = await ref.get()
    if (!snap.exists) continue

    const velden = new Map()
    for (const sectie of template.sections) {
      for (const punt of sectie.items) if (punt.veld) velden.set(punt.id, punt.veld)
    }
    if (velden.size === 0) continue

    const secties = snap.data().sections ?? []
    const bijgewerkt = []

    const nieuw = secties.map((sectie) => ({
      ...sectie,
      items: (sectie.items ?? []).map((punt) => {
        const veld = velden.get(punt.id)
        if (!veld || punt.veld) return punt
        bijgewerkt.push(punt.id)
        return { ...punt, veld }
      }),
    }))

    if (bijgewerkt.length === 0) continue

    await ref.set({ sections: nieuw, updatedAt: FieldValue.serverTimestamp() }, { merge: true })
    aangevuld.push(`${template.name}: ${bijgewerkt.join(', ')}`)
  }
}

/**
 * Geeft het Tasks-bord de kolomnamen van het werk dat erop staat.
 *
 * Het bord kwam mee uit ClickUp met "Opgenomen / Samengevat / Nagelezen" —
 * stappen van een verslag dat uitgetypt wordt. Wat er in de praktijk op staat
 * zijn losse taken, en die zijn open, bezig of klaar. Hierboven maakt de seed
 * een vers bord al met die namen aan, maar ze maakt niets aan wat al bestaat;
 * voor het bord dat live draait is dat te weinig.
 *
 * Dit is dus geen seed maar een verhuizing, in de geest van `vulMeetveldenAan`:
 * aanvullend, herhaalbaar, en er verdwijnt niets. Een kolom die het plan niet
 * kent blijft staan zoals ze is, met haar taken erin. Verandert de id van een
 * kolom, dan gaan de taken mee — een taak draagt naam, kleur en soort van haar
 * kolom als kopie bij zich, en zonder die kopie bij te werken staat ze straks
 * onder een kolom die niet meer bestaat. Wat er per kolom gebeurde staat in het
 * logboek van de uitrol, inclusief hoeveel taken er verhuisden.
 */
async function hernoemTasksKolommen() {
  const lijstRef = db.collection('lists').doc(TASKS_LIJST_ID)
  const snap = await lijstRef.get()
  if (!snap.exists) return

  const { statuses, regels, gewijzigd } = planHernoeming(snap.data().statuses ?? [])

  for (const regel of regels) {
    if (regel.actie === 'ongemoeid') {
      console.log(`Tasks-bord · "${regel.vanNaam}" niet herkend, ongemoeid gelaten.`)
    } else if (regel.actie === 'dubbel') {
      console.log(
        `Tasks-bord · "${regel.vanNaam}" komt op "${regel.doel}" uit, maar die kolom bestaat al. ` +
          'Ongemoeid gelaten — samenvoegen is een beslissing van het team.'
      )
    } else if (regel.actie === 'al goed') {
      console.log(`Tasks-bord · "${regel.vanNaam}" stond al goed.`)
    }
  }

  if (!gewijzigd) return

  // Eerst de taken, dan het bord. Faalt er iets halverwege, dan wijzen de taken
  // nog naar een kolom die bestaat; andersom zouden ze nergens meer staan.
  for (const regel of regels.filter((r) => r.verplaatsing)) {
    const taken = await db
      .collection('tasks')
      .where('listId', '==', TASKS_LIJST_ID)
      .where('statusId', '==', regel.verplaatsing.van)
      .get()

    const velden = taakVelden(regel.naarNaam)
    for (const stuk of stukjes(taken.docs, 400)) {
      const batch = db.batch()
      for (const taak of stuk) batch.update(taak.ref, { ...velden, updatedAt: FieldValue.serverTimestamp() })
      await batch.commit()
    }

    console.log(
      `Tasks-bord · "${regel.vanNaam}" → "${regel.naarNaam}" (${regel.verplaatsing.van} → ${regel.verplaatsing.naar}), ` +
        `${taken.size} ${taken.size === 1 ? 'taak' : 'taken'} mee verhuisd.`
    )
    aangevuld.push(`Tasks-kolom ${regel.vanNaam} → ${regel.naarNaam}: ${taken.size} taken`)
  }

  await lijstRef.set({ statuses, updatedAt: FieldValue.serverTimestamp() }, { merge: true })
}

/** Firestore neemt hoogstens 500 schrijfbewerkingen per batch. */
function* stukjes(rij, maat) {
  for (let i = 0; i < rij.length; i += maat) yield rij.slice(i, i + maat)
}

/**
 * Geeft bestaande klanten de facturatievelden die er nog niet waren.
 *
 * De klantfiche toont sinds kort een apart factuuradres en een factuur-e-mail.
 * Een klant die van voor die verandering dateert heeft die sleutels niet, en
 * dan schrijft het scherm bij de eerste wijziging een halve map terug.
 *
 * Aanvullend en niets anders: alleen een veld dat ontbreekt wordt gezet, en op
 * leeg — leeg betekent in de app "hetzelfde als het gewone adres". Namen,
 * btw-nummers en contactpersonen blijven onaangeroerd; die zijn van de app.
 * Wat er wel gebeurde staat per klant in het logboek van de uitrol.
 */
async function vulKlantveldenAan() {
  const LEEG_ADRES = { street: '', postalCode: '', city: '', country: 'België' }
  const klanten = await db.collection('customers').get()

  for (const snap of klanten.docs) {
    const data = snap.data()
    const patch = {}
    if (data.billingAddress === undefined) patch.billingAddress = LEEG_ADRES
    if (data.billingEmail === undefined) patch.billingEmail = ''
    if (Object.keys(patch).length === 0) continue

    await snap.ref.set({ ...patch, updatedAt: FieldValue.serverTimestamp() }, { merge: true })
    aangevuld.push(`klant ${data.name ?? snap.id}: ${Object.keys(patch).join(', ')}`)
  }
}

async function seedFacturatieRegel() {
  const marker = db.collection('config').doc('seeded')
  if ((await marker.get()).data()?.automationReadyToInvoice) return

  const email = (process.env.INVOICING_EMAIL ?? 'elke@kenjeklanten.be').toLowerCase()
  const profiel = await db.collection('profiles').where('email', '==', email).limit(1).get()

  if (profiel.empty) {
    console.log(`Business rule overgeslagen: ${email} heeft nog geen profiel. Zet de regel in Instellingen.`)
    return
  }

  await db.collection('automations').doc('ready-to-invoice').set({
    name: 'Facturatie is voor Elke',
    enabled: true,
    listId: 'overview-planning',
    trigger: { kind: 'status', status: 'ready to invoice' },
    actions: [{ kind: 'assignees', mode: 'set', profileIds: [profiel.docs[0].id] }],
    position: 0,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  })

  await marker.set({ automationReadyToInvoice: true, updatedAt: FieldValue.serverTimestamp() }, { merge: true })
  console.log(`Business rule gezet: ready to invoice → ${email}.`)
}

main().catch((err) => {
  console.error('Seed mislukt:', err.message)
  process.exit(1)
})
