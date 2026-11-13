// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup, screen } from '@testing-library/react'
import { LandingPill } from './LandingPill'

// The reassurance line under the carousel. It takes no props and holds no
// state, so there is one thing to hold it to: the exact promise it makes.
// That wording is the landing page's value prop, carried over from the old
// title card, so a silent edit to it is a product change — this file makes it
// show up as a failing test.

describe('LandingPill', () => {
  afterEach(cleanup)

  it('makes the three promises the landing page is built on', () => {
    render(<LandingPill />)

    expect(screen.getByText('Free · no sign-up · takes 2 minutes')).toBeDefined()
  })

  it('renders as static text, with nothing for the user to click', () => {
    const { container } = render(<LandingPill />)

    expect(container.querySelectorAll('button, a, input')).toHaveLength(0)
  })

  it('is a pill: a rounded, inline-flex container holding the dot and the text', () => {
    // The shape is the component — a "pill" that stopped being pill-shaped
    // would be a regression no text assertion above would catch.
    const pill = render(<LandingPill />).container.firstElementChild as HTMLElement

    expect(pill.style.display).toBe('inline-flex')
    expect(pill.style.borderRadius).toBe('99px')
    expect(pill.children).toHaveLength(2)
  })

  it('leads with the mint status dot, which carries the glow', () => {
    const [dot] = Array.from((render(<LandingPill />).container.firstElementChild as HTMLElement).children) as HTMLElement[]

    expect(dot.style.borderRadius).toBe('50%')
    expect(dot.style.background).toBe('var(--accent-save)')
    expect(dot.style.boxShadow).toBe('0 0 10px var(--accent-save)')
  })
})
