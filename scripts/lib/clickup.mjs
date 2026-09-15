/**
 * Thin ClickUp API v2 client.
 *
 * ClickUp allows 100 requests per minute on the free plan and answers a burst
 * with 429. One in-process gate spaces the calls out and retries what still
 * bounces, so a migration of a few thousand tasks runs unattended.
 */

const BASE = 'https://api.clickup.com/api/v2'
const MIN_INTERVAL_MS = 650

let nextSlot = 0

async function throttle() {
  const now = Date.now()
  const wait = Math.max(0, nextSlot - now)
  nextSlot = Math.max(now, nextSlot) + MIN_INTERVAL_MS
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait))
}

export function createClient(token) {
  if (!token) throw new Error('CLICKUP_TOKEN ontbreekt.')

  async function get(path, { attempt = 1 } = {}) {
    await throttle()

    const response = await fetch(`${BASE}${path}`, {
      headers: { Authorization: token, 'Content-Type': 'application/json' },
    })

    if (response.status === 429 && attempt <= 5) {
      const retryAfter = Number(response.headers.get('retry-after') ?? 0)
      const delay = retryAfter > 0 ? retryAfter * 1000 : 2 ** attempt * 1000
      console.warn(`  ClickUp rate limit — ${Math.round(delay / 1000)}s wachten…`)
      await new Promise((resolve) => setTimeout(resolve, delay))
      return get(path, { attempt: attempt + 1 })
    }

    if (!response.ok) {
      const body = await response.text()
      throw new Error(`ClickUp ${response.status} op ${path}: ${body.slice(0, 200)}`)
    }

    return response.json()
  }

  return {
    get,
    teams: () => get('/team').then((d) => d.teams ?? []),
    spaces: (teamId) => get(`/team/${teamId}/space?archived=false`).then((d) => d.spaces ?? []),
    folders: (spaceId) => get(`/space/${spaceId}/folder?archived=false`).then((d) => d.folders ?? []),
    folderlessLists: (spaceId) => get(`/space/${spaceId}/list?archived=false`).then((d) => d.lists ?? []),
    folderLists: (folderId) => get(`/folder/${folderId}/list?archived=false`).then((d) => d.lists ?? []),
    comments: (taskId) => get(`/task/${taskId}/comment`).then((d) => d.comments ?? []),

    /** Every task of a list, closed and subtasks included, page by page. */
    async tasks(listId) {
      const all = []
      for (let page = 0; page < 100; page += 1) {
        const data = await get(
          `/list/${listId}/task?archived=false&include_closed=true&subtasks=true&page=${page}`
        )
        const batch = data.tasks ?? []
        all.push(...batch)
        if (batch.length === 0 || data.last_page) break
      }
      return all
    },

    /** Time entries in one window, for everybody rather than just the caller. */
    async timeEntries(teamId, { from, to }) {
      const data = await get(
        `/team/${teamId}/time_entries?start_date=${from}&end_date=${to}&assignee=all`
      )
      return data.data ?? []
    },
  }
}

// ─── Field mapping ──────────────────────────────────────────────────────────

/** ClickUp status types → our four column kinds. */
export function statusKind(type) {
  if (type === 'open') return 'open'
  if (type === 'done') return 'done'
  if (type === 'closed') return 'closed'
  return 'active'
}

export function toDate(value) {
  if (value === null || value === undefined || value === '') return null
  const ms = Number(value)
  if (Number.isNaN(ms)) return null
  const date = new Date(ms)
  return Number.isNaN(date.getTime()) ? null : date
}

export function priorityOf(priority) {
  if (!priority) return null
  const value = Number(priority.id ?? priority.orderindex)
  return value >= 1 && value <= 4 ? value : null
}

/** Pulls the two custom fields the JE Concept space actually uses. */
export function customFields(task) {
  const out = { budget: null, location: null }

  for (const field of task.custom_fields ?? []) {
    if (field.value === undefined || field.value === null || field.value === '') continue

    if (field.type === 'currency') out.budget = Number(field.value)
    if (field.type === 'location') {
      out.location = field.value.formatted_address ?? null
    }
    if (field.type === 'short_text' && /locatie|adres/i.test(field.name)) {
      out.location = String(field.value)
    }
  }
  return out
}
