import type { CalculatorState } from './types'

// Matches the prototype's initial state (class Component's `state` block).
export const DEFAULT_STATE: CalculatorState = {
  mode: 'save',
  saveFlavor: 'duration',
  itemName: '',
  itemPrice: '',
  takeHome: '',
  housing: '',
  utilities: '',
  groceries: '',
  transport: '',
  debts: '',
  savings: '',
  rate: 25,
  growth: 0,
  goalMonths: 12,
  term: 12,
  activeIndex: 0,
  revealed: { 0: true },
}
