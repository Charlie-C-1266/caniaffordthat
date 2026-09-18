// @vitest-environment jsdom
import type { ReactNode } from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, render, screen, act } from '@testing-library/react'
import { useStepObserver } from './useStepObserver'
import { useCalculator } from '../state/calculatorContext'
import { CalculatorProvider } from '../state/CalculatorProvider'

// jsdom doesn't implement IntersectionObserver at all, so it's stubbed here
// with a fake that records what's observed and lets tests fire entries by
// hand, mirroring the real API just enough for useStepObserver to work
// against it unmodified.
class FakeIntersectionObserver {
  static instances: FakeIntersectionObserver[] = []
  callback: IntersectionObserverCallback
  observed = new Set<Element>()

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback
    FakeIntersectionObserver.instances.push(this)
  }

  observe(el: Element) {
    this.observed.add(el)
  }

  unobserve(el: Element) {
    this.observed.delete(el)
  }

  disconnect() {
    this.observed.clear()
  }

  fireIntersecting(el: Element) {
    this.fire(el, true)
  }

  fire(el: Element, isIntersecting: boolean) {
    this.callback([{ target: el, isIntersecting } as IntersectionObserverEntry], this as unknown as IntersectionObserver)
  }
}

function wrapper({ children }: { children: ReactNode }) {
  return <CalculatorProvider>{children}</CalculatorProvider>
}

function useHarness() {
  const observerApi = useStepObserver()
  const { state } = useCalculator()
  return { ...observerApi, activeIndex: state.activeIndex, revealed: state.revealed }
}

function elementAtOffsetTop(offsetTop: number): HTMLDivElement {
  const el = document.createElement('div')
  Object.defineProperty(el, 'offsetTop', { value: offsetTop, configurable: true })
  return el
}

describe('useStepObserver', () => {
  beforeEach(() => {
    FakeIntersectionObserver.instances = []
    vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('registers a panel element and reveals its step when the observer reports it intersecting', () => {
    const { result } = renderHook(() => useHarness(), { wrapper })
    const panelEl = document.createElement('div')

    act(() => {
      result.current.registerPanel(2)(panelEl)
    })
    expect(result.current.revealed[2]).toBeUndefined()

    act(() => {
      FakeIntersectionObserver.instances[0]?.fireIntersecting(panelEl)
    })
    expect(result.current.activeIndex).toBe(2)
    expect(result.current.revealed[2]).toBe(true)
  })

  it('ignores entries that are not intersecting (panel leaving the trigger zone)', () => {
    const { result } = renderHook(() => useHarness(), { wrapper })
    const panelEl = document.createElement('div')

    act(() => {
      result.current.registerPanel(3)(panelEl)
    })
    act(() => {
      FakeIntersectionObserver.instances[0]?.fire(panelEl, false)
    })
    expect(result.current.revealed[3]).toBeUndefined()
  })

  it('unobserves the previous element when an index is re-registered with a new one', () => {
    const { result } = renderHook(() => useHarness(), { wrapper })
    const elA = document.createElement('div')
    const elB = document.createElement('div')
    const observer = () => FakeIntersectionObserver.instances[0]

    act(() => {
      result.current.registerPanel(2)(elA)
    })
    act(() => {
      observer().fireIntersecting(elA)
    })
    expect(result.current.activeIndex).toBe(2)

    act(() => {
      result.current.registerPanel(2)(elB)
    })
    expect(observer().observed.has(elA)).toBe(false)
    expect(observer().observed.has(elB)).toBe(true)

    // Move focus to another step, then fire an intersection on the stale
    // element: it must no longer reveal step 2.
    const elOther = document.createElement('div')
    act(() => {
      result.current.registerPanel(1)(elOther)
    })
    act(() => {
      observer().fireIntersecting(elOther)
    })
    expect(result.current.activeIndex).toBe(1)

    act(() => {
      observer().fireIntersecting(elA)
    })
    expect(result.current.activeIndex).toBe(1)
  })

  it('returns the same ref callback for the same index across renders (stable identity)', () => {
    const { result, rerender } = renderHook(() => useHarness(), { wrapper })
    const first = result.current.registerPanel(1)
    rerender()
    const second = result.current.registerPanel(1)
    expect(first).toBe(second)
  })

  it('gives different indices their own distinct ref callbacks', () => {
    const { result } = renderHook(() => useHarness(), { wrapper })
    expect(result.current.registerPanel(0)).not.toBe(result.current.registerPanel(1))
  })

  it('scrollToIndex prefers the wrapper element over the panel (steps 0-3 pattern)', () => {
    const { result } = renderHook(() => useHarness(), { wrapper })
    const panelEl = elementAtOffsetTop(500)
    const wrapperEl = elementAtOffsetTop(100)
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})

    act(() => {
      result.current.registerPanel(1)(panelEl)
      result.current.registerWrapper(1)(wrapperEl)
      result.current.scrollToIndex(1)
    })

    expect(scrollTo).toHaveBeenCalledWith({ top: 100, behavior: 'smooth' })
  })

  it('scrollToIndex falls back to the panel when no wrapper is registered (final-step pattern)', () => {
    const { result } = renderHook(() => useHarness(), { wrapper })
    const panelEl = elementAtOffsetTop(900)
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})

    act(() => {
      result.current.registerPanel(5)(panelEl)
      result.current.scrollToIndex(5)
    })

    expect(scrollTo).toHaveBeenCalledWith({ top: 900, behavior: 'smooth' })
  })

  it('observes panels registered via JSX refs before the observer effect runs', () => {
    // In a real component tree, React attaches ref callbacks during commit,
    // *before* effects run — so the observer's setup effect must pick up
    // already-registered panels rather than relying on later registration.
    function Panels() {
      const { registerPanel } = useStepObserver()
      return <div data-testid="panel-0" ref={registerPanel(0)} />
    }
    render(
      <CalculatorProvider>
        <Panels />
      </CalculatorProvider>,
    )

    const instance = FakeIntersectionObserver.instances[0]
    expect(instance.observed.size).toBe(1)
    expect(instance.observed.has(screen.getByTestId('panel-0'))).toBe(true)
  })

  it('disconnects the observer on unmount', () => {
    const { unmount } = renderHook(() => useHarness(), { wrapper })
    const instance = FakeIntersectionObserver.instances[0]
    const disconnectSpy = vi.spyOn(instance, 'disconnect')

    unmount()

    expect(disconnectSpy).toHaveBeenCalledTimes(1)
  })
})
