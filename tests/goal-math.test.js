import { describe, expect, it } from 'vitest'
import { goalProgress, keyResultProgress } from '../src/lib/goal-math'

describe('keyResultProgress', () => {
  it('measures from the starting point, not from zero', () => {
    expect(keyResultProgress({ startValue: 100, targetValue: 200, currentValue: 150 })).toBe(0.5)
  })

  it('clamps below zero and above one', () => {
    expect(keyResultProgress({ startValue: 0, targetValue: 10, currentValue: -5 })).toBe(0)
    expect(keyResultProgress({ startValue: 0, targetValue: 10, currentValue: 50 })).toBe(1)
  })

  it('handles a target that is lower than the start', () => {
    // "Bring no-shows down from 20 to 5" — halfway is 12.5.
    expect(keyResultProgress({ startValue: 20, targetValue: 5, currentValue: 12.5 })).toBe(0.5)
  })

  it('treats a yes/no result as done or not done', () => {
    expect(keyResultProgress({ kind: 'boolean', currentValue: 1 })).toBe(1)
    expect(keyResultProgress({ kind: 'boolean', currentValue: 0 })).toBe(0)
  })

  it('does not divide by zero when start equals target', () => {
    expect(keyResultProgress({ startValue: 5, targetValue: 5, currentValue: 5 })).toBe(1)
    expect(keyResultProgress({ startValue: 5, targetValue: 5, currentValue: 4 })).toBe(0)
  })

  it('is zero for nothing at all', () => {
    expect(keyResultProgress(null)).toBe(0)
  })
})

describe('goalProgress', () => {
  it('averages its key results', () => {
    const goal = {
      keyResults: [
        { startValue: 0, targetValue: 10, currentValue: 10 },
        { startValue: 0, targetValue: 10, currentValue: 0 },
      ],
    }
    expect(goalProgress(goal)).toBe(0.5)
  })

  it('is zero for a goal without results instead of NaN', () => {
    expect(goalProgress({ keyResults: [] })).toBe(0)
    expect(goalProgress(undefined)).toBe(0)
  })
})
