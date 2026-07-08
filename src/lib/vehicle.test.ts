import { describe, it, expect } from 'vitest'
import {
  EXPENSIVE_CAR_PRICE_THRESHOLD,
  EXPENSIVE_CAR_SUPPLEMENT_ANNUAL,
  MAINTENANCE_PRESETS,
  TERM_RANGES,
  UK_AVERAGE_ANNUAL_MILES,
  deriveVehicleResult,
  estimateBalloon,
  expensiveCarSupplementApplies,
  financeRowLabel,
  fuelCostPerMonth,
  mileageFactor,
  pcpPayment,
  retentionAt,
  vehicleAgeAskedOnPurchase,
  vehicleRunningCosts,
} from './vehicle'
import { paymentForFinance } from './calculations'
import { DEFAULT_STATE } from '../state/defaults'
import type { CalculatorState } from '../state/types'

/** A car-flow state with all running costs zeroed, so finance-side tests see clean numbers. */
function makeCarState(overrides: Partial<CalculatorState>): CalculatorState {
  return {
    ...DEFAULT_STATE,
    goalId: 'car',
    mode: 'monthly',
    itemPrice: '12000',
    takeHome: '2000',
    savings: '0',
    annualMiles: '0',
    mpg: '0',
    fuelPencePerLitre: '0',
    maintenanceMonthly: '0',
    insuranceAnnual: '0',
    taxAnnual: '0',
    growth: 0,
    ...overrides,
  }
}

describe('retentionAt (the generic depreciation curve)', () => {
  it('anchors at 100% new, ~75% after year one and ~50% after three years', () => {
    expect(retentionAt(0)).toBe(1)
    expect(retentionAt(1)).toBeCloseTo(0.75, 5)
    // The widely quoted "a car loses around half its value in three years".
    expect(retentionAt(3)).toBeCloseTo(0.504, 3)
  })

  it('interpolates within the first year rather than cliff-dropping', () => {
    expect(retentionAt(0.5)).toBeCloseTo(0.875, 5)
  })

  it('strictly decreases with age and never goes negative', () => {
    for (let age = 0; age < 20; age++) {
      expect(retentionAt(age + 1)).toBeLessThan(retentionAt(age))
      expect(retentionAt(age + 1)).toBeGreaterThan(0)
    }
  })
})

describe('mileageFactor', () => {
  it('is neutral at average mileage, lower above it, higher below it', () => {
    expect(mileageFactor(0)).toBe(1)
    expect(mileageFactor(10000)).toBeCloseTo(0.96, 5)
    expect(mileageFactor(-10000)).toBeCloseTo(1.04, 5)
  })

  it('clamps extreme odometer readings so miles alone cannot wreck the estimate', () => {
    expect(mileageFactor(200000)).toBe(0.75)
    expect(mileageFactor(-100000)).toBe(1.15)
  })
})

