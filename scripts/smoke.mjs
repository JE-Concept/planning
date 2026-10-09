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
import { cspVoor } from './lib/csp.mjs'
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium, devices } from 'playwright'
import { nieuwePagina, rustig } from './lib/rust.mjs'

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

const CSP = cspVoor('app')

const server = createServer((req, res) => {
  const pad = req.url.split('?')[0]
  if ([...verdwenen].some((deel) => pad.includes(deel))) {
    res.writeHead(404)
    res.end('weg')
    return
  }
  let bestand = join(root, pad === '/' ? 'index.html' : pad)
  if (!existsSync(bestand) || statSync(bestand).isDirectory()) bestand = join(root, 'index.html')
  const html = extname(bestand) === '.html'
  res.writeHead(200, {
    'Content-Type': TYPES[extname(bestand)] ?? 'application/octet-stream',
    // De policy uit firebase.json, afgedwongen: zie scripts/lib/csp.mjs.
    ...(html ? { 'Content-Security-Policy': CSP } : {}),
  })
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
  const page = await nieuwePagina(browser, { viewport: { width: breedte, height: hoogte } })
  const fouten = []
  page.on('pageerror', (e) => fouten.push(String(e).split('\n')[0]))
  page.on('console', (m) => {
    const tekst = m.text()
    // Het zelfondertekende certificaat van de testserver is niet ons probleem.
    if (m.type() === 'error' && !tekst.includes('ERR_CERT')) fouten.push(tekst.slice(0, 200))
  })
  await page.goto(`${adres}/#${pad}`, { waitUntil: 'networkidle' })
  await rustig(page)
  page.fouten = fouten
  return page
}

const inhoud = async (page) => (await page.locator('body').innerText()).trim()

// De fiche van een event bestaat uit invoervelden; die dragen hun waarde niet
// in de tekst van de pagina. Wat erin staat, lees je dus uit het veld zelf.
const veld = (page, naam) => page.locator('.je-fiche').getByLabel(naam).first()
const veldwaarde = (page, naam) => veld(page, naam).inputValue()

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
  ['Aanvragen', '/aanvragen', 'Aanvragen'],
  ['Openen & sluiten', '/openen-sluiten', 'Openen'],
  ['Registraties', '/registraties', 'Registraties'],
  ['Teamoverleg', '/overleg', 'Teamoverleg'],
  ['Uren', '/uren', 'Uren'],
  ['Rooster', '/rooster', 'Rooster'],
  ['Logboek', '/logboek', 'Logboek'],
  ['Goals', '/goals', 'Goals'],
  ['Instellingen', '/instellingen', 'Instellingen'],
  ['Instellingen — formules', '/instellingen?tab=formules', 'Winter BBQ'],
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

  // Vrijgeven in een `finally`; zie de volgende test voor waarom.
  try {
    await page.getByLabel('Hoofdnavigatie').getByRole('link', { name: /^Tasks/ }).first().click()
    await page.getByRole('link', { name: 'Goals', exact: true }).first().click()
    await rustig(page)

    const tekst = await inhoud(page)
    zouden(tekst.length > 40, 'het scherm is wit geworden')
    zouden(tekst.includes('opnieuw laden'), `geen uitleg, wel: ${tekst.slice(0, 80)}`)
    zouden(tekst.includes('Tasks'), 'de zijbalk is verdwenen; je kunt nergens heen')
  } finally {
    verdwenen.delete('/assets/Goals-')
  }
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

  /*
    De brok weer vrijgeven hoort in een `finally`.

    Zonder dat bleef ze geblokkeerd zodra een assertie hieronder omviel, en
    dan faalden alle tests erna op een pagina die in werkelijkheid niets
    mankeert. Eén echte fout werd zo drie meldingen, en de tweede en derde
    wezen de verkeerde kant op.
  */
  try {
    await page.getByLabel('Hoofdnavigatie').getByRole('link', { name: /^Team/ }).first().click()
    await page.getByRole('link', { name: 'Uren' }).first().click()
    await rustig(page)
    zouden((await inhoud(page)).includes('opnieuw laden'), 'geen uitleg na de fout')

    // En je kunt gewoon verder: een andere pagina hoort de melding weg te halen.
    await page.getByRole('link', { name: /^Tasks/ }).first().click()
    await rustig(page)
    const tekst = await inhoud(page)
    zouden(!tekst.includes('opnieuw laden'), 'de foutmelding bleef staan na het wegklikken')
    /*
      Op het meubilair van de pagina en niet op haar inhoud.

      Hier stond "Te laat of Vandaag". Dat zijn deadlinegroepen, en in welke
      groep een demotaak valt hangt af van de echte datum van vandaag tegenover
      de vaste datum waarop de demo geseed is. Die test viel dus vanzelf om op
      een ochtend waarop niemand iets veranderd had — precies het soort rode
      test waar je naar leert kijken zonder te kijken.
    */
    zouden(bevat(tekst, 'Nieuwe taak'), 'Tasks opende niet')
    zouden(bevat(tekst, 'Mijn taken'), 'Tasks opende niet volledig')
  } finally {
    verdwenen.delete('/assets/TimeTracking-')
  }
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

await test('Events heeft geen tweede niveau in de navigatie', async () => {
  /*
    Er stonden vier regels onder Events. Bord en Kalender waren de tabs van de
    pagina zelf — twee bedieningen voor dezelfde keuze lopen uit elkaar. Klanten
    is een eigen pagina en staat nu op het eerste niveau. En het postvak hangt
    aan een envelopje rechtsboven op de eventpagina, want het is er meestal leeg.
  */
  const page = await tabblad('/')
  const zijbalk = await page.getByLabel('Hoofdnavigatie').innerText()
  for (const weg of ['Bord', 'Archief', 'Aanvragen']) {
    zouden(!bevat(zijbalk, weg), `"${weg}" staat nog in het menu: ${zijbalk}`)
  }
  // Klanten staat op het eerste niveau: je komt er even vaak vanuit een offerte
  // als vanuit een event.
  zouden(bevat(zijbalk, 'Klanten'), `Klanten is uit het menu verdwenen: ${zijbalk}`)

  // De tabs doen het werk nog wel, en /kalender blijft een geldig adres.
  await page.getByRole('tab', { name: 'Kalender' }).click()
  await rustig(page)
  zouden(page.fouten.length === 0, `fouten: ${page.fouten[0]}`)
  await page.close()
})

await test('de kalender en de posts blijven bestaan naast het eventbord', async () => {
  const page = await tabblad('/social')
  await page.getByRole('tab', { name: 'Kalender' }).click()
  await rustig(page)
  zouden((await inhoud(page)).includes('posts in'), 'de kalender opent niet')
  await page.getByRole('tab', { name: 'Posts', exact: true }).click()
  await rustig(page)
  zouden(bevat(await inhoud(page), 'Goedgekeurd'), 'het postenbord opent niet')
  await page.close()
})

await test('de weekweergave toont per kanaal wat er die week uitgaat', async () => {
  const page = await tabblad('/social')
  await page.getByRole('tab', { name: 'Week' }).click()
  await rustig(page)
  const tekst = await inhoud(page)

  zouden(bevat(tekst, 'week '), 'het weeknummer ontbreekt boven de week')
  // Rijen per kanaal, en alleen de kanalen waar deze week iets op staat.
  for (const kanaal of ['Instagram', 'Facebook', 'LinkedIn', 'TikTok']) {
    zouden(bevat(tekst, kanaal), `de rij "${kanaal}" ontbreekt`)
  }
  // Een aankondiging gaat weken vóór het event online en hoort dus in déze
  // week te staan, niet in de week van het feest.
  zouden(bevat(tekst, 'Blum 20 jaar'), 'de aankondiging staat niet in de week')
  // Een post die pas over anderhalve week uitgaat, hoort er niet bij.
  zouden(!bevat(tekst, 'Vacature zaalmedewerker'), 'een post van een andere week staat er toch')
  // En een post die er al stond vóór er een publicatiedatum bestond, valt
  // terug op zijn eventdatum in plaats van uit de kalender te verdwijnen.
  zouden(bevat(tekst, 'Wijnproeverij'), 'een post zonder publicatiedatum verdween')
  zouden(page.fouten.length === 0, `fouten: ${page.fouten[0]}`)
  await page.close()
})

await test('een post toont zijn kanaal, zijn publicatiedatum en een preview', async () => {
  const page = await tabblad('/social')
  await page.getByRole('tab', { name: 'Week' }).click()
  await rustig(page)
  await page.getByRole('button', { name: /Blum 20 jaar/ }).first().click()
  await rustig(page)

  const paneel = page.getByRole('dialog')
  // Het feest van Blum is pas over een maand; de aankondiging gaat morgen uit.
  const datum = await paneel.getByLabel('Publiceren op').inputValue()
  zouden(datum.startsWith('2026-09-29'), `verkeerde publicatiedatum: ${datum}`)

  const tekst = await paneel.innerText()
  zouden(bevat(tekst, 'LinkedIn') && bevat(tekst, 'Facebook'), 'de kanalen staan niet op de post')
  zouden(bevat(tekst, 'Preview'), 'de preview ontbreekt')
  zouden(bevat(tekst, '#blum'), 'de hashtags staan niet in de preview')
  zouden(bevat(tekst, 'Gaat online op'), 'de preview zegt niet wanneer de post uitgaat')
  zouden(page.fouten.length === 0, `fouten: ${page.fouten[0]}`)
  await page.close()
})

await test('een klant toont zijn gegevens, events en documenten', async () => {
  const page = await tabblad('/klanten')
  const tekst = await inhoud(page)
  zouden(tekst.includes('Blum België'), 'de klanten staan er niet')

  await page.getByText('Blum België').first().click()
  await rustig(page)
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
  await rustig(page)
  const paneel = await page.getByRole('dialog').innerText()

  zouden(bevat(paneel, 'Historiek (4 events)'), `de historiek klopt niet: ${paneel.slice(0, 200)}`)
  for (const dossier of ['20-jarig bestaan', 'kerstborrel 2025', 'teambuilding productie', 'kick-off 2025']) {
    zouden(bevat(paneel, dossier), `"${dossier}" ontbreekt in de historiek`)
  }
  // 24.800 + 6.800 + 4.150 + 8.600. De subtaken tellen niet mee, en een
  // gearchiveerd event telt wél: de historiek van een klant gaat over wat er
  // geweest is, niet over wat er nog op het bord staat.
  zouden(bevat(paneel, '44.350'), `het totaal ontbreekt: ${paneel.slice(0, 300)}`)
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

  // Geen potlood en geen venster meer: de fiche is het formulier.
  await page.getByLabel('Klant van dit event').selectOption({ label: 'Stad Borgloon' })
  await rustig(page)
  zouden(bevat(await inhoud(page), 'Stad Borgloon'), 'de klant staat niet op de fiche van het event')

  // En dan het punt van de hele koppeling: het dossier hoort meteen bij de klant.
  await page.goto(`${adres}/#/klanten`, { waitUntil: 'networkidle' })
  await rustig(page)
  await page.getByText('Stad Borgloon').first().click()
  await rustig(page)
  const paneel = await page.getByRole('dialog').innerText()
  zouden(bevat(paneel, 'Ruben Theuwen'), `het event staat niet in de historiek: ${paneel.slice(0, 250)}`)
  zouden(page.fouten.length === 0, `fouten: ${page.fouten[0]}`)
  await page.close()
})

await test('een klant die nog niet bestaat maak je aan vanaf het event', async () => {
  // De reden dat de klantenlijst leeg bleef: wie eerst naar Klanten moest,
  // typte in de praktijk gewoon een naam in het vrije veld.
  const page = await tabblad('/events/t-jolien')

  await page.getByLabel('Klant van dit event').selectOption('__nieuw')
  await rustig(page)
  await page.getByLabel('Naam van de klant').fill('Jolien en Bernd')
  await page.getByLabel('Btw-nummer').fill('0400378485')
  await page.getByRole('button', { name: 'Klant aanmaken' }).click()
  await rustig(page)

  const gekozen = await page.getByLabel('Klant van dit event').evaluate((el) => el.selectedOptions[0].text)
  zouden(gekozen === 'Jolien en Bernd', `de nieuwe klant staat niet gekozen: ${gekozen}`)

  await page.goto(`${adres}/#/klanten`, { waitUntil: 'networkidle' })
  await rustig(page)
  await page.getByText('Jolien en Bernd').first().click()
  await rustig(page)
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
  await rustig(page)
  const paneel = page.getByRole('dialog')
  const tekst = await paneel.innerText()
  zouden(bevat(tekst, 'Social content'), 'de social-sectie ontbreekt')
  zouden(bevat(tekst, 'Bijlagen bij dit event'), 'de bijlagen ontbreken')

  const klant = await paneel.getByLabel('Klant van dit event').inputValue()
  zouden(klant === 'k-blum', `de klant staat niet gekozen: ${klant}`)
  await page.close()
})

await test('een taak opent in het zijpaneel', async () => {
  const page = await tabblad('/bord/l-overview')
  // In de bovenbalk staat dezelfde titel op de lopende timer; het gaat om de kaart.
  await page.locator('main').getByText('Trouw Niels en Inez').first().click()
  await rustig(page)
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
  await rustig(page)
  const na = await vakjes.evaluateAll((els) => els.filter((e) => e.checked).length)
  zouden(na === voor + 1, `${voor} → ${na} afgevinkt`)
  await page.close()
})

await test('een agendapunt toevoegen komt op de agenda', async () => {
  const page = await tabblad('/overleg')
  await page.getByLabel('Onderwerp').fill('Punt uit de browsertest')
  await page.getByLabel('Omschrijving').fill('Toegevoegd door scripts/smoke.mjs.')
  await page.getByRole('button', { name: 'Op de agenda' }).click()
  await rustig(page)
  zouden((await inhoud(page)).includes('Punt uit de browsertest'), 'het punt staat er niet')
  await page.close()
})

await test('een besproken agendapunt wordt in één handeling een taak', async () => {
  // Wat op een overleg afgesproken wordt, gebeurt pas wanneer het ergens staat
  // met een naam en een datum erbij. Eerder eindigde een punt bij "Besproken".
  const page = await tabblad('/overleg')
  await page.getByRole('button', { name: 'Besproken' }).first().click()
  await rustig(page)

  const dialoog = page.getByRole('dialog')
  zouden(bevat(await dialoog.innerText(), 'een taak maken'), 'de afrondingsdialoog opent niet')

  // De titel van het punt en een deadline staan al ingevuld: wie niets
  // verandert, heeft in één klik een taak met een naam en een datum.
  const titel = dialoog.getByLabel('Wat moet er gebeuren?')
  zouden(
    (await titel.inputValue()).includes('Prijzen verhuurmateriaal'),
    `de titel van het punt staat niet voorgevuld: ${await titel.inputValue()}`
  )
  const deadline = dialoog.getByLabel('Deadline van de taak')
  zouden(/^\d{4}-\d{2}-\d{2}$/.test(await deadline.inputValue()), 'er staat geen deadline voorgesteld')

  await titel.fill('Tarieven verhuurmateriaal +8% vanaf november')
  await dialoog.getByLabel('Wie doet het?').selectOption({ label: 'Jasper Hansen' })
  await deadline.fill('2026-10-09')
  await dialoog.getByRole('button', { name: 'Taak aanmaken' }).click()
  await rustig(page)

  // Het punt is van de agenda af, en bij het besprokene staat dat er werk uit
  // kwam — anders is "besproken" niet te onderscheiden van "besproken en vergeten".
  const na = await inhoud(page)
  zouden(!bevat(na, 'Prijzen verhuurmateriaal herzien'), 'het punt staat nog op de open agenda')
  await page.getByRole('button', { name: /Al besproken/ }).click()
  await rustig(page)
  const besproken = await inhoud(page)
  zouden(bevat(besproken, 'Prijzen verhuurmateriaal'), 'het punt staat niet bij het besprokene')
  zouden(bevat(besproken, 'taak aangemaakt'), 'er staat niet bij dat er een taak uit kwam')

  // En de taak staat echt op het takenbord. Klikken en niet herladen: de
  // demodatabase leeft in het tabblad, dus een herlaadbeurt zou alleen bewijzen
  // dat de voorbeeldgegevens er nog staan.
  await page.getByLabel('Hoofdnavigatie').getByRole('link', { name: /^Tasks/ }).first().click()
  await rustig(page)
  const bord = await inhoud(page)
  zouden(bevat(bord, 'Tarieven verhuurmateriaal +8%'), `de taak staat niet op het bord: ${bord.slice(0, 250)}`)
  zouden(page.fouten.length === 0, `fouten: ${page.fouten[0]}`)
  await page.close()
})

await test('de verslagen zijn doorzoekbaar, tot in de actiepunten', async () => {
  const page = await tabblad('/overleg')
  await page.getByRole('tab', { name: 'Verslagen' }).click()
  await rustig(page)
  const alles = await inhoud(page)
  zouden(bevat(alles, 'Weekstart events'), 'de verslagen staan er niet')
  zouden(bevat(alles, 'Maandoverleg bistro'), 'het tweede verslag staat er niet')

  const veld = page.getByLabel('Zoek in de verslagen')
  await veld.fill('winterkaart')
  await rustig(page)
  const een = await inhoud(page)
  zouden(bevat(een, 'Maandoverleg bistro'), 'het verslag met dat woord is weggefilterd')
  zouden(!bevat(een, 'Weekstart events'), 'er wordt niet gefilterd')

  // En het woord dat alleen in een actiepunt staat, vindt zijn verslag terug.
  await veld.fill('doorsturen')
  await rustig(page)
  const via = await inhoud(page)
  zouden(bevat(via, 'Weekstart events'), 'een woord uit een actiepunt vindt zijn verslag niet')
  zouden(bevat(via, 'actiepunt'), 'er staat niet bij waarom dit verslag gevonden werd')

  await veld.fill('kerstmarkt borgloon')
  await rustig(page)
  zouden(bevat(await inhoud(page), 'Niets gevonden'), 'een zoekterm zonder treffers zegt niets')
  zouden(page.fouten.length === 0, `fouten: ${page.fouten[0]}`)
  await page.close()
})

await test('het verloop van een doel is uit te klappen', async () => {
  const page = await tabblad('/goals')
  await page.getByRole('button', { name: 'Verloop' }).first().click()
  await rustig(page)
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
  await rustig(page)
  const tekst = await inhoud(page)
  zouden(bevat(tekst, 'Openen'), 'de lijst van gisteren staat er niet')
  zouden(bevat(tekst, 'Lotte'), `wie afvinkte staat er niet: ${tekst.slice(0, 200)}`)
  zouden(page.fouten.length === 0, `fouten: ${page.fouten[0]}`)
  await page.close()
})

await test('een punt toevoegen aan een dagelijkse lijst werkt', async () => {
  const page = await tabblad('/instellingen')
  await page.getByRole('tab', { name: 'Dagelijkse lijsten' }).click()
  await rustig(page)
  // De titels staan in invoervelden, dus niet in de tekst van de pagina.
  const groepen = await page
    .locator('input[aria-label="Naam van de groep"]')
    .evaluateAll((els) => els.map((e) => e.value))
  zouden(groepen.some((g) => g.includes('Aankomst')), `groepen: ${groepen.join(', ')}`)

  await page.getByRole('button', { name: '+ Punt' }).first().click()
  await rustig(page)
  const veld = page.getByPlaceholder('Wat moet er gebeuren?').first()
  await veld.fill('Terrasverwarmer nakijken')
  await veld.blur()
  await rustig(page)
  await page.getByLabel('Wie ziet dit punt').first().selectOption('zaal')
  await rustig(page)

  // En het komt ook echt op de lijst van vandaag terecht.
  await page.getByLabel('Hoofdnavigatie').getByRole('link', { name: /^Checklists/ }).first().click()
  await page.getByRole('link', { name: 'Openen & sluiten' }).first().click()
  await rustig(page)
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
    'Checklists vandaag',
    'Socials deze week',
  ]) {
    zouden(bevat(tekst, naald), `"${naald}" staat niet op het dashboard`)
  }
  // Elk cijfer is een link naar de plek waar je het oplost.
  await page.getByRole('link', { name: /Te factureren/ }).first().click()
  await rustig(page)
  zouden(bevat(await inhoud(page), 'Events'), 'het cijfer bracht je nergens')
  zouden(page.fouten.length === 0, `fouten: ${page.fouten[0]}`)
  await page.close()
})

