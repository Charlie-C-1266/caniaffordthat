// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { RevealTile } from './RevealTile'

// Every step tile in the app mounts through this wrapper, and it hides purely
// via CSS (opacity/transform) rather than conditional mounting — so the two
// style branches getting inverted, or an explicit `style` prop silently
// clobbering them, would hide every step in the app with nothing else in the
// suite noticing. Assert the rendered inline styles directly.

/** RevealTile renders a single bare wrapper div, so the container's first child *is* the component. */
const renderTile = (ui: React.ReactElement) => {
  const { container } = render(ui)
  return container.firstElementChild as HTMLElement
}

describe('RevealTile', () => {
  afterEach(cleanup)

  it('while not yet revealed, is transparent and offset below its resting position', () => {
    const tile = renderTile(<RevealTile revealed={false}>content</RevealTile>)
    expect(tile.style.opacity).toBe('0')
    expect(tile.style.transform).toBe('translateY(56px)')
  })

  it('once revealed, is fully opaque and at its resting position', () => {
    const tile = renderTile(<RevealTile revealed={true}>content</RevealTile>)
    expect(tile.style.opacity).toBe('1')
    expect(tile.style.transform).toBe('translateY(0)')
  })

  it('renders children in both states rather than mounting them on reveal', () => {
    // The slide-up transition only animates because the subtree is already
    // mounted and painted while hidden. Conditional mounting would look
    // identical at rest and break the animation entirely.
    const hidden = renderTile(
      <RevealTile revealed={false}>
        <span data-testid="child">Still here</span>
      </RevealTile>,
    )
    expect(hidden.style.opacity).toBe('0')
    expect(screen.getByTestId('child').textContent).toBe('Still here')

    cleanup()

    render(
      <RevealTile revealed={true}>
        <span data-testid="child">Still here</span>
      </RevealTile>,
    )
    expect(screen.getByTestId('child').textContent).toBe('Still here')
  })

  it('transitions both transform and opacity, so the reveal animates instead of snapping', () => {
    const tile = renderTile(<RevealTile revealed={false}>content</RevealTile>)
    expect(tile.style.transition).toContain('transform')
    expect(tile.style.transition).toContain('opacity')
  })

  it('merges a caller-supplied style prop in alongside its own reveal styling', () => {
    // Callers (StepPanel and friends) layer layout on top of the reveal; both
    // must survive, so neither the spread nor the reveal styles may win
    // outright.
    const tile = renderTile(
      <RevealTile revealed={false} style={{ marginTop: 10 }}>
        content
      </RevealTile>,
    )
    expect(tile.style.marginTop).toBe('10px')
    expect(tile.style.opacity).toBe('0')
    expect(tile.style.transform).toBe('translateY(56px)')
  })

  it('lets a caller deliberately override the reveal styling it names', () => {
    // The `...style` spread lands last on purpose: a caller that explicitly
    // sets opacity means it. Pin that precedence so reordering the spread —
    // which would silently make callers' overrides no-ops — fails here.
    const tile = renderTile(
      <RevealTile revealed={false} style={{ opacity: 0.5 }}>
        content
      </RevealTile>,
    )
    expect(tile.style.opacity).toBe('0.5')
  })
})
