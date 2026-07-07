import { describe, it, expect } from 'vitest'
import { buildShareParams, hydrateStateFromUrl } from './urlState'
import { DEFAULT_STATE } from '../state/defaults'

describe('hydrateStateFromUrl', () => {
  it('returns the defaults untouched when neither goalId nor itemPrice is present', () => {
    expect(hydrateStateFromUrl('')).toEqual(DEFAULT_STATE)
    expect(hydrateStateFromUrl('?mode=monthly&takeHome=2000')).toEqual(DEFAULT_STATE)
  })

  it('hydrates every shared field when itemPrice is present', () => {
    const search =
      '?goalId=big&mode=monthly&saveFlavor=goal&itemName=New+sofa&itemPrice=1200&takeHome=2000' +
      '&housing=500&utilities=100&groceries=300&transport=150&debts=50&savings=200' +
      '&rate=40&growth=5&goalMonths=18&term=24&coverMonths=9'

    const state = hydrateStateFromUrl(search)

    expect(state.goalId).toBe('big')
    expect(state.mode).toBe('monthly')
    expect(state.saveFlavor).toBe('goal')
    expect(state.itemName).toBe('New sofa')
    expect(state.itemPrice).toBe('1200')
    expect(state.takeHome).toBe('2000')
    expect(state.housing).toBe('500')
    expect(state.utilities).toBe('100')
    expect(state.groceries).toBe('300')
    expect(state.transport).toBe('150')
    expect(state.debts).toBe('50')
    expect(state.savings).toBe('200')
    expect(state.rate).toBe(40)
    expect(state.growth).toBe(5)
    expect(state.goalMonths).toBe(18)
    expect(state.term).toBe(24)
    expect(state.coverMonths).toBe(9)
  })

  it('hydrates a price-less emergency-fund link off goalId alone', () => {
    const state = hydrateStateFromUrl('?goalId=emergency&takeHome=2500&coverMonths=6')
    expect(state.goalId).toBe('emergency')
    expect(state.takeHome).toBe('2500')
    expect(state.coverMonths).toBe(6)
  })

  it('derives the carousel index from the shared goal', () => {
    // 'emergency' is the 3rd goal in carousel order (index 2).
    expect(hydrateStateFromUrl('?goalId=emergency&takeHome=2500').carouselIndex).toBe(2)
    // A bare itemPrice link with no goal keeps the default focus.
    expect(hydrateStateFromUrl('?itemPrice=500').carouselIndex).toBe(DEFAULT_STATE.carouselIndex)
  })

  it('ignores an unknown goalId rather than trusting the query string', () => {
    const state = hydrateStateFromUrl('?goalId=not-a-goal&itemPrice=500')
    expect(state.goalId).toBe(DEFAULT_STATE.goalId)
    expect(state.carouselIndex).toBe(DEFAULT_STATE.carouselIndex)
  })

  it('falls back to defaults for an invalid mode or saveFlavor rather than trusting the query string', () => {
    const state = hydrateStateFromUrl('?itemPrice=500&mode=not-a-mode&saveFlavor=not-a-flavor')
    expect(state.mode).toBe(DEFAULT_STATE.mode)
    expect(state.saveFlavor).toBe(DEFAULT_STATE.saveFlavor)
  })

  it('falls back to default numbers for non-numeric values', () => {
    const state = hydrateStateFromUrl('?itemPrice=500&rate=not-a-number&term=also-not-a-number')
    expect(state.rate).toBe(DEFAULT_STATE.rate)
    expect(state.term).toBe(DEFAULT_STATE.term)
  })

  it('clamps out-of-range numbers to the UI bounds rather than trusting the query string', () => {
    const state = hydrateStateFromUrl('?itemPrice=500&rate=250&growth=-4&goalMonths=0&term=999&coverMonths=50&vehicleAge=99')
    expect(state.rate).toBe(100)
    expect(state.growth).toBe(0)
    expect(state.goalMonths).toBe(1)
    expect(state.term).toBe(84) // the vehicle bank-loan slider's max
    expect(state.coverMonths).toBe(12)
    expect(state.vehicleAge).toBe(30)
  })

  it('falls back to default enums for an invalid vehicle method or balloon mode', () => {
    const state = hydrateStateFromUrl('?itemPrice=500&vehicleMethod=lease&balloonMode=magic')
    expect(state.vehicleMethod).toBe(DEFAULT_STATE.vehicleMethod)
    expect(state.balloonMode).toBe(DEFAULT_STATE.balloonMode)
  })

  it('leaves fields missing from the query string at their defaults', () => {
    const state = hydrateStateFromUrl('?itemPrice=500')
    expect(state.itemPrice).toBe('500')
    expect(state.takeHome).toBe(DEFAULT_STATE.takeHome)
    expect(state.rate).toBe(DEFAULT_STATE.rate)
  })
})

