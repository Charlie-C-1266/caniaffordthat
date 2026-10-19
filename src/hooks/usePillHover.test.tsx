// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePillHover } from './usePillHover'

// Direct tests for the hook rather than through a consumer. SourcesLink and
// StartOverButton exercise it only as far as their own background style, so
// the ordering that makes it work — a tap's mark surviving `touchend` to be
// consumed by the synthetic `mouseenter` that follows — can regress there
// without either of them failing. These tests pin that ordering itself.

/** Renders the hook and returns typed helpers for firing its handlers. */
function setup() {
  const { result } = renderHook(() => usePillHover())
  const fire = (handler: keyof ReturnType<typeof usePillHover>['hoverHandlers']) => act(() => result.current.hoverHandlers[handler]())
  return { result, fire, hovered: () => result.current.hovered }
}

/** The event order a real tap produces: no `mouseleave`, and `mouseenter` last. */
function tap(fire: ReturnType<typeof setup>['fire']) {
  fire('onTouchStart')
  fire('onTouchEnd')
  fire('onMouseEnter')
}

describe('usePillHover', () => {
  it('starts un-hovered', () => {
    const { hovered } = setup()
    expect(hovered()).toBe(false)
  })

  it('hovers on mouseenter and clears on mouseleave', () => {
    const { fire, hovered } = setup()

    fire('onMouseEnter')
    expect(hovered()).toBe(true)

    fire('onMouseLeave')
    expect(hovered()).toBe(false)
  })

  it('exposes exactly the five handlers consumers spread onto the element', () => {
    const { result } = setup()
    // Guards the contract SourcesLink and StartOverButton rely on: they spread
    // `hoverHandlers` wholesale, so a handler quietly dropped here would stop
    // being wired up with nothing else to notice.
    expect(Object.keys(result.current.hoverHandlers).toSorted()).toEqual([
      'onBlur',
      'onMouseEnter',
      'onMouseLeave',
      'onTouchEnd',
      'onTouchStart',
    ])
    for (const handler of Object.values(result.current.hoverHandlers)) {
      expect(typeof handler).toBe('function')
    }
  })

  it("does not hover on the synthetic mouseenter that follows a tap — this is #116's actual bug", () => {
    const { fire, hovered } = setup()

    tap(fire)

    expect(hovered()).toBe(false)
  })

  it('hovers on the next mouseenter after a tap has consumed its mark', () => {
    const { fire, hovered } = setup()

    tap(fire)
    // The mark is one-shot: a second mouseenter is a genuine mouse hover.
    fire('onMouseEnter')

    expect(hovered()).toBe(true)
  })

  it('hovers normally after a tap whose synthetic mouseenter never arrived', () => {
    // On a hybrid touch-and-mouse device the synthetic mouseenter can simply
    // not fire. mouseleave drops the mark so the cost is one ignored hover,
    // not a pill that never lights up again.
    const { fire, hovered } = setup()

    fire('onTouchStart')
    fire('onTouchEnd')
    fire('onMouseLeave')

    fire('onMouseEnter')
    expect(hovered()).toBe(true)
  })

  it('does not stack marks across repeated taps', () => {
    // Two touchstarts set the same single ref, so one mouseenter consumes the
    // lot. A counter-based mark would swallow the second hover instead.
    const { fire, hovered } = setup()

    fire('onTouchStart')
    fire('onTouchStart')
    fire('onMouseEnter')
    expect(hovered()).toBe(false)

    fire('onMouseEnter')
    expect(hovered()).toBe(true)
  })

  it('clears an active hover on touchend', () => {
    const { fire, hovered } = setup()

    fire('onMouseEnter')
    expect(hovered()).toBe(true)

    fire('onTouchEnd')
    expect(hovered()).toBe(false)
  })

  it('clears an active hover on blur', () => {
    const { fire, hovered } = setup()

    fire('onMouseEnter')
    expect(hovered()).toBe(true)

    fire('onBlur')
    expect(hovered()).toBe(false)
  })
})
