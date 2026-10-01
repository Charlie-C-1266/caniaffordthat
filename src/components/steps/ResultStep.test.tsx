// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup, act } from '@testing-library/react'
import { ResultStep } from './ResultStep'
import { CalculatorProvider } from '../../state/CalculatorProvider'
import { useCalculator, type CalculatorContextValue } from '../../state/calculatorContext'
import type { CalculatorState } from '../../state/types'

// The calculation engines behind this step are well tested; what wasn't is
// the routing decision the step itself owns — which of the two result cards
// (or the "fill these in first" fallback) the last step of the flow shows,
// and which fallback copy goes with which goal. Each case asserts on rendered
// output, not on which derive function was called.

const STEP_INDEX = 5
const noop = () => {}

const EMERGENCY_FALLBACK = 'Scroll back up and add your take-home pay and monthly essentials to see your result.'
const VEHICLE_FALLBACK = "Scroll back up and fill in the car's price and your take-home pay to see your result."
const GENERIC_FALLBACK = 'Scroll back up and fill in a price and take-home pay to see your result.'

let calculator: CalculatorContextValue | null = null

/** Exposes the provider's context so a test can seed the state the earlier steps would have captured. */
function CaptureContext() {
  calculator = useCalculator()
  return null
}

function renderResultStep(state: Partial<CalculatorState>) {
  render(
    <CalculatorProvider>
      <CaptureContext />
      <ResultStep index={STEP_INDEX} panelRef={noop} scrollToIndex={noop} />
    </CalculatorProvider>,
  )
  // `revealed` keeps the tile visible; the cards render either way, but this
  // matches how the step is actually reached.
  act(() => calculator?.setFields({ revealed: { [STEP_INDEX]: true }, ...state }))
}

/** The vehicle card, identified by a breakdown heading only it renders. */
const vehicleCardIsShown = () => screen.queryByText('The deal') !== null
/** The standard card, identified by a breakdown row label only it renders. */
const standardCardIsShown = () => screen.queryByText('SPARE CASH') !== null

describe('ResultStep routing', () => {
  afterEach(() => {
    cleanup()
    calculator = null
  })

  describe('with complete inputs', () => {
    it('renders the vehicle card for a vehicle goal', () => {
      renderResultStep({ goalId: 'car', itemName: 'Volkswagen Golf', itemPrice: '18000', takeHome: '2600' })

      expect(vehicleCardIsShown()).toBe(true)
      expect(standardCardIsShown()).toBe(false)
      // The vehicle-only methodology link confirms it really is that card.
      expect(screen.getByRole('link', { name: 'See exactly how these numbers are worked out →' })).toBeTruthy()
    })

    it('renders the standard card for an ordinary goal', () => {
      renderResultStep({ goalId: 'holiday', itemName: 'Japan trip', itemPrice: '4000', takeHome: '2600' })

      expect(standardCardIsShown()).toBe(true)
      expect(vehicleCardIsShown()).toBe(false)
    })

    it('renders the standard card for the price-less emergency fund', () => {
      // No item price: the target comes from coverMonths x essentials instead.
      renderResultStep({ goalId: 'emergency', takeHome: '2600', housing: '800', groceries: '300', coverMonths: 3 })

      expect(standardCardIsShown()).toBe(true)
      expect(vehicleCardIsShown()).toBe(false)
    })

    it('shows no fallback copy once a card renders', () => {
      renderResultStep({ goalId: 'holiday', itemPrice: '4000', takeHome: '2600' })

      expect(screen.queryByText(GENERIC_FALLBACK)).toBeNull()
      expect(screen.queryByText(EMERGENCY_FALLBACK)).toBeNull()
      expect(screen.queryByText(VEHICLE_FALLBACK)).toBeNull()
    })
  })

  describe('with incomplete inputs', () => {
    it('asks the emergency fund for pay and essentials', () => {
      // Take-home but no essentials, so there's no target to derive.
      renderResultStep({ goalId: 'emergency', takeHome: '2600' })

      expect(screen.getByText(EMERGENCY_FALLBACK)).toBeTruthy()
      expect(standardCardIsShown()).toBe(false)
    })

    it("asks a vehicle goal for the car's price", () => {
      renderResultStep({ goalId: 'car', takeHome: '2600', itemPrice: '' })

      expect(screen.getByText(VEHICLE_FALLBACK)).toBeTruthy()
      expect(vehicleCardIsShown()).toBe(false)
    })

    it('asks any other goal for a price and take-home pay', () => {
      renderResultStep({ goalId: 'holiday', itemPrice: '4000', takeHome: '' })

      expect(screen.getByText(GENERIC_FALLBACK)).toBeTruthy()
      expect(standardCardIsShown()).toBe(false)
    })

    it('falls back generically before any goal has been picked', () => {
      renderResultStep({ goalId: null })

      expect(screen.getByText(GENERIC_FALLBACK)).toBeTruthy()
    })
  })

  it('keeps the same goal on the same branch as its inputs are filled in', () => {
    // The two derive functions share a gate (price + take-home), so a goal
    // never switches cards partway — it moves from its own fallback copy to
    // its own card. This pins that pairing for the vehicle flow, where a
    // mis-set `isVehicle` would show the generic fallback then the wrong card.
    renderResultStep({ goalId: 'car', takeHome: '2600' })
    expect(screen.getByText(VEHICLE_FALLBACK)).toBeTruthy()

    act(() => calculator?.setField('itemPrice', '18000'))
    expect(vehicleCardIsShown()).toBe(true)
    expect(standardCardIsShown()).toBe(false)
    expect(screen.queryByText(VEHICLE_FALLBACK)).toBeNull()
  })
})
