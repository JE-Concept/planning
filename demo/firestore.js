/**
 * In-memory Firestore voor de demobuild.
 *
 * De applicatiecode blijft ongewijzigd: in demomodus wijst `firebase/firestore`
 * hier naartoe in plaats van naar de echte SDK. Alleen het deel dat de app
 * werkelijk gebruikt is geïmplementeerd (zie de import-inventaris in de repo),
 * inclusief live abonnementen, zodat slepen op het bord en de timer echt werken.
 */

const store = new Map()          // "collectie/id" -> data
const listeners = new Set()      // () => void, één per actief abonnement

/**
 * Doen alsof er geen bereik is.
 *
 * De echte Firestore schrijft offline naar zijn schijfcache en zet
 * `metadata.hasPendingWrites` op wat er nog niet bij de server is. Daar hangt
 * de hele mededeling in de app aan ("dit staat nog op dit toestel"), dus de
 * demo moet zich hier net zo gedragen — anders test de browsertest iets anders
 * dan wat er in de keuken draait. De gegevens zelf gaan gewoon door: ook echt
 * offline zie je je eigen vinkje meteen staan, het is alleen nog nergens
 * anders.
 */
const wachtend = new Set()       // paden die nog "doorgestuurd" moeten worden
const zonderBereik = () => typeof navigator !== 'undefined' && navigator.onLine === false

if (typeof window !== 'undefined') {
  // Terug online: wat openstond is weg, en iedereen hoort het meteen te zien.
  window.addEventListener('online', () => {
    if (!wachtend.size) return
    wachtend.clear()
    notify()
  })
}

const SERVER_TS = Symbol('serverTimestamp')
const INCREMENT = Symbol('increment')
const ARRAY_UNION = Symbol('arrayUnion')

export const seedDoc = (col, id, data) => store.set(`${col}/${id}`, { ...data })
export const allDocs = () => store

function notify() {
  // Microtask, zodat één batch niet N keer hertekent.
  queueMicrotask(() => listeners.forEach((fn) => fn()))
}

const isPlainObject = (v) =>
  v !== null && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date) && !v.__sentinel

function resolveSentinels(patch, existing = {}) {
  const out = {}
  for (const [k, v] of Object.entries(patch)) {
    if (v && v.__sentinel === SERVER_TS) out[k] = new Date()
    else if (v && v.__sentinel === INCREMENT) out[k] = (Number(existing[k]) || 0) + v.by
    else if (v && v.__sentinel === ARRAY_UNION) {
      out[k] = [...new Set([...(Array.isArray(existing[k]) ? existing[k] : []), ...v.values])]
    } else out[k] = v
  }
  return out
}

/**
 * `setDoc` met merge voegt in Firestore *diep* samen: een map krijgt de nieuwe
 * sleutels erbij en houdt de oude. Dat is geen detail — de afvinklijst schrijft
 * per punt één sleutel in `items`, en met een ondiepe merge zou wie afvinkt de
 * vinkjes van zijn collega's wissen. De demo moet zich hier dus net zo gedragen
 * als de echte database, anders test ze iets anders dan wat live draait.
 */
function deepMerge(existing, patch) {
  const out = { ...existing }
  for (const [k, v] of Object.entries(patch)) {
    out[k] = isPlainObject(v) && isPlainObject(existing?.[k]) ? deepMerge(existing[k], v) : v
  }
  return out
}

// ─── Referenties ────────────────────────────────────────────────────────────

export function collection(_db, path) {
  return { __col: path }
}

export function doc(a, b, c) {
  if (a && a.__col) return { __col: a.__col, id: b ?? randomId(), __doc: true }
  return { __col: b, id: c, __doc: true }
}

const randomId = () => 'x' + Math.random().toString(36).slice(2, 12)
const pathOf = (ref) => `${ref.__col}/${ref.id}`

// ─── Query-onderdelen ───────────────────────────────────────────────────────

export const where = (field, op, value) => ({ kind: 'where', field, op, value })
export const orderBy = (field, dir = 'asc') => ({ kind: 'orderBy', field, dir })
export const limit = (n) => ({ kind: 'limit', n })
export const query = (col, ...parts) => ({ __col: col.__col, parts })

const val = (v) => (v instanceof Date ? v.getTime() : v)

/**
 * Gelijk zoals Firestore gelijk bedoelt.
 *
 * Twee arrays met dezelfde inhoud zijn daar hetzelfde; in JavaScript zijn het
 * twee verschillende objecten. Zonder dit gaf `where('assignees', '==', [])` —
 * de vraag "wie heeft dit nog niet opgepakt" — hier altijd niets terug, terwijl
 * ze live wél werkt. Een demo die anders antwoordt dan de echte database is
 * erger dan geen demo: de browsertest zegt dan groen over iets wat stuk is.
 */
const gelijk = (a, b) => {
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, i) => gelijk(item, b[i]))
  }
  return val(a) === val(b)
}

