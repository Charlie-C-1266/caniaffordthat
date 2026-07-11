// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTheme } from './useTheme'
import { THEME_STORAGE_KEY } from '../lib/theme'

beforeEach(() => {
  localStorage.clear()
  document.documentElement.removeAttribute('data-theme')
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useTheme', () => {
  it('initializes from whatever data-theme is already on <html> — it does not re-decide the theme', () => {
    document.documentElement.setAttribute('data-theme', 'light')
    const { result } = renderHook(() => useTheme())
    expect(result.current.theme).toBe('light')
  })

  it('initializes to dark when <html> has no data-theme attribute', () => {
    const { result } = renderHook(() => useTheme())
    expect(result.current.theme).toBe('dark')
  })

  it('setTheme updates the returned theme, the DOM attribute, and persists the choice', () => {
    const { result } = renderHook(() => useTheme())

    act(() => result.current.setTheme('light'))

    expect(result.current.theme).toBe('light')
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light')
  })

  it('toggleTheme flips dark to light and back', () => {
    const { result } = renderHook(() => useTheme())
    expect(result.current.theme).toBe('dark')

    act(() => result.current.toggleTheme())
    expect(result.current.theme).toBe('light')

    act(() => result.current.toggleTheme())
    expect(result.current.theme).toBe('dark')
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false)
  })

  it('two independent mounts (simulating two of the app\'s three React roots) each reflect the same shared DOM/storage state', () => {
    const a = renderHook(() => useTheme())
    const b = renderHook(() => useTheme())

    act(() => a.result.current.setTheme('light'))

    // b doesn't automatically re-render from a's change (no shared Context —
    // by design, see useTheme's doc comment), but a fresh mount picks up the
    // DOM state a just set, proving the two roots aren't fighting over it.
    const c = renderHook(() => useTheme())
    expect(c.result.current.theme).toBe('light')
    expect(b.result.current.theme).toBe('dark')
  })

  it('never registers a matchMedia "change" listener — an explicit choice must stick, not snap back if the OS setting changes later', () => {
    const addEventListener = vi.fn()
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false, addEventListener, removeEventListener: vi.fn() }))

    const { result } = renderHook(() => useTheme())
    act(() => result.current.toggleTheme())

    expect(addEventListener).not.toHaveBeenCalledWith('change', expect.anything())
    vi.unstubAllGlobals()
  })
})
