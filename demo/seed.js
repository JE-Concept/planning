/**
 * Demogegevens: de JE Concept-werkruimte zoals ze vandaag in ClickUp staat.
 * Echte dossiers, echte mensen, echte statussen — zodat de demo leest als de
 * tool en niet als een testbestand.
 */
import { seedDoc } from './firestore.js'
import { CHECKLIST_TEMPLATES } from '../src/lib/checklist-templates.js'
import { DEFAULT_FORMULES } from '../src/lib/formule-templates.js'

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
    id: 'k-blum', name: 'Blum België', vatNumber: 'BE 0456.789.133',
    email: 'events@blum.be', phone: '011 22 33 44', website: 'https://www.blum.com',
    brandId: 'je-concept',
    address: { street: 'Industrieweg 12', postalCode: '3800', city: 'Sint-Truiden', country: 'België' },
    // De factuur gaat naar de boekhouding op de hoofdzetel, de post naar de
    // vestiging. Precies het geval waarvoor het factuuradres apart staat.
    billingEmail: 'facturen@blum.be',
    billingAddress: { street: 'Boekhouding, Postbus 40', postalCode: '3800', city: 'Sint-Truiden', country: 'België' },
    contacts: [
      { id: 'c-blum-1', name: 'Karen Vandeput', role: 'HR-manager', email: 'karen@blum.be', phone: '0478 12 34 56', primary: true },
      { id: 'c-blum-2', name: 'Tom Peeters', role: 'Boekhouding', email: 'facturen@blum.be', phone: '' },
    ],
    notes: 'Factuur altijd naar boekhouding, nooit naar HR. Vegetarisch aanbod is een vast punt.',
  },
  {
    id: 'k-niels-inez', name: 'Niels & Inez', vatNumber: '',
    email: 'niels.inez@telenet.be', phone: '0495 66 77 88', website: '',
    brandId: 'feestbeest',
    address: { street: 'Hoeve Vanhove', postalCode: '3720', city: 'Kortessem', country: 'België' },
    contacts: [{ id: 'c-ni-1', name: 'Inez Claes', role: 'Bruid', email: 'inez@telenet.be', phone: '0495 66 77 88', primary: true }],
    notes: 'Regenplan in de schuur. Dansvloer breder dan bij de Odeurs-trouw.',
    // De sleutel van hun eigen pagina, waar al hun dossiers bij elkaar staan.
    portalToken: 'demo-klant-token-nielsinez',
  },
  {
    id: 'k-borgloon', name: 'Stad Borgloon', vatNumber: 'BE 0207.474.981',
    email: 'evenementen@borgloon.be', phone: '012 67 36 55', website: 'https://www.borgloon.be',
    brandId: null,
    address: { street: 'Speelhof 10', postalCode: '3840', city: 'Borgloon', country: 'België' },
    contacts: [
      { id: 'c-bl-1', name: 'Marleen Gijsen', role: 'Dienst evenementen', email: 'marleen@borgloon.be', phone: '012 67 36 60', primary: true },
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

// ─── De post ────────────────────────────────────────────────────────────────

/*
  Wat er op info@jeconcept.be binnenkomt. Eén draad die aan een event hangt en
  één aanvraag die nergens bij hoort — dat zijn de twee gevallen die het scherm
  moet aankunnen.
*/
function mail(id, o) {
  seedDoc('mails', id, {
    richting: o.richting ?? 'in',
    messageId: o.messageId ?? `${id}@mail.example`,
    inReplyTo: o.inReplyTo ?? null,
    references: o.references ?? null,
    van: o.van ?? '',
    aan: o.aan ?? 'info@jeconcept.be',
    cc: '',
    onderwerp: o.onderwerp ?? '',
    tekst: o.tekst ?? '',
    bijlagen: o.bijlagen ?? [],
    datum: o.datum,
    eventId: o.eventId ?? null,
    customerId: o.customerId ?? null,
    koppeling: o.koppeling ?? null,
    opgehaaldOp: o.datum,
  })
}

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
    locationPlaceId: o.placeId ?? null, locationLat: o.lat ?? null, locationLng: o.lng ?? null,
    assignees: o.assignees ?? [], tags: o.tags ?? [],
    customerId: o.customerId ?? null,
    customerName: o.customerId ? KLANTNAMEN[o.customerId] : null,
    socialStage: o.socialStage ?? null,
    planning: o.planning ?? null,
    // Wat de fiche uit het design toont: gasten, formule, type, offerte, dag.
    eventDate: o.eventDate ?? (o.parentId ? null : o.dueDate ?? null),
    pax: o.pax ?? null, kids: o.kids ?? null, formule: o.formule ?? null,
    eventType: o.eventType ?? null, quoteAmount: o.budget ?? null,
    draaiboek: o.draaiboek ?? null, checklist: o.checklist ?? [], repeat: o.repeat ?? null,
    socialWanted: o.socialWanted ?? null,
    position: (pos += 1024),
    archived: false, completedAt: s.kind === 'closed' || s.kind === 'done' ? dag(-20) : null,
    trackedSeconds: o.tracked ?? 0, commentCount: o.comments ?? 0,
    // Taken die uit de ClickUp-migratie komen dragen dat merkje. De fiche leest
    // eraan af dat hun aanmaakdatum de dag van de verhuizing is en niets meer.
    clickupId: o.clickupId ?? null,
    createdBy: 'u-jasper', createdAt: o.createdAt ?? dag(-30), updatedAt: dag(-1),
  })

  spiegelSocial(id, {
    title: o.title,
    listId,
    listName: list,
    statusName: s.name,
    statusKind: s.kind,
    socialStage: o.socialStage ?? null,
    socialWanted: o.socialWanted ?? null,
    dueDate: o.dueDate ?? null,
    eventDate: o.eventDate ?? (o.parentId ? null : o.dueDate ?? null),
    location: o.location ?? null,
    locationPlaceId: o.placeId ?? null,
    locationLat: o.lat ?? null,
    locationLng: o.lng ?? null,
    customerName: o.customerId ? KLANTNAMEN[o.customerId] : null,
    brandId: o.brandId ?? null,
    assignees: o.assignees ?? [],
    tags: o.tags ?? [],
    parentId: o.parentId ?? null,
    position: pos,
    archived: false,
  })
}

