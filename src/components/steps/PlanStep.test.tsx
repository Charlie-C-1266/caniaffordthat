// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react'
import { PlanStep } from './PlanStep'
import { CalculatorProvider } from '../../state/CalculatorProvider'
import { useCalculator, type CalculatorContextValue } from '../../state/calculatorContext'

// DurationInput seeds the "Fixed amount" field with the current %-equivalent
// the first time the user switches to it, so the handoff between the two
// saving-rate inputs doesn't blank the figure they were just looking at.
// e2e/core-flow.spec.ts clicks "Fixed amount" but immediately fills over the
// field, so the seeded value itself is only asserted here.

// £2,000 take-home less £800 housing = £1,200 spare cash; at the default 25%
// rate that makes the %-equivalent £300.
const TAKE_HOME = '2000'
const HOUSING = '800'
const SPARE_CASH = 1200
const RATE_PCT = 25
const RATE_AMOUNT = String((SPARE_CASH * RATE_PCT) / 100) // '300'

const STEP_INDEX = 3
const noop = () => {}

let calculator: CalculatorContextValue | null = null

/** Exposes the provider's context so a test can seed the budget the earlier steps would have captured. */
function CaptureContext() {
  calculator = useCalculator()
  return null
}

/**
 * Renders the Plan step on a saving plan with a known spare cash figure.
 * `monthlyAmount` seeds the fixed-amount field as if the user had already
 * typed into it.
 */
function renderDurationPlan(monthlyAmount = '') {
  render(
    <CalculatorProvider>
      <CaptureContext />
      <PlanStep index={STEP_INDEX} panelRef={noop} wrapperRef={noop} />
    </CalculatorProvider>,
  )
  act(() =>
    calculator?.setFields({
      mode: 'save',
      saveFlavor: 'duration',
      takeHome: TAKE_HOME,
      housing: HOUSING,
      rate: RATE_PCT,
      monthlyAmount,
    }),
  )
}

const fixedAmountButton = () => screen.getByRole('button', { name: 'Fixed amount' })
const percentButton = () => screen.getByRole('button', { name: '% of spare cash' })
/** The "Monthly saving" money input — only rendered while the fixed-amount mode is active. */
const amountInput = () => screen.getByRole<HTMLInputElement>('spinbutton')

describe('PlanStep fixed-amount seeding', () => {
  afterEach(() => {
    cleanup()
    calculator = null
  })

  it('starts on the % slider, with the %-equivalent shown in its read-out', () => {
    renderDurationPlan()

    expect(percentButton().getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('slider', { name: "Share of spare cash you'll save" })).toBeTruthy()
    // The figure the seeding is expected to carry over, as the user sees it.
    expect(screen.getByText(`${RATE_PCT}% · £${RATE_AMOUNT}/mo`)).toBeTruthy()
  })

  it('seeds the blank amount field with the %-equivalent when switching to "Fixed amount"', () => {
    renderDurationPlan()

    fireEvent.click(fixedAmountButton())

    // Asserted before anything is typed — the value is the seed itself, not a
    // leftover or a blank field.
    expect(amountInput().value).toBe(RATE_AMOUNT)
    expect(fixedAmountButton().getAttribute('aria-pressed')).toBe('true')
  })

  it('does not overwrite an amount the user has already typed', () => {
    renderDurationPlan('450')

    fireEvent.click(fixedAmountButton())

    expect(amountInput().value).toBe('450')
  })

  it('seeds from the rate the user actually chose, not the default', () => {
    renderDurationPlan()

    fireEvent.change(screen.getByRole('slider', { name: "Share of spare cash you'll save" }), { target: { value: '50' } })
    fireEvent.click(fixedAmountButton())

    expect(amountInput().value).toBe('600') // 50% of £1,200
  })

  it('leaves the typed amount alone when toggling back to % and forward again', () => {
    renderDurationPlan()

    fireEvent.click(fixedAmountButton())
    fireEvent.change(amountInput(), { target: { value: '175' } })
    fireEvent.click(percentButton())
    fireEvent.click(fixedAmountButton())

    // Seeding is one-time: the second switch must not clobber £175 with £300.
    expect(amountInput().value).toBe('175')
  })

  it('leaves the field blank when there is no spare cash to seed from', () => {
    render(
      <CalculatorProvider>
        <CaptureContext />
        <PlanStep index={STEP_INDEX} panelRef={noop} wrapperRef={noop} />
      </CalculatorProvider>,
    )
    // No take-home captured yet, so rateAmount is 0 — seeding '0' would be
    // worse than leaving the placeholder showing.
    act(() => calculator?.setFields({ mode: 'save', saveFlavor: 'duration' }))

    fireEvent.click(fixedAmountButton())

    expect(amountInput().value).toBe('')
  })
})
