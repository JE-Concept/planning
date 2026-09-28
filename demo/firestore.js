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

const SERVER_TS = Symbol('serverTimestamp')
const INCREMENT = Symbol('increment')

export const seedDoc = (col, id, data) => store.set(`${col}/${id}`, { ...data })
export const allDocs = () => store

function notify() {
  // Microtask, zodat één batch niet N keer hertekent.
  queueMicrotask(() => listeners.forEach((fn) => fn()))
}

function resolveSentinels(patch, existing = {}) {
  const out = {}
  for (const [k, v] of Object.entries(patch)) {
    if (v && v.__sentinel === SERVER_TS) out[k] = new Date()
    else if (v && v.__sentinel === INCREMENT) out[k] = (Number(existing[k]) || 0) + v.by
    else out[k] = v
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

function matches(data, c) {
  const left = data[c.field]
  switch (c.op) {
    case '==':             return c.value === null ? left == null : val(left) === val(c.value)
    case '!=':             return val(left) !== val(c.value)
    case '>=':             return left != null && val(left) >= val(c.value)
    case '<=':             return left != null && val(left) <= val(c.value)
    case '>':              return left != null && val(left) > val(c.value)
    case '<':              return left != null && val(left) < val(c.value)
    case 'array-contains': return Array.isArray(left) && left.includes(c.value)
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

const docSnap = (col, id) => {
  const data = store.get(`${col}/${id}`)
  return {
    id,
    exists: () => data !== undefined,
    data: () => (data ? { ...data } : undefined),
    ref: { __col: col, id, __doc: true },
  }
}

const querySnap = (rows, col) => ({
  docs: rows.map((r) => ({
    id: r.id,
    data: () => ({ ...r.data }),
    exists: () => true,
    ref: { __col: col, id: r.id, __doc: true },
  })),
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

export async function setDoc(ref, data, options) {
  const path = pathOf(ref)
  const existing = options?.merge ? store.get(path) ?? {} : {}
  store.set(path, { ...existing, ...resolveSentinels(data, existing) })
  notify()
}

export async function updateDoc(ref, patch) {
  const path = pathOf(ref)
  const existing = store.get(path)
  if (!existing) throw new Error(`Bestaat niet: ${path}`)
  store.set(path, { ...existing, ...resolveSentinels(patch, existing) })
  notify()
}

export async function deleteDoc(ref) {
  store.delete(pathOf(ref))
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

// ─── Wat de app bij opstarten aanroept ──────────────────────────────────────

export const initializeFirestore = () => ({ __demo: true })
export const connectFirestoreEmulator = () => {}
