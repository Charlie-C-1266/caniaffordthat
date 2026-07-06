import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  fmt,
  num,
  monthsToSave,
  contributionForGoal,
  paymentForFinance,
  addMonths,
  isoFromMonths,
  monthsFromIso,
  monthYearFromMonths,
  monthsFromMonthYear,
  formatMonthYearDraft,
} from './calculations'

describe('num', () => {
  it('passes through positive finite numbers', () => {
    expect(num(150)).toBe(150)
    expect(num('150')).toBe(150)
  })

  it('floors zero, negative, and non-numeric input to 0', () => {
    expect(num(0)).toBe(0)
    expect(num(-50)).toBe(0)
    expect(num('')).toBe(0)
    expect(num('abc')).toBe(0)
    expect(num(Infinity)).toBe(0)
  })
})

describe('fmt', () => {
  it('formats as whole-pound GBP', () => {
    expect(fmt(1234)).toBe('£1,234')
    expect(fmt(0)).toBe('£0')
  })

  it('treats falsy input as £0', () => {
    expect(fmt(Number('not-a-number'))).toBe('£0')
  })
})

describe('monthsToSave', () => {
  it('is 0 when there is nothing to save for', () => {
    expect(monthsToSave(0, 100, 0)).toBe(0)
    expect(monthsToSave(-100, 100, 0)).toBe(0)
  })

  it('is Infinity when the contribution cannot make progress', () => {
    expect(monthsToSave(1000, 0, 0)).toBe(Infinity)
    expect(monthsToSave(1000, -10, 0)).toBe(Infinity)
  })

  it('reaches the target in the expected number of whole months at 0% interest', () => {
    // £100/mo needs exactly 12 months to reach £1200 with no interest.
    expect(monthsToSave(1200, 100, 0)).toBe(12)
  })

  it('reaches the target faster when interest is applied', () => {
    const noInterest = monthsToSave(5000, 100, 0)
    const withInterest = monthsToSave(5000, 100, 6)
    expect(withInterest).toBeLessThanOrEqual(noInterest)
  })

  it('caps out at "never" (Infinity) beyond 600 months', () => {
    expect(monthsToSave(1_000_000_000, 1, 0)).toBe(Infinity)
  })
})

describe('contributionForGoal', () => {
  it('is 0 when there is nothing to save for', () => {
    expect(contributionForGoal(0, 12, 5)).toBe(0)
  })

  it('divides evenly at 0% interest', () => {
    expect(contributionForGoal(1200, 12, 0)).toBeCloseTo(100, 6)
  })

  it('produces a contribution that actually reaches the target in n months when compounded', () => {
    const target = 5000
    const n = 24
    const rate = 4
    const contribution = contributionForGoal(target, n, rate)
    const i = rate / 100 / 12
    let bal = 0
    for (let month = 0; month < n; month++) {
      bal = bal * (1 + i) + contribution
    }
    expect(bal).toBeCloseTo(target, 4)
  })

  it('treats n < 1 the same as n = 1', () => {
    expect(contributionForGoal(1200, 0, 0)).toBe(contributionForGoal(1200, 1, 0))
  })
})

describe('paymentForFinance', () => {
  it('is 0 when there is nothing to finance', () => {
    expect(paymentForFinance(0, 12, 5)).toBe(0)
  })

  it('divides evenly at 0% interest', () => {
    expect(paymentForFinance(1200, 12, 0)).toBeCloseTo(100, 6)
  })

  it('produces a payment that fully amortizes the principal over n months when compounded', () => {
    const principal = 10_000
    const n = 36
    const rate = 9
    const payment = paymentForFinance(principal, n, rate)
    const i = rate / 100 / 12
    let bal = principal
    for (let month = 0; month < n; month++) {
      bal = bal * (1 + i) - payment
    }
    expect(bal).toBeCloseTo(0, 4)
  })
})

describe('date helpers (anchored to the real current date)', () => {
  beforeEach(() => {
    // Mid-month on purpose, to prove the helpers normalize to the 1st.
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 6, 15)) // 15 July 2026
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('addMonths(0) resolves to the current month/year', () => {
    expect(addMonths(0)).toBe('July 2026')
  })

  it('addMonths(n) rolls forward across year boundaries', () => {
    expect(addMonths(6)).toBe('January 2027')
  })

  it('isoFromMonths(0) resolves to the current YYYY-MM', () => {
    expect(isoFromMonths(0)).toBe('2026-07')
  })

  it('isoFromMonths and monthsFromIso round-trip for future months', () => {
    for (const n of [1, 6, 13, 24]) {
      expect(monthsFromIso(isoFromMonths(n))).toBe(n)
    }
  })

  it('monthsFromIso clamps to a minimum of 1 for the current or a past month', () => {
    expect(monthsFromIso('2026-07')).toBe(1)
    expect(monthsFromIso('2025-01')).toBe(1)
  })

  it('monthYearFromMonths(0) resolves to the current MM-YYYY', () => {
    expect(monthYearFromMonths(0)).toBe('07-2026')
  })

  it('monthYearFromMonths and monthsFromMonthYear round-trip for future months', () => {
    for (const n of [1, 6, 13, 24]) {
      expect(monthsFromMonthYear(monthYearFromMonths(n))).toBe(n)
    }
  })

  it('monthsFromMonthYear does not clamp — unlike monthsFromIso, it can return 0 or negative', () => {
    expect(monthsFromMonthYear('07-2026')).toBe(0)
    expect(monthsFromMonthYear('01-2025')).toBeLessThan(0)
  })

  it('monthsFromMonthYear returns null for anything that is not a fully valid MM-YYYY date', () => {
    expect(monthsFromMonthYear('')).toBeNull()
    expect(monthsFromMonthYear('08-202')).toBeNull()
    expect(monthsFromMonthYear('13-2026')).toBeNull()
    expect(monthsFromMonthYear('00-2026')).toBeNull()
    expect(monthsFromMonthYear('08')).toBeNull()
    expect(monthsFromMonthYear('not a date')).toBeNull()
  })
})

describe('formatMonthYearDraft', () => {
  it('keeps a single-digit month un-hyphenated', () => {
    expect(formatMonthYearDraft('')).toBe('')
    expect(formatMonthYearDraft('0')).toBe('0')
  })

  it('inserts the hyphen as soon as the two-digit month is complete', () => {
    expect(formatMonthYearDraft('08')).toBe('08-')
    expect(formatMonthYearDraft('083')).toBe('08-3')
    expect(formatMonthYearDraft('082026')).toBe('08-2026')
  })

  it('strips letters, spaces, and stray separators, keeping digit order', () => {
    expect(formatMonthYearDraft('08/2026')).toBe('08-2026')
    expect(formatMonthYearDraft('1a2/2027xy')).toBe('12-2027')
    expect(formatMonthYearDraft('not a date')).toBe('')
  })

  it('caps at six digits (MMYYYY), dropping any overflow', () => {
    expect(formatMonthYearDraft('12202699')).toBe('12-2026')
  })

  it('is idempotent on an already-formatted value', () => {
    expect(formatMonthYearDraft('08-2026')).toBe('08-2026')
  })
})
