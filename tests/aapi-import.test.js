import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { leesXlsx } from '../functions/aapi/xlsx'
import { planImport } from '../functions/aapi/import'
import { brusselNaarInstant, brusselseDag } from '../functions/aapi/tijd'

const rijen = leesXlsx(readFileSync('tests/fixtures/planning-overview.xlsx'))
const NU = new Date('2026-09-30T08:00:00Z')

/**
 * De mutaties uitvoeren op een lijstje in het geheugen, zoals Firestore het
 * zou doen. Zo kan een test een tweede import op de uitkomst van de eerste
 * draaien — en dat is de enige manier om idempotentie echt aan te tonen.
 */
function pasToe({ shifts, medewerkers, verdwenen }, stand) {
  const shiftOpId = new Map(stand.shifts.map((s) => [s.aapiPlanningId, { ...s }]))
  const mwOpId = new Map(stand.medewerkers.map((m) => [m.aapiEmployeeId, { ...m }]))

  for (const m of medewerkers) {
    mwOpId.set(m.aapiEmployeeId, { ...(mwOpId.get(m.aapiEmployeeId) ?? { aapiEmployeeId: m.aapiEmployeeId }), ...m.patch })
  }
  for (const s of shifts) {
    shiftOpId.set(s.aapiPlanningId, { ...(shiftOpId.get(s.aapiPlanningId) ?? { aapiPlanningId: s.aapiPlanningId }), ...s.patch })
  }
  for (const s of verdwenen) {
    shiftOpId.set(s.aapiPlanningId, { ...shiftOpId.get(s.aapiPlanningId), ...s.patch })
  }
  return { shifts: [...shiftOpId.values()], medewerkers: [...mwOpId.values()] }
}

const WANDELZONDAG = {
  id: 'e-wandel',
  dag: '2026-10-25',
  statusName: 'planning ready',
  archived: false,
  updatedAt: new Date('2026-09-01T10:00:00Z'),
  eventDate: brusselNaarInstant('2026-10-25 12:00:00'),
  draaiboek: [{ tijd: '06:00', wat: 'Opbouw' }, { tijd: '14:00', wat: 'Afbraak' }],
}

describe('de eerste import van het echte bestand', () => {
  const plan = planImport({ rijen, nu: NU, importRunId: 'run-1', bestandsnaam: 'Planning Overview.xlsx' })

  it('maakt elke shift en elke medewerker aan', () => {
    expect(plan.rapport.shiftsCreated).toBe(43)
    expect(plan.rapport.shiftsUpdated).toBe(0)
    expect(plan.rapport.shiftsUnchanged).toBe(0)
    expect(plan.rapport.employeesCreated).toBe(15)
    expect(plan.rapport.errors).toEqual([])
    expect(plan.rapport.status).toBe('ok')
  })

  it('spant het venster over oktober en raakt niets daarbuiten', () => {
    expect(brusselseDag(plan.venster.van)).toBe('2026-10-01')
    expect(brusselseDag(plan.venster.tot)).toBe('2026-10-30')
    expect(plan.verdwenen).toEqual([])
  })

  it('zet bar, zaal en keuken op notApplicable', () => {
    const niet = plan.shifts.filter((s) => s.patch.locationName !== 'evenementen')
    expect(niet).toHaveLength(36)
    for (const s of niet) expect(s.patch.linkStatus).toBe('notApplicable')
  })

  // Zonder events in JE Plan is er niets om aan te koppelen, en dat is geen
  // fout maar een stand van zaken.
  it('laat de evenementenshifts ongekoppeld zolang er geen events zijn', () => {
    expect(plan.rapport.eventShifts).toBe(7)
    expect(plan.rapport.linksAuto).toBe(0)
    const ev = plan.shifts.filter((s) => s.patch.locationName === 'evenementen')
    for (const s of ev) expect(s.patch.linkStatus).toBe('unlinked')
  })

  it('zet iedereen standaard op actief, met een eerste en laatste keer gezien', () => {
    for (const m of plan.medewerkers) {
      expect(m.patch.active).toBe(true)
      expect(m.patch.firstSeenAt).toBe(NU)
      expect(m.patch.lastSeenAt).toBe(NU)
    }
  })
})

