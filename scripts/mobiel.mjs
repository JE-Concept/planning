#!/usr/bin/env node
/**
 * Past elk scherm op een telefoon?
 *
 * ── Waarom dit een eigen script is ────────────────────────────────────────
 * "Is het mobielvriendelijk" is geen vraag die je met kijken beantwoordt: je
 * kijkt naar drie schermen, ze zien er goed uit, en het vierde heeft een tabel
 * die er honderd pixels uit steekt. Dit loopt elk scherm af op een echt
 * telefoonformaat en meet twee dingen die je met het blote oog pas ziet als
 * iemand klaagt:
 *
 *  1. **Steekt er iets buiten het scherm?** Horizontaal scrollen op een
 *     telefoon is bijna altijd een fout: je verliest de helft van een regel en
 *     merkt niet dat er meer was. Een enkele plek mag het wél — een bord met
 *     negen kolommen, een brede tabel — en die staan hieronder met naam.
 *  2. **Zijn de knoppen aan te raken?** Onder de 32 pixels mis je ze met een
 *     duim. Apple houdt 44 aan, Google 48; 32 is waar het echt misgaat, en dat
 *     is wat een tripwire moet vangen — strenger en hij staat vol met dingen
 *     die niemand stoort.
 *
 *   npm run build:demo && node scripts/mobiel.mjs
 */

import { createServer } from 'node:http'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { dirname, extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium, devices } from 'playwright'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist-demo')
const POORT = Number(process.env.MOBIEL_PORT ?? 4340)
const adres = `http://localhost:${POORT}`

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.json': 'application/json' }
const server = createServer((req, res) => {
  const pad = req.url.split('?')[0]
  let bestand = join(root, pad === '/' ? 'index.html' : pad)
  if (!existsSync(bestand) || statSync(bestand).isDirectory()) bestand = join(root, 'index.html')
  res.writeHead(200, { 'Content-Type': TYPES[extname(bestand)] ?? 'application/octet-stream' })
  createReadStream(bestand).pipe(res)
})
await new Promise((r) => server.listen(POORT, r))

/**
 * Elk scherm dat een mens kan openen, met de rol die het mag zien.
 *
 * De rol staat erbij omdat de helft van de schermen voor een medewerker niet
 * bestaat — en de schermen die hij wél heeft, zijn juist degene die op een
 * telefoon geopend worden, achter de bar of in de koelcel.
 */
const SCHERMEN = [
  ['/', null], ['/kalender', null], ['/events/t-trouw', null], ['/events/t-beurs', null],
  ['/tasks', null], ['/werklast', null], ['/dashboard', null], ['/meer', null],
  ['/social', null], ['/klanten', null], ['/aanvragen', null],
  ['/openen-sluiten', null], ['/registraties', null], ['/overleg', null],
  ['/uren', null], ['/rooster', null], ['/medewerkers', null], ['/planning', null], ['/materiaal', null],
  ['/logboek', null], ['/goals', null], ['/instellingen', null], ['/profiel', null],
  // Wat een medewerker ziet, op het toestel waarop hij het ziet.
  ['/mijn-events', 'personeel'], ['/openen-sluiten', 'personeel'], ['/uren', 'personeel'],
  ['/profiel', 'personeel'],
  ['/social', 'social'],
]

/**
 * Waar horizontaal schuiven wél de bedoeling is.
 *
 * Een bord met negen kolommen past op geen enkele telefoon, en ze samendrukken
 * maakt ze onleesbaar. Daar is schuiven het antwoord en geen fout — maar het
 * moet hier met naam staan, zodat een scherm dat per ongeluk uitsteekt niet
 * tussen de uitzonderingen wegvalt.
 */
const MAG_SCHUIVEN = ['.je-kanban', '.je-tabs--scroll', '.je-tabel-schuif', '.je-rooster__rij', '.je-maandtabel']

const viewport = devices['iPhone 13'].viewport

const browser = await chromium.launch()
const context = await browser.newContext({ ...devices['iPhone 13'] })

/*
  Geen webfonts, met opzet.

  Dit script was groen op mijn machine en rood in CI: daar werd "Mail" in een
  tab zevenentwintig pixels en hier vierendertig. Welke letters er precies
  getekend worden hangt af van de machine — welke Chromium, welke lettertypes
  erop staan — en een tripwire die daarvan afhangt, meldt dingen die niemand
  ziet en mist dingen die iemand wél ziet.

  Het echte antwoord was de knoppen een ondergrens geven die niet van een woord
  afhangt (zie `.je-tab` in app.css). Dit blokkeren is wat overblijft: het
  terugvallettertype is smaller dan het echte, dus hiermee meet elke machine
  hetzelfde én het ongunstigste geval. Wat hier past, past overal.
*/
await context.route(/fonts\.(googleapis|gstatic)\.com/, (route) => route.abort())

const page = await context.newPage()

const fouten = []
const pageFouten = []
page.on('pageerror', (e) => pageFouten.push(String(e).split('\n')[0]))

