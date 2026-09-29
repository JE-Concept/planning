/**
 * Demogegevens: de JE Concept-werkruimte zoals ze vandaag in ClickUp staat.
 * Echte dossiers, echte mensen, echte statussen — zodat de demo leest als de
 * tool en niet als een testbestand.
 */
import { seedDoc } from './firestore.js'
import { CHECKLIST_TEMPLATES } from '../src/lib/checklist-templates.js'

const D = (s) => new Date(s)
const NU = D('2026-09-28T09:20:00')
const dag = (n) => new Date(NU.getTime() + n * 86400000)

// ─── Mensen ─────────────────────────────────────────────────────────────────
const MENSEN = [
  ['u-jasper',   'jasper@jeconcept.be',       'Jasper Hansen',     'owner',  true],
  ['u-elke',     'elke@kenjeklanten.be',      'Elke Motmans',      'admin',  true],
  ['u-anneleen', 'anneleen@kenjeklanten.be',  'Anneleen Coenen',   'admin',  true],
  ['u-charish',  'charish.talento@gmail.com', 'Charish',           'member', true],
  // Zaalpersoneel: beperkte login, enkel de openings- en sluitingslijst.
  ['u-lotte',    'lotte@barvue.be',           'Lotte Vrijsen',     'staff',  true, 'zaal'],
  ['u-sam',      'sam@barvue.be',             'Sam Deckers',       'staff',  true, 'keuken'],
  // Vertrokken, maar hun werk staat er nog — dus gearchiveerd, niet verwijderd.
  ['u-maxine',   'maxine@jeconcept.be',       'Maxine Vanbrabant', 'member', false],
  ['u-aicha',    'aicha@jeconcept.be',        'Aïcha Van Roy',     'member', false],
]
MENSEN.forEach(([id, email, fullName, role, active, afdeling], i) =>
  seedDoc('profiles', id, {
    email, fullName, role, active, department: afdeling ?? null, avatarUrl: null,
    hourlyRate: role === 'member' ? 32 : 48,
    createdAt: D('2025-01-15'), updatedAt: NU, position: i,
  }))

// ─── Merken ─────────────────────────────────────────────────────────────────
;[
  ['je-concept', 'JE Concept', '#1A3A6B'], ['bar-vue', 'Bar Vue', '#B8860B'],
  ['meer', 'Meer — Het Vinne', '#0F8A5F'], ['feestbeest', 'Feestbeest', '#E8578A'],
  ['maison-folie', 'Maison Folie', '#7C3AED'], ['wintermoods', 'Wintermoods', '#0EA5E9'],
  ['kjk', 'Ken je klanten', '#38404F'],
].forEach(([id, name, color], i) =>
  seedDoc('brands', id, { key: id, name, color, position: i, archived: false }))

// ─── Ruimtes ────────────────────────────────────────────────────────────────
;[
  ['s-je', 'JE Concept', '#1A3A6B'],
  ['s-kjk', 'Ken je klanten', '#38404F'],
  ['s-prive', 'Persoonlijk J&E', '#0F8A5F'],
].forEach(([id, name, color], i) =>
  seedDoc('spaces', id, { name, color, position: i, archived: false }))

// ─── Lijsten met hun eigen statusreeks, één op één uit ClickUp ──────────────
const st = (name, color, kind, position) => ({ id: `${name.replace(/\W+/g, '-')}`, name, color, kind, position })

const OVERVIEW = [
  st('request', '#8A919C', 'open', 0),
  st('create offer', '#4A7FC1', 'active', 1),
  st('offer send', '#7C5CD6', 'active', 2),
  st('offer accepted', '#A855F7', 'active', 3),
  st('planning ongoing', '#1090E0', 'active', 4),
  st('planning ready', '#2E9E76', 'active', 5),
  st('ready to invoice', '#C9A84C', 'active', 6),
  st('invoiced', '#0D9488', 'done', 7),
  st('complete', '#0F7A54', 'closed', 8),
]
const SOCIALS = [
  st('pending', '#8A919C', 'open', 0),
  st('in progress', '#C9A84C', 'active', 1),
  st('ready for review', '#A855F7', 'active', 2),
  st('planning', '#4A7FC1', 'active', 3),
  st('done', '#0F7A54', 'closed', 4),
]
const REQS = [
  st('to do', '#8A919C', 'open', 0),
  st('on going', '#4A7FC1', 'active', 1),
  st('complete', '#0F7A54', 'closed', 2),
]

