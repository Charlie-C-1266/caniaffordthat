import type { Mode } from '../state/types'

// The two modes have distinct accents under the v2 re-theme (green for saving,
// violet for finance — the token values live in tokens.css). The result is the
// exception: its yes/no is a green/red verdict banner (VerdictBanner) rather
// than the mode accent, and on a "No" the accent is neutralised elsewhere in
// the result so nothing positive-reading sits beside the red.

/** The accent colour for the active mode. */
export function accentColorFor(mode: Mode): string {
  return mode === 'save' ? 'var(--accent-save)' : 'var(--accent-finance)'
}

/** The accent-tinted background for the active mode's selected card. */
export function accentBgFor(mode: Mode): string {
  return mode === 'save' ? 'var(--accent-save-bg)' : 'var(--accent-finance-bg)'
}

/**
 * A result's eyebrow and chart colours. On a "Yes" both take the mode accent;
 * on a "No" both drop it, so no positive-reading colour sits beside the red
 * banner and only the banner carries the verdict.
 */
export function resultAccents(affordable: boolean, accent: string): { eyebrow: string; chart: string } {
  return affordable ? { eyebrow: accent, chart: accent } : { eyebrow: 'var(--text-tertiary)', chart: 'var(--text-secondary-mid)' }
}
