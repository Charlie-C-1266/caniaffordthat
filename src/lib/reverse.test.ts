import { describe, it, expect } from 'vitest'
import { currentPayOf, MIN_KEPT_TO_QUOTE, salaryFlip, type CurrentPay } from './reverse'
import { grossFromNet, marginalNetRate, netFromGross } from './salary'
import { CURRENT_TAX_YEAR, type TaxYear } from './taxYears'
import { DEFAULT_STATE } from '../state/defaults'
import { FIVE_PENCE_TAPER_TAX_YEAR, STEEP_TAPER_TAX_YEAR } from '../test/taxYearFixtures'

/** Current pay as take-home mode reports it. */
const takeHome = (takeHomeMonthly: number): CurrentPay => ({ kind: 'takehome', takeHomeMonthly })

/** Current pay as salary mode reports it. */
const salary = (grossAnnual: number): CurrentPay => ({ kind: 'salary', grossAnnual })

describe('salaryFlip', () => {
  it('reports the gross behind the required take-home and the gap to current pay', () => {
    // Needs £3,000/mo take-home; currently earns £2,000/mo take-home.
    const flip = salaryFlip(3000, takeHome(2000))
    expect(flip.requiredTakeHomeAnnual).toBe(36000)
    expect(flip.requiredGross).toBeCloseTo(grossFromNet(36000), 0)
    expect(flip.currentGross).toBeCloseTo(grossFromNet(24000), 0)
    expect(flip.grossGap).toBeCloseTo(flip.requiredGross - (flip.currentGross ?? Number.NaN), 6)
    expect(flip.grossGap).toBeGreaterThan(0)
    expect(flip.alreadyEnough).toBe(false)
    expect(flip.takeHomeMonthlyGap).toBe(1000)
  })

  it('marks the plan as already affordable when current pay exceeds the requirement', () => {
    const flip = salaryFlip(1500, takeHome(4000))
    expect(flip.alreadyEnough).toBe(true)
    expect(flip.grossGap).toBeLessThan(0)
    expect(flip.vsMedian).toBe('below') // ~£20k gross is below the ONS median
  })

  it('places a big requirement above the UK median', () => {
    const flip = salaryFlip(5000, takeHome(2000))
    expect(flip.vsMedian).toBe('above')
  })

  it('calls a requirement within ±5% of the ONS median "about" the median', () => {
    // A plan whose required take-home inverts to exactly the median full-time
    // gross — ratio 1.0, squarely inside the [0.95, 1.05] "about" band.
    const median = CURRENT_TAX_YEAR.medianFullTimeSalary
    const monthly = netFromGross(median) / 12
    const flip = salaryFlip(monthly, takeHome(2000))
    expect(flip.requiredGross).toBeCloseTo(median, 0)
    expect(flip.medianFullTimeSalary).toBe(median)
    expect(flip.vsMedian).toBe('about')

    // ±4% either side still reads 'about', so the test doesn't rest on the
    // exact median.
    for (const factor of [0.96, 1.04]) {
      const edge = salaryFlip(netFromGross(median * factor) / 12, takeHome(2000))
      expect(edge.vsMedian, `gross at ${factor}× the median`).toBe('about')
    }
  })

  it('surfaces the marginal cost inside the £100k allowance-taper band', () => {
    // A take-home that inverts to ~£110k gross, squarely in the taper band.
    const monthly = netFromGross(110000) / 12
    const flip = salaryFlip(monthly, takeHome(2000))
    expect(flip.requiredGross).toBeCloseTo(110000, 0)
    expect(flip.inTaperBand).toBe(true)
    // ~38p kept per extra £1 gross → ~£2.63 of salary per £1 of take-home.
    expect(flip.salaryPerTakeHome).toBeGreaterThan(2.5)
    expect(flip.salaryPerTakeHome).toBeLessThan(2.75)
  })

  it('documents that the null in salaryPerTakeHome is unreachable with the current tax tables', () => {
    // salaryFlip only quotes a per-pound figure while at least 10p of an
    // extra £1 is kept (`MIN_KEPT_TO_QUOTE`). Under the current UK bands the
    // *worst* combined marginal deduction is 62% (40% higher rate + an
    // implicit 20% from the £100k allowance taper + 2% NI), so the kept
    // fraction never falls below ~0.38 at any gross. Sweep every band boundary
    // (±£1) plus points inside each band to pin that down; if a future tax
    // table ever pushes the kept fraction under 10p, this test is the tripwire.
    const grosses = [
      0, 1, 5000, 12569, 12570, 12571, 30000, 50269, 50270, 50271, 75000, 99999, 100000, 100001, 110000, 125139, 125140, 125141, 200000,
      1000000,
    ]
    for (const gross of grosses) {
      expect(marginalNetRate(gross), `marginal net rate at gross £${gross}`).toBeGreaterThanOrEqual(MIN_KEPT_TO_QUOTE)
    }
    // And so salaryFlip always reports a real, positive £-of-salary figure —
    // including at the degenerate gross of £0 (required take-home of £0).
    for (const flip of [salaryFlip(0, takeHome(0)), salaryFlip(100, takeHome(0)), salaryFlip(12000, takeHome(3000))]) {
      expect(flip.salaryPerTakeHome).toBeGreaterThan(0)
      expect(Number.isFinite(flip.salaryPerTakeHome)).toBe(true)
    }
  })

  // The 0.95 / 1.05 cut-offs themselves, either side. The band is open at
  // both ends (`ratio > 1.05` / `ratio < 0.95`), so the boundary values
  // themselves read 'about' and only a hair past them flips the verdict.
  it('puts the vsMedian boundaries on the "about" side and flips just past them', () => {
    const median = CURRENT_TAX_YEAR.medianFullTimeSalary
    const atRatio = (factor: number) => salaryFlip(netFromGross(median * factor) / 12, takeHome(2000)).vsMedian

    expect(atRatio(0.95), 'exactly 0.95× the median').toBe('about')
    expect(atRatio(1.05), 'exactly 1.05× the median').toBe('about')
    expect(atRatio(0.93), 'below the lower cut-off').toBe('below')
    expect(atRatio(1.07), 'above the upper cut-off').toBe('above')
  })

  it('treats an exactly zero gap as already enough', () => {
    // alreadyEnough compares take-home with `>=`, so the boundary belongs to
    // "enough": someone taking home precisely the required figure can afford
    // the plan.
    const monthly = netFromGross(45000) / 12
    const flip = salaryFlip(monthly, takeHome(monthly))

    expect(flip.grossGap).toBeCloseTo(0, 6)
    expect(flip.alreadyEnough).toBe(true)
    expect(flip.takeHomeMonthlyGap).toBeCloseTo(0, 6)
  })

  it('floors a negative current take-home at zero rather than inverting it', () => {
    // currentTakeHomeMonthly is clamped with Math.max(0, …), so a nonsense
    // negative figure reads as "earns nothing", not as negative gross.
    const flip = salaryFlip(2000, takeHome(-500))

    expect(flip.currentGross).toBe(0)
    expect(flip.grossGap).toBe(flip.requiredGross)
    expect(flip.alreadyEnough).toBe(false)
    expect(Number.isFinite(flip.grossGap)).toBe(true)
  })

  // The other side of the band sweep above: the sweep proves the fallback is
  // unreachable with *today's* table, and these prove the fallback itself
  // behaves if a future table ever reaches it. `year` is a parameter for
  // exactly this reason, matching every function in ./salary.
  it('gives no per-pound figure where an extra £1 keeps under 10p', () => {
    // Inside this table's taper each extra £1 of gross keeps 5p, so the
    // figure would read "£20.00 of salary per £1".
    const year = FIVE_PENCE_TAPER_TAX_YEAR
    const flip = salaryFlip(netFromGross(110000, year) / 12, takeHome(2000), year)

    expect(flip.requiredGross).toBeCloseTo(110000, 0)
    expect(flip.inTaperBand).toBe(true)
    expect(marginalNetRate(110000, year)).toBeCloseTo(0.05, 6)
    expect(flip.salaryPerTakeHome).toBeNull()
  })

  it('gives no per-pound figure under a table with no take-home to gain', () => {
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

    const flip = salaryFlip(2000, takeHome(1000), confiscatory)

    expect(flip.salaryPerTakeHome).toBeNull()
    // And nothing downstream becomes Infinity or NaN.
    expect(Number.isFinite(flip.requiredGross)).toBe(true)
    expect(Number.isFinite(flip.grossGap)).toBe(true)
    expect(Number.isNaN(flip.requiredGross)).toBe(false)
  })

  it('uses the current tax year when no table is passed', () => {
    expect(salaryFlip(2000, takeHome(1000))).toEqual(salaryFlip(2000, takeHome(1000), CURRENT_TAX_YEAR))
  })
})