seedDoc('lists', 'l-overview', {
  spaceId: 's-je', folderId: null, brandId: null, name: 'Events',
  description: 'Aanvraag → offerte → planning → facturatie. De hoofdpijplijn.',
  kind: 'tasks', position: 0, archived: false, statuses: OVERVIEW, createdAt: D('2025-02-01'),
})
seedDoc('lists', 'l-socials', {
  spaceId: 's-je', folderId: null, brandId: null, name: 'Socials',
  description: 'Contentproductie voor alle merken.',
  kind: 'social', position: 1, archived: false, statuses: SOCIALS, createdAt: D('2025-06-01'),
})
seedDoc('lists', 'l-reqs', {
  spaceId: 's-je', folderId: 'f-platform', brandId: null, name: 'Requirements',
  description: 'Backlog platformontwikkeling.',
  kind: 'tasks', position: 2, archived: false, statuses: REQS, createdAt: D('2026-01-10'),
})
seedDoc('folders', 'f-platform', { spaceId: 's-je', name: 'Platform Development', position: 0, archived: false })

// ─── Labels ─────────────────────────────────────────────────────────────────
;[['wintermoods', '#0EA5E9'], ['stvv', '#C2352C'], ['losse-events', '#1A3A6B'],
  ['oldskool', '#7C3AED'], ['shop-the-city', '#C9A84C'], ['meer', '#0F8A5F'],
  ['barvue', '#B8860B'], ['feestbeest', '#E8578A']].forEach(([id, color]) =>
  seedDoc('tags', id, { name: id.replace(/-/g, ' '), color }))

// ─── Taken ──────────────────────────────────────────────────────────────────
let pos = 0
function taak(id, listId, statuses, statusName, o = {}) {
  const s = statuses.find((x) => x.name === statusName)
  const list = { 'l-overview': 'Events', 'l-socials': 'Socials', 'l-reqs': 'Requirements' }[listId]
  seedDoc('tasks', id, {
    listId, listName: list, spaceId: 's-je', brandId: o.brandId ?? null,
    parentId: o.parentId ?? null,
    title: o.title, description: o.description ?? '',
    statusId: s.id, statusName: s.name, statusColor: s.color, statusKind: s.kind,
    open: s.kind !== 'done' && s.kind !== 'closed',
    priority: o.priority ?? null,
    startDate: o.startDate ?? null, dueDate: o.dueDate ?? null,
    timeEstimateMinutes: o.estimate ?? null,
    budget: o.budget ?? null, location: o.location ?? null,
    assignees: o.assignees ?? [], tags: o.tags ?? [],
    position: (pos += 1024),
    archived: false, completedAt: s.kind === 'closed' || s.kind === 'done' ? dag(-20) : null,
    trackedSeconds: o.tracked ?? 0, commentCount: o.comments ?? 0,
    createdBy: 'u-jasper', createdAt: o.createdAt ?? dag(-30), updatedAt: dag(-1),
  })
}

taak('t-trouw', 'l-overview', OVERVIEW, 'create offer', {
  title: 'Trouw Niels en Inez', assignees: ['u-jasper', 'u-elke'], priority: 2,
  dueDate: dag(6), budget: 16399, location: 'Hoeve Vanhove, Kortessem',
  estimate: 480, tracked: 20700, comments: 2, tags: ['losse events'],
  description: '**Fiche evenement**\n\n- Opbouw zaterdag 3 juli vanaf 14.00 — tent, vloer, verlichting\n- Ceremonie 15.30 in de boomgaard, plan B in de schuur bij regen\n- Receptie 16.30 · walking dinner 18.30 · avondbar tot 03.00\n- 140 personen, waarvan 12 kinderen\n\n**Openstaande punten**\n\n- Regenplan bevestigen met de eigenaar\n- Aantal vegetarische gasten navragen',
})
taak('t-trouw-1', 'l-overview', OVERVIEW, 'create offer', { parentId: 't-trouw', title: 'Offerte afwerken en versturen', assignees: ['u-elke'], dueDate: dag(3), priority: 1 })
taak('t-trouw-2', 'l-overview', OVERVIEW, 'complete',     { parentId: 't-trouw', title: 'Locatiebezoek inplannen', assignees: ['u-jasper'] })
taak('t-trouw-3', 'l-overview', OVERVIEW, 'create offer', { parentId: 't-trouw', title: 'Prijs open bar apart opgeven', assignees: ['u-elke'] })

