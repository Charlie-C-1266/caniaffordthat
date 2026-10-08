// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react'
import { GoalPickerStep } from './GoalPickerStep'
import { CalculatorProvider } from '../../state/CalculatorProvider'
import { useCalculator, type CalculatorContextValue } from '../../state/calculatorContext'
import { GOALS, INITIAL_CAROUSEL_INDEX, circularOffset, seedFromGoal, type Goal } from '../../lib/goals'
import type { CalculatorState } from '../../state/types'

// The carousel's pure helpers (`wrapIndex`, `circularOffset`, `seedFromGoal`)
// are covered in lib/goals.test.ts; the component's own state wiring around
// them had no coverage at all. What's tested here is the timing- and
// internal-state-driven behaviour e2e can't reach at this granularity: the
// auto-rotate lifecycle (engage / hover / goal-picked / reduced-motion), the
// teleport-on-wrap flag, focus-vs-select on a card click, and the delayed
// scroll after a goal is selected.

const STEP_INDEX = 0
const noop = () => {}

// Mirrors the component's own constants (both are module-private there).
const AUTO_ROTATE_MS = 3200
const SELECT_SCROLL_DELAY_MS = 260
/** Cards this far from the focused one are faded out and non-interactive. */
const MAX_VISIBLE_OFFSET = 2

const LAST_INDEX = GOALS.length - 1
const CAR = GOALS[0]
const HOLIDAY = GOALS[1]
const MORTGAGE = GOALS[LAST_INDEX]

let calculator: CalculatorContextValue | null = null

/** Exposes the provider's context so a test can seed state and read back what the step wrote. */
function CaptureContext() {
  calculator = useCalculator()
  return null
}

/** jsdom has no media-query engine, so the reduced-motion check is stubbed per test. */
function stubReducedMotion(reduce: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({ matches: reduce && query.includes('reduce'), media: query })),
  )
}

function renderPicker(state: Partial<CalculatorState> = {}, scrollToIndex: (index: number) => void = noop) {
  render(
    <CalculatorProvider>
      <CaptureContext />
      <GoalPickerStep index={STEP_INDEX} panelRef={noop} wrapperRef={noop} scrollToIndex={scrollToIndex} />
    </CalculatorProvider>,
  )
  // Seeded after mount because the provider hydrates its own initial state
  // from the URL.
  if (Object.keys(state).length > 0) act(() => calculator?.setFields(state))
}

const carouselIndex = () => calculator?.state.carouselIndex

/** A goal's card, whichever of its three accessible names it currently carries. */
const cardFor = (goal: Goal) =>
  screen.getByRole('button', {
    name: goal.soon ? `${goal.name} (coming soon)` : new RegExp(`^(Focus|Continue with) ${goal.name}$`),
  })

const dotFor = (goal: Goal) => screen.getByRole('button', { name: `Go to ${goal.name}` })
const arrow = (label: 'Previous goal' | 'Next goal') => screen.getByRole('button', { name: label })

/** The stage div carrying the hover handlers — two levels up from any card. */
function carouselStage(): HTMLElement {
  const stage = cardFor(CAR).parentElement?.parentElement
  if (!stage) throw new Error('Could not find the carousel stage')
  return stage
}

/** Advances the fake clock inside act, so React flushes whatever the timer wrote. */
function advanceBy(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms)
  })
}

/** Cards that jump across the wrap seam drop `transform` from their transition. */
const teleportingGoals = () => GOALS.filter((goal) => !cardFor(goal).style.transition.includes('transform')).map((goal) => goal.id)

// With six cards, every single-step move sends exactly one card across the wrap
// seam — the one diametrically opposite the focus, which flips from the far end
// of the strip (offset +3, fully faded out) to the near edge of the other side,
// or back. That card is the only one allowed to jump, and because one end of
// its move is past the visible band it fades in or out in place rather than
// flying across the stage.
const seamCrossers = (from: number, to: number) =>
  GOALS.filter((_, i) => Math.abs(circularOffset(i, to) - circularOffset(i, from)) > 1).map((goal) => goal.id)

/** Whether card `i` is inside the faded-in band when card `centre` is focused. */
const visibleAt = (i: number, centre: number) => Math.abs(circularOffset(i, centre)) <= MAX_VISIBLE_OFFSET

