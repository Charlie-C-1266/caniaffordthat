import { useState } from 'react'
import { Icon } from './Icon'
import { useTheme } from '../hooks/useTheme'

/**
 * The persistent light/dark toggle — a bare icon button (not a third
 * labelled pill) since the icon plus a dynamic aria-label already say what
 * clicking it does, without crowding the top-right controls further. Shows
 * the icon for the theme you'd *switch to* (moon while light, sun while
 * dark), the more common icon-toggle convention.
 */
export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  const [hovered, setHovered] = useState(false)
  const switchTo = theme === 'light' ? 'dark' : 'light'

  return (
    <button
      type="button"
      data-testid="theme-toggle"
      aria-label={`Switch to ${switchTo} theme`}
      onClick={toggleTheme}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 36,
        height: 36,
        borderRadius: 20,
        background: hovered ? 'var(--pill-bg-hover)' : 'var(--pill-bg)',
        border: '1px solid var(--pill-border)',
        color: 'var(--text-primary)',
        cursor: 'pointer',
      }}
    >
      <Icon name={theme === 'light' ? 'moon' : 'sun'} size={17} />
    </button>
  )
}
