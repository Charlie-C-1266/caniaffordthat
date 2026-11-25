// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { screen, cleanup, act } from '@testing-library/react'
import { renderWithCalculator, calculator } from '../../test/renderWithCalculator'
import { DEDUCTIONS_TAKE_ALL_PAY_RESULT, ResultStep } from './ResultStep'
import type { CalculatorState } from '../../state/types'

// The calculation engines behind this step are well tested; what wasn't is
// the routing decision the step itself owns — which of the two result cards
// (or the "fill these in first" fallback) the last step of the flow shows,
// and which fallback copy goes with which goal. Each case asserts on rendered
// output, not on which derive function was called.

const STEP_INDEX = 5
const noop = () => {}

/** Every index the step asked to scroll to, so the "back to your budget" button can be read off it. */
const advanced: number[] = []

const EMERGENCY_FALLBACK = 'Scroll back up and add your take-home pay and monthly essentials to see your result.'
const VEHICLE_FALLBACK = "Scroll back up and fill in the car's price and your take-home pay to see your result."
const GENERIC_FALLBACK = 'Scroll back up and fill in a price and take-home pay to see your result.'

function renderResultStep(state: Partial<CalculatorState>) {
  renderWithCalculator(<ResultStep index={STEP_INDEX} panelRef={noop} scrollToIndex={(i) => advanced.push(i)} />)
  // `revealed` keeps the tile visible; the cards render either way, but this
  // matches how the step is actually reached.
  act(() => calculator().setFields({ revealed: { [STEP_INDEX]: true }, ...state }))
}

/** The vehicle card, identified by a breakdown heading only it renders. */
const vehicleCardIsShown = () => screen.queryByText('The deal') !== null
/** The standard card, identified by a breakdown row label only it renders. */
const standardCardIsShown = () => screen.queryByText('SPARE CASH') !== null

describe('ResultStep routing', () => {
  afterEach(() => {
    cleanup()
    advanced.length = 0
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

    act(() => calculator().setField('itemPrice', '18000'))
    expect(vehicleCardIsShown()).toBe(true)
    expect(standardCardIsShown()).toBe(false)
    expect(screen.queryByText(VEHICLE_FALLBACK)).toBeNull()
  })
})

// #316: the result panel set its own `80px 40px 56px`, so it kept the desktop
// gutters at every width while every other step's tightened. It keeps its own
// vertical padding and takes the shared gutters.
describe('the result panel at a narrow viewport', () => {
  afterEach(cleanup)

  it('takes the shared gutters while keeping its own vertical padding', () => {
    renderResultStep({ goalId: 'holiday', itemPrice: '4000', takeHome: '2600' })
    const panel = screen.getByTestId('result-panel')
    expect(panel.style.padding).toBe('80px var(--step-gutter-x-end) 56px var(--step-gutter-x-start)')
    expect(panel.getAttribute('style')).not.toContain('80px 40px 56px')
  })

  it('gives its fallback tile the padding properties too', () => {
    renderResultStep({ goalId: 'holiday', itemPrice: '', takeHome: '' })
    const tile = document.querySelector<HTMLElement>('[style*="--tile-padding-x"]')
    expect(tile?.style.padding).toBe('var(--tile-padding-y, 40px) var(--tile-padding-x, 44px)')
  })
})

