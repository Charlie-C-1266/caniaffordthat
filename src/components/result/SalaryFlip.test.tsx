// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { SalaryFlip } from './SalaryFlip'
import { salaryFlip } from '../../lib/reverse'
import { fmt } from '../../lib/calculations'

// The engine (lib/reverse.ts) is already well tested; these tests cover the
// *display* branching this component owns: which subheadline renders, which
// median-comparison phrasing, and whether the taper-band note appears. Each
// case derives its expected engine output by calling salaryFlip with the same
// inputs the component will, and first sanity-checks that the inputs really
// land in the intended branch — so a future tax-table change that moves a
// scenario out of its branch fails loudly here instead of silently testing
// the wrong copy.

const ACCENT = '#4ade80'

/** Mirrors the component's nearest-£100 display rounding. */
const roundSalary = (n: number) => Math.round(n / 100) * 100

function renderFlip(requiredTakeHomeMonthly: number, currentTakeHomeMonthly: number) {
  render(
    <SalaryFlip requiredTakeHomeMonthly={requiredTakeHomeMonthly} currentTakeHomeMonthly={currentTakeHomeMonthly} accentColor={ACCENT} />,
  )
  return salaryFlip(requiredTakeHomeMonthly, currentTakeHomeMonthly)
}

describe('SalaryFlip display branches', () => {
  afterEach(cleanup)

  it('renders the "already earn enough" subheadline and total row when current pay covers the plan', () => {
    const flip = renderFlip(1000, 3000)
    expect(flip.alreadyEnough).toBe(true)

    expect(screen.getByText(/^You already earn enough/)).toBeTruthy()
    expect(
      screen.getByText(
        `You already earn enough — this needs about ${fmt(roundSalary(flip.requiredGross))} a year, and you're on roughly ${fmt(roundSalary(flip.currentGross))}.`,
      ),
    ).toBeTruthy()
    expect(screen.getByText('YOU CAN COVER IT')).toBeTruthy()
    expect(screen.getByText(`${fmt(roundSalary(Math.abs(flip.grossGap)))} to spare`)).toBeTruthy()
  })

  it('renders the pay-rise subheadline with the rounded gap and monthly-gap figures when pay falls short', () => {
    const flip = renderFlip(3000, 2000)
    expect(flip.alreadyEnough).toBe(false)

    const gap = roundSalary(Math.abs(flip.grossGap))
    expect(
      screen.getByText(
        `That's roughly a ${fmt(gap)} pay rise on your estimated ${fmt(roundSalary(flip.currentGross))} — about ${fmt(
          Math.round(flip.takeHomeMonthlyGap),
        )}/month more take-home.`,
      ),
    ).toBeTruthy()
    expect(screen.getByText('PAY RISE NEEDED')).toBeTruthy()
    expect(screen.getByText(`${fmt(gap)}/yr`)).toBeTruthy()
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
