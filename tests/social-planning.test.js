import { describe, expect, it } from 'vitest'
import { dayKey } from '../src/lib/dates.js'
import { GEEN_KANAAL } from '../src/lib/social-channels.js'
import {
  bucketPerDag,
  bucketPerDagEnKanaal,
  heeftEigenPublicatiedatum,
  publicatieMoment,
  telPerKanaal,
  valtInWeek,
  weekDagen,
  weekJaar,
  weekNummer,
} from '../src/lib/social-planning.js'

/**
 * De publicatiedatum staat los van het event: een aankondiging gaat weken
 * vooraf online en een nabeschouwing dagen erna. Wat hier misgaat, zet een
 * post op de verkeerde dag — en dat merk je pas als hij te vroeg of te laat
 * de deur uit is.
 */

const om = (iso) => new Date(iso)

describe('het publicatiemoment', () => {
  it('is de publicatiedatum zodra die er staat', () => {
    const post = { publishAt: om('2026-09-15T10:00:00'), scheduledAt: om('2026-10-12T10:00:00') }
    expect(publicatieMoment(post)).toEqual(om('2026-09-15T10:00:00'))
  })

  it('valt terug op de eventdatum zolang er geen publicatiedatum is', () => {
    // Zo staan de posts erin die er al vóór deze wijziging waren: alleen een
    // datum die van het event kwam. Die blijft staan en wordt niet overschreven.
    expect(publicatieMoment({ scheduledAt: om('2026-10-12T10:00:00') })).toEqual(
      om('2026-10-12T10:00:00')
    )
  })

  it('is niets als er helemaal geen datum is', () => {
    expect(publicatieMoment({})).toBe(null)
    expect(publicatieMoment(null)).toBe(null)
  })

  it('zegt of de datum echt gekozen is of overgenomen van het event', () => {
    expect(heeftEigenPublicatiedatum({ publishAt: om('2026-09-15T10:00:00') })).toBe(true)
    expect(heeftEigenPublicatiedatum({ scheduledAt: om('2026-10-12T10:00:00') })).toBe(false)
  })

  it('kan tegen een Firestore-Timestamp die nog niet omgezet is', () => {
    const stempel = { toDate: () => om('2026-09-15T10:00:00') }
    expect(publicatieMoment({ publishAt: stempel })).toEqual(om('2026-09-15T10:00:00'))
  })
})

describe('de week', () => {
  it('loopt van maandag tot zondag, waar je ook in de week begint', () => {
    const dagen = weekDagen(om('2026-10-01T15:00:00'))
    expect(dagen).toHaveLength(7)
    expect(dayKey(dagen[0])).toBe('2026-09-28')
    expect(dayKey(dagen[6])).toBe('2026-10-04')
  })

  it('geeft het ISO-weeknummer', () => {
    expect(weekNummer(om('2026-01-01T12:00:00'))).toBe(1)
    expect(weekNummer(om('2026-10-01T12:00:00'))).toBe(40)
  })

  it('rekent rond de jaarwissel naar de donderdag van die week', () => {
    // 1 januari 2022 viel op zaterdag: die week is nog week 52 van 2021.
    expect(weekNummer(om('2022-01-01T12:00:00'))).toBe(52)
    expect(weekJaar(om('2022-01-01T12:00:00'))).toBe(2021)
    // En 2021 kende een week 53.
    expect(weekNummer(om('2021-01-01T12:00:00'))).toBe(53)
    expect(weekJaar(om('2021-01-01T12:00:00'))).toBe(2020)
  })

  it('weet of een post in deze week valt, op de publicatiedatum en niet op het event', () => {
    const dagen = weekDagen(om('2026-10-01T12:00:00'))
    const aankondiging = { publishAt: om('2026-09-30T10:00:00'), scheduledAt: om('2026-11-20T10:00:00') }
    expect(valtInWeek(aankondiging, dagen)).toBe(true)
    expect(valtInWeek({ publishAt: om('2026-11-20T10:00:00') }, dagen)).toBe(false)
    expect(valtInWeek({}, dagen)).toBe(false)
  })
})

describe('het bucketen per dag', () => {
  const posts = [
    { id: 'a', publishAt: om('2026-09-30T18:00:00'), channels: ['instagram'] },
    { id: 'b', publishAt: om('2026-09-30T09:00:00'), channels: ['instagram', 'facebook'] },
    { id: 'c', scheduledAt: om('2026-10-01T11:00:00'), channels: ['facebook'] },
    { id: 'd', channels: ['instagram'] },
    { id: 'e', publishAt: om('2026-10-01T08:00:00'), channels: [] },
  ]

  it('zet elke post op de dag van zijn publicatiemoment', () => {
    const perDag = bucketPerDag(posts)
    expect(perDag['2026-09-30'].map((p) => p.id)).toEqual(['b', 'a'])
    expect(perDag['2026-10-01'].map((p) => p.id)).toEqual(['e', 'c'])
  })

  it('laat posts zonder datum weg — die horen in de lijst ernaast', () => {
    const alles = Object.values(bucketPerDag(posts)).flat()
    expect(alles.some((p) => p.id === 'd')).toBe(false)
  })

  it('zet een post op elk kanaal waarop hij gaat', () => {
    const perKanaal = bucketPerDagEnKanaal(posts)
    expect(perKanaal.instagram['2026-09-30'].map((p) => p.id)).toEqual(['b', 'a'])
    expect(perKanaal.facebook['2026-09-30'].map((p) => p.id)).toEqual(['b'])
    expect(perKanaal.facebook['2026-10-01'].map((p) => p.id)).toEqual(['c'])
  })

  it('geeft een post zonder kanaal toch een plek', () => {
    expect(bucketPerDagEnKanaal(posts)[GEEN_KANAAL]['2026-10-01'].map((p) => p.id)).toEqual(['e'])
  })

  it('telt per kanaal even vaak als het bucketen', () => {
    expect(telPerKanaal(posts)).toEqual({ instagram: 3, facebook: 2, [GEEN_KANAAL]: 1 })
  })
})
