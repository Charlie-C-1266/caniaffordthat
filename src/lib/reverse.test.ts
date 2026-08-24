import { describe, it, expect } from 'vitest'
import { salaryFlip } from './reverse'
import { grossFromNet, netFromGross } from './salary'

describe('salaryFlip', () => {
  it('reports the gross behind the required take-home and the gap to current pay', () => {
    // Needs £3,000/mo take-home; currently earns £2,000/mo take-home.
    const flip = salaryFlip(3000, 2000)
    expect(flip.requiredTakeHomeAnnual).toBe(36000)
    expect(flip.requiredGross).toBeCloseTo(grossFromNet(36000), 0)
    expect(flip.currentGross).toBeCloseTo(grossFromNet(24000), 0)
    expect(flip.grossGap).toBeCloseTo(flip.requiredGross - flip.currentGross, 6)
    expect(flip.grossGap).toBeGreaterThan(0)
    expect(flip.alreadyEnough).toBe(false)
    expect(flip.takeHomeMonthlyGap).toBe(1000)
  })

  it('marks the plan as already affordable when current pay exceeds the requirement', () => {
    const flip = salaryFlip(1500, 4000)
    expect(flip.alreadyEnough).toBe(true)
    expect(flip.grossGap).toBeLessThan(0)
    expect(flip.vsMedian).toBe('below') // ~£20k gross is below the ONS median
  })

  it('places a big requirement above the UK median', () => {
    const flip = salaryFlip(5000, 2000)
    expect(flip.vsMedian).toBe('above')
  })

  it('surfaces the marginal cost inside the £100k allowance-taper band', () => {
    // A take-home that inverts to ~£110k gross, squarely in the taper band.
    const monthly = netFromGross(110000) / 12
    const flip = salaryFlip(monthly, 2000)
    expect(flip.requiredGross).toBeCloseTo(110000, 0)
    expect(flip.inTaperBand).toBe(true)
    // ~38p kept per extra £1 gross → ~£2.63 of salary per £1 of take-home.
    expect(flip.salaryPerTakeHome).toBeGreaterThan(2.5)
    expect(flip.salaryPerTakeHome).toBeLessThan(2.75)
  })
})
