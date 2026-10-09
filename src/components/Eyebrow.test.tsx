// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { Eyebrow } from './Eyebrow'

// Eyebrow labels the top of every step tile. Its two optional props each have
// a default, so both the defaulted and the overridden path are exercised here
// — a dropped default would change the spacing or colour of every step at once.

describe('Eyebrow', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('renders its children', () => {
    render(<Eyebrow>Step one</Eyebrow>)

    expect(screen.getByText('Step one')).toBeTruthy()
  })

  it('falls back to the tertiary text colour and an 18px gap when no props are given', () => {
    render(<Eyebrow>Defaults</Eyebrow>)

    const eyebrow = screen.getByText('Defaults')
    expect(eyebrow.style.color).toBe('var(--text-tertiary)')
    expect(eyebrow.style.marginBottom).toBe('18px')
  })

  it('honours an explicit colour and marginBottom over the defaults', () => {
    render(
      <Eyebrow color="var(--accent)" marginBottom={0}>
        Overridden
      </Eyebrow>,
    )

    const eyebrow = screen.getByText('Overridden')
    expect(eyebrow.style.color).toBe('var(--accent)')
    // 0 is a meaningful value here: it must survive rather than being
    // treated as absent and replaced by the 18px default.
    expect(eyebrow.style.marginBottom).toBe('0px')
  })

  it('renders non-text children', () => {
    render(
      <Eyebrow>
        <span data-testid="child-node">Nested</span>
      </Eyebrow>,
    )

    expect(screen.getByTestId('child-node')).toBeTruthy()
  })

  it('renders without logging a console error or warning', () => {
    // React reports key/prop/nesting mistakes through console.error
    // rather than by throwing, so a clean render is worth asserting:
    // the label would still appear with a warning behind it.
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    render(<Eyebrow>Quiet</Eyebrow>)

    expect(error).not.toHaveBeenCalled()
    expect(warn).not.toHaveBeenCalled()
  })
})
