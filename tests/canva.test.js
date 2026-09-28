import { describe, expect, it } from 'vitest'
import {
  commentToEntry,
  designToCard,
  designToPost,
  postIdForDesign,
  SCOPES,
} from '../functions/lib/canva.js'

/** A design as Canva Connect hands it back. */
const design = {
  id: 'DAFxyz123',
  title: 'Bar Vue cocktailweek',
  page_count: 2,
  urls: { edit_url: 'https://www.canva.com/design/DAFxyz123/edit', view_url: 'https://www.canva.com/design/DAFxyz123/view' },
  thumbnail: { url: 'https://thumb.canva.com/abc.png', width: 400, height: 400 },
  updated_at: 1_759_000_000,
}

describe('postIdForDesign', () => {
  it('is deterministic, so importing twice is one post', () => {
    expect(postIdForDesign('DAFxyz123')).toBe('canva-DAFxyz123')
    expect(postIdForDesign('DAFxyz123')).toBe(postIdForDesign('DAFxyz123'))
  })

  it('separates two designs', () => {
    expect(postIdForDesign('A')).not.toBe(postIdForDesign('B'))
  })
})

describe('designToPost', () => {
  it('keeps only the fields a post needs', () => {
    const patch = designToPost(design)
    expect(patch.canvaDesignId).toBe('DAFxyz123')
    expect(patch.canvaEditUrl).toBe(design.urls.edit_url)
    expect(patch.canvaThumbnailUrl).toBe(design.thumbnail.url)
    expect(patch.canvaTitle).toBe('Bar Vue cocktailweek')
    expect(patch.canvaUpdatedAt).toEqual(new Date(1_759_000_000 * 1000))
    expect(patch.canvaSyncedAt).toBeInstanceOf(Date)
  })

  it('survives a design without urls or thumbnail', () => {
    const patch = designToPost({ id: 'DAFbare' })
    expect(patch.canvaDesignId).toBe('DAFbare')
    expect(patch.canvaEditUrl).toBeNull()
    expect(patch.canvaThumbnailUrl).toBeNull()
    expect(patch.canvaUpdatedAt).toBeNull()
  })
})

describe('designToCard', () => {
  it('flattens a design for the import browser', () => {
    const card = designToCard(design)
    expect(card).toMatchObject({ id: 'DAFxyz123', title: 'Bar Vue cocktailweek', pageCount: 2 })
    expect(card.thumbnailUrl).toBe(design.thumbnail.url)
    expect(card.updatedAt).toBe(1_759_000_000 * 1000)
  })

  it('names an untitled design rather than showing a blank card', () => {
    expect(designToCard({ id: 'x', title: '' }).title).toBe('Zonder titel')
  })
})

describe('commentToEntry', () => {
  it('reads a thread root', () => {
    const entry = commentToEntry(
      {
        id: 'C1',
        message_plaintext: 'Logo valt weg tegen de foto.',
        author: { display_name: 'Jasper Hansen' },
        created_at: 1_759_000_500,
      },
      { threadId: 'TH1' }
    )
    expect(entry).toMatchObject({
      id: 'C1',
      threadId: 'TH1',
      isReply: false,
      authorName: 'Jasper Hansen',
      message: 'Logo valt weg tegen de foto.',
      resolved: false,
    })
    expect(entry.createdAt).toEqual(new Date(1_759_000_500 * 1000))
  })

  it('marks a reply and falls back to a name we can show', () => {
    const entry = commentToEntry({ id: 'C2', message: 'Aangepast.' }, { threadId: 'TH1', isReply: true })
    expect(entry.isReply).toBe(true)
    expect(entry.authorName).toBe('Canva')
    expect(entry.message).toBe('Aangepast.')
    expect(entry.createdAt).toBeInstanceOf(Date)
  })

  it('carries a resolved thread through', () => {
    expect(commentToEntry({ id: 'C3', thread_type: { resolved: true } }).resolved).toBe(true)
  })
})

describe('SCOPES', () => {
  it('asks for what the calendar, the folders and the review need', () => {
    for (const scope of ['design:meta:read', 'folder:read', 'comment:read', 'comment:write']) {
      expect(SCOPES.split(' ')).toContain(scope)
    }
  })
})
