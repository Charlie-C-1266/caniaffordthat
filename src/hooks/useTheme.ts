import { useCallback, useState } from 'react'
import { applyTheme, storeTheme, type Theme } from '../lib/theme'

interface UseThemeResult {
  theme: Theme
  /** Applies and persists an explicit choice — the persisted value is what makes it stick rather than tracking the OS afterward. */
  setTheme: (theme: Theme) => void
  /** Flips the current theme. The UI is a binary toggle, not a three-way picker, so this is the only mutator most callers need. */
  toggleTheme: () => void
}

/**
 * Owns the app's light/dark theme choice. Reads its initial value from
 * `<html>`'s `data-theme` attribute — set by the inline bootstrap script in
 * each HTML entry before this ever mounts — rather than recomputing it, so
 * React state can't disagree with what was already painted. `setTheme`/
 * `toggleTheme` apply the change to the DOM and persist it in the same call.
 *
 * Deliberately has no Context/Provider: the app has three independent React
 * roots (the main calculator, and two docs pages) that don't share a tree,
 * but they do share one `<html>` element and one `localStorage`, so each
 * mount independently reading that shared, single source of truth is
 * sufficient — there's no cross-root state to reconcile.
 *
 * Also deliberately does not listen for the OS's `prefers-color-scheme`
 * changing after mount: once a user has explicitly toggled, that choice must
 * stick, not snap back to the system setting.
 */
export function useTheme(): UseThemeResult {
  const [theme, setThemeState] = useState<Theme>(() => (document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'))

  const setTheme = useCallback((next: Theme) => {
    applyTheme(next)
    storeTheme(next)
    setThemeState(next)
  }, [])

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'light' ? 'dark' : 'light')
  }, [theme, setTheme])

  return { theme, setTheme, toggleTheme }
}
