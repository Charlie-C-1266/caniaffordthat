import { addMonths } from './calculations'

// The month-by-month projection behind the result screen's chart, table and
// legacy bars. Extracted here (rather than left inline in derive.ts /
// vehicle.ts) so the three result views — the balance chart, the projection
// table, and the old bar heights — all read the *same* series, and so the
// series carries the actual £ balance at each month, not just a bar height.

/** Longest span the result chart draws month-by-month for; longer plans are truncated and flagged via `hasOverflow`. Exported so the "chart capped at N months" caption can't drift from the actual cap. */
export const CHART_MONTHS_CAP = 24

/** One month's bar in the legacy bar chart: its height as a % of the target. Kept so existing consumers (and their tests) are unaffected while the richer `ProjectionPoint` carries the £ balance. */
export interface ChartBar {
  heightPct: number
  /** Actual £ progress at the end of this month — amount saved, or amount repaid. */
  balance: number
}

/** One month of the projection: the £ progress toward the goal and its height as a % of the target. Month 0 is "now" (nothing saved / repaid yet). */
export interface ProjectionPoint {
  month: number
  /** £ progress so far: amount saved (saving plans) or amount repaid (finance plans). */
  value: number
  heightPct: number
  /** "Month Year" label for this point, e.g. "September 2027". */
  dateLabel: string
}

/** The full month-by-month projection the result screen renders three ways. */
export interface Projection {
  /** Whether `value` counts up saved money toward a target, or down-owed money repaid. Drives the chart/table wording ("saved" vs "repaid"). */
  kind: 'save' | 'finance'
  /** Points from month 0 (now) to the charted horizon, inclusive. */
  points: ProjectionPoint[]
  /** Months 1..cap only, height-per-month — the legacy `chartBars` shape. */
  bars: ChartBar[]
  /** The £ value the chart tops out at (100%): the amount to save, or the amount financed. A PCP tops out below it, since the balloon is never repaid. */
  target: number
  /** The plan's true length in months (may exceed the charted horizon). */
  months: number
  /** True when the true term runs past `CHART_MONTHS_CAP`, so the chart is truncated. */
  hasOverflow: boolean
  /** Label for the final charted month — the goal date, or "<cap date>+" when truncated. */
  endLabel: string
}

/** Label for the last charted month: the real end date, or the capped date with a "+" when the plan runs longer than the chart shows. */
function horizonLabel(months: number): string {
  return months <= CHART_MONTHS_CAP ? addMonths(months) : `${addMonths(CHART_MONTHS_CAP)}+`
}

/** Height for a £ value against the target, matching the legacy bars: floored at 3% so an early month is still visible, capped at 100%. */
function heightFor(value: number, target: number): number {
  if (target <= 0) return 3
  return Math.max(3, Math.round(Math.min(1, value / target) * 100))
}

/**
 * A savings plan's projection: a balance compounding up from £0 toward
 * `target` at `growthPct` APR, `contribution` added each month. `value` is the
 * balance saved so far (capped at the target so the final month reads as
 * "goal reached", not a fractional overshoot).
 */
export function savingProjection(target: number, contribution: number, growthPct: number, months: number): Projection {
  const cap = Math.min(months, CHART_MONTHS_CAP) || 1
  const i = growthPct / 100 / 12
  const points: ProjectionPoint[] = [{ month: 0, value: 0, heightPct: 0, dateLabel: addMonths(0) }]
  const bars: ChartBar[] = []
  let bal = 0
  for (let k = 1; k <= cap; k++) {
    bal = bal * (1 + i) + contribution
    const value = Math.min(bal, target)
    const heightPct = heightFor(value, target)
    points.push({ month: k, value, heightPct, dateLabel: addMonths(k) })
    bars.push({ heightPct, balance: value })
  }
  return { kind: 'save', points, bars, target, months, hasOverflow: months > CHART_MONTHS_CAP, endLabel: horizonLabel(months) }
}

/**
 * A finance plan's projection: the amount repaid, climbing from £0 toward the
 * `principal` as the outstanding balance amortizes down at `growthPct` APR,
 * `payment` paid each month. A PCP payment amortizes only down to its balloon,
 * so the repaid amount honestly tops out below the principal.
 */
export function financeProjection(principal: number, payment: number, growthPct: number, months: number): Projection {
  const cap = Math.min(months, CHART_MONTHS_CAP) || 1
  const i = growthPct / 100 / 12
  const points: ProjectionPoint[] = [{ month: 0, value: 0, heightPct: 0, dateLabel: addMonths(0) }]
  const bars: ChartBar[] = []
  let bal = principal
  for (let k = 1; k <= cap; k++) {
    bal = bal * (1 + i) - payment
    const repaid = principal - Math.max(0, bal)
    const heightPct = heightFor(repaid, principal)
    points.push({ month: k, value: repaid, heightPct, dateLabel: addMonths(k) })
    bars.push({ heightPct, balance: repaid })
  }
  return {
    kind: 'finance',
    points,
    bars,
    target: principal,
    months,
    hasOverflow: months > CHART_MONTHS_CAP,
    endLabel: horizonLabel(months),
  }
}
