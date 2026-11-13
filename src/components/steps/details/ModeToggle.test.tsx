// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup, screen, fireEvent } from '@testing-library/react'
import { ModeToggle } from './ModeToggle'
import { accentColorFor } from '../../../lib/mode'
import type { Mode } from '../../../state/types'

// The "How do you plan to pay?" control. It is a thin wrapper over
// SegmentedControl, so what is worth testing is the part that isn't shared:
// the two options it declares, and the fact that each segment carries its
// *own* accent. That second point is the whole reason this component exists
// rather than an inline SegmentedControl — the pill lights up green for
// saving and violet for finance, matching the accent the rest of the app
// takes once the choice is made. A single shared accent would make the
// toggle lie about what it is about to do.
//
// SegmentedControl's own structure and interaction styling are pinned in
// SegmentedControl.test.tsx; this file does not re-test them.

const segment = (name: string) => screen.getByRole('button', { name })
const saveSegment = () => segment('Save up for it')
const monthlySegment = () => segment('Pay monthly')

describe('ModeToggle', () => {
  afterEach(cleanup)

  it('asks the question the step is about', () => {
    render(<ModeToggle mode="save" onChange={() => {}} />)

    expect(screen.getByText('How do you plan to pay?')).toBeDefined()
  })

  it('offers exactly the two ways of paying, in that order', () => {
    render(<ModeToggle mode="save" onChange={() => {}} />)

    expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual(['Save up for it', 'Pay monthly'])
  })

  it('marks the saving segment as the pressed one in save mode', () => {
    render(<ModeToggle mode="save" onChange={() => {}} />)

    expect(saveSegment().getAttribute('aria-pressed')).toBe('true')
    expect(monthlySegment().getAttribute('aria-pressed')).toBe('false')
  })

  it('moves the pressed state to the monthly segment in monthly mode', () => {
    render(<ModeToggle mode="monthly" onChange={() => {}} />)

    expect(saveSegment().getAttribute('aria-pressed')).toBe('false')
    expect(monthlySegment().getAttribute('aria-pressed')).toBe('true')
  })

  it('calls onChange with "monthly" when the other option is clicked from save', () => {
    const onChange = vi.fn<(mode: Mode) => void>()
    render(<ModeToggle mode="save" onChange={onChange} />)

    fireEvent.click(monthlySegment())

    expect(onChange).toHaveBeenCalledExactlyOnceWith('monthly')
  })

  it('calls onChange with "save" when the other option is clicked from monthly', () => {
    const onChange = vi.fn<(mode: Mode) => void>()
    render(<ModeToggle mode="monthly" onChange={onChange} />)

    fireEvent.click(saveSegment())

    expect(onChange).toHaveBeenCalledExactlyOnceWith('save')
  })

  it('reports a click on the already-active option too, exactly as SegmentedControl does', () => {
    // SegmentedControl fires for every segment regardless of selection, so
    // the toggle hands the parent an idempotent re-select rather than
    // swallowing it. Pinned here so the two can't drift apart.
    const onChange = vi.fn<(mode: Mode) => void>()
    render(<ModeToggle mode="save" onChange={onChange} />)

    fireEvent.click(saveSegment())

    expect(onChange).toHaveBeenCalledExactlyOnceWith('save')
  })

  it('lights the saving segment with the save accent, not a shared one', () => {
    render(<ModeToggle mode="save" onChange={() => {}} />)

    expect(saveSegment().style.background).toBe(accentColorFor('save'))
    expect(saveSegment().style.color).toBe('var(--on-accent-save)')
  })

  it('lights the monthly segment with the finance accent', () => {
    render(<ModeToggle mode="monthly" onChange={() => {}} />)

    expect(monthlySegment().style.background).toBe(accentColorFor('monthly'))
    expect(monthlySegment().style.color).toBe('var(--on-accent-finance)')
  })

  it('gives the two segments different accents, which is the point of the component', () => {
    // Asserted as an inequality as well as per-segment above: if both
    // accents were ever pointed at one token, each assertion above would
    // still pass on its own.
    expect(accentColorFor('save')).not.toBe(accentColorFor('monthly'))
  })

  it('leaves the inactive segment unaccented, whichever mode is on', () => {
    render(<ModeToggle mode="save" onChange={() => {}} />)

    expect(monthlySegment().style.background).toBe('transparent')
    expect(monthlySegment().style.color).toBe('var(--text-secondary)')
  })

  it('renders the full-width "md" segmented control, not the compact one', () => {
    // The pay-mode toggle is the full-width variant; Plan's rate-mode
    // toggle is the compact one. Equal-width segments are what say these two
    // choices are peers.
    render(<ModeToggle mode="save" onChange={() => {}} />)

    // jsdom expands the shorthand: `flex: 1` is `1 1 0%`.
    expect(saveSegment().style.flex).toBe('1 1 0%')
    expect(monthlySegment().style.flex).toBe('1 1 0%')
  })
})
