import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { MAX_BYTES, lijktOpPlanning } from '../functions-mail/planning-herkennen'
import { leesXlsx } from '../functions/aapi/xlsx'
import { ImportFout, parseBlad } from '../functions/aapi/parser'

/*
  De twee halve antwoorden, en waarom het er twee zijn.

  De mailophaler ziet een bijlage en mag er niets van weten: hij kan de lezer
  niet importeren, want die staat in een andere codebase die apart uitgerold
  wordt. Dus kijkt hij alleen of het een spreadsheet is. Het échte antwoord —
  staat het blad "Data" erin met de juiste kolommen — valt pas aan de andere
  kant, en een bijlage die daar niet door komt heet "geen planning" en geen
  storing.

  Deze test legt beide helften vast, want samen zijn ze de regel.
*/
describe('wat de mailophaler doorstuurt', () => {
  const bijlage = (over = {}) => ({
    filename: 'Planning Overview.xlsx',
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    content: Buffer.alloc(15000),
    ...over,
  })

  it('stuurt een xlsx door', () => {
    expect(lijktOpPlanning(bijlage())).toBe(true)
  })

  // Op de naam filteren zou raden zijn: dan importeert de tool niets omdat
  // iemand het bestand anders genoemd heeft.
  it('kijkt niet naar hoe het bestand heet', () => {
    expect(lijktOpPlanning(bijlage({ filename: 'export (3).xlsx' }))).toBe(true)
    expect(lijktOpPlanning(bijlage({ filename: 'zonder-extensie' }))).toBe(true) // het type zegt het al
  })

  it('laat alles liggen wat geen spreadsheet is', () => {
    expect(lijktOpPlanning(bijlage({ filename: 'offerte.pdf', contentType: 'application/pdf' }))).toBe(false)
    expect(lijktOpPlanning(bijlage({ filename: 'foto.jpg', contentType: 'image/jpeg' }))).toBe(false)
  })

  it('laat een leeg of veel te groot bestand liggen', () => {
    expect(lijktOpPlanning(bijlage({ content: Buffer.alloc(0) }))).toBe(false)
    expect(lijktOpPlanning(bijlage({ content: { length: MAX_BYTES + 1 } }))).toBe(false)
    expect(lijktOpPlanning(null)).toBe(false)
  })
})

describe('wat de andere kant ervan maakt', () => {
  it('leest de echte export zonder morren', () => {
    const { shifts } = parseBlad(leesXlsx(readFileSync('tests/fixtures/planning-overview.xlsx')))
    expect(shifts).toHaveLength(43)
  })

  /*
    Een spreadsheet die geen planning is, hoort te stranden met een zin die
    zegt wát er ontbreekt. Dat is wat de wachtrij als "geen planning" noteert —
    geen storing, wel het antwoord op "waarom staat mijn planning er niet".
  */
  it('wijst een spreadsheet af die geen planning is, met een reden', () => {
    const anders = [{ A: 'Naam', B: 'Bedrag' }, { A: 'Iets', B: '12' }]
    expect(() => parseBlad(anders)).toThrow(ImportFout)
    expect(() => parseBlad(anders)).toThrow(/Location Name|Planning Id/)
  })

  it('wijst een bestand af dat helemaal geen xlsx is', () => {
    expect(() => leesXlsx(Buffer.from('dit is gewoon tekst'))).toThrow(/geldig xlsx/)
  })
})