taak('t-blum', 'l-overview', OVERVIEW, 'offer accepted', {
  title: 'Blum België — 20-jarig bestaan', assignees: ['u-jasper'], priority: 2,
  dueDate: dag(82), budget: 24800, location: 'Cultureel Centrum, Sint-Truiden',
  tracked: 35100, comments: 1, tags: ['losse events'],
  description: '180 medewerkers + partners. Onthaal 18.30 · diner 20.00 · dansfeest tot 02.00.\n\nOpbouw donderdag 18 december vanaf 09.00.',
})
taak('t-blum-1', 'l-overview', OVERVIEW, 'offer accepted', { parentId: 't-blum', title: 'Voorschot factureren — 40%', assignees: ['u-elke'], priority: 1, dueDate: dag(2) })
taak('t-blum-2', 'l-overview', OVERVIEW, 'offer accepted', { parentId: 't-blum', title: 'Allergieënlijst opvragen bij HR', assignees: ['u-jasper'] })
taak('t-blum-3', 'l-overview', OVERVIEW, 'offer accepted', { parentId: 't-blum', title: 'Herasdoeken laten bedrukken', assignees: ['u-jasper'] })

taak('t-haspengouw', 'l-overview', OVERVIEW, 'planning ready', {
  title: 'Haspengouw Culinair — Grote Markt', assignees: ['u-jasper', 'u-anneleen'],
  dueDate: dag(-7), budget: 38900, location: 'Grote Markt, Borgloon', tracked: 85500,
  tags: ['losse events'], priority: 2,
  description: '8 standen met eigen stroomafname, centrale bar 12 m met 6 tappunten. 600 bezoekers verwacht.',
})
taak('t-haspengouw-1', 'l-overview', OVERVIEW, 'complete', { parentId: 't-haspengouw', title: 'Crewbandjes voorzien — 45 stuks', assignees: ['u-anneleen'] })
taak('t-haspengouw-2', 'l-overview', OVERVIEW, 'planning ready', { parentId: 't-haspengouw', title: 'Vrijwilligersverzekering aangeven', assignees: ['u-elke'], priority: 1 })

taak('t-optimum', 'l-overview', OVERVIEW, 'planning ongoing', {
  title: '20 m Pipe & Drape — Optimum Sorting — Opbouw', assignees: ['u-jasper', 'u-anneleen'],
  dueDate: dag(40), budget: 14800, priority: 2, tracked: 7200, location: 'Geel',
})
taak('t-vinne', 'l-overview', OVERVIEW, 'offer accepted', {
  title: 'Wandelzondag Vinne', assignees: ['u-anneleen'], dueDate: dag(27),
  budget: 9800, brandId: 'meer', tags: ['meer'], tracked: 12600,
})
taak('t-vrijwilligers', 'l-overview', OVERVIEW, 'offer send', {
  title: 'Vrijwilligersfeest — 140 krukken | Cultureel Centrum', assignees: ['u-jasper'], budget: 1840, dueDate: dag(12),
})
taak('t-canon', 'l-overview', OVERVIEW, 'ready to invoice', {
  title: 'Canon Event — Vergaderzaal | 10–15 personen', assignees: ['u-jasper', 'u-elke'],
  dueDate: dag(-29), budget: 1250, brandId: 'meer', priority: 1, tracked: 5400,
})
taak('t-loonse', 'l-overview', OVERVIEW, 'ready to invoice', {
  title: 'Loonse Feesten 2026', assignees: ['u-jasper', 'u-elke'], dueDate: dag(-30),
  budget: 21500, priority: 1, tracked: 138600, comments: 1,
})
taak('t-ruben', 'l-overview', OVERVIEW, 'request', {
  title: 'Ruben Theuwen — 25 april 2027', assignees: ['u-jasper'], tags: ['feestbeest'], brandId: 'feestbeest',
  description: 'Aanvraag per mail: communie eind april 2027, veertigtal personen waarvan een tiental kinderen.',
})
taak('t-jolien', 'l-overview', OVERVIEW, 'request', {
  title: 'Verjaardag & doopsel — 15 november (Jolien en Bernd)', assignees: ['u-jasper'],
  dueDate: dag(48), brandId: 'feestbeest', tags: ['feestbeest'],
})
taak('t-astrid', 'l-overview', OVERVIEW, 'invoiced', {
  title: 'Astrid Odeurs — trouwfeest', assignees: ['u-elke'], budget: 14250, tracked: 28800,
})
taak('t-magirus', 'l-overview', OVERVIEW, 'invoiced', {
  title: 'Magirus — opbouw 29 mei, gebruik 30 mei', assignees: ['u-elke'], budget: 12600, tracked: 23400,
})
taak('t-winterbar', 'l-overview', OVERVIEW, 'planning ongoing', {
  title: 'Winterbar', assignees: ['u-anneleen'], tags: ['wintermoods'], brandId: 'wintermoods', dueDate: dag(55),
})
taak('t-menukaart', 'l-overview', OVERVIEW, 'request', {
  title: 'Menukaart drukken + prijzen ingeven', assignees: ['u-elke'], brandId: 'meer',
})

