// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { StartOverButton } from './StartOverButton'

const getButton = () => screen.getByTestId('start-over')

describe('StartOverButton', () => {
  afterEach(cleanup)

  it('calls onClick when clicked', () => {
    const onClick = vi.fn()
    render(<StartOverButton onClick={onClick} />)
    fireEvent.click(getButton())
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('is a non-submitting button labelled "Start over"', () => {
    render(<StartOverButton onClick={vi.fn()} />)
    expect(getButton().getAttribute('type')).toBe('button')
    expect(getButton().textContent).toBe('Start over')
  })

  it('rests on the plain pill background', () => {
    render(<StartOverButton onClick={vi.fn()} />)
    expect(getButton().style.background).toBe('var(--pill-bg)')
  })

  it('swaps to the hover background while moused over and back on leave', () => {
    render(<StartOverButton onClick={vi.fn()} />)
    const button = getButton()
    fireEvent.mouseEnter(button)
    expect(button.style.background).toBe('var(--pill-bg-hover)')
    fireEvent.mouseLeave(button)
    expect(button.style.background).toBe('var(--pill-bg)')
  })

  it('does not stick in the hover background after a touch tap', () => {
    // Same event order a real tap produces: touchstart/touchend, then a
    // synthetic mouseenter, and no mouseleave.
    const onClick = vi.fn()
    render(<StartOverButton onClick={onClick} />)
    const button = getButton()
    fireEvent.touchStart(button)
    fireEvent.touchEnd(button)
    fireEvent.mouseEnter(button)
    fireEvent.click(button)

    expect(onClick).toHaveBeenCalledTimes(1)
    expect(button.style.background).toBe('var(--pill-bg)')
  })

  it('still hovers normally with a mouse after an earlier touch tap', () => {
    render(<StartOverButton onClick={vi.fn()} />)
    const button = getButton()
    fireEvent.touchStart(button)
    fireEvent.touchEnd(button)
    fireEvent.mouseEnter(button)
    fireEvent.mouseLeave(button)

    fireEvent.mouseEnter(button)
    expect(button.style.background).toBe('var(--pill-bg-hover)')
  })

  it('still hovers after a tap whose synthetic mouseenter never arrived', () => {
    // If a tap's synthetic mouseenter never fires, its touch mark must not
    // outlive the next mouseleave — otherwise it would swallow the following
    // real mouse hover, and a hybrid touch-and-mouse device would get a pill
    // that never lights up.
    render(<StartOverButton onClick={vi.fn()} />)
    const button = getButton()
    fireEvent.touchStart(button)
    fireEvent.touchEnd(button)
    fireEvent.mouseLeave(button)

    fireEvent.mouseEnter(button)
    expect(button.style.background).toBe('var(--pill-bg-hover)')
  })

  it('drops the hover background when focus leaves', () => {
    render(<StartOverButton onClick={vi.fn()} />)
    const button = getButton()
    fireEvent.mouseEnter(button)
    fireEvent.blur(button)
    expect(button.style.background).toBe('var(--pill-bg)')
  })
})
