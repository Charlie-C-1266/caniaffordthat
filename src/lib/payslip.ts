import type { PensionInput } from './deductions'
import type { TakeHomeBreakdown } from './salary'

// One month of the salary engine's breakdown, in whole pence, for the Budget
// step's payslip. Rounding each line on its own leaves the lines a penny or
// two off the rounded take-home for over half of salaries, on the one panel
// whose job is to be added up. So the deductions are rounded together: each
// one first to its own nearest penny, then the leftover pennies go one each
// to the lines that rounding moved furthest from their exact figure, using
// the largest-remainder method. Every line stays within a penny of its exact
// figure, and salary less the deductions is take-home exactly.
//
// Salary and take-home are rounded first and never move. Take-home is the
// same `Math.round(× 100)` of the monthly figure that the Budget step stores
// and the result uses, so the payslip agrees with them to the penny.

/** The lines between salary and take-home, in the order a payslip lists them. */
export const PAYSLIP_DEDUCTIONS = ['incomeTax', 'nationalInsurance', 'studentLoan', 'postgraduateLoan', 'pension'] as const

/** One of the payslip's deduction lines. */
export type PayslipDeduction = (typeof PAYSLIP_DEDUCTIONS)[number]

/** One month's payslip in whole pence. Salary less every deduction is take-home, exactly. */
export type MonthlyPayslip = Record<'gross' | PayslipDeduction | 'takeHome', number>

/** A remainder's precision when ranking: a billionth of a penny, so float noise can't decide a tie the ranking means to settle. */
const REMAINDER_SCALE = 1e9

/** An annual figure as one month's worth of pence, unrounded. */
const monthlyPence = (annual: number): number => (annual / 12) * 100

/**
 * One month's payslip, in whole pence, with lines that add up. Salary and
 * take-home are each rounded to the penny; the deductions are rounded so
 * they come to exactly the difference, each within a penny of its exact
 * figure. A deduction the breakdown leaves at £0 stays at £0.
 *
 * Where a pension asks for more than the payslip has left, the breakdown's
 * take-home is £0 but its lines add up to more than the salary. The payslip
 * can't pay out what isn't there, so here each line takes no more than is
 * left after the lines above it. Tax, NI and the loans never take all of a
 * salary between them, so only the pension, last on the payslip, is ever cut
 * short, and it shows what the payslip had left for it.
 */
export function monthlyPayslipLines(breakdown: TakeHomeBreakdown): MonthlyPayslip {
  const gross = Math.round(monthlyPence(breakdown.gross))
  const takeHome = Math.round(monthlyPence(breakdown.takeHome))

  let left = monthlyPence(breakdown.gross)
  const exact = PAYSLIP_DEDUCTIONS.map((key) => {
    const taken = Math.min(monthlyPence(breakdown[key]), left)
    left -= taken
    return taken
  })
  const lines = exact.map((pence) => Math.round(pence))

  // Pennies the lines still need to take (positive) or give back (negative).
  // The rounding above leaves at most one per line, so no line moves twice.
  const gap = gross - takeHome - lines.reduce((sum, pence) => sum + pence, 0)
  const step = Math.sign(gap)
  // How far rounding moved a line against the gap: down when the lines need
  // more, up when they need less. The line moved furthest takes the first
  // penny; a tie goes to the bigger deduction, then the one higher up the
  // payslip, so the same breakdown always gives the same payslip.
  const against = (i: number): number => Math.round(step * (exact[i] - lines[i]) * REMAINDER_SCALE)
  const order = PAYSLIP_DEDUCTIONS.map((_, i) => i)
    .filter((i) => exact[i] > 0)
    .toSorted((a, b) => against(b) - against(a) || exact[b] - exact[a] || a - b)
  for (const i of order.slice(0, Math.abs(gap))) lines[i] += step

  const [incomeTax, nationalInsurance, studentLoan, postgraduateLoan, pension] = lines
  return { gross, incomeTax, nationalInsurance, studentLoan, postgraduateLoan, pension, takeHome }
}

/**
 * What goes into the pension pot in one month, in whole pence, taken from the
 * payslip rather than from the engine's unrounded annual figures.
 *
 * `monthlyPayslipLines` caps the PENSION line at whatever the payslip has
 * left and moves leftover pennies between the deductions, so the pay figure
 * on the panel is the only one a reader can check against a real payslip.
 * Under salary sacrifice and net pay the money that leaves pay is the money
 * that lands in the pot, so the two have to agree to the penny — working the
 * note out from `intoPension / 12` instead left it a penny off for about 17%
 * of salaries, and overstated it outright whenever the payslip cut the
 * pension short (#315).
 */
export function payslipIntoPension(breakdown: TakeHomeBreakdown, payslip: MonthlyPayslip): number {
  // Salary sacrifice and net pay — and no pension at all, where both are 0.
  // Compared rather than assumed, so relief at source can't fall through to
  // it and report the pot as the smaller pay figure.
  if (breakdown.intoPension === breakdown.pension) return payslip.pension

  // Relief at source (not offered yet; it arrives with the design doc's PR
  // 3): the provider adds its 20% on top, so the pot is bigger than the pay
  // line. Scaled from what the payslip actually took, never from the
  // uncapped `intoPension`.
  return Math.round(payslip.pension * (breakdown.intoPension / breakdown.pension))
}

/**
 * True when the pension asked for more than the salary had left, so the
 * payslip could only take part of it.
 *
 * The same arithmetic `takeHomeBreakdown`'s own `Math.max(0, …)` floor does,
 * on the annual figures and before any rounding — so this is exact, and can't
 * mistake a line that rounding moved a penny for a pension that was cut
 * short. Tax, NI and the loans never take all of a salary between them, so
 * the pension is the only line this can be true of.
 */
export function pensionWasCutShort(breakdown: TakeHomeBreakdown): boolean {
  const { gross, incomeTax, nationalInsurance, studentLoan, postgraduateLoan, pension } = breakdown
  return gross - incomeTax - nationalInsurance - studentLoan - postgraduateLoan - pension < 0
}

/**
 * True when less of an amount-mode pension reached the payslip than the user
 * typed. Two things can do that, and the caption has to own up to either:
 *
 *  - `pensionAt` caps the pot at the salary itself, so £5,000 a month against
 *    a £35,000 salary applies £2,916.67;
 *  - the payslip had less than that left once tax, NI and the loans had taken
 *    theirs, which `pensionWasCutShort` is.
 *
 * Compared in whole pence and worked out from `monthlyAmount` on both sides,
 * so an uncapped pension always reads as equal — including under relief at
 * source, where the pot is the typed figure divided by 0.8 and multiplying it
 * back need not land on the same double.
 *
 * Percent mode is never capped this way: its slider stops at 50%.
 */
export function pensionWasCapped(breakdown: TakeHomeBreakdown, pension: PensionInput | null): boolean {
  if (pension === null || pension.mode !== 'amount') return false
  const typedPence = Math.round(Math.max(0, pension.monthlyAmount) * 100)
  const appliedPence = Math.round((breakdown.pension / 12) * 100)
  return appliedPence < typedPence || pensionWasCutShort(breakdown)
}
