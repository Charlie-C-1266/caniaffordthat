import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { deriveResult, spareCashOf } from './derive'
import { DEFAULT_STATE } from '../state/defaults'
import type { CalculatorState } from '../state/types'

function makeState(overrides: Partial<CalculatorState>): CalculatorState {
  return { ...DEFAULT_STATE, ...overrides }
}

describe('spareCashOf', () => {
  it('is take-home minus the five outgoings, floored at 0', () => {
    expect(spareCashOf(makeState({ takeHome: '2000' }))).toBe(2000) // outgoings default to '0'
    expect(spareCashOf(makeState({ takeHome: '2000', housing: '500', groceries: '300' }))).toBe(1200)
    expect(spareCashOf(makeState({ takeHome: '500', housing: '900' }))).toBe(0) // never negative
  })
})

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
      expect(result?.verdictText).toBe("Yes — it's within reach.")
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
      expect(result?.verdictText).toBe("No — that's a stretch.")
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

    it('tiers the "fits" copy by how much of spare cash the contribution uses', () => {
      // £100 contribution / £2000 spare cash = 5% -> comfortable
      const comfortable = deriveResult(
        makeState({ mode: 'save', saveFlavor: 'goal', itemPrice: '1200', takeHome: '2000', goalMonths: 12 }),
      )
      expect(comfortable?.verdictSub).toMatch(/comfortably/)

      // £500 / £1000 = 50% -> a "good chunk", not comfortable, not tight
      const moderate = deriveResult(
        makeState({ mode: 'save', saveFlavor: 'goal', itemPrice: '6000', takeHome: '1000', goalMonths: 12 }),
      )
      expect(moderate?.isAffordable).toBe(true)
      expect(moderate?.verdictSub).toMatch(/good chunk/)
      expect(moderate?.verdictSub).not.toMatch(/comfortably|tight/)

      // £900 / £1000 = 90% -> tight
      const tight = deriveResult(
        makeState({ mode: 'save', saveFlavor: 'goal', itemPrice: '10800', takeHome: '1000', goalMonths: 12 }),
      )
      expect(tight?.isAffordable).toBe(true)
      expect(tight?.verdictSub).toMatch(/tight/)
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

  describe('emergency fund', () => {
    it('derives the target from cover months x essential spend, ignoring itemPrice', () => {
      // Essentials = 500 + 100 + 200 + 100 + 100 = 1000; 6 months cover -> 6000 target.
      const result = deriveResult(
        makeState({
          goalId: 'emergency',
          mode: 'save',
          saveFlavor: 'duration',
          itemPrice: '',
          takeHome: '3000',
          housing: '500',
          utilities: '100',
          groceries: '200',
          transport: '100',
          debts: '100',
          coverMonths: 6,
          rate: 100,
        }),
      )
      expect(result).not.toBeNull()
      expect(result?.grossTarget).toBe(6000)
      // spareCash = 3000 - 1000 = 2000; 100% rate -> 2000/mo; 6000/2000 = 3 months.
      expect(result?.spareCash).toBe(2000)
      expect(result?.months).toBe(3)
      expect(result?.isAffordable).toBe(true)
    })

    it('subtracts money already set aside from the target', () => {
      const result = deriveResult(
        makeState({
          goalId: 'emergency',
          mode: 'save',
          saveFlavor: 'duration',
          takeHome: '3000',
          housing: '1000',
          coverMonths: 6,
          savings: '2000',
        }),
      )
      // grossTarget = 6 x 1000 = 6000; target = 6000 - 2000 = 4000.
      expect(result?.grossTarget).toBe(6000)
      expect(result?.target).toBe(4000)
    })

    it('returns null when essentials are all zero, since there is no target to derive', () => {
      const result = deriveResult(
        makeState({ goalId: 'emergency', mode: 'save', itemPrice: '', takeHome: '3000', coverMonths: 6 }),
      )
      expect(result).toBeNull()
    })

    it('frames the result as building a cushion kept in easy-access savings', () => {
      const result = deriveResult(
        makeState({
          goalId: 'emergency',
          mode: 'save',
          saveFlavor: 'duration',
          takeHome: '3000',
          housing: '1000',
          coverMonths: 3,
          rate: 100,
        }),
      )
      expect(result?.resultEyebrow).toBe('Time to build your fund')
      expect(result?.verdictText).toBe('Yes — you can build this.')
      expect(result?.subheadline).toMatch(/cushion/)
      expect(result?.subheadline).toMatch(/easy-access/)
    })

    it('suggests a 1-month milestone when the full fund is a long way off', () => {
      // essentials 1000 -> 3-month target 3000; spareCash 10 -> ~300 months (over the 60-month cap).
      const result = deriveResult(
        makeState({
          goalId: 'emergency',
          mode: 'save',
          saveFlavor: 'duration',
          takeHome: '1010',
          housing: '1000',
          coverMonths: 3,
          rate: 100,
        }),
      )
      expect(result?.isAffordable).toBe(false)
      expect(result?.verdictText).toBe('This one will take time.')
      expect(result?.verdictSub).toMatch(/1-month cushion/)
      expect(result?.verdictSub).toMatch(/£1,000/)
    })

    it('honours a goal date: sizes the monthly saving to hit the cushion by then', () => {
      // grossTarget = 3 x 1000 = 3000; goal date 6 months out, 0% interest ->
      // £500/mo needed. spareCash = 3000 - 1000 = 2000, so it fits.
      const result = deriveResult(
        makeState({
          goalId: 'emergency',
          mode: 'save',
          saveFlavor: 'goal',
          takeHome: '3000',
          housing: '1000',
          coverMonths: 3,
          goalMonths: 6,
          growth: 0,
        }),
      )
      expect(result?.months).toBe(6)
      expect(result?.contribution).toBe(500)
      expect(result?.resultEyebrow).toBe('Monthly saving needed')
      expect(result?.headline).toBe('£500/mo')
      expect(result?.isAffordable).toBe(true)
      expect(result?.verdictText).toBe('Yes — you can build this.')
      expect(result?.subheadline).toMatch(/easy-access/)
    })

    it('flags a goal date that needs more per month than the spare cash allows', () => {
      // grossTarget 3000 over 2 months -> £1,500/mo needed, but spare cash is
      // only 3000 - 1000 = 2000... still fits. Push essentials up so it doesn't:
      // spareCash = 1600 - 1000 = 600; 3000 over 2 months -> £1,500/mo.
      const result = deriveResult(
        makeState({
          goalId: 'emergency',
          mode: 'save',
          saveFlavor: 'goal',
          takeHome: '1600',
          housing: '1000',
          coverMonths: 3,
          goalMonths: 2,
          growth: 0,
        }),
      )
      expect(result?.contribution).toBe(1500)
      expect(result?.fits).toBe(false)
      expect(result?.isAffordable).toBe(false)
      expect(result?.verdictText).toBe('Not by that date.')
      expect(result?.verdictSub).toMatch(/more than your spare cash/)
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
