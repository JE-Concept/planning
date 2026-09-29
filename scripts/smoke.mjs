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
const POORT = 4310
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
  ['Vandaag', '/', 'Dag Jasper'],
  ['Mijn werk', '/mijn-werk', 'Mijn werk'],
  ['Bord Events', '/bord/l-overview', 'Events'],
  ['Bord Socials', '/bord/l-socials', 'Socials'],
  ['Socials', '/social', 'Socials'],
  ['Klanten', '/klanten', 'Klanten'],
  ['Openen & sluiten', '/openen-sluiten', 'Openen'],
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
    zouden(tekst.includes(verwacht), `"${verwacht}" staat niet op ${pad}`)
    zouden(page.fouten.length === 0, `fouten op ${pad}: ${page.fouten.slice(0, 2).join(' | ')}`)
    await page.close()
  })
}

// ─── 2. Een uitrol terwijl het tabblad openstaat ────────────────────────────

await test('een verdwenen pagina geeft geen wit scherm maar een uitleg', async () => {
  const page = await tabblad('/')
  verdwenen.add('/assets/Goals-')

  await page.getByRole('link', { name: 'Goals', exact: true }).first().click()
  await page.waitForTimeout(2500)

  const tekst = await inhoud(page)
  zouden(tekst.length > 40, 'het scherm is wit geworden')
  zouden(tekst.includes('opnieuw laden'), `geen uitleg, wel: ${tekst.slice(0, 80)}`)
  zouden(tekst.includes('Vandaag'), 'de zijbalk is verdwenen; je kunt nergens heen')

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

  await page.getByRole('link', { name: 'Uren' }).first().click()
  await page.waitForTimeout(2200)
  zouden((await inhoud(page)).includes('opnieuw laden'), 'geen uitleg na de fout')

  // En je kunt gewoon verder: een andere pagina hoort de melding weg te halen.
  await page.getByRole('link', { name: 'Mijn werk' }).first().click()
  await page.waitForTimeout(1200)
  const tekst = await inhoud(page)
  zouden(!tekst.includes('opnieuw laden'), 'de foutmelding bleef staan na het wegklikken')
  zouden(tekst.includes('Mijn werk'), 'Mijn werk opende niet')

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
  zouden(!bevat(tekst, 'Stripe Connect'), 'een taak van een ander bord staat op het socialbord')
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
  await page.getByRole('button', { name: 'Kalender' }).click()
  await page.waitForTimeout(900)
  zouden((await inhoud(page)).includes('posts in'), 'de kalender opent niet')
  await page.getByRole('button', { name: 'Posts', exact: true }).click()
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
  zouden(velden.includes('BE 0456.789.123'), 'het btw-nummer ontbreekt')
  zouden(paneeltekst.includes('blum-logo.svg'), 'het logo ontbreekt bij de klant')
  zouden(paneeltekst.includes('20-jarig bestaan'), 'het event van deze klant ontbreekt')
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

await test('een punt toevoegen aan een dagelijkse lijst werkt', async () => {
  const page = await tabblad('/instellingen')
  await page.getByRole('button', { name: 'Dagelijkse lijsten' }).click()
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
  await page.getByRole('link', { name: 'Openen & sluiten' }).first().click()
  await page.waitForTimeout(1000)
  zouden(
    (await inhoud(page)).includes('Terrasverwarmer nakijken'),
    'het nieuwe punt staat niet op de dagelijkse lijst'
  )
  zouden(page.fouten.length === 0, `fouten: ${page.fouten[0]}`)
  await page.close()
})

await test('de business rules staan in de instellingen', async () => {
  const page = await tabblad('/instellingen')
  await page.getByRole('button', { name: 'Business rules' }).click()
  await page.waitForTimeout(800)
  const tekst = await inhoud(page)
  zouden(tekst.includes('ready to invoice'), 'de facturatieregel ontbreekt')
  zouden(tekst.includes('wordt de enige toegewezene'), 'de regel wordt niet uitgelegd')
  await page.close()
})

await test('de lopende timer staat in de bovenbalk', async () => {
  const page = await tabblad('/bord/l-overview')
  const balk = await page.locator('header').first().innerText()
  zouden(/\d+:\d\d:\d\d/.test(balk), `geen loper in de balk: ${balk.replace(/\n/g, ' ')}`)
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
