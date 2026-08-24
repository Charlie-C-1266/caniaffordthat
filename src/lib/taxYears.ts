// UK income-tax and National Insurance parameters, keyed by tax year, for the
// reverse "what salary would I need?" mode. Kept as data (not code) so a new
// year is a new table entry, not a new branch — and so the ~30-minute April
// refresh is a one-line edit. All figures are rest-of-UK (England, Wales,
// Northern Ireland); Scotland has its own bands and is a deliberate v2.
//
// 2026/27, employment income, tax code 1257L, no student loan or pension:
//   - Personal allowance £12,570, tapered £1 for every £2 of income over
//     £100,000 (fully gone by £125,140).
//   - Income tax: 20% to £50,270, 40% to £125,140, 45% above.
//   - Employee (Class 1) NI: 8% between £12,570 and £50,270, 2% above.
//   - All thresholds frozen until 2030/31 (Autumn 2022 / Spring 2024).
// The freeze covers income tax and NI only. Student loan thresholds do not share
// it — Plan 1 and Plan 4 move every April — so adding them here also adds a real
// annual maintenance obligation this table does not currently carry.
// Verified against GOV.UK income-tax-rates and national-insurance-rates for
// the 2026/27 year.

/** One band of a progressive charge: a rate applied up to `upTo` (of the relevant base), the last band open-ended with `upTo: Infinity`. */
export interface TaxBand {
  /** Upper bound of the band. For income tax this is *taxable* income; for NI it is *gross* income. */
  upTo: number
  /** Marginal rate within the band, as a fraction (0.2 = 20%). */
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
  /** ONS median gross annual pay for full-time employees, for the "above/below the UK median" context line. */
  medianFullTimeSalary: number
}

// Income-tax band upper bounds are expressed on *taxable* income (gross minus
// the personal allowance). The 20% band is the £37,700 basic-rate band; the
// 40% band runs up to £125,140, the point at which the allowance is fully
// tapered and the 45% additional rate begins (see taperThreshold below).
const TAX_YEAR_2026_27: TaxYear = {
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
  // ONS Annual Survey of Hours and Earnings — median gross pay for full-time
  // employees (provisional 2025). Refresh yearly alongside the tax figures.
  medianFullTimeSalary: 37430,
}

/** The tax year the reverse mode uses. A single current year today; ready to become a lookup when a second year lands. */
export const CURRENT_TAX_YEAR: TaxYear = TAX_YEAR_2026_27
