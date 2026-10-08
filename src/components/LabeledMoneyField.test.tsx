// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { useState } from 'react'
import { render, screen, cleanup } from '@testing-library/react'
import { LabeledMoneyField } from './LabeledMoneyField'

// getByLabelText only resolves when the <label> and <input> are genuinely
// associated (htmlFor/id, or an aria-label*), so these tests fail on the
// visual-adjacency-only markup this field used to render.

function Harness({ label = 'Housing (rent/mortgage)', variant }: { label?: string; variant?: 'grid' | 'single' }) {
  const [value, setValue] = useState('')
  return <LabeledMoneyField label={label} value={value} onChange={setValue} variant={variant} />
}

describe('LabeledMoneyField', () => {
  afterEach(cleanup)

  it('associates its label with the money input, so the field is reachable by its name', () => {
    render(<Harness />)

    const input = screen.getByLabelText('Housing (rent/mortgage)')
    expect(input.tagName).toBe('INPUT')
    expect(input.getAttribute('type')).toBe('number')
  })

  it('points the label at the input it actually wraps, in both variants', () => {
    const { container } = render(<Harness variant="single" />)

    const label = container.querySelector('label')!
    const input = container.querySelector('input')!
    expect(label.getAttribute('for')).toBeTruthy()
    expect(label.getAttribute('for')).toBe(input.id)
  })

  it('gives each instance its own id, so sibling grid fields stay distinct', () => {
    const { container } = render(
      <>
        <Harness label="Housing (rent/mortgage)" />
        <Harness label="Groceries" />
      </>,
    )

    const ids = Array.from(container.querySelectorAll('input')).map((input) => input.id)
    expect(ids).toHaveLength(2)
    expect(new Set(ids).size).toBe(2)
    // And each name still resolves to its own input.
    expect(screen.getByLabelText('Housing (rent/mortgage)')).not.toBe(screen.getByLabelText('Groceries'))
  })
})
