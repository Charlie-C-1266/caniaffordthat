// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { SalaryFlip } from './SalaryFlip'
import { salaryFlip, type CurrentPay } from '../../lib/reverse'
import { fmt } from '../../lib/calculations'
import type { TaxYear } from '../../lib/taxYears'
import { STEEP_TAPER_TAX_YEAR } from '../../test/taxYearFixtures'

// The engine (lib/reverse.ts) is already well tested; these tests cover the
// *display* branching this component owns: which subheadline renders, which
// median-comparison phrasing, whether the taper-band note appears, and how a
// typed, estimated or unknowable current salary is shown. Each case derives
// its expected engine output by calling salaryFlip with the same inputs the
// component will, and first sanity-checks that the inputs really land in the
// intended branch — so a future tax-table change that moves a scenario out of
// its branch fails loudly here instead of silently testing the wrong copy.

const ACCENT = '#4ade80'

/** Mirrors the component's nearest-£100 display rounding. */
const roundSalary = (n: number) => Math.round(n / 100) * 100

/** Current pay as take-home mode reports it. */
const takeHome = (takeHomeMonthly: number): CurrentPay => ({ kind: 'takehome', takeHomeMonthly })

/** Current pay as salary mode reports it. */
const salary = (grossAnnual: number): CurrentPay => ({ kind: 'salary', grossAnnual })

/** A figure the scenario is meant to know; fails the test, rather than formatting `null`, when it doesn't. */
function known(value: number | null): number {
  if (value === null) throw new Error('Expected this scenario to have a single current salary')
  return value
}

/** The note shown when no single salary explains the take-home entered. */
const NO_SINGLE_SALARY = /More than one salary gives the take-home you entered/

function renderFlip(requiredTakeHomeMonthly: number, current: CurrentPay | number, year?: TaxYear) {
  const pay = typeof current === 'number' ? takeHome(current) : current
  render(<SalaryFlip requiredTakeHomeMonthly={requiredTakeHomeMonthly} current={pay} accentColor={ACCENT} year={year} />)
  return salaryFlip(requiredTakeHomeMonthly, pay, year)
}

describe('SalaryFlip display branches', () => {
  afterEach(cleanup)

  it('renders the "already earn enough" subheadline and total row when current pay covers the plan', () => {
    const flip = renderFlip(1000, 3000)
    expect(flip.alreadyEnough).toBe(true)

    expect(screen.getByText(/^You already earn enough/)).toBeTruthy()
    expect(
      screen.getByText(
        `You already earn enough — this needs about ${fmt(roundSalary(flip.requiredGross))} a year, and you're on roughly ${fmt(roundSalary(known(flip.currentGross)))}.`,
      ),
    ).toBeTruthy()
    expect(screen.getByText('YOU CAN COVER IT')).toBeTruthy()
    expect(screen.getByText(`${fmt(roundSalary(Math.abs(known(flip.grossGap))))} to spare`)).toBeTruthy()
  })

  it('renders the pay-rise subheadline with the rounded gap and monthly-gap figures when pay falls short', () => {
    const flip = renderFlip(3000, 2000)
    expect(flip.alreadyEnough).toBe(false)

    const gap = roundSalary(Math.abs(known(flip.grossGap)))
    expect(
      screen.getByText(
        `That's roughly a ${fmt(gap)} pay rise on your estimated ${fmt(roundSalary(known(flip.currentGross)))} — about ${fmt(
          Math.round(flip.takeHomeMonthlyGap),
        )}/month more take-home.`,
      ),
    ).toBeTruthy()
    expect(screen.getByText('YOUR SALARY (EST.)')).toBeTruthy()
    expect(screen.getByText('PAY RISE NEEDED')).toBeTruthy()
    expect(screen.getByText(`${fmt(gap)}/yr`)).toBeTruthy()
    expect(screen.queryByText(NO_SINGLE_SALARY)).toBeNull()
  })

  it('phrases the median comparison as "Around the UK median" when the required gross sits near it', () => {
    // ~£2,540/mo take-home reverses to a gross within ±5% of the median.
    const flip = renderFlip(2540, 2000)
    expect(flip.vsMedian).toBe('about')

    expect(screen.getByText(`Around the UK median full-time salary of ${fmt(flip.medianFullTimeSalary)}.`)).toBeTruthy()
  })

  it('phrases the median comparison as above/below outside that band', () => {
    const flip = renderFlip(3000, 2000)
    expect(flip.vsMedian).toBe('above')

    expect(screen.getByText(`That's above the UK median full-time salary of ${fmt(flip.medianFullTimeSalary)}.`)).toBeTruthy()

    cleanup()

    const low = renderFlip(1000, 900)
    expect(low.vsMedian).toBe('below')
    expect(screen.getByText(`That's below the UK median full-time salary of ${fmt(low.medianFullTimeSalary)}.`)).toBeTruthy()
  })

  it('shows the £100k taper-band note only when the required gross lands in the taper', () => {
    // ~£6,100/mo take-home reverses to a gross inside the £100k–£125,140 taper.
    const flip = renderFlip(6100, 3000)
    expect(flip.inTaperBand).toBe(true)

    expect(screen.getByText(/tax trap/)).toBeTruthy()
    expect(screen.getByText(new RegExp(`£\\s*${flip.salaryPerTakeHome.toFixed(2)} of salary`))).toBeTruthy()
  })

  it('omits the taper-band note for an ordinary salary', () => {
    const flip = renderFlip(3000, 2000)
    expect(flip.inTaperBand).toBe(false)

    expect(screen.queryByText(/tax trap/)).toBeNull()
  })

  it('renders the required gross figure rounded to the nearest £100, as headline and breakdown row', () => {
    const flip = renderFlip(3000, 2000)
    expect(screen.getAllByText(`${fmt(roundSalary(flip.requiredGross))}/yr`)).toHaveLength(2)
  })
})