/**
 * De kale kopie van een event, zoals de socialrol ze ziet.
 *
 * In de echte tool houdt een trigger deze bij (`functions/social-projectie.js`);
 * de demo heeft geen functions, dus doet de seed het. Wat erin mag staat daar
 * als witte lijst, en hier staat precies hetzelfde — met opzet géén `budget`,
 * `quoteAmount` of `pax`.
 *
 * Dat de twee uit elkaar kunnen lopen is het risico van een demo zonder server.
 * Het alternatief — de socialrol in de demo op de echte events laten kijken —
 * is erger: dan zegt de browsertest groen over een scherm dat live iets anders
 * toont.
 */
const SOCIAL_VANAF = ['ready to invoice', 'invoiced', 'complete']
function spiegelSocial(id, kaart) {
  const hoortErop =
    kaart.socialWanted !== false &&
    (Boolean(kaart.socialStage) || kaart.socialWanted === true || SOCIAL_VANAF.includes(kaart.statusName))
  if (!hoortErop || kaart.parentId) return
  seedDoc('socialEvents', id, { ...kaart, taskId: id, bijgewerkt: NU })
}

taak('t-trouw', 'l-overview', OVERVIEW, 'create offer', { planning: 'bezig', pax: 140, kids: 12, formule: 'Walking dinner + dessertbuffet', eventType: 'Huwelijk', eventDate: dag(12), draaiboek: [{ tijd: '09:00', wat: 'Opbouw tent, vloer en verlichting', wie: 'Jasper · verhuur' }, { tijd: '13:00', wat: 'Levering sanitair en koeling', wie: 'Elke' }, { tijd: '15:00', wat: 'Ceremonie klaarzetten in de boomgaard', wie: 'Anneleen' }, { tijd: '15:30', wat: 'Ceremonie', wie: 'Anneleen' }, { tijd: '16:30', wat: 'Receptie met bubbels', wie: 'bar' }, { tijd: '18:30', wat: 'Walking dinner', wie: 'traiteur' }, { tijd: '21:30', wat: 'Dessertbuffet + openingsdans', wie: 'Anneleen' }, { tijd: '22:00', wat: 'Avondbar tot 03:00', wie: 'Jasper' }],
  title: 'Trouw Niels en Inez', assignees: ['u-jasper', 'u-elke'], priority: 2, customerId: 'k-niels-inez',
  dueDate: dag(6), budget: 16399, location: 'Hoeve Vanhove, Kortessem',
  // Eén event met een echte plek erachter, zodat de kaartlink op de fiche te
  // zien is zonder dat de demo een Google-sleutel nodig heeft.
  placeId: 'ChIJdemoHoeveVanhove', lat: 50.856, lng: 5.383,
  estimate: 480, tracked: 20700, comments: 2, tags: ['losse events'],
  description: '**Fiche evenement**\n\n- Opbouw zaterdag 3 juli vanaf 14.00 — tent, vloer, verlichting\n- Ceremonie 15.30 in de boomgaard, plan B in de schuur bij regen\n- Receptie 16.30 · walking dinner 18.30 · avondbar tot 03.00\n- 140 personen, waarvan 12 kinderen\n\n**Openstaande punten**\n\n- Regenplan bevestigen met de eigenaar\n- Aantal vegetarische gasten navragen',
})
taak('t-trouw-1', 'l-overview', OVERVIEW, 'create offer', { parentId: 't-trouw', title: 'Offerte afwerken en versturen', assignees: ['u-elke'], dueDate: dag(3), priority: 1 })
taak('t-trouw-2', 'l-overview', OVERVIEW, 'complete',     { parentId: 't-trouw', title: 'Locatiebezoek inplannen', assignees: ['u-jasper'] })
taak('t-trouw-3', 'l-overview', OVERVIEW, 'create offer', { parentId: 't-trouw', title: 'Prijs open bar apart opgeven', assignees: ['u-elke'] })

