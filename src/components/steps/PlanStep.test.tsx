// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react'
import { PlanStep } from './PlanStep'
import { CalculatorProvider } from '../../state/CalculatorProvider'
import { useCalculator, type CalculatorContextValue } from '../../state/calculatorContext'
import { monthYearFromMonths } from '../../lib/calculations'
import type { CalculatorState } from '../../state/types'

// DurationInput seeds the "Fixed amount" field with the current %-equivalent
// the first time the user switches to it, so the handoff between the two
// saving-rate inputs doesn't blank the figure they were just looking at.
// e2e/core-flow.spec.ts clicks "Fixed amount" but immediately fills over the
// field, so the seeded value itself is only asserted here.
//
// The rest of the step was reached only by that one path. This file now also
// covers the two other faces it has — the goal-date flavour and the whole
// finance-mode branch (a different heading, a term slider and an APR slider,
// none of which the saving flavours render) — plus the "% of spare cash"
// caption under the fixed-amount field, which is the only place the step
// tells someone they've over-committed.

// £2,000 take-home less £800 housing = £1,200 spare cash; at the default 25%
// rate that makes the %-equivalent £300.
const TAKE_HOME = '2000'
const HOUSING = '800'
const SPARE_CASH = 1200
const RATE_PCT = 25
const RATE_AMOUNT = String((SPARE_CASH * RATE_PCT) / 100) // '300'
// Either caption the fixed-amount field can carry. Both end in a full stop,
// which keeps this clear of the "% of spare cash" toggle button's own text.
const CAPTION_TEXT = /spare cash( a month)?\.$/

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

/** Renders the Plan step with arbitrary seeded state, for the flavours and modes the duration helper doesn't cover. */
function renderPlanStep(state: Partial<CalculatorState>) {
  render(
    <CalculatorProvider>
      <CaptureContext />
      <PlanStep index={STEP_INDEX} panelRef={noop} wrapperRef={noop} />
    </CalculatorProvider>,
  )
  act(() => calculator?.setFields(state))
}

const fixedAmountButton = () => screen.getByRole('button', { name: 'Fixed amount' })
const percentButton = () => screen.getByRole('button', { name: '% of spare cash' })
/** The "Monthly saving" money input — only rendered while the fixed-amount mode is active. */
const amountInput = () => screen.getByRole<HTMLInputElement>('spinbutton')
const durationButton = () => screen.getByRole('button', { name: 'How long will it take?' })
const goalDateButton = () => screen.getByRole('button', { name: 'I have a goal date' })
/** The masked MM-YYYY field — only rendered on the goal-date flavour. */
const goalDateInput = () => screen.getByPlaceholderText<HTMLInputElement>('MM-YYYY')
const slider = (name: string) => screen.getByRole<HTMLInputElement>('slider', { name })
const heading = () => screen.getByRole('heading', { level: 1 })

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
    // No take-home captured yet, so rateAmount is 0 — seeding '0' would be
    // worse than leaving the placeholder showing.
    renderPlanStep({ mode: 'save', saveFlavor: 'duration' })

    fireEvent.click(fixedAmountButton())

    expect(amountInput().value).toBe('')
  })

  it('writes what is typed into the amount field', () => {
    renderDurationPlan('450')

    fireEvent.click(fixedAmountButton())
    fireEvent.change(amountInput(), { target: { value: '275' } })

    expect(calculator?.state.monthlyAmount).toBe('275')
  })
})

describe('PlanStep fixed-amount caption', () => {
  afterEach(() => {
    cleanup()
    calculator = null
  })

  it('reads the amount back as a share of spare cash', () => {
    renderDurationPlan('300')

    fireEvent.click(fixedAmountButton())

    expect(screen.getByText(`25% of your £${SPARE_CASH.toLocaleString('en-GB')} spare cash.`)).toBeTruthy()
  })

  it('says so plainly when the amount is more than there is to spare', () => {
    // The one place the step pushes back: £1,500 out of £1,200 can't be saved,
    // and silently charting it would promise a date that never arrives.
    renderDurationPlan('1500')

    fireEvent.click(fixedAmountButton())

    expect(screen.getByText(`That's more than your £${SPARE_CASH.toLocaleString('en-GB')} spare cash a month.`)).toBeTruthy()
    expect(screen.queryByText(/% of your/)).toBeNull()
  })

  it('treats an amount exactly equal to spare cash as a share, not an overrun', () => {
    renderDurationPlan(String(SPARE_CASH))

    fireEvent.click(fixedAmountButton())

    expect(screen.getByText(`100% of your £${SPARE_CASH.toLocaleString('en-GB')} spare cash.`)).toBeTruthy()
  })

  it('shows no caption before an amount is typed', () => {
    renderPlanStep({ mode: 'save', saveFlavor: 'duration', rateMode: 'amount', takeHome: TAKE_HOME, housing: HOUSING })

    expect(screen.queryByText(CAPTION_TEXT)).toBeNull()
  })

  it('shows no caption when there is no spare cash to compare against', () => {
    // Dividing by zero spare cash would render "Infinity% of £0".
    renderPlanStep({ mode: 'save', saveFlavor: 'duration', rateMode: 'amount', monthlyAmount: '300' })

    expect(screen.queryByText(CAPTION_TEXT)).toBeNull()
  })
})

