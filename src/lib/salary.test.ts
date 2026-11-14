import { describe, it, expect } from 'vitest'
import {
  netFromGross,
  grossFromNet,
  salariesForTakeHome,
  takeHomePlateauBelow,
  incomeTaxOn,
  nationalInsuranceOn,
  marginalNetRate,
  inAllowanceTaper,
  monthlyTakeHomeFromGross,
  takeHomeBreakdown,
} from './salary'
import { NO_DEDUCTIONS, type PayProfile, type PensionInput } from './deductions'
import type { PensionArrangement } from '../state/types'
import { CURRENT_TAX_YEAR, type TaxYear } from './taxYears'
import * as taxYearsModule from './taxYears'
import { DEDUCTION_TERMS_FOR_TESTS, STEEP_TAPER_TAX_YEAR } from '../test/taxYearFixtures'

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
      ...DEDUCTION_TERMS_FOR_TESTS,
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
      ...DEDUCTION_TERMS_FOR_TESTS,
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
function crossingsByScan(net: number, year: TaxYear, profile: PayProfile = NO_DEDUCTIONS): number {
  let crossings = 0
  let previous = netFromGross(0, year, profile) - net
  for (let gross = 5; gross <= 300000; gross += 5) {
    const current = netFromGross(gross, year, profile) - net
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
      ...DEDUCTION_TERMS_FOR_TESTS,
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

describe('takeHomePlateauBelow', () => {
  it('finds no plateau anywhere under the current table, where take-home always rises', () => {
    for (const gross of [0, 12570, 50270, 100000, 110000, 125140, 200000]) {
      expect(takeHomePlateauBelow(gross), `below £${gross}`).toBeNull()
    }
  })

  it('runs from the peak to where take-home climbs back to it', () => {
    // Take-home peaks at £100,000, falls until £106,285, and is back to the
    // £58,656.50 it had at £100,000 by about £110,673.
    const plateau = takeHomePlateauBelow(120000, STEEP_TAPER_TAX_YEAR)
    expect(plateau?.from).toBe(100000)
    expect(plateau?.to).toBeCloseTo(110672.64, 0)
    expect(netFromGross(plateau?.to ?? 0, STEEP_TAPER_TAX_YEAR)).toBeCloseTo(netFromGross(100000, STEEP_TAPER_TAX_YEAR), 2)
  })

  it('stops at the salary asked about when take-home has not climbed back by then', () => {
    expect(takeHomePlateauBelow(110000, STEEP_TAPER_TAX_YEAR)).toEqual({ from: 100000, to: 110000 })
  })

  it('finds nothing at or below the peak itself', () => {
    expect(takeHomePlateauBelow(100000, STEEP_TAPER_TAX_YEAR)).toBeNull()
    expect(takeHomePlateauBelow(0, STEEP_TAPER_TAX_YEAR)).toBeNull()
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
    // The message, not just the failure, is the point. The inversion and the
    // flip panel both cope with a curve that turns over, but the methodology
    // page doesn't yet explain it, and the site publishes its working before
    // its figures — so a shipped table must not produce one until it does.
    expect(
      monotonicityViolations(year),
      `netFromGross fell as gross rose under a shipped table. The engine and the flip panel cope, but /methodology/salary/ doesn't explain it yet. Read ${MONOTONICITY_DOC} before shipping a deduction that does this.`,
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

// ── Student loans and pensions ──────────────────────────────────────────────
//
// Golden figures are computed from the 2026/27 rules in taxYears.ts and
// deductions.ts, and match the worked examples in the design notes. The
// "reference profile" is the one docs/salary-engine-monotonicity.md uses: a
// relief-at-source pension of 30% of salary, Plan 5 and a Postgraduate Loan.

/** A pay profile from its parts. */
const profileOf = (studentPlan: PayProfile['studentPlan'], postgradLoan: boolean, pension: PensionInput | null = null): PayProfile => ({
  studentPlan,
  postgradLoan,
  pension,
})

/** A pension given as a percentage of salary. */
const percentOf = (arrangement: PensionArrangement, percent: number): PensionInput => ({
  arrangement,
  mode: 'percent',
  percent,
  monthlyAmount: 0,
})

/** A pension given as a fixed amount from pay each month. */
const monthly = (arrangement: PensionArrangement, monthlyAmount: number): PensionInput => ({
  arrangement,
  mode: 'amount',
  percent: 0,
  monthlyAmount,
})

const REFERENCE_PROFILE = profileOf('plan5', true, percentOf('ras', 30))

const ARRANGEMENTS: readonly PensionArrangement[] = ['sacrifice', 'netpay', 'ras']

/** The breakdown at a salary with Plan 2 and a percentage pension. */
const withPlan2 = (gross: number, arrangement: PensionArrangement, percent: number) =>
  takeHomeBreakdown(gross, CURRENT_TAX_YEAR, profileOf('plan2', false, percentOf(arrangement, percent)))

/** The breakdown at a salary with no loans and a fixed monthly pension. */
const withMonthlyPension = (gross: number, arrangement: PensionArrangement, monthlyAmount: number) =>
  takeHomeBreakdown(gross, CURRENT_TAX_YEAR, profileOf('none', false, monthly(arrangement, monthlyAmount)))

describe('takeHomeBreakdown with no deductions', () => {
  it('is gross less income tax and NI, exactly as before', () => {
    for (let gross = 0; gross <= 200000; gross += 2500) {
      const breakdown = takeHomeBreakdown(gross)
      expect(breakdown.takeHome).toBe(gross - incomeTaxOn(gross) - nationalInsuranceOn(gross))
      expect(breakdown.studentLoan + breakdown.postgraduateLoan + breakdown.pension + breakdown.intoPension).toBe(0)
    }
  })

  it('treats a negative salary as nothing', () => {
    expect(takeHomeBreakdown(-5000)).toEqual(takeHomeBreakdown(0))
    expect(takeHomeBreakdown(0).takeHome).toBe(0)
  })
})

describe('takeHomeBreakdown with student loans', () => {
  it('matches known take-home for each plan', () => {
    // £35,000: tax £4,486, NI £1,794.40, then 9% over each plan's threshold.
    const expected = { plan1: 27990.6, plan2: 28214.25, plan4: 28611.15, plan5: 27819.6 } as const
    for (const [plan, takeHome] of Object.entries(expected)) {
      expect(netFromGross(35000, CURRENT_TAX_YEAR, profileOf(plan as keyof typeof expected, false)), `${plan} at £35,000`).toBeCloseTo(
        takeHome,
        2,
      )
    }
  })

  it('takes the Postgraduate Loan on top of a plan', () => {
    // £45,000: Plan 2 £1,405.35 and the Postgraduate Loan £1,440.
    const breakdown = takeHomeBreakdown(45000, CURRENT_TAX_YEAR, profileOf('plan2', true))
    expect(breakdown.studentLoan).toBeCloseTo(1405.35, 2)
    expect(breakdown.postgraduateLoan).toBeCloseTo(1440, 2)
    expect(breakdown.takeHome).toBeCloseTo(33074.25, 2)
    expect(netFromGross(45000, CURRENT_TAX_YEAR, profileOf('plan5', true))).toBeCloseTo(32679.6, 2)
  })
})

describe('takeHomeBreakdown with a pension', () => {
  it('matches known take-home for 5% under each arrangement, with Plan 2', () => {
    const expected: Record<PensionArrangement, [gross: number, takeHome: number][]> = {
      sacrifice: [
        [30000, 24039.6],
        [35000, 27111.75],
        [60000, 41132.05],
      ],
      netpay: [
        [30000, 23864.25],
        [35000, 26814.25],
        [60000, 40802.05],
      ],
      ras: [
        [30000, 23864.25],
        [35000, 26814.25],
        [60000, 40202.05],
      ],
    }
    for (const arrangement of ARRANGEMENTS) {
      for (const [gross, takeHome] of expected[arrangement]) {
        expect(
          netFromGross(gross, CURRENT_TAX_YEAR, profileOf('plan2', false, percentOf(arrangement, 5))),
          `${arrangement}, £${gross}`,
        ).toBeCloseTo(takeHome, 2)
      }
    }
  })

  it('works student loans out on pay after salary sacrifice, but not after the other two', () => {
    // £30,000 less a 5% sacrifice is £28,500, under Plan 2's £29,385, so
    // nothing is repaid. Net pay and relief at source leave the loan's pay
    // at £30,000, which repays £55.35.
    expect(withPlan2(30000, 'sacrifice', 5).studentLoan).toBe(0)
    expect(withPlan2(30000, 'netpay', 5).studentLoan).toBeCloseTo(55.35, 2)
    expect(withPlan2(30000, 'ras', 5).studentLoan).toBeCloseTo(55.35, 2)
  })

  it('gives net pay and relief at source the same take-home up to the higher-rate threshold, and not above it', () => {
    // Relief at source adds basic-rate relief only, so once some of the pay
    // the contribution comes from is taxed at 40%, net pay keeps more on the
    // payslip: £600 a year more at £60,000 with 5%.
    for (const gross of [15000, 25000, 35000, 45000, 50000]) {
      const netPay = netFromGross(gross, CURRENT_TAX_YEAR, profileOf('plan2', false, percentOf('netpay', 5)))
      expect(netFromGross(gross, CURRENT_TAX_YEAR, profileOf('plan2', false, percentOf('ras', 5))), `£${gross}`).toBeCloseTo(netPay, 6)
    }
    expect(withPlan2(60000, 'netpay', 5).takeHome - withPlan2(60000, 'ras', 5).takeHome).toBeCloseTo(600, 2)
  })

  it('reads a monthly amount as what leaves the payslip', () => {
    // £100 a month at £40,000: £1,200 a year either way off pay, but relief
    // at source puts £1,500 in the pot, and only the other two lower tax.
    const ras = withMonthlyPension(40000, 'ras', 100)
    expect(ras.pension).toBeCloseTo(1200, 6)
    expect(ras.intoPension).toBeCloseTo(1500, 6)
    expect(ras.takeHome).toBeCloseTo(31119.6, 2)
    expect(withMonthlyPension(40000, 'netpay', 100).takeHome).toBeCloseTo(31359.6, 2)
    expect(withMonthlyPension(40000, 'sacrifice', 100).takeHome).toBeCloseTo(31455.6, 2)
  })

  it('itemises the reference profile, line by line', () => {
    const at100k = takeHomeBreakdown(100000, CURRENT_TAX_YEAR, REFERENCE_PROFILE)
    expect(at100k).toEqual({
      gross: 100000,
      incomeTax: expect.closeTo(27432, 2) as number,
      nationalInsurance: expect.closeTo(4010.6, 2) as number,
      studentLoan: expect.closeTo(6750, 2) as number,
      postgraduateLoan: expect.closeTo(4740, 2) as number,
      pension: expect.closeTo(24000, 2) as number,
      intoPension: expect.closeTo(30000, 2) as number,
      takeHome: expect.closeTo(33067.4, 2) as number,
    })
    // £25,000 more salary, £250 less take-home on the payslip: the shape the
    // flip panel's payslip notes exist for.
    expect(netFromGross(125000, CURRENT_TAX_YEAR, REFERENCE_PROFILE)).toBeCloseTo(32817.4, 2)
  })

  it('leaves no take-home, rather than a negative one, for a pension bigger than the payslip', () => {
    // £3,000 a month under net pay on £30,000: the whole salary goes to the
    // pension, and NI and the loans still fall on the full £30,000.
    const breakdown = takeHomeBreakdown(30000, CURRENT_TAX_YEAR, profileOf('plan5', true, monthly('netpay', 3000)))
    expect(breakdown.intoPension).toBe(30000)
    expect(breakdown.takeHome).toBe(0)
  })

  it('moves a salary out of the £100k taper only for a pension taken before tax', () => {
    expect(inAllowanceTaper(110000, CURRENT_TAX_YEAR, profileOf('none', false, percentOf('sacrifice', 10)))).toBe(false)
    expect(inAllowanceTaper(110000, CURRENT_TAX_YEAR, profileOf('none', false, percentOf('netpay', 10)))).toBe(false)
    expect(inAllowanceTaper(110000, CURRENT_TAX_YEAR, profileOf('none', false, percentOf('ras', 10)))).toBe(true)
  })

  it('carries the profile into the monthly figure and the marginal rate', () => {
    expect(monthlyTakeHomeFromGross(35000, CURRENT_TAX_YEAR, profileOf('plan2', false))).toBeCloseTo(28214.25 / 12, 6)
    // Inside the taper the reference profile keeps a penny less than nothing
    // of each extra £1.
    expect(marginalNetRate(110000, CURRENT_TAX_YEAR, REFERENCE_PROFILE)).toBeCloseTo(-0.01, 6)
  })
})

/** Every point from £0 to £200,000 in £25 steps where take-home falls, under a profile. */
function fallsUnder(profile: PayProfile): string[] {
  const falls: string[] = []
  let previous = 0
  for (let gross = 25; gross <= 200000; gross += 25) {
    const current = netFromGross(gross, CURRENT_TAX_YEAR, profile)
    if (current < previous) falls.push(`£${gross}`)
    previous = current
  }
  return falls
}

describe('take-home under each profile as pay rises', () => {
  // The pension slider stops at 50%. Under that cap only relief at source can
  // make take-home fall, and only above ~28.75% with both loans in the taper;
  // salary sacrifice never can, and net pay would need ~57.5%.
  const neverFalls: [label: string, profile: PayProfile][] = [
    ...(['plan1', 'plan2', 'plan4', 'plan5'] as const).map((plan): [string, PayProfile] => [
      `${plan} and a Postgraduate Loan`,
      profileOf(plan, true),
    ]),
    ...[0.5, 10, 25, 50].flatMap((percent): [string, PayProfile][] => [
      [`${percent}% salary sacrifice, both loans`, profileOf('plan5', true, percentOf('sacrifice', percent))],
      [`${percent}% net pay, both loans`, profileOf('plan5', true, percentOf('netpay', percent))],
    ]),
    ['28% relief at source, both loans', profileOf('plan5', true, percentOf('ras', 28))],
    ['£500 a month relief at source, both loans', profileOf('plan5', true, monthly('ras', 500))],
  ]

  it.each(neverFalls)('never falls with %s', (_label, profile) => {
    expect(fallsUnder(profile)).toEqual([])
  })

  it('does fall with the reference profile, from £100,000 to the end of the taper', () => {
    const falls = fallsUnder(REFERENCE_PROFILE)
    expect(falls[0]).toBe('£100025')
    expect(falls.at(-1)).toBe('£125125')
  })
})

describe('the search under each profile', () => {
  // These profiles move every threshold: a percentage pension scales the
  // tax base, a fixed one shifts it, and loans add thresholds of their own.
  // A £5 scan can't skip a threshold it doesn't know about, so it checks the
  // search hasn't either.
  const profiles: [label: string, profile: PayProfile][] = [
    ['the reference profile', REFERENCE_PROFILE],
    ['50% relief at source, Plan 2', profileOf('plan2', false, percentOf('ras', 50))],
    ['20% salary sacrifice, Plan 4', profileOf('plan4', false, percentOf('sacrifice', 20))],
    ['£800 a month net pay, both loans', profileOf('plan1', true, monthly('netpay', 800))],
    ['£800 a month relief at source, both loans', profileOf('plan5', true, monthly('ras', 800))],
  ]

  it.each(profiles)('finds every salary up to £300,000 that a £5 scan finds, under %s', (_label, profile) => {
    for (const net of [5000, 15000, 25000, 32900, 32950, 40000]) {
      // The scan stops at £300,000; a high pension can need a salary past it.
      const scanned = salariesForTakeHome(net, CURRENT_TAX_YEAR, profile).filter((gross) => gross <= 300000)
      expect(scanned, `take-home £${net}`).toHaveLength(crossingsByScan(net, CURRENT_TAX_YEAR, profile))
    }
  })

  it('finds the three salaries behind one take-home on the reference profile', () => {
    expect(salariesForTakeHome(32917, CURRENT_TAX_YEAR, REFERENCE_PROFILE).map(Math.round)).toEqual([99208, 115040, 125861])
  })

  it('answers with the first salary to reach each take-home, across the whole range', () => {
    // Relief at source at 30%, 40% and 50% with both loans: the profiles
    // where take-home turns over. No salary below the answer may reach the
    // target, on a £25 scan.
    for (const percent of [30, 40, 50]) {
      const profile = profileOf('plan5', true, percentOf('ras', percent))
      for (let net = 1000; net <= 30000; net += 1000) {
        if (salariesForTakeHome(net, CURRENT_TAX_YEAR, profile).length === 0) continue
        const gross = grossFromNet(net, CURRENT_TAX_YEAR, profile)
        expect(netFromGross(gross, CURRENT_TAX_YEAR, profile), `${percent}%, £${net}`).toBeCloseTo(net, 2)
        for (let below = 0; below < gross - 25; below += 25) {
          if (netFromGross(below, CURRENT_TAX_YEAR, profile) >= net)
            throw new Error(`${percent}%, £${net}: £${below} reaches it before £${gross}`)
        }
      }
    }
  })

  it("reports the plateau the reference profile's salary needed has to get past", () => {
    // £33,072 a year is just above the £33,067.40 that £100,000 takes home,
    // and take-home doesn't climb back to that until about £126,936.
    const gross = grossFromNet(33072, CURRENT_TAX_YEAR, REFERENCE_PROFILE)
    expect(gross).toBeCloseTo(126968.57, 0)
    const plateau = takeHomePlateauBelow(gross, CURRENT_TAX_YEAR, REFERENCE_PROFILE)
    expect(plateau?.from).toBe(100000)
    expect(plateau?.to).toBeCloseTo(126935.71, 0)
  })

  it('finds no salary at all for a take-home a profile never reaches', () => {
    // At 50% relief at source with both loans, each extra £1 above £125,140
    // costs more than £1 on the payslip, so take-home never gets past the
    // £17,067.40 it reaches at £100,000. Nothing takes home £20,000.
    const profile = profileOf('plan5', true, percentOf('ras', 50))
    expect(netFromGross(100000, CURRENT_TAX_YEAR, profile)).toBeCloseTo(17067.4, 2)
    expect(salariesForTakeHome(20000, CURRENT_TAX_YEAR, profile)).toEqual([])
    expect(Number.isFinite(grossFromNet(20000, CURRENT_TAX_YEAR, profile))).toBe(true)
  })
})
