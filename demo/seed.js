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

// ─── Labels ─────────────────────────────────────────────────────────────────
;[['wintermoods', '#0EA5E9'], ['stvv', '#C2352C'], ['losse-events', '#1A3A6B'],
  ['oldskool', '#7C3AED'], ['shop-the-city', '#C9A84C'], ['meer', '#0F8A5F'],
  ['barvue', '#B8860B'], ['feestbeest', '#E8578A']].forEach(([id, color]) =>
  seedDoc('tags', id, { name: id.replace(/-/g, ' '), color }))

// ─── Klanten ────────────────────────────────────────────────────────────────
const KLANTEN = [
  {
    id: 'k-blum', name: 'Blum België', vatNumber: 'BE 0456.789.123',
    email: 'events@blum.be', phone: '011 22 33 44', website: 'https://www.blum.com',
    brandId: 'je-concept',
    address: { street: 'Industrieweg 12', postalCode: '3800', city: 'Sint-Truiden', country: 'België' },
    contacts: [
      { id: 'c-blum-1', name: 'Karen Vandeput', role: 'HR-manager', email: 'karen@blum.be', phone: '0478 12 34 56' },
      { id: 'c-blum-2', name: 'Tom Peeters', role: 'Boekhouding', email: 'facturen@blum.be', phone: '' },
    ],
    notes: 'Factuur altijd naar boekhouding, nooit naar HR. Vegetarisch aanbod is een vast punt.',
  },
  {
    id: 'k-niels-inez', name: 'Niels & Inez', vatNumber: '',
    email: 'niels.inez@telenet.be', phone: '0495 66 77 88', website: '',
    brandId: 'feestbeest',
    address: { street: 'Hoeve Vanhove', postalCode: '3720', city: 'Kortessem', country: 'België' },
    contacts: [{ id: 'c-ni-1', name: 'Inez Claes', role: 'Bruid', email: 'inez@telenet.be', phone: '0495 66 77 88' }],
    notes: 'Regenplan in de schuur. Dansvloer breder dan bij de Odeurs-trouw.',
  },
  {
    id: 'k-borgloon', name: 'Stad Borgloon', vatNumber: 'BE 0207.474.933',
    email: 'evenementen@borgloon.be', phone: '012 67 36 55', website: 'https://www.borgloon.be',
    brandId: null,
    address: { street: 'Speelhof 10', postalCode: '3840', city: 'Borgloon', country: 'België' },
    contacts: [
      { id: 'c-bl-1', name: 'Marleen Gijsen', role: 'Dienst evenementen', email: 'marleen@borgloon.be', phone: '012 67 36 60' },
    ],
    notes: 'Standenplan moet twee weken vooraf bij de dienst liggen.',
  },
]

const KLANTNAMEN = Object.fromEntries(KLANTEN.map((k) => [k.id, k.name]))

KLANTEN.forEach((klant, i) =>
  seedDoc('customers', klant.id, {
    ...klant, archived: false, createdBy: 'u-jasper',
    createdAt: dag(-120 + i * 10), updatedAt: dag(-5),
  }))

// Een logo bij de klant: in de demo een tekening in de URL zelf, zodat het
// miniatuur toont zonder dat er iets geüpload hoeft te worden.
const LOGO =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 60"><rect width="120" height="60" rx="8" fill="#112550"/><text x="60" y="38" font-family="Georgia" font-size="26" font-weight="700" fill="#fff" text-anchor="middle">BLUM</text></svg>'
  )

;[
  ['d-blum-logo', 'k-blum', null, 'blum-logo.svg', 'image/svg+xml', 2480, LOGO],
  ['d-blum-huisstijl', 'k-blum', null, 'huisstijlgids-blum-2026.pdf', 'application/pdf', 1_840_000, '#'],
  ['d-borgloon-plan', 'k-borgloon', null, 'standenplan-grote-markt.pdf', 'application/pdf', 620_000, '#'],
  ['d-trouw-grondplan', null, 't-trouw', 'grondplan-hoeve-vanhove.pdf', 'application/pdf', 410_000, '#'],
].forEach(([id, customerId, taskId, name, contentType, size, url], i) =>
  seedDoc('attachments', id, {
    customerId, taskId, postId: null, name, label: '', storagePath: `attachments/demo/${name}`,
    contentType, size, url, uploadedBy: 'u-jasper', createdAt: dag(-30 + i),
  }))

