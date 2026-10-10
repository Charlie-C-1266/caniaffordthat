// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { REDUCED_MOTION_QUERY, prefersReducedMotion, scrollBehaviour } from './motion'

/**
 * jsdom has no `matchMedia`, so each test installs one that answers for the
 * reduced-motion query only — and asserts it was asked that exact query,
 * since a typo'd media string matches nothing and would silently read as "no
 * preference".
 */
function stubMatchMedia(matches: boolean) {
  const matchMedia = vi.fn((query: string) => ({ matches: query === REDUCED_MOTION_QUERY && matches }) as MediaQueryList)
  vi.stubGlobal('matchMedia', matchMedia)
  return matchMedia
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('prefersReducedMotion', () => {
  it('is true when the OS asks for reduced motion', () => {
    const matchMedia = stubMatchMedia(true)
    expect(prefersReducedMotion()).toBe(true)
    expect(matchMedia).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)')
  })

  it('is false when no preference is set', () => {
    stubMatchMedia(false)
    expect(prefersReducedMotion()).toBe(false)
  })

  // The safe default: an environment without matchMedia keeps the normal
  // animation rather than disabling motion for everyone.
  it('is false when matchMedia is unavailable', () => {
    vi.stubGlobal('matchMedia', undefined)
    expect(prefersReducedMotion()).toBe(false)
  })

  // Read per call, so someone toggling the OS setting mid-session is honoured
  // without a reload.
  it('re-reads the setting on every call', () => {
    const matchMedia = stubMatchMedia(false)
    expect(prefersReducedMotion()).toBe(false)
    stubMatchMedia(true)
    expect(prefersReducedMotion()).toBe(true)
    expect(matchMedia).toHaveBeenCalledTimes(1)
  })
})

describe('scrollBehaviour', () => {
  it('is instant under reduced motion', () => {
    stubMatchMedia(true)
    expect(scrollBehaviour()).toBe('auto')
  })

  it('is smooth with no preference', () => {
    stubMatchMedia(false)
    expect(scrollBehaviour()).toBe('smooth')
  })

  it('is smooth when matchMedia is unavailable', () => {
    vi.stubGlobal('matchMedia', undefined)
    expect(scrollBehaviour()).toBe('smooth')
  })
})
