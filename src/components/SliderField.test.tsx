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
})
