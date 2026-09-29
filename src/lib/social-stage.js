/**
 * Het socialproces van een event.
 *
 * Een event doorloopt op het eventbord de weg van aanvraag tot factuur. Zodra
 * het gefactureerd kan worden, begint er een tweede, kortere weg: de content
 * die eruit moet komen. Die twee horen niet in één kolommenrij — het eerste
 * gaat over geld en planning, het tweede over beeldmateriaal — en daarom heeft
 * social een eigen bord met een eigen stand per event.
 *
 * De stand staat op het event zelf (`socialStage`), niet in een aparte
 * collectie: het gaat over hetzelfde event, en zo blijft "waar staat dit" één
 * antwoord in plaats van twee die uiteen kunnen lopen.
 */

export const SOCIAL_STAGES = [
  {
    key: 'delivery',
    label: 'Social content delivery',
    hint: 'Beeld en tekst moeten nog binnenkomen.',
    color: '#8593a9',
    kind: 'open',
  },
  {
    key: 'ready',
    label: 'Social content ready',
    hint: 'Klaar om te plaatsen.',
    color: '#3377ff',
    kind: 'active',
  },
  {
    key: 'posted',
    label: 'Social content posted',
    hint: 'Staat online.',
    color: '#008844',
    kind: 'closed',
  },
]

export const SOCIAL_STAGE_KEYS = SOCIAL_STAGES.map((s) => s.key)

export const stageLabel = (key) => SOCIAL_STAGES.find((s) => s.key === key)?.label ?? 'Geen'

/**
 * Vanaf welke status van het eventbord een event op het socialbord hoort.
 *
 * Op naam, niet op id: dezelfde naam betekent hetzelfde, ook op een ander
 * bord, en de namen zijn wat het team gebruikt. Wordt een kolom hernoemd, dan
 * valt de koppeling stil — daarom staat dit rijtje op één plek en niet
 * verspreid door de app.
 */
export const SOCIAL_VANAF = ['ready to invoice', 'invoiced', 'complete']

const norm = (v) => (v ?? '').toString().trim().toLowerCase()

/** Is dit event ver genoeg om er social content van te verwachten? */
export function isSocialEligible(task) {
  return SOCIAL_VANAF.includes(norm(task?.statusName))
}

/**
 * Hoort dit event vandaag op het socialbord?
 *
 * Twee manieren om erop te komen: ver genoeg staan op het eventbord, of met
 * de hand aangezet. En één manier om eraf te blijven: uitgezet, want niet elk
 * event levert content op — een vergaderzaal voor tien man meestal niet.
 */
export function heeftSocial(task) {
  if (task?.socialWanted === false) return false
  return Boolean(task?.socialStage) || task?.socialWanted === true || isSocialEligible(task)
}

/** De stand van een event, met de beginfase als het er nog geen heeft. */
export const stageOf = (task) =>
  SOCIAL_STAGE_KEYS.includes(task?.socialStage) ? task.socialStage : 'delivery'