describe('when the deductions take all of the pay (#317)', () => {
  afterEach(() => {
    cleanup()
    advanced.length = 0
  })

  /** Salary mode on £20,000 with a £3,000-a-month net pay pension: the payslip has nothing left, so every engine returns null. */
  const TAKES_EVERYTHING = {
    takeHomeMode: 'salary',
    grossSalary: '20000',
    studentPlan: 'plan1',
    pensionArrangement: 'netpay',
    pensionMode: 'amount',
    pensionMonthlyAmount: '3000',
    takeHome: '0',
  } as const satisfies Partial<CalculatorState>

  /** Where each kind of goal's Budget step sits in its own flow: Goal, Details, Budget, Plan, Result — and one step later for the car. */
  const GOAL_KINDS = [
    { goalId: 'holiday', fallback: GENERIC_FALLBACK, budgetIndex: 2, extra: { itemPrice: '4000' } },
    { goalId: 'emergency', fallback: EMERGENCY_FALLBACK, budgetIndex: 2, extra: { housing: '800', groceries: '300', coverMonths: 3 } },
    { goalId: 'car', fallback: VEHICLE_FALLBACK, budgetIndex: 4, extra: { itemPrice: '18000' } },
  ] as const

  it.each(GOAL_KINDS)('says why there is no result for a $goalId goal, instead of its own fallback', ({ goalId, fallback, extra }) => {
    renderResultStep({ goalId, ...extra, ...TAKES_EVERYTHING })

    expect(screen.getByText(DEDUCTIONS_TAKE_ALL_PAY_RESULT)).toBeTruthy()
    // The old wording asked for a price and take-home the user had already given.
    expect(screen.queryByText(fallback)).toBeNull()
    expect(standardCardIsShown()).toBe(false)
    expect(vehicleCardIsShown()).toBe(false)
  })

  it.each(GOAL_KINDS)('sends a $goalId goal back to its own Budget step', ({ goalId, budgetIndex, extra }) => {
    renderResultStep({ goalId, ...extra, ...TAKES_EVERYTHING })

    act(() => {
      screen.getByRole('button', { name: 'Back to your budget' }).click()
    })
    // The vehicle flow puts Budget one step later, so the index is read off
    // the active flow rather than assumed.
    expect(advanced).toEqual([budgetIndex])
  })

  it.each(GOAL_KINDS)('still shows the $goalId fallback when the price is what is missing', ({ goalId, fallback, extra }) => {
    // Take-home mode with nothing typed: the dead end is the ordinary one, so
    // the ordinary wording is right.
    renderResultStep({ goalId, ...extra, itemPrice: '', takeHome: '' })

    expect(screen.getByText(fallback)).toBeTruthy()
    expect(screen.queryByText(DEDUCTIONS_TAKE_ALL_PAY_RESULT)).toBeNull()
  })

  it.each(GOAL_KINDS)('still shows the $goalId fallback when take-home is blank in take-home mode', ({ goalId, fallback, extra }) => {
    renderResultStep({ goalId, ...extra, takeHomeMode: 'takehome', takeHome: '' })

    expect(screen.getByText(fallback)).toBeTruthy()
    expect(screen.queryByText(DEDUCTIONS_TAKE_ALL_PAY_RESULT)).toBeNull()
  })

  it('keeps the generic fallback before a goal is picked, where there is no Budget step to return to', () => {
    // The pre-goal flow is Goal + Details only, so a button offering to go
    // back to a budget would have nowhere to send anyone.
    renderResultStep({ goalId: null, ...TAKES_EVERYTHING })

    expect(screen.getByText(GENERIC_FALLBACK)).toBeTruthy()
    expect(screen.queryByText(DEDUCTIONS_TAKE_ALL_PAY_RESULT)).toBeNull()
    expect(screen.queryByRole('button', { name: 'Back to your budget' })).toBeNull()
  })

  it('gives its tile the phone padding properties, like the fallback (#316)', () => {
    renderResultStep({ goalId: 'holiday', itemPrice: '4000', ...TAKES_EVERYTHING })
    const tile = screen.getByText(DEDUCTIONS_TAKE_ALL_PAY_RESULT).closest<HTMLElement>('[style*="--tile-padding-x"]')
    expect(tile?.style.padding).toBe('var(--tile-padding-y, 40px) var(--tile-padding-x, 44px)')
  })

  it('shows the real card again once the pension is lowered', () => {
    renderResultStep({ goalId: 'holiday', itemPrice: '4000', ...TAKES_EVERYTHING })
    expect(screen.getByText(DEDUCTIONS_TAKE_ALL_PAY_RESULT)).toBeTruthy()

    act(() => calculator().setFields({ pensionMonthlyAmount: '150', takeHome: '1400' }))
    expect(screen.queryByText(DEDUCTIONS_TAKE_ALL_PAY_RESULT)).toBeNull()
    expect(standardCardIsShown()).toBe(true)
  })
})