taak('t-blum', 'l-overview', OVERVIEW, 'offer accepted', { pax: 180, formule: 'Receptie + diner + dansfeest', eventType: 'Bedrijfsevent',
  title: 'Blum België — 20-jarig bestaan', assignees: ['u-jasper'], priority: 2, customerId: 'k-blum',
  dueDate: dag(82), budget: 24800, location: 'Cultureel Centrum, Sint-Truiden',
  tracked: 35100, comments: 1, tags: ['losse events'], clickupId: '86b1qk4x9',
  description: '180 medewerkers + partners. Onthaal 18.30 · diner 20.00 · dansfeest tot 02.00.\n\nOpbouw donderdag 18 december vanaf 09.00.',
})
// De historiek van Blum: twee afgeronde dossiers en één dat op de factuur wacht.
// Zonder dat is een klantfiche een adresboekje.
taak('t-blum-kerst', 'l-overview', OVERVIEW, 'invoiced', { pax: 120, formule: 'Winterreceptie', eventType: 'Bedrijfsevent',
  title: 'Blum België — kerstborrel 2025', assignees: ['u-elke'], customerId: 'k-blum',
  eventDate: D('2025-12-18T17:00:00'), dueDate: D('2025-12-18T17:00:00'), budget: 6800, tracked: 14400,
})
taak('t-blum-team', 'l-overview', OVERVIEW, 'ready to invoice', { pax: 60, formule: 'BBQ en randanimatie', eventType: 'Teambuilding',
  title: 'Blum België — teambuilding productie', assignees: ['u-jasper', 'u-elke'], customerId: 'k-blum',
  eventDate: dag(-18), dueDate: dag(-18), budget: 4150, tracked: 9000, priority: 1,
})
taak('t-blum-1', 'l-overview', OVERVIEW, 'offer accepted', { parentId: 't-blum', title: 'Voorschot factureren — 40%', assignees: ['u-elke'], priority: 1, dueDate: dag(2) })
taak('t-blum-2', 'l-overview', OVERVIEW, 'offer accepted', { parentId: 't-blum', title: 'Allergieënlijst opvragen bij HR', assignees: ['u-jasper'] })
taak('t-blum-3', 'l-overview', OVERVIEW, 'offer accepted', { parentId: 't-blum', title: 'Herasdoeken laten bedrukken', assignees: ['u-jasper'] })

