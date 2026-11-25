import { useEffect, useState } from 'react'

/**
 * Whether an element currently has more content than it can show, so it is
 * sideways-scrollable right now. Returns a ref callback to attach to the
 * scroller, and that answer.
 *
 * Used to make the docs' wide tables and formulas focusable *only while they
 * actually scroll* (#314). A keyboard user needs some way to reach a scroller
 * whose hidden columns contain nothing focusable — Safari and older Chromium
 * don't make scrollers focusable on their own, so the rate and threshold
 * columns of the tax-band tables were simply out of reach, which is WCAG
 * 2.1.1 and axe's `scrollable-region-focusable`. On a wide screen the same
 * table fits, and an extra tab stop on it would be noise.
 *
 * A ResizeObserver rather than one measurement at mount: whether a table
 * overflows changes with the viewport and again when the web font loads, and
 * both resize the element without any React render to hang a re-measure off.
 *
 * The element arrives through `useState` rather than `useRef` so the effect
 * re-runs when it is attached — a ref's `.current` changing wouldn't.
 */
export function useOverflowX<T extends HTMLElement>(): [ref: (node: T | null) => void, overflowing: boolean] {
  const [element, setElement] = useState<T | null>(null)
  const [overflowing, setOverflowing] = useState(false)

  useEffect(() => {
    // The first render, before the ref callback has run: nothing to measure yet.
    if (element === null) return

    const measure = () => setOverflowing(element.scrollWidth > element.clientWidth)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [element])

  return [setElement, overflowing]
}
