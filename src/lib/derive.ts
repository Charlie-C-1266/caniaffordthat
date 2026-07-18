import { num, fmt, monthsToSave, contributionForGoal, paymentForFinance, addMonths } from './calculations'
import { goalById } from './goals'
import { OUTGOING_FIELD_KEYS } from './budget'
import { budgetBreakdown, type BudgetBreakdown } from './budgetSplit'
import { financeProjection, savingProjection, type Projection } from './projection'
import type { CalculatorState } from '../state/types'

// 5 years is MoneyHelper's (the UK's government-backed money guidance
// service) rule of thumb for the boundary between "keep it in cash savings"
// and "consider investing instead" — see moneyhelper.org.uk/en/savings/how-to-save/should-i-save-or-invest.
// A plan that takes longer than this to reach the goal is arguably no longer
// a simple cash-savings plan for a specific purchase, which is what this
// mode assumes.
const AFFORDABILITY_MONTHS_CAP = 60

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
// Exported so the methodology page quotes the bands actually in force.
export const SPARE_CASH_COMFORTABLE_RATIO = 0.4
export const SPARE_CASH_TIGHT_RATIO = 0.6

/** Sum of the five monthly outgoing fields (housing…debts). Also the emergency fund's "essential spend". */
export function monthlyOutgoingsOf(state: CalculatorState): number {
  return OUTGOING_FIELD_KEYS.reduce((sum, key) => sum + num(state[key]), 0)
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
  resultEyebrow: string
  headline: string
  subheadline: string
  contributionRowLabel: string
  targetRowLabel: string
  /** Month-by-month series behind the balance chart and projection table; `null` when there's nothing to project (not feasible, or the target's already met). */
  projection: Projection | null
  /** How the monthly commitment sits within the budget — the data behind the budget donut. */
  budget: BudgetBreakdown
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
  // The emergency fund is save-only but honours the same duration/goal-date
  // toggle as other saving goals, so its plan flavor follows saveFlavor too.
  const isDuration = state.mode === 'save' && state.saveFlavor === 'duration'
  const isGoal = state.mode === 'save' && state.saveFlavor === 'goal'

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
    // The monthly saving is either a share of spare cash or a fixed amount the
    // user typed — both feed the same "how long to reach the target" maths.
    contribution = state.rateMode === 'amount' ? num(state.monthlyAmount) : spareCash * (state.rate / 100)
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

  // The month-by-month series behind the balance chart, projection table and
  // legacy bars — only when there's actually something to project (a feasible
  // plan reaching for a target that isn't already met).
  const projection =
    isFeasible && target > 0
      ? isFinance
        ? financeProjection(target, contribution, state.growth, months)
        : savingProjection(target, contribution, state.growth, months)
      : null

  // All the presentation copy for the result is built per "kind" (emergency /
  // duration / goal-date / finance), so each mode's headline, sub-copy, and
  // verdict live together rather than spread across three parallel branches.
  const kind: ResultKind = isEmergency ? 'emergency' : isFinance ? 'finance' : isGoal ? 'goal' : 'duration'
  const { isAffordable, headline, subheadline, verdictText, verdictSub, resultEyebrow } = resultCopy(kind, {
    months,
    contribution,
    target,
    grossTarget,
    spareCash,
    essentialSpend,
    isFeasible,
    fits,
    isGoal,
    coverMonths: state.coverMonths,
    growth: state.growth,
  })

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
    verdictText,
    verdictSub,
    resultEyebrow,
    headline,
    subheadline,
    contributionRowLabel: isFinance ? 'MONTHLY PAYMENT' : 'MONTHLY SAVING',
    targetRowLabel: isFinance ? 'AMOUNT TO FINANCE' : 'AMOUNT LEFT TO SAVE',
    projection,
    budget: budgetBreakdown(state, contribution),
  }
}

/** Which result presentation a plan gets. Adding a new bespoke flow (e.g. car finance) means adding a kind and a builder, not threading another branch through five parallel ternaries. */
type ResultKind = 'emergency' | 'duration' | 'goal' | 'finance'

/** The verdict + copy fields `deriveResult` shows, all decided together per kind. */
interface ResultCopy {
  isAffordable: boolean
  headline: string
  subheadline: string
  verdictText: string
  verdictSub: string
  resultEyebrow: string
}

/** The computed numbers each copy builder reads (a slice of the in-progress result). */
interface CopyContext {
  months: number
  contribution: number
  target: number
  grossTarget: number
  spareCash: number
  essentialSpend: number
  isFeasible: boolean
  fits: boolean
  /** Emergency fund only: goal-date sub-mode vs the open-ended "how long" one. */
  isGoal: boolean
  coverMonths: number
  growth: number
}

const monthsLabel = (n: number) => `${n} month${n === 1 ? '' : 's'}`

/** Standard "Yes / No" verdict shared by every non-emergency kind (and the vehicle flow). */
export const withinReachVerdict = (isAffordable: boolean) =>
  isAffordable ? "Yes — it's within reach." : "No — that's a stretch."

/**
 * Sub-copy for any "does this fixed monthly amount fit?" verdict — goal-date
 * saving, generic finance, and the vehicle flow's total monthly cost all
 * judge a committed £/month against spare cash with the same bands.
 */
