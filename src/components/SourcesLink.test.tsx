// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { SourcesLink } from './SourcesLink'

const getLink = () => screen.getByTestId('sources-link')

describe('SourcesLink', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('links out to the sources page in a new tab, without leaking the referrer', () => {
    render(<SourcesLink />)
    const link = getLink()
    expect(link.getAttribute('href')).toBe('/sources/')
    expect(link.getAttribute('target')).toBe('_blank')
    // A mid-flow click must not cost the user the figures they've typed, and
    // noopener/noreferrer is the standard guard on a new-tab link.
    expect(link.getAttribute('rel')).toBe('noopener noreferrer')
    expect(link.textContent).toBe('Our sources')
  })

  it('takes its background from the `.pill-control` class, not an inline style, so the CSS hover can apply', () => {
    // jsdom can't evaluate `:hover` or media queries, so the hover itself, and
    // that a tap can't set it off, is proven in a real browser by
    // e2e/pill-hover-touch.spec.ts. What can be pinned here is the part that
    // would silently break it: an inline background beats any CSS rule.
    render(<SourcesLink />)
    const control = getLink()
    expect(control.classList.contains('pill-control')).toBe(true)
    expect(control.style.background).toBe('')
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
