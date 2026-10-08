import { collection, doc } from 'firebase/firestore'
import { db } from './firebase'
import { normalise } from './normalise'

/**
 * Every collection the app touches, named once.
 *
 * The model is deliberately flat: Firestore has no joins, so a document carries
 * the handful of fields a list view needs to render without a second read
 * (a task keeps `statusName`, `statusKind` and `listName` next to its ids).
 * Those copies are refreshed by the writers in `src/data`, never by hand.
 */
export const COL = {
  profiles: 'profiles',
  invites: 'invites',
  config: 'config',
  brands: 'brands',
  spaces: 'spaces',
  folders: 'folders',
  lists: 'lists',
  tags: 'tags',
  customers: 'customers',
  tasks: 'tasks',
  comments: 'comments',
  attachments: 'attachments',
  timeEntries: 'timeEntries',
  runningTimers: 'runningTimers',
  goals: 'goals',
  goalUpdates: 'goalUpdates',
  /*
    Notities, los van waar ze over gaan: een klant, een event, materiaal, een
    urenboeking. De verslagen van het teamoverleg staan hier ook in, als
    `soort: 'overleg'`. De oude collectie `meetings` wordt door de app niet
    meer gelezen; `scripts/seed.mjs` verhuist haar en laat ze staan.
  */
  notities: 'notities',
  agendaItems: 'agendaItems',
  checklists: 'checklists',
  checklistRuns: 'checklistRuns',
  socialPosts: 'socialPosts',
  postReviews: 'postReviews',
  automations: 'automations',
  herhalingen: 'herhalingen',
  automationRuns: 'automationRuns',
  activity: 'activity',
  templates: 'templates',
  /*
    Verhuurmateriaal en wat erop gereserveerd staat.

    Twee collecties en geen veld op het event, want dezelfde voorraad wordt
    van twee kanten aangesproken: een eigen event en straks een aanvraag van
    de verhuursite. Zou de reservatie op het event staan, dan was er geen plek
    waar beide samenkomen en zag niemand een dubbele boeking aankomen.

    `materiaalDag` is afgeleid: één rij per artikel per dag met hoeveel er
    bezet is, geschreven door een functie. De publieke site moet "wat is vrij
    van 12 tot 14 maart" in één vraag kunnen beantwoorden, en Firestore kan
    niet op overlappende periodes zoeken.
  */
  materiaal: 'materiaal',
  reservaties: 'reservaties',
  materiaalDag: 'materiaalDag',
  /*
    Een losse verhuur die online afgerekend wordt.

    Aparte collectie en geen stand op de reservatie, want een order en een
    reservatie zijn niet hetzelfde ding: één order legt meerdere stukken vast,
    en de order blijft bestaan wanneer de reservaties weggaan omdat er niet
    betaald is. Wat er met het geld gebeurde, hoort op één rij te staan.

    Geschreven door `functions-betaling/`, nergens anders — zie
    `firestore.rules`. De browser rekent niets af.
  */
  huurorders: 'huurorders',
  messaging: 'messaging',
  /*
    Offerteaanvragen van de verhuursite.

    Niet in `tasks` als event, want een aanvraag is nog geen dossier: de
    meeste worden een telefoontje en een deel wordt niets. Zou elke aanvraag
    meteen een event zijn, dan staat het bord binnen een maand vol met dingen
    die nooit doorgaan, en dan vertrouwt niemand het bord nog.

    Geschreven door `functions/verhuur.js`; de backoffice leest en werkt bij.
  */
  verhuuraanvragen: 'verhuuraanvragen',
  /*
    Inlogsessies van klanten op de verhuursite: een link in de mail en de
    sessie die eruit volgt, allebei als hash. Alleen de functies komen hier;
    de backoffice heeft er niets te zoeken en de site praat via HTTP.
  */
  verhuurSessies: 'verhuurSessies',
  shifts: 'shifts',
  /*
    De planning uit AAPI staat naast `shifts` en niet erin. Dat rooster is met
    de hand gemaakt en hangt aan profielen van JE Plan; dit komt uit een ander
    systeem en hangt aan mensen die hier meestal geen account hebben. Eén
    collectie van maken zou betekenen dat een import het handwerk overschrijft.
  */
  aapiShifts: 'aapiShifts',
  aapiEmployees: 'aapiEmployees',
  aapiImportRuns: 'aapiImportRuns',
  aapiImportQueue: 'aapiImportQueue',
  formules: 'formules',
  offertes: 'offertes',
  socialEvents: 'socialEvents',
  auditLog: 'auditLog',
  mails: 'mails',
  mailQueue: 'mailQueue',
  instellingen: 'instellingen',
}

export const col = (name) => collection(db, name)
export const ref = (name, id) => doc(db, name, id)
export const newRef = (name) => doc(collection(db, name))

export { normalise, toDate } from './normalise'

export function fromQuery(snapshot) {
  return snapshot.docs.map((d) => normalise({ id: d.id, ...d.data() }))
}
