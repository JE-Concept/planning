import { describe, expect, it } from 'vitest'
import {
  SOCIAL_STAGES,
  SOCIAL_STAGE_KEYS,
  SOCIAL_VANAF,
  heeftSocial,
  isSociaalGearchiveerd,
  isSocialEligible,
  moetNaarSociaalArchief,
  stageLabel,
  stageOf,
} from '../src/lib/social-stage.js'

/**
 * Welke events op het socialbord horen, en welke niet. Een event dat er ten
 * onrechte op staat kost iemand een zoektocht; een event dat er ten onrechte
 * níét op staat, kost content die nooit gemaakt wordt.
 */

const event = (extra = {}) => ({ id: 't1', statusName: 'planning ready', ...extra })

describe('wanneer een event social content krijgt', () => {
  it('vanaf de facturatiefase, en alles daarna', () => {
    for (const status of SOCIAL_VANAF) {
      expect(isSocialEligible(event({ statusName: status })), status).toBe(true)
    }
  })

  it('niet in de fasen ervoor', () => {
    for (const status of ['request', 'create offer', 'offer accepted', 'planning ready']) {
      expect(isSocialEligible(event({ statusName: status })), status).toBe(false)
    }
  })

  it('trekt zich niets aan van hoofdletters of spaties', () => {
    expect(isSocialEligible(event({ statusName: ' Ready To Invoice ' }))).toBe(true)
  })

  it('kan ook eerder aangezet worden', () => {
    expect(heeftSocial(event({ socialWanted: true }))).toBe(true)
  })

  it('blijft uit wanneer het bewust uitgezet is, ook na facturatie', () => {
    expect(heeftSocial(event({ statusName: 'invoiced', socialWanted: false }))).toBe(false)
  })

  it('blijft staan zodra er een stand op staat, ook als de status terugvalt', () => {
    // Een event dat al content opleverde en daarna heropend wordt, hoort niet
    // van het bord te verdwijnen met die content erbij.
    expect(heeftSocial(event({ statusName: 'planning ongoing', socialStage: 'posted' }))).toBe(true)
  })

  it('doet niets met een leeg event', () => {
    expect(heeftSocial(undefined)).toBe(false)
    expect(isSocialEligible({})).toBe(false)
  })
})

describe('de drie stappen', () => {
  it('beginnen, lopen en eindigen', () => {
    expect(SOCIAL_STAGE_KEYS).toEqual(['delivery', 'ready', 'posted'])
    expect(SOCIAL_STAGES.map((s) => s.kind)).toEqual(['open', 'active', 'closed'])
  })

  it('zetten een event zonder stand in de eerste stap', () => {
    expect(stageOf(event())).toBe('delivery')
    expect(stageOf(event({ socialStage: 'onzin' }))).toBe('delivery')
    expect(stageOf(event({ socialStage: 'ready' }))).toBe('ready')
  })

  it('hebben de namen die het team gebruikt', () => {
    expect(stageLabel('delivery')).toBe('Social content delivery')
    expect(stageLabel('ready')).toBe('Social content ready')
    expect(stageLabel('posted')).toBe('Social content posted')
  })
})

describe('opruimen van het socialbord', () => {
  const vandaag = new Date('2026-10-08T09:00:00')

  it('neemt voorbije events mee, in elke kolom', () => {
    expect(moetNaarSociaalArchief(event({ eventDate: new Date('2026-09-01T18:00:00') }), vandaag)).toBe(true)
    expect(
      moetNaarSociaalArchief(event({ eventDate: new Date('2026-09-01T18:00:00'), socialStage: 'ready' }), vandaag)
    ).toBe(true)
  })

  it('laat het event van vandaag en later staan: daar komen de foto’s nog van', () => {
    expect(moetNaarSociaalArchief(event({ eventDate: new Date('2026-10-08T20:00:00') }), vandaag)).toBe(false)
    expect(moetNaarSociaalArchief(event({ eventDate: new Date('2026-10-20T20:00:00') }), vandaag)).toBe(false)
  })

  it('kijkt naar de laatste dag van een meerdaags event', () => {
    const festival = event({ eventDate: new Date('2026-10-06T12:00:00'), eventEndDate: new Date('2026-10-09T12:00:00') })
    expect(moetNaarSociaalArchief(festival, vandaag)).toBe(false)
  })

  it('valt terug op de deadline van een oude kaart', () => {
    expect(moetNaarSociaalArchief(event({ dueDate: new Date('2026-08-01T12:00:00') }), vandaag)).toBe(true)
  })

  it('neemt wat gepost is mee, ook zonder datum', () => {
    expect(moetNaarSociaalArchief(event({ socialStage: 'posted' }), vandaag)).toBe(true)
  })

  it('laat een kaart zonder datum en een gearchiveerde staan', () => {
    expect(moetNaarSociaalArchief(event({}), vandaag)).toBe(false)
    const weg = event({ socialArchived: true, eventDate: new Date('2026-01-01T12:00:00') })
    expect(isSociaalGearchiveerd(weg)).toBe(true)
    expect(moetNaarSociaalArchief(weg, vandaag)).toBe(false)
  })
})
