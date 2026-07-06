import type { CalculatorState } from '../state/types'

// The five monthly-outgoing fields are read in three places — the Budget
// step's input grid, the emergency fund's "essentials" grid in Details, and
// the spare-cash maths in derive.ts. This module is the single source of
// truth for the keys and their labels, so the three can't drift apart (the
// labels had already diverged once before this was extracted).

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
