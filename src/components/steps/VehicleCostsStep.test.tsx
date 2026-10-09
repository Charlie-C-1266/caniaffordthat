// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react'
import { VehicleCostsStep } from './VehicleCostsStep'
import { CalculatorProvider } from '../../state/CalculatorProvider'
import { useCalculator, type CalculatorContextValue } from '../../state/calculatorContext'
import { EXPENSIVE_CAR_PRICE_THRESHOLD, MAINTENANCE_PRESETS } from '../../lib/vehicle'
import type { BalloonMode, CalculatorState, VehicleFinanceMethod } from '../../state/types'

// The pure logic this step leans on (`vehicleAgeAskedOnPurchase`,
// `vehicleRunningCosts`) is covered in lib/vehicle.test.ts; what's covered
// here is the step's own UI decisions taken from it, none of which had a test:
// whether the car's age is asked on *this* step at all, whether the
// expensive-car tax-supplement caption shows, and the maintenance preset
// chips' write + active-state wiring.

const STEP_INDEX = 3
const noop = () => {}

const AGE_SLIDER_LABEL = 'How old is the car?'
const MAINTENANCE_LABEL = 'Maintenance / month'
const SUPPLEMENT_CAPTION = /"expensive car" tax supplement/

/** A brand-new car dear enough to attract the supplement, and one that isn't. */
const OVER_THRESHOLD_PRICE = String(EXPENSIVE_CAR_PRICE_THRESHOLD + 5000)
const UNDER_THRESHOLD_PRICE = String(EXPENSIVE_CAR_PRICE_THRESHOLD - 5000)

let calculator: CalculatorContextValue | null = null

/** Exposes the provider's context so a test can seed state and read back what the step wrote. */
function CaptureContext() {
  calculator = useCalculator()
  return null
}

function renderCostsStep(state: Partial<CalculatorState> = {}, scrollToIndex: (index: number) => void = noop) {
  render(
    <CalculatorProvider>
      <CaptureContext />
      <VehicleCostsStep index={STEP_INDEX} panelRef={noop} wrapperRef={noop} scrollToIndex={scrollToIndex} />
    </CalculatorProvider>,
  )
  // Seeded after mount because the provider hydrates its own initial state
  // from the URL; `revealed` mirrors having scrolled onto the step.
  act(() => calculator?.setFields({ goalId: 'car', revealed: { [STEP_INDEX]: true }, ...state }))
}

const ageSlider = () => screen.queryByRole('slider', { name: AGE_SLIDER_LABEL })
const supplementCaption = () => screen.queryByText(SUPPLEMENT_CAPTION)

const presetChip = (label: string, monthly: number) => screen.getByRole('button', { name: `${label} £${monthly}` })
const pressedChipNames = () =>
  MAINTENANCE_PRESETS.filter((preset) => presetChip(preset.label, preset.monthly).getAttribute('aria-pressed') === 'true').map(
    (preset) => preset.id,
  )

/**
 * The money input belonging to a field label. FieldLabel renders a bare
 * `<label>` with no `htmlFor`, so there's no accessible name to query by —
 * the input is found through the wrapper the two share instead.
 */
function fieldInput(labelText: string): HTMLInputElement {
  const [label] = screen.getAllByText((_, element) => element?.tagName === 'LABEL' && (element.textContent ?? '').startsWith(labelText))
  const input = label?.parentElement?.querySelector('input')
  if (!input) throw new Error(`No input found for field labelled "${labelText}"`)
  return input
}