/*
  Het hart van de zaak: hetzelfde bestand twee keer. Niet "bijna niets
  veranderd" maar nul mutaties — anders schrijft een dagelijkse import elke dag
  de hele planning opnieuw, loopt het logboek vol, en is niet meer te zien wat
  er écht veranderde.
*/
describe('hetzelfde bestand een tweede keer', () => {
  const eerste = planImport({ rijen, nu: NU, importRunId: 'run-1', events: [WANDELZONDAG] })
  const stand = pasToe(eerste, { shifts: [], medewerkers: [] })

  const tweede = planImport({
    rijen,
    bestaandeShifts: stand.shifts,
    bestaandeMedewerkers: stand.medewerkers,
    events: [WANDELZONDAG],
    nu: new Date('2026-10-01T08:00:00Z'),
    importRunId: 'run-2',
  })

  it('verandert geen enkele shift', () => {
    expect(tweede.rapport.shiftsCreated).toBe(0)
    expect(tweede.rapport.shiftsUpdated).toBe(0)
    expect(tweede.rapport.shiftsUnchanged).toBe(43)
    expect(tweede.shifts).toEqual([])
    expect(tweede.verdwenen).toEqual([])
  })

  it('maakt geen enkele medewerker opnieuw aan', () => {
    expect(tweede.rapport.employeesCreated).toBe(0)
  })

  it('telt de koppelingen van de eerste keer nog steeds mee in het rapport', () => {
    expect(eerste.rapport.linksAuto).toBe(3)
    expect(tweede.rapport.linksAuto).toBe(3)
  })

  // De enige mutatie die een tweede import wél maakt, is `lastSeenAt`. Dat is
  // met opzet: het is het antwoord op "staat deze persoon nog ingepland".
  it('werkt alleen het laatst-gezien van de medewerkers bij', () => {
    for (const m of tweede.medewerkers) expect(Object.keys(m.patch)).toEqual(['lastSeenAt'])
  })
})

describe('de koppeling met het event', () => {
  it('koppelt de drie shifts van de Wandelzondag vanzelf', () => {
    const plan = planImport({ rijen, nu: NU, events: [WANDELZONDAG] })
    const gekoppeld = plan.shifts.filter((s) => s.patch.eventRef === 'e-wandel')
    expect(gekoppeld).toHaveLength(3)
    for (const s of gekoppeld) {
      expect(s.patch.linkStatus).toBe('auto')
      expect(s.patch.linkScore).toBe(1)
      expect(s.patch.linkedBy).toBeNull()
    }
    expect(plan.rapport.linksAuto).toBe(3)
  })

  /*
    Een event dat ná de import aangemaakt wordt. De shifts stonden ongekoppeld;
    de volgende import hoort ze alsnog op te pakken, want de events van die dag
    zijn gewijzigd. Zonder die regel moet iemand elke shift met de hand
    koppelen omdat het event een dag te laat in JE Plan stond.
  */
  it('pakt een event op dat er bij de vorige import nog niet was', () => {
    const eerste = planImport({ rijen, nu: NU, events: [] })
    const stand = pasToe(eerste, { shifts: [], medewerkers: [] })

    const later = planImport({
      rijen,
      bestaandeShifts: stand.shifts,
      bestaandeMedewerkers: stand.medewerkers,
      events: [{ ...WANDELZONDAG, updatedAt: new Date('2026-10-02T09:00:00Z') }],
      nu: new Date('2026-10-03T08:00:00Z'),
    })

    expect(later.shifts.filter((s) => s.patch.eventRef === 'e-wandel')).toHaveLength(3)
    // En de rest blijft met rust.
    expect(later.rapport.shiftsUnchanged).toBe(40)
  })

  it('laat een koppeling die een mens legde met rust', () => {
    const eerste = planImport({ rijen, nu: NU, events: [WANDELZONDAG] })
    const stand = pasToe(eerste, { shifts: [], medewerkers: [] })

    // Iemand zet er handmatig een ander event op, en een ander op "geen event".
    const ev = stand.shifts.filter((s) => s.locationName === 'evenementen')
    ev[0].linkStatus = 'manual'
    ev[0].eventRef = 'e-iets-anders'
    ev[1].linkStatus = 'none'
    ev[1].eventRef = null

    const later = planImport({
      rijen,
      bestaandeShifts: stand.shifts,
      bestaandeMedewerkers: stand.medewerkers,
      events: [{ ...WANDELZONDAG, updatedAt: new Date('2026-10-20T09:00:00Z') }],
      nu: new Date('2026-10-21T08:00:00Z'),
    })

    const geraakt = later.shifts.map((s) => s.aapiPlanningId)
    expect(geraakt).not.toContain(ev[0].aapiPlanningId)
    expect(geraakt).not.toContain(ev[1].aapiPlanningId)
  })
})

