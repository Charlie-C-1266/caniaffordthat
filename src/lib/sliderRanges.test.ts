import { describe, it, expect } from 'vitest'
import * as sliderRanges from './sliderRanges'
import { FINANCE_TERM_RANGE, type SliderRange } from './sliderRanges'
import { AFFORDABILITY_MONTHS_CAP } from './affordability'
import { TERM_RANGES } from './vehicle'

// sliderRanges.ts is the one place the sliders and the shared-link clamps in
// urlState.ts read their bounds from, and it exists because the two once
// drifted apart. These tests hold each range to the shape a slider needs:
// finite ends, min below max, and a step that lands on both ends. The ranges
// are found by walking the module's exports rather than listed here, so one
// added later is checked without anyone remembering to add it. How a link
// is clamped to each range is tested in urlState.test.ts.

/** The vehicle term slider's step in VehiclePurchaseStep. TERM_RANGES carries bounds only. */
const VEHICLE_TERM_STEP = 1

function isSliderRange(value: unknown): value is SliderRange {
  if (typeof value !== 'object' || value === null) return false
  const { min, max, step } = value as Record<string, unknown>
  return typeof min === 'number' && typeof max === 'number' && typeof step === 'number'
}

/**
 * Everything that stops a range working as a slider; empty means it's sound.
 * A step that doesn't divide the span leaves the slider unable to land on its
 * own max, and a link clamped to that max would show a value the slider can't.
 */
function rangeProblems(name: string, { min, max, step }: SliderRange): string[] {
  if (![min, max, step].every(Number.isFinite)) return [`${name}: bounds and step must all be finite numbers`]
  const problems: string[] = []
  if (!(min < max)) problems.push(`${name}: min ${min} is not below max ${max}`)
  if (!(step > 0)) problems.push(`${name}: step ${step} is not positive`)
  else {
    const steps = (max - min) / step
    // A tolerance, so a fractional step like 0.1 isn't failed for binary rounding.
    if (Math.abs(steps - Math.round(steps)) > 1e-9) problems.push(`${name}: step ${step} does not divide ${min}–${max} into whole steps`)
  }
  return problems
}

const exported = Object.entries(sliderRanges)

describe('sliderRanges.ts', () => {
  it('exports nothing but slider ranges', () => {
    // A range exported without a step, or a stray helper, would otherwise be
    // skipped by the checks below without anyone noticing.
    expect(exported.filter(([, value]) => !isSliderRange(value)).map(([name]) => name)).toEqual([])
  })

  it('exports the six ranges the calculator uses, so the checks below are not passing on an empty list', () => {
    expect(exported.map(([name]) => name)).toEqual(
      expect.arrayContaining([
        'SAVE_RATE_RANGE',
        'SAVINGS_INTEREST_RANGE',
        'APR_RANGE',
        'FINANCE_TERM_RANGE',
        'COVER_MONTHS_RANGE',
        'VEHICLE_AGE_RANGE',
      ]),
    )
  })

  it('gives every range finite bounds, min below max, and a step that lands on both ends', () => {
    expect(exported.flatMap(([name, range]) => (isSliderRange(range) ? rangeProblems(name, range) : []))).toEqual([])
  })

  it('ends the standard finance term at the five-year horizon a savings plan is held to', () => {
    // AFFORDABILITY_MONTHS_CAP is MoneyHelper's five-year line between cash
    // savings and investing: a savings plan longer than that is called
    // unaffordable. The finance flow's term slider stops at the same five
    // years, so saving and financing the same goal are judged over the same
    // horizon. Nothing in the code ties the two together, so a change to one
    // would drift past the other silently; this is the tie.
    expect(FINANCE_TERM_RANGE.max).toBe(AFFORDABILITY_MONTHS_CAP)
  })
})

describe('vehicle TERM_RANGES', () => {
  it('gives every finance method a range the term slider can step through end to end', () => {
    const problems = Object.entries(TERM_RANGES).flatMap(([method, range]) =>
      rangeProblems(`TERM_RANGES.${method}`, { ...range, step: VEHICLE_TERM_STEP }),
    )
    expect(problems).toEqual([])
  })

  it('covers every finance method, so the check above is not passing on an empty list', () => {
    expect(Object.keys(TERM_RANGES).toSorted()).toEqual(['hp', 'loan', 'pcp'])
  })
})

// The checks are only worth as much as their willingness to reject the
// mistakes they describe, so each failure is pinned against a fixture.
describe('the range check rejects a range a slider cannot use', () => {
  it('accepts a sound range, fractional steps included', () => {
    expect(rangeProblems('r', { min: 0, max: 20, step: 0.5 })).toEqual([])
    expect(rangeProblems('r', { min: 0, max: 1, step: 0.1 })).toEqual([])
  })

  it('rejects min at or above max', () => {
    expect(rangeProblems('r', { min: 5, max: 5, step: 1 })).toEqual(['r: min 5 is not below max 5'])
    expect(rangeProblems('r', { min: 9, max: 5, step: 1 })).toEqual(['r: min 9 is not below max 5'])
  })

  it('rejects a step of zero or less', () => {
    expect(rangeProblems('r', { min: 0, max: 10, step: 0 })).toEqual(['r: step 0 is not positive'])
    expect(rangeProblems('r', { min: 0, max: 10, step: -1 })).toEqual(['r: step -1 is not positive'])
  })

  it('rejects a step that cannot land on max', () => {
    expect(rangeProblems('r', { min: 0, max: 10, step: 3 })).toEqual(['r: step 3 does not divide 0–10 into whole steps'])
    expect(rangeProblems('r', { min: 1, max: 60, step: 2 })).toEqual(['r: step 2 does not divide 1–60 into whole steps'])
  })

  it('rejects a bound or step that is not a finite number', () => {
    for (const range of [
      { min: Number.NaN, max: 10, step: 1 },
      { min: 0, max: Number.POSITIVE_INFINITY, step: 1 },
      { min: 0, max: 10, step: Number.NaN },
    ]) {
      expect(rangeProblems('r', range)).toEqual(['r: bounds and step must all be finite numbers'])
    }
  })

  it('tells a slider range from anything else the module might export', () => {
    expect(isSliderRange({ min: 0, max: 1, step: 1 })).toBe(true)
    expect(isSliderRange({ min: 0, max: 1 })).toBe(false)
    expect(isSliderRange({ min: '0', max: 1, step: 1 })).toBe(false)
    expect(isSliderRange(null)).toBe(false)
    expect(isSliderRange(42)).toBe(false)
  })
})
