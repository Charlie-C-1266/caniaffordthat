// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup, screen, fireEvent } from '@testing-library/react'
import { GoalCard } from './GoalCard'
import { GOALS } from '../../../lib/goals'
import type { Goal } from '../../../lib/goals'

// A cover-flow card in the goal carousel. Three things here are genuinely
// load-bearing and invisible to a text-only test:
//
//  1. `cardGeometry` is the carousel. The transform, opacity, z-index and
//     pointer-events all come from one number — the card's distance from
//     centre — and they are the whole illusion. Here the style *is* the
//     contract, so these tests read it directly.
//  2. The transform is written as an explicit `- 2 * step` / `+ 2 * step`
//     rather than a signed multiplier, because a signed one produces
//     `calc(-50% + -2 * ...)`, which browsers reject outright and which would
//     silently stack every left-hand card on top of the focused one.
//  3. A "Soon" goal never has `onSelect` wired up at all, on top of being
//     disabled when focused (#207). Only firing a click past `disabled`
//     proves the handler is genuinely absent rather than just unreachable.

const MAX_VISIBLE_OFFSET = 2

const liveGoal = GOALS.find((goal) => !goal.soon) as Goal
const soonGoal = GOALS.find((goal) => goal.soon) as Goal

const noop = () => {}

/** The card under test. Every test states only what it varies. */
function renderCard(
  overrides: Partial<{ goal: Goal; offset: number; focused: boolean; teleport: boolean; onFocus: () => void; onSelect: () => void }> = {},
) {
  const props = { goal: liveGoal, offset: 0, focused: false, teleport: false, onFocus: noop, onSelect: noop, ...overrides }
  return render(<GoalCard {...props} />)
}

/** The card's own button element. */
function cardOf(container: HTMLElement): HTMLElement {
  const card = container.firstElementChild
  if (!(card instanceof HTMLElement)) throw new Error('expected GoalCard to render an element')
  return card
}

const styleAt = (offset: number) => cardOf(renderCard({ offset }).container).style

