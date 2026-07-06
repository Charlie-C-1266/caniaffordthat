import { describe, it, expect } from 'vitest'
import { GOALS, INITIAL_CAROUSEL_INDEX, circularOffset, goalById, seedFromGoal, wrapIndex } from './goals'

describe('GOALS config', () => {
  it('lists the six goals with the coming-soon Mortgage last', () => {
    expect(GOALS).toHaveLength(6)
    expect(GOALS.at(-1)?.id).toBe('mortgage')
    expect(GOALS.at(-1)?.soon).toBe(true)
    // Vehicle and Mortgage ship as "Soon" (their calculators aren't ready).
    expect(GOALS.filter((g) => g.soon).map((g) => g.id)).toEqual(['car', 'mortgage'])
  })

  it('has unique ids', () => {
    const ids = GOALS.map((g) => g.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('gives every standard (non-emergency, selectable) goal a price headline', () => {
    for (const goal of GOALS) {
      if (goal.soon || goal.emergency) continue
      expect(goal.priceHeadline, `${goal.id} should have a price headline`).toBeTruthy()
    }
  })

  it('provides a name placeholder whenever the name field is shown', () => {
    for (const goal of GOALS) {
      if (goal.showName) expect(goal.namePlaceholder, `${goal.id}`).toBeTruthy()
    }
  })

  it('marks the emergency fund save-only with no price and no mode toggle', () => {
    const emergency = goalById('emergency')
    expect(emergency?.emergency).toBe(true)
    expect(emergency?.allowModeToggle).toBe(false)
    expect(emergency?.priceHeadline).toBeUndefined()
    expect(emergency?.seeds.mode).toBe('save')
  })
})

describe('INITIAL_CAROUSEL_INDEX', () => {
  it('points at the first selectable goal (Holiday, since Vehicle is now "Soon")', () => {
    expect(INITIAL_CAROUSEL_INDEX).toBe(1)
    expect(GOALS[INITIAL_CAROUSEL_INDEX].id).toBe('holiday')
    expect(GOALS[INITIAL_CAROUSEL_INDEX].soon).toBeFalsy()
  })
})

describe('goalById', () => {
  it('finds a known goal and returns null otherwise', () => {
    expect(goalById('car')?.name).toBe('Vehicle')
    expect(goalById(null)).toBeNull()
  })
})

describe('wrapIndex', () => {
  it('loops out-of-range indices around a 6-item carousel', () => {
    expect(wrapIndex(0, 6)).toBe(0)
    expect(wrapIndex(5, 6)).toBe(5)
    expect(wrapIndex(6, 6)).toBe(0) // right off the end -> first
    expect(wrapIndex(-1, 6)).toBe(5) // left off the start -> last
    expect(wrapIndex(-7, 6)).toBe(5)
  })

  it('defaults to the real GOALS length', () => {
    expect(wrapIndex(-1)).toBe(GOALS.length - 1)
    expect(wrapIndex(GOALS.length)).toBe(0)
  })
})

describe('circularOffset', () => {
  it('takes the shorter way around, so the opposite card sits at the far end', () => {
    // 6 goals focused on index 0 -> forward offsets, with the two behind it
    // reached the short way as negatives.
    expect(circularOffset(0, 0, 6)).toBe(0)
    expect(circularOffset(1, 0, 6)).toBe(1)
    expect(circularOffset(5, 0, 6)).toBe(-1) // last card is one step left, not five right
    expect(circularOffset(4, 0, 6)).toBe(-2)
  })

  it('keeps neighbours one step apart across the wrap boundary', () => {
    // Focused on the last goal, the first goal is its right-hand neighbour.
    expect(circularOffset(0, 5, 6)).toBe(1)
    expect(circularOffset(5, 5, 6)).toBe(0)
  })
})

describe('seedFromGoal', () => {
  it('records the goal id and seeds the car finance defaults', () => {
    const patch = seedFromGoal(goalById('car')!)
    expect(patch.goalId).toBe('car')
    expect(patch.mode).toBe('monthly')
    expect(patch.term).toBe(60)
    expect(patch.growth).toBe(7.9)
  })

  it('only seeds fields the goal specifies, leaving others to keep their current value', () => {
    const patch = seedFromGoal(goalById('luxury')!)
    expect(patch).toStrictEqual({ goalId: 'luxury', mode: 'save', saveFlavor: 'duration' })
    expect('term' in patch).toBe(false)
    expect('goalMonths' in patch).toBe(false)
  })

  it('seeds the emergency cover months to the recommended 3-month starting target', () => {
    expect(seedFromGoal(goalById('emergency')!).coverMonths).toBe(3)
  })
})
