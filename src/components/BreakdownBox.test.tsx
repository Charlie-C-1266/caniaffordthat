// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { BreakdownBox } from './BreakdownBox'
import { BreakdownRow } from './BreakdownRow'
import { TotalRow } from './TotalRow'

// The box every result breakdown sits in. Its only branch is the optional
// heading — the vehicle card runs two headed boxes ("Monthly costs", "The
// deal") while the standard card's single box goes without — and nothing
// pinned it, so a refactor could drop the heading, or leave an empty element
// in its place, and still pass today's suite. The rows inside it have their
// own tests, in BreakdownRow.test.tsx and TotalRow.test.tsx.

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

  it('lays out a heading, rows and a bottom line in the order they are written', () => {
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
