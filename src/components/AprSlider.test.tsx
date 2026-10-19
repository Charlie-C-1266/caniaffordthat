// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { screen, cleanup, fireEvent } from '@testing-library/react'
import { AprSlider } from './AprSlider'
import { renderWithCalculator, calculator } from '../test/renderWithCalculator'
import { APR_RANGE } from '../lib/sliderRanges'

// The APR slider both finance steps share. What matters is that it drives
// `growth`, and that its bounds are APR_RANGE, the same range a shared link is
// clamped to, so the slider and the link can't disagree about what's allowed.
describe('AprSlider', () => {
  afterEach(cleanup)

  it('shows the current rate and writes a moved value back to growth', () => {
    renderWithCalculator(<AprSlider accentColor="var(--accent-finance)" />, { growth: 9.9 })
    expect(screen.getByText('9.9%')).toBeTruthy()

    fireEvent.change(screen.getByLabelText('Interest rate (APR)'), { target: { value: '12.5' } })
    expect(calculator().state.growth).toBe(12.5)
    expect(screen.getByText('12.5%')).toBeTruthy()
  })

  it('takes its bounds and step from APR_RANGE', () => {
    renderWithCalculator(<AprSlider accentColor="var(--accent-finance)" />)
    const slider = screen.getByLabelText('Interest rate (APR)')
    expect(slider.getAttribute('min')).toBe(String(APR_RANGE.min))
    expect(slider.getAttribute('max')).toBe(String(APR_RANGE.max))
    expect(slider.getAttribute('step')).toBe(String(APR_RANGE.step))
  })
})
