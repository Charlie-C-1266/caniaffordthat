// The calculator's slider ranges, defined once. The sliders spread these into
// SliderField, and a shared link's values are clamped to the same ranges in
// urlState.ts. So a link can't load a value the slider it drives couldn't have
// produced, and widening a slider widens what a link may carry too. Before
// these were shared, the two sides had drifted: a link could set a car age of
// 25 or savings interest of 25%, past where either slider stops. The vehicle
// finance terms follow the same idea per purchase method, in TERM_RANGES in
// vehicle.ts.

/** A slider's bounds and step, in the shape SliderField takes. */
export interface SliderRange {
  min: number
  max: number
  step: number
}

/** "Share of spare cash you'll save", as a percentage. */
export const SAVE_RATE_RANGE: SliderRange = { min: 1, max: 100, step: 1 }

/** "Expected savings interest", the `growth` field when saving. */
export const SAVINGS_INTEREST_RANGE: SliderRange = { min: 0, max: 20, step: 0.5 }

/** "Interest rate (APR)", the `growth` field when financing: the standard finance flow and every vehicle finance method. */
export const APR_RANGE: SliderRange = { min: 0, max: 30, step: 0.5 }

/** The standard finance flow's term, in months. The vehicle flow's terms are per method (TERM_RANGES). */
export const FINANCE_TERM_RANGE: SliderRange = { min: 1, max: 60, step: 1 }

/** The emergency fund's "Months of cover". */
export const COVER_MONTHS_RANGE: SliderRange = { min: 1, max: 12, step: 1 }

/** "How old is the car?", in whole years; 0 is brand new. */
export const VEHICLE_AGE_RANGE: SliderRange = { min: 0, max: 20, step: 1 }
