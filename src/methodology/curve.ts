import { UK_AVERAGE_ANNUAL_MILES, mileageFactor, retentionAt } from '../lib/vehicle'

// Data behind the methodology page's depreciation chart. Computed from the
// same retention/mileage functions the balloon estimator uses, so the graph
// can't drift from the maths it documents.

/** One plotted point: a car's age and the share of its as-new price it retains. */
export interface CurvePoint {
  ageYears: number
  retentionPct: number
}

/**
 * The retained-value curve for a car driven from new at `annualMiles` a year:
 * the age-based retention curve times the mileage adjustment for how far its
 * odometer has drifted from average-for-age by then.
 */
export function retentionCurve(annualMiles: number, maxYears = 10, stepYears = 0.5): CurvePoint[] {
  const steps = Math.round(maxYears / stepYears)
  const points: CurvePoint[] = []
  for (let k = 0; k <= steps; k++) {
    const ageYears = k * stepYears
    const excessMiles = ageYears * (annualMiles - UK_AVERAGE_ANNUAL_MILES)
    points.push({ ageYears, retentionPct: retentionAt(ageYears) * mileageFactor(excessMiles) * 100 })
  }
  return points
}
