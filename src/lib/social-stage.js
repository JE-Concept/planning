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

import { asDate, dayKey } from './dates'
import { eindeVan } from './eventdagen'

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

/**
 * Van het socialbord af, maar niet weg.
 *
 * ── Waarom een eigen vlag en niet `archived` ──────────────────────────────
 * Het bord liep vol: negenenzestig kaarten in de eerste kolom, bijna allemaal
 * events van maanden geleden waar nooit nog content van komt. `archived` kon
 * dat niet oplossen — dat haalt het event zelf weg, van het eventbord, uit de
 * kalender en uit de facturatie. Hier gaat het alleen over het socialbord.
 *
 * `socialWanted: false` evenmin: dat zegt "dit event levert geen content op",
 * en dat is iets anders dan "dit is voorbij". Wie later toch nog een foto van
 * die trouw wil posten, zet de kaart terug en ziet dan de stand die ze had.
 *
 * Er wordt niet op gefilterd in de query, alleen in de browser: dan hoeft het
 * veld niet op elk bestaand event te staan (zie CLAUDE.md over `== false`).
 */
export const isSociaalGearchiveerd = (task) => task?.socialArchived === true

/** De laatste dag van een event, ook voor de oude kaarten met alleen een deadline. */
function laatsteDag(task) {
  return eindeVan(task) ?? asDate(task?.dueDate) ?? null
}

/**
 * Hoort deze kaart bij "alles van vóór vandaag archiveren"?
 *
 * Wat gepost is, is klaar, wanneer het event ook was. Wat nog openstaat gaat
 * mee als het event voorbij is: een event van gisteren hoort er nog bij —
 * daar moeten de foto's net van komen — vandaar "vóór vandaag" en niet "vóór
 * nu". Een kaart zonder datum blijft staan; daar valt niets over te zeggen.
 */
export function moetNaarSociaalArchief(task, vandaag = new Date()) {
  if (!task || isSociaalGearchiveerd(task)) return false
  if (stageOf(task) === 'posted') return true
  const dag = laatsteDag(task)
  return Boolean(dag) && dayKey(dag) < dayKey(vandaag)
}
