// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from 'vitest'
import { render, screen, cleanup, fireEvent, act, within } from '@testing-library/react'
import { App } from './App'
import { CalculatorProvider } from './state/CalculatorProvider'
import { useCalculator, type CalculatorContextValue } from './state/calculatorContext'
import { flowForGoal } from './lib/flow'
import { GOALS, goalById } from './lib/goals'

// App owns two things nothing else does: the switch that maps each
// FlowStep.id to its component (no `default`, no exhaustiveness check, so a
// renamed id would silently render nothing), and "Start over", which must
// strip a shared link's query params *before* navigating back — otherwise a
// refresh re-hydrates the state the user just cleared.

// jsdom implements neither of these; the steps register panels with an
// IntersectionObserver on mount, and scrollToIndex calls window.scrollTo.
class FakeIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

let scrollTo: MockInstance<typeof window.scrollTo>
let replaceState: MockInstance<typeof window.history.replaceState>

let calculator: CalculatorContextValue | null = null

/** Exposes the provider's context so the flow can be driven past hydration's own rules. */
function CaptureContext() {
  calculator = useCalculator()
  return null
}

/** Renders the app at `search`, as if the page had been opened at that URL. */
function renderApp(search = '') {
  window.history.replaceState({}, '', `/${search}`)
  replaceState.mockClear()
  return render(
    <CalculatorProvider>
      <CaptureContext />
      <App />
    </CalculatorProvider>,
  )
}

/** The step labels the progress rail is currently offering — one per step in the active flow. */
function railLabels(): string[] {
  const rail = screen.getByRole('navigation', { name: 'Step progress' })
  return within(rail)
    .getAllByRole('button')
    .map((button) => button.getAttribute('aria-label') ?? '')
}

/** Every heading on the page, as [level, text] pairs in document order. */
function headingOutline(): [number, string][] {
  return screen.getAllByRole('heading').map((heading) => [Number(heading.tagName.slice(1)), heading.textContent?.trim() ?? ''])
}

/** Index of the step the rail marks as current. */
function activeRailIndex(): number {
  const rail = screen.getByRole('navigation', { name: 'Step progress' })
  return within(rail)
    .getAllByRole('button')
    .findIndex((button) => button.getAttribute('aria-current') === 'step')
}