// ─── Taken ──────────────────────────────────────────────────────────────────
let pos = 0
function taak(id, listId, statuses, statusName, o = {}) {
  const s = statuses.find((x) => x.name === statusName)
  const list = { 'l-overview': 'Events', 'l-socials': 'Socials' }[listId]
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
    customerId: o.customerId ?? null,
    customerName: o.customerId ? KLANTNAMEN[o.customerId] : null,
    socialStage: o.socialStage ?? null,
    // Wat de fiche uit het design toont: gasten, formule, type, offerte, dag.
    eventDate: o.eventDate ?? (o.parentId ? null : o.dueDate ?? null),
    pax: o.pax ?? null, kids: o.kids ?? null, formule: o.formule ?? null,
    eventType: o.eventType ?? null, quoteAmount: o.budget ?? null,
    draaiboek: o.draaiboek ?? null, checklist: o.checklist ?? [], repeat: o.repeat ?? null,
    socialWanted: o.socialWanted ?? null,
    position: (pos += 1024),
    archived: false, completedAt: s.kind === 'closed' || s.kind === 'done' ? dag(-20) : null,
    trackedSeconds: o.tracked ?? 0, commentCount: o.comments ?? 0,
    createdBy: 'u-jasper', createdAt: o.createdAt ?? dag(-30), updatedAt: dag(-1),
  })
}

taak('t-trouw', 'l-overview', OVERVIEW, 'create offer', { pax: 140, kids: 12, formule: 'Walking dinner + dessertbuffet', eventType: 'Huwelijk', eventDate: dag(12), draaiboek: [{ tijd: '09:00', wat: 'Opbouw tent, vloer en verlichting', wie: 'Jasper · verhuur' }, { tijd: '13:00', wat: 'Levering sanitair en koeling', wie: 'Elke' }, { tijd: '15:00', wat: 'Ceremonie klaarzetten in de boomgaard', wie: 'Anneleen' }, { tijd: '15:30', wat: 'Ceremonie', wie: 'Anneleen' }, { tijd: '16:30', wat: 'Receptie met bubbels', wie: 'bar' }, { tijd: '18:30', wat: 'Walking dinner', wie: 'traiteur' }, { tijd: '21:30', wat: 'Dessertbuffet + openingsdans', wie: 'Anneleen' }, { tijd: '22:00', wat: 'Avondbar tot 03:00', wie: 'Jasper' }],
  title: 'Trouw Niels en Inez', assignees: ['u-jasper', 'u-elke'], priority: 2, customerId: 'k-niels-inez',
  dueDate: dag(6), budget: 16399, location: 'Hoeve Vanhove, Kortessem',
  estimate: 480, tracked: 20700, comments: 2, tags: ['losse events'],
  description: '**Fiche evenement**\n\n- Opbouw zaterdag 3 juli vanaf 14.00 — tent, vloer, verlichting\n- Ceremonie 15.30 in de boomgaard, plan B in de schuur bij regen\n- Receptie 16.30 · walking dinner 18.30 · avondbar tot 03.00\n- 140 personen, waarvan 12 kinderen\n\n**Openstaande punten**\n\n- Regenplan bevestigen met de eigenaar\n- Aantal vegetarische gasten navragen',
})
taak('t-trouw-1', 'l-overview', OVERVIEW, 'create offer', { parentId: 't-trouw', title: 'Offerte afwerken en versturen', assignees: ['u-elke'], dueDate: dag(3), priority: 1 })
taak('t-trouw-2', 'l-overview', OVERVIEW, 'complete',     { parentId: 't-trouw', title: 'Locatiebezoek inplannen', assignees: ['u-jasper'] })
taak('t-trouw-3', 'l-overview', OVERVIEW, 'create offer', { parentId: 't-trouw', title: 'Prijs open bar apart opgeven', assignees: ['u-elke'] })

