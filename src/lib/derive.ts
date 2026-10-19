import { num, monthsToSave, contributionForGoal, paymentForFinance } from './calculations'
import { goalById } from './goals'
import { committedOutgoingsOf, monthlyOutgoingsOf, regularSavingOf, spareCashOf } from './budget'
import { AFFORDABILITY_MONTHS_CAP } from './affordability'
import { resultCopy, type ResultKind } from './resultCopy'
import { budgetBreakdown, type BudgetBreakdown } from './budgetSplit'
import { financeProjection, savingProjection, type Projection } from './projection'
import type { CalculatorState } from '../state/types'

// The affordability result for the current state. What it's built from lives
// beside it: the budget sums in budget.ts, how comfortably a commitment fits
// in affordability.ts, and the result's wording in resultCopy.ts.

export interface DerivedResult {
  spareCash: number
  /** What the user already saves each month, carried through so the result can show it alongside the essentials it sits next to. */
  regularSaving: number
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
  /** Monthly take-home the plan needs to be affordable, for the reverse "what salary?" panel; `null` when income doesn't affect the plan (a fixed-amount save) or there's no target. */
  requiredTakeHomeMonthly: number | null
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
  // The emergency fund has no price: its target is derived from essential
  // monthly spending x coverMonths, and it is always a saving goal — you
  // cannot finance a cash buffer, so the mode toggle never applies to it.
  const isEmergency = goalById(state.goalId)?.emergency === true
  const isFinance = !isEmergency && state.mode === 'monthly'
  // The emergency fund is save-only but honours the same duration/goal-date
  // toggle as other saving goals, so its plan flavour follows saveFlavor too.
  const isDuration = state.mode === 'save' && state.saveFlavor === 'duration'
  const isGoal = state.mode === 'save' && state.saveFlavor === 'goal'

  const savings = num(state.savings)
  const essentialSpend = monthlyOutgoingsOf(state)
  const regularSaving = regularSavingOf(state)
  // The affordability boundary is take-home less *everything* committed, so
  // the reverse "what salary?" maths below has to add back the same figure
  // spareCashOf subtracts — essentials alone would understate it.
  const committedSpend = committedOutgoingsOf(state)

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

  // The take-home the plan needs to be affordable, for the reverse "what
  // salary?" panel. Each mode's affordability boundary reverses differently:
  //  - fixed monthly commitment (goal-date save, finance): the commitment must
  //    fit spare cash, so required take-home = essentials + the commitment.
  //  - share-of-spare-cash saving: the plan is affordable within the 60-month
  //    cap, so required take-home = essentials + the spare cash whose `rate`%
  //    reaches the target in 60 months.
  //  - fixed-amount saving is income-independent (you save the same £ whatever
  //    you earn), so there's nothing to reverse — left null.
  let requiredTakeHomeMonthly: number | null = null
  if (target > 0) {
    if (isDuration) {
      if (state.rateMode === 'percent' && state.rate > 0) {
        const requiredContribution = contributionForGoal(target, AFFORDABILITY_MONTHS_CAP, state.growth)
        requiredTakeHomeMonthly = committedSpend + requiredContribution / (state.rate / 100)
      }
    } else {
      requiredTakeHomeMonthly = committedSpend + contribution
    }
  }

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
    regularSaving,
    takeHome,
    isFeasible,
    fits,
    isGoal,
    coverMonths: state.coverMonths,
    growth: state.growth,
  })

  return {
    spareCash,
    regularSaving,
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
    requiredTakeHomeMonthly,
  }
}
