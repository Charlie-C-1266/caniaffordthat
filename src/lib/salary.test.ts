import { describe, it, expect } from 'vitest'
import {
  netFromGross,
  grossFromNet,
  salariesForTakeHome,
  incomeTaxOn,
  nationalInsuranceOn,
  marginalNetRate,
  inAllowanceTaper,
  monthlyTakeHomeFromGross,
} from './salary'
import { CURRENT_TAX_YEAR, type TaxYear } from './taxYears'
import * as taxYearsModule from './taxYears'
import { STEEP_TAPER_TAX_YEAR } from '../test/taxYearFixtures'

// Golden figures hand-computed from the 2026/27 rest-of-UK rules in taxYears.ts
// (PA £12,570 tapering over £100k; tax 20/40/45 at £50,270/£125,140; NI 8/2 at
// £12,570/£50,270) and cross-checked against reputable salary calculators.
describe('netFromGross', () => {
  it('takes nothing below the personal allowance / NI threshold', () => {
    expect(netFromGross(12570)).toBeCloseTo(12570, 2)
    expect(netFromGross(10000)).toBeCloseTo(10000, 2)
  })

  it('matches known take-home figures across the bands', () => {
    // £30k: tax (17,430 × 20%) = 3,486; NI (17,430 × 8%) = 1,394.40.
    expect(netFromGross(30000)).toBeCloseTo(25119.6, 2)
    // £50k: tax (37,430 × 20%) = 7,486; NI (37,430 × 8%) = 2,994.40.
    expect(netFromGross(50000)).toBeCloseTo(39519.6, 2)
    // £100k: tax 27,432; NI 4,010.60.
    expect(netFromGross(100000)).toBeCloseTo(68557.4, 2)
    // £150k: tax 53,703; NI 5,010.60.
    expect(netFromGross(150000)).toBeCloseTo(91286.4, 2)
  })

  it('applies the £100k personal-allowance taper', () => {
    // £120k: allowance tapered to £2,570; tax 39,432; NI 4,410.60.
    expect(incomeTaxOn(120000)).toBeCloseTo(39432, 2)
    expect(nationalInsuranceOn(120000)).toBeCloseTo(4410.6, 2)
    expect(netFromGross(120000)).toBeCloseTo(76157.4, 2)
  })
})

describe('grossFromNet', () => {
  it('inverts netFromGross to within a penny across the bands', () => {
    for (const gross of [15000, 25000, 50270, 60000, 100000, 110000, 125140, 150000, 200000]) {
      expect(grossFromNet(netFromGross(gross))).toBeCloseTo(gross, 0)
    }
  })

  it('returns 0 for a non-positive take-home', () => {
    expect(grossFromNet(0)).toBe(0)
    expect(grossFromNet(-100)).toBe(0)
  })

  // The defensive ceiling-growth loop on the open-ended stretch past the last
  // threshold. Its ceiling starts net * 2 + 200000 beyond that threshold,
  // which brackets any target under the real UK table (gross is never more
  // than ~1.9x net), so the loop body never runs with the shipped figures. A
  // table with a punitive rate does need it, and without the loop the search
  // would return the un-bracketing ceiling and understate the gross badly.
  // This table has no thresholds at all, so that stretch starts at £0.
  it('grows its ceiling until it brackets the target under a punitive table', () => {
    // 99% flat rate, no allowance: gross is 100x net, far outside the
    // starting bracket for any meaningful target.
    const punitive: TaxYear = {
      id: 'test-99',
      label: '99% flat (test only)',
      personalAllowance: 0,
      taperThreshold: Infinity,
      taperRate: 0,
      incomeTaxBands: [{ upTo: Infinity, rate: 0.99 }],
      niBands: [{ upTo: Infinity, rate: 0 }],
      medianFullTimeSalary: 30000,
    }

    // Sanity-check the premise: the starting ceiling really is too low here,
    // so this exercises the loop rather than passing vacuously.
    const target = 50000
    const startingCeiling = target * 2 + 200000
    expect(netFromGross(startingCeiling, punitive)).toBeLessThan(target)

    const gross = grossFromNet(target, punitive)
    expect(gross).toBeCloseTo(target * 100, 0)
    expect(netFromGross(gross, punitive)).toBeCloseTo(target, 0)
  })

  it('terminates with a finite answer even when no gross can reach the target', () => {
    // 100% flat: take-home is 0 at every gross, so the ceiling can never
    // bracket the target and the loop runs to its 64-iteration guard. The
    // guard is what stops this looping forever or returning Infinity/NaN.
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

    const gross = grossFromNet(1000, confiscatory)
    expect(Number.isFinite(gross)).toBe(true)
    expect(Number.isNaN(gross)).toBe(false)
    expect(gross).toBeGreaterThan(0)
  })
})

