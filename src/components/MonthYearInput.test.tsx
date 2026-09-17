// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { MonthYearInput } from './MonthYearInput'
import { monthYearFromMonths, monthsFromMonthYear } from '../lib/calculations'

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
})
