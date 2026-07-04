import type { Mode } from '../state/types'

// Both branches currently resolve to the same token value (see tokens.css) —
// green/red are reserved for the result screen's verdict, so the two modes
// deliberately no longer have visually distinct accents. Kept branching on
// `mode` rather than collapsed to a constant so a future per-mode accent is
// a tokens.css change, not a call-site one.

/** The accent color for the active mode. */
export function accentColorFor(mode: Mode): string {
  return mode === 'save' ? 'var(--accent-save)' : 'var(--accent-finance)'
}

/** The accent-tinted background for the active mode's selected card. */
export function accentBgFor(mode: Mode): string {
  return mode === 'save' ? 'var(--accent-save-bg)' : 'var(--accent-finance-bg)'
}

/** Human-readable label for the active mode, used in step eyebrows. */
export function modeLabelFor(mode: Mode): string {
  return mode === 'save' ? 'Saving up' : 'Paying monthly'
}