describe('estimateBalloon', () => {
  const newCar = { price: 20000, ageYears: 0, currentMileage: 0, termMonths: 36, annualMiles: 8000 }

  it('projects a brand-new car at average mileage along the curve with the lender margin', () => {
    // 3-year retention 0.5043 x £20,000 x 0.9 margin = £9,077.
    expect(estimateBalloon(newCar)).toBe(9077)
  })

  it('treats a blank odometer as average-for-age (the ratio cancels the mileage adjustment)', () => {
    const used = { price: 10000, ageYears: 3, termMonths: 36, annualMiles: 8000 }
    expect(estimateBalloon({ ...used, currentMileage: 0 })).toBe(
      estimateBalloon({ ...used, currentMileage: 3 * UK_AVERAGE_ANNUAL_MILES }),
    )
  })

  it('falls back to the UK average when the annual mileage is unknown', () => {
    expect(estimateBalloon({ ...newCar, annualMiles: 0 })).toBe(
      estimateBalloon({ ...newCar, annualMiles: UK_AVERAGE_ANNUAL_MILES }),
    )
  })

  it('estimates less for a car that will rack up more miles', () => {
    expect(estimateBalloon({ ...newCar, annualMiles: 20000 })).toBeLessThan(estimateBalloon(newCar))
  })

  it('has a brand-new car keep less of its price over the term than a used one (it sheds the steep first-year drop)', () => {
    const shareOfPrice = (ageYears: number) =>
      estimateBalloon({ price: 10000, ageYears, currentMileage: 0, termMonths: 36, annualMiles: 8000 }) / 10000
    expect(shareOfPrice(0)).toBeLessThan(shareOfPrice(1))
    // Past year one the curve decays geometrically, so the share is steady.
    expect(shareOfPrice(5)).toBeCloseTo(shareOfPrice(1), 2)
  })

  it('never exceeds the price or drops below zero, and is zero without a price or term', () => {
    expect(estimateBalloon({ ...newCar, termMonths: 1 })).toBeLessThanOrEqual(20000)
    expect(estimateBalloon({ price: 500, ageYears: 15, currentMileage: 200000, termMonths: 48, annualMiles: 30000 })).toBeGreaterThanOrEqual(0)
    expect(estimateBalloon({ ...newCar, price: 0 })).toBe(0)
    expect(estimateBalloon({ ...newCar, termMonths: 0 })).toBe(0)
  })
})

describe('pcpPayment', () => {
  it('at 0% APR splits the depreciation gap evenly across the term', () => {
    expect(pcpPayment(10000, 4000, 36, 0)).toBeCloseTo((10000 - 4000) / 36, 6)
  })

  it('equals the standard loan payment when there is no balloon', () => {
    expect(pcpPayment(15000, 0, 48, 9.9)).toBeCloseTo(paymentForFinance(15000, 48, 9.9), 6)
  })

  it('leaves exactly the balloon outstanding after the final payment', () => {
    const principal = 20000
    const balloon = 8000
    const n = 48
    const apr = 9.9
    const payment = pcpPayment(principal, balloon, n, apr)
    const i = apr / 100 / 12
    let balance = principal
    for (let m = 0; m < n; m++) balance = balance * (1 + i) - payment
    expect(balance).toBeCloseTo(balloon, 4)
  })

  it('charges interest on the balloon too, so a PCP always costs more in interest than the same-size HP', () => {
    const pcpTotal = pcpPayment(20000, 8000, 48, 9.9) * 48 + 8000
    const hpTotal = paymentForFinance(20000, 48, 9.9) * 48
    expect(pcpTotal).toBeGreaterThan(hpTotal)
  })

  it('clamps a balloon above the principal and floors nonsense inputs', () => {
    expect(pcpPayment(10000, 99999, 36, 0)).toBe(0) // balloon capped at principal -> nothing left to repay
    expect(pcpPayment(0, 5000, 36, 9.9)).toBe(0)
    expect(pcpPayment(10000, -500, 36, 0)).toBeCloseTo(10000 / 36, 6) // negative balloon treated as none
  })
})

describe('fuelCostPerMonth', () => {
  it('converts miles, mpg and pence per litre into a monthly cost', () => {
    // 8,000 mi/yr at 40mpg = 16.67 gal/mo = 75.8 litres; at 140p -> ~£106.
    expect(fuelCostPerMonth(8000, 40, 140)).toBeCloseTo(106.08, 2)
  })

  it('scales linearly with mileage and price, inversely with mpg', () => {
    const base = fuelCostPerMonth(8000, 40, 140)
    expect(fuelCostPerMonth(16000, 40, 140)).toBeCloseTo(base * 2, 6)
    expect(fuelCostPerMonth(8000, 80, 140)).toBeCloseTo(base / 2, 6)
    expect(fuelCostPerMonth(8000, 40, 70)).toBeCloseTo(base / 2, 6)
  })

  it('returns 0 while any input is missing rather than dividing by zero', () => {
    expect(fuelCostPerMonth(0, 40, 140)).toBe(0)
    expect(fuelCostPerMonth(8000, 0, 140)).toBe(0)
    expect(fuelCostPerMonth(8000, 40, 0)).toBe(0)
  })
})

