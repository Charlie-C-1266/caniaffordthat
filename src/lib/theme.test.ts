// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { applyTheme, isTheme, prefersLightScheme, readStoredTheme, resolveInitialTheme, storeTheme, THEME_STORAGE_KEY } from './theme'

/** jsdom doesn't implement matchMedia — stub it to report a fixed light/dark preference. */
function stubMatchMedia(matches: boolean) {
  const listener = vi.fn()
  const matchMedia = vi.fn().mockReturnValue({ matches, addEventListener: listener, removeEventListener: listener })
  vi.stubGlobal('matchMedia', matchMedia)
  return matchMedia
}

beforeEach(() => {
  localStorage.clear()
  document.documentElement.removeAttribute('data-theme')
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('isTheme', () => {
  it('accepts only "light" and "dark"', () => {
    expect(isTheme('light')).toBe(true)
    expect(isTheme('dark')).toBe(true)
  })

  it('rejects null, empty, and anything else — including a stale "system" value from a hypothetical future build', () => {
    expect(isTheme(null)).toBe(false)
    expect(isTheme('')).toBe(false)
    expect(isTheme('system')).toBe(false)
    expect(isTheme('Light')).toBe(false) // case-sensitive
    expect(isTheme('true')).toBe(false)
  })
})

describe('prefersLightScheme', () => {
  it('reflects a light OS preference', () => {
    stubMatchMedia(true)
    expect(prefersLightScheme()).toBe(true)
  })

  it('reflects a dark OS preference', () => {
    stubMatchMedia(false)
    expect(prefersLightScheme()).toBe(false)
  })

  it('queries prefers-color-scheme: light, not dark — an inverted query here would flip every default', () => {
    const matchMedia = stubMatchMedia(false)
    prefersLightScheme()
    expect(matchMedia).toHaveBeenCalledWith('(prefers-color-scheme: light)')
  })
})

describe('readStoredTheme', () => {
  it('returns null when nothing is stored', () => {
    expect(readStoredTheme()).toBeNull()
  })

  it('returns the stored value when valid', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'light')
    expect(readStoredTheme()).toBe('light')
  })

  it('returns null (not the raw value) for a garbage stored value, rather than trusting it', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'system')
    expect(readStoredTheme()).toBeNull()
  })

  it('returns null rather than throwing when localStorage.getItem itself throws (e.g. Safari private mode)', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage unavailable')
    })
    expect(readStoredTheme()).toBeNull()
  })
})

describe('storeTheme', () => {
  it('writes the exact key and value', () => {
    storeTheme('light')
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light')
    storeTheme('dark')
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
  })

  it('does not throw when localStorage.setItem throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage unavailable')
    })
    expect(() => storeTheme('light')).not.toThrow()
  })
})

describe('resolveInitialTheme', () => {
  it('prefers a stored choice over the OS preference', () => {
    stubMatchMedia(true) // OS says light...
    localStorage.setItem(THEME_STORAGE_KEY, 'dark') // ...but the user already chose dark
    expect(resolveInitialTheme()).toBe('dark')
  })

  it('falls back to the OS preference when nothing is stored', () => {
    stubMatchMedia(true)
    expect(resolveInitialTheme()).toBe('light')
  })

  it('falls back to dark — the safe, pre-existing default — when nothing is stored and the OS prefers dark', () => {
    stubMatchMedia(false)
    expect(resolveInitialTheme()).toBe('dark')
  })
})

describe('applyTheme', () => {
  it('sets data-theme="light" for light', () => {
    applyTheme('light')
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })

  it('removes the attribute for dark, rather than setting it to "dark"', () => {
    document.documentElement.setAttribute('data-theme', 'light')
    applyTheme('dark')
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false)
  })
})
