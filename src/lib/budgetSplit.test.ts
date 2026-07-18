import { describe, it, expect } from 'vitest'
import { budgetBreakdown } from './budgetSplit'
import { DEFAULT_STATE } from '../state/defaults'
import type { CalculatorState } from '../state/types'

function makeState(overrides: Partial<CalculatorState>): CalculatorState {
  return { ...DEFAULT_STATE, ...overrides }
}

describe('budgetBreakdown', () => {
  it('lists only the non-zero essentials, in canonical order', () => {
    const b = budgetBreakdown(makeState({ takeHome: '2000', housing: '800', groceries: '300' }), 200)
    expect(b.essentials.map((line) => line.key)).toEqual(['housing', 'groceries'])
    expect(b.essentialsTotal).toBe(1100)
  })

  it('splits take-home into essentials, new cost and leftover when it fits', () => {
    // £2,000 take-home, £1,100 essentials -> £900 spare; £200 new cost fits.
    const b = budgetBreakdown(makeState({ takeHome: '2000', housing: '800', groceries: '300' }), 200)
    expect(b.spareCash).toBe(900)
    expect(b.newCostWithin).toBe(200)
    expect(b.newCostOver).toBe(0)
    expect(b.leftover).toBe(700)
    expect(b.overBudget).toBe(false)
    // The arcs sum to the ring, and the ring is take-home when it fits.
    expect(b.ringTotal).toBe(2000)
    expect(b.essentialsTotal + b.newCostWithin + b.newCostOver + b.leftover).toBe(b.ringTotal)
  })

  it('splits the new cost into the part that fits and the overspend when it does not', () => {
    // £900 spare cash, £1,200 new cost -> £900 fits, £300 over, no leftover.
    const b = budgetBreakdown(makeState({ takeHome: '2000', housing: '800', groceries: '300' }), 1200)
    expect(b.spareCash).toBe(900)
    expect(b.newCostWithin).toBe(900)
    expect(b.newCostOver).toBe(300)
    expect(b.leftover).toBe(0)
    expect(b.overBudget).toBe(true)
    // Over budget: the ring grows past take-home to the total committed.
    expect(b.ringTotal).toBe(2300)
    expect(b.essentialsTotal + b.newCostWithin + b.newCostOver + b.leftover).toBe(b.ringTotal)
  })

  it('reports the new cost as a share of take-home pay', () => {
    const b = budgetBreakdown(makeState({ takeHome: '2000' }), 500)
    expect(b.shareOfTakeHome).toBeCloseTo(0.25, 6)
  })
})