describe('wat er uit de bron verdwijnt', () => {
  const eerste = planImport({ rijen, nu: NU })
  const stand = pasToe(eerste, { shifts: [], medewerkers: [] })

  // Eén shift uit het bestand halen, de rest hetzelfde laten.
  const zonderEen = rijen.filter((_, i) => i !== 5)
  const weg = eerste.shifts.find((s) => s.aapiPlanningId && !zonderEen.some((r) => Object.values(r).includes(s.aapiPlanningId)))

  it('markeert een shift die niet meer meekomt in plaats van hem te verwijderen', () => {
    const later = planImport({
      rijen: zonderEen,
      bestaandeShifts: stand.shifts,
      bestaandeMedewerkers: stand.medewerkers,
      nu: new Date('2026-10-05T08:00:00Z'),
      importRunId: 'run-2',
    })
    expect(later.verdwenen).toHaveLength(1)
    expect(later.verdwenen[0].aapiPlanningId).toBe(weg.aapiPlanningId)
    expect(later.verdwenen[0].patch.removedFromSourceAt).toEqual(new Date('2026-10-05T08:00:00Z'))
    expect(later.rapport.shiftsRemoved).toBe(1)
  })

  it('zet hem weer gewoon terug als hij terugkomt', () => {
    const tussenstand = pasToe(
      planImport({ rijen: zonderEen, bestaandeShifts: stand.shifts, bestaandeMedewerkers: stand.medewerkers, nu: new Date('2026-10-05T08:00:00Z') }),
      stand
    )
    const terug = planImport({
      rijen,
      bestaandeShifts: tussenstand.shifts,
      bestaandeMedewerkers: tussenstand.medewerkers,
      nu: new Date('2026-10-06T08:00:00Z'),
    })
    const hersteld = terug.shifts.find((s) => s.aapiPlanningId === weg.aapiPlanningId)
    expect(hersteld.patch.removedFromSourceAt).toBeNull()
  })

  /*
    Een export van één maand mag nooit iets zeggen over een andere maand. Zonder
    het importvenster zou een bestand met alleen oktober de hele novemberplanning
    als verdwenen markeren.
  */
  it('raakt niets aan buiten het venster van het bestand', () => {
    const november = {
      aapiPlanningId: 'p-november',
      start: brusselNaarInstant('2026-11-14 10:00:00'),
      end: brusselNaarInstant('2026-11-14 18:00:00'),
      locationName: 'zaal',
    }
    const later = planImport({
      rijen,
      bestaandeShifts: [...stand.shifts, november],
      bestaandeMedewerkers: stand.medewerkers,
      nu: new Date('2026-10-05T08:00:00Z'),
    })
    expect(later.verdwenen).toEqual([])
  })
})
