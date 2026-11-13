// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup, screen, fireEvent } from '@testing-library/react'
import { MethodChip } from './MethodChip'
import { METHOD_OPTIONS } from './methodOptions'
import type { MethodOption } from './methodOptions'

// One purchase-method chip. The chip shows the icon and short name only; the
// honest one-liner about the trade-off lives in `title`, and is the single
// piece of information the chip holds that isn't on screen — so a chip that
// lost its tooltip would be a chip that silently stopped explaining itself.
//
// The icon's colour is also load-bearing here rather than decorative: with
// four chips in a row and only a border and an icon tint marking the chosen
// one, a stuck icon colour makes the selection genuinely hard to read.

const ACCENT = 'rgb(139, 92, 246)'
const [cash, pcp] = METHOD_OPTIONS

/** The chip under test, with a real option so these tests track the live copy. */
const chipFor = (option: MethodOption, overrides: { active?: boolean; onSelect?: () => void } = {}) => (
  <MethodChip option={option} active={false} accentColor={ACCENT} onSelect={() => {}} {...overrides} />
)

/** The chip's rendered `<svg>`. Icon hands `color` to Lucide, which renders it as the `stroke` attribute. */
function iconOf(container: HTMLElement): SVGElement {
  const svg = container.querySelector('svg')
  if (svg === null) throw new Error('expected MethodChip to render an icon')
  return svg
}

describe('MethodChip', () => {
  afterEach(cleanup)

  it('covers all four real methods, so no option is left untested', () => {
    expect(METHOD_OPTIONS.map((option) => option.value)).toEqual(['cash', 'pcp', 'hp', 'loan'])
  })

  it('shows the short label, which is the whole visible name', () => {
    render(chipFor(pcp))

    expect(screen.getByRole('button', { name: pcp.label }).textContent).toBe(pcp.label)
  })

  it('reports aria-pressed="false" when the method is not selected', () => {
    render(chipFor(cash, { active: false }))

    expect(screen.getByRole('button').getAttribute('aria-pressed')).toBe('false')
  })

  it('reports aria-pressed="true" when it is', () => {
    render(chipFor(cash, { active: true }))

    expect(screen.getByRole('button').getAttribute('aria-pressed')).toBe('true')
  })

  it("puts the option's blurb in `title`, verbatim", () => {
    render(chipFor(pcp))

    expect(screen.getByRole('button').getAttribute('title')).toBe(pcp.blurb)
  })

  it.each(METHOD_OPTIONS.map((option) => [option.label, option] as const))(
    "carries %s's own blurb rather than a shared one",
    (label, option) => {
      render(chipFor(option))
      const button = screen.getByRole('button')

      expect(button.textContent).toBe(label)
      expect(button.getAttribute('title')).toBe(option.blurb)
    },
  )

  it('calls onSelect once per click', () => {
    const onSelect = vi.fn()
    render(chipFor(pcp, { onSelect }))

    fireEvent.click(screen.getByRole('button'))

    expect(onSelect).toHaveBeenCalledTimes(1)
  })

  it('still calls onSelect when it is already the selected method', () => {
    // The chip is not disabled when active, so the parent decides what a
    // re-select means — the chip must keep reporting it.
    const onSelect = vi.fn()
    render(chipFor(pcp, { active: true, onSelect }))

    fireEvent.click(screen.getByRole('button'))

    expect(onSelect).toHaveBeenCalledTimes(1)
  })

  it('tints the icon with the accent when active', () => {
    const { container } = render(chipFor(cash, { active: true }))

    expect(iconOf(container).getAttribute('stroke')).toBe(ACCENT)
  })

  it('falls back to the tertiary text token when inactive', () => {
    const { container } = render(chipFor(cash, { active: false }))

    expect(iconOf(container).getAttribute('stroke')).toBe('var(--text-tertiary)')
  })

  it('takes the accent border and selected surface when active', () => {
    render(chipFor(cash, { active: true }))
    const button = screen.getByRole('button')

    expect(button.style.border).toBe(`var(--border-width-card) solid ${ACCENT}`)
    expect(button.style.background).toBe('var(--surface-selected)')
  })

  it('shows the underline border and no background when inactive', () => {
    render(chipFor(cash, { active: false }))
    const button = screen.getByRole('button')

    expect(button.style.border).toBe('var(--border-width-card) solid var(--input-underline)')
    expect(button.style.background).toBe('transparent')
  })

  it('passes the accent through, rather than assuming the finance violet', () => {
    const { container } = render(<MethodChip option={cash} active accentColor="rgb(16, 185, 129)" onSelect={() => {}} />)

    expect(iconOf(container).getAttribute('stroke')).toBe('rgb(16, 185, 129)')
    expect(screen.getByRole('button').style.border).toContain('rgb(16, 185, 129)')
  })

  it('keeps all four chips the same width in their single row', () => {
    render(chipFor(cash))

    // jsdom expands the shorthand: `flex: 1` is `1 1 0%`.
    expect(screen.getByRole('button').style.flex).toBe('1 1 0%')
  })
})
