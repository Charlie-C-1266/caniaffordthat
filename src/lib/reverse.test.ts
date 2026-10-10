import { describe, it, expect } from 'vitest'
import { salaryFlip } from './reverse'
import { grossFromNet, marginalNetRate, netFromGross } from './salary'
import { CURRENT_TAX_YEAR } from './taxYears'
import type { TaxYear } from './taxYears'

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

  it('calls a requirement within ±5% of the ONS median "about" the median', () => {
    // A plan whose required take-home inverts to exactly the median full-time
    // gross — ratio 1.0, squarely inside the [0.95, 1.05] "about" band.
    const median = CURRENT_TAX_YEAR.medianFullTimeSalary
    const monthly = netFromGross(median) / 12
    const flip = salaryFlip(monthly, 2000)
    expect(flip.requiredGross).toBeCloseTo(median, 0)
    expect(flip.medianFullTimeSalary).toBe(median)
    expect(flip.vsMedian).toBe('about')

    // ±4% either side still reads 'about', so the test doesn't rest on the
    // exact median.
    for (const factor of [0.96, 1.04]) {
      const edge = salaryFlip(netFromGross(median * factor) / 12, 2000)
      expect(edge.vsMedian, `gross at ${factor}× the median`).toBe('about')
    }
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

  // The 0.95 / 1.05 cut-offs themselves, either side. The band is open at
  // both ends (`ratio > 1.05` / `ratio < 0.95`), so the boundary values
  // themselves read 'about' and only a hair past them flips the verdict.
  it('puts the vsMedian boundaries on the "about" side and flips just past them', () => {
    const median = CURRENT_TAX_YEAR.medianFullTimeSalary
    const atRatio = (factor: number) => salaryFlip(netFromGross(median * factor) / 12, 2000).vsMedian

    expect(atRatio(0.95), 'exactly 0.95× the median').toBe('about')
    expect(atRatio(1.05), 'exactly 1.05× the median').toBe('about')
    expect(atRatio(0.93), 'below the lower cut-off').toBe('below')
    expect(atRatio(1.07), 'above the upper cut-off').toBe('above')
  })

  it('treats an exactly zero gap as already enough', () => {
    // alreadyEnough is `grossGap <= 0`, so the boundary belongs to "enough":
    // someone earning precisely the required figure can afford the plan.
    const monthly = netFromGross(45000) / 12
    const flip = salaryFlip(monthly, monthly)

    expect(flip.grossGap).toBeCloseTo(0, 6)
    expect(flip.alreadyEnough).toBe(true)
    expect(flip.takeHomeMonthlyGap).toBeCloseTo(0, 6)
  })

  it('floors a negative current take-home at zero rather than inverting it', () => {
    // currentTakeHomeMonthly is clamped with Math.max(0, …), so a nonsense
    // negative figure reads as "earns nothing", not as negative gross.
    const flip = salaryFlip(2000, -500)

    expect(flip.currentGross).toBe(0)
    expect(flip.grossGap).toBe(flip.requiredGross)
    expect(flip.alreadyEnough).toBe(false)
    expect(Number.isFinite(flip.grossGap)).toBe(true)
  })

  // The other side of the band sweep above: the sweep proves the fallback is
  // unreachable with *today's* table, and this proves the fallback itself
  // behaves if a future table ever reaches it. `year` is a parameter for
  // exactly this reason, matching every function in ./salary.
  it('falls back to 0 salaryPerTakeHome under a table with no take-home to gain', () => {
    // A 100% flat rate: every extra £1 of gross is taken, so the marginal
    // kept fraction is 0 and 1 / marginal would be Infinity.
    const confiscatory: TaxYear = {
      id: 'test-100',
      label: '100% flat (test only)',
      personalAllowance: 0,
      taperThreshold: Infinity,
      taperRate: 0,
      incomeTaxBands: [{ upTo: Infinity, rate: 1 }],
      niBands: [{ upTo: Infinity, rate: 0 }],
      medianFullTimeSalary: 30000,
    }

    expect(marginalNetRate(100000, confiscatory)).toBe(0)

    const flip = salaryFlip(2000, 1000, confiscatory)

    expect(flip.salaryPerTakeHome).toBe(0)
    // And nothing downstream becomes Infinity or NaN.
    expect(Number.isFinite(flip.salaryPerTakeHome)).toBe(true)
    expect(Number.isFinite(flip.requiredGross)).toBe(true)
    expect(Number.isFinite(flip.grossGap)).toBe(true)
    expect(Number.isNaN(flip.requiredGross)).toBe(false)
  })

  it('uses the current tax year when no table is passed', () => {
    expect(salaryFlip(2000, 1000)).toEqual(salaryFlip(2000, 1000, CURRENT_TAX_YEAR))
  })
})
