import { describe, it, expect } from 'vitest'
import { isNegativeMoney, isMoneyValue, sanitiseItemName, ITEM_NAME_MAX_LENGTH } from './fields'

describe('isNegativeMoney', () => {
  it('spots a negative figure', () => {
    expect(isNegativeMoney('-500')).toBe(true)
    expect(isNegativeMoney('-0.01')).toBe(true)
  })

  it('spots the cases a bare Number(raw) < 0 comparison misses', () => {
    // Number('-0') is -0, and -0 < 0 is false; Number('-') is NaN.
    expect(isNegativeMoney('-0')).toBe(true)
    expect(isNegativeMoney('-')).toBe(true)
    expect(isNegativeMoney(' -500')).toBe(true)
  })

  it('leaves a non-negative figure alone', () => {
    expect(isNegativeMoney('0')).toBe(false)
    expect(isNegativeMoney('1200.50')).toBe(false)
    expect(isNegativeMoney('')).toBe(false)
  })
})

describe('isMoneyValue', () => {
  it('accepts a finite, non-negative figure', () => {
    const values = ['0', '1200', '1200.50', '.5', '0.001', '1e308']
    // Filtering rather than asserting in a loop so a failure names the value.
    expect(values.filter((value) => !isMoneyValue(value))).toEqual([])
  })

  it('rejects a negative figure', () => {
    expect(['-500', '-0.01', '-0', '-'].filter(isMoneyValue)).toEqual([])
  })

  it('rejects non-numeric junk', () => {
    expect(['abc', '12abc', '£1200', '1,200'].filter(isMoneyValue)).toEqual([])
  })

  it('rejects figures Number() reads but the number input cannot display', () => {
    // Each of these is 500 to Number(), and blank in an <input type="number">,
    // so a link carrying one would show an empty field while the maths used it.
    expect(['+500', '0x1F4', '0b11', '0o7', '500.', '5e', '1_000'].filter(isMoneyValue)).toEqual([])
  })

  it('accepts the exponent forms the number input does display', () => {
    expect(['1e3', '1E3', '2.5e+2', '1e-2'].filter((value) => !isMoneyValue(value))).toEqual([])
  })

  it('rejects non-finite values', () => {
    expect(['NaN', 'Infinity', '-Infinity', '1e999'].filter(isMoneyValue)).toEqual([])
  })

  it('rejects blank and whitespace-only values, which Number() reads as 0', () => {
    expect(Number('')).toBe(0) // the trap this guards
    expect(Number('   ')).toBe(0)
    expect(isMoneyValue('')).toBe(false)
    expect(isMoneyValue('   ')).toBe(false)
    expect(isMoneyValue('\t\n')).toBe(false)
  })
})

describe('sanitiseItemName', () => {
  it('leaves an ordinary title untouched', () => {
    expect(sanitiseItemName('New kitchen')).toBe('New kitchen')
    expect(sanitiseItemName('')).toBe('')
  })

  it('truncates a name longer than the cap', () => {
    expect(sanitiseItemName('a'.repeat(ITEM_NAME_MAX_LENGTH + 40))).toHaveLength(ITEM_NAME_MAX_LENGTH)
  })

  it('preserves a name exactly at the cap', () => {
    const exact = 'a'.repeat(ITEM_NAME_MAX_LENGTH)
    expect(sanitiseItemName(exact)).toBe(exact)
  })

  it('strips control characters', () => {
    expect(sanitiseItemName('New\u0000 kit\u001Fchen\u007F')).toBe('New kitchen')
    // C1 range.
    expect(sanitiseItemName('Sofa\u0085\u009F')).toBe('Sofa')
  })

  it('strips bidirectional-text controls, which would reorder the line', () => {
    // An unclosed right-to-left override in the title reverses how the £
    // figure after it in the same line reads.
    expect(sanitiseItemName('\u202Ekitchen')).toBe('kitchen')
    expect(sanitiseItemName('a\u202Ab\u202Bc\u202Cd\u202De')).toBe('abcde')
    expect(sanitiseItemName('a\u2066b\u2067c\u2068d\u2069e')).toBe('abcde')
    expect(sanitiseItemName('a\u200Eb\u200Fc\u061Cd')).toBe('abcd')
  })

  it('keeps the zero-width joiner that multi-part emoji need', () => {
    const family = '👨\u200D👩\u200D👧'
    expect(sanitiseItemName(family)).toBe(family)
  })

  it('keeps the characters a real title needs', () => {
    expect(sanitiseItemName("Mum's 60th — Café trip (€)")).toBe("Mum's 60th — Café trip (€)")
  })

  it('counts by code point, so an emoji title is not cut mid-character', () => {
    const emoji = '🚗'.repeat(ITEM_NAME_MAX_LENGTH + 5)
    const result = sanitiseItemName(emoji)
    expect(Array.from(result)).toHaveLength(ITEM_NAME_MAX_LENGTH)
    expect(result.endsWith('🚗')).toBe(true)
  })
})
