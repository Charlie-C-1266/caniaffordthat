import type { Mode } from '../state/types'

// The two modes have distinct accents under the v2 re-theme (green for saving,
// violet for finance — see tokens.css and design/adr/0003). The result screen
// is the exception: its background is the green/red verdict colour, not the
// mode accent (see design/adr/0007).

/** The accent color for the active mode. */
export function accentColorFor(mode: Mode): string {
  return mode === 'save' ? 'var(--accent-save)' : 'var(--accent-finance)'
}

/** The accent-tinted background for the active mode's selected card. */
export function accentBgFor(mode: Mode): string {
  return mode === 'save' ? 'var(--accent-save-bg)' : 'var(--accent-finance-bg)'
}