// Socials
taak('t-soc-1', 'l-socials', SOCIALS, 'in progress', { title: 'JE Concept (28 sep – 4 okt)', assignees: ['u-charish'], tags: ['je concept'] })
taak('t-soc-2', 'l-socials', SOCIALS, 'in progress', { title: 'Meer Contents (28 sep – 4 okt)', assignees: ['u-charish'], brandId: 'meer', tags: ['meer'] })
taak('t-soc-3', 'l-socials', SOCIALS, 'ready for review', { title: 'Bar Vue — nieuwe wijnkaart', assignees: ['u-charish'], brandId: 'bar-vue', tags: ['barvue'] })
taak('t-soc-4', 'l-socials', SOCIALS, 'pending', { title: 'Feestbeest — verjaardagsformules', assignees: ['u-charish'], brandId: 'feestbeest' })
taak('t-soc-5', 'l-socials', SOCIALS, 'done', { title: 'Terugblik Loonse Feesten', assignees: ['u-charish'] })

// Requirements
taak('t-req-1', 'l-reqs', REQS, 'on going', { title: 'Architecture — Multi-tenant SaaS platform', assignees: ['u-jasper'], priority: 1 })
taak('t-req-2', 'l-reqs', REQS, 'to do', { title: 'Offertemotor — digitale handtekening', assignees: ['u-jasper'], priority: 2 })
taak('t-req-3', 'l-reqs', REQS, 'complete', { title: 'Stripe Connect onboarding', assignees: ['u-jasper'] })

// ─── Reacties ───────────────────────────────────────────────────────────────
;[
  ['c1', 't-blum', 'u-elke', 'Elke Motmans', 'Leverancierschecklist doorgenomen met Jasper. Verhuur, catering, sanitair en drank apart offreren — de goedkoopste verhuurder wacht nog op bevestiging. Interne materiaallijst staat in de gedeelde map.', dag(-6)],
  ['c2', 't-trouw', 'u-elke', 'Elke Motmans', 'Klant wil dezelfde tentopstelling als bij de Odeurs-trouw vorig jaar. Foto\'s doorgestuurd. Let op: bredere dansvloer gevraagd.', dag(-12)],
  ['c3', 't-trouw', 'u-jasper', 'Jasper Hansen', 'Locatiebezoek gedaan. Boomgaard ligt schuin — vloer nodig onder de ceremonie, dat zit nog niet in de raming.', dag(-9)],
  ['c4', 't-loonse', 'u-jasper', 'Jasper Hansen', 'Eindafrekening: voorschot van €8.600 verrekenen. Drie dagen bar, 8 tappunten, geen schade gemeld.', dag(-4)],
].forEach(([id, taskId, authorId, authorName, body, createdAt]) =>
  seedDoc('comments', id, { taskId, postId: null, authorId, authorName, body, createdAt }))