describe('VehicleCostsStep', () => {
  afterEach(() => {
    cleanup()
    calculator = null
  })

  describe('the car-age question', () => {
    it('is not asked again when the PCP estimate path already asked it on the purchase step', () => {
      renderCostsStep({ vehicleMethod: 'pcp', balloonMode: 'estimate' })
      expect(ageSlider()).toBeNull()
    })

    // Every other method/balloonMode combination leaves the age unasked so
    // far, so this step has to ask it — it drives the tax picture below.
    const asksHere: { method: VehicleFinanceMethod; balloonMode: BalloonMode }[] = [
      { method: 'cash', balloonMode: 'estimate' },
      { method: 'hp', balloonMode: 'estimate' },
      { method: 'loan', balloonMode: 'estimate' },
      { method: 'pcp', balloonMode: 'known' },
    ]

    it.each(asksHere)('asks it here for $method with a $balloonMode balloon', ({ method, balloonMode }) => {
      renderCostsStep({ vehicleMethod: method, balloonMode })
      expect(ageSlider()).not.toBeNull()
    })

    it('reads out the seeded age and writes the dragged value back to state', () => {
      renderCostsStep({ vehicleMethod: 'cash', vehicleAge: 5 })
      const slider = ageSlider()
      expect(slider).not.toBeNull()
      expect((slider as HTMLInputElement).value).toBe('5')
      expect(slider?.getAttribute('aria-valuetext')).toBe('5 years')

      act(() => {
        fireEvent.change(slider as HTMLInputElement, { target: { value: '7' } })
      })
      expect(calculator?.state.vehicleAge).toBe(7)
      expect(ageSlider()?.getAttribute('aria-valuetext')).toBe('7 years')
    })

    it('reads out age 0 as "Brand new" and age 1 in the singular', () => {
      renderCostsStep({ vehicleMethod: 'cash', vehicleAge: 0 })
      expect(ageSlider()?.getAttribute('aria-valuetext')).toBe('Brand new')

      act(() => {
        fireEvent.change(ageSlider() as HTMLInputElement, { target: { value: '1' } })
      })
      expect(ageSlider()?.getAttribute('aria-valuetext')).toBe('1 year')
    })
  })

  describe('the expensive-car tax supplement caption', () => {
    it('explains the auto-added supplement for a brand-new car over the threshold', () => {
      renderCostsStep({ vehicleMethod: 'cash', itemPrice: OVER_THRESHOLD_PRICE, vehicleAge: 0 })
      expect(supplementCaption()).not.toBeNull()
    })

    it('stays away for a brand-new car under the threshold', () => {
      renderCostsStep({ vehicleMethod: 'cash', itemPrice: UNDER_THRESHOLD_PRICE, vehicleAge: 0 })
      expect(supplementCaption()).toBeNull()
    })

    it('stays away at exactly the threshold price — the supplement needs a price over it', () => {
      renderCostsStep({ vehicleMethod: 'cash', itemPrice: String(EXPENSIVE_CAR_PRICE_THRESHOLD), vehicleAge: 0 })
      expect(supplementCaption()).toBeNull()
    })

    it('stays away for an older car over the threshold, and disappears as soon as the age is dragged off "Brand new"', () => {
      renderCostsStep({ vehicleMethod: 'cash', itemPrice: OVER_THRESHOLD_PRICE, vehicleAge: 0 })
      expect(supplementCaption()).not.toBeNull()

      act(() => {
        fireEvent.change(ageSlider() as HTMLInputElement, { target: { value: '3' } })
      })
      expect(supplementCaption()).toBeNull()
    })
  })

  describe('the maintenance preset chips', () => {
    it.each(MAINTENANCE_PRESETS.map((preset) => preset))('$label writes £$monthly and lights up alone', (preset) => {
      renderCostsStep({ maintenanceMonthly: '' })
      expect(pressedChipNames()).toEqual([])

      fireEvent.click(presetChip(preset.label, preset.monthly))
      expect(calculator?.state.maintenanceMonthly).toBe(String(preset.monthly))
      expect(fieldInput(MAINTENANCE_LABEL).value).toBe(String(preset.monthly))
      expect(pressedChipNames()).toEqual([preset.id])
    })

    it('lights up the preset a typed amount happens to match', () => {
      const [budget] = MAINTENANCE_PRESETS
      renderCostsStep({ maintenanceMonthly: '' })
      fireEvent.change(fieldInput(MAINTENANCE_LABEL), { target: { value: String(budget.monthly) } })
      expect(pressedChipNames()).toEqual([budget.id])
    })

    it('leaves every chip unlit for a custom amount that matches no preset', () => {
      const [budget] = MAINTENANCE_PRESETS
      renderCostsStep({ maintenanceMonthly: String(budget.monthly) })
      expect(pressedChipNames()).toEqual([budget.id])

      fireEvent.change(fieldInput(MAINTENANCE_LABEL), { target: { value: '47' } })
      expect(calculator?.state.maintenanceMonthly).toBe('47')
      expect(pressedChipNames()).toEqual([])
    })
  })

  describe('the running-cost fields', () => {
    // Each field is wired to its own state key by an inline handler; a
    // copy-paste slip between two of them would silently cost or save the
    // user money, and nothing checked the mapping.
    const fields: { label: string; key: keyof CalculatorState; typed: string }[] = [
      { label: 'Miles you drive / year', key: 'annualMiles', typed: '12000' },
      { label: 'Average fuel economy', key: 'mpg', typed: '55' },
      { label: 'Fuel price', key: 'fuelPencePerLitre', typed: '152' },
      { label: 'Maintenance / month', key: 'maintenanceMonthly', typed: '45' },
      { label: 'Insurance / year', key: 'insuranceAnnual', typed: '900' },
      { label: 'Road tax (VED) / year', key: 'taxAnnual', typed: '620' },
    ]

    it.each(fields)('writes what is typed in "$label" to $key', ({ label, key, typed }) => {
      renderCostsStep()
      fireEvent.change(fieldInput(label), { target: { value: typed } })
      expect(calculator?.state[key]).toBe(typed)
    })

    it.each(fields)('advances to the next step on Enter in "$label"', ({ label }) => {
      const scrollToIndex = vi.fn()
      renderCostsStep({}, scrollToIndex)
      fireEvent.keyDown(fieldInput(label), { key: 'Enter' })
      expect(scrollToIndex).toHaveBeenCalledWith(STEP_INDEX + 1)
    })

    it('ignores other keys rather than advancing on any keystroke', () => {
      const scrollToIndex = vi.fn()
      renderCostsStep({}, scrollToIndex)
      fireEvent.keyDown(fieldInput('Average fuel economy'), { key: 'a' })
      expect(scrollToIndex).not.toHaveBeenCalled()
    })
  })
})
