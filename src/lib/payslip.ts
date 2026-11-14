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
