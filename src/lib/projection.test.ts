import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { CHART_MONTHS_CAP, financeProjection, savingProjection } from './projection'

describe('projection', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 6, 15)) // 15 July 2026
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  describe('savingProjection', () => {
    it('starts at £0 now and climbs to the target by the final month', () => {
      // £250/mo, 0% growth, reaches £1,000 in 4 months.
      const p = savingProjection(1000, 250, 0, 4)
      expect(p.kind).toBe('save')
      expect(p.points).toHaveLength(5) // month 0..4 inclusive
      expect(p.points[0]).toMatchObject({ month: 0, value: 0, heightPct: 0 })
      expect(p.points.at(-1)?.value).toBe(1000)
      expect(p.points.at(-1)?.heightPct).toBe(100)
      expect(p.bars).toHaveLength(4) // months 1..4, excludes "now"
    })

    it('caps the balance at the target rather than overshooting', () => {
      // £300/mo would pass £1,000 at month 4 (£1,200); value is held at the target.
      const p = savingProjection(1000, 300, 0, 4)
      expect(p.points.at(-1)?.value).toBe(1000)
    })

    it('truncates and flags overflow past the chart cap', () => {
      const p = savingProjection(100000, 100, 0, 400)
      expect(p.bars).toHaveLength(CHART_MONTHS_CAP)
      expect(p.hasOverflow).toBe(true)
      expect(p.endLabel).toMatch(/\+$/)
    })

    it('dates each point from the current month', () => {
      const p = savingProjection(1000, 500, 0, 2)
      expect(p.points[0].dateLabel).toBe('July 2026')
      expect(p.points[1].dateLabel).toBe('August 2026')
      expect(p.points[2].dateLabel).toBe('September 2026')
    })
  })

  describe('financeProjection', () => {
    it('climbs the amount repaid from £0 to the full principal by term end', () => {
      // £100/mo, 0% APR fully repays £1,200 over 12 months.
      const p = financeProjection(1200, 100, 0, 12)
      expect(p.kind).toBe('finance')
      expect(p.target).toBe(1200)
      expect(p.points[0]).toMatchObject({ month: 0, value: 0 })
      expect(p.points.at(-1)?.value).toBe(1200)
      expect(p.points.at(-1)?.heightPct).toBe(100)
    })

    it('tops out below 100% when a payment leaves a balloon owed (PCP)', () => {
      // £500/mo repays only £12,000 of a £20,000 balance over 24 months — the
      // rest is the balloon, so the repaid series tops out at 60%.
      const p = financeProjection(20000, 500, 0, 24)
      expect(p.bars.at(-1)?.heightPct).toBe(60)
      expect(p.points.at(-1)?.value).toBe(12000)
    })
  })
})
