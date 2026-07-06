import { DEFAULT_STATE } from '../state/defaults'
import { GOALS } from './goals'
import type { CalculatorState, GoalId, Mode, SaveFlavor } from '../state/types'

// The single source of truth for the shared-link round-trip. `buildShareParams`
// (serialise, used by "Copy result link") and `hydrateStateFromUrl` (deserialise,
// used on load) both read these lists, so a new shared field is added in one
// place and can't drift between the two sides.

const STRING_FIELDS = [
  'itemName',
  'itemPrice',
  'takeHome',
  'housing',
  'utilities',
  'groceries',
  'transport',
  'debts',
  'savings',
] as const satisfies readonly (keyof CalculatorState)[]

const NUMBER_FIELDS = [
  'rate',
  'growth',
  'goalMonths',
  'term',
  'coverMonths',
] as const satisfies readonly (keyof CalculatorState)[]

// `carouselIndex` is intentionally *not* shared: on load it's derived from
// `goalId` so a link always focuses the shared goal, regardless of where the
// sharer happened to leave the carousel.

function isMode(value: string | null): value is Mode {
  return value === 'save' || value === 'monthly'
}

function isSaveFlavor(value: string | null): value is SaveFlavor {
  return value === 'duration' || value === 'goal'
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
  for (const field of STRING_FIELDS) params.set(field, state[field])
  for (const field of NUMBER_FIELDS) params.set(field, String(state[field]))
  return params
}

/**
 * Reconstructs state from a shared "Copy result link" URL. Hydration kicks in
 * when either `goalId` or `itemPrice` is present — `goalId` covers the
 * price-less emergency fund (see design/adr/0004), `itemPrice` keeps older
 * price-only links working. Enum and goal fields are validated rather than
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

  for (const field of STRING_FIELDS) {
    const value = params.get(field)
    if (value !== null) state[field] = value
  }

  for (const field of NUMBER_FIELDS) {
    const value = params.get(field)
    if (value !== null && Number.isFinite(Number(value))) state[field] = Number(value)
  }

  return state
}
