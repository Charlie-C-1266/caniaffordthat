// @vitest-environment jsdom
import { useState } from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { LabeledMoneyField } from './LabeledMoneyField'

// This pairs a FieldLabel with a MoneyInput for five call sites (the budget
// and essentials grids, the car deposit, the fixed monthly saving). Its own
// logic is the `variant` branch, which picks the label size and the prefix
// offset/padding that keep the "£" clear of the typed digits — the grid and
// single variants differ by 2-3px, so a swapped pair is invisible in review
// but clips the first digit on screen.

const getInput = () => screen.getByPlaceholderText<HTMLInputElement>('0')

/** The "£" glyph MoneyInput renders absolutely over the input. */
const getPrefix = (container: HTMLElement): HTMLElement => {
  const span = container.querySelector('span')
  if (!span) throw new Error('expected the money input to render a £ prefix')
  return span
}

const getLabel = (container: HTMLElement): HTMLLabelElement => {
  const el = container.querySelector('label')
  if (!el) throw new Error('expected LabeledMoneyField to render a label')
  return el
}

/** A controlled harness, mirroring how every real call site owns the value in state. */
function Harness({ label = 'Rent or mortgage', variant, initial = '' }: { label?: string; variant?: 'grid' | 'single'; initial?: string }) {
  const [value, setValue] = useState(initial)
  return <LabeledMoneyField label={label} value={value} onChange={setValue} variant={variant} />
}

describe('LabeledMoneyField', () => {
  afterEach(cleanup)

  // getByLabelText only resolves when the <label> and <input> are genuinely
  // associated (htmlFor/id), so these fail on the visual-adjacency-only
  // markup this field used to render (#91).
  it('associates its label with the money input, so the field is reachable by its name', () => {
    render(<Harness label="Housing (rent/mortgage)" />)

    const input = screen.getByLabelText('Housing (rent/mortgage)')
    expect(input.tagName).toBe('INPUT')
    expect(input.getAttribute('type')).toBe('number')
  })

  it('points the label at the input it actually wraps, in both variants', () => {
    const { container } = render(<Harness label="Housing (rent/mortgage)" variant="single" />)

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

  it('renders its label and the current value', () => {
    const { container } = render(<LabeledMoneyField label="Rent or mortgage" value="1250" onChange={() => {}} />)
    expect(getLabel(container).textContent).toBe('Rent or mortgage')
    expect(getInput().value).toBe('1250')
  })

  it('renders an empty field for an empty value, showing the placeholder', () => {
    render(<LabeledMoneyField label="Council tax" value="" onChange={() => {}} />)
    expect(getInput().value).toBe('')
    expect(getInput().placeholder).toBe('0')
  })

  it('reports typed values through onChange', () => {
    const onChange = vi.fn()
    render(<LabeledMoneyField label="Rent" value="" onChange={onChange} />)
    fireEvent.change(getInput(), { target: { value: '875' } })
    expect(onChange).toHaveBeenCalledWith('875')
  })

  it('keeps the displayed value in step with the state it drives', () => {
    render(<Harness />)
    fireEvent.change(getInput(), { target: { value: '640' } })
    expect(getInput().value).toBe('640')
  })

  it('forwards onKeyDown to the input', () => {
    const onKeyDown = vi.fn()
    render(<LabeledMoneyField label="Rent" value="" onChange={() => {}} onKeyDown={onKeyDown} />)
    // Enter-to-advance is wired this way on the budget grids.
    fireEvent.keyDown(getInput(), { key: 'Enter' })
    expect(onKeyDown).toHaveBeenCalledTimes(1)
    expect(onKeyDown.mock.calls[0][0]).toMatchObject({ key: 'Enter' })
  })

  it('takes a keystroke without an onKeyDown prop', () => {
    render(<LabeledMoneyField label="Rent" value="" onChange={() => {}} />)
    expect(() => fireEvent.keyDown(getInput(), { key: 'Enter' })).not.toThrow()
  })

  it('uses the compact label and grid offsets by default', () => {
    const { container } = render(<LabeledMoneyField label="Rent" value="" onChange={() => {}} />)
    expect(getLabel(container).style.fontSize).toBe('var(--fs-label-sm)')
    expect(getPrefix(container).style.top).toBe('6px')
    expect(getInput().style.paddingLeft).toBe('15px')
  })

  it('uses the same grid offsets when the variant is passed explicitly', () => {
    const { container } = render(<LabeledMoneyField label="Rent" value="" onChange={() => {}} variant="grid" />)
    expect(getLabel(container).style.fontSize).toBe('var(--fs-label-sm)')
    expect(getPrefix(container).style.top).toBe('6px')
    expect(getInput().style.paddingLeft).toBe('15px')
  })

  it('uses the standalone label and wider offsets for the single variant', () => {
    const { container } = render(<LabeledMoneyField label="Deposit / part-exchange" value="" onChange={() => {}} variant="single" />)
    expect(getLabel(container).style.fontSize).toBe('var(--fs-helper)')
    expect(getPrefix(container).style.top).toBe('4px')
    expect(getInput().style.paddingLeft).toBe('18px')
  })

  it('gives the two variants different label sizes and prefix offsets', () => {
    const { container: grid } = render(<LabeledMoneyField label="Rent" value="" onChange={() => {}} />)
    const { container: single } = render(<LabeledMoneyField label="Rent" value="" onChange={() => {}} variant="single" />)
    expect(getLabel(grid).style.fontSize).not.toBe(getLabel(single).style.fontSize)
    expect(getPrefix(grid).style.top).not.toBe(getPrefix(single).style.top)
  })

  it('underlines in the neutral primary colour on focus by default', () => {
    render(<LabeledMoneyField label="Rent" value="" onChange={() => {}} />)
    // Idle fields share the dim underline token; the accent only shows on focus.
    expect(getInput().getAttribute('style')).toContain('var(--input-underline)')
    fireEvent.focus(getInput())
    expect(getInput().getAttribute('style')).toContain('var(--text-primary)')
  })

  it('passes an accentColor override down to the input underline', () => {
    render(<LabeledMoneyField label="Rent" value="" onChange={() => {}} accentColor="var(--accent-save)" />)
    fireEvent.focus(getInput())
    expect(getInput().getAttribute('style')).toContain('var(--accent-save)')
    fireEvent.blur(getInput())
    expect(getInput().getAttribute('style')).toContain('var(--input-underline)')
  })

  it('accepts rich (non-string) label content', () => {
    const { container } = render(
      <LabeledMoneyField
        label={
          <>
            Insurance <small>a year</small>
          </>
        }
        value=""
        onChange={() => {}}
      />,
    )
    expect(getLabel(container).textContent).toBe('Insurance a year')
    expect(getLabel(container).querySelector('small')?.textContent).toBe('a year')
  })
})
