// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { screen, cleanup, fireEvent } from '@testing-library/react'
import { VehicleAgeSlider } from './VehicleAgeSlider'
import { renderWithCalculator, calculator } from '../test/renderWithCalculator'
import { VEHICLE_AGE_RANGE } from '../lib/sliderRanges'

// The car-age slider the purchase and running-costs steps share, each with its
// own question. The read-out has three cases worth pinning: 0 reads as "Brand
// new" rather than "0 years", and 1 is singular.
describe('VehicleAgeSlider', () => {
  afterEach(cleanup)

  it("asks the step's own question", () => {
    renderWithCalculator(<VehicleAgeSlider label="How old is the car now?" accentColor="var(--accent-finance)" />)
    expect(screen.getByLabelText('How old is the car now?')).toBeTruthy()
  })

  it('reads 0 as brand new, 1 as a single year, and anything else in years', () => {
    renderWithCalculator(<VehicleAgeSlider label="How old is the car?" accentColor="var(--accent-finance)" />, { vehicleAge: 0 })
    expect(screen.getByText('Brand new')).toBeTruthy()

    const slider = screen.getByLabelText('How old is the car?')
    fireEvent.change(slider, { target: { value: '1' } })
    expect(screen.getByText('1 year')).toBeTruthy()

    fireEvent.change(slider, { target: { value: '7' } })
    expect(screen.getByText('7 years')).toBeTruthy()
    expect(calculator().state.vehicleAge).toBe(7)
  })

  it('takes its bounds and step from VEHICLE_AGE_RANGE', () => {
    renderWithCalculator(<VehicleAgeSlider label="How old is the car?" accentColor="var(--accent-finance)" />)
    const slider = screen.getByLabelText('How old is the car?')
    expect(slider.getAttribute('min')).toBe(String(VEHICLE_AGE_RANGE.min))
    expect(slider.getAttribute('max')).toBe(String(VEHICLE_AGE_RANGE.max))
    expect(slider.getAttribute('step')).toBe(String(VEHICLE_AGE_RANGE.step))
  })
})
