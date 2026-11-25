// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { SegmentedControl, type SegmentedOption } from './SegmentedControl'

// Mirrors the app's real either/or usage ("Save up / Pay monthly",
// "% of spare cash / Fixed amount") — two options, one active.
const OPTIONS: readonly SegmentedOption<'save' | 'monthly'>[] = [
  { value: 'save', label: 'Save up', activeBackground: '#111', activeColor: '#fff' },
  { value: 'monthly', label: 'Pay monthly', activeBackground: '#111', activeColor: '#fff' },
]

/**
 * The group's accessible name. Required since #282, so every render here
 * passes one — the existing behavioural tests are otherwise unchanged.
 */
const NAME = 'How do you plan to pay?'

const group = () => screen.getByRole('group', { name: NAME })

describe('SegmentedControl', () => {
  afterEach(cleanup)

  // #282: the wrapper was a plain <div> with no role and no accessible name,
  // so the buttons' aria-pressed state was announced with no idea what choice
  // it belonged to — "Save up for it, toggle button, pressed". These pin the
  // named group that fixes it.
  describe('group naming (#282)', () => {
    it('wraps the options in a group named by ariaLabel', () => {
      render(<SegmentedControl options={OPTIONS} value="save" onChange={vi.fn()} ariaLabel={NAME} />)

      const named = screen.getByRole('group', { name: NAME })
      expect(named.getAttribute('aria-label')).toBe(NAME)
      // The name must not be duplicated onto a labelledby as well.
      expect(named.hasAttribute('aria-labelledby')).toBe(false)
      // Both options live inside it.
      expect(named.querySelectorAll('button')).toHaveLength(2)
    })

    it('wraps the options in a group named by ariaLabelledBy', () => {
      render(
        <div>
          <div id="pay-question">{NAME}</div>
          <SegmentedControl options={OPTIONS} value="save" onChange={vi.fn()} ariaLabelledBy="pay-question" />
        </div>,
      )

      const named = screen.getByRole('group', { name: NAME })
      expect(named.getAttribute('aria-labelledby')).toBe('pay-question')
      expect(named.hasAttribute('aria-label')).toBe(false)
    })

    it('keeps the group name when the selection changes', () => {
      const { rerender } = render(<SegmentedControl options={OPTIONS} value="save" onChange={vi.fn()} ariaLabel={NAME} />)
      expect(screen.getByRole('group', { name: NAME })).toBeTruthy()

      rerender(<SegmentedControl options={OPTIONS} value="monthly" onChange={vi.fn()} ariaLabel={NAME} />)
      expect(screen.getByRole('group', { name: NAME })).toBeTruthy()
      expect(screen.getByRole('button', { name: 'Pay monthly' }).getAttribute('aria-pressed')).toBe('true')
    })

    it('names the group at the compact size too', () => {
      render(<SegmentedControl options={OPTIONS} value="save" onChange={vi.fn()} size="sm" ariaLabel={NAME} />)
      expect(screen.getByRole('group', { name: NAME })).toBeTruthy()
    })

    it('renders exactly one group, however many options there are', () => {
      // The five student-loan plans: one group, five buttons, not one group
      // per option.
      const plans: readonly SegmentedOption<'none' | 'plan1' | 'plan2' | 'plan4' | 'plan5'>[] = (
        ['none', 'plan1', 'plan2', 'plan4', 'plan5'] as const
      ).map((value) => ({ value, label: value, activeBackground: '#111', activeColor: '#fff' }))

      render(<SegmentedControl options={plans} value="plan2" onChange={vi.fn()} size="sm" ariaLabel="Student loan plan" />)
      expect(screen.getAllByRole('group')).toHaveLength(1)
      expect(screen.getByRole('group', { name: 'Student loan plan' }).querySelectorAll('button')).toHaveLength(5)
    })

    it('still renders a named group with a single option', () => {
      render(<SegmentedControl options={[OPTIONS[0]]} value="save" onChange={vi.fn()} ariaLabel={NAME} />)
      expect(screen.getByRole('group', { name: NAME }).querySelectorAll('button')).toHaveLength(1)
    })

    it('renders an empty named group rather than throwing on no options', () => {
      render(<SegmentedControl options={[]} value="save" onChange={vi.fn()} ariaLabel={NAME} />)
      expect(screen.getByRole('group', { name: NAME }).querySelectorAll('button')).toHaveLength(0)
    })
  })

  it('reports the clicked option to onChange', () => {
    const onChange = vi.fn()
    render(<SegmentedControl options={OPTIONS} value="save" onChange={onChange} ariaLabel={NAME} />)
    fireEvent.click(screen.getByRole('button', { name: 'Pay monthly' }))
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('monthly')
  })

  it('reports the already-selected option too — the parent owns whether that is a no-op', () => {
    const onChange = vi.fn()
    render(<SegmentedControl options={OPTIONS} value="save" onChange={onChange} ariaLabel={NAME} />)
    fireEvent.click(screen.getByRole('button', { name: 'Save up' }))
    expect(onChange).toHaveBeenCalledWith('save')
  })

  it('marks only the selected option aria-pressed', () => {
    render(<SegmentedControl options={OPTIONS} value="monthly" onChange={vi.fn()} ariaLabel={NAME} />)
    expect(screen.getByRole('button', { name: 'Pay monthly' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: 'Save up' }).getAttribute('aria-pressed')).toBe('false')
  })

  it('moves the pressed state when the controlled value changes', () => {
    const { rerender } = render(<SegmentedControl options={OPTIONS} value="save" onChange={vi.fn()} ariaLabel={NAME} />)
    expect(screen.getByRole('button', { name: 'Save up' }).getAttribute('aria-pressed')).toBe('true')
    rerender(<SegmentedControl options={OPTIONS} value="monthly" onChange={vi.fn()} ariaLabel={NAME} />)
    expect(screen.getByRole('button', { name: 'Save up' }).getAttribute('aria-pressed')).toBe('false')
    expect(screen.getByRole('button', { name: 'Pay monthly' }).getAttribute('aria-pressed')).toBe('true')
  })

  it('styles only the active option with its active colours', () => {
    render(<SegmentedControl options={OPTIONS} value="save" onChange={vi.fn()} ariaLabel={NAME} />)
    const active = screen.getByRole('button', { name: 'Save up' })
    const inactive = screen.getByRole('button', { name: 'Pay monthly' })
    expect(active.style.background).not.toBe('transparent')
    // The longhand, not `background`: jsdom 31 reads an all-default `background: transparent` back as `none`.
    expect(inactive.style.backgroundColor).toBe('transparent')
  })

  // `size` branches layout only (flex, padding, borderRadius, width, font
  // size) and never behaviour, so a regression there is invisible to anything
  // that only checks onChange. These pin both halves of that claim: the
  // interaction is identical, and the layout genuinely differs.
  describe('size', () => {
    it('reports the clicked option the same way at the compact size', () => {
      const onChange = vi.fn()
      render(<SegmentedControl options={OPTIONS} value="save" onChange={onChange} size="sm" ariaLabel={NAME} />)
      fireEvent.click(screen.getByRole('button', { name: 'Pay monthly' }))
      expect(onChange).toHaveBeenCalledExactlyOnceWith('monthly')
    })

    it('marks the selected option pressed the same way at the compact size', () => {
      render(<SegmentedControl options={OPTIONS} value="monthly" onChange={vi.fn()} size="sm" ariaLabel={NAME} />)
      expect(screen.getByRole('button', { name: 'Pay monthly' }).getAttribute('aria-pressed')).toBe('true')
      expect(screen.getByRole('button', { name: 'Save up' }).getAttribute('aria-pressed')).toBe('false')
    })

    it('reports the already-selected option at the compact size too', () => {
      const onChange = vi.fn()
      render(<SegmentedControl options={OPTIONS} value="save" onChange={onChange} size="sm" ariaLabel={NAME} />)
      fireEvent.click(screen.getByRole('button', { name: 'Save up' }))
      expect(onChange).toHaveBeenCalledExactlyOnceWith('save')
    })

    it("lays out full-width equal segments at the default 'md' size", () => {
      const { container } = render(<SegmentedControl options={OPTIONS} value="save" onChange={vi.fn()} ariaLabel={NAME} />)
      const pill = container.firstElementChild as HTMLElement
      // The group is the pill itself, not an extra wrapper around it.
      expect(pill).toBe(group())
      // No width cap: the md pill fills its container.
      expect(pill.style.width).toBe('')
      // Each segment flexes to an equal share (jsdom expands `flex: 1` to its
      // longhand, so read the grow factor rather than the shorthand).
      expect(screen.getByRole('button', { name: 'Save up' }).style.flexGrow).toBe('1')
    })

    it("shrinks to its content at the 'sm' size, with segments no longer flexing", () => {
      const { container } = render(<SegmentedControl options={OPTIONS} value="save" onChange={vi.fn()} size="sm" ariaLabel={NAME} />)
      const pill = container.firstElementChild as HTMLElement
      expect(pill.style.width).toBe('fit-content')
      expect(screen.getByRole('button', { name: 'Save up' }).style.flexGrow).toBe('')
    })
  })
})
