// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react'
import { VehiclePurchaseStep } from './VehiclePurchaseStep'
import { CalculatorProvider } from '../../state/CalculatorProvider'
import { useCalculator, type CalculatorContextValue } from '../../state/calculatorContext'
import { TERM_RANGES, UK_AVERAGE_ANNUAL_MILES, estimateBalloon } from '../../lib/vehicle'
import { fmt } from '../../lib/calculations'
import type { CalculatorState, VehicleFinanceMethod } from '../../state/types'

// Switching purchase method silently pulls the current term into the new
// method's range, because derive/vehicle.ts trusts state.term as already
// valid for the selected method. Nothing exercised that clamp — e2e only
// walks the default method's happy path — so a clamp in the wrong direction,
// or one that fired on the cash branch, would reach the monthly-payment
// maths unnoticed.
//
// The bounds come from the real TERM_RANGES rather than hard-coded guesses,
// so widening a range can't silently leave a case testing nothing.
//
// Beyond the clamp, this file covers the rest of what the step renders: the
// cash summary, the term and APR sliders, and the PCP balloon — its
// quote-vs-estimate choice, the age and mileage inputs behind the estimate,
// and the estimated figure itself. The balloon is the largest single number
// in a PCP result and the one nobody is shown on a quote until signing, so a
// wrong figure here misprices the whole deal.

const STEP_INDEX = 2
const noop = () => {}

const PRICE = '18000'

let calculator: CalculatorContextValue | null = null
/** Every index the step asked to scroll to, so Enter-to-advance can be read off it. */
const advanced: number[] = []

/** Exposes the provider's context so a test can seed and read back the term. */
function CaptureContext() {
  calculator = useCalculator()
  return null
}

/** Renders the purchase step with arbitrary seeded state, on the car goal. */
function renderStep(state: Partial<CalculatorState> = {}) {
  render(
    <CalculatorProvider>
      <CaptureContext />
      <VehiclePurchaseStep index={STEP_INDEX} panelRef={noop} wrapperRef={noop} scrollToIndex={(i) => advanced.push(i)} />
    </CalculatorProvider>,
  )
  act(() => calculator?.setFields({ goalId: 'car', itemPrice: PRICE, ...state }))
}

/** Renders the purchase step with a controlled starting method and term. */
function renderPurchaseStep(term: number, vehicleMethod: VehicleFinanceMethod = 'loan') {
  renderStep({ vehicleMethod, term })
}

const methodChip = (label: string) => screen.getByRole('button', { name: label })
/** The term the step currently holds — the value derive/vehicle.ts will read. */
const currentTerm = () => calculator?.state.term
/** The term as the slider shows it, so the read-out can't drift from state. */
const termSliderValue = () => Number(screen.getByRole<HTMLInputElement>('slider', { name: 'Term length' }).value)
const slider = (name: string) => screen.getByRole<HTMLInputElement>('slider', { name })
/** The single numeric input on screen: the quoted balloon, or the mileage field behind the estimate. */
const numberInput = () => screen.getByRole<HTMLInputElement>('spinbutton')
const balloonModeButton = (label: string) => screen.getByRole('button', { name: label })

