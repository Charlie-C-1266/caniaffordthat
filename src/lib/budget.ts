import { num } from './calculations'
import type { CalculatorState } from '../state/types'

// The five monthly-outgoing fields are read in three places — the Budget
// step's input grid, the emergency fund's "essentials" grid in Details, and
// the spare-cash sums at the end of this file. This module is the single
// source of truth for the keys and their labels, so the three can't drift
// apart (the labels had already diverged once before this was extracted).

/** State keys of the five monthly-outgoing fields, in display order. */
export const OUTGOING_FIELD_KEYS = [
  'housing',
  'utilities',
  'groceries',
  'transport',
  'debts',
] as const satisfies readonly (keyof CalculatorState)[]

/** One of the five monthly-outgoing state fields. */
export type OutgoingFieldKey = (typeof OUTGOING_FIELD_KEYS)[number]

/** Input labels for the outgoing fields, shared by the Budget step's grid and the emergency fund's essentials grid. */
export const OUTGOING_FIELD_LABELS: Record<OutgoingFieldKey, string> = {
  housing: 'Housing (rent/mortgage)',
  utilities: 'Utilities & bills',
  groceries: 'Groceries & everyday spend',
  transport: 'Transport',
  debts: 'Debt repayments',
}

// Regular saving sits beside the five above but is deliberately kept out of
// the list: it is committed money for spare-cash purposes, yet it is not
// essential spending, so it must not reach the emergency fund's cushion
// basis. Its label lives here anyway, so everything that names a budget line
// is still defined in one file.

/** Input label for the regular-saving field (state key `savingsMonthly`). */
export const REGULAR_SAVING_LABEL = 'Regular saving & investing'

/** Short donut/legend label for regular saving — the input label is too long for a legend row. */
export const REGULAR_SAVING_SHORT_LABEL = 'Saving'

/**
 * Sum of the five essential monthly outgoing fields (housing…debts), and the
 * emergency fund's "essential spend". Regular saving is deliberately not part
 * of this — see `committedOutgoingsOf`.
 */
export function monthlyOutgoingsOf(state: CalculatorState): number {
  return OUTGOING_FIELD_KEYS.reduce((sum, key) => sum + num(state[key]), 0)
}

/** What the user already puts into savings, investments or a pension each month. */
export function regularSavingOf(state: CalculatorState): number {
  return num(state.savingsMonthly)
}

/**
 * Everything already spoken for each month: the five essentials plus any
 * regular saving. This is what spare cash is measured against, and it is
 * deliberately a different figure from `monthlyOutgoingsOf`. A cushion has to
 * replace the spending you could not stop, and saving is the first thing
 * anyone pauses when their income goes away — folding it into the essentials
 * sum would inflate the emergency fund's target by `coverMonths` times the
 * amount saved, for money the user would not actually need to replace.
 */
export function committedOutgoingsOf(state: CalculatorState): number {
  return monthlyOutgoingsOf(state) + regularSavingOf(state)
}

/** Monthly spare cash: take-home minus everything already committed, floored at 0. */
export function spareCashOf(state: CalculatorState): number {
  return Math.max(0, num(state.takeHome) - committedOutgoingsOf(state))
}
