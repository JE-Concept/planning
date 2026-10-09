/**
 * Wat er bestaat om regels op te maken: entiteiten, hun velden, hun acties.
 *
 * ── Waarom dit bestand er is ────────────────────────────────────────────────
 *
 * De regelmotor deed tot nu één ding: iets met een taak, op één voorwaarde.
 * Elke nieuwe entiteit betekende in de oude opzet drie keer hetzelfde werk —
 * een tak in de motor, een tak in het beheerscherm, een tak in de tests — en
 * die drie liepen gegarandeerd uit elkaar. Daarom staat hier één beschrijving
 * van wat er bestaat, en bouwen de motor én het scherm zich daaruit op. Een
 * veld dat hier niet staat, kun je niet kiezen; een actie die hier niet staat,
 * wordt niet uitgevoerd.
 *
 * Dat laatste is geen netheid maar een grens. De motor draait server-side met
 * beheerdersrechten: ze mag alles. Wat ze werkelijk doet, is precies wat in
 * `actions` hieronder staat — en daar staan `role`, `active` en `email` van een
 * profiel bewust niet bij. Wie regels mag schrijven (een beheerder, zie
 * `firestore.rules`) kan zo niet via een regel iemands rol zetten.
 *
 * Het bestand staat in `functions/` omdat alleen die map mee uitgerold wordt en
 * de motor er niet zonder kan. Het beheerscherm leest hem via
 * `src/lib/automations.js`; dat is de enige plek in `src/` die hierheen wijst.
 *
 * Bewust puur: geen Firebase, geen `new Date()` buiten de meegegeven `now`. Zo
 * is elke regel na te rekenen in een test, en dat is nodig — dit is de enige
 * code die ongevraagd andermans werk aanpast.
 */

/**
 * Hoe diep een voorwaardeboom mag gaan.
 *
 * Niet omdat het rekenwerk duur is, maar omdat een voorwaarde die vier niveaus
 * diep staat door niemand meer nagelezen wordt — en dit is code die ongevraagd
 * andermans werk aanpast.
 */
export const MAX_DEPTH = 6

// ── Kleine hulpjes ──────────────────────────────────────────────────────────

/** Statussen heten "ready to invoice", niet "Ready To Invoice". */
export const norm = (value) => (value ?? '').toString().trim().toLowerCase()

export const unique = (values) =>
  [...new Set((values ?? []).filter((v) => v !== null && v !== undefined && v !== ''))]

/** Firestore Timestamp | Date | string → milliseconden, of null. */
export function millis(value) {
  if (value === null || value === undefined || value === '') return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.getTime()
  if (typeof value.toMillis === 'function') return value.toMillis()
  if (typeof value.toDate === 'function') return value.toDate().getTime()
  if (typeof value === 'number') return value
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed.getTime()
}

/**
 * Een veld uit een document, ook als het genest staat (`address.city`).
 *
 * De klantfiche bewaart het adres als één object; zonder puntpad kun je geen
 * regel op de gemeente maken zonder het document plat te slaan.
 */
export function readField(doc, path) {
  if (!doc || !path) return undefined
  return String(path)
    .split('.')
    .reduce((waarde, deel) => (waarde === null || waarde === undefined ? undefined : waarde[deel]), doc)
}

// ── Datums: vast of relatief ────────────────────────────────────────────────

/**
 * Een datum in een regel is zelden een datum.
 *
 * Jasper vroeg het met zoveel woorden: "+3 dagen" in plaats van een dag op de
 * kalender. Dat geldt voor beide kanten — een actie die een vervaldag zet, en
 * een voorwaarde die vraagt of iets binnen een week valt. Vandaar één vorm:
 *
 *   { mode: 'relative', days: 3 }     drie dagen na vandaag
 *   { mode: 'fixed', date: '2026-10-05' }
 *
 * Een kaal getal wordt ook aanvaard: zo stonden de bestaande regels erin
 * (`{ kind: 'dueInDays', value: 7 }`) en die moeten blijven werken.
 */
