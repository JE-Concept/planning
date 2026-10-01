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

export function keurBestand(file) {
  if (!file) return 'profiel.foto_geen_bestand'
  // Het type is leeg bij een bestand dat de browser niet herkent; dan vertrouwen
  // we op de extensie noch op het gokwerk, en zeggen we het gewoon.
  if (!SOORTEN.includes(String(file.type).toLowerCase())) return 'profiel.foto_geen_beeld'
  if (file.size > MAX_BYTES) return 'profiel.foto_te_groot'
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