/**
 * How many times take-home crosses `net` between £0 and £300,000, counted by
 * stepping £5 at a time: slow and blunt, but it can't skip a threshold it
 * doesn't know about, which is the one way the real search could go wrong.
 */
function crossingsByScan(net: number, year: TaxYear): number {
  let crossings = 0
  let previous = netFromGross(0, year) - net
  for (let gross = 5; gross <= 300000; gross += 5) {
    const current = netFromGross(gross, year) - net
    if (current === 0 || (previous !== 0 && previous < 0 !== current < 0)) crossings++
    previous = current
  }
  return crossings
}

describe('salariesForTakeHome', () => {
  it('finds exactly one salary for every take-home under the current table', () => {
    // Take-home rises with gross under today's figures, so a take-home names
    // one salary, and it is the one grossFromNet returns.
    for (const gross of [5000, 12570, 30000, 50270, 75000, 100000, 110000, 125140, 200000]) {
      const net = netFromGross(gross)
      const salaries = salariesForTakeHome(net)
      expect(salaries, `the take-home £${gross} earns`).toHaveLength(1)
      expect(salaries[0]).toBeCloseTo(gross, 0)
      expect(salaries[0]).toBe(grossFromNet(net))
    }
  })

  it('reaches a non-positive take-home at £0', () => {
    expect(salariesForTakeHome(0)).toEqual([0])
    expect(salariesForTakeHome(-100)).toEqual([0])
  })

  it('finds all three salaries behind a take-home where the curve turns over', () => {
    // £57,500 sits between the £56,331.05 trough and the £58,656.50 peak: it
    // is reached rising before £100,000, falling inside the taper, and rising
    // again once the allowance has gone.
    const salaries = salariesForTakeHome(57500, STEEP_TAPER_TAX_YEAR)
    expect(salaries.map(Math.round)).toEqual([97818, 103126, 108491])
    for (const gross of salaries) expect(netFromGross(gross, STEEP_TAPER_TAX_YEAR)).toBeCloseTo(57500, 2)
    expect(grossFromNet(57500, STEEP_TAPER_TAX_YEAR)).toBe(salaries[0])
  })

  it('finds every crossing a £5 scan finds, including around a band edge inside the taper', () => {
    // The 70% band ends at £100,000 of *taxable* income, which the taper
    // moves to £108,380 of gross. Take-home falls from £100,000 to there and
    // rises after, so if the search missed that slope change it would miss a
    // salary on one side of it.
    const bandInTaper: TaxYear = {
      id: 'test-band-in-taper',
      label: 'band edge inside the taper (test only)',
      personalAllowance: 12570,
      taperThreshold: 100000,
      taperRate: 0.5,
      incomeTaxBands: [
        { upTo: 37700, rate: 0.2 },
        { upTo: 100000, rate: 0.7 },
        { upTo: Infinity, rate: 0.3 },
      ],
      niBands: [
        { upTo: 12570, rate: 0 },
        { upTo: 50270, rate: 0.08 },
        { upTo: Infinity, rate: 0.02 },
      ],
      medianFullTimeSalary: 30000,
    }
    expect(netFromGross(108380, bandInTaper)).toBeLessThan(netFromGross(100000, bandInTaper))
    expect(salariesForTakeHome(53300, bandInTaper)).toHaveLength(3)

    for (const [year, targets] of [
      [bandInTaper, [30000, 53300, 53600, 60000]],
      [STEEP_TAPER_TAX_YEAR, [50000, 56500, 57500, 58000, 60000]],
    ] as const) {
      for (const net of targets) {
        expect(salariesForTakeHome(net, year), `${year.label}, take-home £${net}`).toHaveLength(crossingsByScan(net, year))
      }
    }
  })
})

