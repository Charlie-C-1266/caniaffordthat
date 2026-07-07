import { describe, it, expect } from 'vitest'
import { flowForGoal } from './flow'
import { GOALS, goalById } from './goals'

describe('flowForGoal', () => {
  it('offers only the carousel and the Details placeholder before a goal is picked', () => {
    expect(flowForGoal(null).map((s) => s.id)).toEqual(['goal', 'details'])
  })

  it('gives standard goals the five-step flow', () => {
    expect(flowForGoal(goalById('holiday')).map((s) => s.id)).toEqual(['goal', 'details', 'budget', 'plan', 'result'])
    expect(flowForGoal(goalById('emergency')).map((s) => s.id)).toEqual(['goal', 'details', 'budget', 'plan', 'result'])
  })

  it('gives the vehicle its bespoke six-step flow, with Budget kept just before the result', () => {
    expect(flowForGoal(goalById('car')).map((s) => s.id)).toEqual([
      'goal',
      'details',
      'vehiclePurchase',
      'vehicleCosts',
      'budget',
      'result',
    ])
  })

  it('starts every flow at the goal picker and ends every full flow at the result', () => {
    for (const goal of GOALS) {
      const flow = flowForGoal(goal)
      expect(flow[0].id).toBe('goal')
      expect(flow.at(-1)?.id).toBe('result')
    }
  })

  it('labels every step for the progress rail, uniquely within its flow', () => {
    for (const goal of [null, ...GOALS]) {
      const labels = flowForGoal(goal).map((s) => s.label)
      expect(labels.every((l) => l.length > 0)).toBe(true)
      expect(new Set(labels).size).toBe(labels.length)
    }
  })
})