for (const [pad, rol] of SCHERMEN) {
  const naam = rol ? `${pad} (${rol})` : pad
  pageFouten.length = 0

  await page.goto(`${adres}/${rol ? `?rol=${rol}` : ''}#${pad}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(900)

  const uitslag = await page.evaluate((magSchuiven) => {
    const breedte = document.documentElement.clientWidth
    const naam = (el) =>
      `${el.tagName.toLowerCase()}.${(el.className || '').toString().split(' ').filter(Boolean).slice(0, 2).join('.')}`

    /*
      Wat er met iets gebeurt dat breder is dan het scherm.

      Drie uitkomsten, en alleen de eerste is een echt probleem:

      - **afgesneden** — een voorouder knipt het weg (`overflow: hidden`) en er
        is geen manier om erbij te komen. De helft van een tabel bestaat dan
        wel, maar niemand kan ze lezen.
      - **schuifbaar** — een voorouder schuift. Bij een bord met negen kolommen
        of een weekrooster is dat het juiste antwoord.
      - **pagina schuift** — de hele pagina schuift mee. Vervelend maar
        leesbaar; hieronder apart gemeld.
    */
    const lot = (el) => {
      for (let p = el.parentElement; p && p !== document.documentElement; p = p.parentElement) {
        const x = getComputedStyle(p).overflowX
        if (x === 'auto' || x === 'scroll') return 'schuifbaar'
        if (x === 'hidden' || x === 'clip') return 'afgesneden'
      }
      return document.documentElement.scrollWidth > breedte + 1 ? 'paginaschuift' : 'afgesneden'
    }

    const afgesneden = []
    const paginabreed = []
    const HTML = 'http://www.w3.org/1999/xhtml'
    for (const el of document.querySelectorAll('body *')) {
      // Alleen HTML. Een `<svg>` draagt van zichzelf `overflow: hidden`, dus
      // elk pad erbinnen zou als "afgesneden" gelden terwijl het gewoon een
      // icoon in een schuifbare kolom is.
      if (el.namespaceURI !== HTML) continue
      const doos = el.getBoundingClientRect()
      if (doos.width === 0 || doos.height === 0) continue
      if (doos.right <= breedte + 1 && doos.left >= -1) continue
      if (magSchuiven.some((kies) => el.closest(kies))) continue
      if (getComputedStyle(el).visibility === 'hidden') continue

      const uitkomst = lot(el)
      if (uitkomst === 'schuifbaar') continue
      const rij = { wat: naam(el), rechts: Math.round(doos.right), tekst: (el.textContent || '').trim().slice(0, 40) }
      ;(uitkomst === 'afgesneden' ? afgesneden : paginabreed).push(rij)
    }

    /*
      Knoppen die te klein zijn om met een duim te raken.

      Het aanraakvlak is niet altijd het element zelf: een vinkje van twintig
      pixels in een label van veertig raak je prima. Dus wordt er gemeten op
      wat er werkelijk klikbaar is — het label eromheen wanneer dat er is.
    */
    const klein = []
    const gezien = new Set()
    for (const el of document.querySelectorAll('button, a, input, select, [role="button"], [role="tab"], [role="option"]')) {
      const raakvlak = el.closest('label') ?? el
      if (gezien.has(raakvlak)) continue
      gezien.add(raakvlak)
      const doos = raakvlak.getBoundingClientRect()
      if (doos.width === 0 || doos.height === 0) continue
      if (doos.height >= 32 && doos.width >= 32) continue
      klein.push({
        wat: naam(el),
        maat: `${Math.round(doos.width)}×${Math.round(doos.height)}`,
        tekst: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 30),
      })
    }

    return {
      schuift: document.documentElement.scrollWidth > breedte + 1,
      scrollBreedte: document.documentElement.scrollWidth,
      breedte,
      // Alleen de eerste paar: honderd regels over hetzelfde helpen niemand.
      afgesneden: afgesneden.slice(0, 5),
      afgesnedenTotaal: afgesneden.length,
      paginabreed: paginabreed.slice(0, 3),
      paginabreedTotaal: paginabreed.length,
      klein: klein.slice(0, 5),
      kleinTotaal: klein.length,
    }
  }, MAG_SCHUIVEN)

  const regels = []
  if (uitslag.afgesnedenTotaal) {
    regels.push(`${uitslag.afgesnedenTotaal} element(en) worden afgesneden en zijn niet te bereiken:`)
    for (const u of uitslag.afgesneden) regels.push(`    ${u.wat} tot ${u.rechts}px — "${u.tekst}"`)
  }
  if (uitslag.schuift) {
    regels.push(`de pagina schuift horizontaal (${uitslag.scrollBreedte} op ${uitslag.breedte})`)
    for (const u of uitslag.paginabreed) regels.push(`    door ${u.wat} tot ${u.rechts}px — "${u.tekst}"`)
  }
  if (uitslag.kleinTotaal) {
    regels.push(`${uitslag.kleinTotaal} knop(pen) kleiner dan 32px:`)
    for (const k of uitslag.klein) regels.push(`    ${k.wat} ${k.maat} — "${k.tekst}"`)
  }
  if (pageFouten.length) regels.push(`javascriptfout: ${pageFouten[0]}`)

  if (regels.length) {
    fouten.push(naam)
    console.log(`\n✗ ${naam}`)
    for (const r of regels) console.log(`  ${r}`)
  } else {
    console.log(`✓ ${naam}`)
  }
}

await browser.close()
server.close()

console.log(`\n${SCHERMEN.length - fouten.length} van ${SCHERMEN.length} schermen passen op ${viewport.width}×${viewport.height}.`)
if (fouten.length) {
  console.log(`Niet in orde: ${fouten.join(', ')}`)
  process.exit(1)
}
