#!/usr/bin/env node
/**
 * De browsertest: draait de echte app in een echte browser.
 *
 *   npm run build:demo && node scripts/smoke.mjs
 *
 * De unittests dekken het rekenwerk — posities, datums, regels, meldingen.
 * Wat ze niet dekken is precies wat de mensen die hiermee werken overkomt: een
 * scherm dat niet opent. Deze test loopt daarom elke pagina af en kijkt of er
 * iets staat, of er geen fout in de console valt, en of de dingen die je op
 * zo'n scherm doet ook echt iets doen.
 *
 * Eén geval staat er apart in, omdat het echt gebeurd is: een tabblad dat
 * openstaat terwijl er uitgerold wordt, vraagt een bestandsnaam op die niet
 * meer bestaat. Dat gaf een wit scherm. De test zorgt dat het dat nooit meer
 * wordt.
 *
 * Er draait geen Firebase aan: de demobuild vervangt de SDK door een
 * in-memory versie met vaste voorbeeldgegevens. Dat maakt de test snel en
 * herhaalbaar, en het is dezelfde applicatiecode.
 */

import { createServer } from 'node:http'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { dirname, extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist-demo')
// Verzetbaar, zodat twee takken tegelijk kunnen testen zonder elkaar de poort
// af te nemen.
const POORT = Number(process.env.SMOKE_PORT ?? 4310)
const adres = `http://localhost:${POORT}`

if (!existsSync(join(root, 'index.html'))) {
  console.error('Geen dist-demo gevonden. Draai eerst: npm run build:demo')
  process.exit(1)
}

const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json',
}

// Wat er weg moet doen alsof het weg is — zo wordt een uitrol nagespeeld.
const verdwenen = new Set()

const server = createServer((req, res) => {
  const pad = req.url.split('?')[0]
  if ([...verdwenen].some((deel) => pad.includes(deel))) {
    res.writeHead(404)
    res.end('weg')
    return
  }
  let bestand = join(root, pad === '/' ? 'index.html' : pad)
  if (!existsSync(bestand) || statSync(bestand).isDirectory()) bestand = join(root, 'index.html')
  res.writeHead(200, { 'Content-Type': TYPES[extname(bestand)] ?? 'application/octet-stream' })
  createReadStream(bestand).pipe(res)
})

await new Promise((r) => server.listen(POORT, r))

// ─── Het testraamwerk, klein gehouden ───────────────────────────────────────

let gelukt = 0
const mislukt = []

async function test(naam, fn) {
  try {
    await fn()
    gelukt += 1
    console.log(`✓ ${naam}`)
  } catch (err) {
    mislukt.push({ naam, bericht: err.message })
    console.log(`✗ ${naam}\n    ${err.message.split('\n')[0]}`)
  }
}

const zouden = (waar, bericht) => {
  if (!waar) throw new Error(bericht)
}

const browser = await chromium.launch()

