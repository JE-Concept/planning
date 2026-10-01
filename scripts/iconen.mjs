#!/usr/bin/env node
/**
 * De app-iconen tekenen uit het beeldmerk.
 *
 *   node scripts/iconen.mjs
 *
 * De PNG's in `public/icons/` droegen tot nu de plaatshouder van het eerste
 * uur: drie staafjes in ClickUp-blauw (#3377ff) op antraciet. Die stonden op
 * het beginscherm van iedereen die de tool op zijn telefoon had gezet.
 *
 * Ze worden hier uit dezelfde zeshoek getekend als `public/favicon.svg`, zodat
 * er één bron is. Chromium doet het rasteren — die staat er al voor de
 * browsertest, dus er komt geen afhankelijkheid bij.
 *
 * Het maskable-icoon krijgt meer lucht: Android knipt daar een cirkel of een
 * druppel uit, en wat buiten de binnenste 80% valt, kan weg zijn.
 */
import { chromium } from 'playwright'
import { writeFileSync } from 'node:fs'

const INKT = '#003060'
const BLEEK = '#DCE4F0'

/** Het beeldmerk als losse SVG, met instelbare lucht eromheen. */
const merk = (lucht) => {
  const r = 32 - lucht * 2
  const schaal = r / 32
  const v = (n) => (lucht + n * schaal).toFixed(2)
  return `
    <polygon points="${v(16)},${v(5)} ${v(26)},${v(10.5)} ${v(26)},${v(21.5)} ${v(16)},${v(27)} ${v(6)},${v(21.5)} ${v(6)},${v(10.5)}"
             fill="none" stroke="${BLEEK}" stroke-width="${(1.6 * schaal).toFixed(2)}"/>
    <polygon points="${v(16)},${v(10)} ${v(21.6)},${v(13.1)} ${v(21.6)},${v(18.9)} ${v(16)},${v(22)} ${v(10.4)},${v(18.9)} ${v(10.4)},${v(13.1)}"
             fill="${BLEEK}"/>`
}

const ICONEN = [
  { bestand: 'public/icons/icon-192.png', maat: 192, radius: 4, lucht: 0 },
  { bestand: 'public/icons/icon-512.png', maat: 512, radius: 4, lucht: 0 },
  { bestand: 'public/icons/apple-touch-icon.png', maat: 180, radius: 0, lucht: 2 },
  // Android knipt hier een vorm uit: alles wat telt, binnen de binnenste 80%.
  { bestand: 'public/icons/maskable-512.png', maat: 512, radius: 0, lucht: 5 },
]

const browser = await chromium.launch()

for (const { bestand, maat, radius, lucht } of ICONEN) {
  const page = await browser.newPage({ viewport: { width: maat, height: maat }, deviceScaleFactor: 1 })
  await page.setContent(`<!doctype html><html><body style="margin:0">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="${maat}" height="${maat}">
      <rect width="32" height="32" rx="${radius}" fill="${INKT}"/>
      ${merk(lucht)}
    </svg></body></html>`)
  writeFileSync(bestand, await page.screenshot({ omitBackground: false }))
  console.log(`${bestand} · ${maat}px`)
  await page.close()
}

await browser.close()
