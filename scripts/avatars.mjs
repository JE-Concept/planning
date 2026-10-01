#!/usr/bin/env node
/**
 * De portretten uit de e-mailhandtekeningen naar avatars.
 *
 *   node scripts/avatars.mjs <map-met-uitgepakte-afbeeldingen>
 *
 * De handtekeningen zijn SVG's met het portret erin als base64. Daar komen
 * foto's uit van een halve megabyte en in staand formaat; een avatar is 34px
 * en vierkant. Dit knipt ze bij, centreert op het gezicht en schrijft ze als
 * JPEG van 256px — groot genoeg voor een scherm met dubbele puntdichtheid,
 * klein genoeg om naast elke taak te staan.
 *
 * Chromium doet het bijknippen, net als bij de iconen: die staat er al voor de
 * browsertest.
 */
import { chromium } from 'playwright'
import { readFileSync, writeFileSync } from 'node:fs'

const MAAT = 256

/*
  Per persoon de bron en waar het gezicht zit.

  `focus` is het midden van het gezicht als breukdeel van de foto, en `dekking`
  hoeveel van de breedte het vierkant beslaat — kleiner is dichterbij. Met die
  twee getallen is elke uitsnede na te rekenen in plaats van te proberen.

  Aïcha staat niet in deze lijst. Haar handtekening draagt geen portret maar
  een kiekje waarop ze wegkijkt en klein in beeld staat; dat wordt op 26px geen
  herkenbaar gezicht. Liever haar initialen dan een onherkenbare foto.
*/
const MENSEN = [
  { id: 'jasper', bestand: 'Jasper Hansen-1.png', focus: [0.5, 0.42], dekking: 0.92 },
  { id: 'maxine', bestand: 'Maxine Vanbrabant-1.jpeg', focus: [0.4, 0.43], dekking: 0.58 },
]

const map = process.argv[2]
if (!map) {
  console.error('Geef de map met de uitgepakte afbeeldingen mee.')
  process.exit(1)
}

const browser = await chromium.launch()

for (const { id, bestand, focus, dekking } of MENSEN) {
  const soort = bestand.endsWith('.jpeg') ? 'jpeg' : 'png'
  const data = `data:image/${soort};base64,${readFileSync(`${map}/${bestand}`).toString('base64')}`

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
  console.log(`public/team/${id}.jpg`)
  await page.close()
}

await browser.close()