// ─── Tijdregistratie ────────────────────────────────────────────────────────
const maand = '2026-09'
let te = 0
function tijd(profileId, taskId, taskTitle, uren, omschrijving, dagenTerug, billable = true) {
  const start = new Date(dag(-dagenTerug)); start.setHours(9, 0, 0, 0)
  const eind = new Date(start.getTime() + uren * 3600000)
  const d = start.toISOString().slice(0, 10)
  seedDoc('timeEntries', `te-${te += 1}`, {
    profileId, taskId, taskTitle, listId: 'l-overview', listName: 'Events',
    brandId: null, description: omschrijving, billable,
    startedAt: start, endedAt: eind, durationSeconds: Math.round(uren * 3600),
    day: d, month: maand, week: '2026-W40', createdAt: start,
  })
}
tijd('u-jasper', 't-trouw', 'Trouw Niels en Inez', 3.5, 'Locatiebezoek en opmeting', 1)
tijd('u-elke', 't-trouw', 'Trouw Niels en Inez', 2.25, 'Offerte opmaken', 1)
tijd('u-jasper', 't-haspengouw', 'Haspengouw Culinair — Grote Markt', 8, 'Opbouw en coördinatie', 7)
tijd('u-anneleen', 't-haspengouw', 'Haspengouw Culinair — Grote Markt', 6.5, 'Standenplan en communicatie', 7)
tijd('u-elke', 't-blum', 'Blum België — 20-jarig bestaan', 2.5, 'Leveranciers vergelijken', 2)
tijd('u-charish', null, null, 6.5, 'Contentkalender oktober uitwerken', 3, false)
tijd('u-charish', null, null, 4, 'Reels monteren Haspengouw Culinair', 2, false)
tijd('u-elke', 't-loonse', 'Loonse Feesten 2026', 1.75, 'Eindafrekening', 4)
tijd('u-jasper', 't-optimum', '20 m Pipe & Drape — Optimum Sorting — Opbouw', 2, 'Plaatsbezoek', 5)

// Een lopende timer, zodat de kop van de app meteen leeft.
const loopt = new Date(NU.getTime() - 84 * 60000)
seedDoc('runningTimers', 'u-jasper', {
  profileId: 'u-jasper', taskId: 't-trouw', taskTitle: 'Trouw Niels en Inez',
  listId: 'l-overview', listName: 'Events', brandId: null,
  description: 'Offerte afwerken', startedAt: loopt, billable: true,
})

// ─── Social posts ───────────────────────────────────────────────────────────
//
// Sommige posts zitten al in een reviewronde; hun beslissingen staan verderop
// in het logboek.

function post(id, o) {
  const when = o.over == null ? null : (() => { const d = dag(o.over); d.setHours(o.uur ?? 10, 0, 0, 0); return d })()
  seedDoc('socialPosts', id, {
    brandId: o.brandId, listId: 'l-socials', title: o.title,
    caption: o.caption ?? '', hashtags: o.hashtags ?? '',
    channels: o.channels, scheduledAt: when, status: o.status,
    assigneeId: o.assigneeId ?? 'u-charish',
    source: 'manual',
    taskId: o.taskId ?? null, taskTitle: o.taskTitle ?? null, taskListName: o.taskId ? 'Events' : null,
    reviewState: o.reviewState ?? 'none', reviewRound: o.reviewRound ?? 0,
    reviewerId: o.reviewerId ?? null, reviewNote: o.reviewNote ?? null,
    reviewRequestedAt: o.reviewState === 'requested' ? dag(-1) : null,
    reviewRequestedBy: o.reviewState === 'requested' ? 'u-charish' : null,
    reviewedAt: o.reviewState === 'approved' || o.reviewState === 'changes' ? dag(-1) : null,
    reviewedBy: o.reviewState === 'approved' || o.reviewState === 'changes' ? 'u-jasper' : null,
    assetUrl: null, publishedUrl: o.publishedUrl ?? null, notes: o.notes ?? '',
    createdBy: 'u-charish', createdAt: dag(-5), updatedAt: dag(-1),
  })
}

post('p1', { brandId: 'meer', title: 'Herfstwandeling Het Vinne', over: 2, status: 'scheduled', channels: ['instagram', 'facebook'],
  reviewState: 'approved', reviewRound: 1,
  taskId: 't-vinne', taskTitle: 'Wandelzondag Vinne',
  caption: 'Zondag wandelen door het Vinne, en achteraf iets warms op het terras. 🍂' })

