import { num, fmt, monthsToSave, contributionForGoal, paymentForFinance, addMonths } from './calculations'
import type { CalculatorState } from '../state/types'

const AFFORDABILITY_MONTHS_CAP = 60
const CHART_MONTHS_CAP = 24

export interface ChartBar {
  heightPct: number
  color: string
}

export interface DerivedResult {
  spareCash: number
  target: number
  months: number
  contribution: number
  totalCost: number | undefined
  interestPaid: number | undefined
  isFeasible: boolean
  fits: boolean
  isAffordable: boolean
  verdictText: string
  verdictSub: string
  verdictIcon: string
  verdictIconBg: string
  resultEyebrow: string
  headline: string
  subheadline: string
  contributionRowLabel: string
  targetRowLabel: string
  chartBars: ChartBar[]
  hasOverflowMonths: boolean
  chartEndLabel: string
}

/**
 * Computes the full affordability result for the current state, porting the
 * design prototype's `renderVals()` calculation block verbatim (down to the
 * exact verdict thresholds and copy). Returns `null` when the two required
 * fields — item price and take-home pay — aren't filled in yet; callers
 * should show the "fill these in first" fallback in that case.
 */
export function deriveResult(state: CalculatorState): DerivedResult | null {
  const isFinance = state.mode === 'monthly'
  const isDuration = state.mode === 'save' && state.saveFlavor === 'duration'
  const isGoal = state.mode === 'save' && state.saveFlavor === 'goal'

  const itemPrice = num(state.itemPrice)
  const takeHome = num(state.takeHome)
  if (!(itemPrice > 0 && takeHome > 0)) return null

  const housing = num(state.housing)
  const utilities = num(state.utilities)
  const groceries = num(state.groceries)
  const transport = num(state.transport)
  const debts = num(state.debts)
  const savings = num(state.savings)

  const monthlyCosts = housing + utilities + groceries + transport + debts
  const spareCash = Math.max(0, takeHome - monthlyCosts)
  const target = Math.max(0, itemPrice - savings)

  let months = 0
  let contribution = 0
  let isFeasible = false
  let fits = true
  let totalCost: number | undefined
  let interestPaid: number | undefined

  if (isDuration) {
    contribution = spareCash * (state.rate / 100)
    months = monthsToSave(target, contribution, state.growth)
    isFeasible = months !== Infinity
  } else if (isGoal) {
    months = Math.max(1, state.goalMonths)
    contribution = contributionForGoal(target, months, state.growth)
    isFeasible = true
    fits = contribution <= spareCash
  } else {
    months = Math.max(1, state.term)
    contribution = paymentForFinance(target, months, state.growth)
    totalCost = contribution * months
    interestPaid = Math.max(0, totalCost - target)
    isFeasible = true
    fits = contribution <= spareCash
  }

  const chartBars: ChartBar[] = []
  let hasOverflowMonths = false
  let chartEndLabel = ''
  if (isFeasible) {
    const cap = Math.min(months, CHART_MONTHS_CAP) || 1
    const i = state.growth / 100 / 12
    for (let k = 1; k <= cap; k++) {
      let frac: number
      if (isFinance) {
        let bal = target
        for (let m = 0; m < k; m++) bal = bal * (1 + i) - contribution
        bal = Math.max(0, bal)
        frac = target > 0 ? Math.min(1, 1 - bal / target) : 1
      } else {
        let bal = 0
        for (let m = 0; m < k; m++) bal = bal * (1 + i) + contribution
        frac = target > 0 ? Math.min(1, bal / target) : 1
      }
      chartBars.push({
        heightPct: Math.max(3, Math.round(frac * 100)),
        color: k === cap ? 'var(--result-bar-current)' : 'var(--result-bar-past)',
      })
    }
    hasOverflowMonths = months > CHART_MONTHS_CAP
    chartEndLabel = months <= CHART_MONTHS_CAP ? addMonths(months) : `${addMonths(CHART_MONTHS_CAP)}+`
  }

  let headline = ''
  let subheadline = ''
  if (isFeasible) {
    if (isDuration) {
      headline =
        months === 0 ? 'You can afford it now' : `${months} month${months === 1 ? '' : 's'} — ${addMonths(months)}`
      subheadline = `Saving ${fmt(contribution)}/month, you'll reach ${fmt(itemPrice)} by then.`
    } else if (isGoal) {
      headline = `${fmt(contribution)}/mo`
      subheadline = `To have ${fmt(itemPrice)} by ${addMonths(months)}, you'd need to save this much each month.`
    } else {
      headline = `${fmt(contribution)}/mo`
      subheadline = `Financing ${fmt(target)} at ${state.growth}% APR over ${months} months.`
    }
  }

  let isAffordable: boolean
  let verdictSub: string
  if (isDuration) {
    isAffordable = isFeasible && months <= AFFORDABILITY_MONTHS_CAP
    verdictSub = !isFeasible
      ? 'Increase how much you save each month, or lower the price.'
      : months > AFFORDABILITY_MONTHS_CAP
        ? `That's over ${Math.round(AFFORDABILITY_MONTHS_CAP / 12)} years — try saving a bigger share each month.`
        : `Saving ${fmt(contribution)}/month gets you there by ${addMonths(months)}.`
  } else {
    isAffordable = fits
    verdictSub = fits
      ? `${fmt(contribution)}/month fits comfortably within your ${fmt(spareCash)} spare cash.`
      : `${fmt(contribution)}/month is ${fmt(contribution - spareCash)} more than your spare cash.`
  }

  return {
    spareCash,
    target,
    months,
    contribution,
    totalCost,
    interestPaid,
    isFeasible,
    fits,
    isAffordable,
    verdictText: isAffordable ? "Yes — it's within reach." : "No — that's a stretch.",
    verdictSub,
    verdictIcon: isAffordable ? '✓' : '✕',
    verdictIconBg: isAffordable ? 'var(--verdict-affordable)' : 'var(--verdict-not-affordable)',
    resultEyebrow: isDuration ? 'Time to save up' : isGoal ? 'Monthly saving needed' : 'Monthly payment plan',
    headline,
    subheadline,
    contributionRowLabel: isFinance ? 'MONTHLY PAYMENT' : 'MONTHLY SAVING',
    targetRowLabel: isFinance ? 'AMOUNT TO FINANCE' : 'AMOUNT LEFT TO SAVE',
    chartBars,
    hasOverflowMonths,
    chartEndLabel,
  }
}
