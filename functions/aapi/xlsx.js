/**
 * Een xlsx lezen, zonder bibliotheek.
 *
 * ── Waarom geen pakket ────────────────────────────────────────────────────
 * Een xlsx is een zip met XML erin, en wat wij ervan nodig hebben is één blad
 * met platte cellen: geen formules, geen opmaak, geen datumgetallen (AAPI
 * schrijft zijn tijdstippen als tekst). Dat is honderd regels.
 *
 * Daar staat tegenover wat een pakket meebrengt. SheetJS komt niet meer van
 * npm maar van een eigen server en heeft een verleden met kwetsbaarheden;
 * ExcelJS sleept een halve officeketen mee voor een bestand van vijftien
 * kilobyte. Dit project draait op vijf afhankelijkheden en schreef zijn eigen
 * vertalingen; een zesde erbij voor dit is niet in verhouding.
 *
 * Wat deze lezer niet kan, en met opzet niet: gedeelde formules, cellen met
 * opmaak die de waarde bepaalt, datums als getal sinds 1900, bestanden van
 * honderden megabytes. Komt een van die dingen ooit binnen, dan hoort er een
 * duidelijke fout te staan en geen stilzwijgend verkeerd getal — vandaar dat
 * een onbekend celtype hieronder niets teruggeeft in plaats van iets te gokken.
 *
 * Geen imports buiten `node:zlib`, zodat dit te testen is zonder de rest.
 */
import { inflateRawSync } from 'node:zlib'

const EOCD = 0x06054b50

/**
 * De leden van een zip, uitgepakt.
 *
 * Via het centrale register achteraan en niet door het bestand heen lezen: dat
 * register is de waarheid over waar elk lid staat, en lokale koppen mogen
 * liegen over de grootte (dan staat ze pas ná de gegevens).
 */
export function zipLeden(buffer) {
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer)

  let eocd = buf.length - 22
  while (eocd >= 0 && buf.readUInt32LE(eocd) !== EOCD) eocd -= 1
  if (eocd < 0) throw new Error('Dit is geen geldig xlsx-bestand (geen zip-register gevonden).')

  const aantal = buf.readUInt16LE(eocd + 10)
  let p = buf.readUInt32LE(eocd + 16)
  const leden = {}

  for (let i = 0; i < aantal; i += 1) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('Het zip-register van dit bestand klopt niet.')
    const naamLengte = buf.readUInt16LE(p + 28)
    const extraLengte = buf.readUInt16LE(p + 30)
    const commentLengte = buf.readUInt16LE(p + 32)
    const methode = buf.readUInt16LE(p + 10)
    const gepakt = buf.readUInt32LE(p + 20)
    const plek = buf.readUInt32LE(p + 42)
    const naam = buf.toString('utf8', p + 46, p + 46 + naamLengte)

    // De lokale kop draagt zijn eigen naam- en extravelden; de gegevens
    // beginnen daarachter.
    const start = plek + 30 + buf.readUInt16LE(plek + 26) + buf.readUInt16LE(plek + 28)
    const rauw = buf.subarray(start, start + gepakt)
    if (methode !== 0 && methode !== 8) throw new Error(`Dit bestand gebruikt een onbekende compressie (${methode}).`)
    leden[naam] = methode === 0 ? rauw : inflateRawSync(rauw)

    p += 46 + naamLengte + extraLengte + commentLengte
  }

  return leden
}

/** XML-entiteiten terug naar tekst. `&amp;` als laatste, anders ontdubbelt het. */
function ontsnap(s) {
  return String(s)
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, '&')
}

/** De gedeelde strings. Een cel met type `s` is een nummer in deze lijst. */
function gedeeldeTeksten(xml) {
  if (!xml) return []
  return [...xml.matchAll(/<si>(.*?)<\/si>/gs)].map((si) =>
    // Een <si> kan uit meerdere <t>-stukken bestaan als er opmaak in zat.
    [...si[1].matchAll(/<t[^>]*>(.*?)<\/t>/gs)].map((t) => ontsnap(t[1])).join('')
  )
}

