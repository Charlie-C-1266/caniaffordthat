import { describe, it, expect } from 'vitest'
import { accentColorFor, accentBgFor } from './mode'

// Each mode resolves to its own CSS variable name — green for saving, violet
// for finance (the v2 re-theme, see design/adr/0003). These assert the token
// names; the colour values behind them are a tokens.css concern.
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