describe('monthlyTakeHomeFromGross', () => {
  it('converts an annual gross salary to monthly take-home', () => {
    // £40k: tax £5,486 + NI £2,194.40 -> £32,319.60/yr -> £2,693.30/month.
    expect(monthlyTakeHomeFromGross(40000)).toBeCloseTo(2693.3, 2)
    expect(monthlyTakeHomeFromGross(50000)).toBeCloseTo(39519.6 / 12, 2)
  })

  it('is 0 for a non-positive salary', () => {
    expect(monthlyTakeHomeFromGross(0)).toBe(0)
    expect(monthlyTakeHomeFromGross(-5000)).toBe(0)
  })
})

describe('marginalNetRate & taper band', () => {
  it('keeps 72p in the basic band, 58p in the higher band, 38p in the £100k taper', () => {
    expect(marginalNetRate(30000)).toBeCloseTo(0.72, 6) // 1 − 20% − 8%
    expect(marginalNetRate(60000)).toBeCloseTo(0.58, 6) // 1 − 40% − 2%
    expect(marginalNetRate(110000)).toBeCloseTo(0.38, 6) // 1 − 60% (taper) − 2%
  })

  it('flags the £100k–£125,140 taper band', () => {
    expect(inAllowanceTaper(90000)).toBe(false)
    expect(inAllowanceTaper(110000)).toBe(true)
    expect(inAllowanceTaper(130000)).toBe(false)
  })
})

// ── netFromGross's monotonicity, the precondition grossFromNet depends on ──
//
// `grossFromNet` inverts take-home by bisection, which is only correct while
// `netFromGross` never falls as gross rises. salary.ts and
// docs/salary-engine-monotonicity.md both call that out as a precondition
// rather than a property, and warn that a student-loan or relief-at-source
// pension deduction can break it in the £100k taper band — where deductions
// already stack to roughly 77p per extra £1.
//
// Nothing enforced it before (#216): a deduction could turn the curve over and
// every other test here would still pass, while reverse mode quietly returned
// a wrong salary. These sweep the whole realistic range instead of sampling.

/** Named in every failure message, so whoever breaks this is told where the rules are written down. */
const MONOTONICITY_DOC = 'docs/salary-engine-monotonicity.md'

/** The top of the swept range: comfortably past the £125,140 point where the allowance is gone and the additional rate applies. */
const SWEEP_CEILING = 200000
/** Fine enough to land inside every band, including the 25,140-wide taper. */
const SWEEP_STEP = 50

function isTaxYear(value: unknown): value is TaxYear {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Partial<TaxYear>
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.personalAllowance === 'number' &&
    Array.isArray(candidate.incomeTaxBands) &&
    Array.isArray(candidate.niBands)
  )
}

/**
 * Every tax year taxYears.ts exports, so a second year added there is swept
 * without this file changing. CURRENT_TAX_YEAR is an alias for one of the
 * tables rather than a year of its own, so it is de-duplicated by `id`.
 */
function allTaxYears(): TaxYear[] {
  const byId = new Map<string, TaxYear>()
  for (const value of Object.values(taxYearsModule)) {
    if (isTaxYear(value)) byId.set(value.id, value)
  }
  return [...byId.values()]
}

/**
 * The gross figures where the curve changes slope, in *gross* terms — the
 * places a monotonicity break would hide between two sampled points. Derived
 * from the year's own table rather than hard-coded, so they stay right when
 * the figures are refreshed.
 */
