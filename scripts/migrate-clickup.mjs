#!/usr/bin/env node
/**
 * ClickUp → JE Planning.
 *
 * Every imported document keeps a deterministic id (`cu-<clickup id>`), so the
 * script can be run as often as you like: a second run updates what changed
 * instead of duplicating it. That matters, because the realistic migration is
 * not one big-bang import but a handful of dry runs, a real one, and a final
 * top-up on the morning everybody switches over.
 *
 *   CLICKUP_TOKEN=pk_… CLICKUP_TEAM_ID=24317841 \
 *   GOOGLE_APPLICATION_CREDENTIALS=./service-account.json \
 *   node scripts/migrate-clickup.mjs --dry-run
 *
 * Flags:
 *   --dry-run          read ClickUp, write nothing, print the plan
 *   --spaces=a,b       only these ClickUp space names (default: all)
 *   --skip-time        leave time entries behind
 *   --skip-comments    leave comments behind (much faster: one call per task)
 *   --months=24        how far back to pull time entries (default 24)
 */

import { readFileSync } from 'node:fs'
import { initializeApp, applicationDefault, cert } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { createClient, customFields, priorityOf, statusKind, toDate } from './lib/clickup.mjs'

// ─── Options ────────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const has = (flag) => args.includes(flag)
const value = (name, fallback) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.split('=').slice(1).join('=') : fallback
}

const DRY_RUN = has('--dry-run')
const SKIP_TIME = has('--skip-time')
const SKIP_COMMENTS = has('--skip-comments')
const MONTHS = Number(value('months', '24'))
const ONLY_SPACES = value('spaces', '')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean)

const token = process.env.CLICKUP_TOKEN
const teamId = process.env.CLICKUP_TEAM_ID

if (!token || !teamId) {
  console.error('Zet CLICKUP_TOKEN en CLICKUP_TEAM_ID in de omgeving.')
  process.exit(1)
}

// ─── Firestore ──────────────────────────────────────────────────────────────

const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
initializeApp(
  credentialsPath
    ? { credential: cert(JSON.parse(readFileSync(credentialsPath, 'utf8'))) }
    : { credential: applicationDefault() }
)
const db = getFirestore()

const cu = createClient(token)
const id = (prefix, clickupId) => `cu-${prefix}-${clickupId}`

const stats = {
  spaces: 0, folders: 0, lists: 0, statuses: 0,
  tasks: 0, subtasks: 0, comments: 0, timeEntries: 0, tags: 0,
  skippedAssignees: new Set(),
}

/**
 * Batched writer. Firestore caps a batch at 500 operations; this keeps the
 * whole migration to one write per document without the caller counting.
 */
function createWriter() {
  let batch = db.batch()
  let pending = 0
  let written = 0

  return {
    async set(ref, data, options = { merge: true }) {
      if (DRY_RUN) {
        written += 1
        return
      }
      batch.set(ref, data, options)
      pending += 1
      written += 1
      if (pending >= 400) {
        await batch.commit()
        batch = db.batch()
        pending = 0
      }
    },
    async flush() {
      if (!DRY_RUN && pending > 0) await batch.commit()
      pending = 0
      return written
    },
  }
}

const writer = createWriter()

// ─── People ─────────────────────────────────────────────────────────────────

/**
 * ClickUp users are matched to JE Planning profiles by e-mail, because a
 * profile id is a Firebase auth uid and cannot be invented here. Anybody who
 * has not signed in yet is reported at the end rather than silently dropped.
 */
async function buildUserMap() {
  const [teams, profiles] = await Promise.all([cu.teams(), db.collection('profiles').get()])
  const team = teams.find((t) => String(t.id) === String(teamId)) ?? teams[0]

  const byEmail = new Map()
  profiles.forEach((doc) => {
    const email = (doc.data().email ?? '').toLowerCase()
    if (email) byEmail.set(email, doc.id)
  })

  const map = new Map()
  for (const member of team?.members ?? []) {
    const user = member.user ?? member
    const email = (user.email ?? '').toLowerCase()
    const uid = byEmail.get(email)
    if (uid) map.set(String(user.id), uid)
    else stats.skippedAssignees.add(`${user.username ?? user.id} <${email || 'geen e-mail'}>`)
  }

  await writer.set(db.collection('config').doc('clickup'), {
    teamId,
    importedAt: FieldValue.serverTimestamp(),
    users: Object.fromEntries(
      (team?.members ?? []).map((m) => {
        const user = m.user ?? m
        return [String(user.id), { email: user.email ?? null, name: user.username ?? null }]
      })
    ),
  })

  return map
}

// ─── Tags ───────────────────────────────────────────────────────────────────

