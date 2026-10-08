// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { SliderField } from './SliderField'

// Mirrors the emergency-cover step's real usage: months of cover, 3–6 range.
const PROPS = {
  label: 'Months of cover',
  valueLabel: '3 months',
  min: 1,
  max: 12,
  step: 1,
  value: 3,
  accentColor: '#4ade80',
}

describe('SliderField', () => {
  afterEach(cleanup)

  it('reports slider movement to onChange as a number', () => {
    const onChange = vi.fn()
    render(<SliderField {...PROPS} onChange={onChange} />)
    fireEvent.change(screen.getByRole('slider'), { target: { value: '6' } })
    expect(onChange).toHaveBeenCalledTimes(1)
    // Strictly the number 6, not the event's string "6".
    expect(onChange).toHaveBeenCalledWith(6)
  })

  it('renders the label and the formatted value read-out', () => {
    render(<SliderField {...PROPS} onChange={vi.fn()} />)
    expect(screen.getByText('Months of cover')).toBeTruthy()
    expect(screen.getByText('3 months')).toBeTruthy()
  })

  it('exposes the formatted value to screen readers, not just the bare number', () => {
    render(<SliderField {...PROPS} onChange={vi.fn()} />)
    const slider = screen.getByRole('slider')
    expect(slider.getAttribute('aria-label')).toBe('Months of cover')
    expect(slider.getAttribute('aria-valuetext')).toBe('3 months')
  })

  it('passes the range bounds through to the input', () => {
    render(<SliderField {...PROPS} onChange={vi.fn()} />)
    const slider = screen.getByRole<HTMLInputElement>('slider')
    expect(slider.min).toBe('1')
    expect(slider.max).toBe('12')
    expect(slider.step).toBe('1')
    expect(slider.value).toBe('3')
  })

  it('coerces every reported value to a number, including "0" and a fractional step', () => {
    // The string→number coercion is what a native range input hands React for
    // free in a browser but a jsdom change event does not, so both the
    // falsy-but-valid "0" and a non-integer step need pinning explicitly.
    const onChange = vi.fn()
    render(<SliderField {...PROPS} min={0} step={0.5} onChange={onChange} />)
    const slider = screen.getByRole('slider')

    fireEvent.change(slider, { target: { value: '0' } })
    expect(onChange).toHaveBeenLastCalledWith(0)
    expect(onChange.mock.lastCall?.[0]).toBeTypeOf('number')

    fireEvent.change(slider, { target: { value: '4.5' } })
    expect(onChange).toHaveBeenLastCalledWith(4.5)
  })

  it('never reports a change to the value it already holds — the platform, not a guard in the component, is why', () => {
    // The source has no value-equality check, so on paper re-selecting the
    // current value would call onChange redundantly. In practice it cannot:
    // setting a range input to the value it already holds fires no change
    // event (React's value tracker dedupes it, as browsers do), so a parent
    // never sees a redundant call. Pinned here because the absence of a guard
    // in the component is only safe while that platform behaviour holds.
    const onChange = vi.fn()
    render(<SliderField {...PROPS} onChange={onChange} />)
    const slider = screen.getByRole<HTMLInputElement>('slider')

    fireEvent.change(slider, { target: { value: String(PROPS.value) } })
    fireEvent(slider, new Event('change', { bubbles: true }))
    expect(onChange).not.toHaveBeenCalled()

    // Not an inert handler: a genuinely different value still gets through.
    fireEvent.change(slider, { target: { value: '7' } })
    expect(onChange).toHaveBeenCalledExactlyOnceWith(7)
  })
})
