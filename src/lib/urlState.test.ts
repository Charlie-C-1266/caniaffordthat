import { describe, it, expect } from 'vitest'
import { buildShareParams, hydrateStateFromUrl, startOverUrl, STRING_FIELDS } from './urlState'
import { DEFAULT_STATE } from '../state/defaults'
import { payProfileOf, takeHomeFor, OFFERED_PENSION_ARRANGEMENTS, STUDENT_LOAN_PLANS } from './payProfile'
import { monthlyTakeHomeFromGross } from './salary'
import { CURRENT_TAX_YEAR } from './taxYears'
import { ITEM_NAME_MAX_LENGTH } from './fields'
import { TERM_RANGES } from './vehicle'
import * as sliderRanges from './sliderRanges'
import {
  APR_RANGE,
  COVER_MONTHS_RANGE,
  FINANCE_TERM_RANGE,
  PENSION_PERCENT_RANGE,
  SAVE_RATE_RANGE,
  SAVINGS_INTEREST_RANGE,
  VEHICLE_AGE_RANGE,
  type SliderRange,
} from './sliderRanges'

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
    expect(state.vehicleAge).toBe(VEHICLE_AGE_RANGE.max) // the car-age slider's own max, with no headroom past it
  })

  it("holds growth to the slider the link's flow shows: savings interest when saving, APR when financing", () => {
    // Savings interest stops lower than the APR slider, and before the ranges
    // were shared a saving link could carry 25%, which its slider can't show.
    expect(hydrateStateFromUrl('?goalId=big&mode=save&itemPrice=900&growth=25').growth).toBe(SAVINGS_INTEREST_RANGE.max)
    expect(hydrateStateFromUrl('?goalId=emergency&mode=save&growth=25').growth).toBe(SAVINGS_INTEREST_RANGE.max)
    // Financing, the same 25% is a legitimate APR.
    expect(hydrateStateFromUrl('?goalId=big&mode=monthly&itemPrice=900&growth=25').growth).toBe(25)
    expect(hydrateStateFromUrl('?goalId=big&mode=monthly&itemPrice=900&growth=99').growth).toBe(APR_RANGE.max)
    // The vehicle flow is always financing, so a car link's growth is an APR
    // even if the link claims to be saving.
    expect(hydrateStateFromUrl('?goalId=car&mode=save&itemPrice=9000&vehicleMethod=hp&growth=25').growth).toBe(25)
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

/**
 * One row per slider a shared link can set: the query parameter, a link that
 * shows that slider, and the range in sliderRanges.ts it's held to. `growth`
 * appears twice because it drives two sliders, picked by the link's mode. The
 * vehicle flow's per-method terms have their own block further down.
 */
const SLIDER_LINKS = [
  { param: 'rate', range: SAVE_RATE_RANGE, link: '?goalId=big&mode=save&itemPrice=900' },
  { param: 'growth', range: SAVINGS_INTEREST_RANGE, link: '?goalId=big&mode=save&itemPrice=900' },
  { param: 'growth', range: APR_RANGE, link: '?goalId=big&mode=monthly&itemPrice=900' },
  { param: 'term', range: FINANCE_TERM_RANGE, link: '?goalId=big&mode=monthly&itemPrice=900' },
  { param: 'coverMonths', range: COVER_MONTHS_RANGE, link: '?goalId=emergency&mode=save' },
  { param: 'vehicleAge', range: VEHICLE_AGE_RANGE, link: '?goalId=car&itemPrice=9000' },
  { param: 'pensionPercent', range: PENSION_PERCENT_RANGE, link: '?goalId=big&mode=save&itemPrice=900' },
] as const satisfies readonly { param: keyof typeof DEFAULT_STATE; range: SliderRange; link: string }[]

/** Each row with the name its range is exported under, for the test titles. */
const SLIDER_ROWS = SLIDER_LINKS.map((row) => ({
  ...row,
  name: Object.entries(sliderRanges).find(([, range]) => range === row.range)?.[0] ?? 'an unexported range',
}))

describe("hydrateStateFromUrl — each slider's bounds", () => {
  // The clamps and the sliders read the same ranges, so a link can never load
  // a value its slider couldn't show. One step past an end is the closest a
  // hand-edited link can get to slipping through. For `growth` when saving and
  // for `term`, it lands inside the wider first clamp and is only caught by
  // the narrowing to the link's own slider.

  it('has a row for every range sliderRanges.ts exports, so a new slider is not left unchecked', () => {
    const unchecked = Object.entries(sliderRanges).filter(([, range]) => !SLIDER_LINKS.some((row) => row.range === range))
    expect(unchecked.map(([name]) => name)).toEqual([])
  })

  it.each(SLIDER_ROWS)('keeps $param at both ends of $name', ({ param, range, link }) => {
    const { min, max } = range
    expect(hydrateStateFromUrl(`${link}&${param}=${min}`)[param]).toBe(min)
    expect(hydrateStateFromUrl(`${link}&${param}=${max}`)[param]).toBe(max)
  })

  it.each(SLIDER_ROWS)('pulls $param one step past either end of $name back to that end', ({ param, range, link }) => {
    const { min, max, step } = range
    expect(hydrateStateFromUrl(`${link}&${param}=${min - step}`)[param]).toBe(min)
    expect(hydrateStateFromUrl(`${link}&${param}=${max + step}`)[param]).toBe(max)
  })

  it.each(SLIDER_ROWS)('falls back to the default $param, inside $name, for a value that is not a number', ({ param, range, link }) => {
    const { min, max } = range
    const fallback = DEFAULT_STATE[param]
    expect(fallback).toBeGreaterThanOrEqual(min)
    expect(fallback).toBeLessThanOrEqual(max)
    expect(hydrateStateFromUrl(`${link}&${param}=lots`)[param]).toBe(fallback)
  })
})

/**
 * One row per NUMBER_FIELDS key: the grid a hydrated value has to land on, and
 * a link whose goal and mode make that the active control. `goalMonths` has no
 * slider and no ceiling — the goal-date field produces it — but the UI can only
 * ever hand it a whole number of months, so it is on a grid too.
 */
const SNAP_GRIDS = [
  { param: 'rate', grid: SAVE_RATE_RANGE, link: '?goalId=big&mode=save&itemPrice=900' },
  { param: 'growth', grid: APR_RANGE, link: '?goalId=big&mode=monthly&itemPrice=900' },
  { param: 'goalMonths', grid: { min: 1, max: Infinity, step: 1 }, link: '?goalId=big&mode=save&saveFlavor=goal&itemPrice=900' },
  { param: 'term', grid: FINANCE_TERM_RANGE, link: '?goalId=big&mode=monthly&itemPrice=900' },
  { param: 'coverMonths', grid: COVER_MONTHS_RANGE, link: '?goalId=emergency&mode=save' },
  { param: 'vehicleAge', grid: VEHICLE_AGE_RANGE, link: '?goalId=car&itemPrice=9000' },
  { param: 'pensionPercent', grid: PENSION_PERCENT_RANGE, link: '?goalId=big&mode=save&itemPrice=900' },
] as const satisfies readonly { param: keyof typeof DEFAULT_STATE; grid: SliderRange; link: string }[]

/** True when `value` sits a whole number of `step`s above `min`, allowing for floating-point slack. */
function isOnStep(value: number, { min, step }: Pick<SliderRange, 'min' | 'step'>): boolean {
  const steps = (value - min) / step
  return Math.abs(steps - Math.round(steps)) < 1e-9
}

describe("hydrateStateFromUrl — each slider's steps", () => {
  // #319: clamping alone let a link carry a value *between* the slider's
  // steps. The browser pins the thumb to the nearest step, so the control
  // showed 5% while the label beside it and the result's maths used
  // 5.1234567%, and a fractional `term` was fed into the payment maths as a
  // deal no lender offers. Same rule as #126/#127, one level finer: a shared
  // link must never carry a value the inputs themselves could not produce.

  it('gives every numeric shared field a row, so a new one is not left unchecked', () => {
    // Mirrors the SLIDER_LINKS completeness check above, from the other side.
    // `activeIndex` and `carouselIndex` are the two numbers in state that
    // deliberately don't round-trip: both are re-derived on load, so they
    // never arrive from a link and have no grid to be held to.
    const derivedOnLoad = new Set(['activeIndex', 'carouselIndex'])
    const shared = (Object.keys(DEFAULT_STATE) as (keyof typeof DEFAULT_STATE)[]).filter(
      (key) => typeof DEFAULT_STATE[key] === 'number' && !derivedOnLoad.has(key),
    )
    expect(shared.toSorted()).toEqual(SNAP_GRIDS.map((row) => row.param).toSorted())

    // And none of them is serialised as a string field, which would bypass the grid entirely.
    for (const key of shared) expect(STRING_FIELDS).not.toContain(key)
  })

  it.each(SNAP_GRIDS)('lands $param on its own grid and inside its bounds, whatever a link carries', ({ param, grid, link }) => {
    // A spread of off-step, out-of-range and awkward values in one sweep.
    for (const raw of ['0.3', '0.6', '1.1', '3.14159', '5.1234567', '12.5', '13.37', '49.9', '-5', '999', '1e-9', '5e0']) {
      const value = hydrateStateFromUrl(`${link}&${param}=${raw}`)[param]
      expect(value).toBeGreaterThanOrEqual(grid.min)
      expect(value).toBeLessThanOrEqual(grid.max)
      expect(isOnStep(value, grid)).toBe(true)
    }
  })

  it('rounds an off-step value to the nearest step, down or up', () => {
    const pension = '?goalId=big&mode=save&itemPrice=900&pensionPercent='
    expect(hydrateStateFromUrl(`${pension}5.1`).pensionPercent).toBe(5)
    expect(hydrateStateFromUrl(`${pension}5.4`).pensionPercent).toBe(5.5)
    expect(hydrateStateFromUrl('?goalId=big&mode=monthly&itemPrice=900&term=13.6').term).toBe(14)
    expect(hydrateStateFromUrl('?goalId=big&mode=monthly&itemPrice=900&term=13.37').term).toBe(13)
  })

  it('rounds an exact midpoint upward, away from zero', () => {
    // Math.round's own tie-break, kept rather than fought: 5.25 is equally far
    // from 5 and 5.5, and rounding up matches what `<input type=range>` does
    // when the same value is assigned to it.
    expect(hydrateStateFromUrl('?goalId=big&mode=save&itemPrice=900&pensionPercent=5.25').pensionPercent).toBe(5.5)
    expect(hydrateStateFromUrl('?goalId=big&mode=monthly&itemPrice=900&term=13.5').term).toBe(14)
  })

  it.each(SNAP_GRIDS)('leaves an already-on-step $param exactly as the link wrote it', ({ param, grid, link }) => {
    const onStep = Number((grid.min + 4 * grid.step).toFixed(2))
    expect(hydrateStateFromUrl(`${link}&${param}=${onStep}`)[param]).toBe(onStep)
  })

  it('keeps a value that rounds past an end inside the range', () => {
    const pension = '?goalId=big&mode=save&itemPrice=900&pensionPercent='
    // 49.9 is nearer 50 than 49.5, and 50 is the maximum — so it may round up to it, but no further.
    expect(hydrateStateFromUrl(`${pension}49.9`).pensionPercent).toBe(PENSION_PERCENT_RANGE.max)
    expect(hydrateStateFromUrl(`${pension}50.2`).pensionPercent).toBe(PENSION_PERCENT_RANGE.max)
    // 0.3 is below the 0.5 floor; clamping comes first, so it can only land on it.
    expect(hydrateStateFromUrl(`${pension}0.3`).pensionPercent).toBe(PENSION_PERCENT_RANGE.min)
    expect(hydrateStateFromUrl('?goalId=big&mode=monthly&itemPrice=900&term=0.6').term).toBe(FINANCE_TERM_RANGE.min)
  })

  it('snaps without leaving floating-point artefacts behind', () => {
    // `0.5 * 11` is 5.500000000000001 in binary floating point, which would
    // reach the caption and the result as such. toBe, not toBeCloseTo, is the
    // point of these assertions.
    expect(hydrateStateFromUrl('?goalId=big&mode=save&itemPrice=900&pensionPercent=5.4').pensionPercent).toBe(5.5)
    expect(hydrateStateFromUrl('?goalId=big&mode=save&itemPrice=900&pensionPercent=0.4').pensionPercent).toBe(0.5)
    expect(hydrateStateFromUrl('?goalId=big&mode=monthly&itemPrice=900&growth=10.3').growth).toBe(10.5)
    expect(hydrateStateFromUrl('?goalId=big&mode=monthly&itemPrice=900&growth=0.26').growth).toBe(0.5)
  })

  it('leaves the existing handling of unusable values untouched', () => {
    const link = '?goalId=big&mode=save&itemPrice=900&pensionPercent='
    // NaN and Infinity are not finite, so the field keeps its default — as before snapping.
    expect(hydrateStateFromUrl(`${link}NaN`).pensionPercent).toBe(DEFAULT_STATE.pensionPercent)
    expect(hydrateStateFromUrl(`${link}Infinity`).pensionPercent).toBe(DEFAULT_STATE.pensionPercent)
    expect(hydrateStateFromUrl(`${link}lots`).pensionPercent).toBe(DEFAULT_STATE.pensionPercent)
    // An empty value and a vanishingly small one both parse as a finite 0, so
    // they clamp to the floor rather than falling back. Snapping leaves the
    // floor where it was, so both answers are the same as before #319.
    expect(hydrateStateFromUrl(`${link}`).pensionPercent).toBe(PENSION_PERCENT_RANGE.min)
    expect(hydrateStateFromUrl(`${link}1e-9`).pensionPercent).toBe(PENSION_PERCENT_RANGE.min)
    // Scientific notation that names an on-step value is honoured as written.
    expect(hydrateStateFromUrl(`${link}5e0`).pensionPercent).toBe(5)
  })

  it('keeps a vehicle term on-step through the per-method re-clamp', () => {
    // The method's own TERM_RANGES narrowing runs after the snap, so this
    // proves the second clamp can't knock the value back off its step.
    for (const [raw, expected] of [
      ['13.37', 13],
      ['50.4', TERM_RANGES.pcp.max], // snaps to 50, then the PCP ceiling of 48
      ['11.6', TERM_RANGES.pcp.min], // snaps to 12, which is the PCP floor
      ['11.2', TERM_RANGES.pcp.min], // snaps to 11, which the floor lifts to 12
    ] as const) {
      const term = hydrateStateFromUrl(`?goalId=car&vehicleMethod=pcp&itemPrice=15000&term=${raw}`).term
      expect(term).toBe(expected)
      expect(isOnStep(term, FINANCE_TERM_RANGE)).toBe(true)
    }
  })

  // The other half of the rule: snapping must never touch a legitimate link.
  // Every value the sliders can actually produce has to survive a full
  // "Copy result link" round-trip byte for byte.
  it.each(SLIDER_ROWS)('never alters any on-step $param that $name can produce', ({ param, range, link }) => {
    const { min, max, step } = range
    for (let value = min; value <= max; value = Number((value + step).toFixed(4))) {
      // buildShareParams supplies the whole state exactly as "Copy result
      // link" would; the row's link overrides the goal and mode that make
      // this the active slider.
      const params = buildShareParams({ ...DEFAULT_STATE, [param]: value })
      for (const [key, carried] of new URLSearchParams(link.slice(1))) params.set(key, carried)
      expect(hydrateStateFromUrl(`?${params.toString()}`)[param]).toBe(value)
    }
  })

  it('never alters a whole number of goalMonths, which has no ceiling to be held to', () => {
    for (const months of [1, 2, 6, 12, 18, 24, 60, 120, 600]) {
      const params = buildShareParams({ ...DEFAULT_STATE, goalId: 'big', saveFlavor: 'goal', goalMonths: months })
      expect(hydrateStateFromUrl(`?${params.toString()}`).goalMonths).toBe(months)
    }
  })

  it('keeps savings growth on-step through the SAVINGS_INTEREST_RANGE re-clamp', () => {
    const link = '?goalId=big&mode=save&itemPrice=900&growth='
    expect(hydrateStateFromUrl(`${link}3.14159`).growth).toBe(3)
    expect(hydrateStateFromUrl(`${link}3.3`).growth).toBe(3.5)
    // Snaps to 25.5 on the wider APR grid, then the savings ceiling takes it to 20 — still on-step.
    const capped = hydrateStateFromUrl(`${link}25.3`).growth
    expect(capped).toBe(SAVINGS_INTEREST_RANGE.max)
    expect(isOnStep(capped, SAVINGS_INTEREST_RANGE)).toBe(true)
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
      // On-step for APR_RANGE: the slider moves in 0.5s, so an off-step
      // growth is a value this state could never have held (#319).
      growth: 7.5,
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
    expect(restored.growth).toBe(7.5)
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
      growth: 8.5, // on-step for APR_RANGE, as above
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
    expect(restored.growth).toBe(8.5)
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

describe('hydrateStateFromUrl — pay profile', () => {
  const LINK = '?goalId=big&mode=save&itemPrice=900'

  it('round-trips a student loan, a Postgraduate Loan and a pension', () => {
    const state = {
      ...DEFAULT_STATE,
      goalId: 'big' as const,
      itemPrice: '900',
      studentPlan: 'plan4' as const,
      postgradLoan: true,
      pensionArrangement: 'netpay' as const,
      pensionMode: 'amount' as const,
      pensionPercent: 7.5,
      pensionMonthlyAmount: '150',
    }
    const hydrated = hydrateStateFromUrl(`?${buildShareParams(state).toString()}`)
    expect(hydrated.studentPlan).toBe('plan4')
    expect(hydrated.postgradLoan).toBe(true)
    expect(hydrated.pensionArrangement).toBe('netpay')
    expect(hydrated.pensionMode).toBe('amount')
    expect(hydrated.pensionPercent).toBe(7.5)
    expect(hydrated.pensionMonthlyAmount).toBe('150')
  })

  it('leaves an older link without any of these on no loan and no pension', () => {
    const hydrated = hydrateStateFromUrl(LINK)
    expect(hydrated.studentPlan).toBe('none')
    expect(hydrated.postgradLoan).toBe(false)
    expect(hydrated.pensionArrangement).toBe('none')
  })

  it('ignores an unknown plan, arrangement or mode rather than trusting the query string', () => {
    const hydrated = hydrateStateFromUrl(`${LINK}&studentPlan=plan3&pensionArrangement=employer&pensionMode=lots`)
    expect(hydrated.studentPlan).toBe('none')
    expect(hydrated.pensionArrangement).toBe('none')
    expect(hydrated.pensionMode).toBe('percent')
  })

  it('does not switch on relief at source, which the Budget step does not offer yet', () => {
    expect(hydrateStateFromUrl(`${LINK}&pensionArrangement=ras`).pensionArrangement).toBe('none')
  })

  it("reads the Postgraduate Loan from '1' or '0' only", () => {
    expect(hydrateStateFromUrl(`${LINK}&postgradLoan=1`).postgradLoan).toBe(true)
    expect(hydrateStateFromUrl(`${LINK}&postgradLoan=0`).postgradLoan).toBe(false)
    expect(hydrateStateFromUrl(`${LINK}&postgradLoan=yes`).postgradLoan).toBe(false)
    expect(hydrateStateFromUrl(`${LINK}&postgradLoan=true`).postgradLoan).toBe(false)
  })
})

// #292: in salary mode `takeHome` is derived, never typed — BudgetStep
// recomputes it from the salary and the pay profile, and everything downstream
// reads only `takeHome`. A link was the one path that didn't: it copied
// `takeHome` as a plain money string, so a salary-mode link whose figure
// didn't match its salary and profile loaded inconsistent. The Budget step's
// payslip recomputed and showed one take-home while the verdict and result
// were worked out on another.
//
// Expected figures come from the engine rather than literals, so the April
// refresh of the loan thresholds updates both sides together.
/** A salary-mode link, with the pay-profile params the caller cares about. */
const salaryLink = (params: Record<string, string> = {}) =>
  '?' +
  new URLSearchParams({
    goalId: 'big',
    mode: 'save',
    saveFlavor: 'goal',
    itemPrice: '1200',
    takeHomeMode: 'salary',
    grossSalary: '35000',
    ...params,
  }).toString()

describe('hydrateStateFromUrl: salary-mode take-home is derived, not trusted', () => {
  it('replaces a mismatched takeHome with the derived figure', () => {
    // The issue's own URL: the link claims £2,393.30 while a £35,000 Plan 2
    // salary with a 5% net-pay pension takes home £2,234.52.
    const state = hydrateStateFromUrl(
      '?goalId=big&mode=save&saveFlavor=goal&itemPrice=1200&takeHomeMode=salary&grossSalary=35000&takeHome=2393.30' +
        '&studentPlan=plan2&postgradLoan=0&pensionArrangement=netpay&pensionMode=percent&pensionPercent=5',
    )

    expect(state.takeHome).toBe('2234.52')
    expect(state.takeHome).toBe(String(Math.round(monthlyTakeHomeFromGross(35000, CURRENT_TAX_YEAR, payProfileOf(state)) * 100) / 100))
  })

  it('derives it with no takeHome param at all', () => {
    const state = hydrateStateFromUrl(salaryLink({ studentPlan: 'plan2' }))

    expect(state.takeHome).not.toBe('')
    expect(state.takeHome).toBe(takeHomeFor('35000', payProfileOf(state)))
  })

  it.each(['none', ...STUDENT_LOAN_PLANS])('derives it with studentPlan=%s', (studentPlan) => {
    const state = hydrateStateFromUrl(salaryLink({ studentPlan, takeHome: '9999' }))

    expect(state.studentPlan).toBe(studentPlan)
    expect(state.takeHome).toBe(takeHomeFor('35000', payProfileOf(state)))
  })

  it('derives it with the postgraduate loan on, taking more than with it off', () => {
    const withLoan = hydrateStateFromUrl(salaryLink({ postgradLoan: '1', takeHome: '9999' }))
    const without = hydrateStateFromUrl(salaryLink({ postgradLoan: '0', takeHome: '9999' }))

    expect(withLoan.postgradLoan).toBe(true)
    expect(withLoan.takeHome).toBe(takeHomeFor('35000', payProfileOf(withLoan)))
    expect(Number(withLoan.takeHome)).toBeLessThan(Number(without.takeHome))
  })

  it.each(
    OFFERED_PENSION_ARRANGEMENTS.flatMap((pensionArrangement) =>
      (['percent', 'amount'] as const).map((pensionMode) => [pensionArrangement, pensionMode] as const),
    ),
  )('derives it for a %s pension given as %s', (pensionArrangement, pensionMode) => {
    const state = hydrateStateFromUrl(
      salaryLink({ pensionArrangement, pensionMode, pensionPercent: '5', pensionMonthlyAmount: '150', takeHome: '9999' }),
    )

    expect(state.pensionArrangement).toBe(pensionArrangement)
    expect(state.pensionMode).toBe(pensionMode)
    expect(state.takeHome).toBe(takeHomeFor('35000', payProfileOf(state)))
    // A pension was actually applied, so this isn't passing on a no-op profile.
    expect(Number(state.takeHome)).toBeLessThan(Number(hydrateStateFromUrl(salaryLink()).takeHome))
  })

  it.each([
    ['missing', undefined],
    ['empty', ''],
    ['zero', '0'],
    ['negative', '-5000'],
    ['junk', 'abc'],
    ['1e999', '1e999'],
  ])('leaves takeHome as read when grossSalary is %s', (_case, grossSalary) => {
    // The same thing the UI does with no salary typed: nothing is derived, so
    // whatever the link carried (held to isMoneyValue) stands.
    const params: Record<string, string> = { takeHome: '2000' }
    if (grossSalary !== undefined) params.grossSalary = grossSalary
    const search =
      '?' +
      new URLSearchParams({
        goalId: 'big',
        mode: 'save',
        saveFlavor: 'goal',
        itemPrice: '1200',
        takeHomeMode: 'salary',
        ...params,
      }).toString()

    const state = hydrateStateFromUrl(search)
    expect(state.takeHome).toBe('2000')
  })

  it('does not touch takeHome in take-home mode, even with a salary and profile present', () => {
    // There the typed figure is the authority; the salary is just remembered.
    const state = hydrateStateFromUrl(
      '?goalId=big&mode=save&saveFlavor=goal&itemPrice=1200&takeHomeMode=takehome&grossSalary=35000&takeHome=1234.56' +
        '&studentPlan=plan2&pensionArrangement=netpay&pensionMode=percent&pensionPercent=5',
    )

    expect(state.takeHomeMode).toBe('takehome')
    expect(state.takeHome).toBe('1234.56')
    expect(state.grossSalary).toBe('35000')
  })

  it('derives with no pension for a relief-at-source link, which is not offered yet', () => {
    const ras = hydrateStateFromUrl(
      salaryLink({ pensionArrangement: 'ras', pensionMode: 'percent', pensionPercent: '5', takeHome: '9999' }),
    )
    const none = hydrateStateFromUrl(salaryLink())

    // The arrangement falls back, so the derived figure must match a no-pension one.
    expect(ras.pensionArrangement).toBe('none')
    expect(ras.takeHome).toBe(none.takeHome)
    expect(ras.takeHome).toBe(takeHomeFor('35000', payProfileOf(ras)))
  })

  it('floors the derived take-home at zero when the pension takes more than the pay', () => {
    const state = hydrateStateFromUrl(
      '?goalId=big&mode=save&saveFlavor=goal&itemPrice=1200&takeHomeMode=salary&grossSalary=12000' +
        '&pensionArrangement=netpay&pensionMode=amount&pensionMonthlyAmount=5000&takeHome=9999',
    )

    expect(state.takeHome).toBe('0')
    expect(Number(state.takeHome)).toBeGreaterThanOrEqual(0)
  })

  it('round-trips a state the UI produced without changing takeHome', () => {
    // buildShareParams -> hydrateStateFromUrl must be a fixed point: the UI
    // already derived takeHome the same way, so re-deriving changes nothing.
    const uiState = {
      ...DEFAULT_STATE,
      goalId: 'big' as const,
      itemPrice: '1200',
      takeHomeMode: 'salary' as const,
      grossSalary: '35000',
      studentPlan: 'plan2' as const,
      postgradLoan: true,
      pensionArrangement: 'sacrifice' as const,
      pensionMode: 'percent' as const,
      pensionPercent: 5,
    }
    const derived = { ...uiState, takeHome: takeHomeFor(uiState.grossSalary, payProfileOf(uiState)) }

    const round = hydrateStateFromUrl(`?${buildShareParams(derived).toString()}`)
    expect(round.takeHome).toBe(derived.takeHome)
    // And again, so it is stable rather than merely changed once.
    expect(hydrateStateFromUrl(`?${buildShareParams(round).toString()}`).takeHome).toBe(derived.takeHome)
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
