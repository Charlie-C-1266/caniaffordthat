// @vitest-environment jsdom
import type { ReactNode } from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
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
    this.callback([{ target: el, isIntersecting: true } as IntersectionObserverEntry], this as unknown as IntersectionObserver)
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

  it('disconnects the observer on unmount', () => {
    const { unmount } = renderHook(() => useHarness(), { wrapper })
    const instance = FakeIntersectionObserver.instances[0]
    const disconnectSpy = vi.spyOn(instance!, 'disconnect')

    unmount()

    expect(disconnectSpy).toHaveBeenCalledTimes(1)
  })
})
