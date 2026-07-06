import { num, fmt, monthsToSave, contributionForGoal, paymentForFinance, addMonths } from './calculations'
import { goalById } from './goals'
import type { CalculatorState } from '../state/types'

// 5 years is MoneyHelper's (the UK's government-backed money guidance
// service) rule of thumb for the boundary between "keep it in cash savings"
// and "consider investing instead" — see moneyhelper.org.uk/en/savings/how-to-save/should-i-save-or-invest.
// A plan that takes longer than this to reach the goal is arguably no longer
// a simple cash-savings plan for a specific purchase, which is what this
// mode assumes.
const AFFORDABILITY_MONTHS_CAP = 60
const CHART_MONTHS_CAP = 24

// No UK body publishes a rule of thumb framed exactly as "% of leftover cash
// after essentials" (our "spare cash"), so these are derived from two UK
// ones that are, both converted the same way: Halifax's 50/30/20 split (50%
// needs, 30% wants, 20% savings/future) puts spare cash at roughly 50% of
// take-home pay, so a share-of-income figure X% becomes a share-of-spare-cash
// figure of X / 0.5:
//   - 0.4 (comfortable cutoff) = 20% of income / 50% = the 50/30/20 split's
//     own "savings/future" bucket. A commitment at or under this could be
//     absorbed there alone, without touching the "wants" bucket at all.
//   - 0.6 (tight cutoff) = 30% of income / 50% = MoneyHelper's own named
//     "30% rule" for rent affordability (a ceiling for a single major line
//     item — moneyhelper.org.uk/en/homes/renting/how-much-rent-can-you-afford).
//     Above this, the commitment alone already exceeds what MoneyHelper
//     considers the ceiling for one major item, independent of anything
//     else in the budget.
// Below the first threshold is "comfortable", between the two is a "good
// chunk", above the second is "tight". See the in-app "Our sources" button
// for the actual linked pages.
const SPARE_CASH_COMFORTABLE_RATIO = 0.4
const SPARE_CASH_TIGHT_RATIO = 0.6

export interface ChartBar {
  heightPct: number
  color: string
}

/** Sum of the five monthly outgoing fields (housing…debts). Also the emergency fund's "essential spend". */
export function monthlyOutgoingsOf(state: CalculatorState): number {
  return (
    num(state.housing) + num(state.utilities) + num(state.groceries) + num(state.transport) + num(state.debts)
  )
}

/** Monthly spare cash: take-home minus outgoings, floored at 0. */
export function spareCashOf(state: CalculatorState): number {
  return Math.max(0, num(state.takeHome) - monthlyOutgoingsOf(state))
}

export interface DerivedResult {
  spareCash: number
  /** The full goal amount before subtracting anything already saved (item price, or the emergency fund's derived target). */
  grossTarget: number
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
 * exact verdict thresholds and copy). Returns `null` when the required fields
 * aren't filled in yet — take-home pay plus either an item price or (for the
 * price-less emergency fund) enough outgoings to derive a target; callers
 * should show the "fill these in first" fallback in that case.
 */