describe('GoalPickerStep', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    stubReducedMotion(false)
  })

  afterEach(() => {
    cleanup()
    calculator = null
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  describe('auto-rotate', () => {
    it('advances the focused card on its own, once per interval', () => {
      renderPicker()
      expect(carouselIndex()).toBe(INITIAL_CAROUSEL_INDEX)

      advanceBy(AUTO_ROTATE_MS)
      expect(carouselIndex()).toBe(INITIAL_CAROUSEL_INDEX + 1)

      advanceBy(AUTO_ROTATE_MS)
      expect(carouselIndex()).toBe(INITIAL_CAROUSEL_INDEX + 2)
    })

    it('does not advance before the interval is up', () => {
      renderPicker()
      advanceBy(AUTO_ROTATE_MS - 1)
      expect(carouselIndex()).toBe(INITIAL_CAROUSEL_INDEX)
    })

    it('wraps back round to the first card past the last', () => {
      renderPicker({ carouselIndex: LAST_INDEX })
      advanceBy(AUTO_ROTATE_MS)
      expect(carouselIndex()).toBe(0)
    })

    it('stops for good once the user clicks a dot', () => {
      renderPicker()
      fireEvent.click(dotFor(HOLIDAY))
      expect(carouselIndex()).toBe(1)

      advanceBy(AUTO_ROTATE_MS * 3)
      expect(carouselIndex()).toBe(1)
    })

    it('stops for good once the user clicks an arrow', () => {
      renderPicker()
      fireEvent.click(arrow('Next goal'))
      expect(carouselIndex()).toBe(INITIAL_CAROUSEL_INDEX + 1)

      advanceBy(AUTO_ROTATE_MS * 3)
      expect(carouselIndex()).toBe(INITIAL_CAROUSEL_INDEX + 1)
    })

    it('stops for good once a goal is selected', () => {
      renderPicker()
      fireEvent.click(cardFor(CAR))
      expect(calculator?.state.goalId).toBe(CAR.id)

      advanceBy(AUTO_ROTATE_MS * 3)
      expect(carouselIndex()).toBe(INITIAL_CAROUSEL_INDEX)
    })

    it('never starts when a goal is already chosen — e.g. someone arriving on a shared link', () => {
      renderPicker({ goalId: HOLIDAY.id })
      advanceBy(AUTO_ROTATE_MS * 2)
      expect(carouselIndex()).toBe(INITIAL_CAROUSEL_INDEX)
    })

    it('pauses while the carousel is hovered and resumes on mouse-leave', () => {
      renderPicker()
      // React derives onMouseEnter/onMouseLeave from mouseover/mouseout.
      fireEvent.mouseOver(carouselStage())
      advanceBy(AUTO_ROTATE_MS * 2)
      expect(carouselIndex()).toBe(INITIAL_CAROUSEL_INDEX)

      fireEvent.mouseOut(carouselStage())
      advanceBy(AUTO_ROTATE_MS)
      expect(carouselIndex()).toBe(INITIAL_CAROUSEL_INDEX + 1)
    })

    it('never starts when the visitor prefers reduced motion', () => {
      stubReducedMotion(true)
      renderPicker()
      advanceBy(AUTO_ROTATE_MS * 3)
      expect(carouselIndex()).toBe(INITIAL_CAROUSEL_INDEX)
    })
  })

  describe('clicking a card', () => {
    it('only focuses a card that is not already focused', () => {
      renderPicker()
      expect(cardFor(HOLIDAY).getAttribute('aria-label')).toBe(`Focus ${HOLIDAY.name}`)

      fireEvent.click(cardFor(HOLIDAY))
      expect(carouselIndex()).toBe(1)
      expect(calculator?.state.goalId).toBeNull()
      // It's now the focused card, so a second click would select it.
      expect(cardFor(HOLIDAY).getAttribute('aria-label')).toBe(`Continue with ${HOLIDAY.name}`)
    })

    it('selects the card that is already focused — a second click gets you moving', () => {
      const scrollToIndex = vi.fn()
      renderPicker({}, scrollToIndex)
      fireEvent.click(cardFor(HOLIDAY))
      expect(calculator?.state.goalId).toBeNull()

      fireEvent.click(cardFor(HOLIDAY))
      expect(calculator?.state.goalId).toBe(HOLIDAY.id)
      advanceBy(SELECT_SCROLL_DELAY_MS)
      expect(scrollToIndex).toHaveBeenCalledWith(STEP_INDEX + 1)
    })
  })

  describe('selecting a goal', () => {
    it("applies the goal's seeds to state", () => {
      renderPicker()
      fireEvent.click(cardFor(CAR))
      const seeds = seedFromGoal(CAR)
      for (const [key, value] of Object.entries(seeds)) {
        expect(calculator?.state[key as keyof CalculatorState]).toEqual(value)
      }
      // The car's seeds are the ones worth naming outright.
      expect(calculator?.state.mode).toBe('monthly')
      expect(calculator?.state.term).toBe(48)
      expect(calculator?.state.growth).toBe(9.9)
    })

    it('holds the scroll back for a beat rather than jumping straight on', () => {
      const scrollToIndex = vi.fn()
      renderPicker({}, scrollToIndex)
      fireEvent.click(cardFor(CAR))
      expect(scrollToIndex).not.toHaveBeenCalled()

      advanceBy(SELECT_SCROLL_DELAY_MS - 1)
      expect(scrollToIndex).not.toHaveBeenCalled()

      advanceBy(1)
      expect(scrollToIndex).toHaveBeenCalledExactlyOnceWith(STEP_INDEX + 1)
    })

    it('can be driven from the "Get started" button instead of the card', () => {
      const scrollToIndex = vi.fn()
      renderPicker({}, scrollToIndex)
      fireEvent.click(screen.getByRole('button', { name: `Get started with ${CAR.name}` }))
      expect(calculator?.state.goalId).toBe(CAR.id)
      advanceBy(SELECT_SCROLL_DELAY_MS)
      expect(scrollToIndex).toHaveBeenCalledWith(STEP_INDEX + 1)
    })

    it('is a no-op for a "Soon" goal, from either the card or the CTA', () => {
      const scrollToIndex = vi.fn()
      renderPicker({}, scrollToIndex)

      // Focus the Mortgage card the way a user would — via its dot.
      fireEvent.click(dotFor(MORTGAGE))
      expect(carouselIndex()).toBe(LAST_INDEX)

      const card = cardFor(MORTGAGE)
      expect(card.hasAttribute('disabled')).toBe(true)
      fireEvent.click(card)

      const cta = screen.getByRole('button', { name: 'Coming soon' })
      expect(cta.hasAttribute('disabled')).toBe(true)
      fireEvent.click(cta)

      advanceBy(SELECT_SCROLL_DELAY_MS)
      expect(calculator?.state.goalId).toBeNull()
      expect(scrollToIndex).not.toHaveBeenCalled()
    })
  })

  describe('the teleport-on-wrap flag', () => {
    it('leaves every card animating before anything has moved', () => {
      renderPicker()
      expect(teleportingGoals()).toEqual([])
    })

    it('teleports only the card crossing the seam on a one-step move', () => {
      renderPicker()
      fireEvent.click(arrow('Next goal'))
      const crossing = seamCrossers(INITIAL_CAROUSEL_INDEX, INITIAL_CAROUSEL_INDEX + 1)
      expect(crossing).toHaveLength(1)
      expect(teleportingGoals()).toEqual(crossing)
    })

    it('teleports only the card crossing the seam when wrapping off the first card', () => {
      renderPicker()
      fireEvent.click(arrow('Previous goal'))
      expect(carouselIndex()).toBe(LAST_INDEX)
      const crossing = seamCrossers(INITIAL_CAROUSEL_INDEX, LAST_INDEX)
      expect(crossing).toHaveLength(1)
      expect(teleportingGoals()).toEqual(crossing)
    })

    it.each([
      { label: 'forwards', arrowLabel: 'Next goal' as const, to: INITIAL_CAROUSEL_INDEX + 1 },
      { label: 'backwards, over the wrap seam', arrowLabel: 'Previous goal' as const, to: LAST_INDEX },
    ])('never teleports a card the user watches move all the way through ($label)', ({ arrowLabel, to }) => {
      renderPicker()
      fireEvent.click(arrow(arrowLabel))
      // Cards on screen at both ends of the move are the ones whose travel is
      // actually watched; every one of them has to animate.
      const watched = GOALS.filter((_, i) => visibleAt(i, INITIAL_CAROUSEL_INDEX) && visibleAt(i, to)).map((goal) => goal.id)
      expect(watched.length).toBeGreaterThan(1)
      for (const id of teleportingGoals()) expect(watched).not.toContain(id)
    })

    it('teleports every card on a jump of more than one position, since none of them moves by one', () => {
      renderPicker()
      // Two dots along — far enough that no card is making a single step.
      const target = INITIAL_CAROUSEL_INDEX + 2
      fireEvent.click(dotFor(GOALS[target]))
      expect(carouselIndex()).toBe(target)
      expect(seamCrossers(INITIAL_CAROUSEL_INDEX, target)).toHaveLength(GOALS.length)
      expect(teleportingGoals()).toEqual(GOALS.map((goal) => goal.id))
    })
  })
})