taak('t-blum', 'l-overview', OVERVIEW, 'offer accepted', { pax: 180, formule: 'Receptie + diner + dansfeest', eventType: 'Bedrijfsevent',
  title: 'Blum België — 20-jarig bestaan', assignees: ['u-jasper'], priority: 2, customerId: 'k-blum',
  dueDate: dag(82), budget: 24800, location: 'Cultureel Centrum, Sint-Truiden',
  tracked: 35100, comments: 1, tags: ['losse events'],
  description: '180 medewerkers + partners. Onthaal 18.30 · diner 20.00 · dansfeest tot 02.00.\n\nOpbouw donderdag 18 december vanaf 09.00.',
})
taak('t-blum-1', 'l-overview', OVERVIEW, 'offer accepted', { parentId: 't-blum', title: 'Voorschot factureren — 40%', assignees: ['u-elke'], priority: 1, dueDate: dag(2) })
taak('t-blum-2', 'l-overview', OVERVIEW, 'offer accepted', { parentId: 't-blum', title: 'Allergieënlijst opvragen bij HR', assignees: ['u-jasper'] })
taak('t-blum-3', 'l-overview', OVERVIEW, 'offer accepted', { parentId: 't-blum', title: 'Herasdoeken laten bedrukken', assignees: ['u-jasper'] })

taak('t-haspengouw', 'l-overview', OVERVIEW, 'planning ready', { pax: 600, formule: 'Standen + centrale bar', eventType: 'Stadsevent',
  title: 'Haspengouw Culinair — Grote Markt', assignees: ['u-jasper', 'u-anneleen'], customerId: 'k-borgloon',
  dueDate: dag(-7), budget: 38900, location: 'Grote Markt, Borgloon', tracked: 85500,
  tags: ['losse events'], priority: 2,
  description: '8 standen met eigen stroomafname, centrale bar 12 m met 6 tappunten. 600 bezoekers verwacht.',
})
taak('t-haspengouw-1', 'l-overview', OVERVIEW, 'complete', { parentId: 't-haspengouw', title: 'Crewbandjes voorzien — 45 stuks', assignees: ['u-anneleen'] })
taak('t-haspengouw-2', 'l-overview', OVERVIEW, 'planning ready', { parentId: 't-haspengouw', title: 'Vrijwilligersverzekering aangeven', assignees: ['u-elke'], priority: 1 })

