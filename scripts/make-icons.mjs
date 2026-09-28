#!/usr/bin/env node
/**
 * Maakt de app-iconen als PNG, zonder beeldbibliotheek.
 *
 *   node scripts/make-icons.mjs
 *
 * Waarom met de hand: een geïnstalleerde app heeft PNG's nodig — iOS leest geen
 * SVG voor het beginscherm en de manifest-iconen moeten raster zijn. Op deze
 * machine staat geen ImageMagick, geen rsvg, geen sharp, en een merk-icoon is
 * te klein om daar een build-afhankelijkheid voor binnen te halen. Het icoon is
 * ook maar drie afgeronde balken (hetzelfde teken als de favicon), dus dat
 * rasteren we zelf: vier keer bemonsterd voor gladde randen, daarna deflate en
 * de drie chunks die een PNG nodig heeft.
 *
 * De maskable variant houdt 20% rand vrij: Android snijdt er een cirkel of een
 * druppel uit, en wat in die rand staat is weg.
 */

import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const NAVY = [17, 37, 80] // #112550 — dezelfde kleur als de themekleur
const BALKEN = [
  { x: 6 / 32, y: 8 / 32, w: 5.5 / 32, h: 16 / 32, kleur: [51, 119, 255] },
  { x: 13.25 / 32, y: 8 / 32, w: 5.5 / 32, h: 10 / 32, kleur: [142, 190, 255] },
  { x: 20.5 / 32, y: 8 / 32, w: 5.5 / 32, h: 13 / 32, kleur: [217, 232, 255] },
]

/** Hoeveel van deze pixel binnen de afgeronde rechthoek valt, 0…1. */
function dekking(px, py, { x, y, w, h, r }, monsters = 4) {
  let raak = 0
  for (let sy = 0; sy < monsters; sy += 1) {
    for (let sx = 0; sx < monsters; sx += 1) {
      const mx = px + (sx + 0.5) / monsters
      const my = py + (sy + 0.5) / monsters
      if (mx < x || mx > x + w || my < y || my > y + h) continue

      // Alleen in de hoeken is het geen rechthoek meer.
      const dx = Math.max(x + r - mx, mx - (x + w - r), 0)
      const dy = Math.max(y + r - my, my - (y + h - r), 0)
      if (dx * dx + dy * dy <= r * r) raak += 1
    }
  }
  return raak / (monsters * monsters)
}

function meng(onder, boven, alfa) {
  return onder.map((c, i) => Math.round(c * (1 - alfa) + boven[i] * alfa))
}

function teken(maat, { padding = 0, radius = 0.22, achtergrond = NAVY } = {}) {
  const pixels = Buffer.alloc(maat * maat * 4)
  const binnen = maat * (1 - 2 * padding)
  const start = maat * padding

  const vormen = [
    { x: start, y: start, w: binnen, h: binnen, r: binnen * radius, kleur: achtergrond },
    ...BALKEN.map((b) => ({
      x: start + b.x * binnen,
      y: start + b.y * binnen,
      w: b.w * binnen,
      h: b.h * binnen,
      r: (1.6 / 32) * binnen,
      kleur: b.kleur,
    })),
  ]

  for (let y = 0; y < maat; y += 1) {
    for (let x = 0; x < maat; x += 1) {
      let kleur = achtergrond
      let alfa = 0

      for (const vorm of vormen) {
        const d = dekking(x, y, vorm)
        if (d === 0) continue
        kleur = alfa === 0 ? vorm.kleur : meng(kleur, vorm.kleur, d)
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
  // Android snijdt hier een vorm uit; alles binnen 80% blijft zeker staan.
  { naam: 'maskable-512.png', maat: 512, padding: 0.1, radius: 0.5 },
  // iOS zet zijn eigen afronding op het beginschermicoon, dus vierkant aan.
  { naam: 'apple-touch-icon.png', maat: 180, radius: 0 },
]

mkdirSync(join(root, 'public/icons'), { recursive: true })

for (const { naam, maat, ...opties } of ICONEN) {
  const bestand = join(root, 'public/icons', naam)
  writeFileSync(bestand, png(maat, teken(maat, opties)))
  console.log(`${naam.padEnd(22)} ${maat}×${maat}`)
}