post('p2', { brandId: 'bar-vue', title: 'Bar Vue cocktailweek', over: 3, status: 'review', channels: ['instagram'],
  reviewState: 'requested', reviewRound: 2,
  reviewerId: 'u-jasper', reviewNote: 'Tweede versie — logo staat nu links onder.' })

post('p3', { brandId: 'je-concept', title: 'Haspengouw Culinair sfeerbeeld', over: 4, status: 'approved', channels: ['instagram', 'linkedin'],
  reviewState: 'approved', reviewRound: 1,
  taskId: 't-haspengouw', taskTitle: 'Haspengouw Culinair — Grote Markt' })

post('p4', { brandId: 'feestbeest', title: 'Feestbeest verhuurmateriaal', over: 6, status: 'design', channels: ['instagram'],
  reviewState: 'changes', reviewRound: 1,
  reviewNote: 'Prijzen weglaten, die veranderen te vaak.' })

post('p5', { brandId: 'meer', title: 'Menu oktober', over: 8, status: 'draft', channels: ['facebook'] })
post('p6', { brandId: 'je-concept', title: 'Vacature zaalmedewerker', over: 10, status: 'idea', channels: ['linkedin'] })
post('p7', { brandId: 'feestbeest', title: 'Trouw Niels en Inez — bedankt', over: null, status: 'idea', channels: ['instagram'],
  taskId: 't-trouw', taskTitle: 'Trouw Niels en Inez',
  notes: 'Pas na het weekend; foto’s komen van de fotograaf.' })

// De beslissingen achter die reviews, zoals het logboek ze bewaart.
;[
  ['rv1', 'p1', 1, 'request', null, 'Charish Vanoppen', -3],
  ['rv2', 'p1', 1, 'approve', 'Mooi, alleen de datum wat groter gezet.', 'Jasper Hansen', -2],
  ['rv3', 'p2', 1, 'request', null, 'Charish Vanoppen', -4],
  ['rv4', 'p2', 1, 'changes', 'Logo valt weg tegen de foto.', 'Jasper Hansen', -3],
  ['rv5', 'p2', 2, 'request', 'Tweede versie — logo staat nu links onder.', 'Charish Vanoppen', -1],
  ['rv6', 'p3', 1, 'approve', null, 'Jasper Hansen', -2],
  ['rv7', 'p4', 1, 'changes', 'Prijzen weglaten, die veranderen te vaak.', 'Jasper Hansen', -2],
].forEach(([id, postId, round, decision, note, authorName, over]) =>
  seedDoc('postReviews', id, {
    postId, round, decision, note, authorName,
    authorId: authorName.startsWith('Jasper') ? 'u-jasper' : 'u-charish',
    createdAt: dag(over),
  }))

// ─── Goals ──────────────────────────────────────────────────────────────────

seedDoc('goals', 'g1', {
  name: 'Omzet events Q4 2026', description: 'Vier bevestigde events per maand in het laatste kwartaal.',
  brandId: null, ownerId: 'u-jasper', startDate: D('2026-10-01'), dueDate: D('2026-12-31'),
  status: 'active', color: '#1A3A6B', position: 0,
  keyResults: [
    { id: 'kr1', name: 'Bevestigde events', kind: 'number', startValue: 0, targetValue: 12, currentValue: 5, unit: '', listId: null },
    { id: 'kr2', name: 'Getekende offertes', kind: 'currency', startValue: 0, targetValue: 120000, currentValue: 46400, unit: '€', listId: null },
  ],
  createdAt: dag(-40), updatedAt: dag(-3),
})

// Het verloop van een resultaat: dat werd wel bewaard maar nergens getoond.
;[
  ['gu1', 'kr1', 2, 'Twee bevestigd na de beurs.', 'u-jasper', -24],
  ['gu2', 'kr1', 4, '', 'u-elke', -12],
  ['gu3', 'kr1', 5, 'Blum bevestigd.', 'u-jasper', -3],
  ['gu4', 'kr2', 18400, '', 'u-elke', -20],
  ['gu5', 'kr2', 46400, 'Haspengouw en Blum getekend.', 'u-elke', -4],
].forEach(([id, keyResultId, value, note, profileId, dagen]) =>
  seedDoc('goalUpdates', id, {
    goalId: 'g1', keyResultId, value, note, profileId, createdAt: dag(dagen),
  }))