export function deriveResult(state: CalculatorState): DerivedResult | null {
  // The emergency fund has no price: its target is a multiple of essential
  // monthly spending, and it's always a saving goal (see design/adr/0004).
  const isEmergency = goalById(state.goalId)?.emergency === true
  const isFinance = !isEmergency && state.mode === 'monthly'
  const isDuration = isEmergency || (state.mode === 'save' && state.saveFlavor === 'duration')
  const isGoal = !isEmergency && state.mode === 'save' && state.saveFlavor === 'goal'

  const savings = num(state.savings)
  const essentialSpend = monthlyOutgoingsOf(state)

  const takeHome = num(state.takeHome)
  const grossTarget = isEmergency ? state.coverMonths * essentialSpend : num(state.itemPrice)
  // Gate on a meaningful target plus take-home: item price for standard goals,
  // or coverMonths x essentials for the emergency fund.
  if (!(takeHome > 0 && grossTarget > 0)) return null

  const spareCash = spareCashOf(state)
  const target = Math.max(0, grossTarget - savings)

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
    if (isEmergency) {
      headline =
        months === 0
          ? "You're already covered"
          : `${months} month${months === 1 ? '' : 's'} — ${addMonths(months)}`
      subheadline =
        months === 0
          ? `You've already set aside your ${state.coverMonths}-month cushion. Keep it in an easy-access savings account.`
          : `Saving ${fmt(contribution)}/month, you'll have your ${state.coverMonths}-month cushion (${fmt(grossTarget)}) by then — best kept in an easy-access savings account.`
    } else if (isDuration) {
      headline =
        months === 0 ? 'You can afford it now' : `${months} month${months === 1 ? '' : 's'} — ${addMonths(months)}`
      subheadline = `Saving ${fmt(contribution)}/month, you'll reach ${fmt(grossTarget)} by then.`
    } else if (isGoal) {
      headline = `${fmt(contribution)}/mo`
      subheadline = `To have ${fmt(grossTarget)} by ${addMonths(months)}, you'd need to save this much each month.`
    } else {
      headline = `${fmt(contribution)}/mo`
      subheadline = `Financing ${fmt(target)} at ${state.growth}% APR over ${months} months.`
    }
  }

  let isAffordable: boolean
  let verdictSub: string
  if (isEmergency) {
    isAffordable = isFeasible && months <= AFFORDABILITY_MONTHS_CAP
    verdictSub = !isFeasible
      ? `Set aside whatever you can each month — even ${fmt(essentialSpend)} (a 1-month cushion) is a solid first milestone.`
      : months > AFFORDABILITY_MONTHS_CAP
        ? `The full ${state.coverMonths}-month fund is a way off — start with a 1-month cushion of ${fmt(essentialSpend)} as your first milestone.`
        : `Saving ${fmt(contribution)}/month, you'll have your cushion by ${addMonths(months)}.`
  } else if (isDuration) {
    isAffordable = isFeasible && months <= AFFORDABILITY_MONTHS_CAP
    verdictSub = !isFeasible
      ? 'Increase how much you save each month, or lower the price.'
      : months > AFFORDABILITY_MONTHS_CAP
        ? `That's over ${Math.round(AFFORDABILITY_MONTHS_CAP / 12)} years — try saving a bigger share each month.`
        : `Saving ${fmt(contribution)}/month gets you there by ${addMonths(months)}.`
  } else {
    isAffordable = fits
    const spareCashRatio = spareCash > 0 ? contribution / spareCash : Infinity
    verdictSub = !fits
      ? `${fmt(contribution)}/month is ${fmt(contribution - spareCash)} more than your spare cash.`
      : spareCashRatio <= SPARE_CASH_COMFORTABLE_RATIO
        ? `${fmt(contribution)}/month fits comfortably within your ${fmt(spareCash)} spare cash.`
        : spareCashRatio <= SPARE_CASH_TIGHT_RATIO
          ? `${fmt(contribution)}/month fits, but takes up a good chunk of your ${fmt(spareCash)} spare cash.`
          : `${fmt(contribution)}/month fits, but it's tight — that's most of your ${fmt(spareCash)} spare cash.`
  }

  return {
    spareCash,
    grossTarget,
    target,
    months,
    contribution,
    totalCost,
    interestPaid,
    isFeasible,
    fits,
    isAffordable,
    verdictText: isEmergency
      ? isAffordable
        ? "Yes — you can build this."
        : 'This one will take time.'
      : isAffordable
        ? "Yes — it's within reach."
        : "No — that's a stretch.",
    verdictSub,
    verdictIcon: isAffordable ? '✓' : '✕',
    verdictIconBg: isAffordable ? 'var(--verdict-affordable)' : 'var(--verdict-not-affordable)',
    resultEyebrow: isEmergency
      ? 'Time to build your fund'
      : isDuration
        ? 'Time to save up'
        : isGoal
          ? 'Monthly saving needed'
          : 'Monthly payment plan',
    headline,
    subheadline,
    contributionRowLabel: isFinance ? 'MONTHLY PAYMENT' : 'MONTHLY SAVING',
    targetRowLabel: isFinance ? 'AMOUNT TO FINANCE' : 'AMOUNT LEFT TO SAVE',
    chartBars,
    hasOverflowMonths,
    chartEndLabel,
  }
}
