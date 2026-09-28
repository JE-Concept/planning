/**
 * Canva, nagespeeld voor de demobuild.
 *
 * In de echte tool praat de browser met een Cloud Function die Canva Connect
 * aanroept. In de demo bestaat die server niet, dus vangen we dezelfde routes
 * op en antwoorden we uit het geheugen. De applicatiecode blijft ongewijzigd:
 * dit is hetzelfde contract, alleen zonder Canva erachter.
 */
import { allDocs, doc, getDoc, serverTimestamp, setDoc, updateDoc } from './firestore.js'

const SLEEP = 320 // genoeg om de spinner te zien, weinig genoeg om niet te storen
const wacht = () => new Promise((r) => setTimeout(r, SLEEP))

/** Een voorbeeldafbeelding zonder netwerk: een SVG als data-URI. */
function voorbeeld(titel, kleur, formaat = '1080x1080') {
  const [w, h] = formaat.split('x').map(Number)
  const regels = titel.split(' ').reduce((acc, woord) => {
    const laatste = acc[acc.length - 1]
    if (laatste && (laatste + ' ' + woord).length <= 16) acc[acc.length - 1] = `${laatste} ${woord}`
    else acc.push(woord)
    return acc
  }, [])

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${kleur}"/><stop offset="1" stop-color="#112550"/>
    </linearGradient></defs>
    <rect width="${w}" height="${h}" fill="url(#g)"/>
    <circle cx="${w * 0.82}" cy="${h * 0.18}" r="${w * 0.1}" fill="#C9A84C" opacity="0.85"/>
    ${tekstRegels(regels, w, h)}
  </svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

function tekstRegels(regels, w, h) {
  const grootte = Math.round(w * 0.075)
  const start = h / 2 - ((regels.length - 1) * grootte * 1.2) / 2
  return regels
    .map(
      (regel, i) =>
        `<text x="${w / 2}" y="${start + i * grootte * 1.2}" fill="#FAF8F4" font-family="Georgia,serif" font-weight="700" font-size="${grootte}" text-anchor="middle" dominant-baseline="middle">${regel.replace(/&/g, '&amp;')}</text>`
    )
    .join('')
}

const MAPPEN = [
  { id: 'f-jeconcept', name: 'JE Concept' },
  { id: 'f-barvue', name: 'Bar Vue' },
  { id: 'f-vinne', name: 'Meer — Het Vinne' },
  { id: 'f-feestbeest', name: 'Feestbeest' },
]

/** Wat er in het Canva-account van het team staat. */
export const ONTWERPEN = [
  { id: 'DAF-vinne-wandel', title: 'Wandelzondag Het Vinne — aankondiging', folderId: 'f-vinne', kleur: '#3db88b', formaat: '1080x1080' },
  { id: 'DAF-vinne-terras', title: 'Terras open Meer', folderId: 'f-vinne', kleur: '#4A7FC1', formaat: '1080x1350' },
  { id: 'DAF-barvue-cocktail', title: 'Bar Vue cocktailweek', folderId: 'f-barvue', kleur: '#C9A84C', formaat: '1080x1080' },
  { id: 'DAF-barvue-story', title: 'Bar Vue story — vrijdagavond', folderId: 'f-barvue', kleur: '#7c3aed', formaat: '1080x1920' },
  { id: 'DAF-je-haspengouw', title: 'Haspengouw Culinair sfeerbeeld', folderId: 'f-jeconcept', kleur: '#1A3A6B', formaat: '1080x1080' },
  { id: 'DAF-je-vacature', title: 'Vacature medewerker events', folderId: 'f-jeconcept', kleur: '#475569', formaat: '1200x630' },
  { id: 'DAF-feest-verhuur', title: 'Feestbeest verhuurmateriaal', folderId: 'f-feestbeest', kleur: '#e5484d', formaat: '1080x1080' },
  { id: 'DAF-feest-trouw', title: 'Trouw Niels en Inez — bedankt', folderId: 'f-feestbeest', kleur: '#b660e0', formaat: '1080x1350' },
  { id: 'DAF-je-blum', title: 'Blum personeelsfeest teaser', folderId: 'f-jeconcept', kleur: '#243F75', formaat: '1080x1080' },
  { id: 'DAF-je-nieuwjaar', title: 'Nieuwjaarsdrink 2027 save the date', folderId: 'f-jeconcept', kleur: '#0E1F44', formaat: '1080x1080' },
]

const kaart = (d) => ({
  id: d.id,
  title: d.title,
  thumbnailUrl: voorbeeld(d.title, d.kleur, d.formaat),
  editUrl: `https://www.canva.com/design/${d.id}/edit`,
  viewUrl: `https://www.canva.com/design/${d.id}/view`,
  pageCount: 1,
  updatedAt: Date.now() - Math.random() * 12 * 86400000,
})

export const ontwerpById = (id) => ONTWERPEN.find((d) => d.id === id)
export const ontwerpKaart = (id) => (ontwerpById(id) ? kaart(ontwerpById(id)) : null)

const postIdVoor = (designId) => `canva-${designId}`

/** De post die al aan dit ontwerp hangt, ongeacht hoe die is ontstaan. */
function postVoorOntwerp(designId) {
  for (const [pad, data] of allDocs()) {
    if (pad.startsWith('socialPosts/') && data.canvaDesignId === designId) {
      return { id: pad.slice('socialPosts/'.length), data }
    }
  }
  return null
}

const REVIEW = {
  request: { reviewState: 'requested', status: 'review', regel: (wie, n) => `Klaar om na te kijken — gevraagd door ${wie}.${n ? `\n${n}` : ''}` },
  approve: { reviewState: 'approved', status: 'approved', regel: (wie, n) => `Goedgekeurd door ${wie}.${n ? `\n${n}` : ''}` },
  changes: { reviewState: 'changes', status: 'design', regel: (wie, n) => `Aanpassing gevraagd door ${wie}.${n ? `\n${n}` : ''}` },
}

/** De antwoorden die de ontwerper in Canva zou achterlaten. */
const ANTWOORDEN = [
  'Bekeken, ik pas de datum aan en zet de nieuwe versie klaar.',
  'Logo staat nu links onder, zoals afgesproken.',
  'Kleur van de knop iets donkerder gemaakt — beter leesbaar op de foto.',
]

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

/** Dezelfde routes als de Cloud Function, uit het geheugen bediend. */
export async function canvaApi(url, init) {
  const { pathname, searchParams } = new URL(url, 'https://demo.local')
  const path = pathname.replace(/^\/api/, '')
  const body = init?.body ? JSON.parse(init.body) : {}
  await wacht()

  if (path === '/canva/status') {
    return json({
      connected: true,
      canvaUserId: 'demo-team-user',
      brandTemplates: [
        { id: 'BT-je-post', title: 'JE Concept — post' },
        { id: 'BT-barvue-story', title: 'Bar Vue — story' },
      ],
    })
  }

  if (path === '/canva/folders') {
    return json({ items: MAPPEN })
  }

  if (path === '/canva/browse') {
    const q = (searchParams.get('q') ?? '').toLowerCase()
    const folderId = searchParams.get('folderId') ?? ''

    const items = []
    for (const ontwerp of ONTWERPEN) {
      if (folderId && ontwerp.folderId !== folderId) continue
      if (q && !ontwerp.title.toLowerCase().includes(q)) continue

      const card = kaart(ontwerp)
      card.postId = postVoorOntwerp(ontwerp.id)?.id ?? null
      items.push(card)
    }
    return json({ items, continuation: null })
  }

  if (path === '/canva/import') {
    const { designIds = [], brandId, scheduledAt, taskId } = body
    let created = 0
    let updated = 0

    for (const designId of designIds) {
      const ontwerp = ontwerpById(designId)
      if (!ontwerp) continue

      const bestaand = postVoorOntwerp(designId)
      const ref = doc(null, 'socialPosts', bestaand?.id ?? postIdVoor(designId))
      const snap = await getDoc(ref)
      const canva = {
        canvaDesignId: designId,
        canvaEditUrl: `https://www.canva.com/design/${designId}/edit`,
        canvaViewUrl: `https://www.canva.com/design/${designId}/view`,
        canvaThumbnailUrl: voorbeeld(ontwerp.title, ontwerp.kleur, ontwerp.formaat),
        canvaTitle: ontwerp.title,
        canvaSyncedAt: new Date(),
      }

      if (snap.exists()) {
        await updateDoc(ref, { ...canva, updatedAt: new Date() })
        updated += 1
        continue
      }

      const taak = taskId ? await getDoc(doc(null, 'tasks', taskId)) : null
      await setDoc(ref, {
        ...canva,
        source: 'canva',
        brandId,
        title: ontwerp.title,
        caption: '',
        hashtags: '',
        channels: ['instagram', 'facebook'],
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        status: 'design',
        assigneeId: 'u-charish',
        taskId: taak?.exists() ? taskId : null,
        taskTitle: taak?.exists() ? taak.data().title : null,
        taskListName: taak?.exists() ? taak.data().listName : null,
        reviewState: 'none',
        reviewRound: 0,
        reviewerId: null,
        reviewNote: null,
        canvaThreadIds: [],
        canvaCommentThreadId: null,
        canvaComments: [],
        assetUrl: null,
        publishedUrl: null,
        notes: '',
        createdBy: 'u-jasper',
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      created += 1
    }
    return json({ created, updated })
  }

  if (path === '/canva/review') {
    const { postId, action, note = '', reviewerId = null } = body
    const shape = REVIEW[action]
    if (!shape) return json({ error: 'Onbekende reviewactie.' }, 400)

    const ref = doc(null, 'socialPosts', postId)
    const snap = await getDoc(ref)
    if (!snap.exists()) return json({ error: 'Post niet gevonden.' }, 404)

    const post = snap.data()
    const wie = 'Jasper Hansen'
    const ronde = action === 'request' ? (post.reviewRound ?? 0) + 1 : (post.reviewRound ?? 1)
    const threadId = post.canvaCommentThreadId ?? `TH-${postId}`

    const patch = {
      reviewState: shape.reviewState,
      status: shape.status,
      reviewRound: ronde,
      reviewNote: note.trim() || null,
      updatedAt: new Date(),
    }
    if (action === 'request') {
      patch.reviewerId = reviewerId
      patch.reviewRequestedAt = new Date()
      patch.reviewRequestedBy = 'u-jasper'
      patch.reviewedAt = null
      patch.reviewedBy = null
    } else {
      patch.reviewedAt = new Date()
      patch.reviewedBy = 'u-jasper'
    }

    // Wat in de echte tool als reactie op het Canva-ontwerp belandt.
    if (post.canvaDesignId) {
      patch.canvaCommentThreadId = threadId
      patch.canvaThreadIds = [...new Set([...(post.canvaThreadIds ?? []), threadId])]
      patch.canvaComments = [
        ...(post.canvaComments ?? []),
        {
          id: `C-${Math.random().toString(36).slice(2, 8)}`,
          threadId,
          isReply: (post.canvaComments ?? []).length > 0,
          authorName: wie,
          message: shape.regel(wie, note.trim()),
          createdAt: new Date(),
          resolved: false,
        },
      ]
    }

    await updateDoc(ref, patch)
    await setDoc(doc(null, 'postReviews', `r-${Math.random().toString(36).slice(2, 10)}`), {
      postId,
      round: ronde,
      decision: action,
      note: note.trim() || null,
      authorId: 'u-jasper',
      authorName: wie,
      canvaCommentId: post.canvaDesignId ? threadId : null,
      pushedToCanva: Boolean(post.canvaDesignId),
      canvaError: null,
      createdAt: new Date(),
    })

    return json({ ok: true, pushedToCanva: Boolean(post.canvaDesignId), canvaError: null })
  }

  if (path === '/canva/comments') {
    const ref = doc(null, 'socialPosts', body.postId)
    const snap = await getDoc(ref)
    if (!snap.exists()) return json({ error: 'Post niet gevonden.' }, 404)

    const post = snap.data()
    const threadId = post.canvaCommentThreadId ?? `TH-${body.postId}`
    const bestaand = post.canvaComments ?? []
    const antwoord = {
      id: `C-${Math.random().toString(36).slice(2, 8)}`,
      threadId,
      isReply: true,
      authorName: 'Charish Vanoppen',
      message: ANTWOORDEN[bestaand.filter((c) => c.isReply).length % ANTWOORDEN.length],
      createdAt: new Date(),
      resolved: false,
    }
    const items = [...bestaand, antwoord]
    await updateDoc(ref, { canvaComments: items, canvaCommentsSyncedAt: new Date() })
    return json({ items })
  }

  if (path === '/canva/link' || path === '/canva/refresh' || path === '/canva/designs') {
    const ref = doc(null, 'socialPosts', body.postId)
    const snap = await getDoc(ref)
    if (!snap.exists()) return json({ error: 'Post niet gevonden.' }, 404)

    const titel = body.title || snap.data().title || 'Nieuw ontwerp'
    const designId = body.designId ?? snap.data().canvaDesignId ?? `DAF-demo-${Math.random().toString(36).slice(2, 8)}`
    const patch = {
      canvaDesignId: designId,
      canvaEditUrl: `https://www.canva.com/design/${designId}/edit`,
      canvaViewUrl: `https://www.canva.com/design/${designId}/view`,
      canvaThumbnailUrl: voorbeeld(titel, '#1A3A6B'),
      canvaSyncedAt: new Date(),
      updatedAt: serverTimestamp(),
    }
    await updateDoc(ref, patch)
    return json(patch)
  }

  if (path === '/canva/export') {
    return json({ urls: [] })
  }

  if (path === '/canva/brand-templates') {
    return json({ items: [] })
  }

  if (path === '/canva/connect' || path === '/canva/disconnect') {
    return json({ connected: true, url: '#demo' })
  }

  return json({ error: 'Onbekend endpoint.' }, 404)
}

export { voorbeeld as demoVoorbeeld }
