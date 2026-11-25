// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { MonthYearInput } from './MonthYearInput'
import { monthYearError, monthYearFromMonths, monthsFromMonthYear } from '../lib/calculations'

// The goal-date field's floor is "next month" — mirror that here.
const MIN_MONTHS = 1

// Everything is relative to the current month (the committed `months` prop is
// "months from now"), so targets are derived via the same exported helpers
// the component uses rather than hard-coding dates that would rot.
const COMMITTED = 12
const COMMITTED_DRAFT = monthYearFromMonths(COMMITTED)
const TARGET = 18
const TARGET_DRAFT = monthYearFromMonths(TARGET)

const getInput = () => screen.getByPlaceholderText<HTMLInputElement>('MM-YYYY')

function renderInput(onChange = vi.fn(), months = COMMITTED) {
  render(<MonthYearInput months={months} minMonths={MIN_MONTHS} accentColor="#4ade80" onChange={onChange} />)
  return onChange
}

describe('MonthYearInput', () => {
  afterEach(cleanup)

  it('renders the committed months as an MM-YYYY draft', () => {
    renderInput()
    expect(getInput().value).toBe(COMMITTED_DRAFT)
  })

  it('commits a typed, valid, in-range MM-YYYY as the correct month count', () => {
    const onChange = renderInput()
    fireEvent.change(getInput(), { target: { value: TARGET_DRAFT } })
    expect(onChange).toHaveBeenCalledWith(TARGET)
  })

  it('does not commit a date below minMonths', () => {
    const onChange = renderInput()
    // The current month parses to 0 months from now — below the floor of 1.
    fireEvent.change(getInput(), { target: { value: monthYearFromMonths(0) } })
    expect(onChange).not.toHaveBeenCalled()
    // Sanity: the value really was a fully valid date, just out of range.
    expect(monthsFromMonthYear(monthYearFromMonths(0))).toBe(0)
  })

  it('masks typed digits to the MM-YYYY shape, auto-inserting the hyphen', () => {
    renderInput()
    fireEvent.change(getInput(), { target: { value: '0' } })
    expect(getInput().value).toBe('0')
    fireEvent.change(getInput(), { target: { value: '09' } })
    expect(getInput().value).toBe('09-')
  })

  it('lets backspace fall through the auto-inserted hyphen instead of stickily re-adding it', () => {
    renderInput()
    // Type up to the auto-hyphen: "09" masks to "09-".
    fireEvent.change(getInput(), { target: { value: '0' } })
    fireEvent.change(getInput(), { target: { value: '09' } })
    expect(getInput().value).toBe('09-')
    // Backspacing the hyphen surfaces as a change to "09". Without the
    // fall-through, the mask would immediately re-add the hyphen and the
    // field could never be deleted past it.
    fireEvent.change(getInput(), { target: { value: '09' } })
    expect(getInput().value).toBe('09')
  })

  it('snaps back to the last committed value on blur with a partial draft', () => {
    const onChange = renderInput()
    const input = getInput()
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: '09' } })
    expect(input.value).toBe('09')
    fireEvent.blur(input)
    expect(input.value).toBe(COMMITTED_DRAFT)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('commits the current draft on Enter when it is valid', () => {
    const onChange = renderInput()
    const input = getInput()
    fireEvent.change(input, { target: { value: TARGET_DRAFT } })
    onChange.mockClear()
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith(TARGET)
  })

  it('commits on Enter only — any other key leaves committing to the change handler', () => {
    const onChange = renderInput()
    const input = getInput()
    fireEvent.change(input, { target: { value: TARGET_DRAFT } })
    onChange.mockClear()
    // Keys that aren't Enter must fall through untouched: the draft is already
    // committed by handleChange as it's typed, and re-committing here would fire
    // a redundant onChange on every keystroke (including Tab out of the field).
    for (const key of ['Tab', 'Escape', 'ArrowUp', '1']) {
      fireEvent.keyDown(input, { key })
    }
    expect(onChange).not.toHaveBeenCalled()
    expect(input.value).toBe(TARGET_DRAFT)
  })

  it('does not commit on Enter while the draft is partial', () => {
    const onChange = renderInput()
    const input = getInput()
    fireEvent.change(input, { target: { value: '09' } })
    onChange.mockClear()
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('follows an external months change while unfocused (e.g. "Start over")', () => {
    const { rerender } = render(<MonthYearInput months={COMMITTED} minMonths={MIN_MONTHS} accentColor="#4ade80" onChange={vi.fn()} />)
    expect(getInput().value).toBe(COMMITTED_DRAFT)
    rerender(<MonthYearInput months={TARGET} minMonths={MIN_MONTHS} accentColor="#4ade80" onChange={vi.fn()} />)
    expect(getInput().value).toBe(TARGET_DRAFT)
  })

  it('does not clobber an in-progress edit when months changes while focused', () => {
    const { rerender } = render(<MonthYearInput months={COMMITTED} minMonths={MIN_MONTHS} accentColor="#4ade80" onChange={vi.fn()} />)
    const input = getInput()
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: '09' } })
    rerender(<MonthYearInput months={TARGET} minMonths={MIN_MONTHS} accentColor="#4ade80" onChange={vi.fn()} />)
    expect(input.value).toBe('09')
    // Once focus leaves, the field re-syncs to the (new) committed value.
    fireEvent.blur(input)
    expect(input.value).toBe(TARGET_DRAFT)
  })

  it('puts the id it is given on the input, so the goal-date FieldLabel can point at it', () => {
    render(<MonthYearInput id="goal-date" months={COMMITTED} minMonths={MIN_MONTHS} accentColor="#4ade80" onChange={vi.fn()} />)
    expect(getInput().id).toBe('goal-date')
  })
})

