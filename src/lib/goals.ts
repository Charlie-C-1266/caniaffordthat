import type { CalculatorState, GoalId, Mode, SaveFlavor } from '../state/types'
// Type-only, so nothing from the UI layer reaches this module at runtime. The
// registry stays the one list of icon names, for the goal cards and the UI
// chrome alike; a copy of the goals' names kept here would need tying back to
// it anyway, to stay a compile error rather than a blank icon.
import type { IconName } from '../components/iconRegistry'
import type { OutgoingFieldKey } from './budget'

// The single source of truth for "tailored per goal". Every goal in the picker
// carousel is one entry here; the Details step, hero teaser chips, and the copy
// throughout all read from this — no goal-specific logic is hard-coded in the
// components. Ported from the design prototype's goal config array, field
// names included, so the product vocabulary and the code stay in step.

/**
 * The kinds of goal. Each kind has its own flow, maths or wording, and every
 * goal is exactly one kind. A new kind won't compile until each place that
 * depends on the kind handles it: KIND_PRESENTATION below, the flows in
 * lib/flow.ts and ResultStep's choice of result.
 */
export type GoalKind = 'standard' | 'emergency' | 'vehicle'

/** What every goal carries, whatever its kind. */
interface GoalBase {
  id: GoalId
  /** Card title, e.g. "Vehicle". */
  name: string
  /** Small uppercase category tag, e.g. "Car finance". */
  tag: string
  /** Lucide icon name — must exist in the icon registry (components/iconRegistry.ts), which `IconName` enforces at compile time. */
  icon: IconName
  /** One-line description shown on the carousel card. */
  blurb: string
  /** Mortgage: shown in the carousel but disabled and not selectable. */
  soon?: boolean
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
  /** Seeds applied to state on selection (see `seedFromGoal`). Absent seeds keep the current default. */
  seeds: Partial<Pick<CalculatorState, 'mode' | 'saveFlavor' | 'goalMonths' | 'term' | 'growth' | 'coverMonths'>>
}

/** A priced goal, saved up for or financed through the standard steps. */
export interface StandardGoal extends GoalBase {
  kind: 'standard'
}

/** The emergency fund: no price input; target = coverMonths x essential spend; save-only. */
export interface EmergencyGoal extends GoalBase {
  kind: 'emergency'
}

/** The car: the bespoke vehicle flow (purchase method + running costs steps, vehicle result) — see lib/flow.ts and lib/vehicle.ts. */
export interface VehicleGoal extends GoalBase {
  kind: 'vehicle'
  /** Label for the Details step's deposit field. It writes to `savings`, the same value as Budget's "Already saved" field — which Budget hides for the car, so the one figure is entered once rather than appearing, and silently changing, in two steps. */
  depositLabel: string
}

/** One goal in the picker carousel and the tailored copy/behaviour it drives. */
export type Goal = StandardGoal | EmergencyGoal | VehicleGoal

// Carousel order. The most common goals lead; the
// emergency fund sits early so it's encouraged; "Big purchase" is the catch-all
// (it absorbs weddings, home projects, and anything else). Mortgage still ships
// disabled as "Soon" — its calculator isn't ready yet. Vehicle now has its own
// flow, so the carousel opens focused on it.
export const GOALS: readonly Goal[] = [
  {
    id: 'car',
    name: 'Vehicle',
    tag: 'Car finance',
    icon: 'car',
    blurb: 'A new or used car — pay cash, or finance it with PCP, HP or a loan, plus its real running costs.',
    kind: 'vehicle',
    // The vehicle flow asks "how are you paying?" in its own purchase step
    // (cash/PCP/HP/loan), so the generic save/finance toggle would double up.
    allowModeToggle: false,
    defaultMode: 'monthly',
    saveFlavor: 'duration',
    showName: true,
    namePlaceholder: 'e.g. Volkswagen Golf',
    priceHeadline: 'How much is the car?',
    depositLabel: 'Deposit / part-exchange',
    // 48 months is the typical PCP/HP term; 9.9% APR is a representative
    // dealer-finance rate (both fully adjustable in the purchase step).
    seeds: { mode: 'monthly', saveFlavor: 'duration', term: 48, growth: 9.9 },
  },
  {
    id: 'holiday',
    name: 'Holiday',
    tag: 'Getaway',
    icon: 'plane',
    blurb: 'A trip away — work out what to put by each month to be ready in time.',
    kind: 'standard',
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
    kind: 'emergency',
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
    kind: 'standard',
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
    kind: 'standard',
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
    kind: 'standard',
    soon: true,
    allowModeToggle: false,
    defaultMode: 'monthly',
    saveFlavor: 'duration',
    showName: false,
    seeds: {},
  },
]

