import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { deriveResult } from './derive'
import { DEFAULT_STATE } from '../state/defaults'
import type { CalculatorState } from '../state/types'

function makeState(overrides: Partial<CalculatorState>): CalculatorState {
  return { ...DEFAULT_STATE, ...overrides }
}

describe('deriveResult', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 6, 15)) // 15 July 2026
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns null until both item price and take-home are filled in', () => {
    expect(deriveResult(makeState({ itemPrice: '', takeHome: '2000' }))).toBeNull()
    expect(deriveResult(makeState({ itemPrice: '500', takeHome: '' }))).toBeNull()
    expect(deriveResult(makeState({ itemPrice: '0', takeHome: '2000' }))).toBeNull()
  })

  describe('saving up — duration flavor', () => {
    it('is affordable within the 60-month cap', () => {
      // £2000 take-home, no outgoings -> £2000 spare cash; 25% rate -> £500/mo.
      // Target £2000, so 4 months to save it.
      const result = deriveResult(
        makeState({ mode: 'save', saveFlavor: 'duration', itemPrice: '2000', takeHome: '2000', rate: 25 }),
      )
      expect(result).not.toBeNull()
      expect(result?.isFeasible).toBe(true)
      expect(result?.isAffordable).toBe(true)
      expect(result?.months).toBe(4)
      expect(result?.verdictText).toBe('This is affordable')
    })

    it('is not affordable when the contribution is 0 (rate rounds down to nothing)', () => {
      const result = deriveResult(
        makeState({
          mode: 'save',
          saveFlavor: 'duration',
          itemPrice: '1000',
          takeHome: '0.5',
          housing: '0.5',
          rate: 25,
        }),
      )
      // spareCash = max(0, 0.5 - 0.5) = 0 -> contribution = 0 -> Infinity months
      expect(result?.isFeasible).toBe(false)
      expect(result?.isAffordable).toBe(false)
      expect(result?.verdictText).toBe('Not quite affordable yet')
      expect(result?.verdictSub).toMatch(/increase how much you save/i)
    })

    it('is not affordable when feasible but the timeline exceeds 60 months', () => {
      // £200 spare cash, 50% rate -> £100/mo; £10,000 target -> exactly 100
      // months: feasible (well under the 600-month cap) but over the 60-month
      // affordability threshold.
      const result = deriveResult(
        makeState({ mode: 'save', saveFlavor: 'duration', itemPrice: '10000', takeHome: '200', rate: 50 }),
      )
      expect(result?.isFeasible).toBe(true)
      expect(result?.months).toBe(100)
      expect(result?.isAffordable).toBe(false)
      expect(result?.verdictSub).toMatch(/over 5 years/i)
    })
  })

  describe('saving up — goal-date flavor', () => {
    it('is affordable when the required contribution fits spare cash', () => {
      const result = deriveResult(
        makeState({ mode: 'save', saveFlavor: 'goal', itemPrice: '1200', takeHome: '2000', goalMonths: 12 }),
      )
      expect(result?.isFeasible).toBe(true)
      expect(result?.contribution).toBeCloseTo(100, 6)
      expect(result?.isAffordable).toBe(true)
      expect(result?.fits).toBe(true)
    })

    it('is not affordable when the required contribution exceeds spare cash', () => {
      const result = deriveResult(
        makeState({ mode: 'save', saveFlavor: 'goal', itemPrice: '12000', takeHome: '500', goalMonths: 12 }),
      )
      expect(result?.fits).toBe(false)
      expect(result?.isAffordable).toBe(false)
      expect(result?.verdictSub).toMatch(/more than your spare cash/)
    })
  })

  describe('paying monthly (finance)', () => {
    it('computes total cost and interest paid, and is affordable when it fits', () => {
      const result = deriveResult(
        makeState({ mode: 'monthly', itemPrice: '1200', takeHome: '2000', term: 12, growth: 0 }),
      )
      expect(result?.contribution).toBeCloseTo(100, 6)
      expect(result?.totalCost).toBeCloseTo(1200, 6)
      expect(result?.interestPaid).toBeCloseTo(0, 6)
      expect(result?.isAffordable).toBe(true)
      expect(result?.contributionRowLabel).toBe('MONTHLY PAYMENT')
      expect(result?.targetRowLabel).toBe('AMOUNT TO FINANCE')
    })

    it('is not affordable when the payment exceeds spare cash', () => {
      const result = deriveResult(makeState({ mode: 'monthly', itemPrice: '12000', takeHome: '500', term: 12 }))
      expect(result?.fits).toBe(false)
      expect(result?.isAffordable).toBe(false)
    })
  })

  describe('chart bars', () => {
    it('caps at 24 bars and flags overflow for longer timelines', () => {
      const result = deriveResult(makeState({ mode: 'monthly', itemPrice: '12000', takeHome: '5000', term: 36 }))
      expect(result?.chartBars).toHaveLength(24)
      expect(result?.hasOverflowMonths).toBe(true)
      expect(result?.chartEndLabel).toMatch(/\+$/)
    })

    it('does not flag overflow for timelines at or under 24 months', () => {
      const result = deriveResult(makeState({ mode: 'monthly', itemPrice: '1200', takeHome: '2000', term: 12 }))
      expect(result?.chartBars).toHaveLength(12)
      expect(result?.hasOverflowMonths).toBe(false)
    })

    it('marks only the last bar as the "current" color', () => {
      const result = deriveResult(makeState({ mode: 'monthly', itemPrice: '1200', takeHome: '2000', term: 6 }))
      const bars = result?.chartBars ?? []
      expect(bars.slice(0, -1).every((bar) => bar.color === 'var(--result-bar-past)')).toBe(true)
      expect(bars.at(-1)?.color).toBe('var(--result-bar-current)')
    })
  })
})
