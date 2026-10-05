// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { SourcesLink } from './SourcesLink'

// This pill is the only route to the annotated source list, and it has to open
// in a new tab: the app holds the whole flow in memory, so navigating the
// current tab away mid-flow would throw away everything typed so far. The
// target/rel pair and the href are the things that must not drift.

describe('SourcesLink', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('points at the sources page', () => {
    render(<SourcesLink />)

    const link = screen.getByRole('link', { name: 'Our sources' })
    expect(link.getAttribute('href')).toBe('/sources/')
  })

  it('opens in a new tab so figures typed mid-flow survive', () => {
    render(<SourcesLink />)

    const link = screen.getByRole('link', { name: 'Our sources' })
    expect(link.getAttribute('target')).toBe('_blank')

    // target="_blank" without both tokens hands the opened page a live
    // window.opener handle and leaks the referrer.
    const rel = link.getAttribute('rel') ?? ''
    expect(rel).toContain('noopener')
    expect(rel).toContain('noreferrer')
  })

  it('swaps to the hover background on pointer enter and back on leave', () => {
    render(<SourcesLink />)

    const link = screen.getByRole('link', { name: 'Our sources' })
    expect(link.style.background).toBe('var(--pill-bg)')

    fireEvent.mouseEnter(link)
    expect(link.style.background).toBe('var(--pill-bg-hover)')

    // Leaving restores the resting token. (Touch devices can strand the
    // hovered style — that's #116's fix, deliberately not asserted here.)
    fireEvent.mouseLeave(link)
    expect(link.style.background).toBe('var(--pill-bg)')
  })

  it('renders with no props and keeps the pill border token', () => {
    render(<SourcesLink />)

    const link = screen.getByRole('link', { name: 'Our sources' })
    expect(link.style.border).toBe('1px solid var(--pill-border)')
    expect(link.style.textDecoration).toBe('none')
  })

  it('renders without logging a console error or warning', () => {
    // React reports key/prop/nesting mistakes through console.error
    // rather than by throwing, so a clean render is worth asserting:
    // the pill would still appear with a warning behind it.
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    render(<SourcesLink />)

    expect(error).not.toHaveBeenCalled()
    expect(warn).not.toHaveBeenCalled()
  })
})
