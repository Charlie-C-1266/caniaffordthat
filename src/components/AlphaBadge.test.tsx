// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { AlphaBadge } from './AlphaBadge'

// The badge is the persistent "this is an early build" signal. It takes no
// props, so the only things worth pinning are the label it shows and the
// title text that explains what "alpha" means on hover.

describe('AlphaBadge', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('renders the Alpha label', () => {
    render(<AlphaBadge />)

    // Rendered lowercase and uppercased in CSS, so assert the DOM text.
    expect(screen.getByText('Alpha')).toBeTruthy()
  })

  it('explains what alpha means in its title tooltip', () => {
    render(<AlphaBadge />)

    expect(screen.getByTitle(/Early alpha — expect bugs, missing polish, and frequent changes/)).toBeTruthy()
  })

  it('is decorative: not a button or link, and not focusable', () => {
    render(<AlphaBadge />)

    const badge = screen.getByText('Alpha')
    expect(badge.tagName).toBe('SPAN')
    expect(badge.getAttribute('tabindex')).toBeNull()
    expect(badge.style.cursor).toBe('default')
  })

  it('renders without logging a console error or warning', () => {
    // React reports key/prop/nesting mistakes through console.error
    // rather than by throwing, so a clean render is worth asserting:
    // the badge would still appear with a warning behind it.
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    render(<AlphaBadge />)

    expect(error).not.toHaveBeenCalled()
    expect(warn).not.toHaveBeenCalled()
  })
})
