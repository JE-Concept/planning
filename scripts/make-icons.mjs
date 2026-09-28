#!/usr/bin/env node
/**
 * Maakt de app-iconen als PNG, zonder beeldbibliotheek.
 *
 *   node scripts/make-icons.mjs
 *
 * Waarom met de hand: een geïnstalleerde app heeft PNG's nodig — iOS leest geen
 * SVG voor het beginscherm — en op deze machine staat geen ImageMagick, geen
 * rsvg en geen sharp. Het merk is geen foto maar een letterteken, dus het wordt
 * hier uit rechthoeken en ringen opgebouwd en vier keer bemonsterd voor gladde
 * randen. Daarna deflate en de drie chunks die een PNG nodig heeft.
 *
 * Het teken: de JE-monogram van JE Concept, in de huisletter nagebouwd — dikke
 * stammen, dunne dwarsstreken, zoals de Playfair Display van het logo. Eronder
 * de drie balken die ook de favicon zijn. Een echt logobestand bestaat niet;
 * het merk ís die twee letters.
 *
 * De maskable variant houdt rand vrij: Android snijdt er een cirkel of een
 * druppel uit, en wat in die rand staat is weg.
 */

import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const NAVY = [17, 37, 80] // #112550 — ook de themekleur van de app
const WIT = [255, 255, 255]
const BALKKLEUREN = [
  [51, 119, 255], // #3377FF
  [142, 190, 255], // #8EBEFF
  [217, 232, 255], // #D9E8FF
]

// ─── Vormen ─────────────────────────────────────────────────────────────────
//
// Alles staat in een eenheidsvierkant (0…1). Het tekenen schaalt dat naar de
// gevraagde maat, zodat 180 en 512 hetzelfde beeld geven.

const rect = (x, y, w, h, r = 0) => ({ type: 'rect', x, y, w, h, r })

/** Een stuk van een ring — de bocht onderaan de J. */
const boog = (cx, cy, buiten, binnen) => ({ type: 'boog', cx, cy, buiten, binnen })

function raakt(vorm, x, y) {
  if (vorm.type === 'rect') {
    if (x < vorm.x || x > vorm.x + vorm.w || y < vorm.y || y > vorm.y + vorm.h) return false
    if (!vorm.r) return true
    // Alleen in de hoeken is het geen rechthoek meer.
    const dx = Math.max(vorm.x + vorm.r - x, x - (vorm.x + vorm.w - vorm.r), 0)
    const dy = Math.max(vorm.y + vorm.r - y, y - (vorm.y + vorm.h - vorm.r), 0)
    return dx * dx + dy * dy <= vorm.r * vorm.r
  }

  // De onderste helft van de ring: dat is precies de bocht van de J.
  const dx = x - vorm.cx
  const dy = y - vorm.cy
  if (dy < 0) return false
  const d = Math.hypot(dx, dy)
  return d <= vorm.buiten && d >= vorm.binnen
}

/** Hoeveel van deze pixel binnen de vormen valt, 0…1. */
function dekking(vormen, px, py, schaal, monsters = 4) {
  let raak = 0
  for (let sy = 0; sy < monsters; sy += 1) {
    for (let sx = 0; sx < monsters; sx += 1) {
      const x = (px + (sx + 0.5) / monsters) / schaal
      const y = (py + (sy + 0.5) / monsters) / schaal
      if (vormen.some((v) => raakt(v, x, y))) raak += 1
    }
  }
  return raak / (monsters * monsters)
}

// ─── Het teken ──────────────────────────────────────────────────────────────

const STAM = 0.075 // dikte van een stam
const DWARS = 0.038 // dikte van een dwarsstreek — het contrast van een didone

/** De J en de E, plus de drie balken eronder. */
function monogram({ dx, dy }) {
  const v = (x, y, w, h, r) => rect(x + dx, y + dy, w, h, r)
  const b = (cx, cy, buiten, binnen) => boog(cx + dx, cy + dy, buiten, binnen)

  // De J: stam tot op de bocht, en de bocht eindigt op dezelfde lijn als de E.
  const bocht = 0.115
  const j = [
    v(0.3, 0.26, STAM, 0.545 - 0.26),
    b(0.375 - bocht, 0.66 - bocht, bocht, bocht - STAM),
    v(0.2475, 0.26, 0.18, 0.024, 0.008), // schreef bovenaan
  ]

  // De E: de armen beginnen ín de stam, anders laat hun afronding een keep
  // achter op de plek waar ze samenkomen.
  const e = [
    v(0.46, 0.26, STAM, 0.4), // stam
    v(0.46, 0.26, 0.205, DWARS + 0.004, 0.006), // bovenarm
    v(0.46, 0.44, 0.165, DWARS - 0.006, 0.006), // middenarm, dunner
    v(0.46, 0.622 - 0.004, 0.215, DWARS + 0.004, 0.006), // onderarm, de breedste
  ]

  // De balken staan onder het teken en dus in het midden van het vlak zelf,
  // niet mee verschoven met de letters.
  const balken = BALKKLEUREN.map((kleur, i) => ({
    kleur,
    vormen: [rect(0.5 - 0.1475 + i * 0.115, 0.745 + dy, 0.09, 0.042, 0.021)],
  }))

  return [{ kleur: WIT, vormen: [...j, ...e] }, ...balken]
}

