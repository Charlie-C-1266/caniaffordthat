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

  it('takes its background from the `.pill-control` class, not an inline style, so the CSS hover can apply', () => {
    // jsdom can't evaluate `:hover` or media queries, so the hover itself, and
    // that a tap can't set it off, is proven in a real browser by
    // e2e/pill-hover-touch.spec.ts. What can be pinned here is the part that
    // would silently break it: an inline background beats any CSS rule.
    render(<StartOverButton onClick={() => {}} />)
    const control = screen.getByRole('button', { name: 'Start over' })
    expect(control.classList.contains('pill-control')).toBe(true)
    expect(control.style.background).toBe('')
  })
})
