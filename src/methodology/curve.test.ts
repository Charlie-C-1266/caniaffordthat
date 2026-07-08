import { describe, it, expect } from 'vitest'
import { retentionCurve } from './curve'
import { UK_AVERAGE_ANNUAL_MILES, retentionAt } from '../lib/vehicle'

describe('retentionCurve', () => {
  it('starts every profile at 100% of the as-new price', () => {
    for (const miles of [4000, UK_AVERAGE_ANNUAL_MILES, 16000]) {
      expect(retentionCurve(miles)[0]).toEqual({ ageYears: 0, retentionPct: 100 })
    }
  })

  it('matches the bare age curve exactly at average mileage (no excess miles to adjust for)', () => {
    for (const point of retentionCurve(UK_AVERAGE_ANNUAL_MILES)) {
      expect(point.retentionPct).toBeCloseTo(retentionAt(point.ageYears) * 100, 8)
    }
  })

  it('orders the profiles: more miles per year, less value retained at every age past new', () => {
    const low = retentionCurve(4000)
    const avg = retentionCurve(UK_AVERAGE_ANNUAL_MILES)
    const high = retentionCurve(16000)
    for (let i = 1; i < avg.length; i++) {
      expect(high[i].retentionPct).toBeLessThan(avg[i].retentionPct)
      expect(avg[i].retentionPct).toBeLessThan(low[i].retentionPct)
    }
  })

  it('spans the requested range at the requested resolution', () => {
    const points = retentionCurve(UK_AVERAGE_ANNUAL_MILES, 10, 0.5)
    expect(points).toHaveLength(21)
    expect(points.at(-1)?.ageYears).toBe(10)
  })

  it('only ever decreases with age (a used car never regains value on this curve)', () => {
    const points = retentionCurve(16000)
    for (let i = 1; i < points.length; i++) {
      expect(points[i].retentionPct).toBeLessThanOrEqual(points[i - 1].retentionPct)
    }
  })
})
