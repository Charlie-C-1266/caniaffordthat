import type { Mode } from '../state/types'

/** The accent color for the active mode — green for saving, violet for financing. */
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
