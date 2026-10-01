// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { useState } from 'react'
import { render, screen, cleanup } from '@testing-library/react'
import { LabeledUnitField } from './LabeledUnitField'

function Harness({ label = 'Fuel price', unit = 'p/litre' }: { label?: string; unit?: string }) {
  const [value, setValue] = useState('')
  return <LabeledUnitField label={label} unit={unit} value={value} onChange={setValue} />
}

describe('LabeledUnitField', () => {
  afterEach(cleanup)

  it('associates its label with the unit input, so the field is reachable by its name', () => {
    render(<Harness />)

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
})
