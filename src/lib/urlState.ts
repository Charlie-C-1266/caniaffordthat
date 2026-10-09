import { DEFAULT_STATE } from '../state/defaults'
import { GOALS } from './goals'
import { isMoneyValue, sanitiseItemName } from './fields'
import { TERM_RANGES } from './vehicle'
import type { BalloonMode, CalculatorState, GoalId, Mode, RateMode, SaveFlavor, TakeHomeMode, VehicleFinanceMethod } from '../state/types'

// The single source of truth for the shared-link round-trip. `buildShareParams`
// (serialise, used by "Copy result link") and `hydrateStateFromUrl` (deserialise,
// used on load) both read these lists, so a new shared field is added in one
// place and can't drift between the two sides.

// Exported so the tests can hold every shared string field to the sanitising
// rule below, and a field added here is covered without touching them.
export const STRING_FIELDS = [
  'itemName',
  'itemPrice',
  'takeHome',
  'grossSalary',
  'housing',
  'utilities',
  'groceries',
  'transport',
  'debts',
  'savings',
  'monthlyAmount',
  // Vehicle flow (harmless no-ops for other goals; all parsed lazily via num()).
  'balloonAmount',
  'vehicleMileage',
  'annualMiles',
  'mpg',
  'fuelPencePerLitre',
  'maintenanceMonthly',
  'insuranceAnnual',
  'taxAnnual',
] as const satisfies readonly (keyof CalculatorState)[]

/**
 * The numeric planning fields that round-trip, each with the range it's
 * clamped to on hydration. A query string is user-editable input, so an
 * out-of-range value (`coverMonths=999`, `rate=-5`) is pulled back to the
 * matching UI control's own bounds rather than trusted. `goalMonths` has no
 * upper bound because the goal-date field itself accepts any future date.
 */
const NUMBER_FIELDS: readonly {
  key: 'rate' | 'growth' | 'goalMonths' | 'term' | 'coverMonths' | 'vehicleAge'
  min: number
  max?: number
}[] = [
  { key: 'rate', min: 1, max: 100 }, // "% of spare cash" slider
  { key: 'growth', min: 0, max: 30 }, // interest sliders (finance APR's max; the save slider stops at 20)
  { key: 'goalMonths', min: 1 }, // goal-date floor is next month
  { key: 'term', min: 1, max: 84 }, // longest term slider (the vehicle bank-loan's; others stop at 60)
  { key: 'coverMonths', min: 1, max: 12 }, // emergency-cover slider
  { key: 'vehicleAge', min: 0, max: 30 }, // car-age slider stops at 20; allow a little headroom
]

// `carouselIndex` is intentionally *not* shared: on load it's derived from
// `goalId` so a link always focuses the shared goal, regardless of where the
// sharer happened to leave the carousel.

function isMode(value: string | null): value is Mode {
  return value === 'save' || value === 'monthly'
}

function isSaveFlavor(value: string | null): value is SaveFlavor {
  return value === 'duration' || value === 'goal'
}

function isRateMode(value: string | null): value is RateMode {
  return value === 'percent' || value === 'amount'
}

function isTakeHomeMode(value: string | null): value is TakeHomeMode {
  return value === 'takehome' || value === 'salary'
}

function isVehicleMethod(value: string | null): value is VehicleFinanceMethod {
  return value === 'cash' || value === 'pcp' || value === 'hp' || value === 'loan'
}

function isBalloonMode(value: string | null): value is BalloonMode {
  return value === 'known' || value === 'estimate'
}

function isGoalId(value: string | null): value is GoalId {
  return value !== null && GOALS.some((g) => g.id === value)
}

/**
 * Serialises the shared subset of state into query params for "Copy result
 * link". `goalId` is only included when a goal has been chosen; everything else
 * (mode, save flavour, the money fields, the numeric planning values) always
 * round-trips.
 */
export function buildShareParams(state: CalculatorState): URLSearchParams {
  const params = new URLSearchParams()
  if (state.goalId !== null) params.set('goalId', state.goalId)
  params.set('mode', state.mode)
  params.set('saveFlavor', state.saveFlavor)
  params.set('rateMode', state.rateMode)
  params.set('takeHomeMode', state.takeHomeMode)
  params.set('vehicleMethod', state.vehicleMethod)
  params.set('balloonMode', state.balloonMode)
  for (const field of STRING_FIELDS) params.set(field, state[field])
  for (const { key } of NUMBER_FIELDS) params.set(key, String(state[key]))
  return params
}

