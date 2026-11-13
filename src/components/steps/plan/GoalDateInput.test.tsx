// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { screen, cleanup, fireEvent } from '@testing-library/react'
import { renderWithCalculator, calculator } from '../../../test/renderWithCalculator'
import { GoalDateInput } from './GoalDateInput'
import { monthYearFromMonths } from '../../../lib/calculations'

// The "I have a goal date" field. The component itself is three lines, and
// each one is there for a reason that a test can hold:
//
//  - the `useId` pairing of FieldLabel to MonthYearInput. Without `htmlFor`
//    the two are only *visually* associated, and a screen reader announces an
//    unnamed text field. `getByLabelText` is exactly the query that fails
//    when that breaks, so it is used deliberately here rather than
//    `getByRole`.
//  - `minMonths={1}`, the "next month at the earliest" floor. A goal date in
//    the current month or the past would divide the target by zero or fewer
//    months.
//  - writing through `setField('goalMonths', …)` rather than local state, so
//    the rest of the flow and the shareable link see the date.
//
// MonthYearInput's own masking and draft behaviour are pinned in
// MonthYearInput.test.tsx; this file covers the wiring around it.

const ACCENT = 'rgb(16, 185, 129)'

const dateField = () => screen.getByLabelText<HTMLInputElement>('Goal date (MM-YYYY)')

/** Types a complete MM-YYYY value, as the masked field receives it. */
function typeDate(value: string) {
  fireEvent.change(dateField(), { target: { value } })
}

describe('GoalDateInput', () => {
  afterEach(cleanup)

  it('names its field, so the label and input are actually associated', () => {
    renderWithCalculator(<GoalDateInput accentColor={ACCENT} />)

    expect(dateField().tagName).toBe('INPUT')
  })

  it('shows the current goalMonths as a MM-YYYY date', () => {
    renderWithCalculator(<GoalDateInput accentColor={ACCENT} />, { goalMonths: 18 })

    expect(dateField().value).toBe(monthYearFromMonths(18))
  })

  it('writes a typed date back to goalMonths, not to local state', () => {
    renderWithCalculator(<GoalDateInput accentColor={ACCENT} />, { goalMonths: 12 })

    typeDate(monthYearFromMonths(30))

    expect(calculator().state.goalMonths).toBe(30)
  })

  it('commits the date the user typed, round-tripping through the shared state', () => {
    renderWithCalculator(<GoalDateInput accentColor={ACCENT} />, { goalMonths: 12 })

    typeDate(monthYearFromMonths(6))

    expect(calculator().state.goalMonths).toBe(6)
    expect(dateField().value).toBe(monthYearFromMonths(6))
  })

  it('accepts next month, the earliest date the floor allows', () => {
    renderWithCalculator(<GoalDateInput accentColor={ACCENT} />, { goalMonths: 12 })

    typeDate(monthYearFromMonths(1))

    expect(calculator().state.goalMonths).toBe(1)
  })

  it('refuses this month, which would leave no months to save over', () => {
    // minMonths={1}: a zero-month plan divides the target by zero.
    renderWithCalculator(<GoalDateInput accentColor={ACCENT} />, { goalMonths: 12 })

    typeDate(monthYearFromMonths(0))

    expect(calculator().state.goalMonths).toBe(12)
  })

  it('refuses a date in the past', () => {
    renderWithCalculator(<GoalDateInput accentColor={ACCENT} />, { goalMonths: 12 })

    typeDate(monthYearFromMonths(-6))

    expect(calculator().state.goalMonths).toBe(12)
  })

  it('leaves goalMonths alone while the date is still half-typed', () => {
    renderWithCalculator(<GoalDateInput accentColor={ACCENT} />, { goalMonths: 12 })

    typeDate('06')

    expect(calculator().state.goalMonths).toBe(12)
  })

  it('leaves goalMonths alone when the field is cleared', () => {
    renderWithCalculator(<GoalDateInput accentColor={ACCENT} />, { goalMonths: 12 })

    typeDate('')

    expect(calculator().state.goalMonths).toBe(12)
  })

  it('passes the mode accent down to the input', () => {
    // Plan is reached in finance mode too; a hard-coded green would only
    // show up there.
    renderWithCalculator(<GoalDateInput accentColor="rgb(139, 92, 246)" />)
    const input = dateField()

    expect(input.style.border).toBe('var(--border-width-card) solid var(--input-underline)')

    // MonthYearInput only takes the accent while focused.
    fireEvent.focus(input)

    expect(input.style.border).toBe('var(--border-width-card) solid rgb(139, 92, 246)')
  })
})
