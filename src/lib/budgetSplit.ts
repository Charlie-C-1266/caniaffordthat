import { num } from './calculations'
import { OUTGOING_FIELD_KEYS, type OutgoingFieldKey } from './budget'
import type { CalculatorState } from '../state/types'

// Where each month's take-home pay goes once the new commitment is added: the
// data behind the result screen's budget donut. It splits take-home into the
// essentials already being paid, the new cost being weighed up, and whatever
// is left — or, when the new cost overshoots, the part of it that spills past
// spare cash. The arcs it yields always sum to `ringTotal`, so the donut is
// honest whether the new cost fits or not.

/** One line of the budget: a category and its £/month. */
export interface BudgetLine {
  key: OutgoingFieldKey
  amount: number
}

/** Short donut/legend labels for the five outgoing categories — the input labels (e.g. "Housing (rent/mortgage)") are too long for a legend row. */
export const OUTGOING_SHORT_LABELS: Record<OutgoingFieldKey, string> = {
  housing: 'Housing',
  utilities: 'Utilities',
  groceries: 'Groceries',
  transport: 'Transport',
  debts: 'Debt',
}

/** How a month's take-home pay divides up once the new commitment is added on top of existing essentials. */
export interface BudgetBreakdown {
  takeHome: number
  /** The non-zero essential outgoings, in their canonical display order. */
  essentials: BudgetLine[]
  essentialsTotal: number
  /** Take-home less essentials, floored at 0 — the room the new cost has to fit into. */
  spareCash: number
  /** The commitment being weighed up: a monthly saving, a finance payment, or a car's total monthly cost. */
  newCost: number
  /** Portion of the new cost that fits within spare cash (the solid "new cost" arc). */
  newCostWithin: number
  /** Portion of the new cost beyond spare cash (the "over budget" arc); 0 when it fits. */
  newCostOver: number
  /** Spare cash still free after the new cost; 0 when over budget. */
  leftover: number
  /** True when the new cost alone exceeds spare cash. */
  overBudget: boolean
  /** The total the donut's arcs sum to: take-home when it fits, or the (larger) committed total when it doesn't. */
  ringTotal: number
  /** The new cost as a fraction of take-home pay (can exceed 1 when over budget). */
  shareOfTakeHome: number
}

/**
 * Splits the current budget around a `newCost` (a monthly saving, finance
 * payment, or total car cost). Essentials come straight from the five outgoing
 * fields; the new cost is measured against the spare cash left after them, and
 * split into the part that fits and the part that spills over so the donut can
 * draw both honestly.
 */
export function budgetBreakdown(state: CalculatorState, newCost: number): BudgetBreakdown {
  const takeHome = num(state.takeHome)
  const essentials: BudgetLine[] = OUTGOING_FIELD_KEYS.map((key) => ({ key, amount: num(state[key]) })).filter(
    (line) => line.amount > 0,
  )
  const essentialsTotal = essentials.reduce((sum, line) => sum + line.amount, 0)
  const spareCash = Math.max(0, takeHome - essentialsTotal)
  const cost = Math.max(0, newCost)

  const newCostWithin = Math.min(cost, spareCash)
  const newCostOver = Math.max(0, cost - spareCash)
  const leftover = Math.max(0, spareCash - cost)

  return {
    takeHome,
    essentials,
    essentialsTotal,
    spareCash,
    newCost: cost,
    newCostWithin,
    newCostOver,
    leftover,
    overBudget: newCostOver > 0,
    ringTotal: essentialsTotal + cost + leftover,
    shareOfTakeHome: takeHome > 0 ? cost / takeHome : 0,
  }
}
