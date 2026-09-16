import { describe, it, expect } from 'vitest'
import { salaryFlip } from './reverse'
import { grossFromNet, marginalNetRate, netFromGross } from './salary'

describe('salaryFlip', () => {
  it('reports the gross behind the required take-home and the gap to current pay', () => {
    // Needs £3,000/mo take-home; currently earns £2,000/mo take-home.
    const flip = salaryFlip(3000, 2000)
    expect(flip.requiredTakeHomeAnnual).toBe(36000)
    expect(flip.requiredGross).toBeCloseTo(grossFromNet(36000), 0)
    expect(flip.currentGross).toBeCloseTo(grossFromNet(24000), 0)
    expect(flip.grossGap).toBeCloseTo(flip.requiredGross - flip.currentGross, 6)
    expect(flip.grossGap).toBeGreaterThan(0)
    expect(flip.alreadyEnough).toBe(false)
    expect(flip.takeHomeMonthlyGap).toBe(1000)
  })

  it('marks the plan as already affordable when current pay exceeds the requirement', () => {
    const flip = salaryFlip(1500, 4000)
    expect(flip.alreadyEnough).toBe(true)
    expect(flip.grossGap).toBeLessThan(0)
    expect(flip.vsMedian).toBe('below') // ~£20k gross is below the ONS median
  })

  it('places a big requirement above the UK median', () => {
    const flip = salaryFlip(5000, 2000)
    expect(flip.vsMedian).toBe('above')
  })

  it('surfaces the marginal cost inside the £100k allowance-taper band', () => {
    // A take-home that inverts to ~£110k gross, squarely in the taper band.
    const monthly = netFromGross(110000) / 12
    const flip = salaryFlip(monthly, 2000)
    expect(flip.requiredGross).toBeCloseTo(110000, 0)
    expect(flip.inTaperBand).toBe(true)
    // ~38p kept per extra £1 gross → ~£2.63 of salary per £1 of take-home.
    expect(flip.salaryPerTakeHome).toBeGreaterThan(2.5)
    expect(flip.salaryPerTakeHome).toBeLessThan(2.75)
  })

  it('documents that the marginal <= 0 fallback in salaryPerTakeHome is unreachable with the current tax tables', () => {
    // salaryFlip guards `salaryPerTakeHome` with `marginal > 0 ? 1 / marginal : 0`,
    // purely defensively: under the current UK bands the *worst* combined
    // marginal deduction is 62% (40% higher rate + an implicit 20% from the
    // £100k allowance taper + 2% NI), so the kept fraction never falls below
    // ~0.38 — and can never reach 0 — at any gross. Sweep every band boundary
    // (±£1) plus points inside each band to pin that down; if a future tax
    // table ever pushes a marginal rate to 100%+, this test is the tripwire.
    const grosses = [
      0, 1, 5000, 12569, 12570, 12571, 30000, 50269, 50270, 50271, 75000, 99999, 100000, 100001, 110000, 125139, 125140, 125141, 200000,
      1000000,
    ]
    for (const gross of grosses) {
      expect(marginalNetRate(gross), `marginal net rate at gross £${gross}`).toBeGreaterThan(0)
    }
    // And so salaryFlip always reports a real, positive £-of-salary figure —
    // including at the degenerate gross of £0 (required take-home of £0).
    for (const flip of [salaryFlip(0, 0), salaryFlip(100, 0), salaryFlip(12000, 3000)]) {
      expect(flip.salaryPerTakeHome).toBeGreaterThan(0)
      expect(Number.isFinite(flip.salaryPerTakeHome)).toBe(true)
    }
  })
})