// #287: a complete date the field wouldn't commit was dropped in silence.
// Typing `01-2020` left `01-2020` on screen while the result was still worked
// out from the previous date, on blur the draft quietly snapped back with no
// explanation, and nothing marked the field invalid for assistive tech — WCAG
// 2.2 SC 3.3.1 Error Identification (A).
/** The inline message's text, or '' when nothing is being said. */
const messageText = () => screen.getByRole('status').textContent

describe('MonthYearInput error identification (#287)', () => {
  afterEach(cleanup)

  const RANGE_MESSAGE = `Pick a month from ${monthYearFromMonths(MIN_MONTHS)} onwards.`
  const MONTH_MESSAGE = 'Enter a month between 01 and 12.'

  it('shows a message and marks the field invalid for a past date', () => {
    renderInput()
    fireEvent.change(getInput(), { target: { value: '01-2020' } })

    expect(messageText()).toBe(RANGE_MESSAGE)
    expect(getInput().getAttribute('aria-invalid')).toBe('true')
    // The message is the input's description, so it is read with the field.
    expect(getInput().getAttribute('aria-describedby')).toBe(screen.getByRole('status').id)
    expect(screen.getByRole('status').id).not.toBe('')
  })

  it('announces the message politely, from a region that is already on the page', () => {
    // A live region added at the same moment it gains content is unreliably
    // announced; this one is always in the DOM, empty until there is something
    // to say.
    renderInput()
    const region = screen.getByRole('status')
    expect(region.getAttribute('aria-live')).toBe('polite')
    expect(region.textContent).toBe('')

    fireEvent.change(getInput(), { target: { value: '01-2020' } })
    expect(screen.getByRole('status')).toBe(region)
    expect(region.textContent).toBe(RANGE_MESSAGE)
  })

  it.each([
    ['month 00', '00-2030'],
    ['month 13', '13-2030'],
  ])('shows the month-range message for %s', (_case, draft) => {
    renderInput()
    fireEvent.change(getInput(), { target: { value: draft } })

    expect(messageText()).toBe(MONTH_MESSAGE)
    expect(getInput().getAttribute('aria-invalid')).toBe('true')
  })

  it('accepts a date exactly at minMonths and flags the month before it', () => {
    renderInput()
    const input = getInput()

    fireEvent.change(input, { target: { value: monthYearFromMonths(MIN_MONTHS) } })
    expect(messageText()).toBe('')
    expect(input.hasAttribute('aria-invalid')).toBe(false)

    fireEvent.change(input, { target: { value: monthYearFromMonths(MIN_MONTHS - 1) } })
    expect(messageText()).toBe(RANGE_MESSAGE)
  })

  it('flags the current month, which is one before the floor', () => {
    renderInput()
    fireEvent.change(getInput(), { target: { value: monthYearFromMonths(0) } })

    expect(messageText()).toBe(RANGE_MESSAGE)
    expect(getInput().getAttribute('aria-invalid')).toBe('true')
  })

  it.each([
    ['empty', ''],
    ['one digit', '0'],
    ['a bare month', '08'],
    ['a month and hyphen', '08-'],
    ['a two-digit year', '08-20'],
    ['a three-digit year', '08-203'],
  ])('says nothing while the draft is still partial: %s', (_case, typed) => {
    renderInput()
    fireEvent.change(getInput(), { target: { value: typed } })

    expect(messageText()).toBe('')
    // Absent, not "false".
    expect(getInput().hasAttribute('aria-invalid')).toBe(false)
    expect(getInput().hasAttribute('aria-describedby')).toBe(false)
  })

  it('clears the message once the date is corrected', () => {
    const onChange = renderInput()
    const input = getInput()

    fireEvent.change(input, { target: { value: '01-2020' } })
    expect(messageText()).toBe(RANGE_MESSAGE)

    fireEvent.change(input, { target: { value: TARGET_DRAFT } })
    expect(messageText()).toBe('')
    expect(input.hasAttribute('aria-invalid')).toBe(false)
    expect(onChange).toHaveBeenCalledWith(TARGET)
  })

  it('clears the message when the field blurs and snaps back', () => {
    renderInput()
    const input = getInput()

    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: '01-2020' } })
    expect(messageText()).toBe(RANGE_MESSAGE)

    fireEvent.blur(input)
    // The snap-back restores a valid date, so a message left behind would be
    // describing a value no longer on screen.
    expect(input.value).toBe(COMMITTED_DRAFT)
    expect(messageText()).toBe('')
    expect(input.hasAttribute('aria-invalid')).toBe(false)
  })

  it('clears the message when the value changes from outside, e.g. "Start over"', () => {
    const onChange = vi.fn()
    const { rerender } = render(<MonthYearInput months={COMMITTED} minMonths={MIN_MONTHS} accentColor="#4ade80" onChange={onChange} />)
    fireEvent.change(getInput(), { target: { value: '01-2020' } })
    expect(messageText()).toBe(RANGE_MESSAGE)

    // Unfocused, so the external sync resets both the draft and the message.
    rerender(<MonthYearInput months={TARGET} minMonths={MIN_MONTHS} accentColor="#4ade80" onChange={onChange} />)
    expect(getInput().value).toBe(TARGET_DRAFT)
    expect(messageText()).toBe('')
    expect(getInput().hasAttribute('aria-invalid')).toBe(false)
  })

  it('keeps the message when Enter is pressed on an invalid draft, and still does not commit', () => {
    const onChange = renderInput()
    const input = getInput()

    fireEvent.change(input, { target: { value: '01-2020' } })
    onChange.mockClear()

    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onChange).not.toHaveBeenCalled()
    expect(messageText()).toBe(RANGE_MESSAGE)
    expect(input.getAttribute('aria-invalid')).toBe('true')
  })

  it('says nothing while the user backspaces through the hyphen', () => {
    renderInput()
    const input = getInput()

    fireEvent.change(input, { target: { value: '01-2020' } })
    expect(messageText()).toBe(RANGE_MESSAGE)

    // Deleting back past the year and the separator: each of these is a
    // partial draft, so the message goes quiet rather than nagging.
    for (const value of ['01-202', '01-20', '01-2', '01-', '01', '0', '']) {
      fireEvent.change(input, { target: { value } })
      expect(messageText(), `after "${value}"`).toBe('')
    }
  })

  it('handles the December to January rollover without a false error', () => {
    // A date one month past December of the committed year is January of the
    // next, and must be accepted like any other future month.
    renderInput()
    const december = monthYearFromMonths(COMMITTED)
    const monthsToJanuary = COMMITTED + (13 - Number(december.slice(0, 2)))

    fireEvent.change(getInput(), { target: { value: monthYearFromMonths(monthsToJanuary) } })
    expect(monthYearFromMonths(monthsToJanuary).startsWith('01')).toBe(true)
    expect(messageText()).toBe('')
  })

  it('uses UK spelling and adds no new colour', () => {
    renderInput()
    fireEvent.change(getInput(), { target: { value: '01-2020' } })
    const region = screen.getByRole('status')

    expect(region.style.fontSize).toBe('var(--fs-label)')
    expect(region.style.color).toBe('var(--text-secondary)')
  })
})