function meng(onder, boven, alfa) {
  return onder.map((c, i) => Math.round(c * (1 - alfa) + boven[i] * alfa))
}

/**
 * Het vlak loopt altijd tot de rand; alleen het teken krimpt.
 *
 * Dat is het hele punt van een maskable icoon: Android snijdt er zelf een vorm
 * uit, dus de achtergrond moet doorlopen tot in de hoeken — anders staat daar
 * niets zodra het masker ruimer is dan gedacht — terwijl het teken binnen de
 * veilige 80% moet blijven.
 */
function teken(maat, { padding = 0, radius = 0.22 } = {}) {
  const pixels = Buffer.alloc(maat * maat * 4)
  const schaal = maat * (1 - 2 * padding)
  const rand = maat * padding

  const vlak = { kleur: NAVY, vormen: [rect(0, 0, 1, 1, radius)] }
  const lagen = monogram({ dx: 0.1025, dy: -0.025 })

  for (let y = 0; y < maat; y += 1) {
    for (let x = 0; x < maat; x += 1) {
      let kleur = NAVY
      let alfa = dekking(vlak.vormen, x, y, maat)

      for (const laag of lagen) {
        const d = dekking(laag.vormen, x - rand, y - rand, schaal)
        if (d === 0) continue
        kleur = alfa === 0 ? laag.kleur : meng(kleur, laag.kleur, d)
        alfa = Math.max(alfa, d)
      }

      const i = (y * maat + x) * 4
      pixels[i] = kleur[0]
      pixels[i + 1] = kleur[1]
      pixels[i + 2] = kleur[2]
      pixels[i + 3] = Math.round(alfa * 255)
    }
  }

  return pixels
}

// ─── PNG ────────────────────────────────────────────────────────────────────

const crcTabel = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

function crc32(buf) {
  let c = 0xffffffff
  for (const byte of buf) c = crcTabel[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const lengte = Buffer.alloc(4)
  lengte.writeUInt32BE(data.length)
  const lichaam = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const som = Buffer.alloc(4)
  som.writeUInt32BE(crc32(lichaam))
  return Buffer.concat([lengte, lichaam, som])
}

function png(maat, pixels) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(maat, 0)
  ihdr.writeUInt32BE(maat, 4)
  ihdr[8] = 8 // bits per kanaal
  ihdr[9] = 6 // RGBA
  // 10, 11, 12: deflate, standaardfilter, niet interlaced — alle drie 0.

  // Elke rij krijgt een filterbyte 0 ervoor: geen filter. Het icoon is klein,
  // en een slimmere filter wint hier hooguit een paar honderd bytes.
  const rijen = Buffer.alloc(maat * (maat * 4 + 1))
  for (let y = 0; y < maat; y += 1) {
    pixels.copy(rijen, y * (maat * 4 + 1) + 1, y * maat * 4, (y + 1) * maat * 4)
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(rijen, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// ─── Schrijven ──────────────────────────────────────────────────────────────

const ICONEN = [
  { naam: 'icon-192.png', maat: 192 },
  { naam: 'icon-512.png', maat: 512 },
  // Android snijdt hier zelf een vorm uit: het vlak loopt door tot de rand,
  // het teken blijft binnen de veilige 80%.
  { naam: 'maskable-512.png', maat: 512, padding: 0.1, radius: 0 },
  // iOS zet zijn eigen afronding op het beginschermicoon, dus vierkant aan.
  { naam: 'apple-touch-icon.png', maat: 180, radius: 0 },
]

mkdirSync(join(root, 'public/icons'), { recursive: true })

for (const { naam, maat, ...opties } of ICONEN) {
  writeFileSync(join(root, 'public/icons', naam), png(maat, teken(maat, opties)))
  console.log(`${naam.padEnd(22)} ${maat}×${maat}`)
}
