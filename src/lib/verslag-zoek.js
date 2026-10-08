/**
 * Zoeken in de notities, en in de verslagen van het teamoverleg die er sinds
 * kort ook toe horen.
 *
 * Een verslag is pas iets waard als je het terugvindt. "Hebben we die
 * leverancier besproken, en wat zeiden we toen?" is de vraag die mensen aan een
 * archief stellen — niet "toon me het verslag van 21 september". Vandaar dat er
 * gezocht wordt in wat er staat: de samenvatting én de actiepunten die eruit
 * kwamen.
 *
 * Het zoeken gebeurt in de browser, op wat er al binnen is. Firestore kan geen
 * tekst doorzoeken zonder een tweede dienst ernaast, en een team dat een paar
 * verslagen per maand maakt heeft die dienst niet nodig: de hele reeks past in
 * het geheugen en staat er al voor de lijst.
 */

/**
 * Tekst vergelijkbaar maken.
 *
 * Kleine letters, en de accenten eruit: wie "Aicha" typt moet "Aïcha" vinden,
 * en wie "cafe" typt "café". Op een Belgisch toetsenbord is dat geen
 * uitzondering maar de regel.
 */
export function plat(tekst) {
  return (tekst ?? '')
    .toString()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/** De losse woorden van een zoekterm; elk woord moet ergens voorkomen. */
export function zoekwoorden(term) {
  return plat(term).split(' ').filter(Boolean)
}

/**
 * Alles wat aan één verslag hangt, als één stuk tekst.
 *
 * Titel, datum, deelnemers, elk punt uit de samenvatting en elk actiepunt.
 * Het staat allemaal in dezelfde hooiberg omdat iemand die zoekt niet weet
 * waar zijn woord in stond — en dat ook niet hoeft te weten.
 */
export function verslagTekst(verslag, acties = []) {
  const delen = [
    verslag?.titel,
    verslag?.datum,
    // Een gewone notitie heeft geen samenvatting maar een tekst, en wat ze
    // raakt telt ook: wie "Blum" zoekt, wil de notitie aan de klant Blum.
    verslag?.tekst,
    ...(verslag?.koppelingen ?? []).map((k) => k?.label),
    ...(verslag?.deelnemers ?? []),
    ...(verslag?.samenvatting ?? []).flatMap((p) => [p?.onderwerp, p?.tekst]),
    ...acties.flatMap((t) => [t?.title, t?.description]),
  ]
  return plat(delen.filter(Boolean).join(' '))
}

/** Hoort dit verslag bij deze zoekterm? Alle woorden moeten erin staan. */
export function past(verslag, acties, term) {
  const woorden = zoekwoorden(term)
  if (woorden.length === 0) return true
  const hooiberg = verslagTekst(verslag, acties)
  return woorden.every((w) => hooiberg.includes(w))
}

/**
 * De verslagen die bij de zoekterm horen, met de regels die de treffer
 * veroorzaakten erbij.
 *
 * Die regels zijn het halve antwoord: een lijst van drie verslagen zonder te
 * zeggen wáárom ze er staan, laat iemand alsnog drie verslagen openen. Een
 * lege zoekterm geeft alles terug, zonder treffers — dan is de lijst gewoon
 * de lijst.
 */
export function zoekVerslagen({ verslagen, actiesPerVerslag = {}, term }) {
  const woorden = zoekwoorden(term)

  return (verslagen ?? [])
    .map((verslag) => {
      const acties = actiesPerVerslag[verslag.taskId ?? verslag.id] ?? []
      if (!past(verslag, acties, term)) return null
      if (woorden.length === 0) return { ...verslag, treffers: [] }

      const raak = (tekst) => {
        const p = plat(tekst)
        return woorden.some((w) => p.includes(w))
      }

      const treffers = [
        ...(verslag.tekst && raak(verslag.tekst)
          ? [{ soort: 'tekst', tekst: uittreksel(verslag.tekst, woorden), detail: '' }]
          : []),
        ...(verslag.samenvatting ?? [])
          .filter((p) => raak(`${p?.onderwerp ?? ''} ${p?.tekst ?? ''}`))
          .map((p) => ({ soort: 'samenvatting', tekst: p?.onderwerp ?? '', detail: p?.tekst ?? '' })),
        ...acties
          .filter((t) => raak(`${t?.title ?? ''} ${t?.description ?? ''}`))
          .map((t) => ({ soort: 'actiepunt', tekst: t?.title ?? '', detail: '' })),
      ]

      return { ...verslag, treffers }
    })
    .filter(Boolean)
}

/**
 * Het stukje tekst rond de eerste treffer, zodat de lijst laat zien waaróm
 * een notitie er staat zonder de hele notitie te tonen.
 */
export function uittreksel(tekst, woorden, breedte = 60) {
  const schoon = (tekst ?? '').toString().replace(/\s+/g, ' ').trim()
  const p = plat(schoon)
  const plek = Math.min(...woorden.map((w) => p.indexOf(w)).filter((i) => i >= 0))
  if (!Number.isFinite(plek) || schoon.length <= breedte * 2) return schoon
  const van = Math.max(0, plek - breedte / 2)
  return `${van > 0 ? '…' : ''}${schoon.slice(van, van + breedte * 2).trim()}${van + breedte * 2 < schoon.length ? '…' : ''}`
}

/** De actiepunten gegroepeerd per verslag — de vorm die `zoekVerslagen` wil. */
export function groepeerActies(taken) {
  const uit = {}
  for (const taak of taken ?? []) {
    const sleutel = taak?.meetingId
    if (!sleutel) continue
    if (!uit[sleutel]) uit[sleutel] = []
    uit[sleutel].push(taak)
  }
  return uit
}
