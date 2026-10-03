import { readFileSync, readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/**
 * Elke samengestelde vraag aan Firestore, naast `firestore.indexes.json`.
 *
 * Waarom dit een test is en geen wiki-pagina: Firestore weigert een query
 * waarvoor geen index bestaat, en de demobuild waar `scripts/smoke.mjs` op
 * draait heeft helemaal geen indexen. Een ontbrekende index komt dus pas aan
 * het licht wanneer iemand in de echte tool op een filter klikt en er niets
 * gebeurt — precies het soort fout dat je niet wilt ontdekken op de dag van de
 * uitrol.
 *
 * Zo staat de afspraak hier: wie een `where` of een `orderBy` bijschrijft,
 * krijgt een rode test tot de index erbij staat.
 */

const wortel = new URL('../', import.meta.url)
const lees = (pad) => readFileSync(new URL(pad, wortel), 'utf8')

const indexen = JSON.parse(lees('firestore.indexes.json')).indexes

const EQ = 'ASCENDING'
const CONTAINS = 'CONTAINS'
const ASC = 'ASCENDING'
const DESC = 'DESCENDING'

/**
 * De regel van Firestore, kort: een index dekt een query wanneer hij begint
 * met precies de gelijkheidsvelden (volgorde onderling maakt niet uit) en
 * daarna precies de `orderBy`-velden in dezelfde volgorde en richting draagt.
 * Eén los `where` zonder `orderBy`, en meerdere gelijkheden zonder `orderBy`,
 * bedient Firestore uit de losse veldindexen die het zelf aanlegt; die staan
 * hieronder dan ook niet.
 */
function dekt(index, { eq = [], sorteer = [] }) {
  if (index.fields.length !== eq.length + sorteer.length) return false

  const kop = index.fields.slice(0, eq.length)
  const vrij = kop.map(() => true)
  for (const [veld, modus] of eq) {
    const n = kop.findIndex(
      (k, i) =>
        vrij[i] &&
        k.fieldPath === veld &&
        (modus === CONTAINS ? k.arrayConfig === CONTAINS : k.order === modus)
    )
    if (n === -1) return false
    vrij[n] = false
  }

  return sorteer.every(([veld, richting], i) => {
    const k = index.fields[eq.length + i]
    return k.fieldPath === veld && k.order === richting
  })
}

const indexVoor = (vraag) =>
  indexen.find((i) => i.collectionGroup === vraag.col && dekt(i, vraag))

/**
 * Elke samengestelde query in de app, met de plek waar ze staat.
 *
 * Eén hook kan er meer dan één zijn: `useTaskBoard` stelt een andere vraag
 * naargelang je "iedereen" kiest of "ook afgerond" aanzet, en dat zijn voor
 * Firestore vier verschillende queries met elk hun eigen index.
 */
const VRAGEN = [
  // ── tasks ───────────────────────────────────────────────────────────────
  {
    naam: 'useTasks — het bord van één lijst (src/data/tasks.js)',
    col: 'tasks',
    eq: [['listId', EQ], ['archived', EQ]],
    sorteer: [['position', ASC]],
  },
  {
    naam: 'useTasks — de eventlijst, zonder wat afgesloten is (src/data/tasks.js)',
    col: 'tasks',
    eq: [['listId', EQ], ['archived', EQ], ['afgesloten', EQ]],
    sorteer: [['position', ASC]],
  },
  {
    naam: 'useMateriaal — de catalogus van het magazijn (src/data/materiaal.js)',
    col: 'materiaal',
    eq: [['archived', EQ]],
    sorteer: [['position', ASC]],
  },
  {
    naam: 'useMyTasks — mijn open werk (src/data/tasks.js)',
    col: 'tasks',
    eq: [['assignees', CONTAINS], ['open', EQ]],
    sorteer: [['dueDate', ASC]],
  },
  {
    naam: 'useTaskBoard — één persoon, ook afgerond (src/data/tasks.js)',
    col: 'tasks',
    eq: [['assignees', CONTAINS]],
    sorteer: [['dueDate', ASC]],
  },
  {
    naam: 'useTaskBoard — iedereen, alleen open (src/data/tasks.js)',
    col: 'tasks',
    eq: [['open', EQ]],
    sorteer: [['dueDate', ASC]],
  },
  {
    naam: 'useTaskBoard — zonder uitvoerder, alleen open (src/data/tasks.js)',
    col: 'tasks',
    eq: [['assignees', EQ], ['open', EQ]],
    sorteer: [['dueDate', ASC]],
  },
  {
    naam: 'useTaskBoard — zonder uitvoerder, ook afgerond (src/data/tasks.js)',
    col: 'tasks',
    eq: [['assignees', EQ]],
    sorteer: [['dueDate', ASC]],
  },
  {
    naam: 'useTaskSearch — de kiezer bij een post (src/data/tasks.js)',
    col: 'tasks',
    eq: [['open', EQ]],
    sorteer: [['updatedAt', DESC]],
  },
  {
    naam: 'useSocialEvents — op status (src/data/tasks.js)',
    col: 'tasks',
    eq: [['statusName', EQ], ['archived', EQ]],
    sorteer: [['position', ASC]],
  },
  {
    naam: 'useSocialEvents — op socialstand (src/data/tasks.js)',
    col: 'tasks',
    eq: [['socialStage', EQ], ['archived', EQ]],
    sorteer: [['position', ASC]],
  },
  {
    naam: 'deadlineherinneringen (functions/index.js)',
    col: 'tasks',
    eq: [['archived', EQ]],
    sorteer: [['dueDate', ASC]],
  },

  // ── timeEntries ─────────────────────────────────────────────────────────
  {
    naam: 'useTimeEntries — één maand (src/data/time.js)',
    col: 'timeEntries',
    eq: [['month', EQ]],
    sorteer: [['startedAt', DESC]],
  },
  {
    naam: 'useTimeEntries — één maand van één persoon (src/data/time.js)',
    col: 'timeEntries',
    eq: [['month', EQ], ['profileId', EQ]],
    sorteer: [['startedAt', DESC]],
  },
  {
    naam: 'useTaskTimeEntries (src/data/time.js)',
    col: 'timeEntries',
    eq: [['taskId', EQ]],
    sorteer: [['startedAt', DESC]],
  },

  // ── socialPosts ─────────────────────────────────────────────────────────
  {
    naam: 'useUnscheduledPosts — posts zonder datum (src/data/social.js)',
    col: 'socialPosts',
    eq: [['scheduledAt', EQ]],
    sorteer: [['createdAt', DESC]],
  },
  {
    naam: 'usePostsForTask — de posts bij een event (src/data/social.js)',
    col: 'socialPosts',
    eq: [['taskId', EQ]],
    sorteer: [['scheduledAt', ASC]],
  },
  {
    naam: 'useReviewQueue — alles wat op een review wacht (src/data/social.js)',
    col: 'socialPosts',
    eq: [['reviewState', EQ]],
    sorteer: [['scheduledAt', ASC]],
  },
  {
    naam: 'useReviewQueue — alleen wat op mij wacht (src/data/social.js)',
    col: 'socialPosts',
    eq: [['reviewState', EQ], ['reviewerId', EQ]],
    sorteer: [['scheduledAt', ASC]],
  },

  // ── de rest ─────────────────────────────────────────────────────────────
  {
    naam: 'useComments bij een taak (src/data/comments.js, functions/index.js)',
    col: 'comments',
    eq: [['taskId', EQ]],
    sorteer: [['createdAt', ASC]],
  },
  {
    naam: 'useComments bij een post (src/data/comments.js)',
    col: 'comments',
    eq: [['postId', EQ]],
    sorteer: [['createdAt', ASC]],
  },
  {
    naam: 'useDocuments bij een event (src/data/documents.js)',
    col: 'attachments',
    eq: [['taskId', EQ]],
    sorteer: [['createdAt', DESC]],
  },
  {
    naam: 'useDocuments bij een klant (src/data/documents.js)',
    col: 'attachments',
    eq: [['customerId', EQ]],
    sorteer: [['createdAt', DESC]],
  },
  {
    naam: 'useKeyResultHistory (src/data/goals.js)',
    col: 'goalUpdates',
    eq: [['keyResultId', EQ]],
    sorteer: [['createdAt', DESC]],
  },
  {
    naam: 'useActivity — wat er met een taak gebeurde (src/data/activity.js)',
    col: 'activity',
    eq: [['taskId', EQ]],
    sorteer: [['createdAt', DESC]],
  },
  {
    naam: 'usePostReviews (src/data/social.js)',
    col: 'postReviews',
    eq: [['postId', EQ]],
    sorteer: [['createdAt', DESC]],
  },
  {
    naam: 'useMeetings — de verslagen waar ik in genoemd word (src/data/meetings.js)',
    col: 'meetings',
    eq: [['viewerIds', CONTAINS]],
    sorteer: [['datum', DESC]],
  },
  {
    naam: 'useAgenda (src/data/agenda.js)',
    col: 'agendaItems',
    eq: [['status', EQ]],
    sorteer: [['createdAt', ASC]],
  },
  {
    naam: 'useLogboek — op soort (src/data/logboek.js)',
    col: 'auditLog',
    eq: [['soort', EQ]],
    sorteer: [['at', DESC]],
  },
  {
    naam: 'useLogboek — op wie (src/data/logboek.js)',
    col: 'auditLog',
    eq: [['actorId', EQ]],
    sorteer: [['at', DESC]],
  },
  {
    naam: 'useLogboekVan — de geschiedenis van één document (src/data/logboek.js)',
    col: 'auditLog',
    eq: [['documentId', EQ]],
    sorteer: [['at', DESC]],
  },

  // ── mails ───────────────────────────────────────────────────────────────
  // De draad van een event en het postvak Aanvragen stellen dezelfde vraag met
  // een andere waarde (een event-id, of null), dus één index bedient ze allebei.
  {
    naam: 'useEventMails / useLosseMails — de draad en het postvak (src/data/mails.js)',
    col: 'mails',
    eq: [['eventId', EQ]],
    sorteer: [['datum', ASC]],
  },

  // ── mailQueue ───────────────────────────────────────────────────────────
  // Het systeemscherm haalt de post op die niet vertrok. Nieuwste eerst, want
  // dit is een werklijst: wat vanochtend misging, doet er het meest toe.
  {
    naam: 'useSysteem — de mails die niet vertrokken (src/data/systeem.js)',
    col: 'mailQueue',
    eq: [['status', EQ]],
    sorteer: [['createdAt', DESC]],
  },

  // ── aapiShifts ──────────────────────────────────────────────────────────
  // Het personeelsblok op een event: wie staat er gepland, op volgorde van
  // beginuur. De kalender zelf vraagt alleen een bereik op `start` en heeft
  // daar geen samengestelde index voor nodig.
  {
    naam: 'useShiftsVanEvent — wie er op dit event staat (src/data/aapi.js)',
    col: 'aapiShifts',
    eq: [['eventRef', EQ]],
    sorteer: [['start', ASC]],
  },
]

/**
 * Indexen die vandaag bij geen enkele query horen.
 *
 * Ze blijven staan: ze kosten schrijftijd, maar weggooien wat bij een zeldzaam
 * filter hoort kost een kapot scherm. De reden staat erbij, zodat wie ze ooit
 * opruimt weet wat hij weghaalt. Komt er een index bij die hier niet staat en
 * waar ook geen query bij past, dan is dat een index die per ongeluk bleef
 * hangen of een query die vergeten is — beide wil je zien.
 */
const ONGEBRUIKT = [
  'tasks: listId,archived,statusId,position', // geen scherm filtert op statusId
  'tasks: assignees(contains),archived,dueDate', // het takenscherm filtert op open, niet op archived
  'tasks: parentId,position', // subtaken worden opgehaald zonder orderBy en in de browser gesorteerd
  'tasks: listId,open,updatedAt', // useTaskSearch zoekt over alle lijsten heen
  'timeEntries: profileId,startedAt', // de urenlijst vraagt altijd ook een maand
  'socialPosts: brandId,scheduledAt', // de kalender haalt alle merken op en splitst in de browser
  'socialPosts: status,scheduledAt', // geen scherm filtert posts op status
  'auditLog: soort,actorId,at', // useLogboek laat die twee filters bewust niet samengaan
  // Deze is niet van de app maar van `functions-betaling/`: de ronde die
  // verlopen huuropties opruimt, vraagt om stand én vervaldatum. Hij staat
  // hier omdat deze test alleen in `src/data/` kijkt — een index die alleen
  // een functie gebruikt, lijkt daar ongebruikt.
  'huurorders: status,optieVervalt',
]

const omschrijf = (index) =>
  `${index.collectionGroup}: ` +
  index.fields.map((f) => (f.arrayConfig ? `${f.fieldPath}(contains)` : f.fieldPath)).join(',')

describe('elke samengestelde query heeft een index', () => {
  it.each(VRAGEN.map((v) => [v.naam, v]))('%s', (_naam, vraag) => {
    expect(indexVoor(vraag)).toBeDefined()
  })
})

describe('firestore.indexes.json', () => {
  it('draagt geen index die nergens bij hoort en ook niet verklaard is', () => {
    const gedekt = new Set(VRAGEN.map((v) => omschrijf(indexVoor(v) ?? { collectionGroup: '?', fields: [] })))
    const onverklaard = indexen
      .map(omschrijf)
      .filter((naam) => !gedekt.has(naam) && !ONGEBRUIKT.includes(naam))

    expect(onverklaard).toEqual([])
  })

  // Firestore weigert twee indexen die exact hetzelfde dekken niet, maar ze
  // kosten allebei schrijftijd bij elke taak die iemand verzet.
  it('draagt geen twee keer dezelfde index', () => {
    const namen = indexen.map(omschrijf)
    expect(namen).toHaveLength(new Set(namen).size)
  })
})

/*
  De tripwire.

  De tabel hierboven is met de hand bijgehouden, en een lijst die met de hand
  bijgehouden wordt, loopt achter. Dit telt hoeveel `query(...)` er in de app
  staan; komt er één bij, dan faalt deze test en kijkt wie hem bijschreef
  hierboven of er een index bij hoort. Dat is het hele doel: even stilstaan,
  niet een getal goedzetten.
*/
describe('nieuwe queries', () => {
  /*
    71 sinds de ploeg met een code binnenkomt: zes vragen in `src/data/aapi.js`
    — de kalender, de shifts van één event, mijn eigen diensten, de
    medewerkers, de importhistoriek en de wachtrij van wat er per mail
    binnenkwam.

    En 72 sinds de ploeg getagd kan worden: "notities waarin ik genoemd ben"
    vraagt `mentions array-contains` in `src/data/comments.js`.

    En 77 sinds het verhuurmateriaal erbij kwam: de catalogus, de reservaties
    die een periode raken, en die van één event (`src/data/materiaal.js`),
    plus `useLosEvent` voor een dossier dat niet meer op het bord staat.

    De reservatievraag draagt één bereik (`tot >= van`) met een `orderBy` op
    datzelfde veld, en dat bedient Firestore uit zijn eigen veldindex; de
    andere kant van de periode wordt in de browser weggelaten, want twee
    bereiken in één vraag kan Firestore niet.

    "Mijn eigen diensten" vraagt `aapiEmployeeId ==` zonder `orderBy` en heeft
    daarom geen samengestelde index nodig — sorteren doet de browser, want het
    zijn er hooguit een paar tientallen. Hetzelfde geldt voor de twee
    archiefvragen: gelijkheden zonder sortering, en die bedient Firestore uit
    zijn eigen veldindexen. Daarom staan ze wel hier en niet in de tabel
    hierboven.
  */
  const QUERIES_IN_DE_APP = 78

  it('zijn in de tabel hierboven opgenomen', () => {
    const bestanden = [
      ...readdirSync(new URL('src/data/', wortel))
        .filter((n) => n.endsWith('.js'))
        .map((n) => `src/data/${n}`),
      'src/context/WorkspaceProvider.jsx',
    ]

    const geteld = bestanden.reduce(
      (som, pad) => som + (lees(pad).match(/(^|[^A-Za-z])query\(/g) ?? []).length,
      0
    )

    expect(geteld).toBe(QUERIES_IN_DE_APP)
  })
})

/*
  De collecties en de regels.

  `firestore.rules` eindigt met een slotregel die alles weigert wat er niet bij
  naam in staat. Een collectie die de app gebruikt maar die er niet in genoemd
  wordt, gaat dus dicht, en dan strandt een heel scherm op een rechtenfout in
  plaats van dat er iets minder werkt.
*/
describe('firestore.rules', () => {
  it('noemt elke collectie die de app gebruikt bij naam', () => {
    const collecties = [...lees('src/lib/collections.js').matchAll(/^\s{2}(\w+):\s*'([^']+)'/gm)].map(
      (m) => m[2]
    )
    expect(collecties.length).toBeGreaterThan(20)

    const regels = lees('firestore.rules')
    const genoemd = new Set([...regels.matchAll(/match \/(\w+)\//g)].map((m) => m[1]))

    expect(collecties.filter((c) => !genoemd.has(c))).toEqual([])
  })

  // Deze drie staan niet in `COL` omdat geen enkel scherm ze opvraagt, maar ze
  // hangen wel aan de app: de sleutel van je agendafeed, je meldingstoestellen
  // en de postbak van de e-mails.
  it('noemt ook de collecties die alleen buiten de schermen bestaan', () => {
    const regels = lees('firestore.rules')
    for (const naam of ['agendaSleutels', 'pushTokens', 'mailQueue']) {
      expect(regels).toContain(`match /${naam}/`)
    }
  })
})