describe('expensiveCarSupplementApplies', () => {
  it('applies only to brand-new cars priced over the £40k threshold', () => {
    expect(expensiveCarSupplementApplies(45000, 0)).toBe(true)
    expect(expensiveCarSupplementApplies(EXPENSIVE_CAR_PRICE_THRESHOLD, 0)).toBe(false) // "over", not "at"
    expect(expensiveCarSupplementApplies(45000, 1)).toBe(false)
    expect(expensiveCarSupplementApplies(39999, 0)).toBe(false)
  })
})

describe('vehicleRunningCosts', () => {
  it('itemises fuel, maintenance, insurance and tax into a monthly total', () => {
    const costs = vehicleRunningCosts(
      makeCarState({
        annualMiles: '8000',
        mpg: '40',
        fuelPencePerLitre: '140',
        maintenanceMonthly: '60',
        insuranceAnnual: '600',
        taxAnnual: '195',
      }),
    )
    expect(costs.fuel).toBeCloseTo(106.08, 2)
    expect(costs.maintenance).toBe(60)
    expect(costs.insurance).toBe(50)
    expect(costs.tax).toBeCloseTo(195 / 12, 6)
    expect(costs.supplementMonthly).toBe(0)
    expect(costs.total).toBeCloseTo(106.08 + 60 + 50 + 16.25, 2)
  })

  it('adds the over-£40k supplement to tax for a brand-new expensive car', () => {
    const costs = vehicleRunningCosts(makeCarState({ itemPrice: '45000', vehicleAge: 0, taxAnnual: '195' }))
    expect(costs.supplementMonthly).toBeCloseTo(EXPENSIVE_CAR_SUPPLEMENT_ANNUAL / 12, 6)
    expect(costs.tax).toBeCloseTo((195 + EXPENSIVE_CAR_SUPPLEMENT_ANNUAL) / 12, 6)
  })
})