taak('t-haspengouw', 'l-overview', OVERVIEW, 'planning ready', { planning: 'rond', pax: 600, formule: 'Standen + centrale bar', eventType: 'Stadsevent',
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
taak('t-jolien', 'l-overview', OVERVIEW, 'request', { planning: 'te_plannen', pax: 60, eventType: 'Verjaardag',
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

// ─── Afgesloten events uit vorige jaren ─────────────────────────────────────
//
// Die van vorig jaar en het jaar daarvoor: afgerond of allang gefactureerd, en
// dus weg van het bord maar terug te vinden in het archief, per jaar. Ze staan
// hier omdat het archief anders leeg is in de demo — en een filter op jaar dat
// je niet kunt uitproberen, is geen filter.
//
// De social-schakelaar staat uit: de content van vorig jaar staat allang
// online, en het socialbord gaat over wat er nog moet gebeuren.
taak('t-kerstmarkt-2025', 'l-overview', OVERVIEW, 'complete', { pax: 1800, formule: 'Drie chalets + glühweinbar', eventType: 'Stadsevent',
  title: 'Kerstmarkt Borgloon 2025', assignees: ['u-jasper', 'u-anneleen'], customerId: 'k-borgloon',
  eventDate: D('2025-12-13T12:00:00'), dueDate: D('2025-12-13T12:00:00'), budget: 27400,
  location: 'Grote Markt, Borgloon', tracked: 104400, socialWanted: false,
  description: 'Drie chalets aan de kerk, glühweinbar centraal. Eindafrekening in januari afgesloten.',
})
taak('t-oldskool-2024', 'l-overview', OVERVIEW, 'complete', { pax: 900, formule: 'Twee bars + backstage', eventType: 'Festival',
  title: 'Oldskool Festival 2024', assignees: ['u-jasper'], tags: ['oldskool'],
  eventDate: D('2024-09-21T12:00:00'), dueDate: D('2024-09-21T12:00:00'), budget: 19200,
  location: 'Sportterrein, Wellen', tracked: 79200, socialWanted: false,
})
// Gefactureerd, nooit op "Afgerond" gezet — precies het geval waarvoor de
// tweede archiefregel bestaat: na twee maanden is dat geen planningswerk meer.
taak('t-blum-kick-2025', 'l-overview', OVERVIEW, 'invoiced', { pax: 120, formule: 'Ontbijtbuffet', eventType: 'Bedrijfsevent',
  title: 'Blum België — kick-off 2025', assignees: ['u-elke'], customerId: 'k-blum',
  eventDate: D('2025-02-06T12:00:00'), dueDate: D('2025-02-06T12:00:00'), budget: 8600,
  location: 'Industrieweg 12, Sint-Truiden', tracked: 21600, socialWanted: false,
})


// Werk dat niemand opgepakt heeft. Zo'n taak komt in geen enkele persoonlijke
// lijst voor en was daardoor voor iedereen onzichtbaar — precies het werk dat
// blijft liggen omdat elk aanneemt dat een ander het doet.
taak('t-trouw-9', 'l-overview', OVERVIEW, 'create offer', { parentId: 't-trouw',
  title: 'Parkeerplan doorgeven aan de gemeente', dueDate: dag(4) })

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

// ─── Activiteitslog ─────────────────────────────────────────────────────────
//
// Wie wijzigde wat, wanneer. In het paneel staat dit door de reacties heen, en
// dat is het punt: "verzet naar volgende week" leest pas als iets wanneer de
// reactie eronder vertelt dat de klant belde.
;[
  ['a1', 't-trouw', 'status', 'request', 'create offer', 'u-jasper', dag(-13)],
  ['a2', 't-trouw', 'assignees', ['u-jasper'], ['u-jasper', 'u-elke'], 'u-jasper', dag(-12)],
  ['a3', 't-trouw', 'dueDate', D('2026-09-30T12:00:00').toISOString(), D('2026-10-04T12:00:00').toISOString(), 'u-elke', dag(-11)],
  ['a4', 't-trouw', 'priority', null, 2, 'u-elke', dag(-8)],
  ['a5', 't-blum', 'status', 'offer send', 'offer accepted', 'u-jasper', dag(-7)],
  ['a6', 't-blum', 'assignees', [], ['u-jasper'], 'u-elke', dag(-7)],
  ['a7', 't-trouw-2', 'afgerond', 'create offer', 'complete', 'u-jasper', dag(-5)],
].forEach(([id, taskId, veld, van, naar, createdBy, createdAt]) =>
  seedDoc('activity', id, { taskId, veld, van, naar, createdBy, createdAt }))

// ─── Tijdregistratie ────────────────────────────────────────────────────────
const maand = '2026-09'
let te = 0
function tijd(profileId, taskId, taskTitle, uren, omschrijving, dagenTerug) {
  const start = new Date(dag(-dagenTerug)); start.setHours(9, 0, 0, 0)
  const eind = new Date(start.getTime() + uren * 3600000)
  const d = start.toISOString().slice(0, 10)
  seedDoc('timeEntries', `te-${te += 1}`, {
    profileId, taskId, taskTitle, listId: 'l-overview', listName: 'Events',
    brandId: null, description: omschrijving,
    startedAt: start, endedAt: eind, durationSeconds: Math.round(uren * 3600),
    day: d, month: maand, week: '2026-W40', createdAt: start,
  })
}
tijd('u-jasper', 't-trouw', 'Trouw Niels en Inez', 3.5, 'Locatiebezoek en opmeting', 1)
tijd('u-elke', 't-trouw', 'Trouw Niels en Inez', 2.25, 'Offerte opmaken', 1)
tijd('u-jasper', 't-haspengouw', 'Haspengouw Culinair — Grote Markt', 8, 'Opbouw en coördinatie', 7)
tijd('u-anneleen', 't-haspengouw', 'Haspengouw Culinair — Grote Markt', 6.5, 'Standenplan en communicatie', 7)
tijd('u-elke', 't-blum', 'Blum België — 20-jarig bestaan', 2.5, 'Leveranciers vergelijken', 2)
tijd('u-charish', null, null, 6.5, 'Contentkalender oktober uitwerken', 3)
tijd('u-charish', null, null, 4, 'Reels monteren Haspengouw Culinair', 2)
tijd('u-elke', 't-loonse', 'Loonse Feesten 2026', 1.75, 'Eindafrekening', 4)
tijd('u-jasper', 't-optimum', '20 m Pipe & Drape — Optimum Sorting — Opbouw', 2, 'Plaatsbezoek', 5)

// Een lopende timer, zodat de zijbalk meteen leeft — vanaf nu gerekend, niet
// vanaf de vaste demodag, anders staat hij op een dag en meer.
const loopt = new Date(Date.now() - (23 * 60 + 12) * 1000)
seedDoc('runningTimers', 'u-jasper', {
  profileId: 'u-jasper', taskId: 't-trouw-5', taskTitle: 'Drankenlijst finaliseren',
  listId: 'l-overview', listName: 'Events', brandId: null,
  description: '', startedAt: loopt,})

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

/*
  De ochtendlijst van vandaag, half afgewerkt door twee mensen — zo leest de
  demo als een dienst die bezig is in plaats van als een leeg formulier.

  Deze twee dagen hangen aan de echte klok en niet aan `NU`. De rest van de demo
  mag op een vaste datum staan (dan blijven de events en de bedragen elke dag
  gelijk), maar het scherm "Openen & sluiten" zoekt de lijst van vandaag op de
  dag van de bezoeker. Stonden ze op een vaste datum, dan was de demo de dag
  erna een leeg formulier — en dan breekt de browsertest die juist nakijkt of de
  vorige dag nog opent.
*/
const ECHTE_DAG = new Date()
const echteDag = (n) => new Date(ECHTE_DAG.getTime() + n * 86400000)
const vandaag = echteDag(0).toISOString().slice(0, 10)
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

const gisteren = echteDag(-1).toISOString().slice(0, 10)
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

// ─── Het weekrooster ────────────────────────────────────────────────────────
// Een gewone week in de bistro, met één dienst die over middernacht loopt en
// één botsing — dat laatste omdat het rooster juist bestaat om zulke dingen te
// laten zien voor de dag zelf aanbreekt.
const maandagVanDeWeek = (() => {
  const d = new Date(NU)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return d
})()
const weekdag = (n) => {
  const d = new Date(maandagVanDeWeek)
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

;[
  ['u-lotte', 0, '08:00', '16:00', 30, 'Openen'],
  ['u-sam', 0, '11:00', '22:00', 60, 'Keuken'],
  ['u-lotte', 1, '08:00', '16:00', 30, ''],
  ['u-sam', 2, '11:00', '22:00', 60, ''],
  ['u-lotte', 3, '16:00', '23:30', 30, 'Sluiten'],
  ['u-sam', 4, '11:00', '22:00', 60, ''],
  ['u-lotte', 5, '18:00', '03:00', 45, 'Avondbar'],
  ['u-sam', 5, '17:00', '23:00', 30, ''],
  // Twee keer tegelijk: dit hoort rood te staan.
  ['u-sam', 5, '20:00', '23:30', 0, 'Dubbel ingepland'],
].forEach(([wie, dag, start, eind, pauze, notitie], i) =>
  seedDoc('shifts', `sh-${i}`, {
    profileId: wie, date: weekdag(dag), start, end: eind,
    breakMinutes: pauze, brandId: null, note: notitie, createdAt: NU, updatedAt: NU,
  })
)

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

// Een tweede verslag, zodat de zoekfunctie ook echt iets te filteren heeft.
seedDoc('meetings', 't-overleg-2', {
  taskId: 't-overleg-2', titel: 'Maandoverleg bistro', datum: '2026-09-07',
  deelnemers: ['Jasper Hansen', 'Elke Motmans'],
  samenvatting: [
    { onderwerp: 'Winterkaart Bar Vue', tekst: 'De nieuwe kaart gaat half oktober in. De wijnen worden herzien met de leverancier.' },
    { onderwerp: 'Personeel zaal', tekst: 'Twee extra weekendkrachten gezocht voor november en december.' },
  ],
  bron: null,
  viewerIds: ['u-jasper', 'u-anneleen', 'u-maxine', 'u-elke'],
  createdAt: dag(-21),
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

// Een samengestelde regel en een beslissingstabel, zodat in de demo te zien is
// waar het over gaat: de eerste twee hierboven staan er nog in de oude,
// enkelvoudige vorm en worden gewoon meegelezen.
seedDoc('automations', 'grote-aanvraag', {
  name: 'Grote aanvraag meteen bij Jasper',
  kind: 'rule',
  entity: 'task',
  enabled: true,
  listId: 'l-overview',
  trigger: { kind: 'changed', field: 'statusName' },
  when: {
    kind: 'all',
    nodes: [
      { kind: 'condition', field: 'statusName', op: 'is', value: 'request' },
      {
        kind: 'any',
        nodes: [
          { kind: 'condition', field: 'budget', op: 'gte', value: 10000 },
          { kind: 'condition', field: 'pax', op: 'gt', value: 150 },
        ],
      },
    ],
  },
  actions: [
    { kind: 'assignees', mode: 'add', profileIds: ['u-jasper'] },
    { kind: 'tag', value: 'opvolgen', date: { mode: 'relative', days: 3 } },
  ],
  position: 2,
  createdAt: dag(-14),
  updatedAt: dag(-14),
})

seedDoc('automations', 'offerte-tabel', {
  name: 'Wie maakt de offerte',
  kind: 'table',
  entity: 'task',
  enabled: true,
  listId: 'l-overview',
  trigger: { kind: 'changed', field: 'statusName' },
  when: { kind: 'all', nodes: [{ kind: 'condition', field: 'statusName', op: 'is', value: 'create offer' }] },
  inputs: [
    { field: 'budget', op: 'gte' },
    { field: 'eventType', op: 'is' },
  ],
  rows: [
    { id: 'groot-huwelijk', label: 'groot huwelijk', cells: [10000, 'Huwelijk'],
      actions: [{ kind: 'assignees', mode: 'set', profileIds: ['u-elke'] }, { kind: 'priority', value: 2 }] },
    { id: 'groot', label: 'groot', cells: [10000, ''],
      actions: [{ kind: 'assignees', mode: 'set', profileIds: ['u-jasper'] }] },
    { id: 'de-rest', label: 'de rest', cells: ['', ''],
      actions: [{ kind: 'priority', value: 3 }] },
  ],
  position: 3,
  createdAt: dag(-10),
  updatedAt: dag(-10),
})

// Het logboek van de server. In de demo staat het er vast in; echt wordt het
// geschreven door de trigger die de regel toepaste.
seedDoc('automationRuns', 'run-1', {
  entity: 'task', collection: 'tasks', docId: 't-trouw', docTitle: 'Trouw Niels en Inez',
  rules: [{ id: 'offerte-tabel', name: 'Wie maakt de offerte', kind: 'table', rowId: 'groot-huwelijk', rowLabel: 'groot huwelijk' }],
  ruleIds: ['offerte-tabel'], fields: ['assignees', 'priority'], firedAt: dag(-2),
})

seedDoc('automationRuns', 'run-2', {
  entity: 'task', collection: 'tasks', docId: 't-blum', docTitle: 'Blum België — 20-jarig bestaan',
  rules: [{ id: 'grote-aanvraag', name: 'Grote aanvraag meteen bij Jasper', kind: 'rule', rowId: null, rowLabel: '' }],
  ruleIds: ['grote-aanvraag'], fields: ['assignees', 'tags'], firedAt: dag(-1),
})

// ─── Vaste formules ─────────────────────────────────────────────────────────
// De winter bbq aan 29,90 staat er echt in, zodat de browsertest een event uit
// een formule kan aanmaken en de bestellijst kan narekenen.
DEFAULT_FORMULES.forEach((formule, i) =>
  seedDoc('formules', formule.id, { ...formule, position: i, createdAt: dag(-60), updatedAt: dag(-60) }))

seedDoc('config', 'access', {
  allowedDomains: ['jeconcept.be', 'kenjeklanten.be'],
  socialOwnerEmail: 'charish.talento@gmail.com',
  updatedAt: NU,
})

// ─── Het logboek ────────────────────────────────────────────────────────────
/*
  In de echte tool schrijven triggers dit, met beheerdersrechten en buiten de
  browser om. De demo heeft geen functions, dus staat er hier een handvol regels
  vast in — genoeg om te zien hoe het leest en om de browsertest iets te geven
  om op te filteren.

  De regels zijn met opzet van verschillende soorten en van verschillende
  mensen: dat is precies waar de filters voor zijn.
*/
;[
  ['log-1', -0.2, 'taak', 't-trouw', 'Trouw Niels en Inez', 'u-elke', 'Elke Motmans', 'gewijzigd',
    [{ veld: 'quoteAmount', van: '16399', naar: '17200' }]],
  ['log-2', -0.4, 'taak', 't-trouw', 'Trouw Niels en Inez', 'u-jasper', 'Jasper Hansen', 'gewijzigd',
    [{ veld: 'statusName', van: 'request', naar: 'create offer' }]],
  ['log-3', -0.9, 'klant', 'k-blum', 'Blum België', 'u-jasper', 'Jasper Hansen', 'gewijzigd',
    [{ veld: 'vatNumber', van: 'leeg', naar: 'BE 0412.345.678' }]],
  ['log-4', -1.2, 'formule', 'f-winter-bbq', 'Winter BBQ', 'u-elke', 'Elke Motmans', 'gewijzigd',
    [{ veld: 'prijsPerPersoon', van: '27.5', naar: '29.9' }]],
  ['log-5', -1.6, 'profiel', 'u-charish', 'Charish Nolmans', 'u-jasper', 'Jasper Hansen', 'gewijzigd',
    [{ veld: 'role', van: 'member', naar: 'social' }]],
  ['log-6', -2.1, 'regel', 'grote-aanvraag', 'Grote aanvraag meteen bij Jasper', 'u-jasper', 'Jasper Hansen', 'aangemaakt', []],
  ['log-7', -3.4, 'dienst', 'sh-3', '2026-10-01 17:00-23:00', 'u-elke', 'Elke Motmans', 'gewijzigd',
    [{ veld: 'profileId', van: 'u-sam', naar: 'u-lotte' }]],
  ['log-8', -4.5, 'taak', 't-oud', 'Standenplan naar de stad', 'u-elke', 'Elke Motmans', 'verwijderd', []],
].forEach(([id, dagen, soort, documentId, naam, actorId, actorNaam, actie, wijzigingen]) =>
  seedDoc('auditLog', id, {
    at: new Date(ECHTE_DAG.getTime() + dagen * 86400000),
    collectie: { taak: 'tasks', klant: 'customers', formule: 'formules', profiel: 'profiles', regel: 'automations', dienst: 'shifts' }[soort],
    soort, documentId, naam, actie, wijzigingen, actorId, actorNaam,
    actorZeker: actie !== 'verwijderd',
  }))

/*
  De post. Een draad die aan een event hangt en een aanvraag die nergens bij
  hoort: precies de twee gevallen die de schermen moeten aankunnen.
*/
mail('m-trouw-1', {
  van: 'Inez Vanhees <inez@example.be>',
  aan: 'info@jeconcept.be',
  onderwerp: 'Trouw 10 oktober — bredere dansvloer?',
  tekst:
    'Dag,\n\nWe hebben de foto’s van de opstelling doorgestuurd. Eén vraag nog: kan de dansvloer een stuk breder dan bij de Odeurs-trouw? We verwachten dat er veel gedanst wordt.\n\nGroeten,\nInez',
  datum: dag(-11),
  eventId: 't-trouw',
  customerId: 'k-niels-inez',
  koppeling: 'klant',
})
mail('m-trouw-2', {
  richting: 'uit',
  van: 'JE Plan <plan@jeconcept.be>',
  aan: 'inez@example.be',
  onderwerp: 'Re: Trouw 10 oktober — bredere dansvloer?',
  inReplyTo: 'm-trouw-1@mail.example',
  tekst:
    'Dag Inez,\n\nDat kan. We rekenen met 6 op 6 meter in plaats van 5 op 5; dat past onder de tent zonder dat de bar moet schuiven. Het verschil zetten we op de offerte.\n\nGroeten,\nJasper',
  datum: dag(-10),
  eventId: 't-trouw',
  customerId: 'k-niels-inez',
  koppeling: 'verstuurd',
})
mail('m-aanvraag-kristien', {
  van: 'Kristien Maris <k.maris@example.be>',
  aan: 'info@jeconcept.be',
  onderwerp: 'Verjaardagsfeest 28 november',
  tekst: [
    'Beste,',
    '',
    'Mijn mama wordt op zaterdag 28 november 65 jaar en we zouden dit graag samen met familie en vrienden vieren.',
    '',
    'We denken aan een 40-tal personen en hadden het idee om er een gezellige winterbarbecue van te maken. Omdat jullie ook Het Vinne uitbaten, vroeg ik me af of het mogelijk is om dit feest in het zaaltje van Het Vinne te organiseren.',
    '',
    'Werken jullie voor dergelijke feesten met vaste formules of arrangementen? We ontvangen graag wat meer informatie over de mogelijkheden en richtprijzen.',
    '',
    'Alvast bedankt!',
    '',
    'met vriendelijke groet,',
    '',
    'Kristien Maris',
  ].join('\n'),
  datum: dag(-1),
})

/*
  Eén verstuurde offerte, zodat de klantenpagina iets te tonen heeft — en een
  portaalsleutel op dezelfde klant, zodat het overzicht van al zijn dossiers
  te openen is.
*/
seedDoc('offertes', 'off-trouw', {
  eventId: 't-trouw',
  nummer: '2026-014',
  datum: dag(-9),
  geldigTot: dag(21),
  klantId: 'k-niels-inez',
  klantNaam: KLANTNAMEN['k-niels-inez'],
  eventNaam: 'Trouw Niels en Inez',
  eventDatum: dag(12),
  locatie: 'Hoeve Vanhove, Kortessem',
  personen: 140,
  status: 'verstuurd',
  token: 'demo-offerte-token-niels',
  regels: [
    { id: 'r1', rubriek: 'catering', omschrijving: 'Walking dinner, zes gangen', eenheidExcl: 82, aantal: 140, eenheid: 'pp', btwPercent: 12, optioneel: false },
    { id: 'r2', rubriek: 'dranken', omschrijving: 'Open bar tot 03.00', eenheidExcl: 35.14, aantal: 140, eenheid: 'pp', btwPercent: 21, optioneel: false },
    { id: 'r3', rubriek: 'personeel', omschrijving: 'Bediening en toog, 8 uur', eenheidExcl: 28, aantal: 48, eenheid: 'u', btwPercent: 21, optioneel: false },
    { id: 'r4', rubriek: 'optioneel', omschrijving: 'Vuurkorven op het terras', eenheidExcl: 240, aantal: 1, eenheid: 'st', btwPercent: 21, optioneel: true },
  ],
  /*
    Het conceptvoorstel: de pagina's die de klant voor de tabel leest. De
    prijzen staan er met opzet niet allemaal op — de ontvangst heeft een eigen
    bedrag, de rest haalt het uit de regels hierboven. Zo dekt de demo allebei
    de manieren waarop een voorstel aan zijn prijs komt.
  */
  onderdelen: [
    {
      id: 'o-locatie',
      soort: 'locatie',
      titel: 'De',
      accent: 'locatie',
      tekst: 'Uw feest vindt plaats in de authentieke schuur van Hoeve Vanhove, die we exclusief voor uw gezelschap inrichten.',
      punten: [],
      perPersoon: null,
      prijsNoot: '',
    },
    {
      id: 'o-ontvangst',
      soort: 'ontvangst',
      titel: 'Ontvangst &',
      accent: 'hapjes',
      tekst: 'We verwelkomen uw gasten met een keuze uit cocktail, mocktail, cava of frisdrank.',
      punten: ['Oosterse scampi', 'Arrosticini', 'Loaded nacho'],
      perPersoon: 6,
      prijsNoot: '',
    },
    {
      id: 'o-hoofd',
      soort: 'hoofd',
      titel: 'Walking',
      accent: 'dinner',
      tekst: 'Zes gangen die aan tafel gebracht worden, met Haspengouwse producten als vertrekpunt. Vegetarische gangen zijn mogelijk; laat ons gerust weten of er allergieën zijn.',
      punten: [],
      perPersoon: null,
      prijsNoot: '',
    },
    {
      id: 'o-dranken',
      soort: 'dranken',
      titel: 'Open',
      accent: 'bar',
      tekst: 'De bar blijft open tot drie uur, met bediening aan de toog.',
      punten: ['Frisdranken, plat en bruisend water', 'Bier van het vat, cava', 'Een selectie witte, rosé en rode wijn'],
      perPersoon: null,
      prijsNoot: '',
    },
  ],
  createdAt: dag(-9),
})

/*
  Werk dat vanzelf terugkomt. Eén wekelijkse en één maandelijkse, zodat het
  scherm allebei de ritmes toont en de browsertest kan nakijken dat "volgende
  keer" er echt staat.
*/
seedDoc('herhalingen', 'ebox-controle', {
  titel: 'eBox / Doccle / burgerprofiel / e-Box enterprise controleren',
  omschrijving: 'Nakijken of er nieuwe officiële post binnenkwam.',
  doel: 'taak',
  listId: 'l-overleg',
  profileId: 'u-elke',
  brandId: null,
  soort: 'wekelijks',
  dagen: [1],
  dagVanMaand: 1,
  prioriteit: '',
  actief: true,
  createdAt: dag(-30),
})

seedDoc('herhalingen', 'je-nieuwsbrief', {
  titel: 'JE Nieuwsbrief',
  omschrijving: 'De maandelijkse nieuwsbrief opstellen en versturen.',
  doel: 'taak',
  listId: 'l-overleg',
  profileId: 'u-jasper',
  brandId: null,
  soort: 'maandelijks',
  dagen: [],
  dagVanMaand: 1,
  prioriteit: '',
  actief: true,
  createdAt: dag(-30),
})

/*
  Wat de tool over zichzelf bijhoudt. In de demo staat de ophaler op "net nog
  gedraaid", zodat het systeemscherm er groen bij staat — en één mail die niet
  vertrok, zodat ook de andere kant te zien is.
*/
seedDoc('instellingen', 'postvak', {
  laatsteUid: 4711,
  laatsteKeer: new Date(ECHTE_DAG.getTime() - 4 * 60000),
  laatsteAantal: 2,
})
seedDoc('mailQueue', 'mq-1', {
  aan: 'anneleen@kenjeklanten.be',
  soort: 'deadline',
  onderwerp: 'Morgen: Parkeerplan doorgeven aan de gemeente',
  status: 'mislukt',
  reden: 'Invalid login: 535-5.7.8 Username and Password not accepted.',
  pogingen: 1,
  createdAt: new Date(ECHTE_DAG.getTime() - 3600000),
})
