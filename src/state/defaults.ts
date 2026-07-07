import { INITIAL_CAROUSEL_INDEX } from '../lib/goals'
import type { CalculatorState } from './types'

// Matches the prototype's initial state (class Component's `state` block),
// except the six monthly-outgoing fields default to '0' rather than '' —
// visibly present and editable rather than blank, so a quick user can accept
// the defaults and move on while a thorough one can see and adjust each one.
export const DEFAULT_STATE: CalculatorState = {
  // No goal chosen yet; the carousel focuses the first selectable goal, and
  // `mode` holds a harmless default (never surfaced before a goal is picked).
  goalId: null,
  carouselIndex: INITIAL_CAROUSEL_INDEX,
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
  // MoneyHelper's "aim for at least 3 months" of essential outgoings — the
  // recommended starting target for an emergency fund (see design/adr/0010).
  coverMonths: 3,
  rate: 25,
  rateMode: 'percent',
  monthlyAmount: '',
  growth: 0,
  goalMonths: 12,
  term: 12,
  // Vehicle flow defaults (see lib/vehicle.ts for where each figure comes
  // from). PCP + "estimate the balloon" is the default so the flow produces a
  // result without needing a finance quote in hand.
  vehicleMethod: 'pcp',
  balloonMode: 'estimate',
  balloonAmount: '',
  vehicleAge: 3,
  vehicleMileage: '',
  annualMiles: '8000',
  mpg: '40',
  fuelPencePerLitre: '140',
  maintenanceMonthly: '60',
  insuranceAnnual: '0',
  taxAnnual: '195',
  activeIndex: 0,
  revealed: { 0: true },
}
