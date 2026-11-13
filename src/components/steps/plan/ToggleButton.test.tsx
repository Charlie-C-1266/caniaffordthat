// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup, screen, fireEvent } from '@testing-library/react'
import { ToggleButton } from './ToggleButton'
import { PresetChip } from '../vehicleCosts/PresetChip'

// One of the Plan step's two timeframe choices. Its whole job is to look
// chosen or not chosen, and to say which one it is.
//
// It says so twice over, and both halves are the contract. `aria-pressed`
// carries the selection to assistive technology (#272) — before that it set
// no aria-pressed and no aria-current, so a screen reader was told nothing
// about which timeframe was chosen even though SegmentedControl, PresetChip
// and MethodChip all announce theirs. The border colour and the selected
// surface carry it visually, and they are asserted here rather than left as
// styling detail because PlanStep marks the choice no other way.
//
// So the two sets of assertions below are deliberately kept side by side:
// the state assertions join the border ones rather than replacing them, and
// a regression in either half is a regression in the component.

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

  it('reports itself as pressed when it is the active choice', () => {
    // The half of the selection a screen reader can reach: without this the
    // two buttons are announced identically whichever timeframe is chosen.
    render(<ToggleButton label="I have a goal date" active accentColor={ACCENT} onClick={() => {}} />)

    expect(screen.getByRole('button', { name: 'I have a goal date', pressed: true })).toBeDefined()
  })

  it('reports itself as not pressed when it is the other choice', () => {
    // `aria-pressed="false"` rather than the attribute being absent: absent
    // would make it an ordinary button, which says nothing about selection.
    render(<ToggleButton label="I have a goal date" active={false} accentColor={ACCENT} onClick={() => {}} />)
    const button = screen.getByRole('button', { name: 'I have a goal date', pressed: false })

    expect(button.getAttribute('aria-pressed')).toBe('false')
  })

  it('takes the accent border and the selected surface when active', () => {
    render(<ToggleButton label="Goal date" active accentColor={ACCENT} onClick={() => {}} />)
    const button = screen.getByRole('button')

    expect(button.getAttribute('aria-pressed')).toBe('true')
    expect(button.style.border).toBe(`var(--border-width-card) solid ${ACCENT}`)
    expect(button.style.background).toBe('var(--surface-selected)')
  })

  it('falls back to the underline token and no background when inactive', () => {
    render(<ToggleButton label="Goal date" active={false} accentColor={ACCENT} onClick={() => {}} />)
    const button = screen.getByRole('button')

    expect(button.getAttribute('aria-pressed')).toBe('false')
    expect(button.style.border).toBe('var(--border-width-card) solid var(--input-underline)')
    expect(button.style.background).toBe('transparent')
  })

  it('reports the same state whatever the accent, so the state is never carried by colour alone', () => {
    // The point of #272: the border is the mode's accent in saving mode and
    // violet in finance mode, and neither is any use to someone who cannot
    // tell the accent from the underline token. The announced state does not
    // vary with the accent at all.
    const { rerender } = render(<ToggleButton label="Term" active accentColor={ACCENT} onClick={() => {}} />)

    expect(screen.getByRole('button').getAttribute('aria-pressed')).toBe('true')

    rerender(<ToggleButton label="Term" active accentColor="rgb(139, 92, 246)" onClick={() => {}} />)

    expect(screen.getByRole('button').getAttribute('aria-pressed')).toBe('true')
  })

  it('matches PresetChip and MethodChip, which mark selection the same way', () => {
    // The four selectable-button components (SegmentedControl, PresetChip,
    // MethodChip and this one) are meant to be consistent; this was the only
    // one that was not. Rendered beside a PresetChip so the two are compared
    // as the accessibility tree sees them, not by reading both sources.
    render(
      <>
        <ToggleButton label="Toggle" active accentColor={ACCENT} onClick={() => {}} />
        <PresetChip label="Chip" active accentColor={ACCENT} title="A preset" onClick={() => {}} />
      </>,
    )

    const [toggle, chip] = screen.getAllByRole('button', { pressed: true })

    expect(toggle.getAttribute('aria-pressed')).toBe(chip.getAttribute('aria-pressed'))
  })

  it('keeps reporting itself as pressed after a click on the active choice', () => {
    // Re-picking the current timeframe must not flicker the reported state:
    // the button is told what it is, it does not toggle itself.
    render(<ToggleButton label="How long will it take?" active accentColor={ACCENT} onClick={() => {}} />)
    const button = screen.getByRole('button')

    fireEvent.click(button)

    expect(button.getAttribute('aria-pressed')).toBe('true')
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