taak('t-optimum', 'l-overview', OVERVIEW, 'planning ongoing', { pax: 250, formule: 'Pipe & drape + bar', eventType: 'Bedrijfsevent',
  title: '20 m Pipe & Drape — Optimum Sorting — Opbouw', assignees: ['u-jasper', 'u-anneleen'],
  dueDate: dag(40), budget: 14800, priority: 2, tracked: 7200, location: 'Geel',
})
taak('t-vinne', 'l-overview', OVERVIEW, 'offer accepted', { pax: 320, formule: 'Wandelbar + soep', eventType: 'Wandelzondag',
  title: 'Wandelzondag Vinne', assignees: ['u-anneleen'], dueDate: dag(27),
  budget: 9800, brandId: 'meer', tags: ['meer'], tracked: 12600,
})
taak('t-vrijwilligers', 'l-overview', OVERVIEW, 'offer send', { pax: 140, formule: 'Krukken en statafels', eventType: 'Verhuur', customerId: 'k-borgloon',
  title: 'Vrijwilligersfeest — 140 krukken | Cultureel Centrum', assignees: ['u-jasper'], budget: 1840, dueDate: dag(12),
})
taak('t-canon', 'l-overview', OVERVIEW, 'ready to invoice', { pax: 15, formule: 'Vergaderzaal + lunch', eventType: 'Vergadering',
  title: 'Canon Event — Vergaderzaal | 10–15 personen', assignees: ['u-jasper', 'u-elke'],
  dueDate: dag(-29), budget: 1250, brandId: 'meer', priority: 1, tracked: 5400,
  // Tien man in een vergaderzaal levert geen content op; bewust uitgezet.
  socialWanted: false,
})
taak('t-loonse', 'l-overview', OVERVIEW, 'ready to invoice', { pax: 2400, formule: 'Drie dagen bar, 8 tappunten', eventType: 'Stadsevent',
  title: 'Loonse Feesten 2026', assignees: ['u-jasper', 'u-elke'], dueDate: dag(-30),
  budget: 21500, priority: 1, tracked: 138600, comments: 1, customerId: 'k-borgloon',
  socialStage: 'ready',
})
taak('t-ruben', 'l-overview', OVERVIEW, 'request', { pax: 40, kids: 10, eventType: 'Communie', eventDate: new Date('2027-04-25T12:00:00'),
  title: 'Ruben Theuwen — 25 april 2027', assignees: ['u-jasper'], tags: ['feestbeest'], brandId: 'feestbeest',
  description: 'Aanvraag per mail: communie eind april 2027, veertigtal personen waarvan een tiental kinderen.',
})
taak('t-jolien', 'l-overview', OVERVIEW, 'request', { pax: 60, eventType: 'Verjaardag',
  title: 'Verjaardag & doopsel — 15 november (Jolien en Bernd)', assignees: ['u-jasper'],
  dueDate: dag(48), brandId: 'feestbeest', tags: ['feestbeest'],
})
taak('t-astrid', 'l-overview', OVERVIEW, 'invoiced', { pax: 110, formule: 'Buffet', eventType: 'Huwelijk', eventDate: dag(-40),
  title: 'Astrid Odeurs — trouwfeest', assignees: ['u-elke'], budget: 14250, tracked: 28800,
  socialStage: 'posted',
})
taak('t-magirus', 'l-overview', OVERVIEW, 'invoiced', { pax: 90, eventType: 'Bedrijfsevent', eventDate: dag(-60),
  title: 'Magirus — opbouw 29 mei, gebruik 30 mei', assignees: ['u-elke'], budget: 12600, tracked: 23400,
})
taak('t-winterbar', 'l-overview', OVERVIEW, 'planning ongoing', { pax: 600, formule: 'Chalets + après-ski bar', eventType: 'Eigen event', budget: 18000,
  title: 'Winterbar', assignees: ['u-anneleen'], tags: ['wintermoods'], brandId: 'wintermoods', dueDate: dag(55),
})
taak('t-menukaart', 'l-overview', OVERVIEW, 'request', { eventType: 'Intern',
  title: 'Menukaart drukken + prijzen ingeven', assignees: ['u-elke'], brandId: 'meer',
})


// Taken met een deadline in de komende dagen: Mijn taken en de werklast.
taak('t-trouw-4', 'l-overview', OVERVIEW, 'create offer', { parentId: 't-trouw', title: 'Tent en vloer bevestigen bij verhuur', assignees: ['u-elke'], dueDate: dag(2), priority: 2, estimate: 90, comments: 1,
  checklist: [{ text: 'Offerte tent 12×24 m', done: true }, { text: 'Vloer + verlichting', done: false }, { text: 'Levering daags voordien', done: false }] })
taak('t-trouw-5', 'l-overview', OVERVIEW, 'create offer', { parentId: 't-trouw', title: 'Drankenlijst finaliseren', assignees: ['u-jasper'], dueDate: dag(3), estimate: 120,
  checklist: [{ text: 'Bubbels onthaal', done: true }, { text: 'Wijnen diner', done: false }, { text: 'Afterparty', done: false }] })
