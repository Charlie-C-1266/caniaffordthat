export type Mode = 'save' | 'monthly'
export type SaveFlavor = 'duration' | 'goal'

export interface CalculatorState {
  /** Which question the user is answering: saving up, or paying monthly. */
  mode: Mode
  /** Only relevant when `mode === 'save'`: fixed-duration vs. goal-date planning. */
  saveFlavor: SaveFlavor
  itemName: string
  // The fields below are bound to <input> elements, whose `.value` is always
  // a string (including '' before anything's typed) — they're only parsed
  // into numbers via `num()` (see lib/calculations.ts) at calculation time,
  // never converted eagerly, so a half-typed value like "12." isn't clobbered.
  itemPrice: string
  /** Take-home pay per month — the one required budget field. */
  takeHome: string
  housing: string
  utilities: string
  groceries: string
  transport: string
  debts: string
  /** Amount already saved toward this item — reduces the target, not a monthly outgoing. */
  savings: string
  /** % of spare cash to save per month (1-100). Duration flavor only. */
  rate: number
  /** APR %, used as either savings interest or finance interest depending on `mode`. */
  growth: number
  /** Months until the goal date. Goal flavor only. */
  goalMonths: number
  /** Finance term in months. Finance mode only. */
  term: number
  /** Index (0-4) of the step currently centered in the viewport. */
  activeIndex: number
  /** Steps that have animated into view at least once; they stay revealed once scrolled past. */
  revealed: Record<number, true>
}
