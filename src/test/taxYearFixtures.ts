import type { TaxYear } from '../lib/taxYears'

/**
 * The loan and relief-at-source terms every made-up table here carries: the
 * 2026/27 figures, copied rather than read from the real table so a yearly
 * refresh can't move a test's numbers. Tests that aren't about loans or
 * pensions never use them.
 */
export const DEDUCTION_TERMS_FOR_TESTS: Pick<TaxYear, 'studentLoanPlans' | 'postgraduateLoan' | 'reliefAtSourceRate'> = {
  studentLoanPlans: {
    plan1: { threshold: 26900, rate: 0.09 },
    plan2: { threshold: 29385, rate: 0.09 },
    plan4: { threshold: 33795, rate: 0.09 },
    plan5: { threshold: 25000, rate: 0.09 },
  },
  postgraduateLoan: { threshold: 21000, rate: 0.06 },
  reliefAtSourceRate: 0.2,
}

// Tax-year tables unlike any real year, for driving the salary engine into a
// shape today's figures never produce: take-home that falls for a stretch as
// gross rises. Shared, so the engine, the flip logic and the flip panel are
// all tested against the same curve and the same figures.

/**
 * A taper so steep — £2 of allowance lost per £1 over £100,000 — that at 45%
 * each extra £1 of gross costs £1.37 in tax and NI. Take-home rises to
 * £58,656.50 at £100,000, falls to £56,331.05 at £106,285 where the allowance
 * runs out, then rises again. That is the shape a large relief-at-source
 * pension makes in the real £100k taper band, so any take-home between those
 * two figures comes from three different salaries.
 */
export const STEEP_TAPER_TAX_YEAR: TaxYear = {
  id: 'test-steep-taper',
  label: 'steep taper (test only)',
  personalAllowance: 12570,
  taperThreshold: 100000,
  taperRate: 2,
  incomeTaxBands: [{ upTo: Infinity, rate: 0.45 }],
  niBands: [{ upTo: Infinity, rate: 0.02 }],
  medianFullTimeSalary: 30000,
  ...DEDUCTION_TERMS_FOR_TESTS,
}

/**
 * The real 2026/27 shape, but with a 62% higher rate. Inside the £100k taper
 * each extra £1 of gross then costs 93p of tax and 2p of NI, keeping just 5p.
 * Take-home still rises everywhere, so the inversion is unaffected: this is
 * for the taper note, which only quotes "£X of salary per £1" while at least
 * 10p of each extra £1 is kept.
 */
export const FIVE_PENCE_TAPER_TAX_YEAR: TaxYear = {
  id: 'test-five-pence-taper',
  label: 'five-pence taper (test only)',
  personalAllowance: 12570,
  taperThreshold: 100000,
  taperRate: 0.5,
  incomeTaxBands: [
    { upTo: 37700, rate: 0.2 },
    { upTo: 125140, rate: 0.62 },
    { upTo: Infinity, rate: 0.45 },
  ],
  niBands: [
    { upTo: 12570, rate: 0 },
    { upTo: 50270, rate: 0.08 },
    { upTo: Infinity, rate: 0.02 },
  ],
  medianFullTimeSalary: 37430,
  ...DEDUCTION_TERMS_FOR_TESTS,
}
