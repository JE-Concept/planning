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
 * Board columns are stored on the list. Renaming one has to repair the copies
 * the tasks carry, otherwise the board would show the old name until each card
 * happened to be touched.
 */
export async function saveStatuses(listId, statuses) {
  const clean = statuses.map((s, i) => ({ ...s, position: i }))
  await updateList(listId, { statuses: clean })

  const tasks = await getDocs(query(col(COL.tasks), where('listId', '==', listId)))
  const byId = Object.fromEntries(clean.map((s) => [s.id, s]))

  const stale = tasks.docs.filter((snap) => {
    const task = snap.data()
    const status = byId[task.statusId]
    return (
      status &&
      (task.statusName !== status.name ||
        task.statusColor !== status.color ||
        task.statusKind !== status.kind)
    )
  })
  if (stale.length === 0) return

  // Firestore caps a batch at 500 writes.
  for (let i = 0; i < stale.length; i += 400) {
    const batch = writeBatch(db)
    for (const snap of stale.slice(i, i + 400)) {
      const status = byId[snap.data().statusId]
      batch.update(snap.ref, {
        statusName: status.name,
        statusColor: status.color,
        statusKind: status.kind,
        open: status.kind !== 'done' && status.kind !== 'closed',
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
