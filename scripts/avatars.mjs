#!/usr/bin/env node
/**
 * De portretten uit de e-mailhandtekeningen naar avatars.
 *
 *   node scripts/avatars.mjs <map-met-handtekening-svgs>
 *
 * De handtekeningen zijn SVG's met het portret erin als base64. Daar komen
 * foto's uit van een halve megabyte en in staand formaat; een avatar is 34px
 * en vierkant. Dit haalt het portret eruit, knipt het bij, centreert op het
 * gezicht en schrijft het als JPEG van 256px — groot genoeg voor een scherm met
 * dubbele puntdichtheid, klein genoeg om naast elke taak te staan.
 *
 * Chromium doet het bijknippen, net als bij de iconen: die staat er al voor de
 * browsertest.
 */
import { chromium } from 'playwright'
import { readFileSync, writeFileSync } from 'node:fs'

const MAAT = 256

/*
  Per persoon de bron en waar het gezicht zit.

  LET OP: de bestandsnamen in de ZIP kloppen niet met de inhoud. De handtekening
  in `Maxine Vanbrabant (2).svg` draagt de naam, functie en het adres van *Elke
  Motmans*; `Maxine Vanbrabant.svg` is Maxine. Daarom staat hier per persoon
  welk bestand het is en niet alleen een id dat op de naam lijkt — wie dit later
  opnieuw draait met een nieuwe ZIP moet eerst kijken wie er in staat.

  `focus` is het midden van het gezicht als breukdeel van de foto, en `dekking`
  hoeveel van de breedte het vierkant beslaat — kleiner is dichterbij. Met die
  twee getallen is elke uitsnede na te rekenen in plaats van te proberen.

  Aïcha staat niet in deze lijst. Haar handtekening draagt geen portret maar
  een kiekje waarop ze wegkijkt en klein in beeld staat; dat wordt op 26px geen
  herkenbaar gezicht. Liever haar initialen dan een onherkenbare foto.
*/
const MENSEN = [
  { id: 'jasper', svg: 'Jasper Hansen.svg', focus: [0.5, 0.42], dekking: 0.92 },
  { id: 'elke', svg: 'Maxine Vanbrabant (2).svg', focus: [0.4, 0.43], dekking: 0.58 },
  { id: 'maxine', svg: 'Maxine Vanbrabant.svg', focus: [0.5, 0.4], dekking: 0.78 },
]

/*
  Het portret is de grootste afbeelding in de SVG: de andere twee zijn het
  logo en de hexagonrand, en die blijven ruim onder de honderd kilobyte.
*/
function portretUit(pad) {
  const svg = readFileSync(pad, 'utf8')
  let grootste = null
  for (const m of svg.matchAll(/data:image\/(png|jpeg|jpg);base64,([A-Za-z0-9+/=\s]+)/g)) {
    const rauw = m[2].replace(/\s+/g, '')
    if (!grootste || rauw.length > grootste.rauw.length) grootste = { soort: m[1], rauw }
  }
  if (!grootste) throw new Error(`Geen afbeelding gevonden in ${pad}`)
  return `data:image/${grootste.soort};base64,${grootste.rauw}`
}

const map = process.argv[2]
if (!map) {
  console.error('Geef de map met de handtekening-SVGs mee.')
  process.exit(1)
}

const browser = await chromium.launch()

for (const { id, svg, focus, dekking } of MENSEN) {
  const data = portretUit(`${map}/${svg}`)

  const page = await browser.newPage({ viewport: { width: MAAT, height: MAAT }, deviceScaleFactor: 1 })

  // De foto wordt zo breed getekend dat het vierkant `dekking` van de breedte
  // beslaat, en dan verschoven tot het gezicht in het midden staat.
  await page.setContent(`<body style="margin:0">
    <div style="width:${MAAT}px;height:${MAAT}px;overflow:hidden;position:relative;background:#eef2f8">
      <img id="f" src="${data}" style="position:absolute;width:${Math.round(MAAT / dekking)}px">
    </div>
    <script>
      const img = document.getElementById('f')
      const plaats = () => {
        img.style.left = (${MAAT / 2} - ${focus[0]} * img.width) + 'px'
        img.style.top = (${MAAT / 2} - ${focus[1]} * img.height) + 'px'
      }
      img.complete ? plaats() : img.addEventListener('load', plaats)
    </script>
  </body>`)
  await page.waitForLoadState('networkidle')
  writeFileSync(`public/team/${id}.jpg`, await page.screenshot({ type: 'jpeg', quality: 86 }))
  console.log(`public/team/${id}.jpg  ←  ${svg}`)
  await page.close()
}

await browser.close()