/** De kolomletters uit een celverwijzing: `BC12` → `BC`. */
const kolomVan = (ref) => /^([A-Z]+)/.exec(ref)?.[1] ?? ''

/**
 * Eén blad als lijst van rijen, elke rij een object met kolomletter → tekst.
 *
 * Alles komt er als tekst uit. Dat is geen luiheid maar de bron: AAPI schrijft
 * zijn tijdstippen, booleans en pauzeminuten allemaal als tekst, en wie hier
 * al begint te raden wat een getal is, raadt ook een keer verkeerd.
 */
export function leesBlad(leden, bladnaam = 'Data') {
  const werkboek = leden['xl/workbook.xml']?.toString('utf8')
  if (!werkboek) throw new Error('Dit bestand bevat geen werkboek; het is geen xlsx.')

  const bladen = [...werkboek.matchAll(/<sheet[^>]*name="([^"]*)"[^>]*r:id="([^"]*)"/g)]
    .map((m) => ({ naam: ontsnap(m[1]), rid: m[2] }))
  const blad = bladen.find((b) => b.naam === bladnaam)
  if (!blad) {
    throw new Error(
      `Dit bestand heeft geen blad "${bladnaam}". Gevonden: ${bladen.map((b) => b.naam).join(', ') || 'geen'}.`
    )
  }

  const rels = leden['xl/_rels/workbook.xml.rels']?.toString('utf8') ?? ''
  const doel = new RegExp(`<Relationship[^>]*Id="${blad.rid}"[^>]*Target="([^"]*)"`).exec(rels)?.[1]
  const pad = doel
    ? `xl/${doel.replace(/^\/?xl\//, '').replace(/^\.\//, '')}`
    : 'xl/worksheets/sheet1.xml'

  const xml = leden[pad]?.toString('utf8')
  if (!xml) throw new Error(`Het blad "${bladnaam}" staat niet in dit bestand.`)

  const teksten = gedeeldeTeksten(leden['xl/sharedStrings.xml']?.toString('utf8'))
  const rijen = []

  for (const rij of xml.matchAll(/<row[^>]*?(?:\/>|>(.*?)<\/row>)/gs)) {
    const cellen = {}
    for (const cel of (rij[1] ?? '').matchAll(/<c([^>]*)(?:\/>|>(.*?)<\/c>)/gs)) {
      const ref = /r="([A-Z]+\d+)"/.exec(cel[1])?.[1]
      if (!ref) continue
      const type = /t="([^"]+)"/.exec(cel[1])?.[1] ?? 'n'
      const inhoud = cel[2] ?? ''

      let waarde = null
      if (type === 's') {
        const nr = Number(/<v>(.*?)<\/v>/s.exec(inhoud)?.[1])
        waarde = teksten[nr] ?? ''
      } else if (type === 'inlineStr') {
        waarde = [...inhoud.matchAll(/<t[^>]*>(.*?)<\/t>/gs)].map((t) => ontsnap(t[1])).join('')
      } else if (type === 'str') {
        waarde = ontsnap(/<v>(.*?)<\/v>/s.exec(inhoud)?.[1] ?? '')
      } else if (type === 'n' || type === 'b') {
        waarde = /<v>(.*?)<\/v>/s.exec(inhoud)?.[1] ?? null
      }
      // Een celtype dat we niet kennen (een fout, een datum als getal) laten we
      // leeg: de rijcontrole hierboven ziet dan dat er iets ontbreekt en zegt
      // het, in plaats van dat er een verkeerde waarde doorglipt.

      if (waarde !== null && waarde !== '') cellen[kolomVan(ref)] = waarde
    }
    rijen.push(cellen)
  }

  return rijen
}

/** Het hele bestand in één keer: zip open, blad eruit, rijen terug. */
export function leesXlsx(buffer, bladnaam = 'Data') {
  return leesBlad(zipLeden(buffer), bladnaam)
}
