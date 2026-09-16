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
})
