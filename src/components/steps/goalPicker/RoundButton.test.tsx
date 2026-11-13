// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup, screen, fireEvent } from '@testing-library/react'
import { RoundButton } from './RoundButton'

// The carousel's two arrows. The button holds only an icon, so `label` is the
// *entire* accessible name — without it a screen reader announces an unnamed
// button and the carousel becomes unusable. The `carousel-arrow` class is the
// other contract: the hover state lives in index.css rather than in a
// mouseenter handler, precisely so a tap can't leave an arrow stuck
// highlighted (#205). Drop the class and that regression returns silently,
// since nothing here renders differently.

describe('RoundButton', () => {
  afterEach(cleanup)

  it('exposes `label` as its accessible name, the only name an icon button has', () => {
    render(<RoundButton icon="chevron-left" label="Previous goal" onClick={() => {}} />)

    expect(screen.getByRole('button', { name: 'Previous goal' })).toBeDefined()
  })

  it('names each arrow for its own direction', () => {
    render(<RoundButton icon="chevron-right" label="Next goal" onClick={() => {}} />)

    expect(screen.getByRole('button', { name: 'Next goal' })).toBeDefined()
  })

  it('fires onClick once per click', () => {
    const onClick = vi.fn()
    render(<RoundButton icon="chevron-left" label="Previous goal" onClick={onClick} />)

    fireEvent.click(screen.getByRole('button'))

    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it("fires once per click across repeated clicks, so a held press can't double-step", () => {
    const onClick = vi.fn()
    render(<RoundButton icon="chevron-right" label="Next goal" onClick={onClick} />)
    const button = screen.getByRole('button')

    fireEvent.click(button)
    fireEvent.click(button)
    fireEvent.click(button)

    expect(onClick).toHaveBeenCalledTimes(3)
  })

  it('carries the `carousel-arrow` class the CSS hover relies on (#205)', () => {
    render(<RoundButton icon="chevron-left" label="Previous goal" onClick={() => {}} />)

    expect(screen.getByRole('button').className).toBe('carousel-arrow')
  })

  it('sets no inline background, leaving the hover entirely to the stylesheet', () => {
    // An inline background would win over the class and re-break #205.
    render(<RoundButton icon="chevron-left" label="Previous goal" onClick={() => {}} />)

    expect(screen.getByRole('button').style.background).toBe('')
  })

  it('is a type="button", so it never submits a form', () => {
    render(<RoundButton icon="chevron-left" label="Previous goal" onClick={() => {}} />)

    expect(screen.getByRole('button').getAttribute('type')).toBe('button')
  })

  it('is a fixed-size circle that the flex row cannot squash', () => {
    render(<RoundButton icon="chevron-left" label="Previous goal" onClick={() => {}} />)
    const button = screen.getByRole('button')

    expect(button.style.borderRadius).toBe('50%')
    expect(button.style.width).toBe('var(--goal-nav-size)')
    expect(button.style.height).toBe('var(--goal-nav-size)')
    expect(button.style.flexShrink).toBe('0')
  })

  it('renders the icon it was given, and nothing else', () => {
    const { container } = render(<RoundButton icon="chevron-right" label="Next goal" onClick={() => {}} />)

    const svg = container.querySelector('svg')
    expect(svg).not.toBeNull()
    // Decorative: the label already names the button, so the icon must not
    // add a second, competing name.
    expect(screen.getByRole('button').textContent).toBe('')
  })
})