/** Een tabblad dat zijn fouten onthoudt; die tellen mee als resultaat. */
async function tabblad(pad = '/', { breedte = 1280, hoogte = 900 } = {}) {
  const page = await browser.newPage({ viewport: { width: breedte, height: hoogte } })
  const fouten = []
  page.on('pageerror', (e) => fouten.push(String(e).split('\n')[0]))
  page.on('console', (m) => {
    const tekst = m.text()
    // Het zelfondertekende certificaat van de testserver is niet ons probleem.
    if (m.type() === 'error' && !tekst.includes('ERR_CERT')) fouten.push(tekst.slice(0, 200))
  })
  await page.goto(`${adres}/#${pad}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(900)
  page.fouten = fouten
  return page
}

const inhoud = async (page) => (await page.locator('body').innerText()).trim()

// De app zet koppen in kapitalen via CSS, en innerText geeft terug wat er
// staat — dus vergelijken zonder op hoofdletters te letten.
const bevat = (tekst, naald) => tekst.toLowerCase().includes(naald.toLowerCase())

// ─── 1. Elke pagina opent ───────────────────────────────────────────────────

const PAGINAS = [
  ['Events', '/', 'Events'],
  ['Events als lijst', '/?weergave=lijst', 'Aanvraag tot offerte'],
  ['Kalender', '/kalender', 'Kalender'],
  ['Event', '/events/t-trouw', 'Trouw Niels en Inez'],
  ['Tasks', '/tasks', 'Tasks'],
  ['Werklast', '/werklast', 'Werklast'],
  ['Dashboard', '/dashboard', 'Dashboard'],
  ['Het oude adres van Vandaag', '/vandaag', 'Dashboard'],
  ['Bord Events', '/bord/l-overview', 'Events'],
  ['Bord Socials', '/bord/l-socials', 'Socials'],
  ['Socials', '/social', 'Socials'],
  ['Klanten', '/klanten', 'Klanten'],
  ['Openen & sluiten', '/openen-sluiten', 'Openen'],
  ['Registraties', '/registraties', 'Registraties'],
  ['Teamoverleg', '/overleg', 'Teamoverleg'],
  ['Uren', '/uren', 'Uren'],
  ['Goals', '/goals', 'Goals'],
  ['Instellingen', '/instellingen', 'Instellingen'],
  ['Onbekend pad', '/bestaat-niet', 'niet'],
  ['Bord dat niet bestaat', '/bord/bestaat-niet', 'niet gevonden'],
]

for (const [naam, pad, verwacht] of PAGINAS) {
  await test(`${naam} opent`, async () => {
    const page = await tabblad(pad)
    const tekst = await inhoud(page)
    zouden(tekst.length > 40, `leeg scherm op ${pad}`)
    zouden(bevat(tekst, verwacht), `"${verwacht}" staat niet op ${pad}`)
    zouden(page.fouten.length === 0, `fouten op ${pad}: ${page.fouten.slice(0, 2).join(' | ')}`)
    await page.close()
  })
}

// ─── 2. Een uitrol terwijl het tabblad openstaat ────────────────────────────

await test('een verdwenen pagina geeft geen wit scherm maar een uitleg', async () => {
  const page = await tabblad('/')
  verdwenen.add('/assets/Goals-')

  await page.getByLabel('Hoofdnavigatie').getByRole('link', { name: /^Tasks/ }).first().click()
  await page.getByRole('link', { name: 'Goals', exact: true }).first().click()
  await page.waitForTimeout(2500)

  const tekst = await inhoud(page)
  zouden(tekst.length > 40, 'het scherm is wit geworden')
  zouden(tekst.includes('opnieuw laden'), `geen uitleg, wel: ${tekst.slice(0, 80)}`)
  zouden(tekst.includes('Tasks'), 'de zijbalk is verdwenen; je kunt nergens heen')

  verdwenen.delete('/assets/Goals-')
  await page.close()
})

await test('na de herlaadbeurt werkt die pagina gewoon weer', async () => {
  const page = await tabblad('/goals')
  const tekst = await inhoud(page)
  zouden(tekst.includes('Omzet events'), 'de goals staan er niet')
  await page.close()
})

await test('een kapotte pagina laat de rest van de tool staan', async () => {
  const page = await tabblad('/')
  verdwenen.add('/assets/TimeTracking-')

  await page.getByLabel('Hoofdnavigatie').getByRole('link', { name: /^Team/ }).first().click()
  await page.getByRole('link', { name: 'Uren' }).first().click()
  await page.waitForTimeout(2200)
  zouden((await inhoud(page)).includes('opnieuw laden'), 'geen uitleg na de fout')

  // En je kunt gewoon verder: een andere pagina hoort de melding weg te halen.
  await page.getByRole('link', { name: /^Tasks/ }).first().click()
  await page.waitForTimeout(1200)
  const tekst = await inhoud(page)
  zouden(!tekst.includes('opnieuw laden'), 'de foutmelding bleef staan na het wegklikken')
  zouden(tekst.includes('Te laat') || tekst.includes('Vandaag'), 'Tasks opende niet')

  verdwenen.delete('/assets/TimeTracking-')
  await page.close()
})

// ─── 3. De dingen die mensen op die schermen doen ───────────────────────────

await test('het socialbord toont de events vanaf ready to invoice', async () => {
  const page = await tabblad('/social')
  const tekst = await inhoud(page)
  for (const kolom of ['Social content delivery', 'Social content ready', 'Social content posted']) {
    zouden(bevat(tekst, kolom), `kolom "${kolom}" ontbreekt`)
  }
  zouden(!bevat(tekst, 'Requirements'), 'het requirementsbord staat er nog')
  // Staat op "invoiced" met stand posted, en op "ready to invoice" met stand ready.
  zouden(tekst.includes('Astrid Odeurs'), 'een gefactureerd event ontbreekt op het bord')
  zouden(tekst.includes('Loonse Feesten'), 'een event met stand "ready" ontbreekt')
  // Bewust uitgezet: een vergaderzaal voor tien man levert geen content op.
  zouden(!tekst.includes('Canon Event'), 'een uitgezet event staat er toch op')
  zouden(page.fouten.length === 0, `fouten: ${page.fouten[0]}`)
  await page.close()
})

await test('de kalender en de posts blijven bestaan naast het eventbord', async () => {
  const page = await tabblad('/social')
  await page.getByRole('tab', { name: 'Kalender' }).click()
  await page.waitForTimeout(900)
  zouden((await inhoud(page)).includes('posts in'), 'de kalender opent niet')
  await page.getByRole('tab', { name: 'Posts', exact: true }).click()
  await page.waitForTimeout(900)
  zouden(bevat(await inhoud(page), 'Goedgekeurd'), 'het postenbord opent niet')
  await page.close()
})

await test('een klant toont zijn gegevens, events en documenten', async () => {
  const page = await tabblad('/klanten')
  const tekst = await inhoud(page)
  zouden(tekst.includes('Blum België'), 'de klanten staan er niet')

  await page.getByText('Blum België').first().click()
  await page.waitForTimeout(900)
  const paneel = page.getByRole('dialog')
  const paneeltekst = await paneel.innerText()
  // De contactgegevens staan in invoervelden en dus niet in de tekst.
  const velden = await paneel.locator('input').evaluateAll((els) => els.map((e) => e.value))
  zouden(velden.includes('Karen Vandeput'), `contactpersoon ontbreekt: ${velden.slice(0, 6).join(' | ')}`)
  zouden(velden.includes('BE 0456.789.133'), 'het btw-nummer ontbreekt')
  zouden(paneeltekst.includes('blum-logo.svg'), 'het logo ontbreekt bij de klant')
  zouden(paneeltekst.includes('20-jarig bestaan'), 'het event van deze klant ontbreekt')
  zouden(page.fouten.length === 0, `fouten: ${page.fouten[0]}`)
  await page.close()
})

await test('de klantfiche toont de historiek en wat er nog te factureren valt', async () => {
  // Waar de klantenmodule om bestaat. Stond dit er niet, dan was een klant een
  // adresboekje en moest je de bedragen van het bord bij elkaar zoeken.
  const page = await tabblad('/klanten')
  await page.getByText('Blum België').first().click()
  await page.waitForTimeout(900)
  const paneel = await page.getByRole('dialog').innerText()

  zouden(bevat(paneel, 'Historiek (3 events)'), `de historiek klopt niet: ${paneel.slice(0, 200)}`)
  for (const dossier of ['20-jarig bestaan', 'kerstborrel 2025', 'teambuilding productie']) {
    zouden(bevat(paneel, dossier), `"${dossier}" ontbreekt in de historiek`)
  }
  // 24.800 + 6.800 + 4.150, en de subtaken tellen niet mee.
  zouden(bevat(paneel, '35.750'), `het totaal ontbreekt: ${paneel.slice(0, 300)}`)
  zouden(bevat(paneel, 'Nog te factureren (1)'), 'wat er te factureren valt staat er niet apart')
  zouden(bevat(paneel, '4.150'), 'het openstaande bedrag ontbreekt')
  // Het factuuradres van Blum wijkt af van het bezoekadres.
  zouden(bevat(paneel, 'facturen@blum.be'), 'het factuur-e-mailadres ontbreekt')
  zouden(bevat(paneel, 'Postbus 40'), 'het aparte factuuradres ontbreekt')
  zouden(bevat(paneel, 'bel Karen Vandeput'), 'de hoofdcontactpersoon staat er niet')
  zouden(page.fouten.length === 0, `fouten: ${page.fouten[0]}`)
  await page.close()
})

await test('een klant kiezen op een event zet hem in de historiek van die klant', async () => {
  const page = await tabblad('/events/t-ruben')
  await page.getByRole('button', { name: 'Fiche bewerken' }).first().click()
  await page.waitForTimeout(600)

  const dialoog = page.getByRole('dialog')
  await dialoog.getByLabel('Klant van dit event').selectOption({ label: 'Stad Borgloon' })
  await page.waitForTimeout(300)
  await dialoog.getByRole('button', { name: 'Bewaren' }).click()
  await page.waitForTimeout(1000)
  zouden(bevat(await inhoud(page), 'Stad Borgloon'), 'de klant staat niet op de fiche van het event')

  // En dan het punt van de hele koppeling: het dossier hoort meteen bij de klant.
  await page.goto(`${adres}/#/klanten`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(900)
  await page.getByText('Stad Borgloon').first().click()
  await page.waitForTimeout(900)
  const paneel = await page.getByRole('dialog').innerText()
  zouden(bevat(paneel, 'Ruben Theuwen'), `het event staat niet in de historiek: ${paneel.slice(0, 250)}`)
  zouden(page.fouten.length === 0, `fouten: ${page.fouten[0]}`)
  await page.close()
})