export const relativeDate = (days = 0) => ({ mode: 'relative', days })
export const fixedDate = (date = '') => ({ mode: 'fixed', date })

/** Het einde van de werkdag. Zie `resolveDate`. */
const WERKDAG_EINDE = 17

/**
 * Een datumwaarde uit een regel → een echte Date, of null.
 *
 * Alles landt op 17.00. Een vervaldag zonder uur leest als middernacht en staat
 * dan in Mijn werk al over tijd op de dag zelf — dat was de reden bij de oude
 * `dueInDays` en ze geldt net zo goed voor een vaste dag.
 */
export function resolveDate(value, now = new Date()) {
  const basis = millis(now) ?? Date.now()

  if (typeof value === 'number' || typeof value === 'string') {
    const getal = Number(value)
    if (Number.isFinite(getal) && `${value}`.trim() !== '') return resolveDate(relativeDate(getal), now)
    return resolveDate(fixedDate(value), now)
  }

  if (!value || typeof value !== 'object') return null

  if (value.mode === 'fixed') {
    if (!value.date) return null
    const datum = new Date(`${value.date}T${String(WERKDAG_EINDE).padStart(2, '0')}:00:00`)
    return Number.isNaN(datum.getTime()) ? null : datum
  }

  const dagen = Number(value.days)
  if (!Number.isFinite(dagen)) return null
  const datum = new Date(basis)
  datum.setDate(datum.getDate() + dagen)
  datum.setHours(WERKDAG_EINDE, 0, 0, 0)
  return datum
}

