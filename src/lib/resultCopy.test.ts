import { describe, it, expect } from 'vitest'
import { commitmentFitSub, pauseOtherSavingHint, pauseSavingHint } from './resultCopy'
import {
  SPARE_CASH_HEADROOM_COMFORTABLE_RATIO,
  SPARE_CASH_HEADROOM_TIGHT_RATIO,
  TAKE_HOME_COMFORTABLE_RATIO,
  TAKE_HOME_TIGHT_RATIO,
} from './affordability'

// The shared sentences, tested directly. The per-kind headlines and verdicts
// are tested through deriveResult in derive.test.ts, which builds them from
// real plans. The band boundaries below are also what pins affordability.ts.

describe('pauseSavingHint', () => {
  it('offers the pause when the shortfall is within what the user already saves', () => {
    expect(pauseSavingHint(150, 300)).toContain('£300/month')
    // Exactly covering the gap still counts — the bound is inclusive.
    expect(pauseSavingHint(300, 300)).not.toBe('')
  })

  it('stays quiet when there is nothing to pause, or pausing would not be enough', () => {
    expect(pauseSavingHint(150, 0)).toBe('')
    expect(pauseSavingHint(400, 300)).toBe('')
  })
})

describe('pauseOtherSavingHint', () => {
  it('names the saving as other saving, so it cannot read as pausing the cushion', () => {
    expect(pauseOtherSavingHint(150, 300)).toContain('£300/month you put into other savings')
    // Exactly covering the gap still counts — the bound is inclusive.
    expect(pauseOtherSavingHint(300, 300)).not.toBe('')
  })

  it('stays quiet when there is nothing to pause, or pausing would not be enough', () => {
    expect(pauseOtherSavingHint(150, 0)).toBe('')
    expect(pauseOtherSavingHint(400, 300)).toBe('')
  })
})

// A roomy budget, so the share-of-spare-cash floor never decides the band on
// its own and each income band can be exercised in isolation.
const roomy = (contribution: number) => commitmentFitSub({ contribution, spareCash: 10000, takeHome: 10000, regularSaving: 0 })

describe('commitmentFitSub', () => {
  it('reports the shortfall when the commitment exceeds spare cash', () => {
    expect(commitmentFitSub({ contribution: 800, spareCash: 500, takeHome: 2000, regularSaving: 0 })).toContain('more than your spare cash')
  })

  it('tells the user when pausing their saving would close the gap', () => {
    const copy = commitmentFitSub({ contribution: 800, spareCash: 500, takeHome: 2000, regularSaving: 400 })
    expect(copy).toContain('more than your spare cash')
    expect(copy).toContain('paused the £400/month')
  })

  it('handles zero spare cash without dividing by it', () => {
    const copy = commitmentFitSub({ contribution: 300, spareCash: 0, takeHome: 0, regularSaving: 0 })
    expect(copy).toContain('more than your spare cash')
    expect(copy).not.toMatch(/NaN|Infinity/)
  })

  it('still answers when the commitment, spare cash and take-home are all zero', () => {
    // 0 > 0 is false, so this reaches the band logic with both denominators
    // at 0 — which must read as a 0 share rather than NaN.
    const copy = commitmentFitSub({ contribution: 0, spareCash: 0, takeHome: 0, regularSaving: 0 })
    expect(copy).not.toMatch(/NaN|Infinity/)
    expect(copy).toContain('comfortably')
  })

  it('puts each share-of-take-home boundary in the band that includes it', () => {
    // The bands are `<=`, so a figure exactly on a cut-off takes the
    // friendlier description.
    expect(roomy(10000 * TAKE_HOME_COMFORTABLE_RATIO)).toContain('comfortably')
    expect(roomy(10000 * TAKE_HOME_TIGHT_RATIO)).toContain('a good chunk')
    expect(roomy(10000 * 0.4)).toContain("it's tight")
  })

  it('states the commitment as a share of take-home pay, not of spare cash', () => {
    // £400 of a £2,000 take-home is 20%, even though it is 80% of the £500
    // spare cash — the percentage quoted is the income one.
    expect(commitmentFitSub({ contribution: 400, spareCash: 500, takeHome: 2000, regularSaving: 0 })).toContain(
      '£400/month is 20% of your take-home pay',
    )
  })

  it('falls back to the harsher band when the commitment eats most of the spare cash', () => {
    // 18% of take-home is "comfortable" on income alone, but £360 of £500
    // spare cash is 72% — the headroom floor decides it.
    const copy = commitmentFitSub({ contribution: 360, spareCash: 500, takeHome: 2000, regularSaving: 0 })
    expect(copy).toContain("it's tight")
  })

  it('puts each headroom-floor boundary in the band that includes it', () => {
    // Take-home is large enough that the income reading is always
    // "comfortable", so the floor alone picks the band.
    const spare = 1000
    const onFloor = (ratio: number) =>
      commitmentFitSub({ contribution: spare * ratio, spareCash: spare, takeHome: 1000000, regularSaving: 0 })
    expect(onFloor(SPARE_CASH_HEADROOM_COMFORTABLE_RATIO)).toContain('comfortably')
    expect(onFloor(SPARE_CASH_HEADROOM_TIGHT_RATIO)).toContain('a good chunk')
    expect(onFloor(0.9)).toContain("it's tight")
  })

  it('never loosens a verdict: the worse of the two readings wins either way round', () => {
    // Income reading tight, headroom reading comfortable -> tight.
    expect(commitmentFitSub({ contribution: 500, spareCash: 5000, takeHome: 1000, regularSaving: 0 })).toContain("it's tight")
    // Income reading comfortable, headroom reading tight -> tight.
    expect(commitmentFitSub({ contribution: 500, spareCash: 600, takeHome: 10000, regularSaving: 0 })).toContain("it's tight")
  })
})