await test('een klant die nog niet bestaat maak je aan vanaf het event', async () => {
  // De reden dat de klantenlijst leeg bleef: wie eerst naar Klanten moest,
  // typte in de praktijk gewoon een naam in het vrije veld.
  const page = await tabblad('/events/t-jolien')
  await page.getByRole('button', { name: 'Fiche bewerken' }).first().click()
  await page.waitForTimeout(600)

  const dialoog = page.getByRole('dialog')
  await dialoog.getByLabel('Klant van dit event').selectOption('__nieuw')
  await page.waitForTimeout(400)
  await dialoog.getByLabel('Naam van de klant').fill('Jolien en Bernd')
  await dialoog.getByLabel('Btw-nummer').fill('0400378485')
  await dialoog.getByRole('button', { name: 'Klant aanmaken' }).click()
  await page.waitForTimeout(900)

  const gekozen = await dialoog.getByLabel('Klant van dit event').evaluate((el) => el.selectedOptions[0].text)
  zouden(gekozen === 'Jolien en Bernd', `de nieuwe klant staat niet gekozen: ${gekozen}`)
  await dialoog.getByRole('button', { name: 'Bewaren' }).click()
  await page.waitForTimeout(1000)

  await page.goto(`${adres}/#/klanten`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(900)
  await page.getByText('Jolien en Bernd').first().click()
  await page.waitForTimeout(900)
  const paneel = page.getByRole('dialog')
  const velden = await paneel.locator('input').evaluateAll((els) => els.map((e) => e.value))
  // Ingetypt als 0400378485, bewaard als een leesbaar nummer.
  zouden(velden.includes('BE 0400.378.485'), `het btw-nummer is niet netgezet: ${velden.slice(0, 5).join(' | ')}`)
  zouden(bevat(await paneel.innerText(), 'doopsel'), 'het event hangt niet aan de nieuwe klant')
  zouden(page.fouten.length === 0, `fouten: ${page.fouten[0]}`)
  await page.close()
})

await test('een event toont zijn klant en zijn social-schakelaar', async () => {
  const page = await tabblad('/bord/l-overview')
  await page.locator('main').getByText('Blum België — 20-jarig bestaan').first().click()
  await page.waitForTimeout(900)
  const paneel = page.getByRole('dialog')
  const tekst = await paneel.innerText()
  zouden(bevat(tekst, 'Social content'), 'de social-sectie ontbreekt')
  zouden(bevat(tekst, 'Documenten bij dit event'), 'de documenten ontbreken')

  const klant = await paneel.getByLabel('Klant van dit event').inputValue()
  zouden(klant === 'k-blum', `de klant staat niet gekozen: ${klant}`)
  await page.close()
})

await test('een taak opent in het zijpaneel', async () => {
  const page = await tabblad('/bord/l-overview')
  // In de bovenbalk staat dezelfde titel op de lopende timer; het gaat om de kaart.
  await page.locator('main').getByText('Trouw Niels en Inez').first().click()
  await page.waitForTimeout(900)
  const paneel = await page.getByRole('dialog').innerText()
  zouden(paneel.includes('Trouw Niels en Inez'), 'de taak staat niet in het paneel')
  zouden(page.fouten.length === 0, `fouten: ${page.fouten[0]}`)
  await page.close()
})

await test('een punt afvinken op de dagelijkse lijst blijft staan', async () => {
  const page = await tabblad('/openen-sluiten')
  const vakjes = page.locator('input[type=checkbox]')
  const voor = await vakjes.evaluateAll((els) => els.filter((e) => e.checked).length)
  await vakjes.nth(await vakjes.evaluateAll((els) => els.findIndex((e) => !e.checked))).check()
  await page.waitForTimeout(700)
  const na = await vakjes.evaluateAll((els) => els.filter((e) => e.checked).length)
  zouden(na === voor + 1, `${voor} → ${na} afgevinkt`)
  await page.close()
})

await test('een agendapunt toevoegen komt op de agenda', async () => {
  const page = await tabblad('/overleg')
  await page.getByLabel('Onderwerp').fill('Punt uit de browsertest')
  await page.getByLabel('Omschrijving').fill('Toegevoegd door scripts/smoke.mjs.')
  await page.getByRole('button', { name: 'Op de agenda' }).click()
  await page.waitForTimeout(800)
  zouden((await inhoud(page)).includes('Punt uit de browsertest'), 'het punt staat er niet')
  await page.close()
})

await test('het verloop van een doel is uit te klappen', async () => {
  const page = await tabblad('/goals')
  await page.getByRole('button', { name: 'Verloop' }).first().click()
  await page.waitForTimeout(700)
  const tekst = await inhoud(page)
  zouden(tekst.includes('Blum bevestigd'), 'de check-ins staan er niet')
  zouden(page.fouten.length === 0, `fouten: ${page.fouten[0]}`)
  await page.close()
})

await test('de vorige dag van een dagelijkse lijst opent zonder te crashen', async () => {
  // Dit was een wit scherm: de tijdstippen van gisteren komen als Timestamp
  // terug, niet als Date, en Intl gooide daarop RangeError tijdens het tekenen.
  const page = await tabblad('/openen-sluiten')
  await page.getByRole('button', { name: 'Vorige dag' }).click()
  await page.waitForTimeout(900)
  const tekst = await inhoud(page)
  zouden(bevat(tekst, 'Openen'), 'de lijst van gisteren staat er niet')
  zouden(bevat(tekst, 'Lotte'), `wie afvinkte staat er niet: ${tekst.slice(0, 200)}`)
  zouden(page.fouten.length === 0, `fouten: ${page.fouten[0]}`)
  await page.close()
})

await test('een punt toevoegen aan een dagelijkse lijst werkt', async () => {
  const page = await tabblad('/instellingen')
  await page.getByRole('tab', { name: 'Dagelijkse lijsten' }).click()
  await page.waitForTimeout(800)
  // De titels staan in invoervelden, dus niet in de tekst van de pagina.
  const groepen = await page
    .locator('input[aria-label="Naam van de groep"]')
    .evaluateAll((els) => els.map((e) => e.value))
  zouden(groepen.some((g) => g.includes('Aankomst')), `groepen: ${groepen.join(', ')}`)

  await page.getByRole('button', { name: '+ Punt' }).first().click()
  await page.waitForTimeout(500)
  const veld = page.getByPlaceholder('Wat moet er gebeuren?').first()
  await veld.fill('Terrasverwarmer nakijken')
  await veld.blur()
  await page.waitForTimeout(400)
  await page.getByLabel('Wie ziet dit punt').first().selectOption('zaal')
  await page.waitForTimeout(600)

  // En het komt ook echt op de lijst van vandaag terecht.
  await page.getByLabel('Hoofdnavigatie').getByRole('link', { name: /^Bistro/ }).first().click()
  await page.getByRole('link', { name: 'Openen & sluiten' }).first().click()
  await page.waitForTimeout(1000)
  zouden(
    (await inhoud(page)).includes('Terrasverwarmer nakijken'),
    'het nieuwe punt staat niet op de dagelijkse lijst'
  )
  zouden(page.fouten.length === 0, `fouten: ${page.fouten[0]}`)
  await page.close()
})

await test('het dashboard geeft een overzicht over de hele applicatie', async () => {
  const page = await tabblad('/dashboard')
  const tekst = await inhoud(page)
  for (const naald of [
    'Te laat',
    'Te factureren',
    'Events deze maand',
    'Wat er aankomt',
    'Wat bij jou ligt',
    'Bistro vandaag',
    'Socials deze week',
  ]) {
    zouden(bevat(tekst, naald), `"${naald}" staat niet op het dashboard`)
  }
  // Elk cijfer is een link naar de plek waar je het oplost.
  await page.getByRole('link', { name: /Te factureren/ }).first().click()
  await page.waitForTimeout(800)
  zouden(bevat(await inhoud(page), 'Events'), 'het cijfer bracht je nergens')
  zouden(page.fouten.length === 0, `fouten: ${page.fouten[0]}`)
  await page.close()
})

await test('het bord van een lijst zit in de Tasks-pagina', async () => {
  // Het oude adres blijft werken en brengt je naar de plek waar dat bord woont.
  const page = await tabblad('/bord/l-overleg')
  await page.waitForTimeout(1200)
  zouden(page.url().includes('/tasks'), `bleef op ${page.url()}`)

  const tekst = await inhoud(page)
  zouden(bevat(tekst, 'Tasks'), 'de Tasks-pagina opende niet')
  for (const kolom of ['open', 'on going', 'closed']) {
    zouden(bevat(tekst, kolom), `de kolom "${kolom}" van de lijst staat er niet`)
  }
  zouden(bevat(tekst, 'Nieuwe taak'), 'je kunt geen taak toevoegen op het bord')

  // En er is maar één ingang naar hetzelfde werk: geen "Alle taken" ernaast.
  const zijbalk = await page.getByLabel('Hoofdnavigatie').innerText()
  zouden(!bevat(zijbalk, 'Alle taken'), `de zijbalk heeft nog twee ingangen: ${zijbalk}`)
  zouden(page.fouten.length === 0, `fouten: ${page.fouten[0]}`)
  await page.close()
})

await test('de kolommen van een bord zijn aanpasbaar via instellingen', async () => {
  // Het tabblad staat in het adres, dus rechtstreeks ernaartoe.
  const page = await tabblad('/instellingen?tab=structuur')
  await page.getByRole('button', { name: 'Kolommen' }).first().click()
  await page.waitForTimeout(900)

  const dialoog = page.getByRole('dialog')
  const tekst = await dialoog.innerText()
  zouden(bevat(tekst, 'Kolommen van'), `de kolomeditor opende niet: ${tekst.slice(0, 80)}`)
  zouden(bevat(tekst, 'taken'), 'de aantallen per kolom ontbreken')

  // Een kolom weghalen vraagt eerst waar de taken heen moeten.
  const rijen = dialoog.locator('ul > li')
  await rijen.first().getByRole('button', { name: /verwijderen/i }).click()
  await page.waitForTimeout(500)
  const na = await dialoog.innerText()
  zouden(bevat(na, 'Kolommen die verdwijnen'), 'er wordt niet gevraagd waar de taken heen gaan')
  zouden(await dialoog.getByRole('button', { name: 'Opslaan' }).isDisabled(), 'opslaan kan zonder bestemming')

  await dialoog.getByRole('button', { name: 'Toch houden' }).click()
  await page.waitForTimeout(400)
  zouden(!(await dialoog.getByRole('button', { name: 'Opslaan' }).isDisabled()), 'opslaan blijft geblokkeerd')
  zouden(page.fouten.length === 0, `fouten: ${page.fouten[0]}`)
  await page.close()
})

await test('de business rules staan in de instellingen', async () => {
  const page = await tabblad('/instellingen')
  await page.getByRole('tab', { name: 'Business rules' }).click()
  await page.waitForTimeout(800)
  const tekst = await inhoud(page)
  zouden(tekst.includes('ready to invoice'), 'de facturatieregel ontbreekt')
  zouden(tekst.includes('wordt de enige toegewezene'), 'de regel wordt niet uitgelegd')
  await page.close()
})

await test('Tasks en Uren hebben een kalender', async () => {
  const werk = await tabblad('/tasks')
  await werk.getByRole('tab', { name: 'Kalender' }).click()
  await werk.waitForTimeout(900)
  const wt = await inhoud(werk)
  zouden(bevat(wt, 'ma'), 'geen weekdagen in de kalender')
  zouden(bevat(wt, 'met datum'), 'geen telling van taken met datum')
  zouden(werk.fouten.length === 0, `fouten: ${werk.fouten[0]}`)
  await werk.close()

  const uren = await tabblad('/uren')
  await uren.getByRole('tab', { name: 'Kalender' }).click()
  await uren.waitForTimeout(900)
  zouden(bevat(await inhoud(uren), 'deze maand'), 'geen maandtotaal op de urenkalender')
  zouden(uren.fouten.length === 0, `fouten: ${uren.fouten[0]}`)
  await uren.close()
})

await test('een event dat klaar is om te factureren staat niet te laat', async () => {
  // Het feest is geweest, alleen de factuur loopt nog. Eerder stond hier
  // "31 dagen te laat" in het rood, en dat maakt de kleur waardeloos.
  const page = await tabblad('/tasks?weergave=lijst&groep=deadline&wie=iedereen')
  await page.waitForTimeout(1000)
  const tekst = await inhoud(page)
  zouden(bevat(tekst, 'Loonse Feesten'), `het event staat er niet: ${tekst.slice(0, 200)}`)

  const regel = page.locator('li', { hasText: 'Loonse Feesten 2026' }).first()
  const regelTekst = await regel.innerText()
  zouden(!bevat(regelTekst, 'te laat'), `staat toch te laat: ${regelTekst}`)
  zouden(page.fouten.length === 0, `fouten: ${page.fouten[0]}`)
  await page.close()
})

await test('het registratieverslag toont de maand met zijn metingen', async () => {
  const page = await tabblad('/registraties')
  await page.waitForTimeout(900)
  const tekst = await inhoud(page)
  for (const naald of ['Afgevinkt', 'Volledige dagen', 'Overschrijdingen', 'Dag per dag']) {
    zouden(bevat(tekst, naald), `"${naald}" staat niet in het verslag`)
  }
  // Een maand die nog loopt hoort niet vooruit te kijken.
  const volgende = page.getByRole('button', { name: 'Volgende maand' })
  zouden(await volgende.isDisabled(), 'je kunt naar een maand in de toekomst bladeren')
  zouden(page.fouten.length === 0, `fouten: ${page.fouten[0]}`)
  await page.close()
})

await test('een te warme koelkast wordt meteen aangegeven', async () => {
  const page = await tabblad('/openen-sluiten')
  await page.getByRole('tab', { name: 'FAVV-registraties' }).click()
  await page.waitForTimeout(900)

  const veld = page.getByLabel(/Gemeten voor Temperatuur koelkasten/)
  zouden((await veld.count()) === 1, 'het meetveld bij de koelkasten ontbreekt')
  zouden(bevat(await inhoud(page), 'max 7'), 'de grens staat er niet bij')

  await veld.fill('9')
  await veld.blur()
  await page.waitForTimeout(600)
  zouden(bevat(await inhoud(page), 'Boven de grens'), 'een te warme koelkast geeft geen waarschuwing')

  // Binnen de grens hoort er niets te staan — anders leert men de melding negeren.
  await veld.fill('4')
  await veld.blur()
  await page.waitForTimeout(600)
  zouden(!bevat(await inhoud(page), 'Boven de grens'), 'de waarschuwing blijft staan bij een goede meting')
  zouden(page.fouten.length === 0, `fouten: ${page.fouten[0]}`)
  await page.close()
})

await test('een punt kan om een datum vragen, en die blijft staan', async () => {
  const page = await tabblad('/openen-sluiten')
  await page.getByRole('tab', { name: 'FAVV-registraties' }).click()
  await page.waitForTimeout(900)

  const veld = page.getByLabel(/Laatst vervangen op voor Frituurolie/)
  zouden((await veld.count()) === 1, 'het datumveld bij de frituurolie ontbreekt')
  await veld.fill('2026-09-27')
  await veld.blur()
  await page.waitForTimeout(700)
  zouden(bevat(await inhoud(page), 'ingevuld door'), 'de ingevulde waarde wordt niet bewaard')
  await page.close()
})

await test('een onderwerp op de socialkalender komt bij Charish', async () => {
  const page = await tabblad('/social')
  await page.getByRole('tab', { name: 'Kalender' }).click()
  await page.waitForTimeout(900)

  const veld = page.getByLabel('Onderwerp toevoegen')
  await veld.fill('Kerstmenu aankondigen')
  zouden(bevat(await inhoud(page), 'Charish'), 'er staat niet bij wie het krijgt')
  await veld.press('Enter')
  await page.waitForTimeout(900)
  zouden(bevat(await inhoud(page), 'Kerstmenu aankondigen'), 'het onderwerp staat niet in de lijst')
  await page.close()
})

await test('een subtaak opent zijn eigen fiche', async () => {
  const page = await tabblad('/bord/l-overview')
  await page.locator('main').getByText('Trouw Niels en Inez').first().click()
  await page.waitForTimeout(900)
  await page.getByRole('button', { name: 'Offerte afwerken en versturen' }).click()
  await page.waitForTimeout(900)
  const panelen = await page.getByRole('dialog').count()
  zouden(panelen === 2, `verwacht twee panelen, kreeg er ${panelen}`)
  const laatste = await page.getByRole('dialog').last().innerText()
  zouden(bevat(laatste, 'Deadline'), 'de subtaak heeft geen eigen deadline-veld')
  zouden(bevat(laatste, 'Toegewezen aan'), 'de subtaak heeft geen eigen toewijzing')
  await page.close()
})

await test('de lopende timer staat in de zijbalk', async () => {
  const page = await tabblad('/')
  const balk = await page.locator('aside').first().innerText()
  zouden(/\d+:\d\d:\d\d/.test(balk), `geen loper in de zijbalk: ${balk.replace(/\n/g, ' ')}`)
  zouden(balk.includes('Drankenlijst finaliseren'), 'de taak van de timer staat er niet')
  await page.close()
})

// ─── Het design: events, pijplijn, templates ────────────────────────────────

await test('een aanvraag zonder klant, gasten en offerte gaat niet naar de offertestap', async () => {
  const page = await tabblad('/events/t-ruben')
  const knop = page.getByRole('button', { name: /Naar offerte maken/i })
  zouden(await knop.isDisabled(), 'de knop naar de offertestap is niet geblokkeerd')
  zouden((await inhoud(page)).includes('Vul klant, datum, aantal gasten en offertebedrag in'), 'geen uitleg bij de blokkering')
  await page.close()
})

await test('een nieuw event uit een template krijgt zijn taken met deadlines', async () => {
  const page = await tabblad('/')
  await page.getByRole('button', { name: 'Nieuw event' }).click()
  await page.getByPlaceholder('bv. Trouw Tom en Sara').fill('Trouw Tom en Sara')
  await page.getByRole('button', { name: /Huwelijk/ }).click()
  await page.getByRole('button', { name: 'Event aanmaken' }).click()
  await page.waitForTimeout(1200)
  const tekst = await inhoud(page)
  zouden(tekst.includes('Trouw Tom en Sara'), 'het event opende niet')
  zouden(tekst.includes('Voorschot 40% ontvangen'), 'de taken uit het template staan er niet')
  zouden(bevat(tekst, 'Taken · 8'), `niet alle acht taken: ${tekst.match(/Taken · \d+/i)?.[0]}`)
  zouden(page.fouten.length === 0, `fouten: ${page.fouten[0]}`)
  await page.close()
})

await test('een taak afvinken telt mee in de voortgang', async () => {
  const page = await tabblad('/events/t-trouw')
  const voor = (await inhoud(page)).match(/Taken · (\d+)/i)?.[1]
  await page.locator('.je-check').first().click()
  await page.waitForTimeout(600)
  const na = (await inhoud(page)).match(/Taken · (\d+)/i)?.[1]
  zouden(Number(na) === Number(voor) - 1, `open taken ${voor} → ${na}`)
  await page.close()
})

await test('de zoekbalk vindt events en taken', async () => {
  const page = await tabblad('/')
  await page.getByLabel('Zoeken').fill('drankenlijst')
  await page.waitForTimeout(400)
  const tekst = await inhoud(page)
  zouden(tekst.includes('Drankenlijst finaliseren'), 'de taak wordt niet gevonden')
  await page.keyboard.press('Enter')
  await page.waitForTimeout(800)
  zouden((await inhoud(page)).includes('Trouw Niels en Inez'), 'Enter opent het event niet')
  await page.close()
})

// ─── 4. Personeel ziet alleen zijn eigen scherm ─────────────────────────────

await test('personeel komt op de dagelijkse lijst en nergens anders', async () => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  const fouten = []
  page.on('pageerror', (e) => fouten.push(String(e).split('\n')[0]))
  await page.goto(`${adres}/?rol=personeel#/instellingen`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)

  const tekst = (await page.locator('body').innerText()).trim()
  zouden(tekst.includes('Openen'), 'personeel ziet de dagelijkse lijst niet')
  for (const verboden of ['Instellingen', 'Teamoverleg', 'Social kalender', 'Uren']) {
    zouden(!tekst.includes(verboden), `personeel ziet "${verboden}"`)
  }
  zouden(fouten.length === 0, `fouten: ${fouten[0]}`)
  await page.close()
})

