import { useCallback, useEffect, useRef } from 'react'
import { useCalculator } from '../state/calculatorContext'
import type { DivRefCallback } from '../lib/refs'

// Centers the intersection "trigger zone" on the middle 40% of the viewport,
// so whichever step's panel occupies that band is treated as active.
const OBSERVER_ROOT_MARGIN = '-30% 0px -30% 0px'

/**
 * Wires the scrollytelling reveal/progress mechanics described in the design
 * doc: an IntersectionObserver watches each step's pinned panel, and
 * whichever one is centered in the viewport is reported to shared state via
 * `revealStep` (which sets `activeIndex` and permanently marks the step
 * `revealed`). Also returns `scrollToIndex`, shared by the progress rail and
 * the auto-advance logic built in later steps.
 */
export function useStepObserver() {
  const { revealStep } = useCalculator()

  const panelEls = useRef<Record<number, HTMLDivElement | null>>({})
  const wrapperEls = useRef<Record<number, HTMLDivElement | null>>({})
  const indexByPanelEl = useRef(new Map<Element, number>())
  const observer = useRef<IntersectionObserver | null>(null)

  // Ref callbacks must keep a stable identity across renders — otherwise
  // React calls them with `null` then the element again on every render,
  // which would repeatedly unobserve/observe the same nodes.
  const panelRefCallbacks = useRef<Record<number, DivRefCallback>>({})
  const wrapperRefCallbacks = useRef<Record<number, DivRefCallback>>({})

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          const index = indexByPanelEl.current.get(entry.target)
          if (index !== undefined) revealStep(index)
        }
      },
      { rootMargin: OBSERVER_ROOT_MARGIN, threshold: 0 },
    )
    observer.current = obs
    for (const el of Object.values(panelEls.current)) {
      if (el) obs.observe(el)
    }
    return () => obs.disconnect()
  }, [revealStep])

  const registerPanel = useCallback((index: number): DivRefCallback => {
    panelRefCallbacks.current[index] ??= (el) => {
      const previous = panelEls.current[index]
      if (previous) {
        observer.current?.unobserve(previous)
        indexByPanelEl.current.delete(previous)
      }
      panelEls.current[index] = el
      if (el) {
        indexByPanelEl.current.set(el, index)
        observer.current?.observe(el)
      }
    }
    return panelRefCallbacks.current[index]
  }, [])

  const registerWrapper = useCallback((index: number): DivRefCallback => {
    wrapperRefCallbacks.current[index] ??= (el) => {
      wrapperEls.current[index] = el
    }
    return wrapperRefCallbacks.current[index]
  }, [])

  // Steps 0-3 scroll to the top of their oversized wrapper (so the sticky
  // panel then pins naturally); the final step has no wrapper, so it scrolls
  // to the panel itself.
  const scrollToIndex = useCallback((index: number) => {
    const target = wrapperEls.current[index] ?? panelEls.current[index]
    if (target) window.scrollTo({ top: target.offsetTop, behavior: 'smooth' })
  }, [])

  return { registerPanel, registerWrapper, scrollToIndex }
}
