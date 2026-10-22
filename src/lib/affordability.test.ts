import { describe, it, expect } from 'vitest'
import {
  AFFORDABILITY_MONTHS_CAP,
  SPARE_CASH_HEADROOM_COMFORTABLE_RATIO,
  SPARE_CASH_HEADROOM_TIGHT_RATIO,
  TAKE_HOME_COMFORTABLE_RATIO,
  TAKE_HOME_TIGHT_RATIO,
  fitReading,
} from './affordability'

// affordability.ts holds the banding maths every flow places a commitment
// with, and resultCopy.ts wraps the sentences around it. resultCopy.test.ts
// already reaches this module through those sentences, so a banding
// regression there shows up as a wording mismatch. These tests pin the maths
// on its own terms, `band` and `shareOfTakeHome`, so a failure names the
// cut-off that moved rather than the sentence that changed.

/** Worst last, matching the module's own ordering, so two bands can be compared by position. */
const BANDS = ['comfortable', 'chunk', 'tight'] as const

/** Far larger than any contribution here, so the reading it divides always says comfortable and the other reading decides. */
const UNLIMITED = 1e12

/** Just either side of a cut-off: a fraction of a penny on any real budget, but far above floating-point noise. */
const NUDGE = 1e-9

/**
 * The band for a share of take-home pay on its own. A take-home of 1 makes the
 * share the contribution itself, so a figure exactly on a cut-off is exactly
 * on it in floating point too, not a rounding error either side.
 */
const takeHomeBand = (share: number) => fitReading({ contribution: share, takeHome: 1, spareCash: UNLIMITED }).band

/** The band for a share of spare cash on its own, with take-home pay large enough that its reading never tightens. */
const headroomBand = (share: number) => fitReading({ contribution: share, spareCash: 1, takeHome: UNLIMITED }).band

describe('the banding constants', () => {
  it('caps a savings plan at five years, the line MoneyHelper draws between cash savings and investing', () => {
    expect(AFFORDABILITY_MONTHS_CAP).toBe(60)
  })

  it('quotes the UK rules of thumb as published: 20% and 30% of take-home pay', () => {
    // A change here changes every verdict, and the methodology page quotes
    // these figures, so it should take a deliberate edit here too.
    expect(TAKE_HOME_COMFORTABLE_RATIO).toBe(0.2)
    expect(TAKE_HOME_TIGHT_RATIO).toBe(0.3)
  })

  it('keeps the headroom floor at 40% and 60% of spare cash', () => {
    expect(SPARE_CASH_HEADROOM_COMFORTABLE_RATIO).toBe(0.4)
    expect(SPARE_CASH_HEADROOM_TIGHT_RATIO).toBe(0.6)
  })

  it('orders each pair friendlier first, so the middle band exists', () => {
    expect(TAKE_HOME_COMFORTABLE_RATIO).toBeLessThan(TAKE_HOME_TIGHT_RATIO)
    expect(SPARE_CASH_HEADROOM_COMFORTABLE_RATIO).toBeLessThan(SPARE_CASH_HEADROOM_TIGHT_RATIO)
  })
})

describe('fitReading: the share of take-home pay', () => {
  it('quotes the commitment as a share of take-home pay, whatever the spare cash', () => {
    // £400 of a £2,000 take-home is 20%, whether it is 80% of £500 spare cash
    // or a sliver of £50,000.
    expect(fitReading({ contribution: 400, spareCash: 500, takeHome: 2000 }).shareOfTakeHome).toBe(0.2)
    expect(fitReading({ contribution: 400, spareCash: 50_000, takeHome: 2000 }).shareOfTakeHome).toBe(0.2)
  })

  it('puts a share just below, exactly on and just above the comfortable cut-off in the right band', () => {
    // Both cut-offs are inclusive: a figure exactly on one takes the friendlier band.
    expect(takeHomeBand(TAKE_HOME_COMFORTABLE_RATIO - NUDGE)).toBe('comfortable')
    expect(takeHomeBand(TAKE_HOME_COMFORTABLE_RATIO)).toBe('comfortable')
    expect(takeHomeBand(TAKE_HOME_COMFORTABLE_RATIO + NUDGE)).toBe('chunk')
  })

  it('puts a share just below, exactly on and just above the tight cut-off in the right band', () => {
    expect(takeHomeBand(TAKE_HOME_TIGHT_RATIO - NUDGE)).toBe('chunk')
    expect(takeHomeBand(TAKE_HOME_TIGHT_RATIO)).toBe('chunk')
    expect(takeHomeBand(TAKE_HOME_TIGHT_RATIO + NUDGE)).toBe('tight')
  })
})

