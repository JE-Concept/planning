import { describe, expect, it } from 'vitest'
import {
  MAX_POGINGEN,
  SLOT_MINUTEN,
  codeVorm,
  codesGelijk,
  isGeblokkeerd,
  keurCode,
  medewerkerUitUid,
  naGoedeBeurt,
  naMisseBeurt,
  uidVan,
} from '../functions/ploegcode.js'

describe('de vorm van een code', () => {
  it('is precies vier cijfers', () => {
    expect(codeVorm('4821')).toBe(true)
    for (const fout of ['123', '12345', '12a4', '', null, 4821, ' 1234', '12 4']) {
      expect(codeVorm(fout), String(fout)).toBe(false)
    }
  })

  /*
    Niet omdat deze codes zwakker zijn — elke vier cijfers zijn even
    waarschijnlijk — maar omdat ze dat juist niet zijn: dit is wat mensen
    kiezen, en dus wat een ander eerst probeert.
  */
  it('weigert de codes die iedereen eerst probeert', () => {
    for (const code of ['0000', '1234', '1111', '4321', '9999', '2020']) {
      expect(keurCode(code), code).toBe('ploeg.code.te_simpel')
    }
  })

  it('laat een gewone code door', () => {
    for (const code of ['4821', '7305', '9142']) expect(keurCode(code), code).toBe(null)
  })

  it('klaagt over de vorm voor ze over de inhoud klaagt', () => {
    expect(keurCode('12')).toBe('ploeg.code.vorm')
  })
})

describe('het account van iemand uit AAPI', () => {
  /*
    Afgeleid en niet willekeurig: zo bestaat het al voordat hij zich één keer
    aangemeld heeft, en kan de import hem nu al op een event zetten.
  */
  it('volgt uit zijn Employee Id', () => {
    expect(uidVan('84d70eee-d821')).toBe('ploeg-84d70eee-d821')
    expect(medewerkerUitUid('ploeg-84d70eee-d821')).toBe('84d70eee-d821')
  })

  it('is niets zonder id', () => {
    expect(uidVan('')).toBe(null)
    expect(uidVan(null)).toBe(null)
    expect(uidVan('   ')).toBe(null)
  })

  it('herkent een gewoon account niet als ploeg', () => {
    expect(medewerkerUitUid('u-jasper')).toBe(null)
    expect(medewerkerUitUid(null)).toBe(null)
  })
})

describe('het slot', () => {
  const nu = new Date('2026-10-02T20:00:00Z')

  it('valt dicht na vijf misse pogingen', () => {
    let stand = {}
    for (let i = 1; i < MAX_POGINGEN; i += 1) {
      stand = naMisseBeurt(stand, nu)
      expect(stand.geblokkeerdTot, `poging ${i}`).toBe(null)
      expect(stand.mislukt).toBe(i)
    }
    stand = naMisseBeurt(stand, nu)
    expect(stand.geblokkeerdTot).toEqual(new Date(nu.getTime() + SLOT_MINUTEN * 60_000))
  })

  /*
    De teller gaat op nul zodra het slot dichtvalt. Zonder dat zou één
    vergissing na het slot meteen een nieuw slot opleveren, en dan sluit iemand
    zichzelf een avond buiten omdat hij zich één keer vertypte.
  */
  it('geeft na het slot weer vijf pogingen', () => {
    const stand = naMisseBeurt({ mislukt: MAX_POGINGEN - 1 }, nu)
    expect(stand.mislukt).toBe(0)
  })

  it('weet of het nog dicht is', () => {
    const dicht = { geblokkeerdTot: new Date(nu.getTime() + 60_000) }
    const open = { geblokkeerdTot: new Date(nu.getTime() - 60_000) }
    expect(isGeblokkeerd(dicht, nu).dicht).toBe(true)
    expect(isGeblokkeerd(open, nu).dicht).toBe(false)
    expect(isGeblokkeerd({}, nu).dicht).toBe(false)
    expect(isGeblokkeerd(null, nu).dicht).toBe(false)
  })

  // Firestore geeft een Timestamp terug en geen Date.
  it('leest ook een Firestore-tijdstempel', () => {
    const stempel = { toDate: () => new Date(nu.getTime() + 60_000) }
    expect(isGeblokkeerd({ geblokkeerdTot: stempel }, nu).dicht).toBe(true)
  })

  it('zet alles op nul na een geslaagde poging', () => {
    expect(naGoedeBeurt(nu)).toEqual({ mislukt: 0, geblokkeerdTot: null, laatsteAanmelding: nu })
  })
})

describe('het vergelijken van codes', () => {
  it('klopt gewoon', () => {
    expect(codesGelijk('4821', '4821')).toBe(true)
    expect(codesGelijk('4821', '4822')).toBe(false)
    expect(codesGelijk('4821', '482')).toBe(false)
    expect(codesGelijk(null, null)).toBe(true)
    expect(codesGelijk('4821', null)).toBe(false)
  })
})
