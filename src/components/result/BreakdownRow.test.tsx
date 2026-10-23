// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { BreakdownRow } from './BreakdownRow'

// One label/value line in a result card's breakdown box. Its only branch is
// `total`, and what that switches on is a visual contract: the rule and
// padding above are all that set a box's bottom line apart from the rows over
// it, and a test that only reads text wouldn't notice them change. The cards
// pass pre-formatted strings, so the row must also show them untouched.

/** The row and its two spans, label first. */
function parts(container: HTMLElement) {
  const row = container.firstElementChild
  if (!(row instanceof HTMLElement)) throw new Error('expected BreakdownRow to render an element')
  const [label, value] = Array.from(row.children) as HTMLElement[]
  return { row, label, value }
}

describe('BreakdownRow', () => {
  afterEach(cleanup)

  it('renders the label then the value, the order the figures are read in', () => {
    const { row, label, value } = parts(render(<BreakdownRow label="DEPOSIT / PART-EX" value="£2,500" />).container)

    expect(row.children).toHaveLength(2)
    expect(label.textContent).toBe('DEPOSIT / PART-EX')
    expect(value.textContent).toBe('£2,500')
  })

  it('dims the label and gives the value the primary text colour', () => {
    const { label, value } = parts(render(<BreakdownRow label="FUEL" value="£90" />).container)

    expect(label.style.color).toBe('var(--text-secondary-dim)')
    expect(value.style.color).toBe('var(--text-primary)')
  })

  it('pushes the label and value to either end of the row', () => {
    const { row } = parts(render(<BreakdownRow label="FUEL" value="£90" />).container)

    expect(row.style.display).toBe('flex')
    expect(row.style.justifyContent).toBe('space-between')
  })

  it('has no rule or padding above it by default', () => {
    const { row } = parts(render(<BreakdownRow label="FUEL" value="£90" />).container)

    expect(row.style.borderTop).toBe('')
    expect(row.style.paddingTop).toBe('')
  })

  it('sets a total row off with a 1px rule and 9px of padding above it', () => {
    const { row } = parts(render(<BreakdownRow label="TOTAL / MONTH" value="£389" total />).container)

    expect(row.style.borderTop).toBe('1px solid var(--tile-border-neutral)')
    expect(row.style.paddingTop).toBe('9px')
  })

  it('renders total={false} exactly as it renders with total left out', () => {
    const explicit = render(<BreakdownRow label="FUEL" value="£90" total={false} />).container.innerHTML
    const omitted = render(<BreakdownRow label="FUEL" value="£90" />).container.innerHTML

    expect(explicit).toBe(omitted)
  })

  it('shows long, zero and negative values exactly as the card formatted them', () => {
    // No truncation and no re-formatting: the strings arrive ready to show.
    for (const value of ['2019 Volkswagen Golf 1.5 TSI Life — £14,750', '£0', '-£1,240']) {
      expect(parts(render(<BreakdownRow label="CAR" value={value} />).container).value.textContent).toBe(value)
      cleanup()
    }
  })
})
