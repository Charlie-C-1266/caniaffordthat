// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { ThemeToggle } from './ThemeToggle'
import { THEME_STORAGE_KEY } from '../lib/theme'

// The real useTheme is used throughout: the component's whole job is wiring
// the hook to a button, so stubbing the hook out would leave the one thing
// worth testing — that a click actually flips the theme — unverified. Instead
// the hook's own inputs are driven the way useTheme.test.tsx drives them:
// `data-theme` on <html> (set pre-paint by the bootstrap script) plus
// localStorage. Only the icon registry is mocked, so the chosen glyph is
// assertable without depending on lucide's SVG markup.
vi.mock('./Icon', () => ({
  Icon: ({ name }: { name: string }) => <span data-testid={`icon-${name}`} />,
}))

const getToggle = () => screen.getByTestId('theme-toggle')
const label = () => getToggle().getAttribute('aria-label')

/** Mirrors the pre-paint bootstrap: light sets the attribute, dark leaves it absent. */
function startIn(theme: 'light' | 'dark') {
  if (theme === 'light') document.documentElement.setAttribute('data-theme', 'light')
  else document.documentElement.removeAttribute('data-theme')
}

beforeEach(() => {
  localStorage.clear()
  document.documentElement.removeAttribute('data-theme')
})

afterEach(cleanup)

describe('ThemeToggle', () => {
  it('while light, shows the moon icon and offers to switch to dark', () => {
    // Icon-toggle convention: show the theme you'd switch *to*. The icon and
    // the aria-label are independently invertible, so both are asserted —
    // otherwise the two could silently disagree.
    startIn('light')
    render(<ThemeToggle />)

    expect(screen.getByTestId('icon-moon')).toBeTruthy()
    expect(screen.queryByTestId('icon-sun')).toBeNull()
    expect(label()).toBe('Switch to dark theme')
  })

  it('while dark, shows the sun icon and offers to switch to light', () => {
    startIn('dark')
    render(<ThemeToggle />)

    expect(screen.getByTestId('icon-sun')).toBeTruthy()
    expect(screen.queryByTestId('icon-moon')).toBeNull()
    expect(label()).toBe('Switch to light theme')
  })

  it('flips light to dark on click — the button re-renders with the opposite icon and label', () => {
    startIn('light')
    render(<ThemeToggle />)

    fireEvent.click(getToggle())

    expect(screen.getByTestId('icon-sun')).toBeTruthy()
    expect(screen.queryByTestId('icon-moon')).toBeNull()
    expect(label()).toBe('Switch to light theme')
    // The flip reached the document and storage, not just React state: dark is
    // represented by the attribute's absence (see applyTheme).
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false)
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
  })

  it('flips dark to light on click', () => {
    startIn('dark')
    render(<ThemeToggle />)

    fireEvent.click(getToggle())

    expect(screen.getByTestId('icon-moon')).toBeTruthy()
    expect(label()).toBe('Switch to dark theme')
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light')
  })

  it('keeps flipping on repeated clicks rather than sticking after the first', () => {
    // toggleTheme closes over `theme`; a stale closure would flip once and
    // then keep re-applying the same value.
    startIn('light')
    render(<ThemeToggle />)

    fireEvent.click(getToggle())
    expect(label()).toBe('Switch to light theme')
    fireEvent.click(getToggle())
    expect(label()).toBe('Switch to dark theme')
    fireEvent.click(getToggle())
    expect(label()).toBe('Switch to light theme')
  })

  it('swaps to the hover background while hovered and back on leave, without touching the icon or label', () => {
    startIn('light')
    render(<ThemeToggle />)
    const button = getToggle()

    expect(button.style.background).toBe('var(--pill-bg)')

    fireEvent.mouseEnter(button)
    expect(button.style.background).toBe('var(--pill-bg-hover)')
    expect(screen.getByTestId('icon-moon')).toBeTruthy()
    expect(label()).toBe('Switch to dark theme')

    fireEvent.mouseLeave(button)
    expect(button.style.background).toBe('var(--pill-bg)')
    expect(screen.getByTestId('icon-moon')).toBeTruthy()
    expect(label()).toBe('Switch to dark theme')
  })
})
