import { formatDuration } from './format'

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
 */
export function verwijderVraag({ task, subtaken = 0, bijlagen = 0 }) {
  const titel = (task?.title ?? '').trim() || 'Deze taak'
  const weg = []

  if (subtaken > 0) weg.push(`${subtaken} ${subtaken === 1 ? 'subtaak' : 'subtaken'}`)
  if (bijlagen > 0) weg.push(`${bijlagen} ${bijlagen === 1 ? 'bijlage' : 'bijlagen'}`)

  const reacties = Number(task?.commentCount ?? 0)
  if (reacties > 0) weg.push(`${reacties} ${reacties === 1 ? 'reactie' : 'reacties'}`)

  const regels = [`“${titel}” definitief verwijderen?`]
  if (weg.length) regels.push(`Weg zijn dan ook: ${opsomming(weg)}.`)

  const geboekt = Number(task?.trackedSeconds ?? 0)
  if (geboekt > 0) {
    regels.push(`De ${formatDuration(geboekt)} geboekte tijd blijft bestaan, maar verliest haar taak.`)
  }

  regels.push('Dit kan niet ongedaan gemaakt worden. Archiveren bewaart alles.')
  return regels.join('\n\n')
}

/** "drie subtaken, twee bijlagen en een reactie" — met "en" voor het laatste. */
function opsomming(delen) {
  if (delen.length === 1) return delen[0]
  return `${delen.slice(0, -1).join(', ')} en ${delen[delen.length - 1]}`
}
