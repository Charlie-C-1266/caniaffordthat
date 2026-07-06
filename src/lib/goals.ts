import type { CalculatorState, GoalId, Mode, SaveFlavor } from '../state/types'

// The single source of truth for "tailored per goal". Every goal in the picker
// carousel is one entry here; the Details step, hero teaser chips, and the copy
// throughout all read from this — no goal-specific logic is hard-coded in the
// components. Ported from the design prototype's goal config array (see
// design/adr/0001 and design/glossary.md).

/** One goal in the picker carousel and the tailored copy/behaviour it drives. */
export interface Goal {
  id: GoalId
  /** Card title, e.g. "Vehicle". */
  name: string
  /** Small uppercase category tag, e.g. "Car finance". */
  tag: string
  /** Lucide icon name (wired to `lucide-react` when the icons land). */
  icon: string
  /** One-line description shown on the carousel card. */
  blurb: string
  /** Mortgage: shown in the carousel but disabled and not selectable. */
  soon?: boolean
  /** Emergency fund: no price input; target = coverMonths x essential spend; save-only. */
  emergency?: boolean
  /** Whether the user can switch save/finance in Details. False for the save-only emergency fund. */
  allowModeToggle: boolean
  /** Mode this goal starts in (before the user switches). */
  defaultMode: Mode
  /** Save sub-mode this goal starts in. */
  saveFlavor: SaveFlavor
  /** Whether the Details step shows the free-text name field. */
  showName: boolean
  /** Placeholder for the name field, when shown. */
  namePlaceholder?: string
  /** Heading above the price input, e.g. "How much is the car?". Absent for the price-less emergency fund. */
  priceHeadline?: string
  /** Car: shows the "Deposit / part-exchange" field, which writes to `savings` (see design/adr/0005). */
  deposit?: boolean
  /** Label for the deposit field, when shown. */
  depositLabel?: string
  /** Seeds applied to state on selection (see `seedFromGoal`). Absent seeds keep the current default. */
  seeds: Partial<
    Pick<CalculatorState, 'mode' | 'saveFlavor' | 'goalMonths' | 'term' | 'growth' | 'coverMonths'>
  >
}

// Carousel order (see design/adr/0006). The most common goals lead; the
// emergency fund sits early so it's encouraged; "Big purchase" is the catch-all
// (it absorbs weddings, home projects, and anything else). Vehicle and Mortgage
// ship disabled as "Soon" — their calculators aren't ready yet — so the
// carousel focuses the first selectable goal, Holiday.
export const GOALS: readonly Goal[] = [
  {
    id: 'car',
    name: 'Vehicle',
    tag: 'Car finance',
    icon: 'car',
    blurb: 'A new or used car — finance it, or save up for the drive-away price. Coming soon.',
    soon: true,
    allowModeToggle: true,
    defaultMode: 'monthly',
    saveFlavor: 'duration',
    showName: true,
    namePlaceholder: 'e.g. Volkswagen Golf',
    priceHeadline: 'How much is the car?',
    deposit: true,
    depositLabel: 'Deposit / part-exchange',
    seeds: { mode: 'monthly', saveFlavor: 'duration', term: 60, growth: 7.9 },
  },
  {
    id: 'holiday',
    name: 'Holiday',
    tag: 'Getaway',
    icon: 'plane',
    blurb: 'A trip away — work out what to put by each month to be ready in time.',
    allowModeToggle: true,
    defaultMode: 'save',
    saveFlavor: 'goal',
    showName: true,
    namePlaceholder: 'e.g. Two weeks in Italy',
    priceHeadline: 'How much is the trip?',
    seeds: { mode: 'save', saveFlavor: 'goal', goalMonths: 8 },
  },
  {
    id: 'emergency',
    name: 'Emergency fund',
    tag: 'Safety net',
    icon: 'umbrella',
    blurb: 'A cushion of essential spending — pick how many months to cover.',
    emergency: true,
    allowModeToggle: false,
    defaultMode: 'save',
    saveFlavor: 'duration',
    showName: false,
    seeds: { mode: 'save', saveFlavor: 'duration', coverMonths: 3 },
  },
  {
    id: 'luxury',
    name: 'Luxury item',
    tag: 'A treat',
    icon: 'gem',
    blurb: 'Something special you fancy — see how long saving for it would take.',
    allowModeToggle: true,
    defaultMode: 'save',
    saveFlavor: 'duration',
    showName: true,
    namePlaceholder: 'e.g. Omega watch',
    priceHeadline: 'How much is it?',
    seeds: { mode: 'save', saveFlavor: 'duration' },
  },
  {
    id: 'big',
    name: 'Big purchase',
    tag: 'Something major',
    icon: 'shopping-bag',
    blurb: 'The catch-all — a wedding, a home project, or any other big one-off. Save up or spread it monthly.',
    allowModeToggle: true,
    defaultMode: 'save',
    saveFlavor: 'duration',
    showName: true,
    namePlaceholder: 'e.g. Wedding, new kitchen, sofa',
    priceHeadline: "What's the total cost?",
    seeds: { mode: 'save', saveFlavor: 'duration' },
  },
  {
    id: 'mortgage',
    name: 'Mortgage',
    tag: 'Home',
    icon: 'house',
    blurb: 'A full UK affordability check — deposit, LTV and income multiples. Coming soon.',
    soon: true,
    allowModeToggle: false,
    defaultMode: 'monthly',
    saveFlavor: 'duration',
    showName: false,
    seeds: {},
  },
]

/** Carousel index the picker focuses first — the first selectable (non-"Soon") goal. */
export const INITIAL_CAROUSEL_INDEX = GOALS.findIndex((g) => !g.soon)

/** Looks up a goal by id, or `null` for an unknown/absent id. */
export function goalById(id: GoalId | null): Goal | null {
  if (id === null) return null
  return GOALS.find((g) => g.id === id) ?? null
}

/**
 * Wraps a (possibly out-of-range) carousel index into `0..length-1`, so the
 * picker loops: going left off the first goal lands on the last, and vice
 * versa.
 */
export function wrapIndex(index: number, length: number = GOALS.length): number {
  return ((index % length) + length) % length
}

/**
 * The signed distance from `center` to card `i` taking the *shorter* way around
 * the loop, so the cover-flow animates the short direction on wrap rather than
 * sliding the whole strip across. Range is roughly `[-length/2, length/2]`;
 * the card diametrically opposite the focus sits at the far positive end.
 */
export function circularOffset(i: number, center: number, length: number = GOALS.length): number {
  const forward = wrapIndex(i - center, length)
  return forward > length / 2 ? forward - length : forward
}

/**
 * The state patch applied when a goal is selected: records the goal and seeds
 * mode, save flavour, and the numeric planning defaults from its config. Fields
 * the goal doesn't seed are omitted so the current value (or default) is kept.
 * Pure so it can be unit-tested and reused by both the carousel and the
 * shared-link hydration.
 */
export function seedFromGoal(goal: Goal): Partial<CalculatorState> {
  return { goalId: goal.id, ...goal.seeds }
}