describe('buildShareParams', () => {
  it('round-trips a full state back through hydrateStateFromUrl', () => {
    const shared = {
      ...DEFAULT_STATE,
      goalId: 'big',
      carouselIndex: 4,
      mode: 'monthly',
      saveFlavor: 'goal',
      rateMode: 'amount',
      itemName: 'New kitchen',
      itemPrice: '18000',
      takeHome: '2600',
      housing: '800',
      savings: '3000',
      monthlyAmount: '450',
      rate: 30,
      growth: 7.9,
      goalMonths: 24,
      term: 60,
      coverMonths: 4,
    } satisfies typeof DEFAULT_STATE

    const params = buildShareParams(shared)
    const restored = hydrateStateFromUrl(`?${params.toString()}`)

    // Every shared field survives the round-trip; carouselIndex is re-derived
    // from goalId (big -> index 4) rather than serialised.
    expect(restored.goalId).toBe('big')
    expect(restored.carouselIndex).toBe(4)
    expect(restored.mode).toBe('monthly')
    expect(restored.saveFlavor).toBe('goal')
    expect(restored.rateMode).toBe('amount')
    expect(restored.itemName).toBe('New kitchen')
    expect(restored.itemPrice).toBe('18000')
    expect(restored.savings).toBe('3000')
    expect(restored.monthlyAmount).toBe('450')
    expect(restored.growth).toBe(7.9)
    expect(restored.term).toBe(60)
    expect(restored.coverMonths).toBe(4)
  })

  it('omits goalId when no goal has been chosen', () => {
    const params = buildShareParams(DEFAULT_STATE)
    expect(params.has('goalId')).toBe(false)
  })

  it('ignores a link to a "Soon" goal so its disabled flow cannot be reopened', () => {
    // A share link to the not-yet-built Mortgage calculator.
    const restored = hydrateStateFromUrl('?goalId=mortgage&itemPrice=18000')
    expect(restored.goalId).toBeNull()
  })

  it('round-trips a full vehicle-flow state', () => {
    const shared = {
      ...DEFAULT_STATE,
      goalId: 'car',
      itemName: 'VW Golf',
      itemPrice: '22000',
      takeHome: '2600',
      savings: '3000',
      vehicleMethod: 'pcp',
      balloonMode: 'known',
      balloonAmount: '9500',
      vehicleAge: 2,
      vehicleMileage: '18000',
      annualMiles: '10000',
      mpg: '48',
      fuelPencePerLitre: '145',
      maintenanceMonthly: '35',
      insuranceAnnual: '720',
      taxAnnual: '195',
      term: 48,
      growth: 8.9,
    } satisfies typeof DEFAULT_STATE

    const restored = hydrateStateFromUrl(`?${buildShareParams(shared).toString()}`)

    expect(restored.goalId).toBe('car')
    expect(restored.carouselIndex).toBe(0) // car sits first in the carousel
    expect(restored.vehicleMethod).toBe('pcp')
    expect(restored.balloonMode).toBe('known')
    expect(restored.balloonAmount).toBe('9500')
    expect(restored.vehicleAge).toBe(2)
    expect(restored.vehicleMileage).toBe('18000')
    expect(restored.annualMiles).toBe('10000')
    expect(restored.mpg).toBe('48')
    expect(restored.fuelPencePerLitre).toBe('145')
    expect(restored.maintenanceMonthly).toBe('35')
    expect(restored.insuranceAnnual).toBe('720')
    expect(restored.taxAnnual).toBe('195')
    expect(restored.term).toBe(48)
    expect(restored.growth).toBe(8.9)
  })
})
