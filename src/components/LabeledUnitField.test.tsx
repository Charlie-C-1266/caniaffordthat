// @vitest-environment jsdom
import { useState } from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { LabeledUnitField } from './LabeledUnitField'

const ACCENT = 'rgb(124, 207, 255)'

// A number input is exposed as role="spinbutton", not "textbox".
const getInput = () => screen.getByRole<HTMLInputElement>('spinbutton')

/**
 * The field's rendered underline, read from whichever element carries it —
 * the input itself, or an ancestor when the unit suffix sits in the flow
 * beside the input and the rule has to span both. These tests are about the
 * focus colour, so they assert on the underline rather than on which element
 * happens to own it.
 */
function underline(): string {
  // An element with no border of its own still reports the shorthand's
  // default width ('medium'), so match on the declared rule, not truthiness.
  for (let el: HTMLElement | null = getInput(); el; el = el.parentElement) {
    if (el.style.borderBottom.includes('solid')) return el.style.borderBottom
  }
  throw new Error('expected the field to render an underline')
}

/** A controlled harness, mirroring the vehicle flow's mileage / mpg / fuel-price fields. */
function Harness({ label = 'Annual mileage', unit = 'miles', initial = '' }: { label?: string; unit?: string; initial?: string }) {
  const [value, setValue] = useState(initial)
  return <LabeledUnitField label={label} unit={unit} value={value} onChange={setValue} />
}

describe('LabeledUnitField', () => {
  afterEach(cleanup)

  it('associates its label with the unit input, so the field is reachable by its name', () => {
    render(<Harness label="Fuel price" unit="p/litre" />)

    const input = screen.getByLabelText('Fuel price')
    expect(input.tagName).toBe('INPUT')
    expect(input.getAttribute('type')).toBe('number')
    // The unit suffix stays decoration beside the input, not part of its name.
    expect(screen.getByText('p/litre')).toBeTruthy()
  })

  it('points the label at the input it actually wraps', () => {
    const { container } = render(<Harness label="Annual mileage" unit="miles" />)

    const label = container.querySelector('label')!
    const input = container.querySelector('input')!
    expect(label.getAttribute('for')).toBeTruthy()
    expect(label.getAttribute('for')).toBe(input.id)
  })

  it('gives each instance its own id, so sibling running-cost fields stay distinct', () => {
    const { container } = render(
      <>
        <Harness label="Annual mileage" unit="miles" />
        <Harness label="Fuel economy" unit="mpg" />
      </>,
    )

    const ids = Array.from(container.querySelectorAll('input')).map((input) => input.id)
    expect(new Set(ids).size).toBe(2)
    expect(screen.getByLabelText('Annual mileage')).not.toBe(screen.getByLabelText('Fuel economy'))
  })

  it('underlines with the neutral idle colour before focus', () => {
    render(<LabeledUnitField label="Annual mileage" unit="miles" value="" onChange={() => {}} accentColor={ACCENT} />)
    expect(underline()).toContain('var(--input-underline)')
  })

  it('switches the underline to the accent colour while focused, and back on blur', () => {
    render(<LabeledUnitField label="Annual mileage" unit="miles" value="" onChange={() => {}} accentColor={ACCENT} />)

    fireEvent.focus(getInput())
    expect(underline()).toContain(ACCENT)

    fireEvent.blur(getInput())
    expect(underline()).toContain('var(--input-underline)')
    expect(underline()).not.toContain(ACCENT)
  })

  it('falls back to the neutral primary-text accent when none is given', () => {
    // Matches LabeledMoneyField, so the two sit together without one of them
    // lighting up in a mode colour the other does not have.
    render(<LabeledUnitField label="Annual mileage" unit="miles" value="" onChange={() => {}} />)
    fireEvent.focus(getInput())
    expect(underline()).toContain('var(--text-primary)')
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
