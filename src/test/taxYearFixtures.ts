import type { TaxYear } from '../lib/taxYears'

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
}