describe('GoalCard', () => {
  afterEach(cleanup)

  it('is built on real goal data, so these tests track the actual carousel', () => {
    expect(liveGoal).toBeDefined()
    expect(soonGoal).toBeDefined()
  })

  describe('what it shows', () => {
    it("shows the goal's tag, name and blurb", () => {
      renderCard()

      expect(screen.getByText(liveGoal.tag)).toBeDefined()
      expect(screen.getByText(liveGoal.name)).toBeDefined()
      expect(screen.getByText(liveGoal.blurb)).toBeDefined()
    })

    it("shows the goal's own icon", () => {
      const { container } = renderCard()

      expect(container.querySelector('svg')).not.toBeNull()
    })

    it('shows no "Soon" badge on a goal that is ready', () => {
      renderCard()

      expect(screen.queryByText('Soon')).toBeNull()
    })

    it('badges a "Soon" goal', () => {
      renderCard({ goal: soonGoal })

      expect(screen.getByText('Soon')).toBeDefined()
    })
  })

  describe('its accessible name says what clicking will do', () => {
    it("offers to focus a card that isn't focused", () => {
      renderCard({ focused: false })

      expect(screen.getByRole('button', { name: `Focus ${liveGoal.name}` })).toBeDefined()
    })

    it('offers to continue once it is focused', () => {
      renderCard({ focused: true })

      expect(screen.getByRole('button', { name: `Continue with ${liveGoal.name}` })).toBeDefined()
    })

    it('says "coming soon" for a soon goal, focused or not', () => {
      renderCard({ goal: soonGoal, focused: false })
      expect(screen.getByRole('button', { name: `${soonGoal.name} (coming soon)` })).toBeDefined()
      cleanup()

      renderCard({ goal: soonGoal, focused: true })
      expect(screen.getByRole('button', { name: `${soonGoal.name} (coming soon)` })).toBeDefined()
    })
  })

  describe('clicking', () => {
    it("focuses a card that isn't focused yet, rather than selecting it", () => {
      const onFocus = vi.fn()
      const onSelect = vi.fn()
      renderCard({ focused: false, onFocus, onSelect })

      fireEvent.click(screen.getByRole('button'))

      expect(onFocus).toHaveBeenCalledTimes(1)
      expect(onSelect).not.toHaveBeenCalled()
    })

    it('selects the focused card', () => {
      const onFocus = vi.fn()
      const onSelect = vi.fn()
      renderCard({ focused: true, onFocus, onSelect })

      fireEvent.click(screen.getByRole('button'))

      expect(onSelect).toHaveBeenCalledTimes(1)
      expect(onFocus).not.toHaveBeenCalled()
    })

    it('still focuses an unfocused "Soon" card, so the carousel can be browsed', () => {
      const onFocus = vi.fn()
      const onSelect = vi.fn()
      renderCard({ goal: soonGoal, focused: false, onFocus, onSelect })

      fireEvent.click(screen.getByRole('button'))

      expect(onFocus).toHaveBeenCalledTimes(1)
      expect(onSelect).not.toHaveBeenCalled()
    })

    it('never selects a focused "Soon" card, even past `disabled` (#207)', () => {
      // `disabled` stops a real user; dispatching anyway is what proves
      // onSelect was never wired up, which is the structural guard.
      const onSelect = vi.fn()
      const onFocus = vi.fn()
      renderCard({ goal: soonGoal, focused: true, onFocus, onSelect })

      fireEvent.click(screen.getByRole('button'))

      expect(onSelect).not.toHaveBeenCalled()
      expect(onFocus).not.toHaveBeenCalled()
    })

    it('disables a focused "Soon" card and marks it not-allowed', () => {
      renderCard({ goal: soonGoal, focused: true })
      const card = screen.getByRole('button')

      expect(card.hasAttribute('disabled')).toBe(true)
      expect(card.style.cursor).toBe('not-allowed')
    })

    it('leaves an unfocused "Soon" card enabled, but still not-allowed to the cursor', () => {
      renderCard({ goal: soonGoal, focused: false })
      const card = screen.getByRole('button')

      expect(card.hasAttribute('disabled')).toBe(false)
      expect(card.style.cursor).toBe('not-allowed')
    })
  })

  describe('cover-flow geometry', () => {
    it('centres the focused card with no step and no scaling', () => {
      const style = styleAt(0)

      expect(style.transform).toBe('translateX(calc(-50%)) scale(1)')
      expect(style.opacity).toBe('1')
      expect(style.zIndex).toBe('20')
      expect(style.pointerEvents).toBe('auto')
    })

    // Opacity is compared numerically rather than as a string: the ramp is
    // `1 - distance * 0.32`, and at one step out that is 0.6799999999999999
    // in binary floating point. The rendered value is right; only an exact
    // string comparison would call it wrong.
    it.each([
      [1, '+', 0.87, 0.68, '19'],
      [2, '+', 0.74, 0.36, '18'],
    ])('steps a card %i place(s) to the right', (offset, sign, scale, opacity, zIndex) => {
      const style = styleAt(offset)

      expect(style.transform).toBe(`translateX(calc(-50% ${sign} ${offset} * var(--goal-card-step-x))) scale(${scale})`)
      expect(Number(style.opacity)).toBeCloseTo(opacity, 10)
      expect(style.zIndex).toBe(zIndex)
      expect(style.pointerEvents).toBe('auto')
    })

    it.each([
      [-1, '-', 0.87, 0.68, '19'],
      [-2, '-', 0.74, 0.36, '18'],
    ])('steps a card %i place(s) to the left', (offset, sign, scale, opacity, zIndex) => {
      const style = styleAt(offset)

      expect(style.transform).toBe(`translateX(calc(-50% ${sign} ${Math.abs(offset)} * var(--goal-card-step-x))) scale(${scale})`)
      expect(Number(style.opacity)).toBeCloseTo(opacity, 10)
      expect(style.zIndex).toBe(zIndex)
      expect(style.pointerEvents).toBe('auto')
    })

    it.each([-2, -1, 1, 2])('writes offset %i as an explicit sign, never a "+ -" calc()', (offset) => {
      // `calc(-50% + -2 * ...)` is invalid CSS: browsers drop the whole
      // declaration, which would pile every left-hand card onto the centre.
      const { transform } = styleAt(offset)

      expect(transform).not.toContain('+ -')
      expect(transform).not.toContain('- -')
      expect(transform).toMatch(/^translateX\(calc\(-50% [+-] \d \* var\(--goal-card-step-x\)\)\) scale\(0\.\d+\)$/)
    })

    it('mirrors left and right: the same distance gives the same scale, opacity and stacking', () => {
      for (const distance of [1, 2, 3]) {
        const left = styleAt(-distance)
        const right = styleAt(distance)

        expect([left.opacity, left.zIndex, left.transform.split(' scale')[1]]).toEqual([
          right.opacity,
          right.zIndex,
          right.transform.split(' scale')[1],
        ])
        cleanup()
      }
    })

    it.each([MAX_VISIBLE_OFFSET + 1, -(MAX_VISIBLE_OFFSET + 1), 7, -7])(
      'hides a card at offset %i and takes it out of the pointer path',
      (offset) => {
        const style = styleAt(offset)

        expect(style.opacity).toBe('0')
        expect(style.pointerEvents).toBe('none')
      },
    )

    it('keeps the last visible offset interactive, so the cut-off is exactly where it is documented', () => {
      // Pinned either side of the boundary: at MAX_VISIBLE_OFFSET the card is
      // still visible and clickable, one step further out it is neither.
      const inside = styleAt(MAX_VISIBLE_OFFSET)
      cleanup()
      const outside = styleAt(MAX_VISIBLE_OFFSET + 1)

      expect(Number(inside.opacity)).toBeCloseTo(0.36, 10)
      expect(inside.pointerEvents).toBe('auto')
      expect([outside.opacity, outside.pointerEvents]).toEqual(['0', 'none'])
    })

    it('floors the scale at 0.7, so a far card never shrinks away to nothing', () => {
      // 1 - 8 * 0.13 would be -0.04 without the floor: an inverted card.
      expect(styleAt(8).transform).toContain('scale(0.7)')
      cleanup()
      expect(styleAt(-8).transform).toContain('scale(0.7)')
    })

    it('lowers z-index with distance, so nearer cards stack over further ones', () => {
      const zIndexes = [0, 1, 2, 3].map((offset) => {
        const value = Number(styleAt(offset).zIndex)
        cleanup()
        return value
      })

      expect(zIndexes).toEqual(zIndexes.toSorted((a, b) => b - a))
      expect(new Set(zIndexes).size).toBe(zIndexes.length)
    })
  })

  describe('teleporting across the wrap seam', () => {
    it('animates the horizontal move normally', () => {
      const { transition } = cardOf(renderCard({ teleport: false }).container).style

      expect(transition).toContain('transform var(--duration-carousel)')
    })

    it('drops the transform transition when teleporting, so the card re-appears rather than flying across', () => {
      const { transition } = cardOf(renderCard({ teleport: true }).container).style

      expect(transition).not.toContain('transform')
    })

    it('keeps the opacity fade either way, so a wrapped card still fades in place', () => {
      for (const teleport of [false, true]) {
        expect(cardOf(renderCard({ teleport }).container).style.transition).toContain('opacity 0.5s ease')
        cleanup()
      }
    })
  })

  describe('focused styling', () => {
    it('takes the text-safe accent border and the focused card surface', () => {
      // --accent-save-text rather than --accent-save: the plain accent fails
      // contrast as text/icon colour in the light theme.
      const card = cardOf(renderCard({ focused: true }).container)

      expect(card.style.border).toBe('1.5px solid var(--accent-save-text)')
      expect(card.style.background).toBe('var(--accent-save-bg-card)')
      expect(card.style.boxShadow).toBe('var(--shadow-card-focused)')
    })

    it('falls back to the divider border and neutral tile when not focused', () => {
      const card = cardOf(renderCard({ focused: false }).container)

      expect(card.style.border).toBe('1.5px solid var(--divider)')
      expect(card.style.background).toBe('var(--tile-bg-neutral)')
      expect(card.style.boxShadow).toBe('var(--shadow-card)')
    })

    it('tints the tag text with the accent when focused and the tertiary token when not', () => {
      expect(screen.queryByText(liveGoal.tag)).toBeNull()

      renderCard({ focused: true })
      expect(screen.getByText(liveGoal.tag).style.color).toBe('var(--accent-save-text)')
      cleanup()

      renderCard({ focused: false })
      expect(screen.getByText(liveGoal.tag).style.color).toBe('var(--text-tertiary)')
    })
  })
})