// ─── Openen en sluiten ──────────────────────────────────────────────────────
CHECKLIST_TEMPLATES.forEach((template, position) =>
  seedDoc('checklists', template.id, {
    key: template.key, name: template.name, kind: template.kind, brandId: null,
    sections: template.sections, position, archived: false, updatedAt: NU,
  }))

// De ochtendlijst van vandaag, half afgewerkt door twee mensen — zo leest de
// demo als een dienst die bezig is in plaats van als een leeg formulier.
const vandaag = NU.toISOString().slice(0, 10)
const afgevinkt = (id, wie, naam, uur) => [id, {
  done: true, byId: wie, byName: naam,
  at: new Date(`${vandaag}T${uur}:00`),
}]

seedDoc('checklistRuns', `openen_${vandaag}`, {
  checklistId: 'openen', checklistKey: 'openen', checklistName: 'Openen van de bistro',
  brandId: null, day: vandaag, date: new Date(`${vandaag}T12:00:00`), weekend: false,
  totalCount: 20, doneCount: 7,
  participants: ['u-lotte', 'u-sam'],
  items: Object.fromEntries([
    afgevinkt('sleutel', 'u-lotte', 'Lotte Vrijsen', '08:12'),
    afgevinkt('alarm', 'u-lotte', 'Lotte Vrijsen', '08:13'),
    afgevinkt('licht-binnen', 'u-lotte', 'Lotte Vrijsen', '08:14'),
    afgevinkt('apparatuur-aan', 'u-sam', 'Sam Deckers', '08:31'),
    afgevinkt('houdbaarheid', 'u-sam', 'Sam Deckers', '08:40'),
    afgevinkt('koeling-keuken', 'u-sam', 'Sam Deckers', '08:42'),
    afgevinkt('koeling-bar', 'u-lotte', 'Lotte Vrijsen', '08:55'),
  ]),
  notes: 'Melkschuimer maakt een raar geluid — techniekers gebeld voor donderdag.',
  notesById: 'u-lotte', notesByName: 'Lotte Vrijsen', notesAt: new Date(`${vandaag}T09:02:00`),
  updatedAt: NU,
})

// ─── Teamoverleg ────────────────────────────────────────────────────────────
seedDoc('lists', 'l-overleg', {
  spaceId: 's-je', folderId: null, brandId: null, name: 'Tasks',
  description: 'Losse taken en de verslagen van het teamoverleg, met de actiepunten eronder.',
  kind: 'tasks', position: 3, archived: false,
  statuses: [
    { id: 'o1', name: 'opgenomen', color: '#8593a9', kind: 'open', position: 0 },
    { id: 'o2', name: 'samengevat', color: '#3377ff', kind: 'active', position: 1 },
    { id: 'o3', name: 'nagelezen', color: '#3db88b', kind: 'active', position: 2 },
    { id: 'o4', name: 'afgerond', color: '#008844', kind: 'closed', position: 3 },
  ],
  createdAt: D('2026-01-10'),
})

seedDoc('tasks', 't-overleg-1', {
  listId: 'l-overleg', listName: 'Tasks', spaceId: 's-je', brandId: null, parentId: null,
  title: 'Weekstart events — 21/09/2026', description: '',
  statusId: 'o3', statusName: 'nagelezen', statusColor: '#3db88b', statusKind: 'active',
  open: true, priority: null, startDate: null, dueDate: null,
  assignees: [], tags: [], position: 1024, archived: false, completedAt: null,
  trackedSeconds: 0, commentCount: 0, meetingDate: '2026-09-21',
  createdBy: 'u-jasper', createdAt: dag(-7), updatedAt: dag(-6),
})

;[
  ['Drankenlijst Trouw Niels en Inez afwerken', 'u-elke', dag(2)],
  ['Offerte Blum nakijken op de aangepaste aantallen', 'u-jasper', dag(1)],
  ['Standenplan Haspengouw Culinair doorsturen naar de stad', 'u-anneleen', dag(4)],
].forEach(([titel, wie, deadline], i) =>
  seedDoc('tasks', `t-overleg-1-${i}`, {
    listId: 'l-overleg', listName: 'Tasks', spaceId: 's-je', brandId: null,
    parentId: 't-overleg-1', title: titel, description: '',
    statusId: 'o3', statusName: 'nagelezen', statusColor: '#3db88b', statusKind: 'active',
    open: true, priority: null, startDate: null, dueDate: deadline,
    assignees: [wie], tags: [], position: 2048 + i, archived: false, completedAt: null,
    trackedSeconds: 0, commentCount: 0, meetingId: 't-overleg-1',
    createdBy: 'u-jasper', createdAt: dag(-7), updatedAt: dag(-6),
  }))

