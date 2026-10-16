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

// How comfortably a commitment fits is judged as a share of *take-home pay*.
// Both UK rules of thumb behind the bands are published as shares of income,
// so measuring the commitment the same way quotes them directly:
//   - 0.2 (comfortable cutoff) = the "savings/future" bucket of Halifax's
//     50/30/20 split (50% needs, 30% wants, 20% savings/future). A commitment
//     at or under this could be absorbed by that bucket alone, without
//     touching the "wants" bucket at all.
//   - 0.3 (tight cutoff) = MoneyHelper's own named "30% rule" for rent
//     affordability, its ceiling for a single major line item
//     (moneyhelper.org.uk/en/homes/renting/how-much-rent-can-you-afford).
//     Above this, the commitment alone already exceeds what MoneyHelper
//     considers reasonable for one major item, independent of anything else
//     in the budget.
// Below the first threshold is "comfortable", between the two is a "good
// chunk", above the second is "tight". See the in-app "Our sources" button
// for the actual linked pages.
//
// These were previously stated as shares of spare cash (0.4 and 0.6),
// converted from the figures above via "spare cash is roughly 50% of
// take-home pay". That conversion only held while spare cash meant "income
// less essentials": once regular saving is deducted too (see
// `committedOutgoingsOf`) the denominator is no longer ~50% of income, and
// holding the same absolute cut-offs would have pushed the ratios to 0.67 and
// 1.0 — collapsing the "tight" band into "anything that fits at all". So the
// bands are anchored to the figure the sources themselves use. Whether a
// commitment *fits* is still judged against spare cash; these bands only
// describe how comfortably it does.
// Exported so the methodology page quotes the bands actually in force.
export const TAKE_HOME_COMFORTABLE_RATIO = 0.2
export const TAKE_HOME_TIGHT_RATIO = 0.3

// A share of income on its own can still flatter a stretched budget: £360/mo
// is 18% of a £2,000 take-home — "comfortable" by the bands above — but if
// £1,500 of that pay is already spoken for it is 72% of what's left, and
// calling it comfortable would be wrong. So the share-of-spare-cash reading
// is kept as a floor: the verdict takes whichever of the two readings is
// worse, and this pair can only ever make a description stricter.
//
// Unlike the pair above these are not a published rule of thumb. They are the
// ratios this calculator used before the bands moved to income, retained
// deliberately: they were sound as a description of how much headroom a
// commitment eats, and only ever unsound as a restatement of the UK
// 20%/30%-of-income guidance, which is the job they no longer do.
export const SPARE_CASH_HEADROOM_COMFORTABLE_RATIO = 0.4
export const SPARE_CASH_HEADROOM_TIGHT_RATIO = 0.6

/**
 * Sum of the five essential monthly outgoing fields (housing…debts), and the
 * emergency fund's "essential spend". Regular saving is deliberately not part
 * of this — see `committedOutgoingsOf`.
 */
export function monthlyOutgoingsOf(state: CalculatorState): number {
  return OUTGOING_FIELD_KEYS.reduce((sum, key) => sum + num(state[key]), 0)
}

/** What the user already puts into savings, investments or a pension each month. */
export function regularSavingOf(state: CalculatorState): number {
  return num(state.savingsMonthly)
}

/**
 * Everything already spoken for each month: the five essentials plus any
 * regular saving. This is what spare cash is measured against, and it is
 * deliberately a different figure from `monthlyOutgoingsOf`. A cushion has to
 * replace the spending you could not stop, and saving is the first thing
 * anyone pauses when their income goes away — folding it into the essentials
 * sum would inflate the emergency fund's target by `coverMonths` times the
 * amount saved, for money the user would not actually need to replace.
 */
export function committedOutgoingsOf(state: CalculatorState): number {
  return monthlyOutgoingsOf(state) + regularSavingOf(state)
}

/** Monthly spare cash: take-home minus everything already committed, floored at 0. */
export function spareCashOf(state: CalculatorState): number {
  return Math.max(0, num(state.takeHome) - committedOutgoingsOf(state))
}

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
  // toggle as other saving goals, so its plan flavor follows saveFlavor too.
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
  /** What the user already saves each month — the reversible headroom behind `pauseSavingHint`. */
  regularSaving: number
  takeHome: number
  isFeasible: boolean
  fits: boolean
  /** Emergency fund only: goal-date sub-mode vs the open-ended "how long" one. */
  isGoal: boolean
  coverMonths: number
  growth: number
}

