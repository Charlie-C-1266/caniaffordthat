// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { BreakdownRow } from './BreakdownRow'
import { TotalRow } from './TotalRow'

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

  // #297: with a plain space-between and no gap, a long label and its amount
  // squeezed each other at 320px — they ran together with no space
  // (`POSTGRADUATE-£61.00`) and the amount overflowed the box's right edge
  // instead of the label wrapping. These four styles are the whole fix, and
  // they are asserted on an ordinary row *and* on a TotalRow, so the box's
  // bottom line keeps its rule and padding as well as the new sizing.
  describe('narrow-column sizing (#297)', () => {
    const cases = [
      ['an ordinary row', <BreakdownRow key="row" label="NATIONAL INSURANCE" value="−£137.53" />] as const,
      ['a total row', <TotalRow key="total" label="TAKE-HOME" value="£2,195.69" />] as const,
    ]

    it.each(cases)('separates the label from the amount on %s', (_name, element) => {
      const { row } = parts(render(element).container)

      // The gap is what stops `POSTGRADUATE` touching `-£61.00`.
      expect(row.style.gap).toBe('12px')
      // So a wrapped two-line label lines up with its amount on the first line.
      expect(row.style.alignItems).toBe('baseline')
    })

    it.each(cases)('lets the label shrink and keeps the amount whole on %s', (_name, element) => {
      const { label, value } = parts(render(element).container)

      // A flex item won't shrink below its content width without this, which
      // is why the amount was pushed out of the box rather than the label
      // wrapping.
      expect(label.style.minWidth).toBe('0px')

      // The amount is the figure people check against a real payslip, so it
      // must never shrink, wrap or be clipped.
      expect(value.style.flexShrink).toBe('0')
      expect(value.style.whiteSpace).toBe('nowrap')
      expect(value.style.textAlign).toBe('right')
    })

    it("keeps a total row's rule and padding alongside the new sizing", () => {
      // Guards against the #297 styles being spread in a way that drops the
      // `total` branch's own styles.
      const { row } = parts(render(<TotalRow label="TAKE-HOME" value="£2,195.69" />).container)

      expect(row.style.borderTop).toBe('1px solid var(--tile-border-neutral)')
      expect(row.style.paddingTop).toBe('9px')
      expect(row.style.gap).toBe('12px')
    })

    it('lets a free-text value wrap when the row asks it to', () => {
      // GOAL and CAR read `<name> — £<price>`, as long as the name the user
      // typed. Holding those to one line pushes them out of the card — a GOAL
      // value of "2019 Volkswagen Golf 1.5 TSI Life — £14,750" measured 174px
      // past the box's right edge at 320px — so they wrap instead.
      const { label, value } = parts(
        render(<BreakdownRow label="GOAL" value="2019 Volkswagen Golf 1.5 TSI Life — £14,750" wrapValue />).container,
      )

      expect(value.style.whiteSpace).toBe('')
      expect(value.style.flexShrink).toBe('')
      expect(value.style.minWidth).toBe('0px')
      // Everything else about the row is unchanged.
      expect(value.style.textAlign).toBe('right')
      expect(value.style.color).toBe('var(--text-primary)')
      expect(label.style.minWidth).toBe('0px')
    })

    it('renders wrapValue={false} exactly as it renders with wrapValue left out', () => {
      const explicit = render(<BreakdownRow label="FUEL" value="£90" wrapValue={false} />).container.innerHTML
      const omitted = render(<BreakdownRow label="FUEL" value="£90" />).container.innerHTML

      expect(explicit).toBe(omitted)
    })

    it('keeps the gap and baseline alignment on a wrapping row too', () => {
      const { row } = parts(render(<BreakdownRow label="CAR" value="VW Golf — £22,000" wrapValue />).container)

      expect(row.style.gap).toBe('12px')
      expect(row.style.alignItems).toBe('baseline')
    })

    it('does not let the label opt out of shrinking, whatever its length', () => {
      // The longest payslip labels are the ones that overflowed. An empty
      // label and a very long one must get the same treatment.
      for (const label of ['', 'A', 'NATIONAL INSURANCE', 'POSTGRADUATE LOAN', 'DEPOSIT / PART-EX AND EVERYTHING ELSE']) {
        const parsed = parts(render(<BreakdownRow label={label} value="−£1,234.56" />).container)
        expect(parsed.label.style.minWidth).toBe('0px')
        expect(parsed.value.style.flexShrink).toBe('0')
        cleanup()
      }
    })
  })
})
