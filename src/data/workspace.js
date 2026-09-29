import {
  deleteDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { COL, col, newRef, ref } from '@lib/collections'
import { db } from '@lib/firebase'

/** Board columns a new list starts with, so nobody faces an empty board. */
const DEFAULT_STATUSES = [
  { name: 'Te doen', color: '#8593a9', kind: 'open' },
  { name: 'Bezig', color: '#f59e0b', kind: 'active' },
  { name: 'Nakijken', color: '#7c3aed', kind: 'active' },
  { name: 'Klaar', color: '#008844', kind: 'closed' },
]

export function createSpace(name, color = '#65748d') {
  const spaceRef = newRef(COL.spaces)
  return setDoc(spaceRef, {
    name: name.trim(),
    color,
    position: Date.now(),
    archived: false,
    createdAt: serverTimestamp(),
  }).then(() => spaceRef.id)
}

export function createList({ spaceId, folderId = null, brandId = null, name, kind = 'tasks' }) {
  const listRef = newRef(COL.lists)
  return setDoc(listRef, {
    spaceId,
    folderId,
    brandId,
    name: name.trim(),
    description: '',
    kind,
    position: Date.now(),
    archived: false,
    statuses: DEFAULT_STATUSES.map((s, i) => ({
      id: crypto.randomUUID(),
      position: i,
      ...s,
    })),
    createdAt: serverTimestamp(),
  }).then(() => listRef.id)
}

export function updateList(id, patch) {
  return updateDoc(ref(COL.lists, id), patch)
}

/**
 * De kolommen van een bord bewaren.
 *
 * Twee dingen tegelijk, en allebei om dezelfde reden: een taak draagt de naam,
 * de kleur en het soort van zijn kolom mee. Wordt een kolom hernoemd, dan moet
 * die kopie mee — anders staat op het bord de oude naam tot iemand de kaart
 * toevallig aanraakt. En verdwijnt een kolom, dan verwijst de taak naar een
 * status die niet meer bestaat: ze staat er nog, maar in geen enkele kolom, en
 * dus nergens. Daarom komen de taken van een verdwenen kolom hier mee, naar de
 * kolom die de gebruiker aanwees (`moves`).
 */
export async function saveStatuses(listId, statuses, { moves = {} } = {}) {
  const clean = statuses.map((s, i) => ({ ...s, position: i }))
  await updateList(listId, { statuses: clean })

  const tasks = await getDocs(query(col(COL.tasks), where('listId', '==', listId)))
  const byId = Object.fromEntries(clean.map((s) => [s.id, s]))

  const teDoen = []
  for (const snap of tasks.docs) {
    const task = snap.data()
    const doel = byId[task.statusId] ?? byId[moves[task.statusId]] ?? null

    // Geen doel: de kolom is weg en er is niets aangewezen. De taak
    // ongemoeid laten is dan het veiligst — ze blijft leesbaar in de
    // lijstweergave en in Mijn werk.
    if (!doel) continue

    const gelijk =
      task.statusId === doel.id &&
      task.statusName === doel.name &&
      task.statusColor === doel.color &&
      task.statusKind === doel.kind
    if (gelijk) continue

    teDoen.push([snap.ref, task, doel])
  }
  if (teDoen.length === 0) return

  // Firestore caps a batch at 500 writes.
  for (let i = 0; i < teDoen.length; i += 400) {
    const batch = writeBatch(db)
    for (const [taskRef, task, doel] of teDoen.slice(i, i + 400)) {
      const klaar = doel.kind === 'done' || doel.kind === 'closed'
      batch.update(taskRef, {
        statusId: doel.id,
        statusName: doel.name,
        statusColor: doel.color,
        statusKind: doel.kind,
        open: !klaar,
        completedAt: klaar ? (task.completedAt ?? new Date()) : null,
        updatedAt: serverTimestamp(),
      })
    }
    await batch.commit()
  }
}

export function archiveList(id) {
  return updateList(id, { archived: true })
}

export function createBrand({ key, name, color }) {
  const brandRef = newRef(COL.brands)
  return setDoc(brandRef, {
    key: key.trim(),
    name: name.trim(),
    color,
    position: Date.now(),
    archived: false,
  }).then(() => brandRef.id)
}

export function updateBrand(id, patch) {
  return updateDoc(ref(COL.brands, id), patch)
}

export function upsertTag({ name, color }) {
  const id = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')
  return setDoc(ref(COL.tags, id), { name: name.trim(), color }, { merge: true }).then(() => id)
}

export function deleteTag(id) {
  return deleteDoc(ref(COL.tags, id))
}

// ─── Member administration ──────────────────────────────────────────────────

/** An invite is what turns a Google sign-in into a profile. */
export function inviteMember({ email, role = 'member', invitedBy }) {
  const key = email.trim().toLowerCase()
  return setDoc(ref(COL.invites, key), {
    email: key,
    role,
    invitedBy: invitedBy ?? null,
    createdAt: serverTimestamp(),
  }).then(() => key)
}

export function revokeInvite(email) {
  return deleteDoc(ref(COL.invites, email.trim().toLowerCase()))
}

export function setMemberRole(uid, role) {
  return updateDoc(ref(COL.profiles, uid), { role, updatedAt: serverTimestamp() })
}

/** Keuken, zaal of verantwoordelijke — bepaalt welke lijstpunten iemand ziet. */
export function setMemberDepartment(uid, department) {
  return updateDoc(ref(COL.profiles, uid), {
    department: department || null,
    updatedAt: serverTimestamp(),
  })
}

export function setMemberActive(uid, active) {
  return updateDoc(ref(COL.profiles, uid), { active, updatedAt: serverTimestamp() })
}

export function setHourlyRate(uid, hourlyRate) {
  return updateDoc(ref(COL.profiles, uid), {
    hourlyRate: hourlyRate === '' ? null : Number(hourlyRate),
    updatedAt: serverTimestamp(),
  })
}
