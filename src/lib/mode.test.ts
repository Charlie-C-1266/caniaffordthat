import { describe, it, expect } from 'vitest'
import { accentColorFor, accentBgFor, modeLabelFor } from './mode'

// Each mode still resolves to its own distinct CSS variable *name* (not a
// shared constant) — see the comment in mode.ts on why: it keeps a future
// per-mode accent a tokens.css change rather than a call-site one. The two
// names currently share the same underlying colour value, but that's a
// tokens.css fact, not something these functions assert.
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

describe('modeLabelFor', () => {
  it('labels each mode distinctly', () => {
    expect(modeLabelFor('save')).toBe('Saving up')
    expect(modeLabelFor('monthly')).toBe('Paying monthly')
  })
})