taak('t-trouw-6', 'l-overview', OVERVIEW, 'create offer', { parentId: 't-trouw', title: 'Opbouwploeg inplannen', assignees: ['u-jasper'], dueDate: dag(1), estimate: 60 })
taak('t-trouw-7', 'l-overview', OVERVIEW, 'create offer', { parentId: 't-trouw', title: 'Menukeuze doorgeven aan traiteur', assignees: ['u-anneleen'], dueDate: dag(0), estimate: 60 })
taak('t-blum-4', 'l-overview', OVERVIEW, 'offer accepted', { parentId: 't-blum', title: 'Offertes leveranciers opvragen', assignees: ['u-elke'], dueDate: dag(3), estimate: 180,
  checklist: [{ text: 'Verhuur', done: true }, { text: 'Catering', done: true }, { text: 'Sanitair', done: false }, { text: 'Drank', done: false }] })
taak('t-blum-5', 'l-overview', OVERVIEW, 'offer accepted', { parentId: 't-blum', title: 'Plaatsbezoek loods', assignees: ['u-jasper'], dueDate: dag(4), estimate: 120 })
taak('t-winterbar-1', 'l-overview', OVERVIEW, 'planning ongoing', { parentId: 't-winterbar', title: 'Vergunning stad Tongeren', assignees: ['u-anneleen'], dueDate: dag(-4), priority: 1, estimate: 120 })
taak('t-winterbar-2', 'l-overview', OVERVIEW, 'planning ongoing', { parentId: 't-winterbar', title: 'Chalets bestellen', assignees: ['u-jasper'], dueDate: dag(17), estimate: 180 })
taak('t-canon-1', 'l-overview', OVERVIEW, 'ready to invoice', { parentId: 't-canon', title: 'Factuur opmaken', assignees: ['u-elke'], dueDate: dag(1), priority: 1, estimate: 30 })
taak('t-loonse-1', 'l-overview', OVERVIEW, 'ready to invoice', { parentId: 't-loonse', title: 'Factuur opmaken', assignees: ['u-elke'], dueDate: dag(-2), priority: 1, estimate: 30 })
taak('t-vinne-1', 'l-overview', OVERVIEW, 'offer accepted', { parentId: 't-vinne', title: 'Aankondiging socials', assignees: ['u-charish'], dueDate: dag(0), estimate: 90, repeat: 'Wekelijks' })
taak('t-vinne-2', 'l-overview', OVERVIEW, 'offer accepted', { parentId: 't-vinne', title: 'Personeelsplanning bar', assignees: ['u-anneleen'], dueDate: dag(2), estimate: 120 })
taak('t-vrijwilligers-1', 'l-overview', OVERVIEW, 'offer send', { parentId: 't-vrijwilligers', title: 'Opvolgen offerte', assignees: ['u-jasper'], dueDate: dag(2), estimate: 15, repeat: 'Na 3 dagen' })
taak('t-jolien-1', 'l-overview', OVERVIEW, 'request', { parentId: 't-jolien', title: 'Klant terugbellen', assignees: ['u-elke'], dueDate: dag(0), estimate: 15 })

// Socials
taak('t-soc-1', 'l-socials', SOCIALS, 'in progress', { title: 'JE Concept (28 sep – 4 okt)', assignees: ['u-charish'], tags: ['je concept'] })
taak('t-soc-2', 'l-socials', SOCIALS, 'in progress', { title: 'Meer Contents (28 sep – 4 okt)', assignees: ['u-charish'], brandId: 'meer', tags: ['meer'] })
taak('t-soc-3', 'l-socials', SOCIALS, 'ready for review', { title: 'Bar Vue — nieuwe wijnkaart', assignees: ['u-charish'], brandId: 'bar-vue', tags: ['barvue'] })
taak('t-soc-4', 'l-socials', SOCIALS, 'pending', { title: 'Feestbeest — verjaardagsformules', assignees: ['u-charish'], brandId: 'feestbeest' })
taak('t-soc-5', 'l-socials', SOCIALS, 'done', { title: 'Terugblik Loonse Feesten', assignees: ['u-charish'] })


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