describe('salaryFlip with a salary the user typed', () => {
  it('uses the typed salary as is, and works out the take-home it gives', () => {
    const flip = salaryFlip(3000, salary(40000))
    expect(flip.currentGross).toBe(40000)
    expect(flip.takeHomeMonthlyGap).toBeCloseTo(3000 - netFromGross(40000) / 12, 6)
    expect(flip.grossGap).toBeCloseTo(flip.requiredGross - 40000, 6)
    expect(flip.alreadyEnough).toBe(false)
  })

  it('agrees with take-home mode wherever one take-home means one salary', () => {
    // Under the current table every take-home names exactly one salary, so
    // the two ways in must tell the same story, either side of the taper.
    for (const gross of [20000, 45000, 110000]) {
      for (const requiredMonthly of [1500, 3000, 7000]) {
        const fromSalary = salaryFlip(requiredMonthly, salary(gross))
        const fromTakeHome = salaryFlip(requiredMonthly, takeHome(netFromGross(gross) / 12))
        expect(fromSalary.alreadyEnough, `£${gross} salary, £${requiredMonthly}/month needed`).toBe(fromTakeHome.alreadyEnough)
        expect(fromSalary.currentGross, `£${gross} salary, £${requiredMonthly}/month needed`).toBeCloseTo(
          fromTakeHome.currentGross ?? Number.NaN,
          2,
        )
        expect(fromSalary.grossGap, `£${gross} salary, £${requiredMonthly}/month needed`).toBeCloseTo(
          fromTakeHome.grossGap ?? Number.NaN,
          2,
        )
      }
    }
  })
})