describe('deriveVehicleResult', () => {
  it('returns null until both the price and take-home pay are filled in', () => {
    expect(deriveVehicleResult(makeCarState({ itemPrice: '' }))).toBeNull()
    expect(deriveVehicleResult(makeCarState({ takeHome: '' }))).toBeNull()
    expect(deriveVehicleResult(makeCarState({ itemPrice: '0' }))).toBeNull()
  })

  describe('cash', () => {
    it('has no finance payment — the verdict is about running costs, and the price is due upfront', () => {
      const result = deriveVehicleResult(
        makeCarState({
          vehicleMethod: 'cash',
          itemPrice: '10000',
          savings: '2000',
          maintenanceMonthly: '60',
        }),
      )!
      expect(result.financeMonthly).toBe(0)
      expect(result.upfront).toBe(8000)
      expect(result.totalPayable).toBe(10000)
      expect(result.interestPaid).toBe(0)
      expect(result.balloon).toBeNull()
      expect(result.totalMonthly).toBe(60)
      expect(result.isAffordable).toBe(true)
      expect(result.chartBars).toHaveLength(0)
      expect(result.notes.join(' ')).toMatch(/emergency cushion/i)
    })
  })

  describe('hire purchase and personal loan', () => {
    it('amortises the balance after the deposit over the term', () => {
      const result = deriveVehicleResult(
        makeCarState({ vehicleMethod: 'hp', itemPrice: '12000', savings: '0', term: 48, growth: 0 }),
      )!
      expect(result.financeMonthly).toBeCloseTo(250, 6)
      expect(result.totalMonthly).toBeCloseTo(250, 6)
      expect(result.totalPayable).toBeCloseTo(12000, 6)
      expect(result.interestPaid).toBeCloseTo(0, 6)
      expect(result.balloon).toBeNull()
      expect(result.verdictText).toBe("Yes — it's within reach.")
    })

    it('treats a loan the same mathematically, with ownership-from-day-one copy', () => {
      const hp = deriveVehicleResult(makeCarState({ vehicleMethod: 'hp', term: 48, growth: 9.9 }))!
      const loan = deriveVehicleResult(makeCarState({ vehicleMethod: 'loan', term: 48, growth: 9.9 }))!
      expect(loan.financeMonthly).toBeCloseTo(hp.financeMonthly, 6)
      expect(loan.subheadline).toMatch(/own the car from day one/i)
      expect(hp.subheadline).toMatch(/yours after the final payment/i)
    })
  })

  describe('PCP', () => {
    it('uses the quoted balloon when known, and only the gap is repaid monthly', () => {
      const result = deriveVehicleResult(
        makeCarState({
          vehicleMethod: 'pcp',
          balloonMode: 'known',
          balloonAmount: '8000',
          itemPrice: '22000',
          savings: '2000',
          term: 48,
          growth: 0,
        }),
      )!
      expect(result.principal).toBe(20000)
      expect(result.balloon).toBe(8000)
      expect(result.balloonIsEstimate).toBe(false)
      expect(result.financeMonthly).toBeCloseTo((20000 - 8000) / 48, 6)
      // Keep-the-car figure: deposit + payments + balloon.
      expect(result.totalPayable).toBeCloseTo(22000, 6)
      expect(result.subheadline).toMatch(/final payment/i)
    })

    it('estimates the balloon from age and mileage when unknown, and says so in the notes', () => {
      const result = deriveVehicleResult(
        makeCarState({
          vehicleMethod: 'pcp',
          balloonMode: 'estimate',
          itemPrice: '20000',
          vehicleAge: 0,
          vehicleMileage: '0',
          annualMiles: '8000',
          term: 36,
          growth: 0,
        }),
      )!
      expect(result.balloonIsEstimate).toBe(true)
      expect(result.balloon).toBe(9077) // the estimateBalloon anchor case
      expect(result.notes.join(' ')).toMatch(/depreciation curve/i)
      expect(result.notes.join(' ')).toMatch(/GMFV/)
    })

    it('drops the keep-the-car sentence when a "known" balloon is left blank, instead of promising a £0 final payment', () => {
      const result = deriveVehicleResult(
        makeCarState({ vehicleMethod: 'pcp', balloonMode: 'known', balloonAmount: '', term: 48, growth: 0 }),
      )!
      expect(result.balloon).toBe(0)
      expect(result.subheadline).not.toMatch(/final payment/i)
    })

    it('caps a balloon above the amount financed and flags the cap', () => {
      const result = deriveVehicleResult(
        makeCarState({
          vehicleMethod: 'pcp',
          balloonMode: 'known',
          balloonAmount: '9000',
          itemPrice: '10000',
          savings: '4000',
          term: 36,
          growth: 0,
        }),
      )!
      expect(result.balloon).toBe(6000) // clamped to the £6,000 financed
      expect(result.financeMonthly).toBe(0)
      expect(result.notes.join(' ')).toMatch(/capped it at £6,000/)
    })

    it("charts the balance descending to the balloon — the bars top out below 100%", () => {
      const result = deriveVehicleResult(
        makeCarState({
          vehicleMethod: 'pcp',
          balloonMode: 'known',
          balloonAmount: '8000',
          itemPrice: '22000',
          savings: '2000',
          term: 24,
          growth: 0,
        }),
      )!
      expect(result.chartBars).toHaveLength(24)
      expect(result.hasOverflowMonths).toBe(false)
      // £500/mo repays £12,000 of the £20,000 financed: the last bar sits at 60%.
      expect(result.chartBars.at(-1)?.heightPct).toBe(60)
    })

    it('fully repays an HP chart by the end of the term, capping long terms at 24 bars', () => {
      const result = deriveVehicleResult(makeCarState({ vehicleMethod: 'hp', term: 48, growth: 0 }))!
      expect(result.chartBars).toHaveLength(24)
      expect(result.hasOverflowMonths).toBe(true)
      expect(result.chartEndLabel).toMatch(/\+$/)
      const shortTerm = deriveVehicleResult(makeCarState({ vehicleMethod: 'hp', term: 24, growth: 0 }))!
      expect(shortTerm.chartBars.at(-1)?.heightPct).toBe(100)
    })
  })

  describe('verdict', () => {
    it('judges the total monthly cost (finance + running) against spare cash', () => {
      const result = deriveVehicleResult(
        makeCarState({
          vehicleMethod: 'hp',
          itemPrice: '12000',
          term: 48,
          growth: 0, // £250/mo
          takeHome: '2000',
          housing: '1500', // spare cash £500
          maintenanceMonthly: '60',
          insuranceAnnual: '600', // +£50
          taxAnnual: '0',
        }),
      )!
      expect(result.totalMonthly).toBeCloseTo(360, 6)
      expect(result.isAffordable).toBe(true)
      // 360/500 = 72% of spare cash -> the "tight" band.
      expect(result.verdictSub).toMatch(/tight/i)
    })

    it("says no when the total monthly cost exceeds spare cash", () => {
      const result = deriveVehicleResult(
        makeCarState({
          vehicleMethod: 'hp',
          itemPrice: '30000',
          term: 36,
          growth: 0, // £833/mo
          takeHome: '2000',
          housing: '1500', // spare cash £500
        }),
      )!
      expect(result.isAffordable).toBe(false)
      expect(result.verdictText).toBe("No — that's a stretch.")
      expect(result.verdictSub).toMatch(/more than your spare cash/i)
    })

    it('flags the over-£40k supplement in the notes when it applies', () => {
      const result = deriveVehicleResult(
        makeCarState({ vehicleMethod: 'cash', itemPrice: '45000', vehicleAge: 0, taxAnnual: '195' }),
      )!
      expect(result.supplementApplies).toBe(true)
      expect(result.notes.join(' ')).toContain(`£${EXPENSIVE_CAR_SUPPLEMENT_ANNUAL}/year supplement`)
    })
  })
})