// Een lopende timer, zodat de zijbalk meteen leeft — vanaf nu gerekend, niet
// vanaf de vaste demodag, anders staat hij op een dag en meer.
const loopt = new Date(Date.now() - (23 * 60 + 12) * 1000)
seedDoc('runningTimers', 'u-jasper', {
  profileId: 'u-jasper', taskId: 't-trouw-5', taskTitle: 'Drankenlijst finaliseren',
  listId: 'l-overview', listName: 'Events', brandId: null,
  description: '', startedAt: loopt, billable: true,
})

// ─── Social posts ───────────────────────────────────────────────────────────
//
// Sommige posts zitten al in een reviewronde; hun beslissingen staan verderop
// in het logboek.
//
// `over` is de publicatiedatum in dagen vanaf nu, `event` die van het event
// waar de post bij hoort. Die twee lopen uiteen en dat is het punt: een
// aankondiging gaat weken vooraf online, een nabeschouwing dagen erna.
// `oud: true` zet er een post in zoals ze in de database stonden vóór
// `publishAt` bestond — alleen een eventdatum. De kalender hoort die nog
// steeds te tonen.

function post(id, o) {
  const moment = (over) =>
    over == null ? null : (() => { const d = dag(over); d.setHours(o.uur ?? 10, 0, 0, 0); return d })()

  const publicatie = moment(o.over)
  const eventdatum = o.event == null ? publicatie : moment(o.event)

  seedDoc('socialPosts', id, {
    brandId: o.brandId, listId: 'l-socials', title: o.title,
    caption: o.caption ?? '', hashtags: o.hashtags ?? '',
    channels: o.channels,
    ...(o.oud ? {} : { publishAt: publicatie }),
    scheduledAt: eventdatum, status: o.status,
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

post('p1', { brandId: 'meer', title: 'Herfstwandeling Het Vinne', over: 2, event: 9, status: 'scheduled', channels: ['instagram', 'facebook'],
  reviewState: 'approved', reviewRound: 1,
  taskId: 't-vinne', taskTitle: 'Wandelzondag Vinne',
  hashtags: '#hetvinne #haspengouw #herfst',
  caption: 'Zondag wandelen door het Vinne, en achteraf iets warms op het terras. 🍂' })

post('p2', { brandId: 'bar-vue', title: 'Bar Vue cocktailweek', over: 3, status: 'review', channels: ['instagram', 'tiktok'],
  reviewState: 'requested', reviewRound: 2,
  hashtags: '#barvue #sinttruiden #cocktails',
  caption: 'Zeven avonden, zeven cocktails. Van maandag tot zondag, telkens één nieuwe op de kaart.',
  reviewerId: 'u-jasper', reviewNote: 'Tweede versie — logo staat nu links onder.' })

post('p3', { brandId: 'je-concept', title: 'Haspengouw Culinair sfeerbeeld', over: 4, event: 11, status: 'approved', channels: ['instagram', 'linkedin'],
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

// Weken vóór het event: de aankondiging van een feest dat pas eind oktober is.
post('p8', { brandId: 'je-concept', title: 'Blum 20 jaar — aankondiging', over: 1, event: 30, uur: 9, status: 'scheduled',
  channels: ['linkedin', 'facebook'],
  reviewState: 'approved', reviewRound: 1,
  taskId: 't-blum', taskTitle: 'Blum België — 20-jarig bestaan',
  hashtags: '#blum #jeconcept #bedrijfsfeest',
  caption: 'Twintig jaar Blum België, en wij mogen het feest bouwen. Save the date. 🎉' })

// Dagen ná het event: de nabeschouwing van iets dat vorige week doorging.
post('p9', { brandId: 'je-concept', title: 'Loonse Feesten — nabeschouwing', over: 5, event: -6, uur: 19, status: 'approved',
  channels: ['instagram', 'facebook'],
  reviewState: 'approved', reviewRound: 1,
  hashtags: '#loonsefeesten #borgloon #jeconcept',
  caption: 'Drie dagen, veertienhonderd borden en geen druppel regen. Bedankt Borgloon.' })

// Zoals de posts erin stonden vóór er een publicatiedatum bestond: alleen de
// datum die van het event kwam. De kalender valt daarop terug.
post('p10', { brandId: 'bar-vue', title: 'Wijnproeverij — oude planning', over: 2, uur: 17, status: 'draft',
  channels: ['facebook'], oud: true,
  notes: 'Staat nog op de eventdatum; er is nog geen eigen publicatiemoment gekozen.' })

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
  ownerId: 'u-jasper', assignees: ['u-elke', 'u-anneleen'],
  startDate: D('2026-10-01'), dueDate: D('2026-12-31'),
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

/**
 * De lijst van gisteren, met tijdstippen zoals de server ze teruggeeft.
 *
 * Dit staat er om één fout vast te houden. De echte database geeft een tijdstip
 * terug als Timestamp, niet als Date, en de afvinktijd van een punt zit genest
 * in `items.<punt>.at`. Die werd niet omgezet, `Intl` gooide er
 * `RangeError: Invalid time value` op, en wie op ‹ klikte om de vorige dag te
 * bekijken kreeg een wit scherm. Met gewone Date-objecten in de demo was dat
 * niet te zien — vandaar hier een Timestamp, net als echt.
 */
const stempel = (datum) => ({
  seconds: Math.floor(datum.getTime() / 1000),
  nanoseconds: 0,
  toDate: () => datum,
})

const gisteren = dag(-1).toISOString().slice(0, 10)
const afgevinktGisteren = (id, wie, naam, uur) => [id, {
  done: true, byId: wie, byName: naam,
  at: stempel(new Date(`${gisteren}T${uur}:00`)),
}]

seedDoc('checklistRuns', `openen_${gisteren}`, {
  checklistId: 'openen', checklistKey: 'openen', checklistName: 'Openen van de bistro',
  brandId: null, day: gisteren, date: new Date(`${gisteren}T12:00:00`), weekend: false,
  participants: ['u-lotte'],
  items: Object.fromEntries([
    afgevinktGisteren('sleutel', 'u-lotte', 'Lotte Vrijsen', '08:05'),
    afgevinktGisteren('alarm', 'u-lotte', 'Lotte Vrijsen', '08:06'),
  ]),
  notes: 'Rustige ochtend, niets bijzonders.',
  notesById: 'u-lotte', notesByName: 'Lotte Vrijsen',
  notesAt: stempel(new Date(`${gisteren}T08:40:00`)),
  closedAt: stempel(new Date(`${gisteren}T23:40:00`)),
  closedById: 'u-lotte', closedByName: 'Lotte Vrijsen',
  updatedAt: NU,
})

// ─── Teamoverleg ────────────────────────────────────────────────────────────
seedDoc('lists', 'l-overleg', {
  spaceId: 's-je', folderId: null, brandId: null, name: 'Tasks',
  description: 'Losse taken en de verslagen van het teamoverleg, met de actiepunten eronder.',
  kind: 'tasks', position: 3, archived: false,
  statuses: [
    { id: 'o1', name: 'open', color: '#8593a9', kind: 'open', position: 0 },
    { id: 'o2', name: 'on going', color: '#3377ff', kind: 'active', position: 1 },
    { id: 'o3', name: 'closed', color: '#008844', kind: 'closed', position: 2 },
  ],
  createdAt: D('2026-01-10'),
})

seedDoc('tasks', 't-overleg-1', {
  listId: 'l-overleg', listName: 'Tasks', spaceId: 's-je', brandId: null, parentId: null,
  title: 'Weekstart events — 21/09/2026', description: '',
  statusId: 'o2', statusName: 'on going', statusColor: '#3377ff', statusKind: 'active',
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
    statusId: 'o2', statusName: 'on going', statusColor: '#3377ff', statusKind: 'active',
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

seedDoc('config', 'access', {
  allowedDomains: ['jeconcept.be', 'kenjeklanten.be'],
  socialOwnerEmail: 'charish.talento@gmail.com',
  updatedAt: NU,
})
