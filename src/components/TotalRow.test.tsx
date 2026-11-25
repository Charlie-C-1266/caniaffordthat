// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { BreakdownRow } from './BreakdownRow'
import { TotalRow } from './TotalRow'

// TotalRow is BreakdownRow with `total` set, under a name the result cards
// read better with. These tests hold it to exactly that, so it can't grow
// styling of its own and leave one card's bottom line looking unlike another's.
// The styling itself is pinned in BreakdownRow.test.tsx.

describe('TotalRow', () => {
  afterEach(cleanup)

  it('renders exactly what BreakdownRow renders with total set', () => {
    const total = render(<TotalRow label="TOTAL / MONTH" value="£389" />).container.innerHTML
    const row = render(<BreakdownRow label="TOTAL / MONTH" value="£389" total />).container.innerHTML

    expect(total).toBe(row)
  })

  it('carries the rule and padding that mark a bottom line', () => {
    const row = render(<TotalRow label="DUE UPFRONT" value="£2,500" />).container.firstElementChild as HTMLElement

    expect(row.style.borderTop).toBe('1px solid var(--tile-border-neutral)')
    expect(row.style.paddingTop).toBe('9px')
  })

  it('passes wrapValue through to BreakdownRow', () => {
    // SalaryFlip's bottom line is the one total whose value is prose rather
    // than a figure ("£1,200 to spare"), so it has to be able to wrap.
    const wrapping = render(<TotalRow label="YOU CAN COVER IT" value="£1,200 to spare" wrapValue />).container.innerHTML
    const row = render(<BreakdownRow label="YOU CAN COVER IT" value="£1,200 to spare" total wrapValue />).container.innerHTML

    expect(wrapping).toBe(row)

    const value = render(<TotalRow label="YOU CAN COVER IT" value="£1,200 to spare" wrapValue />).container.querySelectorAll<HTMLElement>(
      'span',
    )[1]
    expect(value.style.whiteSpace).toBe('')
    expect(value.style.minWidth).toBe('0px')
  })

  it('holds a figure total to one line by default', () => {
    const value = render(<TotalRow label="TOTAL / MONTH" value="£389" />).container.querySelectorAll<HTMLElement>('span')[1]

    expect(value.style.whiteSpace).toBe('nowrap')
    expect(value.style.flexShrink).toBe('0')
  })

  it.each([
    ['an empty label and value', '', ''],
    ['a seven-figure sum', 'TOTAL PAYABLE', '£1,234,567.89'],
    ['an ampersand', 'INSURANCE & TAX', '£1,240'],
    ['a long label', 'TOTAL INTEREST OVER A 48-MONTH PCP AGREEMENT', '£3,912.40'],
    ['a negative figure', 'SHORTFALL', '-£1,240'],
  ])('passes %s through unchanged', (_case, label, value) => {
    const row = render(<TotalRow label={label} value={value} />).container.firstElementChild as HTMLElement

    expect(Array.from(row.children).map((span) => span.textContent)).toEqual([label, value])
  })
})
