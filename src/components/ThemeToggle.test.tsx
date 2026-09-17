// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { ThemeToggle } from './ThemeToggle'
import type { Theme } from '../lib/theme'

// The component under test is pure wiring: useTheme in, a button with the
// right icon and aria-label out. Mock the hook so each theme branch can be
// rendered directly, and the icon registry so the chosen glyph is assertable
// without depending on lucide's SVG markup.
const toggleTheme = vi.fn()
let mockTheme: Theme = 'light'

vi.mock('../hooks/useTheme', () => ({
  useTheme: () => ({ theme: mockTheme, toggleTheme, setTheme: vi.fn() }),
}))

vi.mock('./Icon', () => ({
  Icon: ({ name }: { name: string }) => <span data-testid={`icon-${name}`} />,
}))

const getToggle = () => screen.getByTestId('theme-toggle')

describe('ThemeToggle', () => {
  beforeEach(() => toggleTheme.mockClear())
  afterEach(cleanup)

  it('calls toggleTheme when clicked', () => {
    render(<ThemeToggle />)
    fireEvent.click(getToggle())
    expect(toggleTheme).toHaveBeenCalledTimes(1)
  })

  it('while light, shows the moon icon and offers to switch to dark', () => {
    mockTheme = 'light'
    render(<ThemeToggle />)
    // Icon-toggle convention: show the theme you'd switch *to*.
    expect(screen.getByTestId('icon-moon')).toBeTruthy()
    expect(screen.queryByTestId('icon-sun')).toBeNull()
    expect(getToggle().getAttribute('aria-label')).toBe('Switch to dark theme')
  })

  it('swaps to the hover background while hovered and back on leave', () => {
    render(<ThemeToggle />)
    const button = getToggle()
    expect(button.style.background).toBe('var(--pill-bg)')
    fireEvent.mouseEnter(button)
    expect(button.style.background).toBe('var(--pill-bg-hover)')
    fireEvent.mouseLeave(button)
    expect(button.style.background).toBe('var(--pill-bg)')
  })

  it('while dark, shows the sun icon and offers to switch to light', () => {
    mockTheme = 'dark'
    render(<ThemeToggle />)
    expect(screen.getByTestId('icon-sun')).toBeTruthy()
    expect(screen.queryByTestId('icon-moon')).toBeNull()
    expect(getToggle().getAttribute('aria-label')).toBe('Switch to light theme')
  })
})