/** "02-10" — voor een label waar de datum in meemoet. */
export function dayLabel(value) {
  const ms = millis(value)
  if (ms === null) return ''
  const d = new Date(ms)
  return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// ── Operatoren ──────────────────────────────────────────────────────────────

/**
 * Welke vergelijking bij welk soort veld past.
 *
 * `value: false` betekent dat de operator zelf alles zegt en er geen invulveld
 * bij hoort — "is leeg" vraagt niet waarmee.
 */
export const OPERATORS = [
  { op: 'is', label: 'is', types: ['text', 'select', 'number', 'date'], value: true },
  { op: 'isNot', label: 'is niet', types: ['text', 'select', 'number', 'date'], value: true },
  { op: 'contains', label: 'bevat', types: ['text', 'list', 'people'], value: true },
  { op: 'notContains', label: 'bevat niet', types: ['text', 'list', 'people'], value: true },
  { op: 'gt', label: 'is groter dan', types: ['number'], value: true },
  { op: 'gte', label: 'is minstens', types: ['number'], value: true },
  { op: 'lt', label: 'is kleiner dan', types: ['number'], value: true },
  { op: 'lte', label: 'is hoogstens', types: ['number'], value: true },
  { op: 'before', label: 'valt voor', types: ['date'], value: true },
  { op: 'after', label: 'valt na', types: ['date'], value: true },
  { op: 'isTrue', label: 'is aan', types: ['boolean'], value: false },
  { op: 'isFalse', label: 'is uit', types: ['boolean'], value: false },
  {
    op: 'empty',
    label: 'is leeg',
    types: ['text', 'select', 'number', 'date', 'list', 'people'],
    value: false,
  },
  {
    op: 'notEmpty',
    label: 'is ingevuld',
    types: ['text', 'select', 'number', 'date', 'list', 'people'],
    value: false,
  },
]

export const operatorsFor = (type) => OPERATORS.filter((o) => o.types.includes(type))
export const operatorMeta = (op) => OPERATORS.find((o) => o.op === op) ?? null

// ── Entiteiten ──────────────────────────────────────────────────────────────

const PRIORITEITEN = [
  { value: 1, label: 'Urgent' },
  { value: 2, label: 'Hoog' },
  { value: 3, label: 'Normaal' },
  { value: 4, label: 'Laag' },
]

const POST_STATUSSEN = [
  { value: 'idea', label: 'Idee' },
  { value: 'draft', label: 'Tekst' },
  { value: 'design', label: 'Ontwerp' },
  { value: 'review', label: 'Nakijken' },
  { value: 'approved', label: 'Goedgekeurd' },
  { value: 'scheduled', label: 'Ingepland' },
  { value: 'published', label: 'Gepubliceerd' },
]

const REVIEW_STANDEN = [
  { value: 'none', label: 'Geen review' },
  { value: 'requested', label: 'Wacht op review' },
  { value: 'changes', label: 'Aanpassing gevraagd' },
  { value: 'approved', label: 'Goedgekeurd' },
]

const ROLLEN = [
  { value: 'owner', label: 'Eigenaar' },
  { value: 'admin', label: 'Beheerder' },
  { value: 'member', label: 'Teamlid' },
  { value: 'staff', label: 'Personeel' },
]

/**
 * De entiteiten waar een regel op kan staan.
 *
 * `options` verwijst naar een keuzelijst die het beheerscherm invult uit de
 * werkruimte (`profiles`, `lists`, `tags`, `brands`, `statuses`). De motor doet
 * daar niets mee — die vergelijkt gewoon waarden — maar zonder die verwijzing
 * moet je in het scherm een id intypen, en dan schrijft niemand ooit een regel.
 *
 * `apply` zegt hoe een actie uitgevoerd wordt; de vier manieren staan in
 * `applyAction` hieronder. `writes` volgt eruit en is de lijst velden die een
 * regel op deze entiteit mag aanraken — verder niets.
 */
export const ENTITIES = [
  {
    key: 'task',
    collection: 'tasks',
    label: 'Taken en events',
    single: 'taak',
    article: 'een taak',
    // Regels gaan over events, niet over de taken eronder. Zonder deze grens
    // kreeg elke taak uit een template bij een nieuwe aanvraag de toewijzing en
    // de deadline van de aanvraagregel, en verdween wat het template instelde.
    skip: { field: 'parentId', op: 'notEmpty' },
    fields: [
      { key: 'statusName', label: 'Status', type: 'select', options: 'statuses' },
      { key: 'listId', label: 'Lijst', type: 'select', options: 'lists' },
      { key: 'title', label: 'Titel', type: 'text' },
      { key: 'description', label: 'Omschrijving', type: 'text' },
      { key: 'priority', label: 'Prioriteit', type: 'select', options: 'priorities' },
      { key: 'tags', label: 'Labels', type: 'list', options: 'tags' },
      { key: 'assignees', label: 'Toegewezen aan', type: 'people', options: 'profiles' },
      { key: 'customerName', label: 'Klant', type: 'text' },
      { key: 'brandId', label: 'Merk', type: 'select', options: 'brands' },
      { key: 'dueDate', label: 'Vervaldag', type: 'date' },
      { key: 'startDate', label: 'Startdag', type: 'date' },
      { key: 'eventDate', label: 'Dag van het event', type: 'date' },
      { key: 'eventEndDate', label: 'Laatste dag van het event', type: 'date' },
      { key: 'budget', label: 'Budget', type: 'number' },
      { key: 'quoteAmount', label: 'Offertebedrag', type: 'number' },
      { key: 'pax', label: 'Aantal gasten', type: 'number' },
      { key: 'eventType', label: 'Soort event', type: 'text' },
      { key: 'formule', label: 'Formule', type: 'text' },
      { key: 'archived', label: 'Gearchiveerd', type: 'boolean' },
      { key: 'open', label: 'Nog open', type: 'boolean' },
      // Staat hier omdat `skip` hierboven erop leunt: alleen velden uit deze
      // lijst worden vergeleken, ook die van de entiteit zelf.
      { key: 'parentId', label: 'Hoort onder een event', type: 'text' },
    ],
    actions: [
      {
        kind: 'assignees',
        label: 'Toewijzen',
        apply: 'people',
        field: 'assignees',
        options: 'profiles',
        noun: 'toegewezene',
      },
      {
        kind: 'priority',
        label: 'Prioriteit zetten',
        apply: 'value',
        field: 'priority',
        type: 'select',
        options: 'priorities',
        nullable: true,
      },
      { kind: 'tag', label: 'Label toevoegen', apply: 'listAdd', field: 'tags', options: 'tags' },
      // `dueInDays` was de oude naam en staat nog in de database.
      { kind: 'dueDate', label: 'Vervaldag zetten', apply: 'date', field: 'dueDate', aliases: ['dueInDays'] },
      { kind: 'startDate', label: 'Startdag zetten', apply: 'date', field: 'startDate' },
    ],
  },

  {
    key: 'customer',
    collection: 'customers',
    label: 'Klanten',
    single: 'klant',
    article: 'een klant',
    fields: [
      { key: 'name', label: 'Naam', type: 'text' },
      { key: 'vatNumber', label: 'Btw-nummer', type: 'text' },
      { key: 'email', label: 'E-mail', type: 'text' },
      { key: 'phone', label: 'Telefoon', type: 'text' },
      { key: 'address.city', label: 'Gemeente', type: 'text' },
      { key: 'address.postalCode', label: 'Postcode', type: 'text' },
      { key: 'brandId', label: 'Merk', type: 'select', options: 'brands' },
      { key: 'tags', label: 'Labels', type: 'list', options: 'tags' },
      { key: 'archived', label: 'Gearchiveerd', type: 'boolean' },
    ],
    actions: [
      {
        kind: 'brand',
        label: 'Merk toewijzen',
        apply: 'value',
        field: 'brandId',
        type: 'select',
        options: 'brands',
        nullable: true,
      },
      { kind: 'tag', label: 'Label toevoegen', apply: 'listAdd', field: 'tags', options: 'tags' },
      {
        kind: 'archive',
        label: 'Archiveren',
        apply: 'value',
        field: 'archived',
        type: 'boolean',
      },
    ],
  },

  {
    key: 'socialPost',
    collection: 'socialPosts',
    label: 'Social posts',
    single: 'post',
    article: 'een post',
    fields: [
      { key: 'title', label: 'Titel', type: 'text' },
      { key: 'status', label: 'Status', type: 'select', options: 'postStatuses' },
      { key: 'channels', label: 'Kanalen', type: 'list' },
      { key: 'assigneeId', label: 'Van wie', type: 'select', options: 'profiles' },
      { key: 'reviewState', label: 'Review', type: 'select', options: 'reviewStates' },
      { key: 'reviewerId', label: 'Reviewer', type: 'select', options: 'profiles' },
      { key: 'brandId', label: 'Merk', type: 'select', options: 'brands' },
      { key: 'publishAt', label: 'Publicatiemoment', type: 'date' },
      { key: 'taskId', label: 'Hangt aan event', type: 'text' },
      { key: 'caption', label: 'Tekst', type: 'text' },
    ],
    actions: [
      {
        kind: 'assignee',
        label: 'Toewijzen',
        apply: 'value',
        field: 'assigneeId',
        type: 'select',
        options: 'profiles',
      },
      {
        kind: 'postStatus',
        label: 'Status zetten',
        apply: 'value',
        field: 'status',
        type: 'select',
        options: 'postStatuses',
      },
      {
        kind: 'review',
        label: 'Review vragen aan',
        apply: 'value',
        field: 'reviewerId',
        type: 'select',
        options: 'profiles',
        also: { reviewState: 'requested' },
      },
      { kind: 'publishAt', label: 'Publicatiemoment zetten', apply: 'date', field: 'publishAt' },
    ],
  },

  {
    key: 'checklistRun',
    collection: 'checklistRuns',
    label: 'Afvinklijsten',
    single: 'afvinklijst',
    article: 'een dag',
    fields: [
      { key: 'checklistName', label: 'Lijst', type: 'text' },
      { key: 'day', label: 'Dag', type: 'text' },
      { key: 'weekend', label: 'Weekend', type: 'boolean' },
      { key: 'doneCount', label: 'Afgevinkt', type: 'number' },
      { key: 'totalCount', label: 'Aantal punten', type: 'number' },
      { key: 'participants', label: 'Wie vinkte af', type: 'people', options: 'profiles' },
      { key: 'notes', label: 'Opmerking', type: 'text' },
      { key: 'closedAt', label: 'Afgesloten op', type: 'date' },
      { key: 'flagged', label: 'Gemarkeerd', type: 'boolean' },
    ],
    actions: [
      {
        kind: 'flag',
        label: 'Markeren met opmerking',
        apply: 'value',
        field: 'flagNote',
        type: 'text',
        also: { flagged: true },
      },
      {
        kind: 'followUp',
        label: 'Laten opvolgen door',
        apply: 'people',
        field: 'followUpIds',
        options: 'profiles',
        noun: 'opvolger',
      },
    ],
  },

  {
    key: 'timeEntry',
    collection: 'timeEntries',
    label: 'Urenboekingen',
    single: 'urenboeking',
    article: 'een boeking',
    fields: [
      { key: 'profileId', label: 'Van wie', type: 'select', options: 'profiles' },
      { key: 'listId', label: 'Lijst', type: 'select', options: 'lists' },
      { key: 'taskTitle', label: 'Taak', type: 'text' },
      { key: 'description', label: 'Omschrijving', type: 'text' },
      { key: 'durationSeconds', label: 'Duur in seconden', type: 'number' },
      { key: 'day', label: 'Dag', type: 'text' },
      { key: 'month', label: 'Maand', type: 'text' },
      { key: 'tags', label: 'Labels', type: 'list', options: 'tags' },
    ],
    actions: [
      { kind: 'tag', label: 'Label toevoegen', apply: 'listAdd', field: 'tags', options: 'tags' },
    ],
  },

  {
    key: 'profile',
    collection: 'profiles',
    label: 'Profielen',
    single: 'profiel',
    article: 'een profiel',
    fields: [
      { key: 'email', label: 'E-mail', type: 'text' },
      { key: 'fullName', label: 'Naam', type: 'text' },
      { key: 'role', label: 'Rol', type: 'select', options: 'roles' },
      { key: 'department', label: 'Afdeling', type: 'text' },
      { key: 'active', label: 'Actief', type: 'boolean' },
      { key: 'hourlyRate', label: 'Uurtarief', type: 'number' },
    ],
    // Alleen de afdeling. `role`, `active` en `email` staan hier bewust niet:
    // een regel draait met beheerdersrechten, en een regel die een rol kan
    // zetten is een regel die zichzelf meer rechten geeft. Wie een rol wijzigt,
    // doet dat met zijn eigen naam eronder in het ledenbeheer.
    actions: [
      { kind: 'department', label: 'Afdeling zetten', apply: 'value', field: 'department', type: 'text' },
    ],
  },
]

export const ENTITY_KEYS = ENTITIES.map((e) => e.key)

/** De entiteit van een regel; zonder opgave is het een taak (zo stond het er). */
export const entityOf = (key) => ENTITIES.find((e) => e.key === (key || 'task')) ?? ENTITIES[0]

export const entityByCollection = (collection) =>
  ENTITIES.find((e) => e.collection === collection) ?? null

export const fieldOf = (entity, key) =>
  (entity?.fields ?? []).find((f) => f.key === key) ?? null

export const actionOf = (entity, kind) =>
  (entity?.actions ?? []).find((a) => a.kind === kind || (a.aliases ?? []).includes(kind)) ?? null

/** Alles wat een regel op deze entiteit mag schrijven, en verder niets. */
export function writableFields(entity) {
  return unique(
    (entity?.actions ?? []).flatMap((a) => [a.field, ...Object.keys(a.also ?? {})])
  )
}

/** De keuzelijsten die het beheerscherm moet invullen. */
export const OPTION_SOURCES = {
  priorities: PRIORITEITEN,
  postStatuses: POST_STATUSSEN,
  reviewStates: REVIEW_STANDEN,
  roles: ROLLEN,
}
