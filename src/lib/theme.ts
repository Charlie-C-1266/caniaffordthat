// Light/dark theme resolution and persistence. Pure and framework-agnostic,
// in the same spirit as urlState.ts — localStorage is as user-editable as a
// query string (devtools, extensions, a stale value from an older build), so
// nothing read from it is trusted without validation.

export type Theme = 'light' | 'dark'

/**
 * localStorage key for the user's explicit theme choice. The inline
 * bootstrap <script> in each HTML entry (index.html, sources/index.html,
 * methodology/vehicle/index.html) hand-copies this exact literal — it runs
 * before any bundled JS exists, so it can't import this module. Keep the
 * three scripts and this constant in sync if the key ever changes.
 */
export const THEME_STORAGE_KEY = 'theme'

/** Type guard for an untrusted value (localStorage, or hand-typed in devtools). */
export function isTheme(value: string | null): value is Theme {
  return value === 'light' || value === 'dark'
}

/** True when the OS/browser reports a light color-scheme preference. */
export function prefersLightScheme(): boolean {
  return window.matchMedia('(prefers-color-scheme: light)').matches
}

/** The persisted choice, if any — null if unset, invalid, or storage is unavailable (e.g. private browsing can make this throw). */
export function readStoredTheme(): Theme | null {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    return isTheme(stored) ? stored : null
  } catch {
    return null
  }
}

/** Persists an explicit choice. Silently does nothing if storage is unavailable, same defensive stance as readStoredTheme. */
export function storeTheme(theme: Theme): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    // Storage unavailable — the choice just won't survive a reload.
  }
}

/**
 * The theme to use when nothing has decided yet: an explicit stored choice
 * wins, otherwise the OS preference, otherwise dark (today's only theme, and
 * the safe default if `matchMedia` is ever unavailable).
 */
export function resolveInitialTheme(): Theme {
  return readStoredTheme() ?? (prefersLightScheme() ? 'light' : 'dark')
}

/**
 * Applies a theme to the document. Dark *removes* the `data-theme` attribute
 * rather than setting it to `"dark"` — tokens.css only defines a
 * `[data-theme="light"]` override block, so "absent" and "dark" are the same
 * state by construction, and a user who never touches the toggle never
 * causes a DOM mutation at all.
 */
export function applyTheme(theme: Theme): void {
  if (theme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light')
  } else {
    document.documentElement.removeAttribute('data-theme')
  }
}
