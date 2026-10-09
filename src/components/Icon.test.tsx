// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { Icon, ICON_NAMES } from './Icon'
import { GOALS } from '../lib/goals'

// Icon is the one indirection between a name string and a Lucide glyph, used
// by seven files. The registry is walked rather than hand-listed, so a newly
// added icon is covered the moment it's registered, and the goal config's
// names are checked against the registry at runtime too — the compiler
// already rejects a typo, but a registry key removed while a goal still
// points at it would otherwise only surface as a crash in the browser.

/** The single `<svg>` Lucide renders for an icon. */
function glyph(container: HTMLElement): SVGSVGElement {
  const svg = container.querySelector('svg')
  if (!svg) throw new Error('expected Icon to render an svg')
  return svg
}

describe('Icon', () => {
  afterEach(cleanup)

  it('registers at least the icons the UI needs', () => {
    // Guards against the registry being emptied or the export going stale:
    // without this, every it.each below would vacuously pass on zero cases.
    expect(ICON_NAMES.length).toBeGreaterThan(10)
  })

  it.each(ICON_NAMES)('renders %s as a Lucide svg, hidden from assistive tech', (name) => {
    const { container } = render(<Icon name={name} />)
    const icon = glyph(container)
    expect(icon.getAttribute('class')).toContain('lucide')
    // Decorative by design: the surrounding copy carries the meaning, so the
    // glyph must never be announced.
    expect(icon.getAttribute('aria-hidden')).toBe('true')
  })

  it('applies the design defaults when no sizing props are given', () => {
    const icon = glyph(render(<Icon name="house" />).container)
    expect(icon.getAttribute('width')).toBe('24')
    expect(icon.getAttribute('height')).toBe('24')
    expect(icon.getAttribute('stroke')).toBe('currentColor')
    expect(icon.getAttribute('stroke-width')).toBe('1.8')
  })

  it('applies size, color and strokeWidth overrides', () => {
    const icon = glyph(render(<Icon name="car" size={40} color="var(--accent-save)" strokeWidth={2.4} />).container)
    expect(icon.getAttribute('width')).toBe('40')
    expect(icon.getAttribute('height')).toBe('40')
    expect(icon.getAttribute('stroke')).toBe('var(--accent-save)')
    expect(icon.getAttribute('stroke-width')).toBe('2.4')
  })

  it('honours a zero size rather than falling back to the default', () => {
    // `size={0}` is falsy: a `size || 24` style default would silently render
    // a 24px icon where the caller asked for none.
    const icon = glyph(render(<Icon name="x" size={0} />).container)
    expect(icon.getAttribute('width')).toBe('0')
    expect(icon.getAttribute('height')).toBe('0')
  })

  it('renders a different glyph per name', () => {
    const house = glyph(render(<Icon name="house" />).container).getAttribute('class')
    const car = glyph(render(<Icon name="car" />).container).getAttribute('class')
    expect(house).not.toBe(car)
  })

  it.each(GOALS.map((goal) => [goal.id, goal.icon] as const))('resolves the %s goal icon (%s) to a registered glyph', (_id, icon) => {
    expect(ICON_NAMES).toContain(icon)
    expect(glyph(render(<Icon name={icon} />).container).getAttribute('class')).toContain('lucide')
  })
})
