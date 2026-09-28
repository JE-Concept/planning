/**
 * Wie een actiepunt krijgt.
 *
 * Bewust los van summarise.js: dit is pure logica, en een test erop hoort niet
 * de Anthropic-SDK nodig te hebben om te kunnen draaien. Dat kostte één rode
 * CI-run om te leren.
 */

/**
 * De voorgestelde naam naar een echt profiel.
 *
 * Op e-mailadres, dan op volledige naam, dan op voornaam — maar die laatste
 * alleen als er precies één kandidaat is. Twee collega's die Jan heten maken
 * van raden een fout die niemand opmerkt.
 */
export function matchAssignee(naam, profiles) {
  if (!naam || naam.trim().toLowerCase() === 'onbekend') return null
  const gezocht = naam.trim().toLowerCase()

  const opEmail = profiles.find((p) => (p.email ?? '').toLowerCase() === gezocht)
  if (opEmail) return opEmail.id

  const opNaam = profiles.find((p) => (p.fullName ?? '').toLowerCase() === gezocht)
  if (opNaam) return opNaam.id

  const voornaam = gezocht.split(' ')[0]
  const kandidaten = profiles.filter(
    (p) => (p.fullName ?? '').toLowerCase().split(' ')[0] === voornaam
  )
  return kandidaten.length === 1 ? kandidaten[0].id : null
}
