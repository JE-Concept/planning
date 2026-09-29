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
  ['Rooster', '/rooster', 'Rooster'],
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

await test('de weekweergave toont per kanaal wat er die week uitgaat', async () => {
  const page = await tabblad('/social')
  await page.getByRole('tab', { name: 'Week' }).click()
  await page.waitForTimeout(900)
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
  await page.waitForTimeout(900)
  await page.getByRole('button', { name: /Blum 20 jaar/ }).first().click()
  await page.waitForTimeout(900)

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
  zouden(bevat(tekst, 'Bijlagen bij dit event'), 'de bijlagen ontbreken')

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

await test('een besproken agendapunt wordt in één handeling een taak', async () => {
  // Wat op een overleg afgesproken wordt, gebeurt pas wanneer het ergens staat
  // met een naam en een datum erbij. Eerder eindigde een punt bij "Besproken".
  const page = await tabblad('/overleg')
  await page.getByRole('button', { name: 'Besproken' }).first().click()
  await page.waitForTimeout(700)

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
  await page.waitForTimeout(1200)

  // Het punt is van de agenda af, en bij het besprokene staat dat er werk uit
  // kwam — anders is "besproken" niet te onderscheiden van "besproken en vergeten".
  const na = await inhoud(page)
  zouden(!bevat(na, 'Prijzen verhuurmateriaal herzien'), 'het punt staat nog op de open agenda')
  await page.getByRole('button', { name: /Al besproken/ }).click()
  await page.waitForTimeout(600)
  const besproken = await inhoud(page)
  zouden(bevat(besproken, 'Prijzen verhuurmateriaal'), 'het punt staat niet bij het besprokene')
  zouden(bevat(besproken, 'taak aangemaakt'), 'er staat niet bij dat er een taak uit kwam')

  // En de taak staat echt op het takenbord. Klikken en niet herladen: de
  // demodatabase leeft in het tabblad, dus een herlaadbeurt zou alleen bewijzen
  // dat de voorbeeldgegevens er nog staan.
  await page.getByLabel('Hoofdnavigatie').getByRole('link', { name: /^Tasks/ }).first().click()
  await page.waitForTimeout(1400)
  const bord = await inhoud(page)
  zouden(bevat(bord, 'Tarieven verhuurmateriaal +8%'), `de taak staat niet op het bord: ${bord.slice(0, 250)}`)
  zouden(page.fouten.length === 0, `fouten: ${page.fouten[0]}`)
  await page.close()
})

await test('de verslagen zijn doorzoekbaar, tot in de actiepunten', async () => {
  const page = await tabblad('/overleg')
  await page.getByRole('tab', { name: 'Verslagen' }).click()
  await page.waitForTimeout(800)
  const alles = await inhoud(page)
  zouden(bevat(alles, 'Weekstart events'), 'de verslagen staan er niet')
  zouden(bevat(alles, 'Maandoverleg bistro'), 'het tweede verslag staat er niet')

  const veld = page.getByLabel('Zoek in de verslagen')
  await veld.fill('winterkaart')
  await page.waitForTimeout(600)
  const een = await inhoud(page)
  zouden(bevat(een, 'Maandoverleg bistro'), 'het verslag met dat woord is weggefilterd')
  zouden(!bevat(een, 'Weekstart events'), 'er wordt niet gefilterd')

  // En het woord dat alleen in een actiepunt staat, vindt zijn verslag terug.
  await veld.fill('doorsturen')
  await page.waitForTimeout(600)
  const via = await inhoud(page)
  zouden(bevat(via, 'Weekstart events'), 'een woord uit een actiepunt vindt zijn verslag niet')
  zouden(bevat(via, 'actiepunt'), 'er staat niet bij waarom dit verslag gevonden werd')

  await veld.fill('kerstmarkt borgloon')
  await page.waitForTimeout(600)
  zouden(bevat(await inhoud(page), 'Niets gevonden'), 'een zoekterm zonder treffers zegt niets')
  zouden(page.fouten.length === 0, `fouten: ${page.fouten[0]}`)
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

await test('het rooster toont de week en waarschuwt bij dubbel inplannen', async () => {
  const page = await tabblad('/rooster')
  await page.waitForTimeout(1000)
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
  await page.waitForTimeout(700)
  zouden(bevat(await inhoud(page), 'Dienst aanpassen'), 'de dienst opent niet')
  zouden(page.fouten.length === 0, `fouten: ${page.fouten[0]}`)
  await page.close()
})

await test('werk dat niemand opgepakt heeft is voor iedereen zichtbaar', async () => {
  // Zo'n taak hoort bij niemand, dus vond hij niemand: hij stond in geen enkele
  // persoonlijke lijst en bleef daardoor liggen.
  const page = await tabblad('/tasks?weergave=lijst&groep=deadline&wie=ik')
  await page.waitForTimeout(1000)
  const tekst = await inhoud(page)
  zouden(bevat(tekst, 'Parkeerplan doorgeven'), `de niet-toegewezen taak ontbreekt: ${tekst.slice(0, 200)}`)

  // En het moet te zien zijn dát hij niet van jou is, anders lees je hem als
  // jouw werk en wacht iedereen op een ander.
  const regel = await page.locator('li', { hasText: 'Parkeerplan doorgeven' }).first().innerText()
  zouden(bevat(regel, 'niemand'), `niet gemarkeerd: ${regel}`)

  // Op het dashboard staat het aantal, met een weg ernaartoe.
  const dash = await tabblad('/dashboard')
  await dash.waitForTimeout(900)
  zouden(bevat(await inhoud(dash), 'Niemand toegewezen'), 'het dashboard zwijgt erover')
  zouden(page.fouten.length === 0, `fouten: ${page.fouten[0]}`)
  await dash.close()
  await page.close()
})

await test('los socialwerk kan zonder event, en er is tijd op te boeken', async () => {
  const page = await tabblad('/social')
  await page.getByRole('tab', { name: 'Events' }).click()
  await page.waitForTimeout(800)

  // Werk dat niet uit een event komt, moest tot nu toe aan een event gehangen
  // worden dat er niet was.
  const veld = page.getByLabel('Nieuwe socialtaak')
  zouden((await veld.count()) === 1, 'je kunt geen losse socialtaak toevoegen')
  await veld.fill('Reel over de nieuwe winterkaart')
  await page.getByRole('button', { name: 'Toevoegen' }).first().click()
  await page.waitForTimeout(900)
  zouden(
    bevat(await inhoud(page), 'Reel over de nieuwe winterkaart'),
    'de losse taak staat niet op het socialbord'
  )

  // En op de kalender staat een timer, want daar werkt wie de content maakt.
  await page.getByRole('tab', { name: 'Kalender' }).click()
  await page.waitForTimeout(900)
  // Op de kaart zelf klikken: de tekst erin zit in een vakje dat nog schuift.
  await page.getByRole('button', { name: /Bar Vue cocktailweek/ }).first().click()
  await page.waitForTimeout(900)
  const paneel = await page.getByRole('dialog').innerText()
  zouden(bevat(paneel, 'Tijd'), `geen tijdblok op de post: ${paneel.slice(0, 200)}`)
  zouden(page.fouten.length === 0, `fouten: ${page.fouten[0]}`)
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

// ─── Het takenpaneel, de lijsteditor en de zoekbalk ─────────────────────────

/** Opent het zijpaneel van een event op het bord. */
async function opentTaak(page, titel) {
  await page.locator('main').getByText(titel).first().click()
  await page.waitForTimeout(900)
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
  await page.waitForTimeout(400)

  const eigen = await opentTaak(page, 'Trouw Niels en Inez')
  const eigenVoet = await eigen.locator('.je-drawer__foot').innerText()
  zouden(bevat(eigenVoet, 'Aangemaakt'), `een eigen taak mist haar datum: ${eigenVoet}`)
  await page.close()
})

await test('verwijderen zegt wat er verdwijnt, archiveren is de gewone knop', async () => {
  const page = await tabblad('/bord/l-overview')
  const paneel = await opentTaak(page, 'Trouw Niels en Inez')

  let vraag = ''
  page.on('dialog', async (d) => {
    vraag = d.message()
    await d.dismiss()
  })

  // In de voet, want verderop in het paneel staat bij elke subtaak, elk
  // tijdstip en elke reactie ook een kruisje dat "verwijderen" heet.
  const voet = paneel.locator('.je-drawer__foot')
  await voet.getByRole('button', { name: 'Verwijderen' }).click()
  await page.waitForTimeout(600)

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
  await page.waitForTimeout(800)
  zouden(bevat(await paneel.innerText(), 'winterbar'), 'het nieuwe label staat niet op de taak')

  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)
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
  await page.close()
})

await test('alle frequenties van het poetsplan zijn te kiezen en komen door', async () => {
  const page = await tabblad('/instellingen')
  await page.getByRole('tab', { name: 'Dagelijkse lijsten' }).click()
  await page.waitForTimeout(800)
  await page.getByRole('button', { name: /^Poetsplan$/ }).click()
  await page.waitForTimeout(600)

  const rij = page
    .locator('div.space-y-2')
    .filter({ has: page.locator('input[value*="Werkoppervlakken"]') })
    .first()
  await rij.getByRole('button', { name: 'Wijzigen' }).click()
  await page.waitForTimeout(400)

  const soort = rij.getByLabel('Hoe vaak dit punt terugkomt')
  const opties = await soort.locator('option').allTextContents()
  zouden(opties.length === 6, `niet alle frequenties staan er: ${opties.join(', ')}`)

  // Dit was de fout: "één keer per week" viel terug op het weekend en maakte er
  // stilletjes zondag van.
  await soort.selectOption('wekelijks')
  await page.waitForTimeout(600)
  let tekst = await rij.innerText()
  zouden(bevat(tekst, 'elke maandag'), `de wekelijkse beurt staat verkeerd: ${tekst.split('\n')[1]}`)
  zouden(bevat(tekst, 'eerstvolgend'), 'er staat niet bij wanneer het de eerste keer valt')

  await soort.selectOption('kwartaal')
  await page.waitForTimeout(600)
  tekst = await rij.innerText()
  zouden(bevat(tekst, 'elk kwartaal'), `de kwartaalkeuze komt niet door: ${tekst.split('\n')[1]}`)

  // Geen dag aangevinkt is geen stille fout meer.
  await soort.selectOption('weekdag')
  await page.waitForTimeout(600)
  for (const dag of ['ma', 'di', 'wo', 'do', 'vr']) {
    await rij.getByRole('button', { name: dag, exact: true }).click()
    await page.waitForTimeout(250)
  }
  zouden(bevat(await rij.innerText(), 'nooit meer op de lijst'), 'een punt zonder dag geeft geen waarschuwing')
  zouden(page.fouten.length === 0, `fouten: ${page.fouten[0]}`)
  await page.close()
})

await test('het poetsplan laat zien wat er buiten vandaag nog aankomt', async () => {
  const page = await tabblad('/openen-sluiten')
  await page.getByRole('tab', { name: /Poetsplan/ }).click()
  await page.waitForTimeout(700)
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
  await page.waitForTimeout(900)
  const paneel = page.getByRole('dialog')

  // Wat er vóór deze functie gebeurde staat er ook in: het log begint niet leeg.
  zouden(bevat(await paneel.innerText(), 'Verloop'), 'het verloop staat niet in het paneel')
  zouden(
    bevat(await paneel.innerText(), 'verzette de status van Aanvraag naar Offerte maken'),
    'de bestaande logregels staan er niet'
  )

  // En nu echt iets wijzigen: de prioriteit hoger zetten.
  await paneel.getByLabel('Prioriteit').selectOption('1')
  await page.waitForTimeout(900)
  const na = await paneel.innerText()
  zouden(bevat(na, 'zette de prioriteit op Urgent'), `de wijziging staat niet in het verloop: ${na.slice(-300)}`)
  zouden(bevat(na, 'Jasper Hansen'), 'er staat niet bij wie het deed')
  zouden(page.fouten.length === 0, `fouten: ${page.fouten[0]}`)
  await page.close()
})

await test('dezelfde waarde opnieuw kiezen levert geen tweede regel op', async () => {
  const page = await tabblad('/bord/l-overview')
  await page.locator('main').getByText('Blum België — 20-jarig bestaan').first().click()
  await page.waitForTimeout(900)
  const paneel = page.getByRole('dialog')

  // De kop staat in kapitalen via CSS, dus zonder op hoofdletters te letten.
  const tel = async () => Number((await paneel.innerText()).match(/verloop \((\d+)\)/i)?.[1])
  const voor = await tel()

  // De status staat al op "offer accepted"; die opnieuw kiezen verandert niets.
  const status = paneel.getByLabel('Status')
  await status.selectOption({ label: 'offer accepted' })
  await page.waitForTimeout(900)
  zouden((await tel()) === voor, `het verloop groeide van ${voor} naar ${await tel()} zonder wijziging`)

  await status.selectOption({ label: 'planning ongoing' })
  await page.waitForTimeout(900)
  zouden((await tel()) === voor + 1, `een echte wijziging gaf ${voor} → ${await tel()}`)
  await page.close()
})

await test('het archief toont de afgesloten events, met een filter op jaar', async () => {
  const page = await tabblad('/?weergave=bord')
  const bord = await inhoud(page)
  zouden(!bevat(bord, 'Kerstmarkt Borgloon 2025'), 'een afgesloten event staat nog op het bord')
  zouden(bevat(bord, 'Trouw Niels en Inez'), 'het bord is leeg geworden')

  await page.getByRole('tab', { name: 'Archief' }).click()
  await page.waitForTimeout(900)
  const alles = await inhoud(page)
  for (const naald of ['Kerstmarkt Borgloon 2025', 'Oldskool Festival 2024', 'kick-off 2025']) {
    zouden(bevat(alles, naald), `"${naald}" staat niet in het archief`)
  }
  // Niets wordt verwijderd, en dat staat er ook.
  zouden(bevat(alles, 'niets verwijderd'), 'er staat niet bij dat er niets verwijderd wordt')

  await page.getByText('2024', { exact: true }).first().click()
  await page.waitForTimeout(700)
  const vanJaar = await inhoud(page)
  zouden(bevat(vanJaar, 'Oldskool Festival 2024'), 'het filter op 2024 verbergt zijn eigen event')
  zouden(!bevat(vanJaar, 'Kerstmarkt Borgloon 2025'), 'het filter op jaar filtert niet')

  // En een gearchiveerd event is nog gewoon te openen.
  await page.locator('main').getByText('Oldskool Festival 2024').first().click()
  await page.waitForTimeout(1000)
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

await test('een event uit een formule krijgt prijs, taken en een berekende bestellijst', async () => {
  const page = await tabblad('/')
  await page.getByRole('button', { name: 'Nieuw event' }).click()
  await page.getByPlaceholder('bv. Trouw Tom en Sara').fill('Winterfeest Blum')
  await page.getByRole('tab', { name: 'Bestaande formule' }).click()
  await page.getByRole('button', { name: /Winter BBQ/ }).click()
  await page.getByLabel('Aantal personen').fill('37')
  await page.getByLabel('Drankenformule').selectOption('dranken-avond')
  await page.waitForTimeout(400)
  await page.getByRole('button', { name: 'Event aanmaken' }).click()
  await page.waitForTimeout(1400)

  const fiche = await inhoud(page)
  zouden(fiche.includes('Winterfeest Blum'), 'het event opende niet')
  zouden(fiche.includes('37 pax'), `het aantal personen staat niet op de fiche: ${fiche.slice(0, 120)}`)
  zouden(bevat(fiche, 'Winter BBQ'), 'de formule staat niet op de fiche')
  // 29,90 + 19,00 drank = 48,90 per persoon × 37 = 1.809,30 excl. btw.
  zouden(fiche.includes('1.809,3'), `het offertebedrag klopt niet: ${fiche.match(/€ [\d.,]+/g)?.join(' ')}`)
  zouden(bevat(fiche, 'Offerte opmaken en versturen'), 'de standaardtaken van het template staan er niet')

  await page.getByRole('tab', { name: /Bestellijst/ }).click()
  await page.waitForTimeout(700)
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

await test('Ctrl+K opent de zoekbalk over taken, klanten en verslagen tegelijk', async () => {
  // De drie soorten die er los bij gekomen zijn, in één zoekopdracht: "Blum"
  // is een klant, een event met taken, én een punt in een verslag. Zonder
  // plafond per soort duwen de taken de rest eruit — zie @lib/zoeken.
  const page = await tabblad('/')
  await page.keyboard.press('Control+KeyK')
  await page.waitForTimeout(200)
  await page.getByLabel('Zoeken').fill('blum')
  await page.waitForTimeout(400)

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
  await page.waitForTimeout(400)

  const lijst = await page.getByRole('listbox').innerText()
  zouden(bevat(lijst, 'Verslagen'), `geen verslag gevonden: ${lijst.slice(0, 250)}`)
  zouden(lijst.includes('Weekstart events'), 'het verslag staat er niet bij')

  await page.keyboard.press('Enter')
  await page.waitForTimeout(900)
  zouden(bevat(await inhoud(page), 'Teamoverleg'), `Enter bracht je naar ${page.url()}`)
  await page.close()
})

await test('met de pijltjes verschuift de selectie en Enter opent die', async () => {
  const page = await tabblad('/')
  await page.getByLabel('Zoeken').fill('blum')
  await page.waitForTimeout(400)

  const gekozen = () => page.locator('[role=option][aria-selected=true]').first().innerText()
  const eerste = await gekozen()
  await page.keyboard.press('ArrowDown')
  await page.waitForTimeout(200)
  const tweede = await gekozen()
  zouden(eerste !== tweede, `de selectie bleef op "${eerste}" staan`)

  await page.keyboard.press('Enter')
  await page.waitForTimeout(900)
  zouden(!page.url().endsWith('#/'), `Enter bracht je nergens: ${page.url()}`)
  await page.close()
})

await test('? toont de sneltoetsen en een losse letter springt naar het scherm', async () => {
  const page = await tabblad('/')
  await page.keyboard.press('Shift+Slash')
  await page.waitForTimeout(500)
  const dialoog = await page.getByRole('dialog').innerText()
  zouden(bevat(dialoog, 'Sneltoetsen'), `geen lijstje: ${dialoog.slice(0, 150)}`)
  zouden(bevat(dialoog, 'Naar Tasks'), 'de sprong naar Tasks staat er niet bij')

  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)
  await page.keyboard.press('t')
  await page.waitForTimeout(900)
  zouden(page.url().includes('/tasks'), `T bracht je naar ${page.url()}`)

  // En in een veld is een letter gewoon een letter.
  await page.getByLabel('Zoeken').fill('telefoon')
  await page.waitForTimeout(300)
  zouden(page.url().includes('/tasks'), `typen in het zoekveld navigeerde weg: ${page.url()}`)
  zouden(page.fouten.length === 0, `fouten: ${page.fouten[0]}`)
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

await test('zonder verbinding kun je verder afvinken en zie je dat het nog niet weg is', async () => {
  // Waar de hele oefening om draait. De keuken en de koelcel hebben één
  // streepje bereik; wie daar afvinkt moet dat kunnen, en moet zien dat het
  // nog niet doorgestuurd is. Zwijgen is hier het ergste: dan sluit iemand de
  // app en staat er de volgende ochtend een halve lijst.
  const page = await tabblad('/openen-sluiten')
  await page.context().setOffline(true)
  await page.waitForTimeout(700)

  zouden(bevat(await inhoud(page), 'Geen verbinding'), 'de app zegt niet dat er geen verbinding is')

  const vakjes = page.locator('input[type=checkbox]')
  const voor = await vakjes.evaluateAll((els) => els.filter((e) => e.checked).length)
  await vakjes.nth(await vakjes.evaluateAll((els) => els.findIndex((e) => !e.checked))).check()
  await page.waitForTimeout(800)

  const na = await vakjes.evaluateAll((els) => els.filter((e) => e.checked).length)
  zouden(na === voor + 1, `offline afvinken lukte niet: ${voor} → ${na}`)

  const tekst = await inhoud(page)
  zouden(bevat(tekst, 'Nog op dit toestel'), 'er staat niet dat het vinkje nog op dit toestel staat')
  zouden(bevat(tekst, 'wijziging'), `de balk noemt niet wat er openstaat: ${tekst.slice(0, 300)}`)

  // En zodra er weer bereik is, gaat het mee en houdt de app erover op.
  await page.context().setOffline(false)
  await page.waitForTimeout(1200)
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

// ─── Uitslag ────────────────────────────────────────────────────────────────

await browser.close()
server.close()

console.log(`\n${gelukt} geslaagd, ${mislukt.length} mislukt`)
if (mislukt.length) {
  console.log(mislukt.map((m) => `  ✗ ${m.naam}: ${m.bericht}`).join('\n'))
  process.exit(1)
}