describe('VehiclePurchaseStep term clamping', () => {
  afterEach(() => {
    cleanup()
    calculator = null
    advanced.length = 0
  })

  it("clamps a too-long term down to the new method's maximum", () => {
    // A bank loan runs longer than a PCP is ever sold over.
    const startTerm = TERM_RANGES.loan.max
    renderPurchaseStep(startTerm, 'loan')
    expect(currentTerm()).toBe(startTerm)

    act(() => {
      fireEvent.click(methodChip('PCP'))
    })

    expect(currentTerm()).toBe(TERM_RANGES.pcp.max)
    expect(termSliderValue()).toBe(TERM_RANGES.pcp.max)
  })

  it("clamps a too-short term up to the new method's minimum", () => {
    const startTerm = TERM_RANGES.pcp.min - 6
    renderPurchaseStep(startTerm, 'pcp')
    expect(currentTerm()).toBe(startTerm)

    act(() => {
      fireEvent.click(methodChip('Hire purchase'))
    })

    expect(currentTerm()).toBe(TERM_RANGES.hp.min)
    expect(termSliderValue()).toBe(TERM_RANGES.hp.min)
  })

  it('leaves a term already inside the new range untouched', () => {
    // Comfortably inside both PCP's and HP's bounds.
    const startTerm = Math.round((TERM_RANGES.pcp.min + TERM_RANGES.pcp.max) / 2)
    renderPurchaseStep(startTerm, 'pcp')

    act(() => {
      fireEvent.click(methodChip('Hire purchase'))
    })

    expect(currentTerm()).toBe(startTerm)
    expect(termSliderValue()).toBe(startTerm)
  })

  it('leaves the term completely untouched when switching to cash', () => {
    // Deliberately outside every finance range: cash has nothing to clamp
    // against, and clobbering a term the user won't see again would surprise
    // them if they switched back.
    const startTerm = TERM_RANGES.loan.max + 12
    renderPurchaseStep(startTerm, 'loan')
    const before = currentTerm()

    act(() => {
      fireEvent.click(methodChip('Cash'))
    })

    expect(calculator?.state.vehicleMethod).toBe('cash')
    expect(currentTerm()).toBe(before)
    expect(currentTerm()).toBe(startTerm)
    // Cash shows no agreement, so there's no term slider to read it back from.
    expect(screen.queryByRole('slider', { name: 'Term length' })).toBeNull()
  })

  it('re-clamps on the way back out of cash', () => {
    // The term cash preserved is still out of range for a PCP, so selecting
    // one has to clamp it then — the cash branch defers the clamp, it doesn't
    // cancel it.
    renderPurchaseStep(TERM_RANGES.loan.max, 'loan')

    act(() => {
      fireEvent.click(methodChip('Cash'))
    })
    expect(currentTerm()).toBe(TERM_RANGES.loan.max)

    act(() => {
      fireEvent.click(methodChip('PCP'))
    })

    expect(currentTerm()).toBe(TERM_RANGES.pcp.max)
  })

  it('records the chosen method on every branch', () => {
    renderPurchaseStep(TERM_RANGES.pcp.min, 'cash')

    for (const [label, method] of [
      ['PCP', 'pcp'],
      ['Hire purchase', 'hp'],
      ['Bank loan', 'loan'],
      ['Cash', 'cash'],
    ] as const) {
      act(() => {
        fireEvent.click(methodChip(label))
      })
      expect(calculator?.state.vehicleMethod).toBe(method)
      expect(methodChip(label).getAttribute('aria-pressed')).toBe('true')
    }
  })
})

