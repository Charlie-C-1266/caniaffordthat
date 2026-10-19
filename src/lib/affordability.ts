// How comfortably a monthly commitment fits a budget: the UK rules of thumb
// the verdicts are banded on, and the reading every flow places a commitment
// with. Only the judgement lives here. The sentences built on it are in
// resultCopy.ts, so a change to a band and a change to the wording each touch
// one file.

// 5 years is MoneyHelper's (the UK's government-backed money guidance
// service) rule of thumb for the boundary between "keep it in cash savings"
// and "consider investing instead" — see moneyhelper.org.uk/en/savings/how-to-save/should-i-save-or-invest.
// A plan that takes longer than this to reach the goal is arguably no longer
// a simple cash-savings plan for a specific purchase, which is what this
// mode assumes.
export const AFFORDABILITY_MONTHS_CAP = 60

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

/** The three figures any band reading needs: the £/month, and the two denominators it's measured against. */
export interface FitReadingInput {
  /** The £/month being weighed up. */
  contribution: number
  spareCash: number
  takeHome: number
}

/** How comfortably a commitment sits, and the share-of-take-home figure the copy quotes alongside it. */
interface FitReading {
  band: FitBand
  /** The commitment as a fraction of take-home pay. */
  shareOfTakeHome: number
}

/**
 * Places a commitment that already fits spare cash in its band: its share of
 * take-home pay, tightened by the share-of-spare-cash headroom floor. Shared
 * so every flow judging a fixed £/month — goal-date saving, finance, the
 * vehicle flow and the emergency fund's goal date — bands it on the same
 * terms, whatever sentence each one wraps around the result.
 */
export function fitReading({ contribution, spareCash, takeHome }: FitReadingInput): FitReading {
  // Callers reach this only once the commitment fits spare cash, so both
  // denominators are 0 only when the contribution is 0 too — a 0 share is the
  // honest answer there rather than a guard against NaN.
  const shareOfTakeHome = takeHome > 0 ? contribution / takeHome : 0
  const shareOfSpareCash = spareCash > 0 ? contribution / spareCash : 0
  return {
    shareOfTakeHome,
    band: worseBand(
      bandFor(shareOfTakeHome, TAKE_HOME_COMFORTABLE_RATIO, TAKE_HOME_TIGHT_RATIO),
      bandFor(shareOfSpareCash, SPARE_CASH_HEADROOM_COMFORTABLE_RATIO, SPARE_CASH_HEADROOM_TIGHT_RATIO),
    ),
  }
}