function matches(data, c) {
  const left = data[c.field]
  switch (c.op) {
    case '==':             return c.value === null ? left == null : gelijk(left, c.value)
    case '!=':             return !gelijk(left, c.value)
    case '>=':             return left != null && val(left) >= val(c.value)
    case '<=':             return left != null && val(left) <= val(c.value)
    case '>':              return left != null && val(left) > val(c.value)
    case '<':              return left != null && val(left) < val(c.value)
    case 'array-contains': return Array.isArray(left) && left.includes(c.value)
    case 'in':             return Array.isArray(c.value) && c.value.some((v) => val(v) === val(left))
    case 'not-in':         return Array.isArray(c.value) && !c.value.some((v) => val(v) === val(left))
    default:               return true
  }
}

function run(q) {
  const col = q.__col
  const parts = q.parts ?? []
  let rows = []
  for (const [path, data] of store) {
    const slash = path.lastIndexOf('/')
    if (path.slice(0, slash) !== col) continue
    rows.push({ id: path.slice(slash + 1), data })
  }

  for (const c of parts.filter((p) => p.kind === 'where')) {
    rows = rows.filter((r) => matches(r.data, c))
  }
  for (const o of parts.filter((p) => p.kind === 'orderBy').reverse()) {
    rows.sort((a, b) => {
      const x = val(a.data[o.field]), y = val(b.data[o.field])
      if (x == null && y == null) return 0
      if (x == null) return 1
      if (y == null) return -1
      const d = x < y ? -1 : x > y ? 1 : 0
      return o.dir === 'desc' ? -d : d
    })
  }
  const lim = parts.find((p) => p.kind === 'limit')
  if (lim) rows = rows.slice(0, lim.n)

  return rows
}

const metadataVan = (pad) => ({ hasPendingWrites: wachtend.has(pad), fromCache: zonderBereik() })

const docSnap = (col, id) => {
  const data = store.get(`${col}/${id}`)
  return {
    id,
    exists: () => data !== undefined,
    data: () => (data ? { ...data } : undefined),
    metadata: metadataVan(`${col}/${id}`),
    ref: { __col: col, id, __doc: true },
  }
}

const querySnap = (rows, col) => ({
  docs: rows.map((r) => ({
    id: r.id,
    data: () => ({ ...r.data }),
    exists: () => true,
    metadata: metadataVan(`${col}/${r.id}`),
    ref: { __col: col, id: r.id, __doc: true },
  })),
  metadata: {
    hasPendingWrites: rows.some((r) => wachtend.has(`${col}/${r.id}`)),
    fromCache: zonderBereik(),
  },
  empty: rows.length === 0,
  size: rows.length,
  forEach(fn) { this.docs.forEach(fn) },
})

// ─── Lezen ──────────────────────────────────────────────────────────────────

export const getDoc = async (ref) => docSnap(ref.__col, ref.id)
export const getDocs = async (q) => querySnap(run(q), q.__col)
export const getCountFromServer = async (q) => ({ data: () => ({ count: run(q).length }) })

export function onSnapshot(target, onNext, onError) {
  const emit = () => {
    try {
      onNext(target.__doc ? docSnap(target.__col, target.id) : querySnap(run(target), target.__col))
    } catch (err) {
      onError?.(err)
    }
  }
  listeners.add(emit)
  emit()
  return () => listeners.delete(emit)
}

// ─── Schrijven ──────────────────────────────────────────────────────────────

/** Zonder bereik blijft een schrijfbeurt als "nog niet doorgestuurd" staan. */
function geschreven(path) {
  if (zonderBereik()) wachtend.add(path)
  notify()
}

export async function setDoc(ref, data, options) {
  const path = pathOf(ref)
  if (!options?.merge) {
    store.set(path, resolveSentinels(data))
    geschreven(path)
    return
  }
  const existing = store.get(path) ?? {}
  store.set(path, deepMerge(existing, resolveSentinels(data, existing)))
  geschreven(path)
}

export async function updateDoc(ref, patch) {
  const path = pathOf(ref)
  const existing = store.get(path)
  if (!existing) throw new Error(`Bestaat niet: ${path}`)
  store.set(path, { ...existing, ...resolveSentinels(patch, existing) })
  geschreven(path)
}

export async function deleteDoc(ref) {
  const path = pathOf(ref)
  store.delete(path)
  wachtend.delete(path)
  notify()
}

export function writeBatch() {
  const ops = []
  return {
    set: (ref, data, options) => ops.push(() => setDoc(ref, data, options)),
    update: (ref, patch) => ops.push(() => updateDoc(ref, patch)),
    delete: (ref) => ops.push(() => deleteDoc(ref)),
    commit: async () => { for (const op of ops) await op() },
  }
}

export const serverTimestamp = () => ({ __sentinel: SERVER_TS })
export const increment = (by) => ({ __sentinel: INCREMENT, by })
export const arrayUnion = (...values) => ({ __sentinel: ARRAY_UNION, values })

// ─── Wat de app bij opstarten aanroept ──────────────────────────────────────

export const initializeFirestore = () => ({ __demo: true })
// De demo bewaart niets tussen bezoeken; deze twee bestaan alleen omdat de
// echte app ze importeert.
export const persistentLocalCache = () => ({ __demo: 'cache' })
export const persistentMultipleTabManager = () => ({ __demo: 'tabs' })
export const connectFirestoreEmulator = () => {}
