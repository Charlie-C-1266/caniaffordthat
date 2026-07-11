export type Mode = 'save' | 'monthly'
export type SaveFlavor = 'duration' | 'goal'
/** Duration flavor: whether the monthly saving is entered as a share of spare cash (`rate`) or a fixed amount (`monthlyAmount`). */
export type RateMode = 'percent' | 'amount'
/**
 * Vehicle flow: how the car is being paid for. `cash` buys it outright,
 * `pcp` / `hp` are dealer finance (PCP with a balloon, HP without), and
 * `loan` is an unsecured personal/bank loan.
 */
export type VehicleFinanceMethod = 'cash' | 'pcp' | 'hp' | 'loan'
/** PCP only: whether the balloon (GMFV) is known from a quote, or estimated from the car's age and mileage. */
export type BalloonMode = 'known' | 'estimate'

/**
 * The goals shown in the picker carousel. Kept here (rather than in
 * `lib/goals.ts`) so both `types.ts` and `goals.ts` can reference it without an
 * import cycle — `goals.ts` needs `Mode`/`SaveFlavor` from here.
 */
export type GoalId = 'car' | 'holiday' | 'emergency' | 'luxury' | 'big' | 'mortgage'

export interface CalculatorState {
  /** Which goal the user picked in the carousel, or `null` before they've chosen one. */
  goalId: GoalId | null
  /** The card currently focused in the picker carousel. Starts on the first selectable goal (Mortgage, the only "Soon" goal, sits last). */
  carouselIndex: number
  /** Which question the user is answering: saving up, or paying monthly. Seeded from the goal, then user-switchable. */
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
  /** Emergency fund only: months of essential spending to hold as a cushion (1-12). Drives the derived target; ignored by other goals. */
  coverMonths: number
  /** % of spare cash to save per month (1-100). Duration flavor, `rateMode === 'percent'`. */
  rate: number
  /** How the monthly saving is entered in the duration flavor: a % of spare cash, or a fixed amount. */
  rateMode: RateMode
  /** Fixed £/month to save. Duration flavor, `rateMode === 'amount'`. Bound to an <input>, so a string (see the note above). */
  monthlyAmount: string
  /** APR %, used as either savings interest or finance interest depending on `mode`. */
  growth: number
  /** Months until the goal date. Goal flavor only. */
  goalMonths: number
  /** Finance term in months. Finance mode and the vehicle flow's HP/PCP/loan methods. */
  term: number
  // --- Vehicle flow (car goal only; ignored by every other goal) ---
  /** How the car is being paid for. */
  vehicleMethod: VehicleFinanceMethod
  /** PCP: known balloon from a quote vs estimated from age + mileage. */
  balloonMode: BalloonMode
  /** PCP, `balloonMode === 'known'`: the quoted balloon / GMFV. Input-bound string (see note above). */
  balloonAmount: string
  /** The car's age in years now (0 = brand new). Drives the balloon estimate and the over-£40k tax supplement. */
  vehicleAge: number
  /** The car's current odometer reading in miles. Empty means "average for its age" (see lib/vehicle.ts). */
  vehicleMileage: string
  /** Miles the user expects to drive per year. */
  annualMiles: string
  /** The car's average fuel economy in miles per (imperial) gallon. */
  mpg: string
  /** Fuel price in pence per litre — a static default the user can adjust, like the RAC fuel-cost tool. */
  fuelPencePerLitre: string
  /** Estimated servicing/MOT/tyres/repairs budget per month. */
  maintenanceMonthly: string
  /** Annual insurance premium. */
  insuranceAnnual: string
  /** Annual road tax (VED), before the over-£40k supplement which is applied automatically. */
  taxAnnual: string
  /** Index (0-4) of the step currently centered in the viewport. */
  activeIndex: number
  /** Steps that have animated into view at least once; they stay revealed once scrolled past. */
  revealed: Record<number, true>
}
