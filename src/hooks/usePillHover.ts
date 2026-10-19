import { useRef, useState } from 'react'

/**
 * Hover state for any control that styles its own hover inline rather than
 * through a CSS class — the persistent top-right "ghost pill" controls, and
 * the goal carousel's arrows and "Get started" CTA.
 *
 * A tap on a touch device fires a synthetic `mouseenter` *after* `touchend`,
 * and the matching `mouseleave` only arrives when the user next taps
 * somewhere else — or never. Driving the hover background straight off
 * `onMouseEnter` therefore leaves the pill visibly stuck in its hover state
 * after a tap, reading as a broken button. So a tap marks itself here, and
 * the synthetic `mouseenter` that follows consumes that mark instead of
 * lighting the pill up. A genuine mouse hover is untouched.
 *
 * Spread `hoverHandlers` onto the element and drive its hover styling from
 * `hovered` — a background for the pills, a `translateY` lift for the CTA.
 */
export function usePillHover() {
  const [hovered, setHovered] = useState(false)
  // Set by a tap, and deliberately *not* cleared on `touchend` — the whole
  // point is that it survives long enough for the synthetic `mouseenter`
  // after the tap to consume it.
  const fromTouch = useRef(false)

  return {
    hovered,
    hoverHandlers: {
      onMouseEnter: () => {
        if (fromTouch.current) {
          fromTouch.current = false
          return
        }
        setHovered(true)
      },
      onMouseLeave: () => {
        // The mark is dropped here too, so if a tap's synthetic `mouseenter`
        // never arrives to consume it, the cost is one ignored hover rather
        // than a permanently hover-less pill on a hybrid touch-and-mouse
        // device.
        fromTouch.current = false
        setHovered(false)
      },
      onTouchStart: () => {
        fromTouch.current = true
      },
      onTouchEnd: () => setHovered(false),
      onBlur: () => setHovered(false),
    },
  }
}
