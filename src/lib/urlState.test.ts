import { describe, it, expect } from 'vitest'
import { buildShareParams, hydrateStateFromUrl, startOverUrl, STRING_FIELDS } from './urlState'
import { DEFAULT_STATE } from '../state/defaults'
import { ITEM_NAME_MAX_LENGTH } from './fields'
import { TERM_RANGES } from './vehicle'

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
    expect(state.term).toBe(60) // no vehicle goal in the link -> the standard sliders' max
    expect(state.coverMonths).toBe(12)
    expect(state.vehicleAge).toBe(30)
  })

  it('allows terms up to 84 months only for vehicle links — the bank-loan slider is the only UI that goes there', () => {
    expect(hydrateStateFromUrl('?goalId=car&vehicleMethod=loan&itemPrice=15000&term=84').term).toBe(84)
    expect(hydrateStateFromUrl('?goalId=big&itemPrice=15000&term=84').term).toBe(60)
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

describe('hydrateStateFromUrl — untrusted string fields', () => {
  // The money fields were previously copied out of the query string verbatim,
  // so a link could hold a value the inputs themselves refuse. The nastiest is
  // a negative: MoneyInput clamps those to "0" precisely so the figure on
  // screen can't disagree with the one num() feeds the maths, and a link
  // bypassing that re-opened the divergence #30 closed.

  // Every shared string field except the free-text title holds a money figure.
  const MONEY_FIELDS = STRING_FIELDS.filter((field) => field !== 'itemName')

  it('covers every money field in STRING_FIELDS', () => {
    // Guards the loops below against silently passing on an empty list, and
    // against itemName being dropped from the shared set.
    expect(MONEY_FIELDS.length).toBe(STRING_FIELDS.length - 1)
    expect(MONEY_FIELDS.length).toBeGreaterThan(10)
    expect(STRING_FIELDS).toContain('itemName')
  })

  // Driven off STRING_FIELDS itself, so a newly shared field is covered here
  // the moment it is added rather than quietly skipped.
  const INVALID = ['-500', '-0.01', '-0', 'abc', '', '   ', 'NaN', 'Infinity', '1e999', '+500', '0x1F4', '500.']

  for (const bad of INVALID) {
    it(`falls back to the default for every money field given ${JSON.stringify(bad)}`, () => {
      // Collected rather than asserted in the loop so a failure names the fields.
      const trusted = MONEY_FIELDS.filter(
        (field) => hydrateStateFromUrl(`?goalId=big&${field}=${encodeURIComponent(bad)}`)[field] !== DEFAULT_STATE[field],
      )
      expect(trusted).toEqual([])
    })
  }

  const VALID = ['0', '1200', '1200.50', '.5', '1e308']

  for (const good of VALID) {
    it(`preserves ${JSON.stringify(good)} unchanged for every money field`, () => {
      const mangled = MONEY_FIELDS.filter(
        (field) => hydrateStateFromUrl(`?goalId=big&${field}=${encodeURIComponent(good)}`)[field] !== good,
      )
      expect(mangled).toEqual([])
    })
  }

  it('shows £0 rather than a negative price, so the field and the maths agree', () => {
    // The headline case from the issue.
    const state = hydrateStateFromUrl('?goalId=big&itemPrice=-500&takeHome=2500')
    expect(state.itemPrice).toBe(DEFAULT_STATE.itemPrice)
    expect(state.takeHome).toBe('2500')
  })

  it('trims surrounding whitespace off an otherwise valid figure', () => {
    // A number input cannot display " 1200 " — the browser blanks it — which
    // would re-create the very display/maths divergence this closes.
    expect(hydrateStateFromUrl('?goalId=big&itemPrice=%201200%20').itemPrice).toBe('1200')
  })

  it('caps an over-long itemName and leaves a normal one alone', () => {
    const long = 'x'.repeat(ITEM_NAME_MAX_LENGTH + 50)
    expect(hydrateStateFromUrl(`?goalId=big&itemName=${long}`).itemName).toHaveLength(ITEM_NAME_MAX_LENGTH)

    const exact = 'y'.repeat(ITEM_NAME_MAX_LENGTH)
    expect(hydrateStateFromUrl(`?goalId=big&itemName=${exact}`).itemName).toBe(exact)

    expect(hydrateStateFromUrl('?goalId=big&itemName=').itemName).toBe('')
    expect(hydrateStateFromUrl('?goalId=big&itemName=New+sofa').itemName).toBe('New sofa')
  })

  it('leaves a money field absent from the link at its default', () => {
    // Absent and invalid both land on the default, but for different reasons —
    // this pins that an absent field never goes through the sanitiser.
    const state = hydrateStateFromUrl('?goalId=big&itemPrice=500')
    expect(state.housing).toBe(DEFAULT_STATE.housing)
    expect(state.itemName).toBe(DEFAULT_STATE.itemName)
  })

  it('still round-trips a state whose money fields are legitimately blank', () => {
    // DEFAULT_STATE leaves itemPrice/takeHome/grossSalary as '', which
    // buildShareParams writes as empty params. Those must come back as '' and
    // not be mistaken for tampering.
    const shared = { ...DEFAULT_STATE, goalId: 'emergency', takeHome: '2500' } satisfies typeof DEFAULT_STATE
    const restored = hydrateStateFromUrl(`?${buildShareParams(shared).toString()}`)
    // carouselIndex is re-derived from goalId by design rather than shared
    // ('emergency' is 3rd in carousel order), so it is the one expected change.
    expect(restored).toEqual({ ...shared, carouselIndex: 2 })
  })
})

describe('hydrateStateFromUrl — vehicle finance term', () => {
  // The term slider in VehiclePurchaseStep only ever offers TERM_RANGES[method],
  // and `chooseMethod` re-clamps on every method switch, so the app itself can't
  // produce an out-of-range pairing. A hand-edited (or stale) link can, and
  // `deriveVehicleResult` would quote that deal — hence the clamp on hydration.
  // Every expectation below reads the real TERM_RANGES rather than hard-coding
  // bounds, so changing a range updates the tests with it.

  it('clamps a term above the method maximum down to it', () => {
    expect(hydrateStateFromUrl('?goalId=car&vehicleMethod=pcp&term=84').term).toBe(TERM_RANGES.pcp.max)
    expect(hydrateStateFromUrl('?goalId=car&vehicleMethod=hp&term=84').term).toBe(TERM_RANGES.hp.max)
  })

  it('clamps a term below the method minimum up to it', () => {
    expect(hydrateStateFromUrl('?goalId=car&vehicleMethod=hp&term=3').term).toBe(TERM_RANGES.hp.min)
    expect(hydrateStateFromUrl('?goalId=car&vehicleMethod=pcp&term=1').term).toBe(TERM_RANGES.pcp.min)
    expect(hydrateStateFromUrl('?goalId=car&vehicleMethod=loan&term=6').term).toBe(TERM_RANGES.loan.min)
  })

  it('leaves a term already inside its method range untouched', () => {
    expect(hydrateStateFromUrl('?goalId=car&vehicleMethod=loan&term=72').term).toBe(72)
    expect(hydrateStateFromUrl('?goalId=car&vehicleMethod=pcp&term=36').term).toBe(36)
  })

  it("keeps each method range's own endpoints", () => {
    for (const method of ['pcp', 'hp', 'loan'] as const) {
      const { min, max } = TERM_RANGES[method]
      expect(hydrateStateFromUrl(`?goalId=car&vehicleMethod=${method}&term=${min}`).term).toBe(min)
      expect(hydrateStateFromUrl(`?goalId=car&vehicleMethod=${method}&term=${max}`).term).toBe(max)
    }
  })

  it("leaves a cash link's term as read — cash has no term range", () => {
    // 84 is the generic NUMBER_FIELDS ceiling, which still applies.
    expect(hydrateStateFromUrl('?goalId=car&vehicleMethod=cash&term=84').term).toBe(84)
    expect(hydrateStateFromUrl('?goalId=car&vehicleMethod=cash&term=3').term).toBe(3)
  })

  it('still caps non-vehicle links at 60 whatever vehicleMethod says', () => {
    // A vehicleMethod param on a non-vehicle link must not unlock the wider range.
    expect(hydrateStateFromUrl('?goalId=big&vehicleMethod=loan&itemPrice=15000&term=84').term).toBe(60)
  })

  it('clamps against the hydrated method, not the default one', () => {
    // An invalid method falls back to the default (pcp), so the pcp range applies.
    expect(DEFAULT_STATE.vehicleMethod).toBe('pcp')
    expect(hydrateStateFromUrl('?goalId=car&vehicleMethod=lease&term=84').term).toBe(TERM_RANGES.pcp.max)
  })
})

describe('startOverUrl', () => {
  it('is the bare origin + pathname, dropping a shared link query string', () => {
    const sharedLink = new URL('https://example.co.uk/?goalId=car&itemPrice=9000&takeHome=2000')
    expect(startOverUrl(sharedLink)).toBe('https://example.co.uk/')
  })

  it('keeps the path of a non-root entry point', () => {
    expect(startOverUrl(new URL('https://example.co.uk/methodology/salary/?x=1#top'))).toBe('https://example.co.uk/methodology/salary/')
  })
})