const monthsLabel = (n: number) => `${n} month${n === 1 ? '' : 's'}`

/** Standard "Yes / No" verdict shared by every non-emergency kind (and the vehicle flow). */
export const withinReachVerdict = (isAffordable: boolean) => (isAffordable ? "Yes — it's within reach." : "No — that's a stretch.")

/** What a "does this fit?" verdict needs to describe the commitment honestly. */
export interface FitCopyInput {
  /** The £/month being weighed up. */
  contribution: number
  spareCash: number
  takeHome: number
  /** What the user already saves each month — the headroom they could free up by pausing it. */
  regularSaving: number
}

/**
 * Regular saving is the one committed outgoing in this budget that is
 * genuinely reversible — nobody can pause their rent, but anyone can pause an
 * ISA standing order. So when a plan misses only by an amount the user is
 * already putting away, saying so is more useful than a flat "no". Returns a
 * trailing sentence, or '' when they save nothing or pausing it still would
 * not close the gap.
 */
export function pauseSavingHint(shortfall: number, regularSaving: number): string {
  if (!(regularSaving > 0 && shortfall <= regularSaving)) return ''
  return ` It would fit if you paused the ${fmt(regularSaving)}/month you currently save.`
}

/**
 * Sub-copy for any "does this fixed monthly amount fit?" verdict — goal-date
 * saving, generic finance, and the vehicle flow's total monthly cost all
 * judge a committed £/month the same way: does it fit inside spare cash, and
 * how large is it as a share of take-home pay.
 */
export function commitmentFitSub({ contribution, spareCash, takeHome, regularSaving }: FitCopyInput): string {
  if (contribution > spareCash) {
    const shortfall = contribution - spareCash
    return `${fmt(contribution)}/month is ${fmt(shortfall)} more than your spare cash.${pauseSavingHint(shortfall, regularSaving)}`
  }
  // Both denominators are only 0 here when the contribution is 0 too (the
  // branch above catches every other case), so a 0 share is the honest
  // answer rather than a guard against NaN.
  const shareOfTakeHome = takeHome > 0 ? contribution / takeHome : 0
  const shareOfSpareCash = spareCash > 0 ? contribution / spareCash : 0
  const band = worseBand(
    bandFor(shareOfTakeHome, TAKE_HOME_COMFORTABLE_RATIO, TAKE_HOME_TIGHT_RATIO),
    bandFor(shareOfSpareCash, SPARE_CASH_HEADROOM_COMFORTABLE_RATIO, SPARE_CASH_HEADROOM_TIGHT_RATIO),
  )
  const opening = `${fmt(contribution)}/month is ${Math.round(shareOfTakeHome * 100)}% of your take-home pay`
  switch (band) {
    case 'comfortable':
      return `${opening} — it fits comfortably within your ${fmt(spareCash)} spare cash.`
    case 'chunk':
      return `${opening} — a good chunk of your ${fmt(spareCash)} spare cash, but it fits.`
    case 'tight':
      return `${opening} — it fits within your ${fmt(spareCash)} spare cash, but it's tight.`
  }
}

/** How comfortably a commitment fits, worst last. */
type FitBand = 'comfortable' | 'chunk' | 'tight'

/** Worst-last, so `worseBand` can compare two readings by position. */
const FIT_BANDS: readonly FitBand[] = ['comfortable', 'chunk', 'tight']

/** Places a ratio in its band. Both cut-offs are inclusive, so a figure exactly on one takes the friendlier description. */
function bandFor(ratio: number, comfortable: number, tight: number): FitBand {
  if (ratio <= comfortable) return 'comfortable'
  if (ratio <= tight) return 'chunk'
  return 'tight'
}

/** The less comfortable of two readings — how the income bands and the headroom floor are combined. */
function worseBand(a: FitBand, b: FitBand): FitBand {
  return FIT_BANDS.indexOf(a) >= FIT_BANDS.indexOf(b) ? a : b
}

/** The CopyContext-shaped adapter the standard result kinds use. */
function fitsVerdictSub(c: CopyContext): string {
  return commitmentFitSub(c)
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