await test('het bord van een lijst zit in de Tasks-pagina', async () => {
  // Het oude adres blijft werken en brengt je naar de plek waar dat bord woont.
  const page = await tabblad('/bord/l-overleg')
  await rustig(page)
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
  await rustig(page)

  const dialoog = page.getByRole('dialog')
  const tekst = await dialoog.innerText()
  zouden(bevat(tekst, 'Kolommen van'), `de kolomeditor opende niet: ${tekst.slice(0, 80)}`)
  zouden(bevat(tekst, 'taken'), 'de aantallen per kolom ontbreken')

  // Een kolom weghalen vraagt eerst waar de taken heen moeten.
  const rijen = dialoog.locator('ul > li')
  await rijen.first().getByRole('button', { name: /verwijderen/i }).click()
  await rustig(page)
  const na = await dialoog.innerText()
  zouden(bevat(na, 'Kolommen die verdwijnen'), 'er wordt niet gevraagd waar de taken heen gaan')
  zouden(await dialoog.getByRole('button', { name: 'Opslaan' }).isDisabled(), 'opslaan kan zonder bestemming')

  await dialoog.getByRole('button', { name: 'Toch houden' }).click()
  await rustig(page)
  zouden(!(await dialoog.getByRole('button', { name: 'Opslaan' }).isDisabled()), 'opslaan blijft geblokkeerd')
  zouden(page.fouten.length === 0, `fouten: ${page.fouten[0]}`)
  await page.close()
})

await test('de business rules staan in de instellingen', async () => {
  const page = await tabblad('/instellingen')
  await page.getByRole('tab', { name: 'Business rules' }).click()
  await rustig(page)
  const tekst = await inhoud(page)
  // De eerste twee regels staan nog in de oude, enkelvoudige vorm in de
  // database. Ze horen gewoon gelezen en uitgelegd te worden.
  zouden(tekst.includes('ready to invoice'), 'de facturatieregel ontbreekt')
  zouden(bevat(tekst, 'wordt de enige'), 'de regel wordt niet uitgelegd')
  // En de nieuwe vormen ernaast.
  zouden(bevat(tekst, 'Wie maakt de offerte'), 'de beslissingstabel ontbreekt')
  zouden(bevat(tekst, '3 rijen'), 'de tabel wordt niet uitgelegd')
  zouden(bevat(tekst, 'groot huwelijk'), 'het logboek zegt niet welke rij vuurde')
  zouden(page.fouten.length === 0, `fouten: ${page.fouten[0]}`)
  await page.close()
})

await test('een samengestelde regel is in het scherm op te bouwen', async () => {
  // Niet alleen op taken: deze gaat over klanten, met twee voorwaarden die met
  // OF aan elkaar hangen. Dat was voordien geen van beide mogelijk.
  const page = await tabblad('/instellingen')
  await page.getByRole('tab', { name: 'Business rules' }).click()
  await rustig(page)

  const voor = await page.locator('li.card').count()
  await page.getByRole('button', { name: 'Nieuwe regel' }).click()
  const form = page.locator('form').filter({ hasText: 'Nieuwe regel' })
  await form.getByLabel('Naam van de regel', { exact: true }).fill('Borgloon is voor JE Concept')
  await form.getByLabel('Waarover gaat de regel', { exact: true }).selectOption('customer')
  await rustig(page)

  await form.getByLabel('Voorwaarden combineren', { exact: true }).selectOption('any')
  await form.getByRole('button', { name: 'Voorwaarde erbij' }).click()
  await form.getByRole('button', { name: 'Voorwaarde erbij' }).click()
  await rustig(page)

  await form.getByLabel('Veld', { exact: true }).nth(0).selectOption('address.city')
  await form.getByLabel('Vergelijking', { exact: true }).nth(0).selectOption('is')
  await form.getByLabel('Waarde', { exact: true }).nth(0).fill('Borgloon')

  await form.getByLabel('Veld', { exact: true }).nth(1).selectOption('name')
  await form.getByLabel('Vergelijking', { exact: true }).nth(1).selectOption('contains')
  await form.getByLabel('Waarde', { exact: true }).nth(1).fill('Stad')
  await rustig(page)

  await form.getByLabel('Actie toevoegen', { exact: true }).selectOption('brand')
  await rustig(page)
  await form.getByLabel('Merk toewijzen', { exact: true }).selectOption('je-concept')
  await rustig(page)

  const uitleg = await form.locator('.je-regel-uitleg').innerText()
  zouden(bevat(uitleg, ' of '), `de twee voorwaarden staan niet met OF in de zin: ${uitleg}`)
  zouden(bevat(uitleg, 'Gemeente'), `de eerste voorwaarde staat niet in de zin: ${uitleg}`)

  const knop = form.getByRole('button', { name: 'Regel aanzetten' })
  const klachten = await form.locator('.text-amber-700').allInnerTexts()
  zouden(!(await knop.isDisabled()), `de regel is niet te bewaren: ${klachten.join(' / ')}`)
  await knop.click()
  await rustig(page)

  // De naam staat in een invoerveld en telt dus niet mee in `innerText`; wat je
  // wél moet zien is de regel in gewone taal, onderaan de lijst.
  zouden(
    (await page.locator('li.card').count()) === voor + 1,
    'de nieuwe regel staat niet in de lijst'
  )
  const na = await inhoud(page)
  zouden(bevat(na, 'Gemeente is'), `de voorwaarde staat niet in de lijst: ${na.slice(-400)}`)
  zouden(page.fouten.length === 0, `fouten: ${page.fouten[0]}`)
  await page.close()
})

await test('een beslissingstabel is in het scherm op te bouwen', async () => {
  const page = await tabblad('/instellingen')
  await page.getByRole('tab', { name: 'Business rules' }).click()
  await rustig(page)

  const voor = await page.locator('li.card').count()
  await page.getByRole('button', { name: 'Nieuwe beslissingstabel' }).click()
  const form = page.locator('form').filter({ hasText: 'Nieuwe beslissingstabel' })
  await form.getByLabel('Naam van de regel', { exact: true }).fill('Prioriteit per status')
  await rustig(page)

  // Eén kolom, twee rijen — dat is wat een verse tabel meebrengt.
  const kolommen = await form.locator('thead th').count()
  zouden(kolommen >= 3, `de tabel heeft geen kop: ${kolommen} kolommen`)

  await form.getByLabel('Kolom 1 — veld', { exact: true }).selectOption('statusName')
  await form.getByLabel('Kolom 1 — vergelijking', { exact: true }).selectOption('is')
  await rustig(page)

  await form.getByLabel('Naam van rij 1', { exact: true }).fill('facturatie')
  await form.getByLabel(/^Rij 1, Status$/).selectOption('ready to invoice')
  await form.getByLabel('Actie toevoegen', { exact: true }).nth(0).selectOption('priority')
  await rustig(page)
  await form.getByLabel('Prioriteit zetten', { exact: true }).nth(0).selectOption('1')

  // Rij 2 laat de cel leeg: dat is "maakt niet uit", het vangnet onderaan.
  await form.getByLabel('Naam van rij 2', { exact: true }).fill('de rest')
  await form.getByLabel('Actie toevoegen', { exact: true }).nth(1).selectOption('priority')
  await rustig(page)
  await form.getByLabel('Prioriteit zetten', { exact: true }).nth(1).selectOption('3')
  await rustig(page)

  const uitleg = await form.locator('.je-regel-uitleg').innerText()
  zouden(bevat(uitleg, '2 rijen'), `de tabel wordt niet uitgelegd: ${uitleg}`)

  const knop = form.getByRole('button', { name: 'Regel aanzetten' })
  const klachten = await form.locator('.text-amber-700').allInnerTexts()
  zouden(!(await knop.isDisabled()), `de tabel is niet te bewaren: ${klachten.join(' / ')}`)
  await knop.click()
  await rustig(page)

  zouden(
    (await page.locator('li.card').count()) === voor + 1,
    'de nieuwe tabel staat niet in de lijst'
  )
  const na = await inhoud(page)
  zouden(bevat(na, '2 rijen'), `de tabel wordt niet uitgelegd in de lijst: ${na.slice(-400)}`)
  zouden(page.fouten.length === 0, `fouten: ${page.fouten[0]}`)
  await page.close()
})

await test('Tasks en Uren hebben een kalender', async () => {
  const werk = await tabblad('/tasks')
  await werk.getByRole('tab', { name: 'Kalender' }).click()
  await rustig(werk)
  const wt = await inhoud(werk)
  zouden(bevat(wt, 'ma'), 'geen weekdagen in de kalender')
  zouden(bevat(wt, 'met datum'), 'geen telling van taken met datum')
  zouden(werk.fouten.length === 0, `fouten: ${werk.fouten[0]}`)
  await werk.close()

  const uren = await tabblad('/uren')
  await uren.getByRole('tab', { name: 'Kalender' }).click()
  await rustig(uren)
  zouden(bevat(await inhoud(uren), 'deze maand'), 'geen maandtotaal op de urenkalender')
  zouden(uren.fouten.length === 0, `fouten: ${uren.fouten[0]}`)
  await uren.close()
})

