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

describe('SegmentedControl', () => {
  afterEach(cleanup)

  it('reports the clicked option to onChange', () => {
    const onChange = vi.fn()
    render(<SegmentedControl options={OPTIONS} value="save" onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'Pay monthly' }))
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('monthly')
  })

  it('reports the already-selected option too — the parent owns whether that is a no-op', () => {
    const onChange = vi.fn()
    render(<SegmentedControl options={OPTIONS} value="save" onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'Save up' }))
    expect(onChange).toHaveBeenCalledWith('save')
  })

  it('marks only the selected option aria-pressed', () => {
    render(<SegmentedControl options={OPTIONS} value="monthly" onChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Pay monthly' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: 'Save up' }).getAttribute('aria-pressed')).toBe('false')
  })

  it('moves the pressed state when the controlled value changes', () => {
    const { rerender } = render(<SegmentedControl options={OPTIONS} value="save" onChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Save up' }).getAttribute('aria-pressed')).toBe('true')
    rerender(<SegmentedControl options={OPTIONS} value="monthly" onChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Save up' }).getAttribute('aria-pressed')).toBe('false')
    expect(screen.getByRole('button', { name: 'Pay monthly' }).getAttribute('aria-pressed')).toBe('true')
  })

  it('styles only the active option with its active colors', () => {
    render(<SegmentedControl options={OPTIONS} value="save" onChange={vi.fn()} />)
    const active = screen.getByRole('button', { name: 'Save up' })
    const inactive = screen.getByRole('button', { name: 'Pay monthly' })
    expect(active.style.background).not.toBe('transparent')
    expect(inactive.style.background).toBe('transparent')
  })
})