describe('App', () => {
  beforeEach(() => {
    vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver)
    scrollTo = vi.fn()
    vi.stubGlobal('scrollTo', scrollTo)
    replaceState = vi.spyOn(window.history, 'replaceState')
  })

  afterEach(() => {
    cleanup()
    calculator = null
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    window.history.replaceState({}, '', '/')
  })

  describe('step routing', () => {
    it('renders only the carousel and its placeholder before a goal is picked', () => {
      renderApp()

      expect(railLabels()).toEqual(['Goal', 'Details'])
      expect(screen.getByText('What are you saving for?')).toBeTruthy()
      expect(screen.getByText('Scroll back up and pick a goal to get started.')).toBeTruthy()
    })

    it('renders the standard flow, each step at its own position', () => {
      renderApp('?goalId=holiday')

      expect(railLabels()).toEqual(['Goal', 'Details', 'Budget', 'Plan', 'Result'])
      // Each step prints its own index, so these assert the component *and*
      // the position it was rendered at.
      expect(screen.getByText('What are you saving for?')).toBeTruthy()
      expect(screen.getByText('Step 1 — Getaway')).toBeTruthy()
      expect(screen.getByText('Step 2 — Your budget')).toBeTruthy()
      expect(screen.getByText('Step 3 — Timeframe')).toBeTruthy()
      expect(screen.getByTestId('result-panel')).toBeTruthy()
    })

    it("renders the vehicle flow's two bespoke steps in place of Plan", () => {
      renderApp('?goalId=car')

      expect(railLabels()).toEqual(['Goal', 'Details', 'Paying for it', 'Running costs', 'Budget', 'Result'])
      expect(screen.getByText('Step 2 — Paying for it')).toBeTruthy()
      expect(screen.getByText('Step 3 — Running costs')).toBeTruthy()
      expect(screen.getByText('Step 4 — Your budget')).toBeTruthy()
      expect(screen.getByTestId('result-panel')).toBeTruthy()
      // The generic Plan step has no place in this flow.
      expect(screen.queryByText('Step 4 — Timeframe')).toBeNull()
      expect(screen.queryByText('Step 4 — Finance details')).toBeNull()
    })

    it('renders the finance variant of the Plan step when the goal is paid monthly', () => {
      renderApp('?goalId=luxury&mode=monthly')

      expect(screen.getByText('Step 3 — Finance details')).toBeTruthy()
    })
  })

  // renderStep's switch has no `default` branch, so an id with no matching
  // `case` returns undefined and that step renders as nothing at all — no
  // compiler error, no crash, just a gap in the page. Walking every goal's
  // flow and counting what lands in <main> is what would catch that.
  describe('every step id in every flow has a matching case', () => {
    const goalIds = [null, ...GOALS.map((goal) => goal.id)]

    for (const goalId of goalIds) {
      it(`renders one panel per step for ${goalId ?? 'no goal'}`, () => {
        const { container } = renderApp()
        // Set through context rather than the URL: hydration refuses a "Soon"
        // goal, and this guard is about the switch, not about hydration.
        act(() => calculator?.setField('goalId', goalId))

        const expectedFlow = flowForGoal(goalById(goalId))
        const main = container.querySelector('main')

        expect(main?.children).toHaveLength(expectedFlow.length)
        expect(railLabels()).toEqual(expectedFlow.map((step) => step.label))
        // A step whose id fell through the switch would leave an empty slot.
        for (const panel of main?.children ?? []) {
          expect(panel.textContent?.trim()).not.toBe('')
        }
      })
    }
  })

  // The calculator is one scrolling page, so its heading outline has to read
  // as one: a single h1 naming the page, with each step's question as an h2
  // under it. Before #168 every step rendered its own h1 — five of them in a
  // holiday flow with a result showing — which a screen reader navigating by
  // headings presents as a flat list of unrelated top-level headings.
  describe('heading structure', () => {
    const goalIds = [null, ...GOALS.map((goal) => goal.id)]
    const LANDING_QUESTION = 'What are you saving for?'

    for (const goalId of goalIds) {
      it(`has exactly one h1, the landing question, for ${goalId ?? 'no goal'}`, () => {
        renderApp()
        act(() => calculator?.setField('goalId', goalId))

        const outline = headingOutline()
        expect(outline.filter(([level]) => level === 1)).toEqual([[1, LANDING_QUESTION]])
        // Not just "one h1" — nothing may sit at a level that skips one, or
        // the outline has a hole in it.
        expect(outline.every(([level]) => level <= 2)).toBe(true)
      })
    }

    it('keeps every step question, and the result headline, at level 2', () => {
      renderApp()
      // A full save flow with a result showing — the case the issue measured,
      // where five separate h1s used to appear.
      act(() =>
        calculator?.setFields({
          goalId: 'holiday',
          itemPrice: '4000',
          takeHome: '2600',
        }),
      )

      // Queried by accessible name rather than tag soup, because that is what
      // a screen reader announces.
      expect(screen.getByRole('heading', { level: 2, name: 'How much is the trip?' })).toBeTruthy()
      // The next two are matched loosely rather than spelled out, because
      // both carry a soft line break the name computation keeps verbatim: the
      // Budget copy has a U+2028 LINE SEPARATOR mid-sentence, and the Plan
      // question a <br>, which jsdom does not treat as whitespace. A real
      // browser normalises both, and e2e/heading-structure.spec.ts pins the
      // clean names there.
      expect(screen.getByRole('heading', { level: 2, name: /What's coming in,\s*and going out\?/ })).toBeTruthy()
      expect(screen.getByRole('heading', { level: 2, name: /How do you want\s*to plan it\?/ })).toBeTruthy()
      // The result headline is a figure, so it is matched by shape rather
      // than spelled out — the copy is ResultHeadline's business.
      expect(screen.getByRole('heading', { level: 2, name: /months? —/ })).toBeTruthy()

      // Four questions where there were four separate h1s before, under the
      // one h1 that remains.
      expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(4)
      expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    })

    it("keeps the vehicle flow's two bespoke questions at level 2 as well", () => {
      renderApp()
      act(() => calculator?.setFields({ goalId: 'car', itemPrice: '18000', takeHome: '2600' }))

      expect(screen.getByRole('heading', { level: 2, name: 'How are you buying it?' })).toBeTruthy()
      expect(screen.getByRole('heading', { level: 2, name: 'What will it cost to keep on the road?' })).toBeTruthy()
      expect(screen.queryAllByRole('heading', { level: 1 })).toHaveLength(1)
    })

    it('keeps the finance variant of the Plan step at level 2', () => {
      renderApp()
      act(() => calculator?.setFields({ goalId: 'big', mode: 'monthly', itemPrice: '1200', takeHome: '2000' }))

      expect(screen.getByRole('heading', { level: 2, name: 'Term and rate?' })).toBeTruthy()
      expect(screen.queryAllByRole('heading', { level: 1 })).toHaveLength(1)
    })
  })

  describe('"Start over"', () => {
    const SHARED_LINK = '?goalId=car&itemPrice=18000&takeHome=2600'

    it("clears a shared link's query params", () => {
      renderApp(SHARED_LINK)
      // The link really did hydrate, so the clear below isn't a no-op.
      expect(window.location.search).not.toBe('')
      expect(screen.getByText('Step 2 — Paying for it')).toBeTruthy()

      fireEvent.click(screen.getByRole('button', { name: 'Start over' }))

      expect(window.location.search).toBe('')
      expect(window.location.pathname).toBe('/')
    })

    it('puts the flow back to the first step', () => {
      renderApp(SHARED_LINK)

      fireEvent.click(screen.getByRole('button', { name: 'Start over' }))

      expect(railLabels()).toEqual(['Goal', 'Details'])
      expect(activeRailIndex()).toBe(0)
      expect(screen.getByText('What are you saving for?')).toBeTruthy()
      expect(screen.queryByText('Step 2 — Paying for it')).toBeNull()
    })

    it('clears the params before scrolling away, not after', () => {
      // The documented ordering: strip the query string first, so a refresh
      // after "Start over" can't re-hydrate the state just cleared.
      renderApp(SHARED_LINK)

      fireEvent.click(screen.getByRole('button', { name: 'Start over' }))

      expect(replaceState).toHaveBeenCalledWith({}, '', '/')
      expect(scrollTo).toHaveBeenCalled()
      expect(replaceState.mock.invocationCallOrder[0]).toBeLessThan(scrollTo.mock.invocationCallOrder[0])
    })

    it('resets the calculator state itself, not just the URL', () => {
      renderApp(SHARED_LINK)
      expect(calculator?.state.itemPrice).toBe('18000')

      fireEvent.click(screen.getByRole('button', { name: 'Start over' }))

      expect(calculator?.state.goalId).toBeNull()
      expect(calculator?.state.itemPrice).toBe('')
      expect(calculator?.state.takeHome).toBe('')
    })
  })
})
