import { describe, it, expect } from 'vitest'
import {
  netFromGross,
  grossFromNet,
  incomeTaxOn,
  nationalInsuranceOn,
  marginalNetRate,
  inAllowanceTaper,
  monthlyTakeHomeFromGross,
} from './salary'

// Golden figures hand-computed from the 2026/27 rest-of-UK rules in taxYears.ts
// (PA £12,570 tapering over £100k; tax 20/40/45 at £50,270/£125,140; NI 8/2 at
// £12,570/£50,270) and cross-checked against reputable salary calculators.
describe('netFromGross', () => {
  it('takes nothing below the personal allowance / NI threshold', () => {
    expect(netFromGross(12570)).toBeCloseTo(12570, 2)
    expect(netFromGross(10000)).toBeCloseTo(10000, 2)
  })

  it('matches known take-home figures across the bands', () => {
    // £30k: tax (17,430 × 20%) = 3,486; NI (17,430 × 8%) = 1,394.40.
    expect(netFromGross(30000)).toBeCloseTo(25119.6, 2)
    // £50k: tax (37,430 × 20%) = 7,486; NI (37,430 × 8%) = 2,994.40.
    expect(netFromGross(50000)).toBeCloseTo(39519.6, 2)
    // £100k: tax 27,432; NI 4,010.60.
    expect(netFromGross(100000)).toBeCloseTo(68557.4, 2)
    // £150k: tax 53,703; NI 5,010.60.
    expect(netFromGross(150000)).toBeCloseTo(91286.4, 2)
  })

  it('applies the £100k personal-allowance taper', () => {
    // £120k: allowance tapered to £2,570; tax 39,432; NI 4,410.60.
    expect(incomeTaxOn(120000)).toBeCloseTo(39432, 2)
    expect(nationalInsuranceOn(120000)).toBeCloseTo(4410.6, 2)
    expect(netFromGross(120000)).toBeCloseTo(76157.4, 2)
  })
})

describe('grossFromNet', () => {
  it('inverts netFromGross to within a penny across the bands', () => {
    for (const gross of [15000, 25000, 50270, 60000, 100000, 110000, 125140, 150000, 200000]) {
      expect(grossFromNet(netFromGross(gross))).toBeCloseTo(gross, 0)
    }
  })

  it('returns 0 for a non-positive take-home', () => {
    expect(grossFromNet(0)).toBe(0)
    expect(grossFromNet(-100)).toBe(0)
  })
})

describe('monthlyTakeHomeFromGross', () => {
  it('converts an annual gross salary to monthly take-home', () => {
    // £40k: tax £5,486 + NI £2,194.40 -> £32,319.60/yr -> £2,693.30/month.
    expect(monthlyTakeHomeFromGross(40000)).toBeCloseTo(2693.3, 2)
    expect(monthlyTakeHomeFromGross(50000)).toBeCloseTo(39519.6 / 12, 2)
  })

  it('is 0 for a non-positive salary', () => {
    expect(monthlyTakeHomeFromGross(0)).toBe(0)
    expect(monthlyTakeHomeFromGross(-5000)).toBe(0)
  })
})

describe('marginalNetRate & taper band', () => {
  it('keeps 72p in the basic band, 58p in the higher band, 38p in the £100k taper', () => {
    expect(marginalNetRate(30000)).toBeCloseTo(0.72, 6) // 1 − 20% − 8%
    expect(marginalNetRate(60000)).toBeCloseTo(0.58, 6) // 1 − 40% − 2%
    expect(marginalNetRate(110000)).toBeCloseTo(0.38, 6) // 1 − 60% (taper) − 2%
  })

  it('flags the £100k–£125,140 taper band', () => {
    expect(inAllowanceTaper(90000)).toBe(false)
    expect(inAllowanceTaper(110000)).toBe(true)
    expect(inAllowanceTaper(130000)).toBe(false)
  })
})
