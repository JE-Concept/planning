#!/usr/bin/env node
/**
 * De app-iconen tekenen uit het merk.
 *
 *   node scripts/iconen.mjs
 *
 * De PNG's in `public/icons/` droegen tot kort de plaatshouder van het eerste
 * uur: drie staafjes in ClickUp-blauw op antraciet. Die stonden op het
 * beginscherm van iedereen die de tool op zijn telefoon had gezet.
 *
 * Ze komen nu uit `public/favicon.svg`, dat op zijn beurt de zeshoeken van
 * `public/brand/je-concept-logo.svg` draagt — hun eigen tekening, zonder de
 * letters, want onder de 48px zijn die een vlek. Eén bron dus; verandert het
 * merk, dan draai je dit opnieuw.
 *
 * Chromium doet het rasteren. Die staat er al voor de browsertest, dus er komt
 * geen afhankelijkheid bij.
 */
import { chromium } from 'playwright'
import { readFileSync, writeFileSync } from 'node:fs'

const INKT = '#003366'
const BLEEK = '#d5e2f1'

/** De twee zeshoeken uit de favicon, zodat er één tekening is. */
const favicon = readFileSync('public/favicon.svg', 'utf8')
const PADEN = [...favicon.matchAll(/<path d="([^"]*)" fill="none"([^>]*)>/g)].map((m) => ({
  d: m[1],
  spook: m[2].includes('stroke-opacity'),
}))

if (PADEN.length !== 2) {
  console.error('Verwachtte twee zeshoeken in public/favicon.svg, vond er ' + PADEN.length)
  process.exit(1)
}

/**
 * Het merk op een vierkant, met instelbare lucht.
 *
 * De zeshoeken staan in het assenstelsel van het logo (0–375) en worden hier
 * geschaald, zodat de verhoudingen van de tekening blijven kloppen.
 */
const vlak = (lucht) => {
  // De twee zeshoeken samen beslaan x 32,3–298,5 en y 47,0–303,5.
  const breedte = 266.25
  const schaal = (375 - lucht * 2) / breedte
  const dx = lucht - 32.285 * schaal
  const dy = lucht - 42.125 * schaal
  // De lijndikte schaalt mee, zodat ze op elk formaat dezelfde verhouding
  // tot de vorm houdt — dat is het hele punt van de verzwaring.
  const vorm = PADEN.map(
    (p) =>
      `<path d="${p.d}" fill="none" stroke="${BLEEK}"${p.spook ? ' stroke-opacity="0.4"' : ''}` +
      ` stroke-width="16" stroke-linejoin="round"/>`
  ).join('')
  return `<g transform="translate(${dx.toFixed(2)} ${dy.toFixed(2)}) scale(${schaal.toFixed(4)})">${vorm}</g>`
}

const ICONEN = [
  { bestand: 'public/icons/icon-192.png', maat: 192, radius: 48, lucht: 60 },
  { bestand: 'public/icons/icon-512.png', maat: 512, radius: 48, lucht: 60 },
  { bestand: 'public/icons/apple-touch-icon.png', maat: 180, radius: 0, lucht: 68 },
  // Android knipt hier een cirkel of druppel uit: alles wat telt, binnen de
  // binnenste 80%.
  { bestand: 'public/icons/maskable-512.png', maat: 512, radius: 0, lucht: 96 },
]

const browser = await chromium.launch()

for (const { bestand, maat, radius, lucht } of ICONEN) {
  const page = await browser.newPage({ viewport: { width: maat, height: maat }, deviceScaleFactor: 1 })
  await page.setContent(`<!doctype html><html><body style="margin:0">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 375 375" width="${maat}" height="${maat}">
      <rect width="375" height="375" rx="${radius}" fill="${INKT}"/>
      ${vlak(lucht)}
    </svg></body></html>`)
  writeFileSync(bestand, await page.screenshot())
  console.log(`${bestand} · ${maat}px`)
  await page.close()
}

await browser.close()
