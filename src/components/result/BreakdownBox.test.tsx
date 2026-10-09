// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { BreakdownBox } from './BreakdownBox'
import { BreakdownRow } from './BreakdownRow'
import { TotalRow } from './TotalRow'

// The three primitives every result breakdown is built from. The only branch
// among them is the box's optional heading — the vehicle card runs two headed
// boxes ("Monthly costs", "The deal") while the standard card's single box goes
// without — and nothing pinned it, so a refactor could drop the heading, or
// leave an empty element in its place, and still pass today's suite. The rows
// carry no branches but do carry the label/value order the figures are read in,
// which a swap would invert silently.

/** The box itself — the single element `BreakdownBox` renders. */
function box(container: HTMLElement): HTMLElement {
  const el = container.firstElementChild
  if (!(el instanceof HTMLElement)) throw new Error('expected BreakdownBox to render an element')
  return el
}

describe('BreakdownBox', () => {
  afterEach(cleanup)

  it('renders its children', () => {
    const { container } = render(
      <BreakdownBox>
        <BreakdownRow label="SPARE CASH" value="£420" />
      </BreakdownBox>,
    )

    expect(screen.getByText('SPARE CASH')).toBeTruthy()
    expect(screen.getByText('£420')).toBeTruthy()
    expect(box(container).children).toHaveLength(1)
  })

  it('renders the heading when one is provided', () => {
    const { container } = render(
      <BreakdownBox heading="Monthly costs">
        <BreakdownRow label="FUEL" value="£90" />
      </BreakdownBox>,
    )

    expect(screen.getByText('Monthly costs')).toBeTruthy()
    // The heading comes first, ahead of the rows it labels.
    const [heading, row] = Array.from(box(container).children)
    expect(heading.textContent).toBe('Monthly costs')
    expect(row.textContent).toBe('FUEL£90')
  })

  it('renders no heading element at all when the heading is omitted', () => {
    const { container } = render(
      <BreakdownBox>
        <BreakdownRow label="FUEL" value="£90" />
      </BreakdownBox>,
    )

    // Not merely blank text: there must be no leftover element, or the
    // standard card's single unheaded box would carry a stray gap.
    const children = Array.from(box(container).children)
    expect(children).toHaveLength(1)
    expect(children[0].textContent).toBe('FUEL£90')
  })

  it('renders no heading element when the heading is an empty string', () => {
    const { container } = render(
      <BreakdownBox heading="">
        <BreakdownRow label="FUEL" value="£90" />
      </BreakdownBox>,
    )

    const children = Array.from(box(container).children)
    expect(children).toHaveLength(1)
    expect(children[0].textContent).toBe('FUEL£90')
  })
})

describe('BreakdownRow and TotalRow', () => {
  afterEach(cleanup)

  it('render the label before the value', () => {
    const { container } = render(
      <>
        <BreakdownRow label="DEPOSIT / PART-EX" value="£2,500" />
        <TotalRow label="TOTAL / MONTH" value="£389" />
      </>,
    )

    const [row, total] = Array.from(container.children)
    // Label first, then value — the order the figures are read in.
    expect(Array.from(row.children).map((c) => c.textContent)).toEqual(['DEPOSIT / PART-EX', '£2,500'])
    expect(Array.from(total.children).map((c) => c.textContent)).toEqual(['TOTAL / MONTH', '£389'])
  })

  it('render long, zero and negative-formatted values verbatim', () => {
    render(
      <>
        <BreakdownRow label="CAR" value="2019 Volkswagen Golf 1.5 TSI Life — £14,750" />
        <BreakdownRow label="SPARE CASH" value="£0" />
        <TotalRow label="SHORTFALL" value="-£1,240" />
      </>,
    )

    // No truncation, no re-formatting: the cards pass pre-formatted strings
    // and these primitives must not touch them.
    expect(screen.getByText('2019 Volkswagen Golf 1.5 TSI Life — £14,750')).toBeTruthy()
    expect(screen.getByText('£0')).toBeTruthy()
    expect(screen.getByText('-£1,240')).toBeTruthy()
  })

  it('render in document order inside a composed box', () => {
    const { container } = render(
      <BreakdownBox heading="The deal">
        <BreakdownRow label="CAR" value="£14,750" />
        <BreakdownRow label="DEPOSIT / PART-EX" value="£2,500" />
        <TotalRow label="DUE UPFRONT" value="£2,500" />
      </BreakdownBox>,
    )

    // The shape of a real vehicle-card box: heading, rows, then the
    // emphasised bottom line.
    expect(Array.from(box(container).children).map((c) => c.textContent)).toEqual([
      'The deal',
      'CAR£14,750',
      'DEPOSIT / PART-EX£2,500',
      'DUE UPFRONT£2,500',
    ])
  })
})