describe('vehicleAgeAskedOnPurchase', () => {
  it('is true only for the PCP balloon-estimate path — the one place the purchase step needs the age', () => {
    expect(vehicleAgeAskedOnPurchase({ vehicleMethod: 'pcp', balloonMode: 'estimate' })).toBe(true)
    expect(vehicleAgeAskedOnPurchase({ vehicleMethod: 'pcp', balloonMode: 'known' })).toBe(false)
    expect(vehicleAgeAskedOnPurchase({ vehicleMethod: 'cash', balloonMode: 'estimate' })).toBe(false)
    expect(vehicleAgeAskedOnPurchase({ vehicleMethod: 'hp', balloonMode: 'estimate' })).toBe(false)
    expect(vehicleAgeAskedOnPurchase({ vehicleMethod: 'loan', balloonMode: 'estimate' })).toBe(false)
  })
})

describe('config sanity', () => {
  it('offers three ascending maintenance presets', () => {
    expect(MAINTENANCE_PRESETS.map((p) => p.id)).toEqual(['budget', 'average', 'premium'])
    expect(MAINTENANCE_PRESETS[0].monthly).toBeLessThan(MAINTENANCE_PRESETS[1].monthly)
    expect(MAINTENANCE_PRESETS[1].monthly).toBeLessThan(MAINTENANCE_PRESETS[2].monthly)
  })

  it('bounds every finance term range sensibly', () => {
    for (const { min, max } of Object.values(TERM_RANGES)) {
      expect(min).toBeGreaterThanOrEqual(12)
      expect(max).toBeGreaterThan(min)
    }
    expect(TERM_RANGES.pcp.max).toBeLessThanOrEqual(TERM_RANGES.hp.max)
  })

  it('labels the finance breakdown row per method', () => {
    expect(financeRowLabel('pcp')).toBe('PCP payment')
    expect(financeRowLabel('hp')).toBe('Hire purchase payment')
    expect(financeRowLabel('loan')).toBe('Personal loan payment')
    expect(financeRowLabel('cash')).toBe('Finance')
  })
})