describe('VehiclePurchaseStep cash summary', () => {
  afterEach(() => {
    cleanup()
    calculator = null
    advanced.length = 0
  })

  it('names what is handed over on the day, net of the deposit', () => {
    renderStep({ vehicleMethod: 'cash', savings: '3000' })

    expect(screen.getByText(fmt(15000))).toBeTruthy()
    expect(screen.getByText(/after your £3,000 deposit \/ part-exchange/)).toBeTruthy()
  })

  it('omits the deposit clause when there is no deposit', () => {
    renderStep({ vehicleMethod: 'cash', savings: '0' })

    expect(screen.getByText(fmt(18000))).toBeTruthy()
    expect(screen.queryByText(/deposit \/ part-exchange/)).toBeNull()
  })

  it('caps a deposit larger than the price, rather than showing a negative figure', () => {
    // Someone part-exchanging a car worth more than the one they're buying.
    renderStep({ vehicleMethod: 'cash', savings: '25000' })

    expect(screen.getByText(fmt(0))).toBeTruthy()
    expect(screen.getByText(/after your £18,000 deposit \/ part-exchange/)).toBeTruthy()
  })

  it('asks for the price instead of computing against nothing', () => {
    renderStep({ vehicleMethod: 'cash', itemPrice: '' })

    expect(screen.getByText(/Add the car's price in the previous step and we'll show what you'd hand over/)).toBeTruthy()
  })
})

describe('VehiclePurchaseStep term and rate', () => {
  afterEach(() => {
    cleanup()
    calculator = null
    advanced.length = 0
  })

  it('writes the term the slider is dragged to', () => {
    renderStep({ vehicleMethod: 'hp', term: TERM_RANGES.hp.min })
    const target = TERM_RANGES.hp.min + 12

    fireEvent.change(slider('Term length'), { target: { value: String(target) } })

    expect(calculator?.state.term).toBe(target)
    expect(slider('Term length').getAttribute('aria-valuetext')).toBe(`${target} months`)
  })

  it("bounds the slider by the selected method's own range", () => {
    renderStep({ vehicleMethod: 'pcp', term: TERM_RANGES.pcp.min })

    expect(slider('Term length').getAttribute('min')).toBe(String(TERM_RANGES.pcp.min))
    expect(slider('Term length').getAttribute('max')).toBe(String(TERM_RANGES.pcp.max))

    act(() => {
      fireEvent.click(methodChip('Bank loan'))
    })

    expect(slider('Term length').getAttribute('min')).toBe(String(TERM_RANGES.loan.min))
    expect(slider('Term length').getAttribute('max')).toBe(String(TERM_RANGES.loan.max))
  })

  it('writes the APR', () => {
    renderStep({ vehicleMethod: 'loan', term: TERM_RANGES.loan.min })

    fireEvent.change(slider('Interest rate (APR)'), { target: { value: '11.9' } })

    expect(calculator?.state.growth).toBe(11.9)
    expect(slider('Interest rate (APR)').getAttribute('aria-valuetext')).toBe('11.9%')
  })

  it('accepts a 0% APR deal', () => {
    renderStep({ vehicleMethod: 'hp', term: TERM_RANGES.hp.min, growth: 9.9 })

    fireEvent.change(slider('Interest rate (APR)'), { target: { value: '0' } })

    expect(calculator?.state.growth).toBe(0)
  })

  it('shows neither slider on the cash branch', () => {
    renderStep({ vehicleMethod: 'cash' })

    expect(screen.queryByRole('slider', { name: 'Term length' })).toBeNull()
    expect(screen.queryByRole('slider', { name: 'Interest rate (APR)' })).toBeNull()
  })
})

describe('VehiclePurchaseStep PCP balloon', () => {
  afterEach(() => {
    cleanup()
    calculator = null
    advanced.length = 0
  })

  const QUOTE_LABEL = 'Final payment from your quote'

  it('is asked about on PCP only — HP and a bank loan have no balloon', () => {
    renderStep({ vehicleMethod: 'hp', term: TERM_RANGES.hp.min })
    expect(screen.queryByText(/The final payment \(balloon \/ GMFV\)/)).toBeNull()

    cleanup()
    renderStep({ vehicleMethod: 'loan', term: TERM_RANGES.loan.min })
    expect(screen.queryByText(/The final payment \(balloon \/ GMFV\)/)).toBeNull()

    cleanup()
    renderStep({ vehicleMethod: 'pcp', term: TERM_RANGES.pcp.min })
    expect(screen.getByText(/The final payment \(balloon \/ GMFV\)/)).toBeTruthy()
  })

  it("estimates by default, asking the car's age and mileage", () => {
    // The default, so the flow produces a result without a finance quote in
    // hand — see the step's own comment.
    renderStep({ vehicleMethod: 'pcp', term: TERM_RANGES.pcp.min })

    expect(slider('How old is the car now?')).toBeTruthy()
    expect(screen.getByText('miles')).toBeTruthy()
    expect(screen.queryByText(QUOTE_LABEL)).toBeNull()
  })

  it('takes the quoted figure instead once the user says they have one', () => {
    renderStep({ vehicleMethod: 'pcp', term: TERM_RANGES.pcp.min })

    fireEvent.click(balloonModeButton('I have a quote'))

    expect(calculator?.state.balloonMode).toBe('known')
    expect(screen.getByText(QUOTE_LABEL)).toBeTruthy()
    // The age and mileage questions only exist to feed the estimate.
    expect(screen.queryByRole('slider', { name: 'How old is the car now?' })).toBeNull()
  })

  it('writes the quoted figure', () => {
    renderStep({ vehicleMethod: 'pcp', term: TERM_RANGES.pcp.min, balloonMode: 'known' })

    fireEvent.change(numberInput(), { target: { value: '7500' } })

    expect(calculator?.state.balloonAmount).toBe('7500')
  })

  it('switches back to estimating', () => {
    renderStep({ vehicleMethod: 'pcp', term: TERM_RANGES.pcp.min, balloonMode: 'known' })

    fireEvent.click(balloonModeButton('Estimate it for me'))

    expect(calculator?.state.balloonMode).toBe('estimate')
    expect(slider('How old is the car now?')).toBeTruthy()
  })

  it('writes the age, reading 0 back as "Brand new" rather than "0 years"', () => {
    renderStep({ vehicleMethod: 'pcp', term: TERM_RANGES.pcp.min })

    fireEvent.change(slider('How old is the car now?'), { target: { value: '0' } })

    expect(calculator?.state.vehicleAge).toBe(0)
    expect(slider('How old is the car now?').getAttribute('aria-valuetext')).toBe('Brand new')
  })

  it('says "1 year", not "1 years"', () => {
    renderStep({ vehicleMethod: 'pcp', term: TERM_RANGES.pcp.min, vehicleAge: 1 })

    expect(slider('How old is the car now?').getAttribute('aria-valuetext')).toBe('1 year')
  })

  it('pluralises every other age', () => {
    renderStep({ vehicleMethod: 'pcp', term: TERM_RANGES.pcp.min })

    fireEvent.change(slider('How old is the car now?'), { target: { value: '12' } })

    expect(slider('How old is the car now?').getAttribute('aria-valuetext')).toBe('12 years')
  })

  it('writes the current mileage', () => {
    renderStep({ vehicleMethod: 'pcp', term: TERM_RANGES.pcp.min })

    fireEvent.change(numberInput(), { target: { value: '46000' } })

    expect(calculator?.state.vehicleMileage).toBe('46000')
  })

  it('shows the estimate the depreciation curve actually produces', () => {
    const term = TERM_RANGES.pcp.min
    renderStep({ vehicleMethod: 'pcp', term, vehicleAge: 3, vehicleMileage: '30000', annualMiles: '12000' })

    const expected = estimateBalloon({
      price: Number(PRICE),
      ageYears: 3,
      currentMileage: 30000,
      termMonths: term,
      annualMiles: 12000,
    })

    expect(screen.getByText(fmt(expected))).toBeTruthy()
    // The assumption behind the figure is stated, and sourced.
    expect(screen.getByText(/12,000 miles/)).toBeTruthy()
    expect(screen.getByRole('link', { name: /How we estimate this/ }).getAttribute('href')).toBe('/methodology/vehicle/')
  })

  it('falls back to the UK average when no annual mileage is given', () => {
    renderStep({ vehicleMethod: 'pcp', term: TERM_RANGES.pcp.min, annualMiles: '' })

    expect(screen.getByText(new RegExp(`${UK_AVERAGE_ANNUAL_MILES.toLocaleString('en-GB')} miles`))).toBeTruthy()
  })

  it('asks for the price instead of estimating against nothing', () => {
    renderStep({ vehicleMethod: 'pcp', term: TERM_RANGES.pcp.min, itemPrice: '' })

    expect(screen.getByText(/Add the car's price in the previous step and we'll estimate the final payment/)).toBeTruthy()
  })
})

describe('VehiclePurchaseStep Enter to advance', () => {
  afterEach(() => {
    cleanup()
    calculator = null
    advanced.length = 0
  })

  it('advances from the quoted-balloon field', () => {
    renderStep({ vehicleMethod: 'pcp', term: TERM_RANGES.pcp.min, balloonMode: 'known' })

    fireEvent.keyDown(numberInput(), { key: 'Enter' })

    expect(advanced).toEqual([STEP_INDEX + 1])
  })

  it('advances from the mileage field', () => {
    renderStep({ vehicleMethod: 'pcp', term: TERM_RANGES.pcp.min })

    fireEvent.keyDown(numberInput(), { key: 'Enter' })

    expect(advanced).toEqual([STEP_INDEX + 1])
  })

  it('ignores every other key', () => {
    renderStep({ vehicleMethod: 'pcp', term: TERM_RANGES.pcp.min })

    fireEvent.keyDown(numberInput(), { key: 'Tab' })
    fireEvent.keyDown(numberInput(), { key: '5' })

    expect(advanced).toEqual([])
  })
})
