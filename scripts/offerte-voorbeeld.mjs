#!/usr/bin/env node
/**
 * Het offerteblad als los bestand, om te bekijken en te delen.
 *
 *   npm run build:demo && node scripts/offerte-voorbeeld.mjs
 *
 * ── Waarom dit geen tweede sjabloon is ────────────────────────────────────
 * De verleiding is om hier een mooie voorbeeldofferte te schrijven met dezelfde
 * opmaak. Dat is precies hoe je twee waarheden krijgt: het voorbeeld dat je
 * deelt gaat leven, de app verandert, en na twee maanden ziet de klant iets
 * anders dan wat er op het scherm stond.
 *
 * Dit script tekent daarom niets zelf. Het opent de app, laat haar een offerte
 * renderen, en knipt het blad eruit zoals het daar staat. De stijl komt uit
 * hetzelfde `src/styles/offerte.css` dat de app laadt. Verandert er iets aan
 * het blad, dan verandert dit bestand mee — of het klopt niet meer en dat merk
 * je meteen.
 */

import { createServer } from 'node:http'
import { createReadStream, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const wortel = join(dirname(fileURLToPath(import.meta.url)), '..')
const root = join(wortel, 'dist-demo')
const POORT = Number(process.env.VOORBEELD_PORT ?? 4321)

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

const server = createServer((req, res) => {
  const pad = req.url.split('?')[0]
  let bestand = join(root, pad === '/' ? 'index.html' : pad)
  if (!existsSync(bestand) || statSync(bestand).isDirectory()) bestand = join(root, 'index.html')
  res.writeHead(200, { 'Content-Type': TYPES[extname(bestand)] ?? 'application/octet-stream' })
  createReadStream(bestand).pipe(res)
})

await new Promise((r) => server.listen(POORT, r))

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 1600 } })
await page.goto(`http://localhost:${POORT}/#/events/t-trouw?tab=offerte`, { waitUntil: 'networkidle' })
await page.waitForSelector('.je-offerteblad', { timeout: 15000 })
// Even wachten tot de offerte klaargezet is en de lijnen erin staan.
await page.waitForFunction(() => document.querySelectorAll('.je-offerteblad__tabel tbody tr').length > 1, {
  timeout: 15000,
})

const blad = await page.locator('.je-offerteblad').first().evaluate((el) => el.outerHTML)
await browser.close()
server.close()

const stijl = readFileSync(join(wortel, 'src/styles/offerte.css'), 'utf8')

/*
  Geen <html>, <head> of <body>: dit bestand wordt ook als artifact
  gepubliceerd, en dat wikkelt er zelf een skelet omheen. Een browser die het
  rechtstreeks opent, tekent het net zo goed — een fragment met een <title> en
  een <style> is geldig genoeg.
*/
const html = `<title>JE Concept Offerte</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link
  rel="stylesheet"
  href="https://fonts.googleapis.com/css2?family=Oswald:wght@300..700&family=Source+Sans+3:wght@300..700&family=Parisienne&family=Prata&display=swap"
/>
<style>
  /*
    Een offerte is papier. Ze staat er in één wereld — wit blad, navy inkt —
    en volgt met opzet niet het thema van wie ze bekijkt: de klant krijgt ze
    afgedrukt of als PDF, en dan is er geen donkere modus. Daarom staan alle
    kleuren hier vast en expliciet.
  */
  :root {
    color-scheme: light;
    --ondergrond: #eef1f5;
    --ondergrond-tekst: #33475e;
  }
  body {
    margin: 0;
    padding-block: 24px;
    padding-inline: 16px;
    background: var(--ondergrond);
    color: var(--ondergrond-tekst);
    font-family: "Source Sans 3", Helvetica, Arial, sans-serif;
  }
  .je-offerteblad {
    box-shadow: 0 2px 24px rgb(0 34 70 / 12%);
    max-width: 100%;
  }

  /* Letterlijk src/styles/offerte.css — niet met de hand bijgewerkt. */
${stijl.replace(/^/gm, '  ')}
</style>
<div class="je-offerteblad-schaal je-print-hier">
${blad.replace(/^/gm, '  ')}
</div>
`

const uit = join(wortel, 'dist-offerte')
mkdirSync(uit, { recursive: true })
writeFileSync(join(uit, 'index.html'), html)
console.log(`Geschreven: dist-offerte/index.html (${Math.round(html.length / 1024)} kB)`)
