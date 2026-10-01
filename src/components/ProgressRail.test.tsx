// @vitest-environment jsdom
import { useState } from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { ProgressRail } from './ProgressRail'

const LABELS = ['Goal', 'Details', 'Budget', 'Plan', 'Result']
const ACCENT = '#7cf'

const dots = () => screen.getAllByRole('button')

describe('ProgressRail', () => {
  afterEach(cleanup)

  it('marks exactly the active dot with aria-current="step"', () => {
    render(<ProgressRail activeIndex={2} labels={LABELS} accentColor={ACCENT} onSelect={() => {}} />)

    const current = dots().filter((dot) => dot.getAttribute('aria-current') === 'step')
    expect(current).toHaveLength(1)
    expect(current[0]).toBe(screen.getByRole('button', { name: 'Budget' }))
  })

  it('omits aria-current entirely on inactive dots rather than setting it to "false"', () => {
    // aria-current="false" is valid ARIA but means "not current" only to
    // implementations that read it; omitting the attribute is what the
    // component promises, and what assistive tech handles uniformly.
    render(<ProgressRail activeIndex={0} labels={LABELS} accentColor={ACCENT} onSelect={() => {}} />)

    for (const label of LABELS.slice(1)) {
      expect(screen.getByRole('button', { name: label }).hasAttribute('aria-current')).toBe(false)
    }
  })

  it('names every dot after its own label, so the rail is navigable without sighted access', () => {
    render(<ProgressRail activeIndex={0} labels={LABELS} accentColor={ACCENT} onSelect={() => {}} />)

    expect(dots().map((dot) => dot.getAttribute('aria-label'))).toEqual(LABELS)
  })

  it('calls onSelect with the clicked dot’s own index', () => {
    const onSelect = vi.fn()
    render(<ProgressRail activeIndex={0} labels={LABELS} accentColor={ACCENT} onSelect={onSelect} />)

    fireEvent.click(screen.getByRole('button', { name: 'Budget' }))
    expect(onSelect).toHaveBeenCalledExactlyOnceWith(2)
  })

  it('still reports the clicked index after the active dot moves — no stale closure across re-renders', () => {
    // The per-dot handler closes over `index` from the .map(); a bug that
    // captured the *active* index instead would pass the test above (active
    // starts at 0) and silently mis-route every jump once the user scrolls.
    const onSelect = vi.fn()

    function Harness() {
      const [activeIndex, setActiveIndex] = useState(0)
      return (
        <div>
          <button type="button" onClick={() => setActiveIndex(4)}>
            advance
          </button>
          <ProgressRail
            activeIndex={activeIndex}
            labels={LABELS}
            accentColor={ACCENT}
            onSelect={(index) => {
              onSelect(index)
            }}
          />
        </div>
      )
    }

    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'advance' }))
    expect(screen.getByRole('button', { name: 'Result' }).getAttribute('aria-current')).toBe('step')

    fireEvent.click(screen.getByRole('button', { name: 'Budget' }))
    expect(onSelect).toHaveBeenCalledExactlyOnceWith(2)
  })

  it('calls onSelect for the already-active dot too — there is no no-op guard', () => {
    // Re-selecting the current step is a real interaction: it re-scrolls the
    // step back into place after the user has drifted mid-step.
    const onSelect = vi.fn()
    render(<ProgressRail activeIndex={3} labels={LABELS} accentColor={ACCENT} onSelect={onSelect} />)

    fireEvent.click(screen.getByRole('button', { name: 'Plan' }))
    expect(onSelect).toHaveBeenCalledExactlyOnceWith(3)
  })

  it('renders no dots for an empty label list instead of throwing', () => {
    const { container } = render(<ProgressRail activeIndex={0} labels={[]} accentColor={ACCENT} onSelect={() => {}} />)

    expect(screen.queryAllByRole('button')).toHaveLength(0)
    // The rail itself still renders, so the nav landmark doesn't blink in and
    // out of the accessibility tree as labels arrive.
    expect(container.querySelector('nav[aria-label="Step progress"]')).not.toBeNull()
  })

  it('fills only the active dot with the accent color, leaving the others hollow', () => {
    render(<ProgressRail activeIndex={1} labels={LABELS} accentColor="rgb(120, 200, 255)" onSelect={() => {}} />)

    const dotOf = (label: string) => screen.getByRole('button', { name: label }).firstElementChild as HTMLElement
    expect(dotOf('Details').style.background).toBe('rgb(120, 200, 255)')
    expect(dotOf('Goal').style.background).toBe('transparent')
  })
})