// STEEP_TAPER_TAX_YEAR's take-home peaks at £58,656.50 on £100,000, dips to
// £56,331.05 at £106,285 and rises again, so a take-home between the two
// comes from three salaries. No real table does this yet; a large
// relief-at-source pension in the £100k taper band would.
describe('salaryFlip where one take-home comes from more than one salary', () => {
  const year = STEEP_TAPER_TAX_YEAR

  it('names no salary for a take-home that three salaries give', () => {
    // £57,500 a year comes from about £97,818, £103,126 and £108,491.
    const flip = salaryFlip(5000, takeHome(57500 / 12), year)
    expect(flip.currentGross).toBeNull()
    expect(flip.grossGap).toBeNull()
    // Whether the plan fits is still known, because that compares take-home.
    expect(flip.alreadyEnough).toBe(false)
    expect(flip.takeHomeMonthlyGap).toBeCloseTo(5000 - 57500 / 12, 6)
    // And the salary the plan needs is unaffected.
    expect(flip.requiredGross).toBe(grossFromNet(60000, year))
  })

  it('still says when that take-home already covers the plan', () => {
    const flip = salaryFlip(4000, takeHome(57500 / 12), year)
    expect(flip.currentGross).toBeNull()
    expect(flip.alreadyEnough).toBe(true)
  })

  it('does not call a plan covered just because a lower salary reaches it', () => {
    // On £104,000 the user takes home £57,176.50. A plan needing £57,300 is
    // reached at about £97,441, £103,666 and £108,113. The lowest is below
    // their salary, yet their take-home falls short, and only a rise to about
    // £108,113 gets them there. Comparing their salary with the lowest one
    // would have said "covered, with £6,559 to spare".
    const flip = salaryFlip(57300 / 12, salary(104000), year)
    expect(flip.requiredGross).toBeLessThan(104000)
    expect(flip.alreadyEnough).toBe(false)
    expect(flip.currentGross).toBe(104000)
    expect(flip.grossGap).toBeCloseTo(108113.21 - 104000, 0)
  })

  it('measures what is to spare down to where take-home would drop below the target', () => {
    // Needing £57,100: about £97,063, £104,207 and £107,736 reach it. From
    // £104,000, take-home stays at or above the target all the way down to
    // £97,063, peaking at £100,000 on the way.
    const flip = salaryFlip(57100 / 12, salary(104000), year)
    expect(flip.alreadyEnough).toBe(true)
    expect(flip.grossGap).toBeCloseTo(97063.21 - 104000, 0)
  })
})

describe('salaryFlip where take-home stops rising with pay', () => {
  it('finds no payslip plateau anywhere under the current table', () => {
    for (const requiredMonthly of [0, 500, 2000, 4000, 5700, 6100, 6500, 8000, 20000]) {
      expect(salaryFlip(requiredMonthly, takeHome(2000)).payslipPlateau, `£${requiredMonthly}/month needed`).toBeNull()
    }
  })

  it('reports the plateau the salary needed has to get past', () => {
    // £58,700 a year is just above the £58,656.50 that £100,000 takes home on
    // STEEP_TAPER_TAX_YEAR. Take-home falls after £100,000 and only climbs
    // back to that level at about £110,673, so the salary needed is about
    // £110,755, where £58,600 would have needed about £99,893.
    const flip = salaryFlip(58700 / 12, takeHome(3000), STEEP_TAPER_TAX_YEAR)

    expect(flip.requiredGross).toBeCloseTo(110754.72, 0)
    expect(flip.payslipPlateau?.from).toBe(100000)
    expect(flip.payslipPlateau?.to).toBeCloseTo(110672.64, 0)
    expect(salaryFlip(58600 / 12, takeHome(3000), STEEP_TAPER_TAX_YEAR).requiredGross).toBeCloseTo(99893.4, 0)
  })

  it('reports no plateau when the salary needed comes before the peak', () => {
    // £57,500 is first reached at about £97,818, on the way up to the peak.
    expect(salaryFlip(57500 / 12, takeHome(3000), STEEP_TAPER_TAX_YEAR).payslipPlateau).toBeNull()
  })
})

describe('currentPayOf', () => {
  it('uses the typed salary in salary mode', () => {
    expect(currentPayOf({ ...DEFAULT_STATE, takeHomeMode: 'salary', grossSalary: '42000', takeHome: '2700' })).toEqual(salary(42000))
  })

  it('falls back to take-home in salary mode until a salary is typed', () => {
    expect(currentPayOf({ ...DEFAULT_STATE, takeHomeMode: 'salary', grossSalary: '', takeHome: '2100' })).toEqual(takeHome(2100))
  })

  it('uses take-home in take-home mode, even with a salary left over from salary mode', () => {
    expect(currentPayOf({ ...DEFAULT_STATE, takeHomeMode: 'takehome', grossSalary: '42000', takeHome: '2100' })).toEqual(takeHome(2100))
  })
})
