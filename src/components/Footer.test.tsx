// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { Footer } from './Footer'

// The footer is the app's only home for three user-facing obligations: the
// alpha warning, the "not financial advice" disclaimer, and the feedback
// address. None of them is enforced anywhere else, so a silent deletion or a
// mistyped mailto would ship unnoticed. These tests assert on the rendered
// copy and the href, not on the markup around them.

/** The feedback address, duplicated in the docs pages and README — see the PR note. */
const FEEDBACK_EMAIL = 'hello@caniaffordthat.co.uk'

describe('Footer', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('leads with the early-alpha notice', () => {
    render(<Footer />)

    // The notice is split across an emphasised <strong>, so match the
    // surrounding sentence by its text content rather than a single node.
    expect(screen.getByText(/Heads up: Can I Afford That\? is currently in/)).toBeTruthy()
    expect(screen.getByText('early alpha')).toBeTruthy()
    expect(screen.getByText(/expect bugs, rough edges, and things changing/)).toBeTruthy()
  })

  it('carries the estimates-only / not-financial-advice disclaimer', () => {
    render(<Footer />)

    expect(screen.getByText(/It provides estimates for illustrative purposes only/)).toBeTruthy()
    expect(screen.getByText(/It is not financial advice/)).toBeTruthy()
    // The disclaimer's substance: results are only as good as the inputs, and
    // a qualified adviser is the backstop for real decisions.
    expect(screen.getByText(/results depend entirely on the figures you/)).toBeTruthy()
    expect(screen.getByText(/speak to a qualified\s+financial adviser/)).toBeTruthy()
  })

  it('offers the feedback address as a mailto link with a prefilled subject', () => {
    render(<Footer />)

    const link = screen.getByRole('link', { name: FEEDBACK_EMAIL })
    expect(link.getAttribute('href')).toBe(`mailto:${FEEDBACK_EMAIL}?subject=Can%20I%20Afford%20That%3F%20feedback`)
    // The visible text is the bare address, so a reader can copy it by eye
    // even where mailto: links don't resolve.
    expect(link.textContent).toBe(FEEDBACK_EMAIL)
  })

  it('renders as a <footer> landmark with no props', () => {
    const { container } = render(<Footer />)

    expect(container.querySelector('footer')).toBeTruthy()
    expect(screen.getByRole('contentinfo')).toBeTruthy()
  })

  it('renders without logging a console error or warning', () => {
    // React reports key/prop/nesting mistakes through console.error
    // rather than by throwing, so a clean render is worth asserting:
    // the alpha notice, disclaimer and mailto link would still appear with a warning behind it.
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    render(<Footer />)

    expect(error).not.toHaveBeenCalled()
    expect(warn).not.toHaveBeenCalled()
  })
})
