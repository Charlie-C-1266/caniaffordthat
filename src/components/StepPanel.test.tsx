// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { StepPanel } from './StepPanel'

const PANEL_ID = 'panel'

const panel = () => screen.getByTestId(PANEL_ID)
/** The scroll-room wrapper is the panel's parent — or absent entirely on a final step. */
const wrapperOf = (element: HTMLElement) => element.parentElement as HTMLElement

describe('StepPanel', () => {
  afterEach(cleanup)

  describe('a mid-flow step (isFinal defaults to false)', () => {
    it('wraps the panel in scroll room of the default 160vh', () => {
      render(
        <StepPanel index={0} panelRef={() => {}} panelTestId={PANEL_ID}>
          content
        </StepPanel>,
      )
      expect(wrapperOf(panel()).style.minHeight).toBe('160vh')
    })

    it('respects a per-step wrapperHeightVh override instead of silently using the default', () => {
      // The Budget step passes 170 — nothing asserted that the prop was wired
      // through, so the default winning would have looked identical here.
      render(
        <StepPanel index={2} wrapperHeightVh={170} panelRef={() => {}} panelTestId={PANEL_ID}>
          content
        </StepPanel>,
      )
      expect(wrapperOf(panel()).style.minHeight).toBe('170vh')
    })

    it('pins the panel with position: sticky at the top of the viewport', () => {
      render(
        <StepPanel index={1} panelRef={() => {}} panelTestId={PANEL_ID}>
          content
        </StepPanel>,
      )
      expect(panel().style.position).toBe('sticky')
      expect(panel().style.top).toBe('0px')
    })

    it('stacks later steps over earlier ones via zIndex = (index + 1) * 10', () => {
      // The only thing keeping a later still-sticky panel painting over an
      // earlier one mid-scroll; an off-by-one shows up as flicker, not a
      // failure anywhere else in the suite.
      for (const [index, expected] of [
        [0, '10'],
        [1, '20'],
        [4, '50'],
      ] as const) {
        render(
          <StepPanel index={index} panelRef={() => {}} panelTestId={`panel-${index}`}>
            content
          </StepPanel>,
        )
        expect(screen.getByTestId(`panel-${index}`).style.zIndex).toBe(expected)
      }
    })

    it('invokes panelRef and wrapperRef with their own respective DOM nodes on mount', () => {
      const panelRef = vi.fn()
      const wrapperRef = vi.fn()
      render(
        <StepPanel index={0} panelRef={panelRef} wrapperRef={wrapperRef} panelTestId={PANEL_ID}>
          content
        </StepPanel>,
      )

      expect(panelRef).toHaveBeenCalledWith(panel())
      expect(wrapperRef).toHaveBeenCalledWith(wrapperOf(panel()))
      // Distinct elements: useStepObserver observes the panel but scrolls to
      // the wrapper, so crossing the two would break step navigation.
      expect(panelRef.mock.calls[0][0]).not.toBe(wrapperRef.mock.calls[0][0])
    })
  })

  describe('the final step (isFinal)', () => {
    it('renders no scroll-room wrapper at all', () => {
      const { container } = render(
        <StepPanel index={4} isFinal panelRef={() => {}} panelTestId={PANEL_ID}>
          content
        </StepPanel>,
      )
      // The panel is the root of the rendered tree — nothing wraps it.
      expect(panel().parentElement).toBe(container)
      // No element carries the wrapper's scroll-room height (the panel's own
      // minHeight is 100vh, which is the base style, not scroll room).
      const heights = [...container.querySelectorAll<HTMLElement>('*')].map((el) => el.style.minHeight)
      expect(heights).not.toContain('160vh')
    })

    it('never invokes a wrapperRef that a caller passed by mistake', () => {
      // There is no wrapper to attach it to, so the prop is silently
      // swallowed; this pins that as the known behaviour rather than an
      // accident that looks like a working scroll target.
      const wrapperRef = vi.fn()
      render(
        <StepPanel index={4} isFinal panelRef={() => {}} wrapperRef={wrapperRef} panelTestId={PANEL_ID}>
          content
        </StepPanel>,
      )
      expect(wrapperRef).not.toHaveBeenCalled()
    })

    it('leaves the panel unpinned — no sticky position or top offset', () => {
      render(
        <StepPanel index={4} isFinal panelRef={() => {}} panelTestId={PANEL_ID}>
          content
        </StepPanel>,
      )
      expect(panel().style.position).toBe('')
      expect(panel().style.top).toBe('')
    })

    it('still stacks above the earlier steps', () => {
      render(
        <StepPanel index={4} isFinal panelRef={() => {}} panelTestId={PANEL_ID}>
          content
        </StepPanel>,
      )
      expect(panel().style.zIndex).toBe('50')
    })
  })

  it('lets a caller-supplied panelStyle win over the shared base style', () => {
    // panelStyle is spread last, so a step overriding a key the base style
    // also sets (padding here) must take effect.
    render(
      <StepPanel index={0} panelRef={() => {}} panelStyle={{ padding: '0px', background: 'rgb(1, 2, 3)' }} panelTestId={PANEL_ID}>
        content
      </StepPanel>,
    )
    expect(panel().style.padding).toBe('0px')
    expect(panel().style.background).toBe('rgb(1, 2, 3)')
    // A base-style key the caller did not override survives.
    expect(panel().style.minHeight).toBe('100vh')
  })

  it('renders its children inside the panel', () => {
    render(
      <StepPanel index={0} panelRef={() => {}} panelTestId={PANEL_ID}>
        <p>step body</p>
      </StepPanel>,
    )
    expect(panel().textContent).toBe('step body')
  })
})
