import { describe, expect, it } from 'vitest'
import { byPosition, moveItem, needsRebalance, positionFor, rebalance } from '../src/lib/position'

const card = (id, position) => ({ id, position })

describe('positionFor', () => {
  it('gives the first card of an empty column a positive position', () => {
    expect(positionFor([], 0)).toBeGreaterThan(0)
  })

  it('places a card before the first one', () => {
    const column = [card('a', 1024), card('b', 2048)]
    expect(positionFor(column, 0)).toBeLessThan(1024)
  })

  it('places a card after the last one', () => {
    const column = [card('a', 1024), card('b', 2048)]
    expect(positionFor(column, 2)).toBeGreaterThan(2048)
  })

  it('takes the midpoint between two neighbours', () => {
    const column = [card('a', 1000), card('b', 2000)]
    expect(positionFor(column, 1)).toBe(1500)
  })

  it('keeps the drop between its neighbours after many splits', () => {
    let column = [card('a', 0), card('b', 1024)]
    for (let i = 0; i < 20; i += 1) {
      const position = positionFor(column, 1)
      expect(position).toBeGreaterThan(column[0].position)
      expect(position).toBeLessThan(column[1].position)
      column = [column[0], card(`x${i}`, position), column[1]]
      column = [column[0], column[1]]
    }
  })
})

describe('needsRebalance', () => {
  it('is quiet while the gaps are healthy', () => {
    expect(needsRebalance([card('a', 1024), card('b', 2048)])).toBe(false)
  })

  it('fires once two cards are indistinguishable', () => {
    expect(needsRebalance([card('a', 1), card('b', 1 + 1e-9)])).toBe(true)
  })

  it('fires after enough repeated midpoint splits', () => {
    // Every drop into the same gap halves it; floats run out after ~50.
    let column = [card('a', 0), card('b', 1)]
    for (let i = 0; i < 60 && !needsRebalance(column); i += 1) {
      column = [column[0], card(`x${i}`, positionFor(column, 1))]
    }
    expect(needsRebalance(column)).toBe(true)
  })
})

describe('rebalance', () => {
  it('hands back evenly spaced, strictly increasing positions', () => {
    const fixed = rebalance([card('a', 1), card('b', 1.0000001), card('c', 1.0000002)])
    expect(fixed.map((f) => f.id)).toEqual(['a', 'b', 'c'])
    expect(fixed[0].position).toBeLessThan(fixed[1].position)
    expect(fixed[1].position).toBeLessThan(fixed[2].position)
    expect(needsRebalance(fixed)).toBe(false)
  })
})

describe('byPosition', () => {
  it('sorts by position and breaks ties on id so the order never flickers', () => {
    const sorted = [card('b', 5), card('a', 5), card('c', 1)].sort(byPosition)
    expect(sorted.map((c) => c.id)).toEqual(['c', 'a', 'b'])
  })
})

describe('moveItem', () => {
  it('moves a card down the column', () => {
    const items = [card('a', 1), card('b', 2), card('c', 3)]
    expect(moveItem(items, 'a', 2).map((i) => i.id)).toEqual(['b', 'c', 'a'])
  })

  it('leaves an unknown id alone', () => {
    const items = [card('a', 1)]
    expect(moveItem(items, 'zz', 0)).toBe(items)
  })
})
