import { deleteDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { COL, newRef, ref } from '@lib/collections'

/**
 * Eventtemplates: de taken die een nieuw event meekrijgt.
 *
 * Een taak in een template heeft een standaardpersoon, een aantal dagen vóór
 * het event (de deadline telt terug vanaf de eventdatum), een prioriteit, een
 * herhaling en een checklist. Templates beheert een beheerder in Instellingen.
 */

const tt = (title, whoName, offset, prio = '', subs = [], repeat = '') => ({
  id: Math.random().toString(36).slice(2, 10),
  title,
  whoName,
  who: null,
  offset,
  prio,
  subs,
  repeat,
})

/**
 * De templates uit het design. Ze gelden zolang er nog geen eigen
 * templates bewaard zijn; de eerste aanpassing in Instellingen schrijft ze weg.
 * De standaardpersoon staat als voornaam en wordt bij gebruik aan het
 * profiel met die voornaam gekoppeld.
 */
export const DEFAULT_TEMPLATES = [
  {
    // Wat er bij élk event moet gebeuren, van offerte tot factuur. Dat stond er
    // niet: wie geen bijzonder template koos begon met een leeg takenblad, en
    // dus werden personeel, materiaal, social en facturatie elke keer opnieuw
    // met de hand ingetikt. Facturatie krijgt een negatief aantal dagen — dat
    // werk komt ná het event, niet ervoor.
    id: 'nieuw-event',
    icon: 'calendar-days',
    name: 'Nieuw event',
    position: 0,
    tasks: [
      tt('Offerte opmaken en versturen', 'Jasper', 45, 'Hoog', ['Aantallen bevestigen', 'Formule en meerprijzen', 'Voorwaarden en voorschot']),
      tt('Voorschot 40% ontvangen', 'Elke', 30, 'Urgent'),
      tt('Personeel inplannen', 'Anneleen', 21, '', ['Bediening', 'Keuken', 'Op- en afbouw']),
      tt('Materiaal en verhuur vastleggen', 'Elke', 14, '', ['Tent en meubilair', 'Servies en linnen', 'Transport']),
      tt('Social content inplannen', 'Charish', 10, '', ['Sfeerbeelden aanvragen', 'Post inplannen']),
      tt('Draaiboek naar klant sturen', 'Jasper', 7),
      tt('Factureren en opvolgen', 'Elke', -3, 'Hoog'),
    ],
  },
  {
    id: 'huwelijk',
    icon: 'sparkles',
    name: 'Huwelijk',
    position: 1,
    tasks: [
      tt('Voorschot 40% ontvangen', 'Elke', 45, 'Urgent'),
      tt('Plaatsbezoek', 'Anneleen', 60, '', ['Stroom en water nagaan', 'Foto’s van de opstelling']),
      tt('Tent en vloer bevestigen', 'Elke', 30, 'Hoog', ['Offerte tent', 'Vloer en verlichting', 'Levering daags voordien']),
      tt('Sanitair reserveren', 'Elke', 21),
      tt('Menukeuze doorgeven aan traiteur', 'Anneleen', 14),
      tt('Drankenlijst finaliseren', 'Jasper', 10, '', ['Bubbels onthaal', 'Wijnen diner', 'Afterparty']),
      tt('Draaiboek naar klant sturen', 'Jasper', 7),
      tt('Opbouwploeg inplannen', 'Jasper', 5),
    ],
  },
  {
    id: 'bedrijfsevent',
    icon: 'users',
    name: 'Bedrijfsevent',
    position: 2,
    tasks: [
      tt('Briefing opvragen', 'Jasper', 60),
      tt('Offertes leveranciers opvragen', 'Elke', 45, '', ['Verhuur', 'Catering', 'Sanitair', 'Drank']),
      tt('Voorschot 40% ontvangen', 'Elke', 30, 'Urgent'),
      tt('Plaatsbezoek', 'Jasper', 30),
      tt('Personeelsplanning', 'Anneleen', 14),
      tt('Draaiboek', 'Jasper', 7),
    ],
  },
  {
    id: 'walking-dinner',
    icon: 'utensils',
    name: 'Walking dinner',
    position: 3,
    tasks: [
      tt('Menu vastleggen', 'Anneleen', 21),
      tt('Voorschot 40% ontvangen', 'Elke', 21, 'Urgent'),
      tt('Bediening inplannen', 'Anneleen', 10),
      tt('Materiaallijst', 'Elke', 7, '', ['Statafels', 'Servies', 'Linnen']),
    ],
  },
  { id: 'leeg', icon: 'file-text', name: 'Leeg event', position: 4, tasks: [] },
]

export const TEMPLATE_ICONS = [
  ['sparkles', 'Feest'],
  ['users', 'Team'],
  ['utensils', 'Eten'],
  ['music-4', 'Muziek'],
  ['lightbulb', 'Techniek'],
  ['calendar-days', 'Kalender'],
  ['file-text', 'Document'],
]

export const REPEAT_OPTIONS = [
  { value: '', label: 'Eenmalig' },
  { value: 'Wekelijks', label: 'Wekelijks' },
  { value: 'Na 3 dagen', label: 'Na 3 dagen' },
]

export const PRIO_OPTIONS = [
  { value: '', label: 'Normaal' },
  { value: 'Hoog', label: 'Hoog' },
  { value: 'Urgent', label: 'Urgent' },
]

export function templateSummary(tp) {
  const n = tp.tasks?.length ?? 0
  const subs = (tp.tasks ?? []).reduce((a, t) => a + (t.subs?.length ?? 0), 0)
  return n ? `${n} taken${subs ? ` · ${subs} subtaken` : ''}` : 'Zonder taken'
}

/** Koppelt `whoName` uit een standaardtemplate aan een echt profiel. */
export function resolveTemplate(template, profiles = []) {
  if (!template) return null
  const byFirst = (name) =>
    profiles.find(
      (p) => p.active !== false && (p.fullName ?? '').toLowerCase().split(' ')[0] === (name ?? '').toLowerCase()
    )?.id ?? null
  return {
    ...template,
    tasks: (template.tasks ?? []).map((t) => ({ ...t, who: t.who ?? byFirst(t.whoName) })),
  }
}

export const newTaskRow = (who = null, offset = 7) => ({
  id: Math.random().toString(36).slice(2, 10),
  title: '',
  who,
  whoName: null,
  offset,
  prio: '',
  subs: [],
  repeat: '',
})

export function saveTemplate(template) {
  const { id, ...rest } = template
  return setDoc(ref(COL.templates, id), { ...rest, updatedAt: serverTimestamp() })
}

export function createTemplate(template) {
  const id = newRef(COL.templates).id
  return saveTemplate({ ...template, id }).then(() => id)
}

export function deleteTemplate(id) {
  return deleteDoc(ref(COL.templates, id))
}
