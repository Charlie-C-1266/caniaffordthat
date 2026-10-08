// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup, act } from '@testing-library/react'
import { VehicleResultCard } from './VehicleResultCard'
import { CalculatorProvider } from '../../state/CalculatorProvider'
import { useCalculator, type CalculatorContextValue } from '../../state/calculatorContext'
import { budgetBreakdown } from '../../lib/budgetSplit'
import { DEFAULT_STATE } from '../../state/defaults'
import type { VehicleResult } from '../../lib/vehicle'
import type { CalculatorState } from '../../state/types'

// vehicle.ts's maths is well covered; what isn't is this card's own assembly —
// the cash-vs-finance split in "The deal", the balloon row and its two
// labels, and whether the caveats block exists at all. Each case hands the
// card a hand-built VehicleResult so a row can be pinned to one field.

const noop = () => {}

let calculator: CalculatorContextValue | null = null

/** Exposes the provider's context so a test can seed the state the earlier steps would have captured. */
function CaptureContext() {
  calculator = useCalculator()
  return null
}

/** A financed (PCP) purchase with an estimated balloon — the flow's default shape. */
function financedResult(overrides: Partial<VehicleResult> = {}): VehicleResult {
  return {
    method: 'pcp',
    price: 18000,
    deposit: 3000,
    principal: 15000,
    financeMonthly: 260,
    balloon: 7200,
    balloonIsEstimate: true,
    termMonths: 48,
    aprPct: 9.9,
    running: { fuel: 95, maintenance: 60, insurance: 50, tax: 20, supplementMonthly: 0, total: 225 },
    totalMonthly: 485,
    spareCash: 900,
    upfront: 3000,
    totalPayable: 22680,
    interestPaid: 4680,
    supplementApplies: false,
    isAffordable: true,
    verdictText: 'Yes — this car fits',
    verdictSub: 'It leaves room in your spare cash.',
    resultEyebrow: 'PCP OVER 48 MONTHS',
    headline: '£485 a month, all in',
    subheadline: 'Finance plus running costs.',
    // Kept null so these tests exercise the card, not the chart; ResultChart's
    // own branches are covered in ResultChart.test.tsx.
    projection: null,
    budget: budgetBreakdown(DEFAULT_STATE, 485),
    requiredTakeHomeMonthly: 2400,
    notes: [],
    ...overrides,
  }
}

/** A cash purchase: no agreement, so no finance payment, term, APR or balloon. */
function cashResult(overrides: Partial<VehicleResult> = {}): VehicleResult {
  return financedResult({
    method: 'cash',
    deposit: 2000,
    principal: 16000,
    financeMonthly: 0,
    balloon: null,
    balloonIsEstimate: false,
    totalMonthly: 225,
    upfront: 16000,
    totalPayable: 18000,
    interestPaid: 0,
    resultEyebrow: 'PAID IN CASH',
    ...overrides,
  })
}

/** Renders the card under a provider seeded with the fields it reads off state. */
function renderCard(result: VehicleResult, state: Partial<CalculatorState> = {}) {
  render(
    <CalculatorProvider>
      <CaptureContext />
      <VehicleResultCard result={result} scrollToIndex={noop} />
    </CalculatorProvider>,
  )
  act(() => calculator?.setFields({ goalId: 'car', ...state }))
}

/** The £ value rendered next to a breakdown label, or null when the row is absent. */
function rowValue(label: string): string | null {
  const labelEl = screen.queryByText(label)
  return labelEl?.nextElementSibling?.textContent ?? null
}