function thresholdsFor(year: TaxYear): number[] {
  const higherRateGross = (year.incomeTaxBands[0]?.upTo ?? 0) + year.personalAllowance
  // Where the taper has consumed the whole allowance. `taperRate` of 0 would
  // mean no taper at all, so there is no such point.
  const taperEnd = year.taperRate > 0 ? year.taperThreshold + year.personalAllowance / year.taperRate : Number.POSITIVE_INFINITY
  return [0, year.personalAllowance, higherRateGross, year.taperThreshold, taperEnd, ...year.niBands.map((band) => band.upTo)].filter(
    (value) => Number.isFinite(value) && value >= 0,
  )
}

/** The swept grid: a regular step, plus the immediate neighbourhood of every threshold. */
function sweepPoints(year: TaxYear): number[] {
  const points = new Set<number>()
  for (let gross = 0; gross <= SWEEP_CEILING; gross += SWEEP_STEP) points.add(gross)
  for (const threshold of thresholdsFor(year)) {
    for (const delta of [-1, -0.01, 0, 0.01, 1]) {
      const point = threshold + delta
      if (point >= 0) points.add(point)
    }
  }
  return [...points].toSorted((a, b) => a - b)
}

/** Every adjacent pair where take-home *falls* as gross rises; empty means the precondition holds. */
function monotonicityViolations(year: TaxYear): string[] {
  const points = sweepPoints(year)
  const violations: string[] = []
  for (const [i, gross] of points.entries()) {
    if (i === 0) continue
    const previous = points[i - 1]
    const fell = netFromGross(gross, year) - netFromGross(previous, year)
    // Four decimals, not two: a break first shows up between two points a
    // penny apart, where a real fall is a fraction of a penny and "£0.00"
    // would read as a rounding artefact rather than the defect it is.
    if (fell < 0) violations.push(`${year.label}: take-home fell by £${(-fell).toFixed(4)} between gross £${previous} and £${gross}`)
  }
  return violations
}

/** Every point where net -> gross -> net misses by more than the documented £1. */
function roundTripViolations(year: TaxYear): string[] {
  const violations: string[] = []
  for (const gross of sweepPoints(year)) {
    const net = netFromGross(gross, year)
    const drift = Math.abs(netFromGross(grossFromNet(net, year), year) - net)
    if (drift > 1) violations.push(`${year.label}: gross £${gross} (net £${net.toFixed(2)}) round-tripped £${drift.toFixed(2)} out`)
  }
  return violations
}

