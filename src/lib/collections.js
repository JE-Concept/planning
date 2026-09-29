import { collection, doc } from 'firebase/firestore'
import { db } from './firebase'

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
  tasks: 'tasks',
  comments: 'comments',
  attachments: 'attachments',
  timeEntries: 'timeEntries',
  runningTimers: 'runningTimers',
  goals: 'goals',
  goalUpdates: 'goalUpdates',
  meetings: 'meetings',
  agendaItems: 'agendaItems',
  checklists: 'checklists',
  checklistRuns: 'checklistRuns',
  socialPosts: 'socialPosts',
  postReviews: 'postReviews',
  automations: 'automations',
  activity: 'activity',
}

export const col = (name) => collection(db, name)
export const ref = (name, id) => doc(db, name, id)
export const newRef = (name) => doc(collection(db, name))

/** Firestore Timestamp | Date | string → Date, or null. */
export function toDate(value) {
  if (!value) return null
  if (value instanceof Date) return value
  if (typeof value.toDate === 'function') return value.toDate()
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

const DATE_FIELDS = new Set([
  'createdAt', 'updatedAt', 'completedAt', 'dueDate', 'startDate',
  'startedAt', 'endedAt', 'scheduledAt', 'lastSeenAt',
  'reviewRequestedAt', 'reviewedAt',
])

export function normalise(data) {
  const out = { ...data }
  for (const key of DATE_FIELDS) {
    if (key in out) out[key] = toDate(out[key])
  }
  return out
}

export function fromQuery(snapshot) {
  return snapshot.docs.map((d) => normalise({ id: d.id, ...d.data() }))
}