describe('PlanStep goal-date flavour', () => {
  afterEach(() => {
    cleanup()
    calculator = null
  })

  it('swaps the duration inputs for a goal-date field', () => {
    renderDurationPlan()

    fireEvent.click(goalDateButton())

    expect(calculator?.state.saveFlavor).toBe('goal')
    expect(goalDateInput()).toBeTruthy()
    // The % / fixed-amount choice belongs to the duration flavour only.
    expect(screen.queryByRole('button', { name: 'Fixed amount' })).toBeNull()
    expect(screen.queryByRole('slider', { name: "Share of spare cash you'll save" })).toBeNull()
  })

  it('commits a typed date as months from now', () => {
    // Built from the same helper the field displays with, so the case doesn't
    // go stale as the calendar moves.
    renderPlanStep({ mode: 'save', saveFlavor: 'goal' })

    fireEvent.change(goalDateInput(), { target: { value: monthYearFromMonths(18) } })

    expect(calculator?.state.goalMonths).toBe(18)
  })

  it('keeps the savings-interest slider, which both flavours share', () => {
    renderPlanStep({ mode: 'save', saveFlavor: 'goal' })

    expect(slider('Expected savings interest (optional)')).toBeTruthy()
  })

  it('switches back to the duration flavour', () => {
    renderPlanStep({ mode: 'save', saveFlavor: 'goal' })

    fireEvent.click(durationButton())

    expect(calculator?.state.saveFlavor).toBe('duration')
    expect(screen.queryByPlaceholderText('MM-YYYY')).toBeNull()
    expect(percentButton()).toBeTruthy()
  })
})

describe('PlanStep savings interest', () => {
  afterEach(() => {
    cleanup()
    calculator = null
  })

  it('writes the chosen rate and reads it back', () => {
    renderDurationPlan()

    fireEvent.change(slider('Expected savings interest (optional)'), { target: { value: '4.5' } })

    expect(calculator?.state.growth).toBe(4.5)
    expect(slider('Expected savings interest (optional)').getAttribute('aria-valuetext')).toBe('4.5%')
  })

  it('starts at zero — an optional field nobody has to think about', () => {
    renderDurationPlan()

    expect(slider('Expected savings interest (optional)').value).toBe('0')
    expect(slider('Expected savings interest (optional)').getAttribute('aria-valuetext')).toBe('0%')
  })
})

describe('PlanStep finance mode', () => {
  afterEach(() => {
    cleanup()
    calculator = null
  })

  /** Paying monthly rather than saving up — the step's other half entirely. */
  const renderFinancePlan = (state: Partial<CalculatorState> = {}) => renderPlanStep({ mode: 'monthly', ...state })

  it('asks about the term and the rate, not the timeframe', () => {
    renderFinancePlan()

    expect(heading().textContent).toBe('Term and rate?')
    expect(screen.getByText(`Step ${STEP_INDEX} — Finance details`)).toBeTruthy()
    // None of the saving-plan controls belong here.
    expect(screen.queryByRole('button', { name: 'I have a goal date' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Fixed amount' })).toBeNull()
    expect(screen.queryByRole('slider', { name: 'Expected savings interest (optional)' })).toBeNull()
  })

  it('writes the chosen term', () => {
    renderFinancePlan()

    fireEvent.change(slider('Term length'), { target: { value: '36' } })

    expect(calculator?.state.term).toBe(36)
    expect(slider('Term length').getAttribute('aria-valuetext')).toBe('36 months')
  })

  it('says "1 month", not "1 months", at the bottom of the range', () => {
    renderFinancePlan({ term: 1 })

    expect(slider('Term length').getAttribute('aria-valuetext')).toBe('1 month')
  })

  it('runs from one month to five years', () => {
    renderFinancePlan()

    expect(slider('Term length').getAttribute('min')).toBe('1')
    expect(slider('Term length').getAttribute('max')).toBe('60')
  })

  it('accepts the longest term the slider offers', () => {
    renderFinancePlan()

    fireEvent.change(slider('Term length'), { target: { value: '60' } })

    expect(calculator?.state.term).toBe(60)
    expect(slider('Term length').getAttribute('aria-valuetext')).toBe('60 months')
  })

  it('writes the APR, over a wider range than savings interest', () => {
    // Borrowing rates run to 30%; savings interest stops at 20%.
    renderFinancePlan()

    fireEvent.change(slider('Interest rate (APR)'), { target: { value: '9.9' } })

    expect(calculator?.state.growth).toBe(9.9)
    expect(slider('Interest rate (APR)').getAttribute('aria-valuetext')).toBe('9.9%')
    expect(slider('Interest rate (APR)').getAttribute('max')).toBe('30')
  })

  it('accepts a 0% APR', () => {
    renderFinancePlan({ growth: 9.9 })

    fireEvent.change(slider('Interest rate (APR)'), { target: { value: '0' } })

    expect(calculator?.state.growth).toBe(0)
    expect(slider('Interest rate (APR)').getAttribute('aria-valuetext')).toBe('0%')
  })
})