const seenTags = new Set()

async function rememberTags(task) {
  for (const tag of task.tags ?? []) {
    const key = tag.name.toLowerCase()
    if (seenTags.has(key)) continue
    seenTags.add(key)
    stats.tags += 1

    await writer.set(db.collection('tags').doc(key.replace(/[^a-z0-9]+/g, '-')), {
      name: tag.name,
      color: tag.tag_bg || '#8593a9',
    })
  }
}

// ─── Import ─────────────────────────────────────────────────────────────────

async function importList(list, { spaceDocId, folderDocId, userMap }) {
  const listDocId = id('list', list.id)

  // ClickUp keeps a list's columns on the list; we do the same, so the board
  // comes across in one document instead of one per column.
  const statuses = (list.statuses ?? []).map((s, index) => ({
    id: `cu-${s.id ?? s.status}`,
    name: s.status,
    color: s.color?.startsWith('#') ? s.color : '#8593a9',
    kind: statusKind(s.type),
    position: s.orderindex ?? index,
  }))
  stats.statuses += statuses.length

  const isSocial = /social/i.test(list.name)

  await writer.set(db.collection('lists').doc(listDocId), {
    spaceId: spaceDocId,
    folderId: folderDocId ?? null,
    brandId: null,
    name: list.name,
    description: list.content ?? '',
    kind: isSocial ? 'social' : 'tasks',
    position: Number(list.orderindex ?? 0),
    archived: Boolean(list.archived),
    statuses,
    clickupId: String(list.id),
  })
  stats.lists += 1

  const tasks = await cu.tasks(list.id)
  console.log(`    ${list.name}: ${tasks.length} taken`)

  const statusByName = new Map(statuses.map((s) => [s.name, s]))

  for (const [index, task] of tasks.entries()) {
    const status = statusByName.get(task.status?.status) ?? null
    const { budget, location } = customFields(task)
    const isSubtask = Boolean(task.parent)

    await rememberTags(task)

    await writer.set(db.collection('tasks').doc(id('task', task.id)), {
      listId: listDocId,
      listName: list.name,
      spaceId: spaceDocId,
      brandId: null,
      parentId: task.parent ? id('task', task.parent) : null,
      title: task.name ?? '(zonder titel)',
      description: task.description ?? task.text_content ?? '',
      statusId: status?.id ?? null,
      statusName: status?.name ?? null,
      statusColor: status?.color ?? null,
      statusKind: status?.kind ?? null,
      open: status ? status.kind !== 'done' && status.kind !== 'closed' : true,
      priority: priorityOf(task.priority),
      startDate: toDate(task.start_date),
      dueDate: toDate(task.due_date),
      completedAt: toDate(task.date_done ?? task.date_closed),
      timeEstimateMinutes: task.time_estimate ? Math.round(task.time_estimate / 60000) : null,
      trackedSeconds: task.time_spent ? Math.round(task.time_spent / 1000) : 0,
      budget,
      location,
      assignees: (task.assignees ?? [])
        .map((a) => userMap.get(String(a.id)))
        .filter(Boolean),
      tags: (task.tags ?? []).map((t) => t.name),
      position: Number(task.orderindex ?? index) || index + 1,
      archived: Boolean(task.archived),
      commentCount: 0,
      createdBy: userMap.get(String(task.creator?.id)) ?? null,
      createdAt: toDate(task.date_created) ?? FieldValue.serverTimestamp(),
      updatedAt: toDate(task.date_updated) ?? FieldValue.serverTimestamp(),
      clickupId: String(task.id),
      clickupUrl: task.url ?? null,
    })

    if (isSubtask) stats.subtasks += 1
    else stats.tasks += 1

    if (!SKIP_COMMENTS && Number(task.comment_count ?? 0) > 0) {
      const comments = await cu.comments(task.id)
      for (const comment of comments) {
        await writer.set(db.collection('comments').doc(id('comment', comment.id)), {
          taskId: id('task', task.id),
          postId: null,
          authorId: userMap.get(String(comment.user?.id)) ?? null,
          authorName: comment.user?.username ?? 'ClickUp',
          body: comment.comment_text ?? '',
          createdAt: toDate(comment.date) ?? FieldValue.serverTimestamp(),
        })
        stats.comments += 1
      }
      await writer.set(db.collection('tasks').doc(id('task', task.id)), {
        commentCount: comments.length,
      })
    }
  }
}