await test('een event dat klaar is om te factureren staat niet te laat', async () => {
  // Het feest is geweest, alleen de factuur loopt nog. Eerder stond hier
  // "31 dagen te laat" in het rood, en dat maakt de kleur waardeloos.
  const page = await tabblad('/tasks?weergave=lijst&groep=deadline&wie=iedereen')
  await rustig(page)
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
  await rustig(page)
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

/*
  U16. De demo is op maandag dicht en meet vorige maand niets. Vorige maand dus:
  die heeft altijd maandagen achter zich, wat de lopende maand op de 1e niet
  heeft. Een sluitingsdag hoort er als "Gesloten" te staan, en een maand zonder
  één meting mag niet "alles binnen de grens" heten.
*/
await test('sluitingsdagen zijn in te stellen, en een punt op een sluitingsdag valt op', async () => {
  const page = await tabblad('/instellingen')
  await page.getByRole('tab', { name: 'Dagelijkse lijsten' }).click()
  await rustig(page)
  zouden(bevat(await inhoud(page), 'Sluitingsdagen'), 'de sluitingsdagen staan niet bij de dagelijkse lijsten')
  // De demo is op maandag dicht en de friteuse staat op maandag: dat punt telt
  // nooit meer mee, en dat moet hier gezegd worden.
  zouden(bevat(await inhoud(page), 'Friteuse volledig gereinigd'), 'een punt op een sluitingsdag valt niet op')

  await page.getByLabel('Van', { exact: true }).fill('2026-11-11')
  await page.getByLabel('Reden').fill('Wapenstilstand')
  await page.getByRole('button', { name: 'Toevoegen' }).click()
  await rustig(page)
  zouden(bevat(await inhoud(page), 'Wapenstilstand'), 'een losse sluitingsdag komt niet in de lijst')
  zouden(page.fouten.length === 0, `fouten: ${page.fouten[0]}`)
  await page.close()
})

await test('het verslag kent sluitingsdagen en zegt het als er niets gemeten is', async () => {
  const page = await tabblad('/registraties')
  await rustig(page)
  await page.getByRole('button', { name: 'Vorige maand' }).click()
  await rustig(page)
  const tekst = await inhoud(page)
  zouden(bevat(tekst, 'Gesloten'), 'een maandag staat niet als gesloten in het verslag')
  zouden(bevat(tekst, 'dagen gesloten'), 'het vak met de volledige dagen noemt de gesloten dagen niet')
  zouden(bevat(tekst, 'geen metingen'), 'een maand zonder metingen zegt niet "geen metingen"')
  zouden(!bevat(tekst, 'alles binnen de grens'), 'een maand zonder metingen heet "alles binnen de grens"')
  zouden(page.fouten.length === 0, `fouten: ${page.fouten[0]}`)
  await page.close()
})

await test('een te warme koelkast wordt meteen aangegeven', async () => {
  const page = await tabblad('/openen-sluiten')
  await page.getByRole('tab', { name: 'FAVV-registraties' }).click()
  await rustig(page)

  const veld = page.getByLabel(/Gemeten voor Temperatuur koelkasten/)
  zouden((await veld.count()) === 1, 'het meetveld bij de koelkasten ontbreekt')
  zouden(bevat(await inhoud(page), 'max 7'), 'de grens staat er niet bij')

  await veld.fill('9')
  await veld.blur()
  await rustig(page)
  zouden(bevat(await inhoud(page), 'Boven de grens'), 'een te warme koelkast geeft geen waarschuwing')

  // Binnen de grens hoort er niets te staan — anders leert men de melding negeren.
  await veld.fill('4')
  await veld.blur()
  await rustig(page)
  zouden(!bevat(await inhoud(page), 'Boven de grens'), 'de waarschuwing blijft staan bij een goede meting')
  zouden(page.fouten.length === 0, `fouten: ${page.fouten[0]}`)
  await page.close()
})

await test('een punt kan om een datum vragen, en die blijft staan', async () => {
  const page = await tabblad('/openen-sluiten')
  await page.getByRole('tab', { name: 'FAVV-registraties' }).click()
  await rustig(page)

  const veld = page.getByLabel(/Laatst vervangen op voor Frituurolie/)
  zouden((await veld.count()) === 1, 'het datumveld bij de frituurolie ontbreekt')
  await veld.fill('2026-09-27')
  await veld.blur()
  await rustig(page)
  zouden(bevat(await inhoud(page), 'ingevuld door'), 'de ingevulde waarde wordt niet bewaard')
  await page.close()
})

await test('een onderwerp op de socialkalender komt bij Charish', async () => {
  const page = await tabblad('/social')
  await page.getByRole('tab', { name: 'Kalender' }).click()
  await rustig(page)

  const veld = page.getByLabel('Onderwerp toevoegen')
  await veld.fill('Kerstmenu aankondigen')
  zouden(bevat(await inhoud(page), 'Charish'), 'er staat niet bij wie het krijgt')
  await veld.press('Enter')
  await rustig(page)
  zouden(bevat(await inhoud(page), 'Kerstmenu aankondigen'), 'het onderwerp staat niet in de lijst')
  await page.close()
})

await test('het rooster toont de week en waarschuwt bij dubbel inplannen', async () => {
  const page = await tabblad('/rooster')
  await rustig(page)
  const tekst = await inhoud(page)

  for (const naald of ['Rooster', 'Lotte', 'Sam', 'Per dag']) {
    zouden(bevat(tekst, naald), `"${naald}" staat niet op het rooster`)
  }
  // De avondbar loopt tot drie uur; dat is hier de regel, geen uitzondering.
  zouden(bevat(tekst, '18:00'), 'de avonddienst staat er niet')
  // Twee keer tegelijk ingepland merk je anders pas op de dag zelf.
  zouden(bevat(tekst, 'tegelijk ingepland'), 'de botsing wordt niet gemeld')

  // Een dienst openen om hem aan te passen.
  await page.getByRole('button', { name: /18:00/ }).first().click()
  await rustig(page)
  zouden(bevat(await inhoud(page), 'Dienst aanpassen'), 'de dienst opent niet')
  zouden(page.fouten.length === 0, `fouten: ${page.fouten[0]}`)
  await page.close()
})

await test('werk dat niemand opgepakt heeft is voor iedereen zichtbaar', async () => {
  // Zo'n taak hoort bij niemand, dus vond hij niemand: hij stond in geen enkele
  // persoonlijke lijst en bleef daardoor liggen.
  const page = await tabblad('/tasks?weergave=lijst&groep=deadline&wie=ik')
  await rustig(page)
  const tekst = await inhoud(page)
  zouden(bevat(tekst, 'Parkeerplan doorgeven'), `de niet-toegewezen taak ontbreekt: ${tekst.slice(0, 200)}`)

  // En het moet te zien zijn dát hij niet van jou is, anders lees je hem als
  // jouw werk en wacht iedereen op een ander.
  const regel = await page.locator('li', { hasText: 'Parkeerplan doorgeven' }).first().innerText()
  zouden(bevat(regel, 'niemand'), `niet gemarkeerd: ${regel}`)

  // Op het dashboard staat het aantal, met een weg ernaartoe.
  const dash = await tabblad('/dashboard')
  await rustig(dash)
  zouden(bevat(await inhoud(dash), 'Niemand toegewezen'), 'het dashboard zwijgt erover')
  zouden(page.fouten.length === 0, `fouten: ${page.fouten[0]}`)
  await dash.close()
  await page.close()
})

await test('los socialwerk kan zonder event, en er is tijd op te boeken', async () => {
  const page = await tabblad('/social')
  await page.getByRole('tab', { name: 'Events' }).click()
  await rustig(page)

  // Werk dat niet uit een event komt, moest tot nu toe aan een event gehangen
  // worden dat er niet was.
  const veld = page.getByLabel('Nieuwe socialtaak')
  zouden((await veld.count()) === 1, 'je kunt geen losse socialtaak toevoegen')
  await veld.fill('Reel over de nieuwe winterkaart')
  await page.getByRole('button', { name: 'Toevoegen' }).first().click()
  await rustig(page)
  zouden(
    bevat(await inhoud(page), 'Reel over de nieuwe winterkaart'),
    'de losse taak staat niet op het socialbord'
  )

  // En op de kalender staat een timer, want daar werkt wie de content maakt.
  await page.getByRole('tab', { name: 'Kalender' }).click()
  await rustig(page)
  // Op de kaart zelf klikken: de tekst erin zit in een vakje dat nog schuift.
  await page.getByRole('button', { name: /Bar Vue cocktailweek/ }).first().click()
  await rustig(page)
  const paneel = await page.getByRole('dialog').innerText()
  zouden(bevat(paneel, 'Tijd'), `geen tijdblok op de post: ${paneel.slice(0, 200)}`)
  zouden(page.fouten.length === 0, `fouten: ${page.fouten[0]}`)
  await page.close()
})

await test('een subtaak opent zijn eigen fiche', async () => {
  const page = await tabblad('/bord/l-overview')
  await page.locator('main').getByText('Trouw Niels en Inez').first().click()
  await rustig(page)
  await page.getByRole('button', { name: 'Offerte afwerken en versturen' }).click()
  await rustig(page)
  const panelen = await page.getByRole('dialog').count()
  zouden(panelen === 2, `verwacht twee panelen, kreeg er ${panelen}`)
  const laatste = await page.getByRole('dialog').last().innerText()
  zouden(bevat(laatste, 'Deadline'), 'de subtaak heeft geen eigen deadline-veld')
  zouden(bevat(laatste, 'Toegewezen aan'), 'de subtaak heeft geen eigen toewijzing')
  await page.close()
})

// ─── Het takenpaneel, de lijsteditor en de zoekbalk ─────────────────────────

/** Opent het zijpaneel van een event op het bord. */
async function opentTaak(page, titel) {
  await page.locator('main').getByText(titel).first().click()
  await rustig(page)
  return page.getByRole('dialog').last()
}

await test('de titel van een taak staat maar één keer in het paneel', async () => {
  const page = await tabblad('/bord/l-overview')
  const titel = 'Trouw Niels en Inez'
  const paneel = await opentTaak(page, titel)

  // De kop toonde dezelfde titel als het invoerveld eronder, en alleen dat
  // veld was te wijzigen. Tel zowel de tekst als de invoervelden.
  const keer = await paneel.evaluate(
    (el, gezocht) =>
      [...el.querySelectorAll('input')].filter((i) => i.value === gezocht).length +
      el.innerText.split('\n').filter((r) => r.trim() === gezocht).length,
    titel
  )
  zouden(keer === 1, `de titel staat ${keer} keer in het paneel`)

  // En de kop zegt nu wat het veld niet zegt: waar dit staat.
  const kop = await paneel.locator('.je-drawer__head').innerText()
  zouden(bevat(kop, 'Events'), `de kop noemt het bord niet: ${kop.replace(/\n/g, ' ')}`)
  zouden(bevat(kop, 'create offer'), `de kop noemt de kolom niet: ${kop.replace(/\n/g, ' ')}`)
  zouden(page.fouten.length === 0, `fouten: ${page.fouten[0]}`)
  await page.close()
})

await test('een overgenomen taak zegt dat haar datum van de verhuizing komt', async () => {
  const page = await tabblad('/bord/l-overview')

  const uitClickup = await opentTaak(page, 'Blum België — 20-jarig bestaan')
  const voet = await uitClickup.locator('.je-drawer__foot').innerText()
  zouden(bevat(voet, 'Overgenomen uit ClickUp'), `de voet zegt niets over de herkomst: ${voet}`)
  zouden(!bevat(voet, 'Aangemaakt'), `"aangemaakt" staat er nog: ${voet}`)

  await page.keyboard.press('Escape')
  await rustig(page)

  const eigen = await opentTaak(page, 'Trouw Niels en Inez')
  const eigenVoet = await eigen.locator('.je-drawer__foot').innerText()
  zouden(bevat(eigenVoet, 'Aangemaakt'), `een eigen taak mist haar datum: ${eigenVoet}`)
  await page.close()
})

await test('verwijderen zegt wat er verdwijnt, archiveren is de gewone knop', async () => {
  const page = await tabblad('/bord/l-overview')
  const paneel = await opentTaak(page, 'Trouw Niels en Inez')

  // In de voet, want verderop in het paneel staat bij elke subtaak, elk
  // tijdstip en elke reactie ook een kruisje dat "verwijderen" heet.
  const voet = paneel.locator('.je-drawer__foot')
  await voet.getByRole('button', { name: 'Verwijderen' }).click()
  // Het eigen bevestigingsvenster van JE Plan, niet dat van de browser.
  const venster = page.getByRole('dialog', { name: 'Zeker weten?' })
  await venster.waitFor()
  const vraag = await venster.innerText()
  await venster.getByRole('button', { name: 'Annuleren' }).click()
  await rustig(page)

  zouden(vraag.includes('Trouw Niels en Inez'), `de vraag noemt de taak niet: ${vraag}`)
  zouden(/Weg zijn dan ook: \d+ subtaken/.test(vraag), `de subtaken staan er niet in: ${vraag}`)
  zouden(vraag.includes('1 bijlage'), `de bijlage staat er niet in: ${vraag}`)
  zouden(vraag.includes('geboekte tijd blijft bestaan'), `wat blijft staan wordt niet gezegd: ${vraag}`)
  zouden(vraag.includes('Archiveren bewaart alles'), `het alternatief ontbreekt: ${vraag}`)

  // Wegklikken laat de taak staan: de bevestiging is echt.
  zouden(bevat(await inhoud(page), 'Trouw Niels en Inez'), 'de taak verdween ondanks het annuleren')

  // En de rode knop is geen rode knop meer; archiveren staat er als de gewone.
  const weg = await voet.getByRole('button', { name: 'Verwijderen' }).getAttribute('class')
  zouden(!weg.includes('je-btn--danger'), `verwijderen draagt nog het rood: ${weg}`)
  const bewaar = await voet.getByRole('button', { name: 'Archiveren' }).getAttribute('class')
  zouden(bewaar.includes('je-btn--secondary'), `archiveren staat er niet als gewone knop: ${bewaar}`)
  await page.close()
})

await test('een label maak je vanuit de taak, en het geldt voor de hele werkruimte', async () => {
  const page = await tabblad('/bord/l-overview')
  const paneel = await opentTaak(page, 'Trouw Niels en Inez')

  await paneel.getByLabel('Nieuw label').fill('winterbar')
  await paneel.getByLabel('Nieuw label').press('Enter')
  await rustig(page)
  zouden(bevat(await paneel.innerText(), 'winterbar'), 'het nieuwe label staat niet op de taak')

  await page.keyboard.press('Escape')
  await rustig(page)
  const ander = await opentTaak(page, 'Blum België — 20-jarig bestaan')
  zouden(
    bevat(await ander.innerText(), 'winterbar'),
    'het label bestaat alleen op die ene taak in plaats van in de werkruimte'
  )
  zouden(page.fouten.length === 0, `fouten: ${page.fouten[0]}`)
  await page.close()
})

await test('de bijlagen van een event staan in het paneel', async () => {
  const page = await tabblad('/bord/l-overview')
  const paneel = await opentTaak(page, 'Trouw Niels en Inez')
  const tekst = await paneel.innerText()
  zouden(bevat(tekst, 'Bijlagen bij dit event (1)'), `geen bijlagenblok: ${tekst.slice(0, 200)}`)
  zouden(bevat(tekst, 'grondplan-hoeve-vanhove.pdf'), 'de bijlage zelf staat er niet')
  zouden(bevat(tekst, '+ Bestand'), 'er is geen manier om er een bij te zetten')
  // De bestanden staan in Drive: er is een knop naar de map en een om de lijst
  // opnieuw uit Drive te halen, want een collega kan er buiten JE Plan om iets
  // in gezet hebben.
  zouden(bevat(tekst, 'Map in Drive'), 'de link naar de Drive-map ontbreekt')
  zouden(bevat(tekst, 'Vernieuwen'), 'de lijst is niet opnieuw uit Drive te halen')
  await page.close()
})

await test('een bijlage uit Drive opent in een voorvertoning, zonder de fiche te verlaten', async () => {
  const page = await tabblad('/bord/l-overview')
  // De voorvertoning zelf komt van Drive; in de demo bestaat dat bestand niet.
  await page.route('**drive.google.com/**', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<p>voorvertoning</p>' })
  )
  const paneel = await opentTaak(page, 'Trouw Niels en Inez')
  await paneel.getByRole('button', { name: 'grondplan-hoeve-vanhove.pdf' }).click()
  const venster = page.getByRole('dialog', { name: 'grondplan-hoeve-vanhove.pdf' })
  await venster.waitFor({ timeout: 3000 })
  const kader = venster.locator('iframe')
  zouden((await kader.count()) === 1, 'er is geen voorvertoning')
  zouden(bevat(await venster.innerText(), 'Openen in Drive'), 'vanuit de voorvertoning kun je niet naar Drive')
  await venster.getByRole('button', { name: 'Sluiten' }).click()
  zouden((await page.getByRole('dialog', { name: 'grondplan-hoeve-vanhove.pdf' }).count()) === 0, 'de voorvertoning gaat niet dicht')
  zouden(page.fouten.length === 0, `fouten: ${page.fouten[0]}`)
  await page.close()
})

await test('het tabblad Messaging toont wat van buiten binnenkwam, met de stand per verwerker', async () => {
  const page = await tabblad('/instellingen')
  await page.getByRole('tab', { name: 'Messaging' }).click()
  await rustig(page)
  const tekst = await inhoud(page)
  zouden(bevat(tekst, 'Berichten van buiten'), 'het paneel staat er niet')
  // Drie standen uit de demo: klaar met een kaart, vastgelopen na drie pogingen, en niet van toepassing.
  zouden(bevat(tekst, 'wintermoods'), 'de bron staat er niet')
  zouden(bevat(tekst, 'reservatie.aangevraagd'), 'de soort staat er niet')
  zouden(bevat(tekst, 'Klaar'), 'een verwerkt bericht toont geen "Klaar"')
  zouden(bevat(tekst, 'Mislukt') && bevat(tekst, '3 pogingen'), 'een vastgelopen bericht zegt niet hoe vaak het mislukte')
  zouden(bevat(tekst, 'geen_eventlijst'), 'de fout zelf staat er niet bij')
  zouden(bevat(tekst, 'Niet van toepassing'), 'een soort die niet voor de verwerker is, zegt dat niet')
  zouden(bevat(tekst, 'Naar de kaart'), 'van een verwerkt bericht kun je niet naar de kaart')

  // Herspelen zet het vastgelopen bericht weer in gang (in de demo: meteen klaar).
  const rij = page.locator('.je-messaging__rij', { hasText: 'Tom Peeters' })
  await rij.getByRole('button', { name: 'Herspelen' }).click()
  await rustig(page)
  zouden(bevat(await rij.innerText(), 'Klaar'), 'herspelen verandert de stand niet')
  zouden(page.fouten.length === 0, `fouten: ${page.fouten[0]}`)
  await page.close()
})

await test('de instellingen zeggen welke Drive de documenten draagt', async () => {
  const page = await tabblad('/instellingen')
  await page.getByRole('tab', { name: 'Documenten' }).click()
  await rustig(page)
  const tekst = await inhoud(page)
  zouden(bevat(tekst, 'Gedeelde Drive voor documenten'), 'het Drive-paneel staat er niet')
  const veld = page.locator('#drive-id')
  zouden((await veld.inputValue()) === '0ADemoDriveId', 'de ingestelde Drive staat niet in het veld')
  // Een link plakken volstaat; de id wordt eruit gehaald.
  await veld.fill('https://drive.google.com/drive/u/0/folders/0AAndereDrive?usp=sharing')
  zouden(bevat(await inhoud(page), 'Herkend als Drive-id 0AAndereDrive'), 'de id wordt niet uit de link herkend')
  await page.close()
})

await test('alle frequenties van het poetsplan zijn te kiezen en komen door', async () => {
  const page = await tabblad('/instellingen')
  await page.getByRole('tab', { name: 'Dagelijkse lijsten' }).click()
  await rustig(page)
  await page.getByRole('button', { name: /^Poetsplan$/ }).click()
  await rustig(page)

  const rij = page
    .locator('div.space-y-2')
    .filter({ has: page.locator('input[value*="Werkoppervlakken"]') })
    .first()
  await rij.getByRole('button', { name: 'Wijzigen' }).click()
  await rustig(page)

  const soort = rij.getByLabel('Hoe vaak dit punt terugkomt')
  const opties = await soort.locator('option').allTextContents()
  zouden(opties.length === 6, `niet alle frequenties staan er: ${opties.join(', ')}`)

  // Dit was de fout: "één keer per week" viel terug op het weekend en maakte er
  // stilletjes zondag van.
  await soort.selectOption('wekelijks')
  await rustig(page)
  let tekst = await rij.innerText()
  zouden(bevat(tekst, 'elke maandag'), `de wekelijkse beurt staat verkeerd: ${tekst.split('\n')[1]}`)
  zouden(bevat(tekst, 'eerstvolgend'), 'er staat niet bij wanneer het de eerste keer valt')

  await soort.selectOption('kwartaal')
  await rustig(page)
  tekst = await rij.innerText()
  zouden(bevat(tekst, 'elk kwartaal'), `de kwartaalkeuze komt niet door: ${tekst.split('\n')[1]}`)

  // Geen dag aangevinkt is geen stille fout meer.
  await soort.selectOption('weekdag')
  await rustig(page)
  for (const dag of ['ma', 'di', 'wo', 'do', 'vr']) {
    await rij.getByRole('button', { name: dag, exact: true }).click()
    await rustig(page)
  }
  zouden(bevat(await rij.innerText(), 'nooit meer op de lijst'), 'een punt zonder dag geeft geen waarschuwing')
  zouden(page.fouten.length === 0, `fouten: ${page.fouten[0]}`)
  await page.close()
})

await test('het poetsplan laat zien wat er buiten vandaag nog aankomt', async () => {
  const page = await tabblad('/openen-sluiten')
  await page.getByRole('tab', { name: /Poetsplan/ }).click()
  await rustig(page)
  const tekst = await inhoud(page)
  zouden(bevat(tekst, 'Komt er nog aan'), 'het poetsplan toont alleen nog de dagelijkse punten')
  zouden(bevat(tekst, 'Friteuse volledig gereinigd'), 'de wekelijkse beurt staat er niet bij')
  zouden(page.fouten.length === 0, `fouten: ${page.fouten[0]}`)
  await page.close()
})

await test('de zoekbalk bij Klanten past in zijn veld', async () => {
  const page = await tabblad('/klanten')
  const veld = page.getByLabel(/^Zoeken op naam/)
  const past = await veld.evaluate((el) => {
    const bewaard = el.value
    el.value = el.placeholder
    const past = el.scrollWidth <= el.clientWidth
    el.value = bewaard
    return past
  })
  zouden(past, 'de tekst in de zoekbalk is breder dan de zoekbalk')
  await page.close()
})

// ─── Het activiteitslog en het archief ──────────────────────────────────────

await test('een wijziging aan een taak komt in het verloop te staan', async () => {
  const page = await tabblad('/bord/l-overview')
  await page.locator('main').getByText('Trouw Niels en Inez').first().click()
  await rustig(page)
  const paneel = page.getByRole('dialog')

  // Wat er vóór deze functie gebeurde staat er ook in: het log begint niet leeg.
  zouden(bevat(await paneel.innerText(), 'Verloop'), 'het verloop staat niet in het paneel')
  zouden(
    bevat(await paneel.innerText(), 'verzette de status van Aanvraag naar Offerte maken'),
    'de bestaande logregels staan er niet'
  )

  // En nu echt iets wijzigen: de prioriteit hoger zetten.
  await paneel.getByLabel('Prioriteit').selectOption('1')
  await rustig(page)
  const na = await paneel.innerText()
  zouden(bevat(na, 'zette de prioriteit op Urgent'), `de wijziging staat niet in het verloop: ${na.slice(-300)}`)
  zouden(bevat(na, 'Jasper Hansen'), 'er staat niet bij wie het deed')
  zouden(page.fouten.length === 0, `fouten: ${page.fouten[0]}`)
  await page.close()
})

await test('dezelfde waarde opnieuw kiezen levert geen tweede regel op', async () => {
  const page = await tabblad('/bord/l-overview')
  await page.locator('main').getByText('Blum België — 20-jarig bestaan').first().click()
  await rustig(page)
  const paneel = page.getByRole('dialog')

  // De kop staat in kapitalen via CSS, dus zonder op hoofdletters te letten.
  const tel = async () => Number((await paneel.innerText()).match(/verloop \((\d+)\)/i)?.[1])
  const voor = await tel()

  // De status staat al op "offer accepted"; die opnieuw kiezen verandert niets.
  const status = paneel.getByLabel('Status')
  await status.selectOption({ label: 'offer accepted' })
  await rustig(page)
  zouden((await tel()) === voor, `het verloop groeide van ${voor} naar ${await tel()} zonder wijziging`)

  await status.selectOption({ label: 'planning ongoing' })
  await rustig(page)
  zouden((await tel()) === voor + 1, `een echte wijziging gaf ${voor} → ${await tel()}`)
  await page.close()
})

await test('materiaal reserveren vanuit een event, en uit en terug melden', async () => {
  const page = await tabblad('/events/t-trouw?tab=materiaal')
  const tekst = await inhoud(page)

  zouden(bevat(tekst, 'Vastgelegd voor dit event'), 'het materiaalblok staat er niet')
  // De demo legt vier stukken vast op het trouwfeest.
  zouden(bevat(tekst, 'Mobiele bar Vue'), 'de reservatie van dit event staat er niet')
  zouden(bevat(tekst, 'Terrasverwarmer'), 'niet alle reservaties staan er')

  /*
    Geboekt en fysiek buiten zijn twee verschillende dingen. "Is buiten" zet
    de stand op uit; daarna hoort "Is terug" te verschijnen en niet meer de
    knop waarmee je het buiten zet.
  */
  await page.getByRole('button', { name: 'Is buiten' }).first().click()
  await rustig(page)
  const na = await inhoud(page)
  zouden(bevat(na, 'Is terug'), `de stand sprong niet naar uit: ${na.slice(0, 200)}`)

  zouden(page.fouten.length === 0, `fouten: ${page.fouten[0]}`)
  await page.close()
})

await test('het magazijn toont per dag wat vrij is, en meldt een overboeking', async () => {
  const page = await tabblad('/materiaal')
  const tekst = await inhoud(page)

  zouden(bevat(tekst, 'Mobiele bar Vue'), 'het materiaal staat er niet')
  zouden(bevat(tekst, 'Beschikbaarheid'), 'de kalender staat er niet')

  /*
    In de demo vragen een eigen event en een verhuur op hetzelfde weekend
    allebei vier terrasverwarmers, terwijl er zes zijn. Dat hoort bovenaan te
    staan als iets wat iemand moet oplossen — niet verstopt in een rode rij.
  */
  zouden(bevat(tekst, 'Terrasverwarmer'), 'het conflict noemt het artikel niet')
  zouden(/meer beloofd is dan er staat/i.test(tekst), `geen conflictmelding: ${tekst.slice(0, 200)}`)
  zouden(bevat(tekst, 'te weinig'), 'er staat niet bij hoeveel er tekort is')

  zouden(page.fouten.length === 0, `fouten: ${page.fouten[0]}`)
  await page.close()
})

await test('een aanvraag van de verhuursite staat in het postvak en wordt een event', async () => {
  const page = await tabblad('/aanvragen')
  const tekst = await inhoud(page)

  /*
    Aanvragen van de site staan in hetzelfde postvak als losse mail, want het
    is hetzelfde werk: bellen, en er een dossier van maken als het doorgaat.
    Een eigen scherm zou een tweede plek zijn om te onthouden.
  */
  zouden(bevat(tekst, 'Lotte Vrancken'), `de aanvraag staat er niet: ${tekst.slice(0, 300)}`)
  zouden(bevat(tekst, 'Verhuursite'), 'er staat niet bij waar de aanvraag vandaan komt')
  zouden(bevat(tekst, '60 personen'), 'het aantal personen uit het formulier staat er niet')

  /*
    De knop ín de kaart van Lotte, niet "de eerste knop": er staan twee
    aanvragen van de site en de volgorde daarvan hangt af van de seconde
    waarop ze aangemaakt zijn. De eerste knop pakken was in de helft van de
    runs die van Blum — en dan bleef Lotte terecht staan.
  */
  await page.locator('.je-aanvraag', { hasText: 'Lotte Vrancken' }).getByRole('button', { name: 'Event maken' }).click()
  await rustig(page)

  zouden(/\/events\//.test(page.url()), `er is geen event gemaakt: ${page.url()}`)
  const fiche = await inhoud(page)
  zouden(bevat(fiche, 'Lotte Vrancken'), 'de naam uit de aanvraag staat niet op het event')

  /*
    En de aanvraag is uit het postvak: afgehandeld, niet verwijderd. Terug via
    de zijbalk en niet via een nieuw tabblad — de demo bewaart niets tussen
    bezoeken, dus een nieuw tabblad begint weer met de verse seed en laat de
    aanvraag opnieuw zien.
  */
  await page.getByLabel('Hoofdnavigatie').getByRole('link', { name: /^Events/ }).first().click()
  await rustig(page)
  // Het postvak hangt aan een envelopje rechtsboven op de eventpagina.
  await page.getByRole('button', { name: /Postvak|Aanvragen/ }).first().click()
  await rustig(page)
  zouden(/\/aanvragen$/.test(page.url()), `het postvak gaat niet open: ${page.url()}`)
  /*
    Alleen de kaarten in het postvak, niet de hele pagina: de naam staat na het
    aanmaken ook nog in de melding "event gemaakt" en in de recente lijst van
    de zoekbalk, en dat is juist. De vraag is of de kaart weg is.
  */
  /*
    Alleen de kop van elke kaart. De kaart van een mail draagt een keuzelijst
    "koppel aan event" met álle events erin — ook het event dat we net voor
    Lotte maakten. Wie de hele kaart leest, vindt haar naam dus terecht
    terug, maar niet omdat haar aanvraag er nog staat.
  */
  const koppen = await page.locator('.je-aanvraag .je-aanvraag__van').allInnerTexts()
  zouden(!koppen.some((k) => bevat(k, 'Lotte Vrancken')), `de aanvraag staat nog in het postvak: ${koppen.join(' ‖ ')}`)

  zouden(page.fouten.length === 0, `fouten: ${page.fouten[0]}`)
  await page.close()
})

await test('de laadlijst zegt per dag wat buiten gaat en wat terugkomt, per klant', async () => {
  const page = await tabblad('/materiaal')

  /*
    In de demo begint het trouwfeest over vier dagen: bar, koelkasten,
    statafels en verwarmers gaan die dag buiten. Blum heeft op dag vijf ook
    verwarmers — die mogen niet bij het trouwfeest op de lijst komen, want je
    laadt per adres.
  */
  const dag = (n) => {
    const d = new Date(2026, 8, 28 + n)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }
  await page.getByLabel('Dag van de laadlijst').fill(dag(4))
  await rustig(page)

  const lijst = await page.locator('.je-laadlijst').innerText()
  zouden(bevat(lijst, 'Gaat buiten'), 'de laadlijst heeft geen kolom "gaat buiten"')
  zouden(bevat(lijst, 'Trouw Niels en Inez'), `het trouwfeest staat niet op de laadlijst: ${lijst.slice(0, 300)}`)
  zouden(bevat(lijst, 'Mobiele bar'), 'de bar van het trouwfeest staat er niet')
  zouden(!bevat(lijst, 'Blum'), 'de verwarmers van Blum staan op de dag van het trouwfeest')

  // Twee dagen later komt alles van het trouwfeest terug.
  await page.getByLabel('Dag van de laadlijst').fill(dag(6))
  await rustig(page)
  const terug = await page.locator('.je-laadlijst').innerText()
  zouden(bevat(terug, 'Komt terug'), 'de kolom "komt terug" ontbreekt')
  zouden(bevat(terug, 'Trouw Niels en Inez'), 'het trouwfeest komt niet terug op zijn einddag')

  zouden(page.fouten.length === 0, `fouten: ${page.fouten[0]}`)
  await page.close()
})

await test('het magazijn toont wat online afgerekend is, met de standen erbij', async () => {
  const page = await tabblad('/materiaal')
  const tekst = await inhoud(page)

  zouden(bevat(tekst, 'Online afgerekend'), 'het blok met huurorders staat er niet')
  zouden(bevat(tekst, 'Lies Vandeputte'), 'de betaalde huur staat er niet')

  /*
    De derde order kreeg een ander bedrag binnen dan wij berekend hadden. Dat
    is de enige stand die rood is, en hij hoort op het magazijnscherm te staan
    omdat iemand moet bellen vóór de camion vertrekt.
  */
  zouden(bevat(tekst, 'Nakijken'), 'een order met een afwijkend bedrag wordt niet als nakijken getoond')
  zouden(bevat(tekst, 'Wacht op betaling'), 'een lopende afrekening staat er niet bij')

  zouden(page.fouten.length === 0, `fouten: ${page.fouten[0]}`)
  await page.close()
})

await test('de waarborg terugstorten vraagt wat je inhoudt en toont wat er teruggaat', async () => {
  const page = await tabblad('/materiaal')

  // Alleen de betaalde order van Lies heeft een knop; de twee andere niet.
  const knoppen = page.getByRole('button', { name: 'Waarborg terugstorten' })
  zouden((await knoppen.count()) === 1, `er horen één knop te zijn, er zijn er ${await knoppen.count()}`)
  await knoppen.first().click()
  await rustig(page)

  const tekst = await inhoud(page)
  zouden(bevat(tekst, 'Lies Vandeputte'), 'de dialoog noemt de klant niet')
  zouden(bevat(tekst, 'In te houden voor schade'), 'er wordt niet gevraagd wat er ingehouden wordt')

  // Drie koelkasten à € 50 waarborg: 150 in, 20 ingehouden, 130 terug.
  await page.getByLabel('In te houden voor schade (€)').fill('20')
  await rustig(page)
  const na = await inhoud(page)
  zouden(bevat(na, 'Stort € 130,00 terug'), `de knop zegt niet wat er teruggaat: ${na.slice(0, 300)}`)

  await page.getByLabel('In te houden voor schade (€)').fill('99999')
  await rustig(page)
  zouden(bevat(await inhoud(page), 'Meer dan de waarborg kan niet'), 'meer inhouden dan de waarborg wordt niet tegengehouden')

  zouden(page.fouten.length === 0, `fouten: ${page.fouten[0]}`)
  await page.close()
})

await test('een artikel wijzigen toont de staffel en weigert los verhuur zonder prijs', async () => {
  const page = await tabblad('/materiaal')

  // De naam is de knop naar de fiche — zie `.je-materiaal__naam--knop`.
  await page.getByRole('button', { name: /Mobiele bar Vue/ }).first().click()
  await rustig(page)

  const tekst = await inhoud(page)
  zouden(bevat(tekst, 'Artikel wijzigen'), `de dialoog gaat niet open: ${tekst.slice(0, 200)}`)
  zouden(bevat(tekst, 'Waarborg'), 'het waarborgveld staat er niet')
  // De foto (vraag 9): nog geen foto in de demo, dus de uitleg en de knop.
  zouden(bevat(tekst, 'Nog geen foto'), 'het fotoveld staat er niet')
  zouden((await page.getByRole('button', { name: 'Foto kiezen' }).count()) === 1, 'de knop om een foto te kiezen ontbreekt')
  zouden(bevat(tekst, 'Mag zonder offerte gehuurd worden'), 'het vinkje voor losse verhuur staat er niet')

  /*
    De mobiele bar heeft een dagprijs maar staat in de demo niet op "los te
    huren" — ze moet geplaatst worden. Het vinkje hoort dus aan te staan als
    keuze, en de uitleg eronder hoort te zeggen wat het betekent.
  */
  /*
    Het label aanklikken en niet het invoerveld: `.je-choice__native` is nul bij
    nul pixels groot met `opacity: 0` — het vakje dat je ziet, is een span. Een
    `check()` op het invoerveld wacht dan tot de tijd om is.
  */
  const keuze = page.locator('label.je-choice').filter({ hasText: 'Mag zonder offerte gehuurd worden' }).first()
  const vinkje = keuze.locator('input[type=checkbox]')
  zouden(!(await vinkje.isDisabled()), 'het vinkje staat op slot terwijl er een dagprijs is')
  zouden(!(await vinkje.isChecked()), 'de mobiele bar staat ten onrechte als los te huren')

  await keuze.click()
  await rustig(page)
  zouden(await vinkje.isChecked(), 'het vinkje gaat niet aan')

  /*
    En dan de staffel, het hele punt van dit voorbeeld: zes dagen mogen niet
    duurder zijn dan een week. Met 185 per dag en 650 per week is dat 1110
    tegen 650 — en wat er moet staan is 650.
  */
  const na = await inhoud(page)
  zouden(bevat(na, 'Wat een klant zou betalen'), `het prijsvoorbeeld staat er niet: ${na.slice(0, 300)}`)
  zouden(bevat(na, '650,00'), `zes dagen worden niet afgetopt op de weekprijs: ${na.slice(0, 400)}`)

  zouden(page.fouten.length === 0, `fouten: ${page.fouten[0]}`)
  await page.close()
})

await test('de marge van een event rekent, en zegt wat ze mist', async () => {
  const page = await tabblad('/events/t-trouw')
  const tekst = await inhoud(page)

  zouden(bevat(tekst, 'Opbrengst en kosten'), 'het margeblok staat er niet')

  /*
    Het trouwfeest heeft drie shifts uit AAPI, waarvan één `zelfstandig` — en
    voor dat statuut staat er in de demo met opzet geen uurkost. De marge
    hoort dus te zeggen dat ze onvolledig is in plaats van die uren gratis te
    rekenen, en dat is het hele punt van dit blok.
  */
  zouden(bevat(tekst, 'Onvolledig'), 'een ontbrekend tarief wordt niet gemeld')
  zouden(bevat(tekst, 'zelfstandig'), 'er staat niet bij welk statuut geen tarief heeft')
  zouden(bevat(tekst, 'inkoopprijs'), 'de bestellijstregel zonder prijs wordt niet gemeld')
  zouden(bevat(tekst, 'Marge, hoogstens'), 'de marge heet geen bovengrens terwijl er iets mist')

  // En de ploeguren komen echt uit de shifts, niet uit een vast getal.
  zouden(/\d+(?:[.,]\d+)? u uit AAPI/.test(tekst), `geen ploeguren: ${tekst.slice(0, 120)}`)
  zouden(page.fouten.length === 0, `fouten: ${page.fouten[0]}`)
  await page.close()
})

await test('de uurkost per statuut staat in Instellingen', async () => {
  const page = await tabblad('/instellingen')
  await page.getByRole('tab', { name: 'Marge' }).click()
  await rustig(page)
  const tekst = await inhoud(page)
  zouden(bevat(tekst, 'Uurkost per statuut'), 'het margepaneel opent niet')
  zouden(bevat(tekst, 'niet ingesteld') || bevat(tekst, 'Zelfstandig'), 'de statuten staan er niet')
  zouden(page.fouten.length === 0, `fouten: ${page.fouten[0]}`)
  await page.close()
})

await test('het archief toont de afgesloten events, met een filter op jaar', async () => {
  const page = await tabblad('/?weergave=bord')
  const bord = await inhoud(page)
  zouden(!bevat(bord, 'Kerstmarkt Borgloon 2025'), 'een afgesloten event staat nog op het bord')
  zouden(bevat(bord, 'Trouw Niels en Inez'), 'het bord is leeg geworden')

  /*
    Het archief haalt één jaar tegelijk op — het hele archief ophalen is
    precies wat hier afgeschaft is. Het opent op het recentste jaar, want dat
    is wat mensen zoeken.
  */
  await page.getByRole('tab', { name: 'Archief' }).click()
  await rustig(page)
  const recentste = await inhoud(page)
  for (const naald of ['Kerstmarkt Borgloon 2025', 'kick-off 2025']) {
    zouden(bevat(recentste, naald), `"${naald}" staat niet in het archief van 2025`)
  }
  zouden(!bevat(recentste, 'Oldskool Festival 2024'), 'het archief toont nog alle jaren tegelijk')
  // Niets wordt verwijderd, en dat staat er ook.
  zouden(bevat(recentste, 'niets verwijderd'), 'er staat niet bij dat er niets verwijderd wordt')

  await page.getByText('2024', { exact: true }).first().click()
  await rustig(page)
  const vanJaar = await inhoud(page)
  zouden(bevat(vanJaar, 'Oldskool Festival 2024'), 'het filter op 2024 verbergt zijn eigen event')
  zouden(!bevat(vanJaar, 'Kerstmarkt Borgloon 2025'), 'het filter op jaar filtert niet')

  // En een gearchiveerd event is nog gewoon te openen.
  await page.locator('main').getByText('Oldskool Festival 2024').first().click()
  await rustig(page)
  zouden(bevat(await inhoud(page), 'Oldskool Festival 2024'), 'een gearchiveerd event opent niet')
  zouden(page.fouten.length === 0, `fouten: ${page.fouten[0]}`)
  await page.close()
})

await test('de lopende timer staat in de zijbalk', async () => {
  const page = await tabblad('/')
  const balk = await page.locator('aside').first().innerText()
  zouden(/\d+:\d\d:\d\d/.test(balk), `geen loper in de zijbalk: ${balk.replace(/\n/g, ' ')}`)
  zouden(balk.includes('Drankenlijst finaliseren'), 'de taak van de timer staat er niet')
  await page.close()
})

await test('de timer start vanaf elke pagina, maar nooit zonder event of taak', async () => {
  /*
    De klok stond er alleen als ze liep; daarvoor in de plaats stond een zin die
    je naar een taak stuurde. Nu staat de klok er altijd op 00:00:00 met een
    startknop, en kiezen waaraan blijft verplicht.
  */
  const page = await tabblad('/goals')

  // Eerst de lopende demotimer wegwerken: pas dan staat de klok op nul.
  await page.getByRole('button', { name: /stop en boek/i }).first().click()
  await rustig(page)

  const zijbalk = page.locator('aside').first()
  zouden(bevat(await zijbalk.innerText(), '00:00:00'), `de klok staat er niet op nul: ${await zijbalk.innerText()}`)

  await zijbalk.getByRole('button', { name: 'Timer starten' }).click()
  await rustig(page)

  // Zonder keuze gaat de timer niet lopen.
  const startknop = page.getByRole('button', { name: /^Start$/ })
  zouden(await startknop.isDisabled(), 'de timer kan starten zonder event of taak')

  // Events én taken staan in dezelfde lijst, elk met waar ze onder hangen.
  const kiezer = page.getByLabel('Waaraan werk je')
  const opties = await kiezer.locator('option').allInnerTexts()
  zouden(opties.some((o) => o.includes('Trouw Niels en Inez')), `geen events om op te boeken: ${opties.join(' | ')}`)
  zouden(
    opties.some((o) => o.includes('Drankenlijst finaliseren')),
    `geen taken om op te boeken: ${opties.join(' | ')}`
  )

  await kiezer.selectOption({ label: opties.find((o) => o.includes('Drankenlijst finaliseren')) })
  await startknop.click()
  await rustig(page)

  const na = await zijbalk.innerText()
  zouden(bevat(na, 'Drankenlijst finaliseren'), `de timer loopt niet op de gekozen taak: ${na}`)
  zouden(bevat(na, 'Stop en boek'), 'er staat geen stopknop na het starten')
  zouden(page.fouten.length === 0, `fouten: ${page.fouten[0]}`)
  await page.close()
})

await test('op je eigen profiel pas je je naam en je foto aan', async () => {
  const page = await tabblad('/profiel')
  const tekst = await inhoud(page)
  zouden(bevat(tekst, 'Mijn profiel'), 'de profielpagina opent niet')

  const naam = page.getByLabel('Naam')
  await naam.fill('Jasper H.')
  await page.getByRole('button', { name: 'Bewaren' }).click()
  await rustig(page)

  // De naam verandert overal mee, want de zijbalk leest hetzelfde profiel.
  const zijbalk = await page.locator('aside').first().innerText()
  zouden(bevat(zijbalk, 'Jasper H.'), `de nieuwe naam komt niet door: ${zijbalk}`)

  // En de foto uit de handtekening staat erbij zolang er geen eigen foto is.
  const bronnen = await page.locator('img.je-avatar__foto').evaluateAll((els) => els.map((e) => e.getAttribute('src')))
  zouden(bronnen.some((b) => (b ?? '').includes('/team/jasper.jpg')), `geen portret op het profiel: ${bronnen.join(', ')}`)
  zouden(page.fouten.length === 0, `fouten: ${page.fouten[0]}`)
  await page.close()
})

await test('iedereen staat in dezelfde zeshoek, met foto of met initialen', async () => {
  /*
    Er liepen twee vormen naast elkaar: de zeshoek uit het logo met initialen,
    en een ronde avatar die een foto kon dragen. Dezelfde persoon had dus een
    andere vorm naargelang het scherm. Nu is er één vorm, en de foto zit erin.
  */
  const page = await tabblad('/werklast')
  const vlakken = await page.locator('.je-avatar').first().evaluate((el) => ({
    buiten: getComputedStyle(el).clipPath,
    binnen: getComputedStyle(el.querySelector('.je-avatar__vlak')).clipPath,
  }))
  for (const [waar, waarde] of Object.entries(vlakken)) {
    zouden(/polygon/.test(waarde), `de avatar is ${waar} geen zeshoek: ${waarde}`)
  }

  // Wie een foto heeft toont hem; wie er geen heeft houdt zijn initialen, in
  // precies dezelfde vorm.
  const metFoto = await page.locator('.je-avatar img.je-avatar__foto').count()
  const metLetters = await page.locator('.je-avatar .je-avatar__vlak:not(:has(img))').count()
  zouden(metFoto > 0, 'nergens staat een foto in een avatar')
  zouden(metLetters > 0, 'niemand valt meer terug op initialen; dan test dit niets')
  zouden(page.fouten.length === 0, `fouten: ${page.fouten[0]}`)
  await page.close()
})

await test('onder je naam zit je profiel en geen tweede navigatie', async () => {
  /*
    Hier hing een menu van zes regels: taal, twee soorten meldingen, agenda,
    afmelden. Een tweede navigatie op de plek waar de eerste al staat. Nu is het
    één klik naar je profiel, met alles wat alleen over jou gaat bij elkaar.
  */
  const page = await tabblad('/')
  const zijbalk = page.locator('aside').first()

  await zijbalk.getByRole('button', { name: /Jasper/ }).click()
  await rustig(page)

  const tekst = await inhoud(page)
  zouden(bevat(tekst, 'Mijn profiel'), `de knop onder je naam opent je profiel niet: ${tekst.slice(0, 300)}`)
  for (const verhuisd of ['Taal', 'Welke meldingen ik krijg', 'Events in mijn agenda']) {
    zouden(bevat(tekst, verhuisd), `"${verhuisd}" staat niet op het profiel: ${tekst.slice(0, 600)}`)
  }
  // Afmelden is een icoon naast je naam, geen regel in een menu.
  zouden(
    (await zijbalk.getByRole('button', { name: 'Afmelden' }).count()) === 1,
    'afmelden staat niet als icoon in de zijbalk'
  )
  zouden(page.fouten.length === 0, `fouten: ${page.fouten[0]}`)
  await page.close()
})

await test('het postvak hangt aan een envelopje op de eventpagina', async () => {
  // Het stond als menu-ingang onder Events en was er meestal leeg; nu kijk je
  // ernaar vanaf de plek waar je er toch een event van maakt.
  const page = await tabblad('/')
  const zijbalk = await page.locator('aside').first().innerText()
  zouden(!bevat(zijbalk, 'Aanvragen'), `het postvak staat nog in het menu: ${zijbalk}`)

  await page.getByRole('button', { name: /Postvak|Aanvragen/ }).first().click()
  await rustig(page)
  const na = await inhoud(page)
  zouden(bevat(na, 'Aanvragen'), `het envelopje opent het postvak niet: ${na.slice(0, 300)}`)
  zouden(page.fouten.length === 0, `fouten: ${page.fouten[0]}`)
  await page.close()
})

await test('de planning uit AAPI staat in een kalender', async () => {
  /*
    Via het event ernaartoe en niet rechtstreeks. De kalender opent op de week
    van vandaag, en de demo zet zijn trouwfeest een eind verderop — een test die
    rechtstreeks naar /planning gaat, test dan alleen welke week het is.
    Bovendien is dit de weg die een mens neemt: vanaf het event naar die dag.
  */
  const page = await tabblad('/events/t-trouw')
  await rustig(page)
  // Personeel is een eigen tab sinds het bolletje erop staat.
  await page.getByRole('tab', { name: /Personeel/ }).click()
  await rustig(page)
  await page.getByRole('button', { name: /planning van die dag/i }).click()
  await rustig(page)

  const tekst = await inhoud(page)
  zouden(bevat(tekst, 'Planning'), 'de planningspagina opent niet')

  /*
    Namen en geen GUID's. Dat stond er live wél: de import schreef de naam
    alleen op het medewerkerskaartje en het scherm las hem van de shift. De
    demo zette hem met de hand op de shift en dekte de fout dus toe — nu doet
    de demo het net als de import, en bewijst dit dat de opzoeking werkt.
  */
  for (const wie of ['Jumana Mhanawi', 'Roeland Kempeneers']) {
    zouden(bevat(tekst, wie), `${wie} staat niet in de kalender: ${tekst.slice(0, 500)}`)
  }
  zouden(
    !/\b[0-9a-f]{8}-[0-9a-f]{4}-/.test(tekst),
    `er staat een GUID op een kaartje in plaats van een naam: ${tekst.slice(0, 400)}`
  )
  zouden(bevat(tekst, 'Flexi') && bevat(tekst, 'Zelfstandig'), 'de statuten staan er niet bij')

  // Een afgezegde shift blijft staan, gedempt en doorgestreept: "er stond
  // iemand en die is afgezegd" is informatie, een lege plek niet.
  zouden(
    (await page.locator('.je-shiftblok[data-gedempt]').count()) >= 1,
    'de geannuleerde shift is verdwenen in plaats van gedempt'
  )
  // En wat nergens bij hoort krijgt een waarschuwing.
  zouden(
    (await page.locator('.je-shiftblok svg').count()) >= 1,
    'er staat geen waarschuwing bij de ongekoppelde shift'
  )
  zouden(page.fouten.length === 0, `fouten: ${page.fouten[0]}`)
  await page.close()
})

await test('een shift opent met zijn ruwe AAPI-gegevens en koppelacties', async () => {
  const page = await tabblad('/events/t-trouw')
  await rustig(page)
  // Personeel is een eigen tab sinds het bolletje erop staat.
  await page.getByRole('tab', { name: /Personeel/ }).click()
  await rustig(page)
  await page.getByRole('button', { name: /planning van die dag/i }).click()
  await rustig(page)
  await page.locator('.je-shiftblok').first().click()
  await rustig(page)

  const tekst = await inhoud(page)
  // De vestiging staat erbij mét de reden waarom we er niet op matchen.
  zouden(bevat(tekst, 'Meer-Bistro Het Vinne'), 'de vestiging staat niet in het detail')
  zouden(bevat(tekst, 'koppelen we op tijd'), 'de uitleg over de vestiging ontbreekt')
  zouden(bevat(tekst, 'pauze'), 'de pauze staat niet in het detail')
  zouden(page.fouten.length === 0, `fouten: ${page.fouten[0]}`)
  await page.close()
})

await test('het importscherm zegt wat er per mail binnenkwam', async () => {
  /*
    Een xlsx die geen planning blijkt, is geen storing — maar wie zich afvraagt
    waarom de planning van gisteren er niet staat, hoort te zien dat het bestand
    wél aankwam en waarom er niets mee gebeurde.
  */
  const page = await tabblad('/planning?tab=import')
  await rustig(page)

  const tekst = await inhoud(page)
  zouden(bevat(tekst, 'Per mail binnengekomen'), `de wachtrij staat er niet: ${tekst.slice(0, 400)}`)
  zouden(bevat(tekst, 'Planning Overview.xlsx'), 'de gelezen export staat er niet bij')
  zouden(bevat(tekst, 'Geen planning'), 'een afgewezen bijlage wordt niet als zodanig getoond')
  zouden(bevat(tekst, 'geen blad "Data"'), 'de reden van de afwijzing staat er niet bij')

  // En de historiek van wat er echt geïmporteerd is.
  zouden(bevat(tekst, 'Vorige keren'), 'de importhistoriek staat er niet')
  zouden(page.fouten.length === 0, `fouten: ${page.fouten[0]}`)
  await page.close()
})

await test('op een event staat wie er komt werken, met een bolletje op de tab', async () => {
  const page = await tabblad('/events/t-trouw')
  await rustig(page)

  /*
    Het bolletje is waarvoor de tab bestaat: of de planning rond is, hoor je te
    zien zonder te klikken. Er staat een dienst open in de demo, dus rood.
  */
  const tab = page.getByRole('tab', { name: /Personeel/ })
  zouden((await tab.count()) === 1, 'de personeelstab staat er niet')
  zouden(
    (await tab.locator('.je-bol--rood').count()) === 1,
    `het bolletje op de tab is niet rood: ${await tab.innerHTML()}`
  )

  await tab.click()
  await rustig(page)
  const tekst = await inhoud(page)

  /*
    Drie mensen komen werken en één is afgezegd; de uren tellen alleen de drie,
    met de pauze eraf. Dat is 7u30 + 13u30 + 8u = 29u. De openstaande dienst
    telt niet mee — er staat niemand op.
  */
  zouden(bevat(tekst, '3 ingepland'), `de telling klopt niet: ${tekst.slice(0, 600)}`)
  zouden(bevat(tekst, '1 afgezegd'), 'de afgezegde shift wordt niet geteld')
  zouden(bevat(tekst, '29u'), `het urentotaal klopt niet: ${tekst.slice(0, 600)}`)

  // En het gat in de planning, bovenaan en met zoveel woorden.
  zouden(bevat(tekst, 'Nog in te vullen'), `de openstaande dienst staat er niet: ${tekst.slice(0, 600)}`)
  zouden(bevat(tekst, 'Nog niemand'), 'er staat geen naam-vervanger bij de openstaande dienst')
  zouden(bevat(tekst, '1 nog in te vullen'), 'de openstaande dienst staat niet in de samenvatting')

  // De uitsplitsing per statuut, en de shift die nergens bij hoort als kandidaat.
  zouden(bevat(tekst, 'Mogelijk voor dit event'), 'de kandidaten staan er niet bij')
  zouden(bevat(tekst, 'Koppel aan dit event'), 'er is geen knop om te koppelen')
  zouden(page.fouten.length === 0, `fouten: ${page.fouten[0]}`)
  await page.close()
})

await test('een meerdaags event splitst zijn ploeg per dag', async () => {
  /*
    "Elf mensen, 84 uur" over drie dagen beantwoordt geen enkele vraag die
    iemand stelt. De vraag is of er zaterdag genoeg volk staat, en dat is een
    vraag per dag.
  */
  const page = await tabblad('/events/t-beurs')
  await rustig(page)
  await page.getByRole('tab', { name: /Personeel/ }).click()
  await rustig(page)

  const koppen = page.locator('.je-dagkop')
  zouden((await koppen.count()) === 4, `er staan ${await koppen.count()} dagkoppen in plaats van vier`)

  // Drie dagen event plus de dag ervoor, voor de opbouw.
  const tekst = await inhoud(page)
  zouden(bevat(tekst, 'Niemand ingepland'), `een lege dag staat er niet bij: ${tekst.slice(0, 700)}`)

  // En een event van één dag krijgt geen koppen: dat zou alleen ruis zijn.
  const enkel = await tabblad('/events/t-trouw')
  await rustig(enkel)
  await enkel.getByRole('tab', { name: /Personeel/ }).click()
  await rustig(enkel)
  zouden((await enkel.locator('.je-dagkop').count()) === 0, 'een event van één dag krijgt toch dagkoppen')

  zouden(page.fouten.length === 0, `fouten: ${page.fouten[0]}`)
  await enkel.close()
  await page.close()
})

await test('het planningsbolletje staat ook op de kaarten en in de kalender', async () => {
  /*
    Dezelfde kleur als op de personeelstab: wie hem daar leert kennen, leest
    hem op het bord zonder uitleg. Het trouwfeest heeft een openstaande dienst
    en staat dus op rood.
  */
  for (const [weergave, waar] of [['bord', '.je-boardcard'], ['lijst', 'button']]) {
    const page = await tabblad(`/?weergave=${weergave}`)
    await rustig(page)
    const kaart = page.locator(waar).filter({ hasText: 'Trouw Niels en Inez' }).first()
    zouden(
      (await kaart.locator('.je-bol--rood').count()) >= 1,
      `geen rood bolletje op de ${weergave}weergave`
    )
    zouden(page.fouten.length === 0, `fouten op ${weergave}: ${page.fouten[0]}`)
    await page.close()
  }

  // En in de kalender, als derde stipje op de chip. Het trouwfeest valt in de
  // maand ná de demodag, dus eerst één maand verder bladeren.
  const kal = await tabblad('/?weergave=kalender')
  await rustig(kal)
  await kal.getByRole('button', { name: 'Volgende maand' }).click()
  await rustig(kal)
  zouden((await kal.locator('.je-calchip .je-bol').count()) >= 1, 'geen bolletje in de kalender')
  zouden(kal.fouten.length === 0, `fouten: ${kal.fouten[0]}`)
  await kal.close()
})

await test('de ploeg meldt zich aan met een naam en vier cijfers', async () => {
  /*
    Twee wegen naar binnen. Het bureau gebruikt Google; wie één zaterdag per
    maand komt werken, maakt daar geen account voor aan. In de demo meldt
    `?afgemeld` je af, want anders is dit scherm onbereikbaar.
  */
  const page = await nieuwePagina(browser, { viewport: { width: 420, height: 860 } })
  const fouten = []
  page.on('pageerror', (e) => fouten.push(String(e).split('\n')[0]))
  await page.goto(`${adres}/?afgemeld#/`, { waitUntil: 'networkidle' })
  await rustig(page)

  zouden(bevat(await page.locator('body').innerText(), 'Aanmelden'), 'het aanmeldscherm staat er niet')
  await page.getByRole('button', { name: 'Ik kom werken' }).click()
  await rustig(page)

  // Zoeken op een stuk van de naam, en dan kiezen.
  await page.getByRole('textbox', { name: 'Je naam' }).fill('jum')
  await rustig(page)
  await page.getByRole('option', { name: /Jumana/ }).click()
  await rustig(page)

  // Een verkeerde code zegt dat ook, en wist wat je typte.
  await page.getByLabel('Code', { exact: true }).fill('1111')
  await page.getByRole('button', { name: 'Aanmelden' }).click()
  await rustig(page)
  zouden(bevat(await page.locator('body').innerText(), 'klopt niet'), 'een verkeerde code wordt niet gemeld')

  // En de juiste brengt je binnen.
  await page.getByLabel('Code', { exact: true }).fill('4821')
  await page.getByRole('button', { name: 'Aanmelden' }).click()
  await rustig(page)
  zouden(!bevat(await page.locator('body').innerText(), 'Ik kom werken'), 'het aanmeldscherm blijft staan')

  zouden(fouten.length === 0, `fouten: ${fouten[0]}`)
  await page.close()
})

await test('het bureau kan een code opvragen, en dat laat een spoor na', async () => {
  const page = await tabblad('/medewerkers')
  await rustig(page)

  // Niet zomaar zichtbaar: vier cijfers zijn de vorm van een bankcode, en dit
  // scherm blijft openliggen terwijl er iemand meekijkt.
  zouden(!/\b4821\b/.test(await inhoud(page)), 'de code staat er zomaar op')

  // De rij van Jumana, en niet zomaar de eerste knop: de lijst staat op naam.
  const rij = page.locator('.je-medewerker').filter({ hasText: 'Jumana' }).first()
  await rij.getByRole('button', { name: 'Code tonen' }).click()
  await rustig(page)
  zouden(/\b4821\b/.test(await rij.innerText()), `de code komt niet tevoorschijn: ${await rij.innerText()}`)
  zouden(page.fouten.length === 0, `fouten: ${page.fouten[0]}`)
  await page.close()
})

await test('de app nodigt op een telefoon uit om zich te laten installeren', async () => {
  /*
    Zonder installatie geen pushbericht op een iPhone, geen app tussen de
    andere apps, en elke keer eerst een adresbalk. De knop stond op het
    profiel en daar kwam niemand — erger nog: `beforeinstallprompt` vuurt
    kort na het laden, en de luisteraar zat in een scherm dat pas later
    getekend wordt. Hij hoorde die gebeurtenis dus nooit.

    Headless Chromium stuurt zelf geen `beforeinstallprompt`; die wordt hier
    nagebootst. Wat getest wordt is wat wij ermee doen.
  */
  // Een Android-toestel: daar hángt het van de gebeurtenis af.
  const context = await browser.newContext({ ...devices['Pixel 5'] })
  const page = await nieuwePagina(context)
  const fouten = []
  page.on('pageerror', (e) => fouten.push(String(e).split('\n')[0]))

  await page.goto(`${adres}/#/`, { waitUntil: 'networkidle' })
  await rustig(page)
  zouden(!bevat(await page.locator('body').innerText(), 'beginscherm'), 'de balk staat er zonder aanleiding')

  const doeAlsof = () =>
    page.evaluate(() => {
      const e = new Event('beforeinstallprompt')
      e.prompt = () => {}
      e.userChoice = Promise.resolve({ outcome: 'accepted' })
      window.dispatchEvent(e)
    })

  await doeAlsof()
  await rustig(page)
  const balk = page.locator('.je-installbalk')
  zouden((await balk.count()) === 1, 'de uitnodiging verschijnt niet')
  zouden(bevat(await balk.innerText(), 'beginscherm'), `de balk zegt het verkeerde: ${await balk.innerText()}`)

  // Wegklikken werkt, en blijft werken na herladen — maar niet voor altijd.
  await page.getByRole('button', { name: 'Later' }).click()
  await rustig(page)
  zouden((await page.locator('.je-installbalk').count()) === 0, 'wegklikken doet niets')

  await page.reload({ waitUntil: 'networkidle' })
  await rustig(page)
  await doeAlsof()
  await rustig(page)
  zouden((await page.locator('.je-installbalk').count()) === 0, 'de balk komt meteen terug na wegklikken')

  zouden(fouten.length === 0, `fouten: ${fouten[0]}`)
  await context.close()

  /*
    En op een iPhone, waar die gebeurtenis nooit komt: Safari kent geen
    installatieknop en zal die nooit kennen. Daar is het enige wat we kunnen
    doen de weg wijzen — en zonder die regel is de app op de helft van de
    telefoons niet te installeren zonder dat iemand het voordoet.
  */
  const apple = await browser.newContext({ ...devices['iPhone 13'] })
  const ipage = await nieuwePagina(apple)
  await ipage.goto(`${adres}/#/`, { waitUntil: 'networkidle' })
  await rustig(ipage)

  const ibalk = ipage.locator('.je-installbalk')
  zouden((await ibalk.count()) === 1, 'een iPhone krijgt geen uitnodiging')
  await ipage.getByRole('button', { name: 'Hoe?' }).click()
  await rustig(ipage)
  zouden(
    bevat(await ibalk.innerText(), 'beginscherm') && bevat(await ibalk.innerText(), 'deel'),
    `de weg naar installeren staat er niet: ${await ibalk.innerText()}`
  )
  await apple.close()
})

await test('de tool schakelt over naar het Engels en onthoudt dat', async () => {
  const page = await tabblad('/')
  const zijbalk = page.locator('aside').first()
  const nederlands = await zijbalk.innerText()
  zouden(nederlands.includes('Instellingen') && nederlands.includes('Eigenaar'), 'de zijbalk staat niet in het Nederlands')

  // De taalknop staat op je profiel; het menu onder je naam bestaat niet meer.
  await zijbalk.getByRole('button', { name: /Jasper/ }).click()
  await rustig(page)
  await page.getByRole('radio', { name: 'English' }).click()
  await rustig(page)

  // De navigatie, de rol eronder en de timerknop komen uit drie verschillende
  // hoeken van de schil; staan die alle drie om, dan staat de schil om.
  const engels = (await zijbalk.innerText()).replace(/\n/g, ' | ')
  for (const woord of ['Settings', 'Owner', 'STOP AND LOG']) {
    zouden(engels.toLowerCase().includes(woord.toLowerCase()), `"${woord}" staat er niet: ${engels}`)
  }
  zouden(await page.locator('html[lang="en"]').count(), 'de pagina zegt niet dat ze Engels is')

  // De keuze is van jou, niet van dit tabblad: na herladen staat ze er nog.
  await page.reload()
  await rustig(page)
  zouden(
    (await page.locator('aside').first().innerText()).includes('Settings'),
    'de taalkeuze overleeft het herladen niet'
  )
  zouden(page.fouten.length === 0, `fouten: ${page.fouten[0]}`)
  await page.close()
})

// ─── Het design: events, pijplijn, templates ────────────────────────────────

await test('een aanvraag zonder alles ingevuld mag naar de offertestap, met een herinnering', async () => {
  // Dit wás een slot. Een event staat vaak op de offertestap juist omdát die
  // dingen nog uitgezocht worden; een tool die dan "nee" zegt, wordt omzeild.
  const page = await tabblad('/events/t-ruben')
  const knop = page.getByRole('button', { name: /Naar offerte maken/i })
  zouden(!(await knop.isDisabled()), 'de knop naar de offertestap is nog altijd geblokkeerd')

  const tekst = await inhoud(page)
  zouden(bevat(tekst, 'Nog in te vullen'), `geen herinnering van wat ontbreekt: ${tekst.slice(0, 200)}`)

  await knop.click()
  await rustig(page)
  zouden(bevat(await inhoud(page), 'Offerte verstuurd'), 'het event verzette niet naar de offertestap')
  zouden(page.fouten.length === 0, `fouten: ${page.fouten[0]}`)
  await page.close()
})

await test('een nieuw event uit een template krijgt zijn taken met deadlines', async () => {
  const page = await tabblad('/')
  await page.getByRole('button', { name: 'Nieuw event' }).click()
  await page.getByPlaceholder('bv. Trouw Tom en Sara').fill('Trouw Tom en Sara')
  await page.getByRole('button', { name: /Huwelijk/ }).click()
  await page.getByRole('button', { name: 'Event aanmaken' }).click()
  await rustig(page)
  zouden((await inhoud(page)).includes('Trouw Tom en Sara'), 'het event opende niet')

  // Een nieuw event opent op het overzicht; de taken staan op hun eigen
  // tabblad sinds de tabs bovenaan de pagina staan.
  await page.getByRole('tab', { name: /Taken/ }).click()
  await rustig(page)
  const tekst = await inhoud(page)
  zouden(tekst.includes('Voorschot 40% ontvangen'), 'de taken uit het template staan er niet')
  zouden(bevat(tekst, 'Taken · 8'), `niet alle acht taken: ${tekst.match(/Taken · \d+/i)?.[0]}`)
  zouden(page.fouten.length === 0, `fouten: ${page.fouten[0]}`)
  await page.close()
})

await test('een event uit een formule krijgt prijs, taken en een berekende bestellijst', async () => {
  const page = await tabblad('/')
  await page.getByRole('button', { name: 'Nieuw event' }).click()
  await page.getByPlaceholder('bv. Trouw Tom en Sara').fill('Winterfeest Blum')
  await page.getByRole('tab', { name: 'Bestaande formule' }).click()
  await page.getByRole('button', { name: /Winter BBQ/ }).click()
  await page.getByLabel('Aantal personen').fill('37')
  await page.getByLabel('Drankenformule').selectOption('dranken-avond')
  await rustig(page)
  await page.getByRole('button', { name: 'Event aanmaken' }).click()
  await rustig(page)

  const fiche = await inhoud(page)
  zouden(fiche.includes('Winterfeest Blum'), 'het event opende niet')
  zouden((await veldwaarde(page, 'Gasten')) === '37', `het aantal personen klopt niet: ${await veldwaarde(page, 'Gasten')}`)
  zouden((await veldwaarde(page, 'Formule')) === 'Winter BBQ', 'de formule staat niet op de fiche')
  // 29,90 + 19,00 drank = 48,90 per persoon × 37 = 1.809,30 excl. btw.
  const bedrag = await veldwaarde(page, 'Offerte')
  zouden(Math.abs(Number(bedrag) - 1809.3) < 0.01, `het offertebedrag klopt niet: ${bedrag}`)
  await page.getByRole('tab', { name: /Taken/ }).click()
  await rustig(page)
  zouden(
    bevat(await inhoud(page), 'Offerte opmaken en versturen'),
    'de standaardtaken van het template staan er niet'
  )

  await page.getByRole('tab', { name: /Bestellijst/ }).click()
  await rustig(page)
  const lijst = await inhoud(page)
  // 180 g × 37 = 6.660 g, dus zeven kilo. 2 broodjes × 37 = 74 stuks.
  zouden(lijst.includes('7 × kg van 1.000 g'), `het vlees is niet per kilo afgerond: ${lijst.slice(0, 200)}`)
  zouden(lijst.includes('74 stuks'), 'de broodjes staan er niet')
  // 2,5 flesjes × 37 = 92,5 → vier bakken van 24; enkel omdat de drankenformule gekozen is.
  zouden(lijst.includes('4 × bak van 24 flesjes'), 'de pils van de drankenformule ontbreekt of is fout afgerond')
  zouden(lijst.includes('92,5 flesjes nodig'), 'er staat niet bij hoeveel er echt nodig was')
  zouden(page.fouten.length === 0, `fouten: ${page.fouten[0]}`)
  await page.close()
})

await test('een taak afvinken telt mee in de voortgang', async () => {
  const page = await tabblad('/events/t-trouw?tab=taken')
  const voor = (await inhoud(page)).match(/Taken · (\d+)/i)?.[1]
  // Niet zomaar het eerste vinkje van de pagina: de fiche heeft er zelf een
  // rij, één per teamlid. De takenlijst staat in een paneel.
  await page.locator('.je-panel .je-check').first().click()
  await rustig(page)
  const na = (await inhoud(page)).match(/Taken · (\d+)/i)?.[1]
  zouden(Number(na) === Number(voor) - 1, `open taken ${voor} → ${na}`)
  await page.close()
})

await test('de zoekbalk vindt events en taken', async () => {
  const page = await tabblad('/')
  await page.getByLabel('Zoeken').fill('drankenlijst')
  await rustig(page)
  const tekst = await inhoud(page)
  zouden(tekst.includes('Drankenlijst finaliseren'), 'de taak wordt niet gevonden')
  await page.keyboard.press('Enter')
  await rustig(page)
  zouden((await inhoud(page)).includes('Trouw Niels en Inez'), 'Enter opent het event niet')
  await page.close()
})

await test('Ctrl+K opent de zoekbalk over taken, klanten en verslagen tegelijk', async () => {
  // De drie soorten die er los bij gekomen zijn, in één zoekopdracht: "Blum"
  // is een klant, een event met taken, én een punt in een verslag. Zonder
  // plafond per soort duwen de taken de rest eruit — zie @lib/zoeken.
  const page = await tabblad('/')
  await page.keyboard.press('Control+KeyK')
  await rustig(page)
  await page.getByLabel('Zoeken').fill('blum')
  await rustig(page)

  const lijst = await page.getByRole('listbox').innerText()
  for (const kopje of ['Events', 'Taken', 'Klanten', 'Verslagen']) {
    zouden(bevat(lijst, kopje), `het kopje "${kopje}" ontbreekt: ${lijst.slice(0, 250)}`)
  }
  zouden(lijst.includes('Blum België'), 'de klant staat niet in de resultaten')
  zouden(page.fouten.length === 0, `fouten: ${page.fouten[0]}`)
  await page.close()
})

await test('een verslag van het teamoverleg is te vinden op wat erin staat', async () => {
  // "Standenplan" staat nergens in een titel, alleen in de tekst van het
  // verslag. De verslagen komen uit dezelfde query die op viewerIds filtert,
  // zoals de regels het eisen.
  const page = await tabblad('/')
  await page.getByLabel('Zoeken').fill('standenplan')
  await rustig(page)

  const lijst = await page.getByRole('listbox').innerText()
  zouden(bevat(lijst, 'Verslagen'), `geen verslag gevonden: ${lijst.slice(0, 250)}`)
  zouden(lijst.includes('Weekstart events'), 'het verslag staat er niet bij')

  await page.keyboard.press('Enter')
  await rustig(page)
  zouden(bevat(await inhoud(page), 'Teamoverleg'), `Enter bracht je naar ${page.url()}`)
  await page.close()
})

await test('met de pijltjes verschuift de selectie en Enter opent die', async () => {
  const page = await tabblad('/')
  await page.getByLabel('Zoeken').fill('blum')
  await rustig(page)

  const gekozen = () => page.locator('[role=option][aria-selected=true]').first().innerText()
  const eerste = await gekozen()
  await page.keyboard.press('ArrowDown')
  await rustig(page)
  const tweede = await gekozen()
  zouden(eerste !== tweede, `de selectie bleef op "${eerste}" staan`)

  await page.keyboard.press('Enter')
  await rustig(page)
  zouden(!page.url().endsWith('#/'), `Enter bracht je nergens: ${page.url()}`)
  await page.close()
})

await test('? toont de sneltoetsen en een losse letter springt naar het scherm', async () => {
  const page = await tabblad('/')
  await page.keyboard.press('Shift+Slash')
  await rustig(page)
  const dialoog = await page.getByRole('dialog').innerText()
  zouden(bevat(dialoog, 'Sneltoetsen'), `geen lijstje: ${dialoog.slice(0, 150)}`)
  zouden(bevat(dialoog, 'Naar Tasks'), 'de sprong naar Tasks staat er niet bij')

  await page.keyboard.press('Escape')
  await rustig(page)
  await page.keyboard.press('t')
  await rustig(page)
  zouden(page.url().includes('/tasks'), `T bracht je naar ${page.url()}`)

  // En in een veld is een letter gewoon een letter.
  await page.getByLabel('Zoeken').fill('telefoon')
  await rustig(page)
  zouden(page.url().includes('/tasks'), `typen in het zoekveld navigeerde weg: ${page.url()}`)
  zouden(page.fouten.length === 0, `fouten: ${page.fouten[0]}`)
  await page.close()
})

await test('een event heeft één verantwoordelijke en een aparte ploeg', async () => {
  /*
    "Toegewezen aan" was een rijtje vinkjes waar zowel de verantwoordelijke als
    de ploeg in stond, en bij vijf vinkjes is iedereen verantwoordelijk en dus
    niemand. Nu: één keuzelijst voor wie het dossier draagt, en daarnaast de
    vinkjes voor wie komt werken.
  */
  const page = await tabblad('/events/t-trouw')
  await rustig(page)

  const wie = page.getByLabel('Verantwoordelijk')
  zouden((await wie.count()) === 1, 'er staat geen verantwoordelijke op de fiche')
  zouden(
    (await wie.locator('option:checked').innerText()).includes('Jasper'),
    `de verantwoordelijke klopt niet: ${await wie.locator('option:checked').innerText()}`
  )

  /*
    Er is geen rijtje vinkjes meer om een ploeg aan te duiden — niet op de
    fiche en niet in het personeelsblok. Wie er komt werken staat in AAPI, en
    twee antwoorden op die vraag lopen uit elkaar zodra er maar één bijgewerkt
    wordt.
  */
  const fiche = await page.locator('.je-fiche').innerText()
  zouden(!fiche.includes('Medewerkers'), `de ploeg staat nog op de fiche: ${fiche.slice(0, 300)}`)
  const hele = await inhoud(page)
  zouden(!bevat(hele, 'Medewerkers'), `er is nog een plek om een ploeg aan te duiden: ${hele.slice(0, 600)}`)

  // Zaalpersoneel staat alleen bij de ploeg en nooit bij de verantwoordelijke:
  // zij lezen de bedragen niet eens.
  const keuzes = await wie.locator('option').allInnerTexts()
  zouden(!keuzes.some((k) => k.includes('Lotte')), `personeel staat bij de verantwoordelijken: ${keuzes.join(', ')}`)

  // Verzetten en het blijft er één.
  await wie.selectOption({ label: keuzes.find((k) => k.includes('Elke')) })
  await rustig(page)
  zouden(
    (await wie.locator('option:checked').innerText()).includes('Elke'),
    'de verantwoordelijke is niet verzet'
  )
  zouden(page.fouten.length === 0, `fouten: ${page.fouten[0]}`)
  await page.close()
})

await test('op een eventkaart staat één gezicht: dat van de verantwoordelijke', async () => {
  const page = await tabblad('/?weergave=lijst')
  await rustig(page)
  // De ploeg van dit event is twee man; op de kaart hoort er één te staan.
  // Een rij in de lijstweergave is een <button>, geen <tr>.
  const kaart = page.getByRole('button').filter({ hasText: 'Trouw Niels en Inez' }).first()
  const gezichten = await kaart.locator('.je-avatar').count()
  zouden(gezichten === 1, `er staan ${gezichten} gezichten op de kaart in plaats van één`)
  zouden(page.fouten.length === 0, `fouten: ${page.fouten[0]}`)
  await page.close()
})

await test('de ploeg uit AAPI staat erbij, zonder wat er niet hoort', async () => {
  /*
    De personeelslijst van AAPI draagt van iedereen het rijksregisternummer,
    het rekeningnummer en het thuisadres. Daarvan komt niets mee: het heeft in
    een planningstool geen functie, en elke kopie is er een die ooit ergens
    belandt waar niemand hem gezocht heeft. Wat wél meekomt is waarmee je
    iemand inplant en bereikt.
  */
  const page = await tabblad('/medewerkers')
  await rustig(page)

  const tekst = await inhoud(page)
  zouden(bevat(tekst, 'In dienst volgens AAPI'), `de ploeg uit AAPI staat er niet: ${tekst.slice(0, 400)}`)
  zouden(bevat(tekst, 'Jumana Mhanawi'), 'de namen uit AAPI staan er niet bij')
  // Waarmee je iemand bereikt als hij niet komt opdagen.
  zouden(bevat(tekst, '+32 477'), 'het telefoonnummer staat er niet bij')
  zouden(bevat(tekst, '@example.be'), 'het e-mailadres staat er niet bij')
  zouden(page.fouten.length === 0, `fouten: ${page.fouten[0]}`)
  await page.close()
})

await test('op de medewerkerspagina komt er niemand met de hand bij', async () => {
  /*
    De ploeg komt uit AAPI en nergens anders. Er stond hier ook een lijst met
    wie er in JE Plan een account had, met een uitnodigingsknop erboven — twee
    waarheden over dezelfde vraag, waarvan de bovenste bijna altijd leeg was.
    Wie in dienst is, staat in AAPI; daar hangt de Dimona aan.
  */
  const page = await tabblad('/medewerkers')
  await rustig(page)
  const tekst = await inhoud(page)
  zouden(bevat(tekst, 'Medewerkers'), 'de medewerkerspagina opent niet')

  for (const weg of ['Iemand erbij', 'Uitnodigen', 'In dienst\n', 'Gestopt']) {
    zouden(!bevat(tekst, weg), `"${weg.trim()}" staat er nog: ${tekst.slice(0, 500)}`)
  }
  zouden((await page.getByRole('button', { name: 'Uitnodigen' }).count()) === 0, 'de uitnodigingsknop staat er nog')

  // En geen uurtarieven: dit scherm staat open op een telefoon achter de bar.
  zouden(!/€\s?\d/.test(tekst), `er staan bedragen op de medewerkerspagina: ${tekst.slice(0, 400)}`)
  zouden(page.fouten.length === 0, `fouten: ${page.fouten[0]}`)
  await page.close()
})

await test('een medewerker ziet zijn eigen events, zonder één bedrag', async () => {
  /*
    De gegevens komen uit de kale kopie en niet uit `tasks`: Firestore kan geen
    velden verbergen, dus "hij ziet geen prijzen" kan alleen door hem het event
    helemaal niet te laten lezen. Dat de regels dat ook echt doen, bewaakt de
    rolsweep hieronder; dit kijkt of er dan nog iets bruikbaars overblijft.
  */
  const page = await nieuwePagina(browser, { viewport: { width: 1280, height: 900 } })
  const fouten = []
  page.on('pageerror', (e) => fouten.push(String(e).split('\n')[0]))
  await page.goto(`${adres}/?rol=personeel#/mijn-events`, { waitUntil: 'networkidle' })
  await rustig(page)

  const tekst = (await page.locator('body').innerText()).trim()
  zouden(bevat(tekst, 'Mijn events'), `het scherm opent niet: ${tekst.slice(0, 300)}`)
  zouden(bevat(tekst, 'Blum'), `het event waarop hij staat ontbreekt: ${tekst.slice(0, 500)}`)
  // Wel wat hij moet weten om te komen werken.
  zouden(bevat(tekst, 'gasten'), 'het aantal gasten staat er niet bij')
  // Geen bedragen, en ook niet het event waar hij níét op staat.
  zouden(!/€\s?\d/.test(tekst), `een medewerker ziet een bedrag: ${tekst.slice(0, 400)}`)
  zouden(!bevat(tekst, 'kerstborrel'), 'hij ziet een event waar hij niet op staat')
  zouden(fouten.length === 0, `fouten: ${fouten[0]}`)
  await page.close()
})

await test('op Tasks staat de knop om een taak toe te voegen altijd rechtsboven', async () => {
  // Hij stond er alleen op het bord van één lijst: je moest eerst een lijst
  // kiezen en naar de bordweergave voor je iets kon toevoegen.
  const page = await tabblad('/tasks')
  await rustig(page)
  const knop = page.getByRole('button', { name: /nieuwe taak/i }).first()
  zouden((await knop.count()) > 0, 'er staat geen toevoegknop op de takenlijst')
  await knop.click()
  await rustig(page)
  zouden(bevat(await inhoud(page), 'Titel'), 'het venster om een taak toe te voegen opent niet')
  zouden(page.fouten.length === 0, `fouten: ${page.fouten[0]}`)
  await page.close()
})

await test('een medewerker ziet zijn eigen diensten en boekt zijn eigen uren', async () => {
  /*
    Wat uit AAPI komt staat er alleen om te lezen: zou hij zijn uren hier
    kunnen verzetten, dan staan er twee waarheden over dezelfde dienst en hangt
    er loon aan welke er klopt.
  */
  const page = await nieuwePagina(browser, { viewport: { width: 1280, height: 900 } })
  const fouten = []
  page.on('pageerror', (e) => fouten.push(String(e).split('\n')[0]))
  await page.goto(`${adres}/?rol=personeel#/mijn-events`, { waitUntil: 'networkidle' })
  await page.getByText('Mijn diensten').waitFor({ timeout: 8000 })

  const tekst = (await page.locator('body').innerText()).trim()
  zouden(bevat(tekst, 'Mijn diensten'), `zijn diensten staan er niet: ${tekst.slice(0, 400)}`)
  /*
    En de notitie waarin hij getagd is. Taggen zonder dat de getagde de zin
    kan lezen, is een melding die naar een gesloten deur wijst.
  */
  zouden(bevat(tekst, 'Voor jou'), `wat er tegen hem gezegd is staat er niet: ${tekst.slice(0, 500)}`)
  zouden(bevat(tekst, 'een uur vroeger'), 'de notitie zelf staat er niet bij')
  zouden(bevat(tekst, 'pauze'), 'de uren van zijn dienst staan er niet bij')
  zouden(!/€\s?\d/.test(tekst), `er staat een bedrag op: ${tekst.slice(0, 400)}`)

  // En zijn uren: hij kiest werk uit de events waarop hij staat, niet uit alles.
  await page.goto(`${adres}/?rol=personeel#/uren`, { waitUntil: 'networkidle' })
  await rustig(page)
  const uren = (await page.locator('body').innerText()).trim()
  zouden(bevat(uren, 'Uren'), `het urenscherm opent niet: ${uren.slice(0, 300)}`)
  zouden(!bevat(uren, 'Hele team'), 'een medewerker kan de uren van het team opvragen')

  zouden(fouten.length === 0, `fouten: ${fouten[0]}`)
  await page.close()
})

// ─── 4. Personeel ziet alleen zijn eigen scherm ─────────────────────────────

await test('personeel komt op de dagelijkse lijst en nergens anders', async () => {
  const page = await nieuwePagina(browser, { viewport: { width: 1280, height: 900 } })
  const fouten = []
  page.on('pageerror', (e) => fouten.push(String(e).split('\n')[0]))
  await page.goto(`${adres}/?rol=personeel#/instellingen`, { waitUntil: 'networkidle' })
  await rustig(page)

  const tekst = (await page.locator('body').innerText()).trim()
  zouden(tekst.includes('Openen'), 'personeel ziet de dagelijkse lijst niet')
  zouden(tekst.includes('Uren'), 'personeel kan zijn eigen uren niet boeken')
  /*
    "Uren" staat er sinds de ploeg zijn eigen tijd mag boeken — maar alleen de
    zijne: de regels laten hem de uren van een collega niet zien. De rest
    blijft verboden.
  */
  for (const verboden of ['Instellingen', 'Teamoverleg', 'Social kalender', 'Werklast']) {
    zouden(!tekst.includes(verboden), `personeel ziet "${verboden}"`)
  }
  zouden(fouten.length === 0, `fouten: ${fouten[0]}`)
  await page.close()
})

await test('de socialrol komt op de socials en ziet geen bedragen', async () => {
  const page = await nieuwePagina(browser, { viewport: { width: 1280, height: 900 } })
  const fouten = []
  page.on('pageerror', (e) => fouten.push(String(e).split('\n')[0]))
  await page.goto(`${adres}/?rol=social#/instellingen`, { waitUntil: 'networkidle' })
  await rustig(page)

  const tekst = (await page.locator('body').innerText()).trim()
  zouden(bevat(tekst, 'Socials'), 'de socialrol ziet de socials niet')
  for (const verboden of ['Instellingen', 'Teamoverleg', 'Werklast', 'Klanten', 'Dashboard']) {
    zouden(!tekst.includes(verboden), `de socialrol ziet "${verboden}"`)
  }

  // Het eventbord van de socials opent een eigen paneel: naam, datum, stand en
  // de posts — en geen enkel bedrag. Dat het ook echt niet op te vragen is,
  // staat in firestore.rules; dit kijkt na of het scherm klopt.
  await page.getByText('Blum België — kerstborrel 2025').first().click()
  await rustig(page)
  const paneel = (await page.locator('body').innerText()).trim()
  zouden(bevat(paneel, 'Stand van de content'), `het event opent niet: ${paneel.replace(/\n/g, ' | ').slice(-400)}`)
  zouden(!/€|16\.399|Budget|Offerte/i.test(paneel), `er staat een bedrag op: ${paneel.replace(/\n/g, ' | ').slice(0, 300)}`)

  zouden(fouten.length === 0, `fouten: ${fouten[0]}`)
  await page.close()
})

/*
  ── Geen enkele rol vraagt meer dan ze mag ────────────────────────────────

  De terugkerende fout in dit project: de client vraagt iets op wat
  `firestore.rules` weigert. Dat komt niet terug als een leeg antwoord maar als
  een fout, en die strandt een heel scherm — of, erger, ze wordt opgevangen en
  je houdt een teller over die altijd nul zegt.

  De demo weigerde vroeger niets, dus kon deze test hier niet staan. Sinds
  `demo/regels.js` doet ze dat wel, en houdt ze bij wat er geweigerd werd. Deze
  test loopt elke rol langs elke route en eist dat die lijst leeg blijft. Wat
  een rol mag, staat in `firestore.rules`; dat de demo hetzelfde zegt, bewaakt
  `tests/rollen.test.js`.
*/

const ROLROUTES = [
  '/', '/kalender', '/tasks', '/werklast', '/dashboard', '/meer', '/social',
  '/klanten', '/openen-sluiten', '/registraties', '/overleg', '/uren',
  '/rooster', '/logboek', '/goals', '/instellingen',
  '/medewerkers', '/mijn-events', '/profiel', '/planning',
]

/** Wat de demo weigerde sinds de vorige keer vragen, en de lijst leegmaken. */
const geweigerd = (page) =>
  page.evaluate(() => {
    const lijst = window.__jeGeweigerd ?? []
    window.__jeGeweigerd = []
    return lijst.map((g) => `${g.soort} ${g.collectie}`)
  })

for (const rol of ['owner', 'admin', 'member', 'guest', 'personeel', 'social']) {
  await test(`de rol ${rol} vraagt op geen enkel scherm iets op wat de regels weigeren`, async () => {
    const page = await nieuwePagina(browser, { viewport: { width: 1280, height: 900 } })
    await page.goto(`${adres}/?rol=${rol}#/`, { waitUntil: 'networkidle' })
    await rustig(page)

    const gevonden = new Set(await geweigerd(page))
    for (const route of ROLROUTES) {
      // Binnen dezelfde pagina navigeren: de gegevens blijven staan, en de
      // rolwissel uit boot.js hoeft niet per scherm opnieuw.
      await page.evaluate((r) => { window.location.hash = r }, route)
      await rustig(page)
      for (const g of await geweigerd(page)) gevonden.add(`${route}: ${g}`)
    }

    await page.close()
    zouden(gevonden.size === 0, `geweigerd: ${[...gevonden].join(' · ')}`)
  })
}

await test('de socialrol kan een post openen, koppelen en haar tijd boeken', async () => {
  const page = await nieuwePagina(browser, { viewport: { width: 1280, height: 900 } })
  const fouten = []
  page.on('pageerror', (e) => fouten.push(String(e).split('\n')[0]))
  await page.goto(`${adres}/?rol=social#/social`, { waitUntil: 'networkidle' })
  await rustig(page)

  // De timer in de zijbalk loopt op een event. Stoppen schreef vroeger óók op
  // de taak, in dezelfde batch — en dat mag ze niet, dus ging haar uur verloren.
  await page.getByRole('button', { name: /stop en boek/i }).first().click()
  await rustig(page)
  const naStop = (await page.locator('body').innerText()).trim()
  zouden(!/insufficient permissions/i.test(naStop), `de timer stopt niet: ${naStop.slice(0, 200)}`)
  zouden(
    (await page.getByRole('button', { name: /stop en boek/i }).count()) === 0,
    'de timer loopt nog na het stoppen'
  )

  // Een post openen: geen reactiedraad (die leest ze niet), wel een kiezer die
  // iets teruggeeft — uit de kale kopie, want de taken zelf mag ze niet lezen.
  await page.getByText('Posts', { exact: true }).first().click()
  await rustig(page)
  await page.locator('[class*=je-post], article').first().click()
  await rustig(page)

  const lade = (await page.locator('body').innerText()).trim()
  zouden(!bevat(lade, 'Feedback ('), 'de socialrol krijgt een reactiedraad die ze niet kan lezen')

  await page.getByRole('button', { name: /aan een project hangen|wijzigen/i }).first().click()
  await rustig(page)
  const kiezer = (await page.locator('body').innerText()).trim()
  zouden(bevat(kiezer, 'Blum'), `de projectkiezer blijft leeg: ${kiezer.slice(-300)}`)

  /*
    Eén weigering hoort erbij, en maar één.

    Het stoppen van de timer werkt de teller `trackedSeconds` op de taak bij, en
    dat mag de socialrol niet. Die schrijfbeurt staat sinds vandaag los van het
    boeken zelf en wordt opgevangen (zie `stopTimer`): haar uren komen erdoor,
    alleen de optelsom op de eventfiche loopt achter. Dat is de minst erge van de
    twee fouten, maar het blijft een vraag die de regels weigeren — het echte
    antwoord is die teller door een trigger laten bijhouden in plaats van door de
    browser. Zolang dat niet zo is, staat ze hier met naam genoemd, zodat elke
    andere weigering nog altijd omvalt.
  */
  const afgewezen = await geweigerd(page)
  const onverwacht = afgewezen.filter((g) => g !== 'schrijven tasks')
  zouden(onverwacht.length === 0, `geweigerd: ${onverwacht.join(', ')}`)
  zouden(fouten.length === 0, `fouten: ${fouten[0]}`)
  await page.close()
})

await test('het logboek toont wie wat veranderde, en filtert', async () => {
  const page = await tabblad('/logboek')

  // De periode staat standaard op de lopende kalendermaand, en de demoregels
  // staan een paar dagen voor vandaag. Op de eerste dagen van een maand vallen
  // ze daar dus buiten — terecht, maar dan test je de klok en niet het scherm.
  // Daarom eerst de periode openzetten: wat hier getest wordt is dat de regels
  // er staan en dat het soortfilter werkt.
  await page.getByLabel('Periode').selectOption('')
  await rustig(page)

  const alles = await inhoud(page)
  zouden(bevat(alles, 'offertebedrag'), `de regels staan er niet: ${alles.slice(0, 200)}`)
  zouden(bevat(alles, 'Elke Motmans'), 'wie het deed staat er niet')

  // Op soort filteren laat alleen dat soort staan. Dat is waar het filter voor
  // is: je weet wát er veranderde, niet wanneer.
  await page.getByLabel('Alles').selectOption('formule')
  await rustig(page)
  const alleen = await inhoud(page)
  zouden(bevat(alleen, 'prijs per persoon'), 'de formuleregel staat er niet meer')
  zouden(!bevat(alleen, 'offertebedrag'), 'er staat nog een taakregel bij')

  zouden(page.fouten.length === 0, `fouten: ${page.fouten[0]}`)
  await page.close()
})

await test('het overzicht zegt in één blik hoe een event ervoor staat', async () => {
  const page = await tabblad('/events/t-trouw')

  // Het overzicht is het eerste tabblad: wie een event opent, wil weten of
  // het dossier in orde is voor hij naar de taken kijkt.
  const tekst = await inhoud(page)
  zouden(bevat(tekst, 'dagen te gaan'), `het aftellen staat er niet: ${tekst.slice(0, 200)}`)
  zouden(bevat(tekst, 'Gasten'), 'de kaarten staan er niet')
  zouden(bevat(tekst, 'Waar staat het'), 'de pijplijn staat er niet als tijdlijn')

  // De stappenbalk met negen knoppen is weg; voor- en achteruit staat in de
  // kop. Beide knoppen moeten er zijn, want terugzetten kon tot nu niet.
  zouden(bevat(tekst, 'Vorige'), 'de knop om een stap terug te gaan ontbreekt')

  /*
    Wat er mist, staat ingeklapt: één rode regel met een teller. Uitgeklapt
    waren het vijf zinnen bovenaan het scherm, en vijf zinnen lees je één keer
    — daarna scroll je eroverheen en is de waarschuwing meubilair.
  */
  const aandacht = page.locator('.je-overzicht__aandacht')
  const kop = aandacht.locator('.je-aandachtkop')
  zouden(/\d+ (ding vraagt|dingen vragen) aandacht/.test(await kop.innerText()), `de teller staat er niet: ${await kop.innerText()}`)
  zouden(!(await aandacht.locator('li').first().isVisible()), 'de opsomming staat open in plaats van ingeklapt')

  await kop.click()
  await rustig(page)
  zouden(await aandacht.locator('li').first().isVisible(), 'de opsomming komt niet open bij een klik')

  // Een kaart brengt je naar het tabblad waar je er iets aan kunt doen.
  await page.getByRole('button', { name: /Taken/ }).first().click()
  await rustig(page)
  zouden(bevat(await inhoud(page), 'Drankenlijst'), 'de kaart opent het takentabblad niet')

  zouden(page.fouten.length === 0, `fouten: ${page.fouten[0]}`)
  await page.close()
})

await test('de offerte is een conceptvoorstel met pagina\'s', async () => {
  const page = await tabblad('/events/t-trouw?tab=offerte')

  const tekst = await inhoud(page)
  zouden(bevat(tekst, 'Voorstel op maat'), `de cover staat er niet: ${tekst.slice(0, 200)}`)
  zouden(bevat(tekst, 'Wie zijn'), 'de pagina over JE Concept staat er niet')
  zouden(bevat(tekst, 'Dit voorstel in één oogopslag'), 'het overzicht van de onderdelen ontbreekt')
  zouden(bevat(tekst, 'Walking'), 'het onderdeel uit de offerte staat niet op het blad')

  // De prijs van de ontvangst staat op het onderdeel zelf (€ 6,00); die van
  // het walking dinner komt uit de offerteregels (€ 82,00). Allebei moeten ze
  // op het blad staan, anders klopt de koppeling met de tabel niet.
  zouden(bevat(tekst, '6,00'), 'de eigen prijs van de ontvangst staat er niet')
  zouden(bevat(tekst, '82,00'), 'de prijs uit de offerteregels staat er niet')

  // En de tabel met de btw staat er nog altijd achteraan.
  zouden(bevat(tekst, '12%') && bevat(tekst, '21%'), 'de btw-tabel ontbreekt')

  zouden(page.fouten.length === 0, `fouten: ${page.fouten[0]}`)
  await page.close()
})

await test('werk dat vanzelf terugkomt staat in de instellingen', async () => {
  const page = await tabblad('/instellingen?tab=herhalingen')

  // De titels staan in invoervelden en dus niet in de tekst van de pagina;
  // net als op de eventfiche lees je ze uit het veld zelf.
  const titels = await page.locator('.je-herhaling').getByLabel('Titel').evaluateAll((velden) =>
    velden.map((v) => v.value)
  )
  zouden(titels.some((t) => t.includes('eBox')), `de wekelijkse herhaling staat er niet: ${titels.join(' | ')}`)
  zouden(titels.some((t) => t.includes('JE Nieuwsbrief')), 'de maandelijkse herhaling staat er niet')

  const tekst = await inhoud(page)
  // Zonder "volgende keer" kan niemand nakijken of hij het goed ingesteld
  // heeft; dat is waar het scherm voor bestaat.
  zouden(bevat(tekst, 'volgende keer'), 'er staat niet bij wanneer ze de volgende keer valt')

  zouden(page.fouten.length === 0, `fouten: ${page.fouten[0]}`)
  await page.close()
})

await test('de locatie staat op de fiche, met een link naar de kaart', async () => {
  const page = await tabblad('/events/t-trouw')

  const plek = await veldwaarde(page, 'Locatie')
  zouden(bevat(plek, 'Hoeve Vanhove'), `de locatie staat niet op de fiche: ${plek}`)

  // De link opent de gekozen plek en niet de eerste de beste zaal met die naam.
  const kaart = page.getByRole('link', { name: /Op de kaart|On the map/i }).first()
  const href = await kaart.getAttribute('href')
  zouden(href?.includes('google.com/maps'), `de kaartlink wijst nergens heen: ${href}`)
  zouden(href?.includes('query_place_id='), `de link kent de plek niet: ${href}`)

  // En zonder Google-sleutel blijft het veld doen wat het altijd deed: typen.
  await veld(page, 'Locatie').fill('Schuur achteraan, Kortessem')
  await veld(page, 'Locatie').blur()
  await rustig(page)
  zouden(
    bevat(await veldwaarde(page, 'Locatie'), 'Schuur achteraan'),
    'de getypte locatie werd niet bewaard'
  )

  zouden(page.fouten.length === 0, `fouten: ${page.fouten[0]}`)
  await page.close()
})

await test('de offerte staat er vanzelf en is regel voor regel aan te passen', async () => {
  const page = await tabblad('/events/t-trouw?tab=offerte')
  await rustig(page)

  // Niemand hoeft hem aan te maken: een offerte die je eerst moet aanmaken,
  // wordt een offerte die je vergeet.
  const blad = page.locator('.je-offerteblad')
  zouden(await blad.isVisible(), 'er staat geen offerte')

  const werk = page.locator('.je-offertewerk')
  const regels = await werk.locator('tbody tr').count()
  zouden(regels >= 2, `de offerte heeft te weinig regels: ${regels}`)

  // De 70/30-splitsing: spijzen aan 12%, dranken aan 21%. Eén tarief op alles
  // is precies de fout die in de oude Canva-offertes gemaakt werd.
  const bladtekst = await blad.innerText()
  zouden(bevat(bladtekst, '12%'), `geen spijzenlijn aan 12%: ${bladtekst.slice(0, 400)}`)
  zouden(bevat(bladtekst, '21%'), 'geen drankenlijn aan 21%')
  zouden(bevat(bladtekst, 'Trouw Niels en Inez'), 'het event staat niet op het blad')
  zouden(bevat(bladtekst, 'Voorschot') || bevat(bladtekst, 'voorschot'), 'het voorschot staat er niet bij')

  // Aanpassen na het genereren: dat is het punt van een draft.
  const omschrijving = werk.getByLabel('Omschrijving').first()
  await omschrijving.fill('Winterbarbecue, all-in per persoon')
  await omschrijving.blur()
  await rustig(page)
  zouden(
    bevat(await blad.innerText(), 'Winterbarbecue, all-in'),
    'de aangepaste regel staat niet op het blad'
  )

  zouden(page.fouten.length === 0, `fouten: ${page.fouten[0]}`)
  await page.close()
})

await test('een bord met weinig kolommen vult de rij en schuift niet', async () => {
  const page = await tabblad('/social', { breedte: 1440 })
  await rustig(page)

  const rij = page.locator('.je-kanban').first()
  const schuift = await rij.evaluate((el) => el.scrollWidth - el.clientWidth)
  zouden(schuift === 0, `de drie kolommen passen niet: ${schuift}px te veel`)

  const kolommen = await page.locator('.je-kanbankolom').all()
  zouden(kolommen.length === 3, `niet drie kolommen maar ${kolommen.length}`)
  const breedtes = []
  for (const k of kolommen) breedtes.push(Math.round((await k.boundingBox()).width))
  // Samen vullen ze de rij: geen halfleeg scherm naast drie smalle kolommen.
  const samen = breedtes.reduce((a, b) => a + b, 0)
  const beschikbaar = await rij.evaluate((el) => el.clientWidth)
  zouden(samen > beschikbaar - 100, `de kolommen vullen de rij niet: ${samen} van ${beschikbaar}`)

  // En een bord met negen kolommen blijft wél schuiven: die passen nergens op.
  await page.goto(`${adres}/#/bord/l-overview`, { waitUntil: 'networkidle' })
  await rustig(page)
  const breed = await page.locator('.je-kanban').first().evaluate((el) => el.scrollWidth - el.clientWidth)
  zouden(breed > 0, 'het takenbord van negen kolommen schuift niet meer')

  zouden(page.fouten.length === 0, `fouten: ${page.fouten[0]}`)
  await page.close()
})

await test('het systeemscherm zegt of de tool zelf nog draait', async () => {
  const page = await tabblad('/instellingen?tab=systeem')
  await rustig(page)
  await page.getByRole('tab', { name: 'Systeem' }).click()
  await rustig(page)

  const tekst = await inhoud(page)
  // De ophaler draaide net: dat hoort er als tijdstip te staan en niet als
  // "STATUS: OK".
  zouden(bevat(tekst, 'Laatst binnengehaald'), `de stand van de ophaler staat er niet: ${tekst.slice(-400)}`)
  // En de mail die niet vertrok, met de reden erbij — die stond tot nu
  // nergens op een scherm.
  zouden(bevat(tekst, 'niet vertrokken'), 'de mislukte mail wordt niet gemeld')
  zouden(bevat(tekst, 'Username and Password not accepted'), 'de reden staat er niet bij')

  zouden(page.fouten.length === 0, `fouten: ${page.fouten[0]}`)
  await page.close()
})

await test('de klant opent zijn offerte zonder account en kan ze goedkeuren', async () => {
  const page = await tabblad('/offerte/demo-offerte-token-niels')
  await rustig(page)

  const tekst = await inhoud(page)
  // Geen aanmeldscherm: een offerte goedkeuren mag geen account kosten.
  zouden(!bevat(tekst, 'Aanmelden') && !bevat(tekst, 'Wachtwoord'), 'de klant krijgt een inlogscherm')
  // Persoonlijk: bij naam, met de afspraak erbij zoals wij ze begrepen hebben.
  zouden(bevat(tekst, 'Dag Inez'), `geen persoonlijke aanhef: ${tekst.slice(0, 200)}`)
  zouden(bevat(tekst, 'Trouw Niels en Inez'), 'het event staat er niet bij')
  zouden(bevat(tekst, 'Hoeve Vanhove'), 'de locatie staat er niet bij')
  zouden(bevat(tekst, '140 personen'), 'het aantal personen staat er niet bij')
  // Het blad zelf, met de twee tarieven.
  zouden(bevat(tekst, '12%') && bevat(tekst, '21%'), 'de btw-lijnen staan niet op het blad')
  // En één naam om op terug te vallen.
  zouden(bevat(tekst, 'Jasper'), 'er staat geen aanspreekpunt op')

  await page.getByRole('button', { name: /Ja, hiermee akkoord/i }).click()
  await rustig(page)
  zouden(bevat(await inhoud(page), 'Afgesproken'), 'goedkeuren gaf geen bevestiging')

  zouden(page.fouten.length === 0, `fouten: ${page.fouten[0]}`)
  await page.close()
})

await test('een klant volgt al zijn dossiers op één pagina', async () => {
  const page = await tabblad('/klant/demo-klant-token-nielsinez')
  await rustig(page)

  const tekst = await inhoud(page)
  zouden(bevat(tekst, 'Niels & Inez'), `het portaal opende niet: ${tekst.slice(0, 200)}`)
  zouden(bevat(tekst, 'Trouw Niels en Inez'), 'het dossier staat er niet bij')
  // De stand in woorden die een klant iets zeggen, niet onze pijplijnnamen.
  zouden(!bevat(tekst, 'create offer') && !bevat(tekst, 'planning ongoing'), 'onze pijplijnnamen lekken naar de klant')
  zouden(bevat(tekst, 'offerte 2026-014'), 'de offerte is niet te openen vanaf het portaal')

  zouden(page.fouten.length === 0, `fouten: ${page.fouten[0]}`)
  await page.close()
})

await test('de mailwisseling staat op het event', async () => {
  const page = await tabblad('/events/t-trouw?tab=mail')
  await rustig(page)

  const draad = await page.locator('.je-maildraad').innerText()
  zouden(bevat(draad, 'bredere dansvloer'), `de vraag van de klant staat er niet: ${draad.slice(0, 200)}`)
  // In én uit, op volgorde: wat wij antwoordden hoort er ook bij te staan.
  zouden(bevat(draad, '6 op 6 meter'), 'het antwoord van het team staat er niet')
  zouden(page.locator('.je-mail[data-uit]').first() !== null, 'uitgaande post is niet als zodanig te zien')

  zouden(page.fouten.length === 0, `fouten: ${page.fouten[0]}`)
  await page.close()
})

await test('post die nergens bij hoort wordt een event in één klik', async () => {
  const page = await tabblad('/aanvragen')
  await rustig(page)

  const postvak = await inhoud(page)
  zouden(bevat(postvak, 'Kristien Maris'), `de aanvraag staat niet in het postvak: ${postvak.slice(0, 300)}`)
  // Wat er uit de mail te lezen valt, staat er meteen bij — anders moet je de
  // hele tekst nog eens doorlezen voor je iets kan aanmaken.
  zouden(bevat(postvak, '40 pax'), 'het aantal gasten werd niet gelezen')
  zouden(bevat(postvak, 'Winter BBQ'), 'de formule werd niet herkend')
  zouden(bevat(postvak, 'Richtprijzen'), 'de vraag om prijzen staat er niet bij')

  await page.getByRole('button', { name: 'Event aanmaken' }).first().click()
  await rustig(page)

  const fiche = await inhoud(page)
  zouden(bevat(fiche, 'Kristien Maris'), `het event opende niet: ${fiche.slice(0, 200)}`)
  zouden((await veldwaarde(page, 'Gasten')) === '40', 'het aantal gasten staat niet op de fiche')

  // En de mail hangt nu aan dat event in plaats van in het postvak.
  await page.getByRole('tab', { name: 'Mail' }).click()
  await rustig(page)
  zouden(bevat(await inhoud(page), 'winterbarbecue'), 'de aanvraag hangt niet aan het nieuwe event')

  zouden(page.fouten.length === 0, `fouten: ${page.fouten[0]}`)
  await page.close()
})

await test('een aanvraagmail wordt een event met datum, gasten en formule', async () => {
  const page = await tabblad('/')
  await page.getByRole('button', { name: 'Nieuw event' }).click()
  await page.getByRole('tab', { name: 'Uit een mail' }).click()
  await rustig(page)

  await page.getByLabel('De mail van de klant').fill(
    [
      'Beste,',
      '',
      'Mijn mama wordt op zaterdag 28 november 65 jaar en we zouden dit graag vieren.',
      'We denken aan een 40-tal personen en dachten aan een gezellige winterbarbecue.',
      'Werken jullie met vaste formules? We ontvangen graag wat richtprijzen.',
      '',
      'met vriendelijke groet,',
      '',
      'Kristien Maris',
    ].join('\n')
  )
  await rustig(page)

  const dialoog = page.getByRole('dialog')
  const gelezen = await dialoog.innerText()
  // Veertig gasten, niet vijfenzestig: de leeftijd mag geen aantal worden.
  zouden(bevat(gelezen, '40 pax'), `het aantal gasten werd niet gelezen: ${gelezen.slice(0, 400)}`)
  zouden(bevat(gelezen, 'Verjaardag'), 'het soort feest werd niet gelezen')
  zouden(bevat(gelezen, 'Winter BBQ'), 'de formule werd niet herkend')
  zouden(bevat(gelezen, 'Richtprijzen'), 'de vraag om prijzen staat er niet bij')
  // Wat geraden is, staat er als geraden bij.
  zouden(bevat(gelezen, 'geraden'), 'er staat niet bij wat een gok was')

  zouden(
    (await dialoog.locator('input[type=date]').inputValue()).endsWith('-11-28'),
    `de datum werd niet overgenomen: ${await dialoog.locator('input[type=date]').inputValue()}`
  )

  await dialoog.getByRole('button', { name: 'Event aanmaken' }).click()
  await rustig(page)

  const fiche = await inhoud(page)
  zouden(bevat(fiche, 'Kristien Maris'), `het event opende niet: ${fiche.slice(0, 200)}`)
  // De mail blijft bij het dossier staan in plaats van in iemands mailbox.
  zouden(
    bevat(await page.getByLabel('Omschrijving').inputValue(), 'winterbarbecue'),
    'de mail staat niet als omschrijving op het event'
  )
  zouden((await veldwaarde(page, 'Gasten')) === '40', 'het aantal gasten staat niet op de fiche')

  zouden(page.fouten.length === 0, `fouten: ${page.fouten[0]}`)
  await page.close()
})

await test('de planningstand staat op het event en in elk overzicht', async () => {
  const page = await tabblad('/events/t-trouw')

  // Op de fiche kies je hem; een pop-up komt er niet aan te pas.
  const keuze = page.getByLabel('Planning', { exact: true }).first()
  zouden((await keuze.inputValue()) === 'bezig', `de stand staat niet op de fiche: ${await keuze.inputValue()}`)
  await keuze.selectOption('rond')
  await rustig(page)
  zouden(bevat(await inhoud(page), 'Rond'), 'de badge in de kop volgt de keuze niet')

  // En in de overzichten: de lijst en het bord tonen dezelfde badge.
  await page.goto(`${adres}/#/?weergave=lijst`, { waitUntil: 'networkidle' })
  await rustig(page)
  zouden(bevat(await inhoud(page), 'Nog te plannen'), 'de lijst toont de planningstand niet')

  await page.goto(`${adres}/#/?weergave=bord`, { waitUntil: 'networkidle' })
  await rustig(page)
  zouden(bevat(await inhoud(page), 'Nog te plannen'), 'het bord toont de planningstand niet')

  // Filteren op de stand houdt over wat die stand heeft.
  await page.getByLabel('Planning', { exact: true }).first().selectOption('te_plannen')
  await rustig(page)
  // Alleen het bord zelf: in de zijbalk staat de lopende timer, en die noemt
  // het event waar hij bij hoort.
  const gefilterd = await page.locator('.je-pagebody').innerText()
  zouden(bevat(gefilterd, 'Jolien'), 'het gefilterde event staat er niet meer')
  zouden(!bevat(gefilterd, 'Trouw Niels'), 'er staat een event bij dat een andere stand heeft')

  zouden(page.fouten.length === 0, `fouten: ${page.fouten[0]}`)
  await page.close()
})

await test('een event verwijderen zegt eerst wat er weggaat', async () => {
  const page = await tabblad('/events/t-jolien')

  await page.getByRole('button', { name: /^Verwijderen$/ }).click()
  const venster = page.getByRole('dialog', { name: 'Zeker weten?' })
  await venster.waitFor()
  const vraag = await venster.innerText()
  await venster.getByRole('button', { name: /^Verwijderen$/ }).click()
  await rustig(page)

  zouden(bevat(vraag, 'definitief verwijderen'), `geen vraag voor het verwijderen: ${vraag}`)
  zouden(bevat(vraag, 'Archiveren bewaart alles'), 'de vraag zegt niet dat archiveren het alternatief is')

  // En het dossier is echt weg, niet alleen uit beeld.
  await page.goto(`${adres}/#/events/t-jolien`, { waitUntil: 'networkidle' })
  await rustig(page)
  zouden(bevat(await inhoud(page), 'bestaat niet'), 'het event bestaat nog')
  zouden(page.fouten.length === 0, `fouten: ${page.fouten[0]}`)
  await page.close()
})

await test('een veld op de fiche pas je aan waar het staat', async () => {
  // Geen potlood, geen venster, geen bewaarknop: verder klikken is bewaren.
  const page = await tabblad('/events/t-trouw')

  await veld(page, 'Gasten').fill('145')
  await veld(page, 'Gasten').blur()
  await rustig(page)

  // En het staat er nog na het verlaten van de pagina — anders was het alleen
  // in het scherm veranderd.
  await page.goto(`${adres}/#/`, { waitUntil: 'networkidle' })
  await rustig(page)
  await page.goto(`${adres}/#/events/t-trouw`, { waitUntil: 'networkidle' })
  await rustig(page)
  zouden((await veldwaarde(page, 'Gasten')) === '145', `het aantal gasten werd niet bewaard: ${await veldwaarde(page, 'Gasten')}`)

  // De omschrijving staat midden op de pagina en niet meer achter een tabblad.
  const omschrijving = page.getByLabel('Omschrijving')
  zouden(await omschrijving.isVisible(), 'de omschrijving staat niet op de pagina')
  zouden(bevat(await omschrijving.inputValue(), 'Fiche evenement'), 'het dossier staat niet in de omschrijving')

  zouden(page.fouten.length === 0, `fouten: ${page.fouten[0]}`)
  await page.close()
})

await test('met @ spreek je iemand aan in een notitie', async () => {
  const page = await tabblad('/events/t-trouw')
  const kolom = page.getByLabel('Notities')
  const schrijf = kolom.getByRole('textbox')

  await schrijf.fill('Kun jij dit bekijken @elke')
  await rustig(page)
  const lijst = kolom.getByRole('listbox')
  zouden(await lijst.isVisible(), 'er wordt niemand voorgesteld bij @')
  await lijst.getByRole('option').first().click()
  await rustig(page)

  /*
    In het veld staat gewone tekst, en niet de markering. Die stond hier
    vroeger wel, en dan zag wie iemand aansprak
    `@[Elke Motmans](spdwOygRumebHf…)` in zijn eigen zin staan. De pil erachter
    toont wélk stuk een vermelding is.
  */
  const getypt = await schrijf.inputValue()
  zouden(getypt.includes('@Elke Motmans'), `de naam staat niet in de tekst: ${getypt}`)
  zouden(!getypt.includes('@['), `de markering staat nog in het veld: ${getypt}`)
  zouden(!/u-elke|\(spdw/.test(getypt), `er staat een id in het veld: ${getypt}`)
  zouden(
    (await kolom.locator('.je-vermeldpil').count()) === 1,
    'de naam krijgt geen pil in het schrijfvak'
  )
  zouden(
    (await kolom.locator('.je-vermeldpil').innerText()) === '@Elke Motmans',
    `de pil staat om de verkeerde tekst: ${await kolom.locator('.je-vermeldpil').innerText()}`
  )

  await kolom.getByRole('button', { name: /Bewaren|Save/i }).click()
  await rustig(page)

  const draad = await kolom.innerText()
  zouden(draad.includes('@Elke Motmans'), `de naam staat niet in de notitie: ${draad.slice(-200)}`)
  zouden(!draad.includes('u-elke'), 'de markering lekt naar het scherm')
  zouden(page.fouten.length === 0, `fouten: ${page.fouten[0]}`)
  await page.close()
})

await test('een link in een notitie krijgt een kaartje', async () => {
  /*
    Zoals Facebook en Slack het doen. Het ophalen gebeurt op de server — een
    browser mag een vreemde site niet lezen — en in de demo komt het uit een
    stub: een demo die een echte site ophaalt, gaat zonder internet stuk en
    meldt elke bezoeker aan bij iemand anders' server.
  */
  const page = await tabblad('/events/t-trouw')
  await rustig(page)
  const kolom = page.getByLabel('Notities')

  // De link zelf is aanklikbaar, en opent in een nieuw tabblad.
  const link = kolom.getByRole('link', { name: 'https://hoeve-vanhove.be/zalen' })
  zouden((await link.count()) === 1, 'de link is geen link geworden')
  zouden((await link.getAttribute('rel'))?.includes('noopener'), 'de link mist noopener')
  // Het sluithaakje van de zin hoort niet bij het adres.
  zouden(!(await link.getAttribute('href')).includes(')'), 'het haakje van de zin zit in de link')

  const kaart = kolom.locator('.je-linkkaart')
  zouden((await kaart.count()) === 1, 'er staat geen voorbeeldkaartje onder de notitie')
  const tekst = await kaart.innerText()
  zouden(tekst.includes('Hoeve Vanhove'), `de titel staat niet op het kaartje: ${tekst}`)
  zouden(tekst.includes('Borgloon'), `de omschrijving staat niet op het kaartje: ${tekst}`)
  zouden(page.fouten.length === 0, `fouten: ${page.fouten[0]}`)
  await page.close()
})

await test('de notities staan naast het event en zijn het gesprek', async () => {
  const page = await tabblad('/events/t-trouw')

  // Zonder ergens op te klikken: dat is het punt van een kolom naast het werk.
  // Een tabblad open je pas wanneer je al weet dat er iets staat.
  const kolom = page.getByLabel('Notities')
  zouden(await kolom.isVisible(), 'de notitiekolom staat er niet')

  const bericht = `Tent komt een dag vroeger — ${Date.now()}`
  await kolom.getByRole('textbox').fill(bericht)
  await kolom.getByRole('button', { name: /Bewaren|Save/i }).click()
  await rustig(page)

  zouden(bevat(await kolom.innerText(), bericht), 'de notitie staat er niet bij')
  zouden(page.fouten.length === 0, `fouten: ${page.fouten[0]}`)
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

// ─── 6. Zonder verbinding ───────────────────────────────────────────────────

await test('de schil van deze build staat compleet in version.json', async () => {
  // De service worker staat als los bestand in public/ en kent de gehashte
  // bestandsnamen niet; hij leest ze hier. Ontbreekt deze lijst, dan opent de
  // app in de koelcel niet en merkt niemand dat tot het misgaat.
  const page = await tabblad('/')
  const versie = await page.evaluate(async () => (await fetch('/version.json', { cache: 'no-store' })).json())

  zouden(versie.build, 'het buildnummer ontbreekt')
  zouden(Array.isArray(versie.schil) && versie.schil.length >= 4, `de schil ontbreekt: ${JSON.stringify(versie)}`)
  zouden(versie.schil.includes('index.html'), 'de pagina zelf staat niet in de schil')
  zouden(versie.schil.some((n) => n.endsWith('.css')), 'de stijlen staan niet in de schil')
  zouden(
    versie.schil.some((n) => /assets\/Checklists-.*\.js$/.test(n)),
    `de dagelijkse lijsten staan niet in de schil: ${versie.schil.join(', ')}`
  )

  // En elk van die namen bestaat ook echt. De testserver valt voor onbekende
  // paden terug op index.html, dus een naam die nergens op slaat zou anders
  // stilletjes "goed" lijken.
  for (const naam of versie.schil.filter((n) => n !== 'index.html')) {
    const echt = await page.evaluate(async (n) => {
      const res = await fetch(`/${n}`)
      return res.ok && !(await res.text()).includes('<div id="root">')
    }, naam)
    zouden(echt, `"${naam}" staat in de schil maar bestaat niet`)
  }
  await page.close()
})

await test('de schil sleept mee wat hij zelf nog nodig heeft', async () => {
  /*
    Een bestandsnaam in de schil zetten is niet genoeg: het bestand van een
    scherm haalt zelf nog bestanden op. `Checklists` stond erin, maar de twee
    stukken die het scherm statisch binnenhaalt — de herhaalregels en de
    paginakop — niet. Wie de app installeerde en daarna de koelcel in liep
    zonder dat scherm ooit geopend te hebben, kreeg het dus niet open: precies
    het ene scherm dat het zonder verbinding móét doen.

    Dit rekent na dat de lijst dichtloopt: alles wat een bestand uit de schil
    statisch nodig heeft, staat er ook in.
  */
  const { schil } = JSON.parse(readFileSync(join(root, 'version.json'), 'utf8'))
  const inSchil = new Set(schil)

  for (const naam of schil.filter((n) => n.endsWith('.js'))) {
    const code = readFileSync(join(root, naam), 'utf8')
    // Rollup schrijft statische imports als `from"./x.js"` of `import"./x.js"`;
    // een dynamische heeft een haakje en valt hier dus buiten — terecht, die
    // wordt pas opgehaald als iemand iets doet.
    for (const [, pad] of code.matchAll(/(?:from|import)\s*"(\.\/[^"]+\.js)"/g)) {
      const erbij = `assets/${pad.replace('./', '')}`
      zouden(inSchil.has(erbij), `${naam} heeft ${erbij} nodig, maar dat staat niet in de schil`)
    }
  }
})

await test('zonder verbinding kun je verder afvinken en zie je dat het nog niet weg is', async () => {
  // Waar de hele oefening om draait. De keuken en de koelcel hebben één
  // streepje bereik; wie daar afvinkt moet dat kunnen, en moet zien dat het
  // nog niet doorgestuurd is. Zwijgen is hier het ergste: dan sluit iemand de
  // app en staat er de volgende ochtend een halve lijst.
  const page = await tabblad('/openen-sluiten')
  await page.context().setOffline(true)
  await rustig(page)

  zouden(bevat(await inhoud(page), 'Geen verbinding'), 'de app zegt niet dat er geen verbinding is')

  const vakjes = page.locator('input[type=checkbox]')
  const voor = await vakjes.evaluateAll((els) => els.filter((e) => e.checked).length)
  await vakjes.nth(await vakjes.evaluateAll((els) => els.findIndex((e) => !e.checked))).check()
  await rustig(page)

  const na = await vakjes.evaluateAll((els) => els.filter((e) => e.checked).length)
  zouden(na === voor + 1, `offline afvinken lukte niet: ${voor} → ${na}`)

  const tekst = await inhoud(page)
  zouden(bevat(tekst, 'Nog op dit toestel'), 'er staat niet dat het vinkje nog op dit toestel staat')
  zouden(bevat(tekst, 'wijziging'), `de balk noemt niet wat er openstaat: ${tekst.slice(0, 300)}`)

  // En zodra er weer bereik is, gaat het mee en houdt de app erover op.
  await page.context().setOffline(false)
  await rustig(page)
  const daarna = await inhoud(page)
  zouden(!bevat(daarna, 'Geen verbinding'), 'de melding bleef staan na het terugkeren')
  zouden(!bevat(daarna, 'Nog op dit toestel'), 'het merkje bleef staan na het terugkeren')
  zouden(
    (await vakjes.evaluateAll((els) => els.filter((e) => e.checked).length)) === voor + 1,
    'het vinkje van tijdens de onderbreking is verdwenen'
  )
  await page.close()
})

// ─── 7. Snelheid, als vangrail ──────────────────────────────────────────────

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

// ─── 8. De melding "er staat een nieuwe versie klaar" ───────────────────────

/*
  Deze keten is één keer helemaal stukgegaan zonder dat iemand het merkte.

  De app vergelijkt `__BUILD_ID__` uit de bundel met `build` uit version.json.
  Die twee werden allebei apart in vite.config.js berekend met `Date.now()` —
  dus bij elke build die zonder BUILD_ID in de omgeving draait (en dat doet
  `npm run deploy`) scheelden ze de bouwtijd, een seconde of acht. Gevolg: de
  balk stond bij iedereen, altijd, en herladen hielp niet. Een melding die
  altijd staat, is geen melding meer.

  Daarom hier twee kanten op getest: hij blijft weg als er niets is, en hij komt
  als er wél iets is.
*/

/** Eén ronde van de versiecontrole afdwingen, zonder een kwartier te wachten. */
const kijkNaarVersie = async (page) => {
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
  await rustig(page)
}

await test('de versiemelding blijft weg zolang er niets nieuws uitgerold is', async () => {
  const page = await tabblad('/')
  await kijkNaarVersie(page)
  const tekst = await inhoud(page)
  zouden(
    !bevat(tekst, 'nieuwe versie'),
    'de app meldt een nieuwe versie terwijl er dezelfde build draait — vergelijk __BUILD_ID__ met version.json'
  )
  await page.close()
})

await test('en komt er wél zodra er een andere build op de server staat', async () => {
  const page = await tabblad('/')
  await page.route('**/version.json', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ build: 'een-latere-build', demo: true, schil: [] }),
    })
  )
  await kijkNaarVersie(page)
  zouden(
    bevat(await inhoud(page), 'nieuwe versie'),
    'er staat een andere build op de server en de app zegt er niets over'
  )
  await page.close()
})

await test('het wachtscherm uit index.html wordt door de app vervangen', async () => {
  // Het staat binnen #root en hoort dus weg te zijn zodra React getekend heeft.
  // Blijft het staan, dan kijkt iedereen naar een molentje dat nooit stopt.
  const page = await tabblad('/')
  zouden((await page.locator('.je-start').count()) === 0, 'het wachtscherm van index.html bleef staan')
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
