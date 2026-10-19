import { Icon } from './Icon'
import { useTheme } from '../hooks/useTheme'

/**
 * The persistent light/dark toggle — a bare icon button (not a third
 * labelled pill) since the icon plus a dynamic aria-label already say what
 * clicking it does, without crowding the top-right controls further. Shows
 * the icon for the theme you'd *switch to* (moon while light, sun while
 * dark), the more common icon-toggle convention.
 *
 * Shares its touch-safe hover with the two pills beside it: see
 * `.pill-control` in index.css for why a tap must not leave this lit (#116,
 * #158).
 */
export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  const switchTo = theme === 'light' ? 'dark' : 'light'

  return (
    <button
      type="button"
      data-testid="theme-toggle"
      aria-label={`Switch to ${switchTo} theme`}
      onClick={toggleTheme}
      className="pill-control"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 'var(--theme-toggle-size)',
        height: 'var(--theme-toggle-size)',
        flexShrink: 0,
        borderRadius: 20,
        border: '1px solid var(--pill-border)',
        color: 'var(--text-primary)',
        cursor: 'pointer',
      }}
    >
      <Icon name={theme === 'light' ? 'moon' : 'sun'} size={17} />
    </button>
  )
}
