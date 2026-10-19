import { describe, it, expect } from 'vitest'
import { accentColorFor, accentBgFor, resultAccents } from './mode'

// Each mode resolves to its own CSS variable name — green for saving, violet
// for finance (the v2 re-theme). These assert the token names; the colour
// values behind them are a tokens.css concern.
describe('accentColorFor', () => {
  it('resolves each mode to its own token name', () => {
    expect(accentColorFor('save')).toBe('var(--accent-save)')
    expect(accentColorFor('monthly')).toBe('var(--accent-finance)')
  })
})

describe('accentBgFor', () => {
  it('resolves each mode to its own token name', () => {
    expect(accentBgFor('save')).toBe('var(--accent-save-bg)')
    expect(accentBgFor('monthly')).toBe('var(--accent-finance-bg)')
  })
})

// Both result cards take their eyebrow and chart colours from here, so the
// "only the banner carries a No" rule lives in one place.
describe('resultAccents', () => {
  it('gives both the mode accent on a Yes', () => {
    expect(resultAccents(true, 'var(--accent-finance)')).toEqual({ eyebrow: 'var(--accent-finance)', chart: 'var(--accent-finance)' })
  })

  it('drops the accent from both on a No, whatever the mode', () => {
    const neutral = { eyebrow: 'var(--text-tertiary)', chart: 'var(--text-secondary-mid)' }
    expect(resultAccents(false, 'var(--accent-save)')).toEqual(neutral)
    expect(resultAccents(false, 'var(--accent-finance)')).toEqual(neutral)
  })
})
