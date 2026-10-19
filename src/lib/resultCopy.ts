import { fmt, addMonths } from './calculations'
import { AFFORDABILITY_MONTHS_CAP, fitReading, type FitReadingInput } from './affordability'

// The words of every standard result: its headline, sub-copy and verdict, per
// kind of plan, and the shared sentences the vehicle flow reuses. The numbers
// come from deriveResult in derive.ts, and how comfortably a commitment fits
// comes from affordability.ts.

/** Which result presentation a plan gets. Adding a new bespoke flow (e.g. car finance) means adding a kind and a builder, not threading another branch through five parallel ternaries. */
export type ResultKind = 'emergency' | 'duration' | 'goal' | 'finance'

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
  /** What the user already saves each month — the reversible headroom behind the pause hints. */
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
interface FitCopyInput extends FitReadingInput {
  /** What the user already saves each month — the headroom they could free up by pausing it. */
  regularSaving: number
}

/**
 * Whether pausing the regular saving would close the gap — the shared
 * condition behind both pause hints. The bound is inclusive: saving exactly
 * the shortfall still covers it.
 */
function pausingWouldClose(shortfall: number, regularSaving: number): boolean {
  return regularSaving > 0 && shortfall <= regularSaving
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
  if (!pausingWouldClose(shortfall, regularSaving)) return ''
  return ` It would fit if you paused the ${fmt(regularSaving)}/month you currently save.`
}

/**
 * The emergency fund's wording of the same hint. "Other savings" rather than
 * "you currently save" because on this goal the field cannot mean cushion
 * money — see the note beside the goal-date verdict in `emergencyCopy`.
 */
export function pauseOtherSavingHint(shortfall: number, regularSaving: number): string {
  if (!pausingWouldClose(shortfall, regularSaving)) return ''
  return ` It would fit if you paused the ${fmt(regularSaving)}/month you put into other savings.`
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
  const { band, shareOfTakeHome } = fitReading({ contribution, spareCash, takeHome })
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

/** The CopyContext-shaped adapter the standard result kinds use. */
function fitsVerdictSub(c: CopyContext): string {
  return commitmentFitSub(c)
}

export function resultCopy(kind: ResultKind, c: CopyContext): ResultCopy {
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
    // required monthly saving fits the user's spare cash — exactly the
    // question `commitmentFitSub` answers for goal-date saving and finance.
    // So this path reads the band the same way (share of take-home pay,
    // floored by share of spare cash) and only the sentences differ, keeping
    // the fund's cushion-and-milestone voice.
    isAffordable = c.fits
    if (c.fits) {
      verdictSub = cushionFitSub(c)
    } else {
      const shortfall = c.contribution - c.spareCash
      // The pause hint was deliberately kept off this flow when it was
      // introduced: "pause your saving in order to build a savings cushion"
      // reads as self-contradictory. It belongs here after all, because on
      // this goal alone the field cannot mean cushion money — the Budget step
      // asks for saving "that isn't going into this cushion", i.e. other pots
      // and investments — so pausing it moves money towards the cushion
      // rather than away from it. The wording says "other savings" so the
      // sentence can only be read that way, and the later-date route is
      // offered first: it keeps the other saving intact.
      verdictSub = `${fmt(c.contribution)}/month to hit ${addMonths(c.months)} is ${fmt(shortfall)} more than your spare cash — a later date needs less each month.${pauseOtherSavingHint(shortfall, c.regularSaving)}`
    }
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

/**
 * The emergency fund's wording for a goal-date saving that fits: the cushion
 * and its date lead, then the same band reading every other flow quotes —
 * the share of take-home pay, and the spare cash it sits inside.
 */
function cushionFitSub(c: CopyContext): string {
  const { band, shareOfTakeHome } = fitReading(c)
  const opening = `${fmt(c.contribution)}/month reaches your cushion by ${addMonths(c.months)} — ${Math.round(shareOfTakeHome * 100)}% of your take-home pay`
  switch (band) {
    case 'comfortable':
      return `${opening}, comfortably within your ${fmt(c.spareCash)} spare cash.`
    case 'chunk':
      return `${opening}, a good chunk of your ${fmt(c.spareCash)} spare cash, but it fits.`
    case 'tight':
      return `${opening}, and it fits within your ${fmt(c.spareCash)} spare cash, but it's tight.`
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
