// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup, act } from '@testing-library/react'
import { StandardResultCard } from './StandardResultCard'
import { CalculatorProvider } from '../../state/CalculatorProvider'
import { useCalculator, type CalculatorContextValue } from '../../state/calculatorContext'
import { budgetBreakdown } from '../../lib/budgetSplit'
import { DEFAULT_STATE } from '../../state/defaults'
import type { DerivedResult } from '../../lib/derive'
import type { CalculatorState } from '../../state/types'

// The engines behind this card (derive.ts, projection.ts, budgetSplit.ts) are
// already well tested; what has no coverage is the card's own *assembly* — the
// conditionals that decide whether a whole breakdown row exists at all. Each
// case hands the card a hand-built DerivedResult rather than going through
// derive(), so a row can be pinned to exactly one field of the result.

const noop = () => {}

let calculator: CalculatorContextValue | null = null

/** Exposes the provider's context so a test can seed the state the earlier steps would have captured. */
function CaptureContext() {
  calculator = useCalculator()
  return null
}

/** A plain savings result: no finance totals, no reverse-salary panel. */
function savingsResult(overrides: Partial<DerivedResult> = {}): DerivedResult {
  return {
    spareCash: 1200,
    grossTarget: 10000,
    target: 8000,
    months: 20,
    contribution: 400,
    // Finance-only figures; `undefined` is what a savings plan leaves behind.
    totalCost: undefined,
    interestPaid: undefined,
    isFeasible: true,
    fits: true,
    isAffordable: true,
    verdictText: 'Yes — you can afford this',
    verdictSub: 'It fits inside your spare cash.',
    resultEyebrow: 'YOUR PLAN',
    headline: 'About 20 months to save it up',
    subheadline: 'Saving £400 a month gets you there.',
    contributionRowLabel: 'MONTHLY SAVING',
    targetRowLabel: 'LEFT TO SAVE',
    // Kept null so these tests exercise the card, not the chart; ResultChart's
    // own branches are covered in ResultChart.test.tsx.
    projection: null,
    budget: budgetBreakdown(DEFAULT_STATE, 400),
    requiredTakeHomeMonthly: null,
    ...overrides,
  }
}

/** Renders the card under a provider seeded with the fields it reads off state. */
function renderCard(result: DerivedResult, state: Partial<CalculatorState> = {}) {
  render(
    <CalculatorProvider>
      <CaptureContext />
      <StandardResultCard result={result} scrollToIndex={noop} />
    </CalculatorProvider>,
  )
  act(() => calculator?.setFields(state))
}

/** The £ value rendered next to a breakdown label, or null when the row is absent. */
function rowValue(label: string): string | null {
  const labelEl = screen.queryByText(label)
  return labelEl?.nextElementSibling?.textContent ?? null
}