// ─── 5. Installeerbaar op de telefoon ───────────────────────────────────────

await test('het manifest en de iconen staan er', async () => {
  const page = await tabblad('/')
  const manifest = await page.evaluate(async () => {
    const link = document.querySelector('link[rel=manifest]')
    return link ? (await fetch(link.href)).json() : null
  })
  zouden(manifest?.name === 'JE Plan', `naam in het manifest: ${manifest?.name}`)
  zouden(manifest.display === 'standalone', 'niet installeerbaar als app')
  zouden(
    manifest.icons.some((i) => i.purpose === 'maskable'),
    'geen maskable icoon'
  )

  for (const icoon of manifest.icons) {
    const ok = await page.evaluate(async (src) => {
      const res = await fetch(src)
      const buf = new Uint8Array(await res.arrayBuffer())
      return res.ok && String.fromCharCode(...buf.slice(1, 4)) === 'PNG'
    }, icoon.src)
    zouden(ok, `${icoon.src} is geen geldige PNG`)
  }
  await page.close()
})

// ─── 6. Snelheid, als vangrail ──────────────────────────────────────────────

await test('het eerste scherm staat er snel', async () => {
  const page = await tabblad('/')
  const meting = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0]
    const verf = performance.getEntriesByName('first-contentful-paint')[0]
    return {
      geladen: Math.round(nav.domContentLoadedEventEnd),
      klaar: Math.round(nav.loadEventEnd || nav.duration),
      verf: verf ? Math.round(verf.startTime) : null,
    }
  })
  console.log(`    dom ${meting.geladen} ms · eerste verf ${meting.verf} ms · klaar ${meting.klaar} ms`)

  // Geen benchmark maar een vangrail: dit is een lege testserver op dezelfde
  // machine. Loopt dit over de seconde, dan is er iets grondig misgegaan.
  zouden(meting.geladen < 3000, `het duurde ${meting.geladen} ms voor de pagina begon`)
  await page.close()
})

// ─── Uitslag ────────────────────────────────────────────────────────────────

await browser.close()
server.close()

console.log(`\n${gelukt} geslaagd, ${mislukt.length} mislukt`)
if (mislukt.length) {
  console.log(mislukt.map((m) => `  ✗ ${m.naam}: ${m.bericht}`).join('\n'))
  process.exit(1)
}
