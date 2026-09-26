// @vitest-environment jsdom
import { useState } from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { LabeledUnitField } from './LabeledUnitField'

const ACCENT = 'rgb(124, 207, 255)'

// A number input is exposed as role="spinbutton", not "textbox".
const getInput = () => screen.getByRole<HTMLInputElement>('spinbutton')

/** A controlled harness, mirroring the vehicle flow's mileage / mpg / fuel-price fields. */
function Harness({ initial = '' }: { initial?: string }) {
  const [value, setValue] = useState(initial)
  return <LabeledUnitField label="Annual mileage" unit="miles" value={value} onChange={setValue} />
}

describe('LabeledUnitField', () => {
  afterEach(cleanup)

  it('underlines with the neutral idle color before focus', () => {
    render(<LabeledUnitField label="Annual mileage" unit="miles" value="" onChange={() => {}} accentColor={ACCENT} />)
    expect(getInput().style.borderBottom).toContain('var(--input-underline)')
  })

  it('switches the underline to the accent color while focused, and back on blur', () => {
    render(<LabeledUnitField label="Annual mileage" unit="miles" value="" onChange={() => {}} accentColor={ACCENT} />)

    fireEvent.focus(getInput())
    expect(getInput().style.borderBottom).toContain(ACCENT)

    fireEvent.blur(getInput())
    expect(getInput().style.borderBottom).toContain('var(--input-underline)')
    expect(getInput().style.borderBottom).not.toContain(ACCENT)
  })

  it('falls back to the neutral primary-text accent when none is given', () => {
    // Matches LabeledMoneyField, so the two sit together without one of them
    // lighting up in a mode color the other does not have.
    render(<LabeledUnitField label="Annual mileage" unit="miles" value="" onChange={() => {}} />)
    fireEvent.focus(getInput())
    expect(getInput().style.borderBottom).toContain('var(--text-primary)')
  })

  it('renders whichever unit suffix it was given', () => {
    for (const unit of ['miles', 'mpg', 'p/litre']) {
      const { unmount } = render(<LabeledUnitField label="Field" unit={unit} value="" onChange={() => {}} />)
      expect(screen.getByText(unit)).toBeTruthy()
      unmount()
    }
  })

  it('keeps the unit out of the input’s own value, so nothing reads "30000 miles" as the number', () => {
    render(<LabeledUnitField label="Annual mileage" unit="miles" value="30000" onChange={() => {}} />)
    expect(getInput().value).toBe('30000')
    // The suffix is a sibling span, not part of the field's accessible value.
    expect(getInput().textContent).toBe('')
  })

  it('reports the native number input’s raw string value to onChange, uncoerced', () => {
    // Call sites keep these values as strings so a half-typed field stays
    // exactly as typed; a Number() here would turn "" into 0.
    const onChange = vi.fn()
    render(<LabeledUnitField label="Annual mileage" unit="miles" value="" onChange={onChange} />)

    fireEvent.change(getInput(), { target: { value: '12000' } })
    expect(onChange).toHaveBeenCalledExactlyOnceWith('12000')
    expect(onChange.mock.calls[0][0]).toBeTypeOf('string')
  })

  it('allows clearing the field back to empty rather than coercing to 0', () => {
    render(<Harness initial="12000" />)
    fireEvent.change(getInput(), { target: { value: '' } })
    expect(getInput().value).toBe('')
  })

  it('is a numeric input floored at 0', () => {
    render(<LabeledUnitField label="Annual mileage" unit="miles" value="" onChange={() => {}} />)
    expect(getInput().type).toBe('number')
    expect(getInput().min).toBe('0')
  })

  it('renders its label alongside the field', () => {
    render(<LabeledUnitField label="Annual mileage" unit="miles" value="" onChange={() => {}} />)
    expect(screen.getByText('Annual mileage')).toBeTruthy()
  })

  it('forwards keystrokes to a caller-supplied onKeyDown', () => {
    const onKeyDown = vi.fn()
    render(<LabeledUnitField label="Annual mileage" unit="miles" value="" onChange={() => {}} onKeyDown={onKeyDown} />)

    fireEvent.keyDown(getInput(), { key: 'Enter' })
    expect(onKeyDown).toHaveBeenCalledTimes(1)
    expect(onKeyDown.mock.calls[0][0]).toMatchObject({ key: 'Enter' })
  })
})
