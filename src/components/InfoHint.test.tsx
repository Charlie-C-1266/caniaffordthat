// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { InfoHint } from './InfoHint'

const TEXT = 'Whole-pound figures are fine here.'

const getButton = () => screen.getByRole('button', { name: TEXT })
const queryTooltip = () => screen.queryByRole('tooltip')

describe('InfoHint', () => {
  afterEach(cleanup)

  it('opens on hover and closes when the pointer leaves (desktop regression check)', () => {
    render(<InfoHint text={TEXT} />)
    expect(queryTooltip()).toBeNull()

    // React derives onMouseEnter/onMouseLeave from mouseover/mouseout.
    fireEvent.mouseOver(getButton())
    expect(queryTooltip()).not.toBeNull()
    expect(queryTooltip()?.textContent).toBe(TEXT)

    fireEvent.mouseOut(getButton())
    expect(queryTooltip()).toBeNull()
  })

  it('opens on keyboard focus and closes on blur (accessibility regression check)', () => {
    render(<InfoHint text={TEXT} />)
    fireEvent.focus(getButton())
    expect(queryTooltip()).not.toBeNull()

    fireEvent.blur(getButton())
    expect(queryTooltip()).toBeNull()
  })

  it('opens on a bare click, with no prior hover — the touch-tap case', () => {
    render(<InfoHint text={TEXT} />)
    fireEvent.click(getButton())
    expect(queryTooltip()).not.toBeNull()
    expect(getButton().getAttribute('aria-expanded')).toBe('true')
  })

  it('stays open through a mobile tap sequence (touchstart → synthetic hover/focus → click)', () => {
    // Mobile browsers fire synthetic mouseenter/focus *before* the tap's
    // click; a naive click-toggle would open on the synthetic hover and then
    // immediately toggle shut. Replay that full sequence and require the
    // tooltip to end up open.
    render(<InfoHint text={TEXT} />)
    const button = getButton()
    fireEvent.touchStart(button)
    fireEvent.mouseOver(button)
    fireEvent.focus(button)
    fireEvent.click(button)
    expect(queryTooltip()).not.toBeNull()
  })

  it('ignores the mouseleave that a second tap brings with it, so the tooltip survives to the click', () => {
    // Mid-tap, the touch guard is set and nothing but the click itself may
    // change `open`. A mobile browser can send the previous interaction's
    // mouseout after the new touchstart; without the guard that would close
    // an open tooltip before the tap's own click got to toggle it.
    render(<InfoHint text={TEXT} />)
    const button = getButton()
    fireEvent.click(button)
    expect(queryTooltip()).not.toBeNull()

    fireEvent.touchStart(button)
    fireEvent.mouseOut(button)
    expect(queryTooltip()).not.toBeNull()
  })

  it('ignores a blur that arrives mid-tap for the same reason', () => {
    render(<InfoHint text={TEXT} />)
    const button = getButton()
    fireEvent.click(button)
    expect(queryTooltip()).not.toBeNull()

    fireEvent.touchStart(button)
    fireEvent.blur(button)
    expect(queryTooltip()).not.toBeNull()
  })

  it('closes a tapped-open tooltip when tapping the button a second time', () => {
    render(<InfoHint text={TEXT} />)
    const button = getButton()
    fireEvent.touchStart(button)
    fireEvent.click(button)
    expect(queryTooltip()).not.toBeNull()

    fireEvent.touchStart(button)
    fireEvent.click(button)
    expect(queryTooltip()).toBeNull()
  })

  it('closes a tapped-open tooltip on a press anywhere else on the page', () => {
    render(
      <div>
        <InfoHint text={TEXT} />
        <p>elsewhere</p>
      </div>,
    )
    fireEvent.click(getButton())
    expect(queryTooltip()).not.toBeNull()

    fireEvent.pointerDown(screen.getByText('elsewhere'))
    expect(queryTooltip()).toBeNull()
  })

  it('does not close when the press lands on the tooltip/button itself', () => {
    render(<InfoHint text={TEXT} />)
    fireEvent.click(getButton())
    fireEvent.pointerDown(getButton())
    expect(queryTooltip()).not.toBeNull()
  })

  // WCAG 2.2 SC 1.4.13 (Content on Hover or Focus): content shown on hover or
  // focus must be dismissible without moving the pointer or focus. Escape is
  // the mechanism, and it has to work for all three ways the tooltip opens —
  // a hover-opened one leaves focus wherever it already was, which is why the
  // listener is on `document` rather than on the button.
  describe('Escape dismissal (#284)', () => {
    it('closes a focus-opened tooltip and leaves focus on the button', () => {
      render(<InfoHint text={TEXT} />)
      const button = getButton()
      button.focus()
      fireEvent.focus(button)
      expect(queryTooltip()).not.toBeNull()
      expect(button.getAttribute('aria-expanded')).toBe('true')

      fireEvent.keyDown(button, { key: 'Escape' })
      expect(queryTooltip()).toBeNull()
      expect(button.getAttribute('aria-expanded')).toBe('false')
      // The whole point of SC 1.4.13: dismissing must not move focus.
      expect(document.activeElement).toBe(button)
    })

    it('closes a hover-opened tooltip, even with focus elsewhere', () => {
      render(
        <div>
          <InfoHint text={TEXT} />
          <button type="button">elsewhere</button>
        </div>,
      )
      const other = screen.getByRole('button', { name: 'elsewhere' })
      other.focus()
      fireEvent.mouseOver(getButton())
      expect(queryTooltip()).not.toBeNull()

      // The key lands on whatever has focus, not on the hint's button.
      fireEvent.keyDown(other, { key: 'Escape' })
      expect(queryTooltip()).toBeNull()
      expect(document.activeElement).toBe(other)
    })

    it('closes a tapped-open tooltip', () => {
      render(<InfoHint text={TEXT} />)
      const button = getButton()
      fireEvent.touchStart(button)
      fireEvent.click(button)
      expect(queryTooltip()).not.toBeNull()

      fireEvent.keyDown(button, { key: 'Escape' })
      expect(queryTooltip()).toBeNull()
    })

    it('is a no-op while the tooltip is already closed', () => {
      render(<InfoHint text={TEXT} />)
      const button = getButton()
      expect(queryTooltip()).toBeNull()

      expect(() => fireEvent.keyDown(button, { key: 'Escape' })).not.toThrow()
      expect(() => fireEvent.keyDown(document, { key: 'Escape' })).not.toThrow()
      // Dismissal only ever closes; it must never toggle one open.
      expect(queryTooltip()).toBeNull()
      expect(button.getAttribute('aria-expanded')).toBe('false')
    })

    it.each(['Enter', 'Tab', 'ArrowDown', 'a', 'Esc'])('leaves an open tooltip open on %s', (key) => {
      // 'Esc' is the legacy IE/Edge name and is deliberately not handled:
      // matching it would be matching a key modern browsers never send.
      render(<InfoHint text={TEXT} />)
      const button = getButton()
      fireEvent.focus(button)
      expect(queryTooltip()).not.toBeNull()

      fireEvent.keyDown(button, { key })
      expect(queryTooltip()).not.toBeNull()
    })

    it("leaves Enter and Space to the button's native click, which still toggles", () => {
      // A real browser turns Enter/Space on a <button> into a click. The new
      // handler must not get in the way of that.
      render(<InfoHint text={TEXT} />)
      const button = getButton()
      fireEvent.focus(button)
      expect(queryTooltip()).not.toBeNull()

      fireEvent.keyDown(button, { key: 'Enter' })
      fireEvent.click(button)
      expect(queryTooltip()).toBeNull()

      fireEvent.keyDown(button, { key: ' ' })
      fireEvent.click(button)
      expect(queryTooltip()).not.toBeNull()
    })

    it('stays closed while focus remains on the button, then reopens on a later focus', () => {
      render(
        <div>
          <InfoHint text={TEXT} />
          <button type="button">elsewhere</button>
        </div>,
      )
      const button = getButton()
      const other = screen.getByRole('button', { name: 'elsewhere' })

      button.focus()
      fireEvent.focus(button)
      fireEvent.keyDown(button, { key: 'Escape' })
      expect(queryTooltip()).toBeNull()
      expect(document.activeElement).toBe(button)

      // No new focus or hover event, so nothing reopens it.
      fireEvent.keyDown(button, { key: 'Escape' })
      expect(queryTooltip()).toBeNull()

      // Tab away and back: the hint behaves exactly as it did before.
      other.focus()
      fireEvent.blur(button)
      fireEvent.focus(other)
      button.focus()
      fireEvent.focus(button)
      expect(queryTooltip()).not.toBeNull()
    })

    it('reopens on hover and on a click after an Escape dismissal', () => {
      render(<InfoHint text={TEXT} />)
      const button = getButton()

      fireEvent.mouseOver(button)
      fireEvent.keyDown(button, { key: 'Escape' })
      expect(queryTooltip()).toBeNull()

      fireEvent.click(button)
      expect(queryTooltip()).not.toBeNull()

      fireEvent.keyDown(button, { key: 'Escape' })
      expect(queryTooltip()).toBeNull()
      fireEvent.mouseOut(button)
      fireEvent.mouseOver(button)
      expect(queryTooltip()).not.toBeNull()
    })

    it('does not disturb the tap guard: a tap still opens the tooltip after an Escape', () => {
      // Escape must not reset `touchRef` (#31). If it did, the synthetic
      // hover/focus a mobile browser fires before the tap's click would open
      // the tooltip and the click would immediately toggle it shut again.
      render(<InfoHint text={TEXT} />)
      const button = getButton()
      fireEvent.focus(button)
      fireEvent.keyDown(button, { key: 'Escape' })
      expect(queryTooltip()).toBeNull()

      fireEvent.touchStart(button)
      fireEvent.mouseOver(button)
      fireEvent.focus(button)
      fireEvent.click(button)
      expect(queryTooltip()).not.toBeNull()
    })

    it('stops listening once closed, so no listener is left on the document', () => {
      const { unmount } = render(<InfoHint text={TEXT} />)
      const button = getButton()
      fireEvent.focus(button)
      expect(queryTooltip()).not.toBeNull()

      const removals: string[] = []
      const realRemove = document.removeEventListener.bind(document)
      document.removeEventListener = ((type: string, ...rest: unknown[]) => {
        removals.push(type)
        return (realRemove as (...args: unknown[]) => void)(type, ...rest)
      }) as typeof document.removeEventListener

      try {
        fireEvent.keyDown(button, { key: 'Escape' })
        expect(removals).toContain('keydown')
        expect(removals).toContain('pointerdown')
      } finally {
        document.removeEventListener = realRemove
        unmount()
      }
    })
  })
})
