import { describe, it, expect } from 'vitest'
import { CURRENT_TAX_YEAR, TAX_YEAR_2026_27, type TaxBand, type TaxYear } from './taxYears'

// These tests are about the *data*, not the calculation. lib/salary.ts and
// lib/reverse.ts already test their arithmetic against whatever this table
// currently holds, which means a typo'd boundary, a mis-ordered band or a
// swapped rate slipped in during the annual April refresh would sail through
// them. So assert the structural invariants the salary engine relies on
// instead: bands ascend, the top band is open-ended, and the 45% boundary
// still ties out to the taper arithmetic the file's own comments describe.

const ascending = (values: readonly number[]) => values.toSorted((a, b) => a - b)

/** A rate the engine can meaningfully apply: a finite fraction, not a percentage and not negative. */
const isPlausibleRate = (band: TaxBand) => Number.isFinite(band.rate) && band.rate >= 0 && band.rate <= 1

const BAND_TABLES: readonly [name: string, bands: readonly TaxBand[]][] = [
  ['incomeTaxBands', CURRENT_TAX_YEAR.incomeTaxBands],
  ['niBands', CURRENT_TAX_YEAR.niBands],
]

describe.each(BAND_TABLES)('CURRENT_TAX_YEAR.%s', (_name, bands) => {
  it('is a non-empty table of plausible rates', () => {
    expect(bands.length).toBeGreaterThan(0)
    // Filter rather than assert-in-a-loop so a failure names the bad band.
    expect(bands.filter((band) => !isPlausibleRate(band))).toEqual([])
  })

  it('has strictly ascending upper bounds', () => {
    // The engine consumes income band by band in declaration order, so an
    // equal or descending bound silently makes a band unreachable.
    const bounds = bands.map((band) => band.upTo)
    expect(bounds).toEqual(ascending(bounds))
    expect(new Set(bounds).size).toBe(bounds.length)
  })

  it('is open-ended in its final band only', () => {
    // Without a trailing `Infinity` band, income above the last finite bound
    // would go completely uncharged; a mid-table `Infinity` would make every
    // band after it dead code.
    const bounds = bands.map((band) => band.upTo)
    expect(bounds.at(-1)).toBe(Infinity)
    expect(bounds.slice(0, -1).filter((bound) => !Number.isFinite(bound))).toEqual([])
  })
})

describe('CURRENT_TAX_YEAR', () => {
  it('points at the tax-year table it claims to', () => {
    // Guards a future multi-year lookup being wired up to the wrong entry:
    // the id/label the UI prints must belong to the table being applied.
    expect(CURRENT_TAX_YEAR).toBe(TAX_YEAR_2026_27)
    expect(CURRENT_TAX_YEAR.id).toBe('2026-27')
    expect(CURRENT_TAX_YEAR.label).toBe('2026/27')
  })

  it('gives every numeric parameter a positive, finite value', () => {
    // Catches an accidental 0 / NaN / negative edit, each of which would
    // quietly corrupt every gross↔net conversion rather than throwing.
    const numericFields: (keyof Pick<TaxYear, 'personalAllowance' | 'taperThreshold' | 'taperRate' | 'medianFullTimeSalary'>)[] = [
      'personalAllowance',
      'taperThreshold',
      'taperRate',
      'medianFullTimeSalary',
    ]
    const invalid = numericFields.filter((field) => !(Number.isFinite(CURRENT_TAX_YEAR[field]) && CURRENT_TAX_YEAR[field] > 0))
    expect(invalid).toEqual([])

    // The taper removes allowance at £1 per £2, so a rate above 1 (the
    // percentage 50 typed instead of the fraction 0.5) is always a mistake.
    expect(CURRENT_TAX_YEAR.taperRate).toBeLessThanOrEqual(1)
  })

  it('exempts income below the personal allowance from NI', () => {
    // The first NI band is the primary threshold — zero-rated, and aligned
    // with the personal allowance for 2026/27 per the file's header comment.
    const [firstBand] = CURRENT_TAX_YEAR.niBands
    expect(firstBand.rate).toBe(0)
    expect(firstBand.upTo).toBe(CURRENT_TAX_YEAR.personalAllowance)
  })

  it('starts the highest income-tax band exactly where the allowance is fully tapered', () => {
    // £1 of allowance lost per £2 over the threshold, so the allowance is
    // gone at threshold + allowance / rate = £125,140 — the documented point
    // at which the additional rate begins. Deriving it rather than hardcoding
    // it means editing the taper without moving the band (or vice versa)
    // fails here instead of silently mis-taxing high earners.
    const allowanceFullyTaperedAt = CURRENT_TAX_YEAR.taperThreshold + CURRENT_TAX_YEAR.personalAllowance / CURRENT_TAX_YEAR.taperRate
    expect(allowanceFullyTaperedAt).toBe(125140)
    expect(CURRENT_TAX_YEAR.incomeTaxBands.at(-2)?.upTo).toBe(allowanceFullyTaperedAt)
  })

  it('charges a higher marginal rate in each successive income-tax band', () => {
    // UK income tax rises band by band, so a dip here is a swapped or mistyped
    // rate from the April refresh. (Not something the reverse solver needs: its
    // bisection only needs take-home to keep rising with gross, which NI's
    // 8% → 2% step shows doesn't require rising rates.)
    const rates = CURRENT_TAX_YEAR.incomeTaxBands.map((band) => band.rate)
    expect(rates).toEqual(ascending(rates))
    expect(new Set(rates).size).toBe(rates.length)
  })
})