// The rule itself, apart from the component, so every boundary is pinned at
// the one place that decides it.
describe('monthYearError', () => {
  it.each([
    ['empty', ''],
    ['one digit', '0'],
    ['two digits', '08'],
    ['month and hyphen', '08-'],
    ['two-digit year', '08-20'],
    ['three-digit year', '08-203'],
  ])('returns null for a partial draft: %s', (_case, draft) => {
    expect(monthYearError(draft, MIN_MONTHS)).toBeNull()
  })

  it.each([
    ['00', '00-2030'],
    ['13', '13-2030'],
    ['99', '99-2030'],
  ])('reports month %s as out of range', (_case, draft) => {
    expect(monthYearError(draft, MIN_MONTHS)).toBe('Enter a month between 01 and 12.')
  })

  it('reports a date before the floor, naming the floor', () => {
    expect(monthYearError('01-2020', MIN_MONTHS)).toBe(`Pick a month from ${monthYearFromMonths(MIN_MONTHS)} onwards.`)
  })

  it('returns null exactly at the floor and beyond', () => {
    expect(monthYearError(monthYearFromMonths(MIN_MONTHS), MIN_MONTHS)).toBeNull()
    expect(monthYearError(monthYearFromMonths(MIN_MONTHS + 120), MIN_MONTHS)).toBeNull()
  })

  it('honours a different floor', () => {
    // minMonths is a prop; the message must name whatever floor it is given.
    expect(monthYearError(monthYearFromMonths(5), 6)).toBe(`Pick a month from ${monthYearFromMonths(6)} onwards.`)
    expect(monthYearError(monthYearFromMonths(6), 6)).toBeNull()
  })

  it('agrees with monthsFromMonthYear about what is committable', () => {
    // The message and the commit gate must never disagree: anything
    // commitIfValid would accept has no message, and vice versa.
    for (const draft of ['00-2030', '13-2030', '01-2020', monthYearFromMonths(MIN_MONTHS), monthYearFromMonths(36)]) {
      const parsed = monthsFromMonthYear(draft)
      const committable = parsed !== null && parsed >= MIN_MONTHS
      expect(monthYearError(draft, MIN_MONTHS) === null).toBe(committable)
    }
  })
})
