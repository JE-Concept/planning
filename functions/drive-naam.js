/**
 * Hoe een map en een bestand in Drive heten, en wat voor soort iets is.
 *
 * Nul imports, zodat CI dit kan testen. De Drive-aanroepen zelf staan in
 * `drive.js`; hier staat alleen wat je aan een tekst kunt zien.
 *
 * ── Waarom de datum vooraan staat in de mapnaam ───────────────────────────
 * Omdat Drive op naam sorteert en iemand die in de gedeelde Drive bladert,
 * de mappen dan op volgorde van het seizoen ziet staan — niet op alfabet
 * van de klantnaam, waar "Blum" altijd boven "Trouw" komt, welk jaar ook.
 * De titel erachter is voor het herkennen; de datum voor het vinden.
 */

const ONGELDIG = /[\\/:*?"<>|]/g

/** Een naam die Drive aanvaardt en een mens herkent. Hoogstens 120 tekens. */
export function veiligeMapnaam(tekst, terugval = 'Zonder naam') {
  const schoon = String(tekst ?? '')
    .replace(ONGELDIG, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120)
    .trim()
  return schoon || terugval
}

/** De dag van een event als `2027-03-12`, uit wat Firestore ervan maakte. */
function dagVan(waarde) {
  const d = waarde?.toDate?.() ?? (waarde ? new Date(waarde) : null)
  if (!d || Number.isNaN(d.getTime())) return null
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** `2027-03-12 — Trouw Niels en Inez`, of zonder datum als die er niet is. */
export function mapnaamVoorEvent(event) {
  const dag = dagVan(event?.eventDate ?? event?.dueDate)
  const titel = veiligeMapnaam(event?.title, 'Event')
  return dag ? `${dag} — ${titel}` : titel
}

/** De klantnaam, of het id als er nog geen naam is. */
export const mapnaamVoorKlant = (klant, id) => veiligeMapnaam(klant?.name, `Klant ${id ?? ''}`.trim())

/**
 * Welke voorvertoning een bestand kan krijgen.
 *
 * Drive toont pdf's, afbeeldingen, Office- en Google-documenten in een
 * ingesloten venster; voor de rest is er alleen "openen in Drive". De app
 * hoeft niet te raden: dit zegt het.
 */
export function soortVan(mimeType = '') {
  const m = String(mimeType).toLowerCase()
  if (m.startsWith('image/')) return 'afbeelding'
  if (m === 'application/pdf') return 'pdf'
  if (m.startsWith('application/vnd.google-apps.')) return 'google'
  if (/(word|excel|powerpoint|officedocument|opendocument)/.test(m)) return 'kantoor'
  if (m.startsWith('video/')) return 'video'
  return 'bestand'
}

export const kanVoorvertonen = (mimeType) => ['afbeelding', 'pdf', 'google', 'kantoor', 'video'].includes(soortVan(mimeType))

/** De ingesloten weergave van Drive voor een bestand-id. */
export const voorvertoningVan = (driveId) => `https://drive.google.com/file/d/${encodeURIComponent(driveId)}/preview`

/**
 * Wat er van een Drive-bestand in Firestore komt te staan.
 *
 * Een selectie en geen doorgeefluik: Drive geeft tientallen velden terug, en
 * wat de app nodig heeft is wat er in de lijst staat en waar je klikt.
 */
export function rijVanDriveBestand(bestand, { taskId = null, customerId = null } = {}) {
  return {
    bron: 'drive',
    driveId: bestand.id,
    name: bestand.name ?? 'Bestand',
    contentType: bestand.mimeType ?? 'application/octet-stream',
    soort: soortVan(bestand.mimeType),
    size: Number(bestand.size) || 0,
    url: bestand.webViewLink ?? `https://drive.google.com/file/d/${bestand.id}/view`,
    voorvertoning: kanVoorvertonen(bestand.mimeType) ? voorvertoningVan(bestand.id) : null,
    iconLink: bestand.iconLink ?? null,
    thumbnailLink: bestand.thumbnailLink ?? null,
    modifiedTime: bestand.modifiedTime ?? null,
    taskId,
    customerId,
    postId: null,
  }
}