describe('fitReading: the headroom floor', () => {
  it('puts a share of spare cash just below, exactly on and just above the comfortable cut-off in the right band', () => {
    expect(headroomBand(SPARE_CASH_HEADROOM_COMFORTABLE_RATIO - NUDGE)).toBe('comfortable')
    expect(headroomBand(SPARE_CASH_HEADROOM_COMFORTABLE_RATIO)).toBe('comfortable')
    expect(headroomBand(SPARE_CASH_HEADROOM_COMFORTABLE_RATIO + NUDGE)).toBe('chunk')
  })

  it('puts a share of spare cash just below, exactly on and just above the tight cut-off in the right band', () => {
    expect(headroomBand(SPARE_CASH_HEADROOM_TIGHT_RATIO - NUDGE)).toBe('chunk')
    expect(headroomBand(SPARE_CASH_HEADROOM_TIGHT_RATIO)).toBe('chunk')
    expect(headroomBand(SPARE_CASH_HEADROOM_TIGHT_RATIO + NUDGE)).toBe('tight')
  })

  // One share of each kind per band, well clear of the cut-offs. With the
  // contribution fixed at £100, each share sets its own denominator, so every
  // pairing of the two readings can be built.
  const takeHomeShares = { comfortable: 0.1, chunk: 0.25, tight: 0.5 } as const
  const spareCashShares = { comfortable: 0.2, chunk: 0.5, tight: 0.8 } as const
  const pairings = BANDS.flatMap((income) =>
    BANDS.map((headroom) => ({ income, headroom, expected: BANDS[Math.max(BANDS.indexOf(income), BANDS.indexOf(headroom))] })),
  )

  it.each(pairings)('reads $expected when take-home pay says $income and the headroom says $headroom', ({ income, headroom, expected }) => {
    const reading = fitReading({ contribution: 100, takeHome: 100 / takeHomeShares[income], spareCash: 100 / spareCashShares[headroom] })
    expect(reading.band).toBe(expected)
    // The floor tightens the band but never changes the figure the copy quotes.
    expect(reading.shareOfTakeHome).toBeCloseTo(takeHomeShares[income], 12)
  })

  it('never reads a bigger commitment as more comfortable than a smaller one on the same budget', () => {
    // Swept in £5 steps up to all of the spare cash, across a budget where
    // take-home pay decides, one where the floor decides, and one in between.
    const loosened: string[] = []
    for (const budget of [
      { takeHome: 2400, spareCash: 900 },
      { takeHome: 1500, spareCash: 1400 },
      { takeHome: 6000, spareCash: 300 },
    ]) {
      let worstSoFar = 0
      for (let contribution = 0; contribution <= budget.spareCash; contribution += 5) {
        const position = BANDS.indexOf(fitReading({ contribution, ...budget }).band)
        if (position < worstSoFar) loosened.push(`£${contribution} on ${JSON.stringify(budget)}`)
        worstSoFar = Math.max(worstSoFar, position)
      }
    }
    expect(loosened).toEqual([])
  })
})

describe('fitReading: inputs at the edges', () => {
  it('reads a zero commitment against a zero budget as a 0 share and comfortable, not NaN', () => {
    expect(fitReading({ contribution: 0, spareCash: 0, takeHome: 0 })).toEqual({ shareOfTakeHome: 0, band: 'comfortable' })
  })

  it('reads a zero commitment against a real budget as comfortable', () => {
    expect(fitReading({ contribution: 0, spareCash: 900, takeHome: 2400 })).toEqual({ shareOfTakeHome: 0, band: 'comfortable' })
  })

  it('leaves the band to spare cash when take-home pay is 0, quoting a 0 share rather than Infinity', () => {
    // Callers only reach fitReading once the commitment fits spare cash, which
    // can't exceed take-home pay, so this can't happen through the app. What
    // matters is that it degrades to a number, and the other reading still counts.
    expect(fitReading({ contribution: 100, spareCash: 1000, takeHome: 0 })).toEqual({ shareOfTakeHome: 0, band: 'comfortable' })
    expect(fitReading({ contribution: 700, spareCash: 1000, takeHome: 0 })).toEqual({ shareOfTakeHome: 0, band: 'tight' })
  })

  it('leaves the band to take-home pay when spare cash is 0', () => {
    expect(fitReading({ contribution: 500, spareCash: 0, takeHome: 2000 })).toEqual({ shareOfTakeHome: 0.25, band: 'chunk' })
    expect(fitReading({ contribution: 700, spareCash: 0, takeHome: 2000 })).toEqual({ shareOfTakeHome: 0.35, band: 'tight' })
  })

  it('treats a negative take-home or spare cash as no reading at all, rather than throwing or returning NaN', () => {
    // Spare cash goes negative when outgoings outrun income. Callers report
    // that before anything is banded, but a stray negative still has to come
    // back as a number, with the other reading left to decide.
    expect(fitReading({ contribution: 100, spareCash: -500, takeHome: -2000 })).toEqual({ shareOfTakeHome: 0, band: 'comfortable' })
    expect(fitReading({ contribution: 700, spareCash: -100, takeHome: 2000 })).toEqual({ shareOfTakeHome: 0.35, band: 'tight' })
  })

  it('reads a vast commitment as tight with a finite share', () => {
    const reading = fitReading({ contribution: 1e9, spareCash: 900, takeHome: 2000 })
    expect(reading.band).toBe('tight')
    expect(reading.shareOfTakeHome).toBe(5e5)
  })

  it('reads a commitment of a penny as comfortable', () => {
    const reading = fitReading({ contribution: 0.01, spareCash: 900, takeHome: 2000 })
    expect(reading.band).toBe('comfortable')
    expect(reading.shareOfTakeHome).toBeCloseTo(0.000005, 12)
  })
})