describe('SalaryFlip with a salary the user typed', () => {
  afterEach(cleanup)

  it('shows the typed salary exactly, not as an estimate', () => {
    // £45,250 would round to £45,300 as an estimate; typed, it stays as typed.
    const flip = renderFlip(1000, salary(45250))
    expect(flip.alreadyEnough).toBe(true)

    expect(screen.getByText('YOUR SALARY')).toBeTruthy()
    expect(screen.queryByText('YOUR SALARY (EST.)')).toBeNull()
    expect(screen.getByText('£45,250/yr')).toBeTruthy()
    expect(
      screen.getByText(`You already earn enough — this needs about ${fmt(roundSalary(flip.requiredGross))} a year, and you're on £45,250.`),
    ).toBeTruthy()
  })

  it('words the pay rise against the typed salary', () => {
    const flip = renderFlip(3000, salary(40000))
    expect(flip.alreadyEnough).toBe(false)

    const gap = roundSalary(Math.abs(known(flip.grossGap)))
    expect(
      screen.getByText(
        `That's roughly a ${fmt(gap)} pay rise on your £40,000 salary — about ${fmt(Math.round(flip.takeHomeMonthlyGap))}/month more take-home.`,
      ),
    ).toBeTruthy()
    expect(screen.getByText('PAY RISE NEEDED')).toBeTruthy()
  })
})

// STEEP_TAPER_TAX_YEAR's take-home dips between £100,000 and £106,285, so
// £57,500 a year comes from three salaries. No real table does this yet.
describe('SalaryFlip when more than one salary gives the take-home entered', () => {
  afterEach(cleanup)

  const ambiguousTakeHome = 57500 / 12

  it('leaves out the salary estimate and gives the shortfall in take-home', () => {
    const flip = renderFlip(5000, ambiguousTakeHome, STEEP_TAPER_TAX_YEAR)
    expect(flip.currentGross).toBeNull()
    expect(flip.alreadyEnough).toBe(false)

    const shortfall = fmt(Math.round(flip.takeHomeMonthlyGap))
    expect(
      screen.getByText(
        `This needs about ${fmt(roundSalary(flip.requiredGross))} a year — about ${shortfall}/month more take-home than you have now.`,
      ),
    ).toBeTruthy()
    expect(screen.queryByText('YOUR SALARY (EST.)')).toBeNull()
    expect(screen.queryByText('YOUR SALARY')).toBeNull()
    expect(screen.queryByText('PAY RISE NEEDED')).toBeNull()
    expect(screen.getByText('MORE TAKE-HOME NEEDED')).toBeTruthy()
    expect(screen.getByText(`${shortfall}/mo`)).toBeTruthy()
    expect(screen.getByText(NO_SINGLE_SALARY)).toBeTruthy()
  })

  it('still says the plan is covered, in take-home', () => {
    const flip = renderFlip(4000, ambiguousTakeHome, STEEP_TAPER_TAX_YEAR)
    expect(flip.currentGross).toBeNull()
    expect(flip.alreadyEnough).toBe(true)

    expect(screen.getByText(`You already take home enough — this needs about ${fmt(roundSalary(flip.requiredGross))} a year.`)).toBeTruthy()
    expect(screen.getByText('YOU CAN COVER IT')).toBeTruthy()
    expect(screen.getByText(`${fmt(Math.round(-flip.takeHomeMonthlyGap))}/mo to spare`)).toBeTruthy()
    expect(screen.getByText(NO_SINGLE_SALARY)).toBeTruthy()
  })

  it('names the tax year it was worked out for', () => {
    renderFlip(5000, ambiguousTakeHome, STEEP_TAPER_TAX_YEAR)
    expect(screen.getByText(/steep taper \(test only\)/)).toBeTruthy()
  })
})