async function importTimeEntries(userMap) {
  const to = Date.now()
  const from = to - MONTHS * 30 * 86400000
  const entries = await cu.timeEntries(teamId, { from, to })
  console.log(`\n  Tijdsregistraties: ${entries.length}`)

  for (const entry of entries) {
    const profileId = userMap.get(String(entry.user?.id))
    if (!profileId) continue

    const startedAt = toDate(entry.start)
    const endedAt = toDate(entry.end) ?? startedAt
    if (!startedAt) continue

    const durationSeconds = Math.max(0, Math.round(Number(entry.duration ?? 0) / 1000))
    if (durationSeconds <= 0) continue

    const day = startedAt.toISOString().slice(0, 10)

    await writer.set(db.collection('timeEntries').doc(id('time', entry.id)), {
      profileId,
      taskId: entry.task?.id ? id('task', entry.task.id) : null,
      taskTitle: entry.task?.name ?? null,
      listId: entry.task_location?.list_id ? id('list', entry.task_location.list_id) : null,
      listName: null,
      brandId: null,
      description: entry.description ?? '',
      startedAt,
      endedAt,
      durationSeconds,
      day,
      month: day.slice(0, 7),
      week: isoWeek(startedAt),
      createdAt: FieldValue.serverTimestamp(),
    })
    stats.timeEntries += 1
  }
}

function isoWeek(date) {
  const thursday = new Date(date)
  thursday.setHours(0, 0, 0, 0)
  thursday.setDate(thursday.getDate() + 3 - ((thursday.getDay() + 6) % 7))
  const firstThursday = new Date(thursday.getFullYear(), 0, 4)
  firstThursday.setDate(firstThursday.getDate() + 3 - ((firstThursday.getDay() + 6) % 7))
  const week = 1 + Math.round((thursday - firstThursday) / (7 * 86400000))
  return `${thursday.getFullYear()}-W${String(week).padStart(2, '0')}`
}

// ─── Run ────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\nJE Planning — ClickUp-migratie${DRY_RUN ? ' (DROOGLOOP, er wordt niets geschreven)' : ''}\n`)

  const userMap = await buildUserMap()
  console.log(`  Gekoppelde gebruikers: ${userMap.size}`)

  const spaces = await cu.spaces(teamId)
  const wanted = ONLY_SPACES.length
    ? spaces.filter((s) => ONLY_SPACES.includes(s.name.toLowerCase()))
    : spaces

  for (const space of wanted) {
    console.log(`\n  Ruimte: ${space.name}`)
    const spaceDocId = id('space', space.id)

    await writer.set(db.collection('spaces').doc(spaceDocId), {
      name: space.name,
      color: space.color || '#65748d',
      position: Number(space.orderindex ?? stats.spaces),
      archived: Boolean(space.archived),
      clickupId: String(space.id),
    })
    stats.spaces += 1

    const folderless = await cu.folderlessLists(space.id)
    for (const list of folderless) {
      await importList(list, { spaceDocId, folderDocId: null, userMap })
    }

    const folders = await cu.folders(space.id)
    for (const folder of folders) {
      const folderDocId = id('folder', folder.id)
      await writer.set(db.collection('folders').doc(folderDocId), {
        spaceId: spaceDocId,
        name: folder.name,
        position: Number(folder.orderindex ?? 0),
        archived: Boolean(folder.archived),
        clickupId: String(folder.id),
      })
      stats.folders += 1
      console.log(`    map: ${folder.name}`)

      const lists = folder.lists?.length ? folder.lists : await cu.folderLists(folder.id)
      for (const list of lists) {
        await importList(list, { spaceDocId, folderDocId, userMap })
      }
    }
  }

  if (!SKIP_TIME) await importTimeEntries(userMap)

  const written = await writer.flush()

  console.log('\n─────────────────────────────────────────')
  console.log(`  ruimtes            ${stats.spaces}`)
  console.log(`  mappen             ${stats.folders}`)
  console.log(`  lijsten            ${stats.lists}`)
  console.log(`  kolommen           ${stats.statuses}`)
  console.log(`  taken              ${stats.tasks}`)
  console.log(`  subtaken           ${stats.subtasks}`)
  console.log(`  labels             ${stats.tags}`)
  console.log(`  reacties           ${stats.comments}`)
  console.log(`  tijdsregistraties  ${stats.timeEntries}`)
  console.log(`  documenten         ${written}${DRY_RUN ? ' (niet geschreven)' : ''}`)

  if (stats.skippedAssignees.size > 0) {
    console.log('\n  Geen JE Planning-profiel (toewijzingen overgeslagen):')
    for (const person of stats.skippedAssignees) console.log(`    · ${person}`)
    console.log('  Laat hen eerst aanmelden en draai het script opnieuw.')
  }

  console.log('')
}

main().catch((err) => {
  console.error('\nMigratie gestopt:', err.message)
  process.exit(1)
})
