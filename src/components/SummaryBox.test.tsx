// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { SummaryBox } from './SummaryBox'

// SummaryBox exists so the soft readout box can't drift between the three
// steps that use it (Details' emergency-fund target, the vehicle purchase
// step's cash and balloon previews, and the running-costs total). It takes
// only children, so what's worth pinning is that it renders them untouched
// and keeps the shared surface tokens that make it one box everywhere.

describe('SummaryBox', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('renders its children', () => {
    render(<SummaryBox>You&apos;d need £7,500 saved</SummaryBox>)

    expect(screen.getByText("You'd need £7,500 saved")).toBeTruthy()
  })

  it('renders element children, not just text', () => {
    render(
      <SummaryBox>
        <strong data-testid="figure">£312</strong> a month
      </SummaryBox>,
    )

    expect(screen.getByTestId('figure').textContent).toBe('£312')
    expect(screen.getByTestId('figure').tagName).toBe('STRONG')
  })

  it('keeps the shared tile surface and secondary text tokens', () => {
    const { container } = render(<SummaryBox>Readout</SummaryBox>)

    const box = container.firstElementChild as HTMLElement
    // These are the tokens that make the box recognisably the same component
    // in all three steps — a drift here is the thing this file guards.
    expect(box.style.background).toBe('var(--tile-bg)')
    expect(box.style.color).toBe('var(--text-secondary)')
    expect(box.style.fontSize).toBe('var(--fs-body)')
    expect(box.style.padding).toBe('15px 17px')
  })

  it('renders without logging a console error or warning', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    render(<SummaryBox>Quiet</SummaryBox>)

    expect(error).not.toHaveBeenCalled()
    expect(warn).not.toHaveBeenCalled()
  })
})
