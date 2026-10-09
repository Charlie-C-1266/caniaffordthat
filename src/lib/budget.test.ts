import { describe, it, expect } from 'vitest'
import { OUTGOING_FIELD_KEYS, OUTGOING_FIELD_LABELS, type OutgoingFieldKey } from './budget'
import { DEFAULT_STATE } from '../state/defaults'
import { monthlyOutgoingsOf, spareCashOf, deriveResult } from './derive'
import { num } from './calculations'
import type { CalculatorState } from '../state/types'

// budget.ts is pure data — the keys and labels three separate call sites
// (BudgetStep's grid, DetailsStep's essentials grid, derive.ts's spare-cash
// maths) all read from. Nothing here exercises behaviour, so these tests pin
// the *contract*: which keys exist, in what order, that every key has a label
// and every label a key, that the default state actually carries them, and
// that derive.ts really sums exactly this list and no other field.

describe('OUTGOING_FIELD_KEYS', () => {
  it('contains exactly the five outgoing fields, in display order', () => {
    // Order is load-bearing: both grids render in array order, so a reorder is
    // a visible UI change and should fail here rather than ship silently.
    expect(OUTGOING_FIELD_KEYS).toEqual(['housing', 'utilities', 'groceries', 'transport', 'debts'])
  })

  it('has no duplicate keys', () => {
    expect(new Set(OUTGOING_FIELD_KEYS).size).toBe(OUTGOING_FIELD_KEYS.length)
  })
})

describe('OUTGOING_FIELD_LABELS', () => {
  it('has a non-empty label for every key', () => {
    for (const key of OUTGOING_FIELD_KEYS) {
      expect(OUTGOING_FIELD_LABELS[key], `missing label for "${key}"`).toBeTruthy()
      expect(OUTGOING_FIELD_LABELS[key].trim()).not.toBe('')
    }
  })

  it('has no labels for keys outside OUTGOING_FIELD_KEYS', () => {
    // The other half of the parity check: a label left behind after a key is
    // removed would make the two collections disagree about the field set.
    expect(Object.keys(OUTGOING_FIELD_LABELS).sort()).toEqual([...OUTGOING_FIELD_KEYS].sort())
  })

  it('gives each field a distinct label', () => {
    // Two fields sharing a label is the exact drift the module was extracted
    // to prevent — the user would see the same caption on two inputs.
    const labels = OUTGOING_FIELD_KEYS.map((key) => OUTGOING_FIELD_LABELS[key])
    expect(new Set(labels).size).toBe(labels.length)
  })
})

describe('default state coverage', () => {
  it('defines every outgoing key with a numeric-parseable value', () => {
    for (const key of OUTGOING_FIELD_KEYS) {
      expect(DEFAULT_STATE, `DEFAULT_STATE is missing "${key}"`).toHaveProperty(key)
      // The fields are string-backed money inputs, so "numeric" means num()
      // parses them to a finite number rather than NaN.
      expect(Number.isFinite(num(DEFAULT_STATE[key])), `"${key}" is not numeric`).toBe(true)
    }
  })

  it('defaults all five to zero, so the budget starts empty rather than blank', () => {
    expect(OUTGOING_FIELD_KEYS.map((key) => num(DEFAULT_STATE[key]))).toEqual([0, 0, 0, 0, 0])
  })
})

describe('derive.ts reads exactly these keys', () => {
  const withOutgoings = (values: Record<OutgoingFieldKey, string>): CalculatorState => ({
    ...DEFAULT_STATE,
    ...values,
  })

  it('sums every outgoing key into monthlyOutgoingsOf', () => {
    const state = withOutgoings({ housing: '900', utilities: '150', groceries: '300', transport: '120', debts: '80' })
    expect(monthlyOutgoingsOf(state)).toBe(900 + 150 + 300 + 120 + 80)
  })

  it('changing any single key moves the total by exactly that amount', () => {
    // Walks the list one key at a time: a key dropped from OUTGOING_FIELD_KEYS
    // would stop contributing and fail here, naming the field.
    const base = withOutgoings({ housing: '100', utilities: '100', groceries: '100', transport: '100', debts: '100' })
    const baseline = monthlyOutgoingsOf(base)
    for (const key of OUTGOING_FIELD_KEYS) {
      const bumped = monthlyOutgoingsOf({ ...base, [key]: '150' })
      expect(bumped - baseline, `"${key}" is not summed into monthlyOutgoingsOf`).toBe(50)
    }
  })

  it('subtracts the same keys from take-home to get spare cash', () => {
    const state = {
      ...withOutgoings({ housing: '500', utilities: '100', groceries: '200', transport: '100', debts: '100' }),
      takeHome: '2000',
    }
    expect(spareCashOf(state)).toBe(2000 - 1000)
  })

  it('flows through to the derived result: raising one outgoing cuts spare cash', () => {
    // The end-to-end check the issue asks for — the published result the user
    // sees, not just the helper.
    const base: CalculatorState = {
      ...withOutgoings({ housing: '800', utilities: '100', groceries: '200', transport: '100', debts: '0' }),
      takeHome: '2500',
      itemPrice: '5000',
    }
    const before = deriveResult(base)
    const after = deriveResult({ ...base, debts: '300' })
    expect(before?.spareCash).toBe(1300)
    expect(after?.spareCash).toBe(1000)
  })

  it('ignores non-outgoing money fields, so savings is not treated as an outgoing', () => {
    // Guards the opposite drift: an unrelated state key creeping into the list
    // would double-count money the user has, not money they spend.
    const state = withOutgoings({ housing: '500', utilities: '0', groceries: '0', transport: '0', debts: '0' })
    expect(monthlyOutgoingsOf({ ...state, savings: '9999' })).toBe(monthlyOutgoingsOf(state))
  })
})
