// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react'
import { DetailsStep } from './DetailsStep'
import { CalculatorProvider } from '../../state/CalculatorProvider'
import { useCalculator, type CalculatorContextValue } from '../../state/calculatorContext'

// `coverBandText` is a live three-way branch driven straight off the "Months
// of cover" slider, so these tests drive that slider rather than poking the
// derived string — the only state set directly is the goal, which the
// carousel would otherwise have to be walked through to reach this step.

const UNDER_BAND = 'Aim for at least 3 months — even a 1-month cushion is a solid start.'
const IN_BAND = 'Within the recommended 3–6 months.'
const OVER_BAND = 'More than the usual 3–6 months — a larger cushion, which is fine.'

const STEP_INDEX = 1
const noop = () => {}

let calculator: CalculatorContextValue | null = null

/** Exposes the provider's context so the test can pick the emergency-fund goal. */
function CaptureContext() {
  calculator = useCalculator()
  return null
}

/** Renders the Details step on the emergency-fund goal, with `coverMonths` at the given value. */
function renderEmergencyDetails(coverMonths?: number) {
  render(
    <CalculatorProvider>
      <CaptureContext />
      <DetailsStep index={STEP_INDEX} panelRef={noop} wrapperRef={noop} scrollToIndex={noop} />
    </CalculatorProvider>,
  )
  act(() => calculator?.setField('goalId', 'emergency'))

  const slider = screen.getByRole('slider', { name: 'Months of cover' })
  if (coverMonths !== undefined) fireEvent.change(slider, { target: { value: String(coverMonths) } })
  return slider
}

/** The band copy's row, or null when that exact copy isn't on screen. */
function bandRow(text: string): HTMLElement | null {
  return screen.queryByText(text)
}

describe('DetailsStep emergency-fund cover band copy', () => {
  afterEach(() => {
    cleanup()
    calculator = null
  })

  it('nudges toward 3 months when the cover is under the recommended band', () => {
    renderEmergencyDetails(1)

    expect(bandRow(UNDER_BAND)).toBeTruthy()
    expect(bandRow(IN_BAND)).toBeNull()
    expect(bandRow(OVER_BAND)).toBeNull()
    // The reassuring check mark belongs to the in-band case only.
    expect(bandRow(UNDER_BAND)?.querySelector('svg')).toBeNull()
  })

  it('calls the cover in-band at the default 3 months, with a check mark', () => {
    // No slider change: 3 is the DEFAULT_STATE value a user lands on.
    renderEmergencyDetails()

    expect(bandRow(IN_BAND)).toBeTruthy()
    expect(bandRow(UNDER_BAND)).toBeNull()
    expect(bandRow(OVER_BAND)).toBeNull()
    expect(bandRow(IN_BAND)?.querySelector('svg')).toBeTruthy()
  })

  it('still calls the cover in-band at the top of the band (6 months)', () => {
    renderEmergencyDetails(6)

    expect(bandRow(IN_BAND)).toBeTruthy()
    expect(bandRow(OVER_BAND)).toBeNull()
  })

  it('calls a cover over the recommended band larger, without discouraging it', () => {
    renderEmergencyDetails(7)

    expect(bandRow(OVER_BAND)).toBeTruthy()
    expect(bandRow(IN_BAND)).toBeNull()
    expect(bandRow(UNDER_BAND)).toBeNull()
    expect(bandRow(OVER_BAND)?.querySelector('svg')).toBeNull()
  })

  it('moves between all three bands as the slider is dragged', () => {
    const slider = renderEmergencyDetails()
    expect(bandRow(IN_BAND)).toBeTruthy()

    fireEvent.change(slider, { target: { value: '2' } })
    expect(bandRow(UNDER_BAND)).toBeTruthy()

    fireEvent.change(slider, { target: { value: '12' } })
    expect(bandRow(OVER_BAND)).toBeTruthy()

    fireEvent.change(slider, { target: { value: '4' } })
    expect(bandRow(IN_BAND)).toBeTruthy()
  })
})
