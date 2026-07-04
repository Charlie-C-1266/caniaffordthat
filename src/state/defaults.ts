import type { CalculatorState } from './types'

// Matches the prototype's initial state (class Component's `state` block),
// except the six monthly-outgoing fields default to '0' rather than '' —
// visibly present and editable rather than blank, so a quick user can accept
// the defaults and move on while a thorough one can see and adjust each one.
export const DEFAULT_STATE: CalculatorState = {
  mode: 'save',
  saveFlavor: 'duration',
  itemName: '',
  itemPrice: '',
  takeHome: '',
  housing: '0',
  utilities: '0',
  groceries: '0',
  transport: '0',
  debts: '0',
  savings: '0',
  rate: 25,
  growth: 0,
  goalMonths: 12,
  term: 12,
  activeIndex: 0,
  revealed: { 0: true },
}
