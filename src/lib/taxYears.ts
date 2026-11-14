import type { StudentLoanPlan } from '../state/types'

// UK income-tax, National Insurance and student loan parameters, keyed by tax
// year, for the salary engine. Kept as data (not code) so a new year is a new
// table entry, not a new branch. All tax figures are rest-of-UK (England,
// Wales, Northern Ireland); Scotland has its own bands and is a deliberate v2.
//
// 2026/27, employment income, tax code 1257L:
//   - Personal allowance £12,570, tapered £1 for every £2 of income over
//     £100,000 (fully gone by £125,140).
//   - Income tax: 20% to £50,270, 40% to £125,140, 45% above.
//   - Employee (Class 1) NI: 8% between £12,570 and £50,270, 2% above.
//   - Student loans: 9% over £26,900 (Plan 1), £29,385 (Plan 2), £33,795
//     (Plan 4) or £25,000 (Plan 5); the Postgraduate Loan is 6% over £21,000,
//     on top of any plan. Repayments are worked out on the same pay as
//     employer NI.
//   - Relief at source: the pension provider adds 20%, the basic rate.
//
// Only income tax and NI are frozen (until 2030/31, Autumn 2022 / Spring
// 2024), so the April refresh is no longer a formality:
//   - Plan 1 and Plan 4 thresholds rise every April.
//   - Plan 2 is held at £29,385 until April 2030, then follows RPI (confirmed
//     for 2027/28 on 12 November 2026).
//   - Plan 5 is fixed at £25,000 until 5 April 2027, then follows RPI,
//     rounded up to the nearest £5.
//   - The Postgraduate Loan threshold and both loan rates need checking too.
// Verified against GOV.UK income-tax-rates, national-insurance-rates,
// "Repaying your student loan: how much you repay", the employers' rates and
// thresholds for 2026 to 2027, and "Tax on your private pension: pension tax
// relief", for the 2026/27 year.

/** One band of a progressive charge: a rate applied up to `upTo` (of the relevant base), the last band open-ended with `upTo: Infinity`. */
export interface TaxBand {
  /** Upper bound of the band. For income tax this is *taxable* income; for NI it is *gross* income. */
  upTo: number
  /** Marginal rate within the band, as a fraction (0.2 = 20%). */
  rate: number
}

/** One student or postgraduate loan's repayment terms for a tax year. */
export interface LoanTerms {
  /** Annual repayment threshold, on the same gross pay employer NI is worked out on. */
  threshold: number
  /** Share of pay above the threshold that is repaid, as a fraction (0.09 = 9%). */
  rate: number
}

/** Everything the salary engine needs for one tax year. */
export interface TaxYear {
  /** Machine id, e.g. "2026-27". */
  id: string
  /** Human label, e.g. "2026/27". */
  label: string
  /** Tax-free personal allowance before the taper. */
  personalAllowance: number
  /** Income above which the allowance tapers. */
  taperThreshold: number
  /** Allowance lost per £1 of income over the taper threshold (£1 per £2 = 0.5). */
  taperRate: number
  /** Income-tax bands, on *taxable* income (income above the allowance). Cumulative upper bounds. */
  incomeTaxBands: readonly TaxBand[]
  /** Employee National Insurance bands, on *gross* income. Cumulative upper bounds. */
  niBands: readonly TaxBand[]
  /** Undergraduate student loan plans, each repaid at its rate on pay over its threshold. */
  studentLoanPlans: Readonly<Record<StudentLoanPlan, LoanTerms>>
  /** The Postgraduate Loan, repaid on top of any undergraduate plan. */
  postgraduateLoan: LoanTerms
  /**
   * Relief a relief-at-source pension provider adds: the rest-of-UK basic
   * rate. Kept apart from the income-tax bands because providers claim 20%
   * even for a Scottish taxpayer whose starter rate is 19%.
   */
  reliefAtSourceRate: number
  /** ONS median gross annual pay for full-time employees, for the "above/below the UK median" context line. */
  medianFullTimeSalary: number
}

// Income-tax band upper bounds are expressed on *taxable* income (gross minus
// the personal allowance). The 20% band is the £37,700 basic-rate band; the
// 40% band runs up to £125,140, the point at which the allowance is fully
// tapered and the 45% additional rate begins (see taperThreshold below).
/** The current year's table. Exported so a data-integrity test can assert `CURRENT_TAX_YEAR` still points at the year it claims to. */
export const TAX_YEAR_2026_27: TaxYear = {
  id: '2026-27',
  label: '2026/27',
  personalAllowance: 12570,
  taperThreshold: 100000,
  taperRate: 0.5,
  incomeTaxBands: [
    { upTo: 37700, rate: 0.2 },
    { upTo: 125140, rate: 0.4 },
    { upTo: Infinity, rate: 0.45 },
  ],
  niBands: [
    { upTo: 12570, rate: 0 },
    { upTo: 50270, rate: 0.08 },
    { upTo: Infinity, rate: 0.02 },
  ],
  studentLoanPlans: {
    plan1: { threshold: 26900, rate: 0.09 },
    plan2: { threshold: 29385, rate: 0.09 },
    plan4: { threshold: 33795, rate: 0.09 },
    plan5: { threshold: 25000, rate: 0.09 },
  },
  postgraduateLoan: { threshold: 21000, rate: 0.06 },
  reliefAtSourceRate: 0.2,
  // ONS Annual Survey of Hours and Earnings — median gross pay for full-time
  // employees (provisional 2025). Refresh yearly alongside the tax figures.
  medianFullTimeSalary: 37430,
}

/** The tax year the salary engine uses. A single current year today; ready to become a lookup when a second year lands. */
export const CURRENT_TAX_YEAR: TaxYear = TAX_YEAR_2026_27