/**
 * Reconstructs state from a shared "Copy result link" URL. Hydration kicks in
 * when either `goalId` or `itemPrice` is present — `goalId` covers the
 * price-less emergency fund (which would otherwise never hydrate, having no
 * price to key on), `itemPrice` keeps older price-only links working. Enum and goal fields are validated rather than
 * trusted, since a query string is user-controllable input.
 */
export function hydrateStateFromUrl(search: string): CalculatorState {
  const params = new URLSearchParams(search)
  if (!params.has('goalId') && !params.has('itemPrice')) return DEFAULT_STATE

  const state: CalculatorState = { ...DEFAULT_STATE }

  const goalId = params.get('goalId')
  const goal = isGoalId(goalId) ? GOALS.find((g) => g.id === goalId) : undefined
  // A "Soon" goal (e.g. an old link to a since-disabled calculator) must not
  // reopen its flow — ignore it so hydration falls back to the goal picker.
  if (goal && !goal.soon) {
    state.goalId = goal.id
    // Focus the carousel on the shared goal so "Pick another goal" starts there.
    state.carouselIndex = GOALS.indexOf(goal)
  }

  const mode = params.get('mode')
  if (isMode(mode)) state.mode = mode

  const saveFlavor = params.get('saveFlavor')
  if (isSaveFlavor(saveFlavor)) state.saveFlavor = saveFlavor

  const rateMode = params.get('rateMode')
  if (isRateMode(rateMode)) state.rateMode = rateMode

  const takeHomeMode = params.get('takeHomeMode')
  if (isTakeHomeMode(takeHomeMode)) state.takeHomeMode = takeHomeMode

  const vehicleMethod = params.get('vehicleMethod')
  if (isVehicleMethod(vehicleMethod)) state.vehicleMethod = vehicleMethod

  const balloonMode = params.get('balloonMode')
  if (isBalloonMode(balloonMode)) state.balloonMode = balloonMode

  // The string fields were previously copied verbatim, which let a link carry
  // values the inputs themselves refuse: a negative price (`MoneyInput` clamps
  // those to "0", so the field showed -500 while `num()` used 0 — exactly the
  // divergence #30 closed), non-numeric junk, `1e999`, or an unbounded
  // `itemName` that stretches the result headline. Each is now held to the
  // same rule as the field that captures it, falling back to the default.
  for (const field of STRING_FIELDS) {
    const value = params.get(field)
    if (value === null) continue
    if (field === 'itemName') state[field] = sanitiseItemName(value)
    else state[field] = isMoneyValue(value) ? value.trim() : DEFAULT_STATE[field]
  }

  for (const { key, min, max } of NUMBER_FIELDS) {
    const value = Number(params.get(key) ?? NaN)
    if (Number.isFinite(value)) state[key] = Math.min(max ?? Infinity, Math.max(min, value))
  }

  // The 84-month ceiling above exists only for the vehicle bank loan; every
  // other flow's term slider stops at 60, so a crafted non-vehicle link can't
  // smuggle in a term the UI couldn't have produced.
  if (!goal?.vehicle) state.term = Math.min(60, state.term)
  // The same reasoning, one level finer, inside the vehicle flow: the term
  // slider only ever offers the active method's own `TERM_RANGES`, so a link
  // must not be able to load a deal the UI could never have produced (an
  // 84-month PCP, a 3-month HP) and have `deriveVehicleResult` quote it.
  // `cash` has no term range, and `chooseMethod` clamps again on the way back
  // to a finance method, so a cash link's term is left as read.
  else if (state.vehicleMethod !== 'cash') {
    const { min, max } = TERM_RANGES[state.vehicleMethod]
    state.term = Math.min(max, Math.max(min, state.term))
  }

  return state
}

/**
 * Where the error boundary's "Start over" reloads to: the bare origin +
 * pathname, deliberately dropping any query string. State hydrated from a
 * shared link's params is one plausible crash source, so recovering into the
 * same URL could just re-crash on arrival.
 */
export function startOverUrl({ origin, pathname }: Pick<Location, 'origin' | 'pathname'> = window.location): string {
  return `${origin}${pathname}`
}
