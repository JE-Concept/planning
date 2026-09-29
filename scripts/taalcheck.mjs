#!/usr/bin/env node
/**
 * Nog Nederlands op een Engels scherm?
 *
 * Geen test maar een hulpje: het zet de tool op Engels, loopt elk scherm af en
 * meldt de woorden die er dan niet meer horen te staan. Namen van events,
 * klanten en taken komen uit de demogegevens en zijn wél Nederlands — die
 * staan daarom in de lijst met wat genegeerd wordt.
 *
 *   npm run build:demo && node scripts/taalcheck.mjs
 */

import { createServer } from 'node:http'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { dirname, extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist-demo')
const POORT = Number(process.env.SMOKE_PORT ?? 4330)
const adres = `http://localhost:${POORT}`

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' }
const server = createServer((req, res) => {
  const pad = req.url.split('?')[0]
  let bestand = join(root, pad === '/' ? 'index.html' : pad)
  if (!existsSync(bestand) || statSync(bestand).isDirectory()) bestand = join(root, 'index.html')
  res.writeHead(200, { 'Content-Type': TYPES[extname(bestand)] ?? 'application/octet-stream' })
  createReadStream(bestand).pipe(res)
})
await new Promise((r) => server.listen(POORT, r))

// Woorden die in het Nederlands doodgewoon zijn en in het Engels niet bestaan.
const VERDACHT = [
  'geen', 'niet', 'nog', 'taken', 'taak', 'wordt', 'deze', 'vandaag', 'morgen',
  'gisteren', 'week', 'maand', 'toevoegen', 'bewaren', 'verwijderen', 'aanmaken',
  'zoeken', 'kiezen', 'sluiten', 'openen', 'iedereen', 'niemand', 'klant',
  'klanten', 'uren', 'dagen', 'gasten', 'afgerond', 'bezig', 'volgende', 'vorige',
]

// Wat wél Nederlands hoort te zijn: demogegevens en wat met opzet blijft staan.
const MAG = [
  'blum', 'trouw', 'niels', 'inez', 'oldskool', 'jasper', 'elke', 'lotte', 'sam',
  'maxine', 'charish', 'kenjeklanten', 'jeconcept', 'winter bbq', 'ken je klanten',
  'concept', 'bistro', 'keuken', 'zaal', 'ordingen', 'sint-truiden', 'borgloon',
]

const PADEN = [
  '/', '/kalender', '/events/t-trouw', '/tasks', '/werklast', '/dashboard',
  '/social', '/klanten', '/openen-sluiten', '/registraties', '/overleg',
  '/uren', '/rooster', '/goals', '/instellingen', '/meer',
]

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } })

// Eerst de taal omzetten; de keuze blijft in deze browser staan.
await page.goto(`${adres}/#/`, { waitUntil: 'networkidle' })
await page.waitForTimeout(1200)
await page.locator('aside').first().locator('[aria-haspopup="menu"]').click()
await page.getByRole('menuitemradio', { name: 'English' }).click()
await page.waitForTimeout(600)

let totaal = 0
for (const pad of PADEN) {
  await page.goto(`${adres}/#${pad}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(700)
  const tekst = (await page.locator('body').innerText()).toLowerCase()

  const regels = tekst.split('\n').filter((r) => r.trim())
  const verdacht = regels.filter((regel) => {
    if (MAG.some((m) => regel.includes(m))) return false
    return VERDACHT.some((w) => new RegExp(`(^|[^a-z])${w}([^a-z]|$)`).test(regel))
  })

  if (verdacht.length) {
    console.log(`\n${pad}`)
    for (const regel of [...new Set(verdacht)].slice(0, 12)) console.log(`   ${regel.slice(0, 110)}`)
    totaal += verdacht.length
  }
}

console.log(`\n${totaal} verdachte regels.`)
await browser.close()
server.close()