export function spareCashFitSub(contribution: number, spareCash: number): string {
  const ratio = spareCash > 0 ? contribution / spareCash : Infinity
  if (contribution > spareCash) return `${fmt(contribution)}/month is ${fmt(contribution - spareCash)} more than your spare cash.`
  if (ratio <= SPARE_CASH_COMFORTABLE_RATIO) return `${fmt(contribution)}/month fits comfortably within your ${fmt(spareCash)} spare cash.`
  if (ratio <= SPARE_CASH_TIGHT_RATIO) return `${fmt(contribution)}/month fits, but takes up a good chunk of your ${fmt(spareCash)} spare cash.`
  return `${fmt(contribution)}/month fits, but it's tight — that's most of your ${fmt(spareCash)} spare cash.`
}

/** The CopyContext-shaped adapter the standard result kinds use. */
function fitsVerdictSub(c: CopyContext): string {
  return spareCashFitSub(c.contribution, c.spareCash)
}

function resultCopy(kind: ResultKind, c: CopyContext): ResultCopy {
  switch (kind) {
    case 'emergency':
      return emergencyCopy(c)
    case 'goal':
      return goalCopy(c)
    case 'finance':
      return financeCopy(c)
    case 'duration':
      return durationCopy(c)
  }
}

/** Emergency fund: build a cushion of essential spending, kept in easy-access savings. */
function emergencyCopy(c: CopyContext): ResultCopy {
  let headline = ''
  let subheadline = ''
  if (c.isFeasible) {
    if (c.target === 0) {
      headline = "You're already covered"
      subheadline = `You've already set aside your ${c.coverMonths}-month cushion (${fmt(c.grossTarget)}). Keep it in an easy-access savings account.`
    } else if (c.isGoal) {
      headline = `${fmt(c.contribution)}/mo`
      subheadline = `To reach your ${c.coverMonths}-month cushion (${fmt(c.grossTarget)}) by ${addMonths(c.months)}, save this much each month — best kept in an easy-access savings account.`
    } else {
      headline = `${monthsLabel(c.months)} — ${addMonths(c.months)}`
      subheadline = `Saving ${fmt(c.contribution)}/month, you'll have your ${c.coverMonths}-month cushion (${fmt(c.grossTarget)}) by then — best kept in an easy-access savings account.`
    }
  }

  let isAffordable: boolean
  let verdictSub: string
  if (c.isGoal) {
    // Goal-date path: the date is fixed, so affordability is whether the
    // required monthly saving fits the user's spare cash.
    isAffordable = c.fits
    verdictSub = c.fits
      ? `${fmt(c.contribution)}/month reaches your cushion by ${addMonths(c.months)}, within your ${fmt(c.spareCash)} spare cash.`
      : `${fmt(c.contribution)}/month to hit ${addMonths(c.months)} is ${fmt(c.contribution - c.spareCash)} more than your spare cash — a later date needs less each month.`
  } else {
    isAffordable = c.isFeasible && c.months <= AFFORDABILITY_MONTHS_CAP
    verdictSub = !c.isFeasible
      ? `Set aside whatever you can each month — even ${fmt(c.essentialSpend)} (a 1-month cushion) is a solid first milestone.`
      : c.months > AFFORDABILITY_MONTHS_CAP
        ? `The full ${c.coverMonths}-month fund is a way off — start with a 1-month cushion of ${fmt(c.essentialSpend)} as your first milestone.`
        : `Saving ${fmt(c.contribution)}/month, you'll have your cushion by ${addMonths(c.months)}.`
  }

  return {
    isAffordable,
    headline,
    subheadline,
    verdictSub,
    verdictText: isAffordable ? 'Yes — you can build this.' : c.isGoal ? 'Not by that date.' : 'This one will take time.',
    resultEyebrow: c.isGoal ? 'Monthly saving needed' : 'Time to build your fund',
  }
}

/** Saving up, "how long will it take?" — the share-of-spare-cash flow. */
function durationCopy(c: CopyContext): ResultCopy {
  const isAffordable = c.isFeasible && c.months <= AFFORDABILITY_MONTHS_CAP
  return {
    isAffordable,
    headline: !c.isFeasible ? '' : c.months === 0 ? 'You can afford it now' : `${monthsLabel(c.months)} — ${addMonths(c.months)}`,
    subheadline: c.isFeasible ? `Saving ${fmt(c.contribution)}/month, you'll reach ${fmt(c.grossTarget)} by then.` : '',
    verdictSub: !c.isFeasible
      ? 'Increase how much you save each month, or lower the price.'
      : c.months > AFFORDABILITY_MONTHS_CAP
        ? `That's over ${Math.round(AFFORDABILITY_MONTHS_CAP / 12)} years — try saving a bigger share each month.`
        : `Saving ${fmt(c.contribution)}/month gets you there by ${addMonths(c.months)}.`,
    verdictText: withinReachVerdict(isAffordable),
    resultEyebrow: 'Time to save up',
  }
}

/** Saving up to a fixed date — the required monthly saving to hit the goal by then. */
function goalCopy(c: CopyContext): ResultCopy {
  return {
    isAffordable: c.fits,
    headline: `${fmt(c.contribution)}/mo`,
    subheadline: `To have ${fmt(c.grossTarget)} by ${addMonths(c.months)}, you'd need to save this much each month.`,
    verdictSub: fitsVerdictSub(c),
    verdictText: withinReachVerdict(c.fits),
    resultEyebrow: 'Monthly saving needed',
  }
}

/** Paying monthly — financing the amount over a term at an APR. */
function financeCopy(c: CopyContext): ResultCopy {
  return {
    isAffordable: c.fits,
    headline: `${fmt(c.contribution)}/mo`,
    subheadline: `Financing ${fmt(c.target)} at ${c.growth}% APR over ${c.months} months.`,
    verdictSub: fitsVerdictSub(c),
    verdictText: withinReachVerdict(c.fits),
    resultEyebrow: 'Monthly payment plan',
  }
}