/** What the steps say, and how the Details tile is sized, for one kind of goal. */
export interface KindPresentation {
  details: {
    /** The tile's heading; `null` shows the goal's own name. */
    heading: string | null
    /** An info hint beside the heading, or `null` for none. */
    hint: string | null
    tilePadding: string
    wrapperHeightVh: number
  }
  budget: {
    heading: string
    /** Whether the five essential outgoings are asked for on this step. */
    asksOutgoings: boolean
    /** Label for the "already saved" field, or `null` when another step asks for the same figure. */
    savingsLabel: string | null
    regularSavingHint: string
    /** Outgoing fields relabelled for this kind, each with a hint that says what to leave out. */
    outgoingOverrides: Partial<Record<OutgoingFieldKey, { label: string; hint: string }>>
  }
  /** What the Result step says before the plan has enough to show a result. */
  resultFallback: string
}

// Anything already deducted from the payslip must not be entered again: in
// take-home mode the figure typed in is net of a workplace pension already,
// and in salary mode the tax engine models no pension at all (see
// lib/salary.ts), so counting one here would be wrong in both directions.
const REGULAR_SAVING_HINT =
  'Money you put away each month — savings pots, ISAs, investments. Leave out anything already taken off your payslip, like a workplace pension.'

const STANDARD_PRESENTATION: KindPresentation = {
  details: { heading: null, hint: null, tilePadding: '46px 44px', wrapperHeightVh: 160 },
  budget: {
    // U+2028 is a mandatory line break (Unicode line-breaking class BK), so the
    // heading always breaks after "in,", as other step headings do with <br />.
    heading: "What's coming in,\u2028and going out?",
    asksOutgoings: true,
    savingsLabel: 'Already saved towards this',
    regularSavingHint: REGULAR_SAVING_HINT,
    outgoingOverrides: {},
  },
  resultFallback: 'Scroll back up and fill in a price and take-home pay to see your result.',
}

/**
 * The wording and layout that differ by kind of goal rather than goal by goal.
 * A Record, so a new kind can't compile until it says all of this.
 */
export const KIND_PRESENTATION: Record<GoalKind, KindPresentation> = {
  standard: STANDARD_PRESENTATION,
  emergency: {
    details: {
      heading: 'How big a cushion?',
      hint: 'A common rule of thumb is 3–6 months of essential spending set aside.',
      tilePadding: '34px 44px',
      wrapperHeightVh: 150,
    },
    budget: {
      heading: "What's coming in?",
      // The fund's essentials are collected in Details, as the basis of its cushion.
      asksOutgoings: false,
      savingsLabel: 'Already set aside',
      // The emergency fund has a second trap of its own: saving already going
      // into the cushion being built is the very thing this goal is about.
      regularSavingHint:
        "Money you put away each month that isn't going into this cushion — other savings pots or investments. Leave out anything already taken off your payslip, like a workplace pension.",
      outgoingOverrides: {},
    },
    resultFallback: 'Scroll back up and add your take-home pay and monthly essentials to see your result.',
  },
  vehicle: {
    details: STANDARD_PRESENTATION.details,
    budget: {
      ...STANDARD_PRESENTATION.budget,
      // The car's savings is its Details deposit; don't ask for it twice.
      savingsLabel: null,
      // The vehicle flow already itemises this car's fuel, insurance, tax and
      // finance payment on its own steps. Without a note, "Transport" here
      // reads ambiguously (does it include the car being evaluated, or not?)
      // and risks double-counting it. So the field is relabelled for the car
      // rather than hidden: other transport spend (public transport, a second
      // car) still belongs in spare cash. The hint is passed to the field's
      // `hint` rather than built into the label, where it would become part of
      // the input's accessible name.
      outgoingOverrides: {
        transport: {
          label: 'Transport (other than this car)',
          hint: "This car's fuel, insurance, tax and finance payment are already counted on the previous steps — put anything else here, like public transport or another vehicle.",
        },
      },
    },
    resultFallback: "Scroll back up and fill in the car's price and your take-home pay to see your result.",
  },
}

/** The presentation for a goal's kind. Before a goal is chosen, the standard one. */
export function presentationFor(goal: Goal | null): KindPresentation {
  return KIND_PRESENTATION[goal?.kind ?? 'standard']
}

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
