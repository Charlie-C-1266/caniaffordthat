// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { Tile } from './Tile'

// Tile carries the card chrome for eight screens, so a dropped border or
// background token would strip every step at once. The `style` prop is the
// risky part: it spreads last, so these assert both that a caller can
// override a single property and that doing so leaves the rest of the card
// intact.

/** The tile's own element — the only child the component renders. */
function tile(container: HTMLElement): HTMLElement {
  const el = container.firstElementChild
  if (!(el instanceof HTMLElement)) throw new Error('expected Tile to render an element')
  return el
}

describe('Tile', () => {
  afterEach(cleanup)

  it('renders its children inside the card', () => {
    const { container } = render(
      <Tile maxWidth={420} padding="24px 20px">
        <p>Step content</p>
      </Tile>,
    )
    expect(tile(container).contains(screen.getByText('Step content'))).toBe(true)
  })

  it('applies maxWidth as a pixel length and padding verbatim', () => {
    const { container } = render(
      <Tile maxWidth={420} padding="24px 20px">
        content
      </Tile>,
    )
    expect(tile(container).style.maxWidth).toBe('420px')
    expect(tile(container).style.padding).toBe('24px 20px')
  })

  it('keeps the card chrome tokens when no style prop is given', () => {
    const { container } = render(
      <Tile maxWidth={300} padding="16px">
        content
      </Tile>,
    )
    const { style } = tile(container)
    expect(style.background).toBe('var(--tile-bg-neutral)')
    expect(style.borderRadius).toBe('var(--radius-tile)')
    expect(style.boxShadow).toBe('var(--shadow-tile)')
    expect(tile(container).getAttribute('style')).toContain('var(--border-width-card) solid var(--tile-border)')
    expect(style.width).toBe('100%')
    expect(style.boxSizing).toBe('border-box')
  })

  it('merges an unrelated style prop without dropping the border or background tokens', () => {
    const { container } = render(
      <Tile maxWidth={300} padding="16px" style={{ marginTop: 12 }}>
        content
      </Tile>,
    )
    const el = tile(container)
    expect(el.style.marginTop).toBe('12px')
    expect(el.style.background).toBe('var(--tile-bg-neutral)')
    expect(el.getAttribute('style')).toContain('var(--tile-border)')
  })

  it('lets a style prop override a base property while the others stand', () => {
    const { container } = render(
      <Tile maxWidth={300} padding="16px" style={{ background: 'var(--tile-bg)', maxWidth: 999 }}>
        content
      </Tile>,
    )
    const el = tile(container)
    expect(el.style.background).toBe('var(--tile-bg)')
    expect(el.style.maxWidth).toBe('999px')
    // Untouched chrome survives the override.
    expect(el.style.boxShadow).toBe('var(--shadow-tile)')
    expect(el.getAttribute('style')).toContain('var(--tile-border)')
  })

  it('renders with an empty style object and empty children', () => {
    const { container } = render(
      <Tile maxWidth={200} padding="0" style={{}}>
        {null}
      </Tile>,
    )
    expect(tile(container).style.background).toBe('var(--tile-bg-neutral)')
    expect(tile(container).textContent).toBe('')
  })
})