// De agenda van het volgende overleg, door drie verschillende mensen gezet.
;[
  ['a1', 'Prijzen verhuurmateriaal herzien', 'De tarieven staan sinds 2024 stil terwijl transport duurder werd. Voorstel: 8% erbij vanaf november.', 'u-jasper', 15],
  ['a2', 'Weekendbezetting oktober', 'Drie zaterdagen met twee events tegelijk. Wie doet wat, en huren we bij?', 'u-anneleen', 20],
  ['a3', 'Nieuwe leverancier dranken', 'Offerte binnen van Vandenberghe, 6% goedkoper maar levering enkel op dinsdag.', 'u-elke', 10],
  ['a4', 'Feedback openingslijst', 'De keuken vindt de ochtendlijst te lang op stille dagen.', 'u-charish', 10],
].forEach(([id, titel, omschrijving, wie, minuten], i) =>
  seedDoc('agendaItems', id, {
    titel, omschrijving, ownerId: wie, minuten, status: 'open',
    meetingId: null, besprokenOp: null, createdBy: wie,
    createdAt: dag(-3 + i * 0.2), updatedAt: dag(-1),
  }))

seedDoc('agendaItems', 'a0', {
  titel: 'Kerstmenu Bar Vue vastleggen',
  omschrijving: 'Besproken op 21/09; de kaart gaat naar de drukker.',
  ownerId: 'u-elke', minuten: 15, status: 'besproken',
  meetingId: 't-overleg-1', besprokenOp: dag(-7),
  createdBy: 'u-elke', createdAt: dag(-10), updatedAt: dag(-7),
})

seedDoc('meetings', 't-overleg-1', {
  taskId: 't-overleg-1', titel: 'Weekstart events', datum: '2026-09-21',
  deelnemers: ['Jasper Hansen', 'Elke Motmans', 'Anneleen Coenen'],
  samenvatting: [
    { onderwerp: 'Trouw Niels en Inez', tekst: 'De offerte gaat deze week de deur uit. Het regenplan is bevestigd met de eigenaar; de drankenlijst moet nog afgewerkt worden voor de bestelling kan.' },
    { onderwerp: 'Blum personeelsfeest', tekst: 'De klant verhoogde naar 220 personen. De offerte wordt herzien op aantallen, niet op formule.' },
    { onderwerp: 'Haspengouw Culinair', tekst: 'Het standenplan is klaar maar moet nog naar de stad. Anneleen volgt op; deadline vrijdag.' },
  ],
  bron: null,
  viewerIds: ['u-jasper', 'u-anneleen', 'u-maxine', 'u-elke'],
  createdAt: dag(-7),
})

// ─── Business rules ─────────────────────────────────────────────────────────
// Uitvoeren doet de server; in de demo zie je de regels, ze veranderen hier
// niets aan de taken.
seedDoc('automations', 'ready-to-invoice', {
  name: 'Facturatie is voor Elke',
  enabled: true,
  listId: 'l-overview',
  trigger: { kind: 'status', status: 'ready to invoice' },
  actions: [{ kind: 'assignees', mode: 'set', profileIds: ['u-elke'] }],
  position: 0,
  createdAt: dag(-30),
  updatedAt: dag(-30),
})

seedDoc('automations', 'nieuwe-aanvraag', {
  name: 'Nieuwe aanvraag krijgt een week',
  enabled: true,
  listId: 'l-overview',
  trigger: { kind: 'status', status: 'request' },
  actions: [
    { kind: 'assignees', mode: 'add', profileIds: ['u-jasper'] },
    { kind: 'dueInDays', value: 7 },
  ],
  position: 1,
  createdAt: dag(-20),
  updatedAt: dag(-20),
})

seedDoc('config', 'access', { allowedDomains: ['jeconcept.be', 'kenjeklanten.be'], updatedAt: NU })
