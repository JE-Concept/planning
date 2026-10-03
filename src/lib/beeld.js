/**
 * Een foto vierkant maken voor een avatar.
 *
 * Een profielfoto komt van een telefoon: staand, drie megapixel, vier megabyte.
 * Een avatar is 34 pixels. Die foto ongewijzigd in de opslag zetten en hem in
 * de browser laten verkleinen betekent vier megabyte over de lijn voor elk
 * gezicht in elke lijst, en dat op een telefoon op de werf.
 *
 * Daarom wordt er geknipt en verkleind vóór het uploaden. Het rekenwerk staat
 * hier apart van de browser, zodat het na te rekenen is zonder canvas.
 */

/** De zijde van de avatar in pixels — genoeg voor een scherm met dubbele puntdichtheid. */
export const AVATARMAAT = 256

/**
 * Welk vierkant uit de bron geknipt wordt.
 *
 * Het grootste vierkant dat erin past, gecentreerd. Bij een staande foto is dat
 * horizontaal het midden en verticaal ook — niet bovenaan: wie een pasfoto
 * neemt staat in het midden, en wie een kiekje neemt ook. Hoger knippen snijdt
 * kinnen af op de ene foto om kruinen te redden op de andere.
 *
 * Een foto die al kleiner is dan de avatarmaat wordt niet opgeblazen: dan komt
 * er geen scherpte bij, alleen bytes.
 */
export function vierkantPlan(breedte, hoogte, maat = AVATARMAAT) {
  if (!(breedte > 0) || !(hoogte > 0)) throw new Error('Deze afbeelding heeft geen afmetingen.')

  const zijde = Math.min(breedte, hoogte)
  return {
    x: Math.round((breedte - zijde) / 2),
    y: Math.round((hoogte - zijde) / 2),
    zijde,
    uit: Math.min(maat, zijde),
  }
}

/** Wat er aan bestanden door mag, en tot hoe groot. */
export const MAX_BYTES = 10 * 1024 * 1024
const SOORTEN = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif']

/**
 * Wat er mis is met een bestand, als code — niet als tekstsleutel.
 *
 * Dit stond hier eerst als tekstsleutel van het profiel, en dat klopte zolang
 * alleen het profiel foto's had. Nu laadt ook het magazijn er, en dat scherm
 * heeft de woordenlijst van het profiel niet. Wie de klacht toont, kiest zelf
 * zijn woorden — zie KLACHT in data/profiel.js en FOTOKLACHT in data/materiaal.js.
 * (Geen sleutels in deze uitleg: de woordenlijsttest leest ook commentaar.)
 */
export function keurBestand(file) {
  if (!file) return 'geen_bestand'
  // Het type is leeg bij een bestand dat de browser niet herkent; dan vertrouwen
  // we op de extensie noch op het gokwerk, en zeggen we het gewoon.
  if (!SOORTEN.includes(String(file.type).toLowerCase())) return 'geen_beeld'
  if (file.size > MAX_BYTES) return 'te_groot'
  return null
}

/**
 * De foto naar een vierkante JPEG van `maat` pixels, als Blob.
 *
 * Draait in de browser; `createImageBitmap` leest ook wat een <img> niet altijd
 * aankan, en respecteert de oriëntatie uit de EXIF — zonder dat staat een foto
 * van een telefoon op zijn kant.
 */
export async function vierkanteFoto(file, maat = AVATARMAAT) {
  const bron = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const { x, y, zijde, uit } = vierkantPlan(bron.width, bron.height, maat)

  const doek = document.createElement('canvas')
  doek.width = uit
  doek.height = uit
  doek.getContext('2d').drawImage(bron, x, y, zijde, zijde, 0, 0, uit, uit)
  bron.close?.()

  const blob = await new Promise((klaar) => doek.toBlob(klaar, 'image/jpeg', 0.86))
  if (!blob) throw new Error('De foto kon niet omgezet worden.')
  return blob
}

/** De langste zijde van een productfoto. Groter ziet niemand op een telefoon. */
export const FOTOMAAT = 1600

/**
 * Hoe een foto verkleind wordt zonder te vervormen.
 *
 * Alleen kleiner, nooit groter: een foto van 800 pixels opblazen naar 1600
 * maakt ze wazig en vier keer zo zwaar. En de verhouding blijft — een tent
 * die 4:3 gefotografeerd is, blijft 4:3; de kaart op de site snijdt zelf bij
 * met `object-fit: cover`.
 */
export function verkleinPlan(breedte, hoogte, maat = FOTOMAAT) {
  const langste = Math.max(breedte, hoogte)
  if (langste <= maat) return { breedte, hoogte }
  const factor = maat / langste
  return { breedte: Math.round(breedte * factor), hoogte: Math.round(hoogte * factor) }
}

/**
 * Een productfoto klaar voor de opslag: verkleind, als JPEG.
 *
 * In de browser en niet op de server, want dan gaat er 300 kB over de lijn
 * in plaats van 12 MB — en op een telefoon in het magazijn is dat het
 * verschil tussen "klaar" en "ik probeer het straks thuis".
 */
export async function verkleinFoto(file, maat = FOTOMAAT) {
  const bron = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const { breedte, hoogte } = verkleinPlan(bron.width, bron.height, maat)

  const doek = document.createElement('canvas')
  doek.width = breedte
  doek.height = hoogte
  doek.getContext('2d').drawImage(bron, 0, 0, breedte, hoogte)
  bron.close?.()

  const blob = await new Promise((klaar) => doek.toBlob(klaar, 'image/jpeg', 0.84))
  if (!blob) throw new Error('De foto kon niet omgezet worden.')
  return blob
}
