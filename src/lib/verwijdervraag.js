import { formatDuration } from './format'
import { tekst } from './i18n'

/**
 * De vraag die boven een verwijdering hangt.
 *
 * Er stond "Deze taak en alle subtaken definitief verwijderen?" — een zin die
 * bij een event met drie subtaken, twee bijlagen en een halve dag geboekte tijd
 * evenveel zegt als bij een lege taak. Wie hem leest weet niet wát hij weggooit,
 * en dat is precies het moment waarop je dat wil weten.
 *
 * Dus: de titel erin, en een opsomming van wat mee verdwijnt. Wat níét verdwijnt
 * hoort er ook bij — geboekte tijd blijft staan omdat het over iemands week gaat
 * — want anders durft niemand nog te verwijderen uit angst die uren kwijt te
 * spelen.
 *
 * Dit staat los van het scherm zodat de zin te lezen en te testen is zonder een
 * browser, en zodat er maar één versie van bestaat.
 *
 * De titel komt uit de database en blijft staan zoals hij daar staat; alleen de
 * zin eromheen volgt de taal waarin iemand werkt.
 */
export function verwijderVraag({ task, subtaken = 0, bijlagen = 0, soort = 'taak' }) {
  const titel = (task?.title ?? '').trim() || tekst('taaklib.verwijder.deze_taak')
  const weg = []

  // Onder een event hangen geen "subtaken" maar gewoon taken; wie leest wat hij
  // weggooit, moet er het woord in herkennen dat op het scherm staat.
  const stuk = soort === 'event' ? 'taaklib.verwijder.taak' : 'taaklib.verwijder.subtaak'
  if (subtaken > 0) weg.push(tekst(stuk, { aantal: subtaken }))
  if (bijlagen > 0) weg.push(tekst('taaklib.verwijder.bijlage', { aantal: bijlagen }))

  const reacties = Number(task?.commentCount ?? 0)
  if (reacties > 0) weg.push(tekst('taaklib.verwijder.reactie', { aantal: reacties }))

  const regels = [tekst('taaklib.verwijder.vraag', { titel })]
  if (weg.length) regels.push(tekst('taaklib.verwijder.weg_ook', { lijst: opsomming(weg) }))

  const geboekt = Number(task?.trackedSeconds ?? 0)
  if (geboekt > 0) {
    regels.push(tekst('taaklib.verwijder.tijd_blijft', { tijd: formatDuration(geboekt) }))
  }

  regels.push(tekst('taaklib.verwijder.onomkeerbaar'))
  return regels.join('\n\n')
}

/** "drie subtaken, twee bijlagen en een reactie" — met "en" voor het laatste. */
function opsomming(delen) {
  if (delen.length === 1) return delen[0]
  return `${delen.slice(0, -1).join(', ')} ${tekst('taaklib.en')} ${delen[delen.length - 1]}`
}
