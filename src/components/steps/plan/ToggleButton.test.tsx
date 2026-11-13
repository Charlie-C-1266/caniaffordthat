// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup, screen, fireEvent } from '@testing-library/react'
import { ToggleButton } from './ToggleButton'

// One of the Plan step's two timeframe choices. Its whole job is to look
// chosen or not chosen, and the only thing that says which is the border
// colour — so that border is the contract, not an implementation detail.
//
// Note what this component does *not* do: it sets no aria-pressed and no
// aria-current, so a screen reader is told nothing about which timeframe is
// selected, unlike SegmentedControl, PresetChip and MethodChip, which all do.
// PlanStep renders the two together, so the pair is a radio group in all but
// name. That is a real accessibility gap rather than something these tests
// should paper over, so it is raised as #272 and left alone here (#269 asks
// for tests only). The border assertions below therefore pin what the
// component does today; when #272 lands they should be joined by assertions
// on the accessible state, not replaced by them.

const ACCENT = 'rgb(16, 185, 129)'

describe('ToggleButton', () => {
  afterEach(cleanup)

  it('shows its label as the button is named for the screen reader', () => {
    render(<ToggleButton label="I have a goal date" active={false} accentColor={ACCENT} onClick={() => {}} />)

    expect(screen.getByRole('button', { name: 'I have a goal date' })).toBeDefined()
  })

  it('calls onClick once per click', () => {
    const onClick = vi.fn()
    render(<ToggleButton label="How long will it take?" active={false} accentColor={ACCENT} onClick={onClick} />)

    fireEvent.click(screen.getByRole('button'))

    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('calls onClick again when it is already the active choice', () => {
    // Re-picking the current timeframe is a no-op for the user, but the
    // button must not start swallowing the click: PlanStep decides that, not
    // this component.
    const onClick = vi.fn()
    render(<ToggleButton label="How long will it take?" active accentColor={ACCENT} onClick={onClick} />)

    fireEvent.click(screen.getByRole('button'))

    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('takes the accent border and the selected surface when active', () => {
    render(<ToggleButton label="Goal date" active accentColor={ACCENT} onClick={() => {}} />)
    const button = screen.getByRole('button')

    expect(button.style.border).toBe(`var(--border-width-card) solid ${ACCENT}`)
    expect(button.style.background).toBe('var(--surface-selected)')
  })

  it('falls back to the underline token and no background when inactive', () => {
    render(<ToggleButton label="Goal date" active={false} accentColor={ACCENT} onClick={() => {}} />)
    const button = screen.getByRole('button')

    expect(button.style.border).toBe('var(--border-width-card) solid var(--input-underline)')
    expect(button.style.background).toBe('transparent')
  })

  it('carries the mode accent through rather than hard-coding the save green', () => {
    // The Plan step is reached in finance mode too, where the accent is
    // violet. A hard-coded green would only show up in that mode.
    render(<ToggleButton label="Term" active accentColor="rgb(139, 92, 246)" onClick={() => {}} />)

    expect(screen.getByRole('button').style.border).toContain('rgb(139, 92, 246)')
  })

  it('keeps the two choices equal width, so neither reads as the primary one', () => {
    render(<ToggleButton label="A much longer label than the other" active={false} accentColor={ACCENT} onClick={() => {}} />)

    // jsdom expands the shorthand: `flex: 1` is `1 1 0%`.
    expect(screen.getByRole('button').style.flex).toBe('1 1 0%')
  })
})
