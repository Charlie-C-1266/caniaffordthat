import { DEFAULT_STATE } from '../state/defaults'
import type { CalculatorState, Mode, SaveFlavor } from '../state/types'

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

const NUMBER_FIELDS = ['rate', 'growth', 'goalMonths', 'term'] as const satisfies readonly (keyof CalculatorState)[]

function isMode(value: string | null): value is Mode {
  return value === 'save' || value === 'monthly'
}

function isSaveFlavor(value: string | null): value is SaveFlavor {
  return value === 'duration' || value === 'goal'
}

/**
 * Reconstructs state from a shared "Copy result link" URL. Mirrors the
 * prototype's on-load hydration: only kicks in when `itemPrice` is present
 * in the query string (the same gate `copyLink` uses), and validates enum
 * fields rather than trusting them blindly, since a query string is
 * user-controllable input.
 */
export function hydrateStateFromUrl(search: string): CalculatorState {
  const params = new URLSearchParams(search)
  if (!params.has('itemPrice')) return DEFAULT_STATE

  const state: CalculatorState = { ...DEFAULT_STATE }

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