describe('StandardResultCard', () => {
  afterEach(() => {
    cleanup()
    calculator = null
  })

  describe('the finance-only total rows', () => {
    it('omits TOTAL INTEREST and TOTAL COST for a plain savings goal', () => {
      renderCard(savingsResult(), { goalId: 'holiday', itemName: 'Japan trip' })

      expect(screen.queryByText('TOTAL INTEREST')).toBeNull()
      expect(screen.queryByText('TOTAL COST')).toBeNull()
      // The rows that don't depend on the finance branch are still there.
      expect(rowValue('SPARE CASH')).toBe('£1,200')
      expect(rowValue('MONTHLY SAVING')).toBe('£400')
    })

    it('renders both total rows for a finance-mode result', () => {
      renderCard(
        savingsResult({
          totalCost: 9600,
          interestPaid: 1600,
          contributionRowLabel: 'MONTHLY PAYMENT',
          targetRowLabel: 'AMOUNT BORROWED',
        }),
        { goalId: 'luxury', mode: 'monthly', itemName: 'Watch' },
      )

      expect(rowValue('TOTAL INTEREST')).toBe('£1,600')
      expect(rowValue('TOTAL COST')).toBe('£9,600')
    })

    it('renders TOTAL INTEREST as £0 when a 0% deal reports no interest', () => {
      // The pair is gated on totalCost alone, so a finance result costing no
      // more than the item must still show both rows, at £0.
      renderCard(savingsResult({ totalCost: 8000, interestPaid: 0 }), { goalId: 'luxury', mode: 'monthly' })

      expect(rowValue('TOTAL INTEREST')).toBe('£0')
      expect(rowValue('TOTAL COST')).toBe('£8,000')
    })

    it('falls back to £0 interest when only a total cost is reported', () => {
      // derive.ts sets totalCost and interestPaid together, so this covers the
      // card's own `interestPaid ?? 0` guard rather than a reachable state.
      renderCard(savingsResult({ totalCost: 8000, interestPaid: undefined }), { goalId: 'luxury', mode: 'monthly' })

      expect(rowValue('TOTAL INTEREST')).toBe('£0')
    })
  })

  describe('the GOAL row label', () => {
    it('reads the goal name, gross target and cover months for an emergency fund', () => {
      renderCard(savingsResult({ grossTarget: 4500 }), { goalId: 'emergency', coverMonths: 6 })

      expect(rowValue('GOAL')).toBe('Emergency fund — £4,500 (6 mo)')
      // Emergency funds are "set aside", not "saved toward this".
      expect(screen.getByText('ALREADY SET ASIDE')).toBeTruthy()
      expect(screen.queryByText('ALREADY SAVED')).toBeNull()
    })

    it("reads the user's own item name for an ordinary goal", () => {
      renderCard(savingsResult({ grossTarget: 10000 }), { goalId: 'holiday', itemName: 'Japan trip', savings: '2000' })

      expect(rowValue('GOAL')).toBe('Japan trip — £10,000')
      expect(rowValue('ALREADY SAVED')).toBe('£2,000')
      expect(screen.queryByText('ALREADY SET ASIDE')).toBeNull()
    })

    it('falls back to the goal name when no item name was typed', () => {
      renderCard(savingsResult({ grossTarget: 10000 }), { goalId: 'holiday', itemName: '' })

      expect(rowValue('GOAL')).toBe('Holiday — £10,000')
    })
  })

  describe('the reverse-salary panel', () => {
    it('is absent when the plan needs no particular income', () => {
      renderCard(savingsResult({ requiredTakeHomeMonthly: null }), { goalId: 'holiday' })

      expect(screen.queryByText('Flip it — what salary would this take?')).toBeNull()
    })

    it('renders when the plan reports a required take-home', () => {
      renderCard(savingsResult({ requiredTakeHomeMonthly: 2600 }), { goalId: 'holiday', takeHome: '2000' })

      expect(screen.getByText('Flip it — what salary would this take?')).toBeTruthy()
    })
  })

  describe('the chart', () => {
    it('is omitted entirely when there is nothing left to reach', () => {
      // An already-met goal: target 0, so no chart — but the breakdown still
      // reports the figures behind that verdict.
      renderCard(savingsResult({ target: 0, targetRowLabel: 'LEFT TO SAVE' }), { goalId: 'emergency' })

      expect(screen.queryByText('Where your money goes')).toBeNull()
      expect(rowValue('LEFT TO SAVE')).toBe('£0')
    })

    it('renders once there is a target to reach', () => {
      renderCard(savingsResult({ target: 8000 }), { goalId: 'holiday' })

      // With a null projection, ResultChart shows the budget view alone.
      expect(screen.getByText('Where your money goes')).toBeTruthy()
    })
  })

  it('passes the verdict through to the banner', () => {
    renderCard(savingsResult({ isAffordable: false, verdictText: 'Not yet', verdictSub: 'This one is a stretch.' }), {
      goalId: 'holiday',
    })

    const banner = screen.getByTestId('verdict-banner')
    expect(banner.textContent).toContain('Not yet')
    expect(banner.textContent).toContain('This one is a stretch.')
  })
})