describe('netFromGross is monotonically non-decreasing', () => {
  it.each(allTaxYears().map((year) => [year.label, year] as const))('never lets take-home fall as gross rises, %s', (_label, year) => {
    // The message, not just the failure, is the point. grossFromNet copes
    // with a curve that turns over, but the flip panel has no payslip wording
    // yet for a "salary needed" that jumps, so a shipped table must not
    // produce one until that wording exists.
    expect(
      monotonicityViolations(year),
      `netFromGross fell as gross rose under a shipped table. The inversion copes, but the flip panel's copy does not yet. Read ${MONOTONICITY_DOC} before shipping a deduction that does this.`,
    ).toEqual([])
  })

  // Necessary but not sufficient on its own: the test below shows this
  // passing on a table whose curve turns over. It guards the documented
  // accuracy; the sweep above guards the precondition that accuracy needs.
  it.each(allTaxYears().map((year) => [year.label, year] as const))('round-trips every swept point to within £1, %s', (_label, year) => {
    expect(roundTripViolations(year), `grossFromNet is documented as accurate to within £1. See ${MONOTONICITY_DOC}.`).toEqual([])
  })

  it('sweeps a grid that actually reaches the interesting places', () => {
    // Guards the guard: if `sweepPoints` ever returned a handful of values,
    // or `thresholdsFor` stopped finding the taper, both sweeps above would
    // pass while checking almost nothing.
    const points = sweepPoints(CURRENT_TAX_YEAR)
    expect(points.length).toBeGreaterThan(SWEEP_CEILING / SWEEP_STEP)
    expect(points.at(-1)).toBeGreaterThanOrEqual(SWEEP_CEILING)
    for (const threshold of [CURRENT_TAX_YEAR.personalAllowance, 50270, 100000, 125140]) {
      expect(points, `the sweep must step onto £${threshold} exactly`).toContain(threshold)
    }
    expect(allTaxYears().length).toBeGreaterThan(0)
  })

  it('detects a table that does turn the curve over', () => {
    // The sanity check #216 asks for, kept as a test rather than done by hand
    // once: a steep taper makes each extra £1 of gross add £3 to taxable
    // income, so at 45% the marginal tax is £1.35 and take-home *falls*.
    // Exactly the shape a 9% student loan or a large pension would produce.
    const turnsOver = STEEP_TAPER_TAX_YEAR

    const violations = monotonicityViolations(turnsOver)
    expect(violations.length).toBeGreaterThan(0)
    expect(violations[0]).toContain('take-home fell by')

    // The net round-trip passes on this table too, which is why it can't
    // stand in for the sweep above: any salary with the right take-home
    // round-trips, whether or not it is the one asked about.
    expect(roundTripViolations(turnsOver)).toEqual([])

    // Plain bisection over the whole range used to answer the take-home that
    // £100,000 earns with £110,672 — a salary that earns the same, matching
    // to the penny, which made the error silent. Walking the straight
    // stretches between thresholds finds both, and answers with the lowest.
    const net = netFromGross(100000, turnsOver)
    expect(salariesForTakeHome(net, turnsOver).map(Math.round)).toEqual([100000, 110673])
    expect(grossFromNet(net, turnsOver)).toBeCloseTo(100000, 2)
  })
})

describe('the edges of the range', () => {
  const year = CURRENT_TAX_YEAR
  const taperEnd = year.taperThreshold + year.personalAllowance / year.taperRate

  it('takes nothing at all at a gross of exactly £0', () => {
    expect(netFromGross(0, year)).toBe(0)
    expect(incomeTaxOn(0, year)).toBe(0)
    expect(nationalInsuranceOn(0, year)).toBe(0)
  })

  it.each([
    ['the personal allowance', 12570],
    ['the higher-rate threshold', 50270],
    ['the taper threshold', 100000],
    ['the end of the taper', 125140],
    ['well above the taper', 500000],
  ])('is non-decreasing and round-trips either side of %s', (_name, gross) => {
    expect(netFromGross(gross, year)).toBeGreaterThanOrEqual(netFromGross(gross - 0.01, year))
    expect(netFromGross(gross + 0.01, year)).toBeGreaterThanOrEqual(netFromGross(gross, year))
    expect(grossFromNet(netFromGross(gross, year), year)).toBeCloseTo(gross, 0)
  })

  it('agrees with the table about where the taper ends', () => {
    // 125140 is used as a literal above; this is what ties it to the figures.
    expect(taperEnd).toBe(125140)
    expect(netFromGross(taperEnd, year)).toBeCloseTo(taperEnd - incomeTaxOn(taperEnd, year) - nationalInsuranceOn(taperEnd, year), 6)
  })

  it('round-trips a net of exactly £0 back to a gross of £0', () => {
    expect(grossFromNet(0, year)).toBe(0)
    expect(netFromGross(grossFromNet(0, year), year)).toBe(0)
  })

  it('has no unachievable take-home under the real table, however large', () => {
    // "A net larger than any achievable" only exists for a degenerate table
    // (the 100%-flat case above). Under the real one, net grows without bound
    // with gross, so the documented behaviour here is that every positive
    // target is reachable — asserted rather than assumed.
    const huge = 10_000_000
    const gross = grossFromNet(huge, year)
    expect(Number.isFinite(gross)).toBe(true)
    expect(netFromGross(gross, year)).toBeCloseTo(huge, 0)
  })
})
