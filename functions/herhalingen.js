import { FieldValue } from 'firebase-admin/firestore'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { logger } from 'firebase-functions'

/**
 * Werk dat vanzelf terugkomt, één keer per nacht neergezet.
 *
 * ── Waarom een geplande functie en niet de browser ────────────────────────
 * Omdat het ook moet gebeuren op een dag dat niemand de tool opent. Een
 * herhaling die pas verschijnt zodra iemand inlogt, is een herinnering die te
 * laat komt op precies de dag dat ze nodig was.
 *
 * ── Waarom het document een vast adres krijgt ─────────────────────────────
 * `h-<herhaling>-<datum>`. Draait deze functie twee keer — een herstart, een
 * handmatige herstart, een uitrol die ertussen valt — dan schrijft de tweede
 * beurt exact hetzelfde document in plaats van een tweede taak. `create()` en
 * niet `set()`: bestaat het al, dan is dat geen fout maar het bewijs dat het
 * werk al gedaan is.
 *
 * ── Waarom de datumlogica hier staat én in `src/lib/herhaling.js` ─────────
 * De functies worden apart uitgerold, uit hun eigen map, met hun eigen
 * `package.json`; ze kunnen niet uit `src/` importeren. Twee kopieën van
 * dezelfde regel is een risico, en daarom staat er in
 * `tests/herhalingen.test.js` een test die beide kanten een jaar lang naast
 * elkaar legt. Loopt er één uit de pas, dan valt die test om — niet de
 * planning van iemands week.
 */

/* Maandag is 1, zondag is 7 — ISO, net als in het rooster en het poetsplan. */
const isoDag = (datum) => ((new Date(datum).getDay() + 6) % 7) + 1

export function isVervaldag(herhaling, datum) {
  if (!herhaling || herhaling.actief === false) return false
  const d = new Date(datum)
  if (Number.isNaN(d.getTime())) return false

  if (herhaling.soort === 'dagelijks') return true
  if (herhaling.soort === 'wekelijks') return (herhaling.dagen ?? []).includes(isoDag(d))
  if (herhaling.soort === 'maandelijks') return d.getDate() === (herhaling.dagVanMaand ?? 1)
  return false
}

export const dagSleutel = (datum) => {
  const d = new Date(datum)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export const sleutelVan = (herhalingId, datum) => `h-${herhalingId}-${dagSleutel(datum)}`

/**
 * De dag zoals Borgloon hem telt.
 *
 * De functie draait in UTC. Om 05:40 Brussel is het in de winter 04:40 UTC en
 * in de zomer 03:40 — dezelfde dag. Maar een maandelijkse herhaling op de 1e
 * zou bij een herstart rond middernacht op de 31e kunnen landen. Daarom wordt
 * de datum hier expliciet in de Belgische tijdzone bepaald en niet uit
 * `new Date()` gelezen.
 */
export function vandaagInBrussel(nu = new Date()) {
  const delen = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Brussels',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(nu)
  const [jaar, maand, dag] = delen.split('-').map(Number)
  // Middag, zodat omzetten naar lokale tijd nergens een dag verschuift.
  return new Date(jaar, maand - 1, dag, 12, 0, 0, 0)
}

export function maakHerhalingen({ db, region }) {
  return onSchedule(
    { region, schedule: '40 5 * * *', timeZone: 'Europe/Brussels' },
    async () => {
      const vandaag = vandaagInBrussel()
      const snap = await db.collection('herhalingen').where('actief', '==', true).get()

      let gemaakt = 0
      let bestond = 0

      for (const doc of snap.docs) {
        const herhaling = { id: doc.id, ...doc.data() }
        if (!isVervaldag(herhaling, vandaag)) continue

        try {
          if (herhaling.doel === 'social') {
            await maakSocialWerk({ db, herhaling, vandaag })
          } else {
            await maakTaak({ db, herhaling, vandaag })
          }
          gemaakt += 1
          // Alleen om in het scherm te kunnen tonen wanneer ze voor het laatst
          // iets neerzette. Het is geen slot: dat is de vaste sleutel.
          await doc.ref.set({ laatsteKeer: FieldValue.serverTimestamp() }, { merge: true })
        } catch (err) {
          if (err?.code === 6 || /already exists/i.test(String(err?.message))) {
            bestond += 1
            continue
          }
          logger.error('Herhaling mislukt', { herhaling: doc.id, fout: String(err?.message ?? err) })
        }
      }

      logger.info('Herhalingen', { bekeken: snap.size, gemaakt, bestond })
    }
  )
}

/**
 * De taak, met dezelfde velden die `createTask` in de browser zet.
 *
 * De kolom wordt uit de lijst zelf gelezen en niet geraden: een taak met een
 * `statusName` die op dat bord niet bestaat, valt uit elke kolom en staat
 * nergens. Lukt dat niet, dan belandt ze in de eerste kolom van het bord — en
 * als er helemaal geen bord is, in geen enkele, wat zichtbaarder is dan een
 * taak die stilletjes niet aangemaakt wordt.
 */
async function maakTaak({ db, herhaling, vandaag }) {
  const id = sleutelVan(herhaling.id, vandaag)
  const lijstSnap = herhaling.listId ? await db.collection('lists').doc(herhaling.listId).get() : null
  const lijst = lijstSnap?.data() ?? null
  const kolom = (lijst?.statuses ?? []).find((s) => s.kind === 'open') ?? (lijst?.statuses ?? [])[0] ?? null

  await db
    .collection('tasks')
    .doc(id)
    .create({
      listId: herhaling.listId ?? null,
      listName: lijst?.name ?? null,
      spaceId: lijst?.spaceId ?? null,
      brandId: herhaling.brandId ?? lijst?.brandId ?? null,
      parentId: null,
      title: herhaling.titel || 'Terugkerende taak',
      description: herhaling.omschrijving ?? '',
      priority: herhaling.prioriteit || null,
      startDate: null,
      dueDate: vandaag,
      timeEstimateMinutes: null,
      budget: null,
      location: null,
      assignees: herhaling.profileId ? [herhaling.profileId] : [],
      tags: [],
      position: Date.now(),
      archived: false,
      completedAt: null,
      trackedSeconds: 0,
      commentCount: 0,
      statusId: kolom?.id ?? null,
      statusName: kolom?.name ?? null,
      statusColor: kolom?.color ?? null,
      statusKind: kolom?.kind ?? null,
      open: true,
      // Waar deze taak vandaan komt. Zonder dit veld vraagt iemand zich over
      // een half jaar af wie elke maandag dezelfde taak staat aan te maken.
      herhalingId: herhaling.id,
      createdBy: null,
      updatedBy: null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })
}

async function maakSocialWerk({ db, herhaling, vandaag }) {
  const id = sleutelVan(herhaling.id, vandaag)
  await db
    .collection('socialPosts')
    .doc(id)
    .create({
      title: herhaling.titel || 'Terugkerend socialwerk',
      brandId: herhaling.brandId ?? null,
      caption: '',
      hashtags: '',
      channels: [],
      publishAt: null,
      scheduledAt: null,
      status: 'idea',
      source: 'herhaling',
      assigneeId: herhaling.profileId ?? null,
      taskId: null,
      taskTitle: null,
      taskListName: null,
      reviewState: 'none',
      reviewRound: 0,
      reviewerId: null,
      reviewNote: null,
      assetUrl: null,
      publishedUrl: null,
      notes: herhaling.omschrijving ?? '',
      herhalingId: herhaling.id,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })
}