describe('VehicleResultCard', () => {
  afterEach(() => {
    cleanup()
    calculator = null
  })

  describe('a cash purchase', () => {
    it('shows a single DUE UPFRONT total and none of the agreement rows', () => {
      renderCard(cashResult(), { itemName: 'Volkswagen Golf' })

      expect(rowValue('DUE UPFRONT')).toBe('£16,000')
      // Nothing is financed, so none of the agreement's rows apply.
      expect(screen.queryByText('AMOUNT FINANCED')).toBeNull()
      expect(screen.queryByText('TERM')).toBeNull()
      expect(screen.queryByText('APR')).toBeNull()
      expect(screen.queryByText('TOTAL INTEREST')).toBeNull()
      expect(screen.queryByText('TOTAL PAYABLE')).toBeNull()
    })

    it('omits the monthly finance-payment row, keeping only the running costs', () => {
      renderCard(cashResult())

      expect(screen.queryByText('FINANCE')).toBeNull()
      expect(screen.queryByText('PCP PAYMENT')).toBeNull()
      expect(rowValue('FUEL')).toBe('£95')
      expect(rowValue('TOTAL / MONTH')).toBe('£225')
    })

    it('never shows a final-payment row', () => {
      renderCard(cashResult())

      expect(screen.queryByText('FINAL PAYMENT')).toBeNull()
      expect(screen.queryByText('FINAL PAYMENT (EST.)')).toBeNull()
    })
  })

  describe('a financed purchase', () => {
    it('labels the monthly payment row after the agreement actually chosen', () => {
      renderCard(financedResult({ method: 'hp' }))

      expect(rowValue('HIRE PURCHASE PAYMENT')).toBe('£260')
      expect(screen.queryByText('PCP PAYMENT')).toBeNull()
    })

    it('shows the full agreement breakdown instead of a DUE UPFRONT total', () => {
      renderCard(financedResult())

      expect(rowValue('AMOUNT FINANCED')).toBe('£15,000')
      expect(rowValue('TERM')).toBe('48 months')
      expect(rowValue('APR')).toBe('9.9%')
      expect(rowValue('TOTAL INTEREST')).toBe('£4,680')
      expect(rowValue('TOTAL IF YOU KEEP IT')).toBe('£22,680')
      expect(screen.queryByText('DUE UPFRONT')).toBeNull()
    })

    it('marks an estimated balloon as an estimate', () => {
      renderCard(financedResult({ balloon: 7200, balloonIsEstimate: true }))

      expect(rowValue('FINAL PAYMENT (EST.)')).toBe('£7,200')
      expect(screen.queryByText('FINAL PAYMENT')).toBeNull()
    })

    it("leaves a lender's quoted balloon unqualified", () => {
      renderCard(financedResult({ balloon: 6500, balloonIsEstimate: false }))

      expect(rowValue('FINAL PAYMENT')).toBe('£6,500')
      expect(screen.queryByText('FINAL PAYMENT (EST.)')).toBeNull()
    })

    it('omits the final-payment row for an agreement without a balloon', () => {
      // HP and personal loans repay in full, so there's nothing left at the end.
      renderCard(financedResult({ method: 'loan', balloon: null, balloonIsEstimate: false }))

      expect(screen.queryByText('FINAL PAYMENT')).toBeNull()
      expect(screen.queryByText('FINAL PAYMENT (EST.)')).toBeNull()
      expect(rowValue('TOTAL PAYABLE')).toBe('£22,680')
    })
  })

  describe('the caveats block', () => {
    it('renders one line per note', () => {
      const notes = ['The final payment is our estimate, not a quote.', 'Over £40k attracts the VED supplement.']
      renderCard(financedResult({ notes }))

      const block = screen.getByTestId('vehicle-caveats')
      expect(Array.from(block.children, (line) => line.textContent)).toEqual(notes)
    })

    it('is absent entirely when there are no notes', () => {
      renderCard(financedResult({ notes: [] }))

      // The block itself, not just its lines: an empty wrapper would still
      // leave its bottom margin as a stray gap above the salary panel.
      expect(screen.queryByTestId('vehicle-caveats')).toBeNull()
    })
  })

  it('names the car from the typed name, falling back to a generic label', () => {
    renderCard(financedResult(), { itemName: 'Volkswagen Golf' })
    expect(rowValue('CAR')).toBe('Volkswagen Golf — £18,000')

    cleanup()
    renderCard(financedResult(), { itemName: '' })
    expect(rowValue('CAR')).toBe('Vehicle — £18,000')
  })

  it('passes the verdict through to the banner', () => {
    renderCard(financedResult({ isAffordable: false, verdictText: 'Too much car', verdictSub: 'It overruns your spare cash.' }))

    const banner = screen.getByTestId('verdict-banner')
    expect(banner.textContent).toContain('Too much car')
    expect(banner.textContent).toContain('It overruns your spare cash.')
  })
})
