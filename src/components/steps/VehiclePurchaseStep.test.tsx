// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react'
import { VehiclePurchaseStep } from './VehiclePurchaseStep'
import { CalculatorProvider } from '../../state/CalculatorProvider'
import { useCalculator, type CalculatorContextValue } from '../../state/calculatorContext'
import { TERM_RANGES } from '../../lib/vehicle'
import type { VehicleFinanceMethod } from '../../state/types'

// Switching purchase method silently pulls the current term into the new
// method's range, because derive/vehicle.ts trusts state.term as already
// valid for the selected method. Nothing exercised that clamp — e2e only
// walks the default method's happy path — so a clamp in the wrong direction,
// or one that fired on the cash branch, would reach the monthly-payment
// maths unnoticed.
//
// The bounds come from the real TERM_RANGES rather than hard-coded guesses,
// so widening a range can't silently leave a case testing nothing.

const STEP_INDEX = 2
const noop = () => {}

let calculator: CalculatorContextValue | null = null

/** Exposes the provider's context so a test can seed and read back the term. */
function CaptureContext() {
  calculator = useCalculator()
  return null
}

/** Renders the purchase step with a controlled starting method and term. */
function renderPurchaseStep(term: number, vehicleMethod: VehicleFinanceMethod = 'loan') {
  render(
    <CalculatorProvider>
      <CaptureContext />
      <VehiclePurchaseStep index={STEP_INDEX} panelRef={noop} wrapperRef={noop} scrollToIndex={noop} />
    </CalculatorProvider>,
  )
  act(() => calculator?.setFields({ goalId: 'car', itemPrice: '18000', vehicleMethod, term }))
}

const methodChip = (label: string) => screen.getByRole('button', { name: label })
/** The term the step currently holds — the value derive/vehicle.ts will read. */
const currentTerm = () => calculator?.state.term
/** The term as the slider shows it, so the read-out can't drift from state. */
const termSliderValue = () => Number(screen.getByRole<HTMLInputElement>('slider', { name: 'Term length' }).value)

describe('VehiclePurchaseStep term clamping', () => {
  afterEach(() => {
    cleanup()
    calculator = null
  })

  it("clamps a too-long term down to the new method's maximum", () => {
    // A bank loan runs longer than a PCP is ever sold over.
    const startTerm = TERM_RANGES.loan.max
    renderPurchaseStep(startTerm, 'loan')
    expect(currentTerm()).toBe(startTerm)

    act(() => {
      fireEvent.click(methodChip('PCP'))
    })

    expect(currentTerm()).toBe(TERM_RANGES.pcp.max)
    expect(termSliderValue()).toBe(TERM_RANGES.pcp.max)
  })

  it("clamps a too-short term up to the new method's minimum", () => {
    const startTerm = TERM_RANGES.pcp.min - 6
    renderPurchaseStep(startTerm, 'pcp')
    expect(currentTerm()).toBe(startTerm)

    act(() => {
      fireEvent.click(methodChip('Hire purchase'))
    })

    expect(currentTerm()).toBe(TERM_RANGES.hp.min)
    expect(termSliderValue()).toBe(TERM_RANGES.hp.min)
  })

  it('leaves a term already inside the new range untouched', () => {
    // Comfortably inside both PCP's and HP's bounds.
    const startTerm = Math.round((TERM_RANGES.pcp.min + TERM_RANGES.pcp.max) / 2)
    renderPurchaseStep(startTerm, 'pcp')

    act(() => {
      fireEvent.click(methodChip('Hire purchase'))
    })

    expect(currentTerm()).toBe(startTerm)
    expect(termSliderValue()).toBe(startTerm)
  })

  it('leaves the term completely untouched when switching to cash', () => {
    // Deliberately outside every finance range: cash has nothing to clamp
    // against, and clobbering a term the user won't see again would surprise
    // them if they switched back.
    const startTerm = TERM_RANGES.loan.max + 12
    renderPurchaseStep(startTerm, 'loan')
    const before = currentTerm()

    act(() => {
      fireEvent.click(methodChip('Cash'))
    })

    expect(calculator?.state.vehicleMethod).toBe('cash')
    expect(currentTerm()).toBe(before)
    expect(currentTerm()).toBe(startTerm)
    // Cash shows no agreement, so there's no term slider to read it back from.
    expect(screen.queryByRole('slider', { name: 'Term length' })).toBeNull()
  })

  it('re-clamps on the way back out of cash', () => {
    // The term cash preserved is still out of range for a PCP, so selecting
    // one has to clamp it then — the cash branch defers the clamp, it doesn't
    // cancel it.
    renderPurchaseStep(TERM_RANGES.loan.max, 'loan')

    act(() => {
      fireEvent.click(methodChip('Cash'))
    })
    expect(currentTerm()).toBe(TERM_RANGES.loan.max)

    act(() => {
      fireEvent.click(methodChip('PCP'))
    })

    expect(currentTerm()).toBe(TERM_RANGES.pcp.max)
  })

  it('records the chosen method on every branch', () => {
    renderPurchaseStep(TERM_RANGES.pcp.min, 'cash')

    for (const [label, method] of [
      ['PCP', 'pcp'],
      ['Hire purchase', 'hp'],
      ['Bank loan', 'loan'],
      ['Cash', 'cash'],
    ] as const) {
      act(() => {
        fireEvent.click(methodChip(label))
      })
      expect(calculator?.state.vehicleMethod).toBe(method)
      expect(methodChip(label).getAttribute('aria-pressed')).toBe('true')
    }
  })
})
