// @vitest-environment jsdom
import { useState } from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { ProgressRail } from './ProgressRail'

const LABELS = ['Goal', 'Details', 'Budget', 'Plan', 'Result']
const ACCENT = '#7cf'

const dots = () => screen.getAllByRole('button')

/** The coloured dot inside the rail button with this label. */
const dotOf = (label: string) => screen.getByRole('button', { name: label }).firstElementChild as HTMLElement

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

  it('still reports the clicked index after the active dot moves', () => {
    // The test above pins routing on first render; this one re-checks it after
    // a re-render has moved the active dot, which is the state the rail is in
    // for real once the user starts scrolling through the steps.
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

  it('fills only the active dot with the accent colour, leaving the others hollow', () => {
    render(<ProgressRail activeIndex={1} labels={LABELS} accentColor="rgb(120, 200, 255)" onSelect={() => {}} />)

    expect(dotOf('Details').style.background).toBe('rgb(120, 200, 255)')
    // The longhand, not `background`: jsdom 31 reads an all-default `background: transparent` back as `none`.
    expect(dotOf('Goal').style.backgroundColor).toBe('transparent')
  })

  // #286: each button used to wrap only the visible dot (`padding: 0`), so a
  // step's hit area *was* the dot — 7×7px inactive, 10×10px active, against
  // WCAG 2.2 SC 2.5.8 Target Size (Minimum)'s 24×24px (AA). The real sizes are
  // measured in a browser by e2e/progress-rail-target-size.spec.ts; these pin
  // the styling that produces them, and that the dot keeps its own size.
  describe('target size (#286)', () => {
    it.each([
      ['the active step', 0],
      ['an inactive step', 2],
    ])('gives %s a button at least the minimum target size', (_case, activeIndex) => {
      render(<ProgressRail activeIndex={activeIndex} labels={LABELS} accentColor={ACCENT} onSelect={() => {}} />)

      for (const dot of dots()) {
        expect(dot.style.minWidth).toBe('var(--target-size-min)')
        expect(dot.style.minHeight).toBe('var(--target-size-min)')
        // Centred, so the dot sits in the middle of its hit area.
        expect(dot.style.justifyContent).toBe('center')
        expect(dot.style.alignItems).toBe('center')
      }
    })

    it('leaves the dot itself at its own size, so nothing looks different', () => {
      render(<ProgressRail activeIndex={1} labels={LABELS} accentColor={ACCENT} onSelect={() => {}} />)

      // The visible mark is still driven by the dot tokens, not the target size.
      expect(dotOf('Details').style.width).toBe('var(--dot-size-active)')
      expect(dotOf('Details').style.height).toBe('var(--dot-size-active)')
      expect(dotOf('Goal').style.width).toBe('var(--dot-size-inactive)')
      expect(dotOf('Goal').style.height).toBe('var(--dot-size-inactive)')
      expect(dotOf('Goal').style.border).toBe('var(--border-width-dot) solid var(--text-tertiary-dim)')
    })

    it('leaves the rail enough gap that neighbouring buttons cannot overlap', () => {
      // The spacing exception to SC 2.5.8 did not apply before: with gap 16
      // and a 7px dot, two inactive centres were 23px apart, so 24px circles
      // centred on them overlapped. A positive gap between 24px buttons means
      // the hit areas are separate by construction.
      const { container } = render(<ProgressRail activeIndex={0} labels={LABELS} accentColor={ACCENT} onSelect={() => {}} />)
      const nav = container.querySelector('nav')

      expect(nav).not.toBeNull()
      expect(Number.parseFloat((nav as HTMLElement).style.gap)).toBeGreaterThan(0)
    })

    it.each([
      ['a single step', ['Goal']],
      ['the first step active', LABELS],
      ['a long rail', ['One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight']],
    ])('sizes every button on %s', (_case, labels) => {
      render(<ProgressRail activeIndex={0} labels={labels} accentColor={ACCENT} onSelect={() => {}} />)

      expect(dots()).toHaveLength(labels.length)
      for (const dot of dots()) expect(dot.style.minHeight).toBe('var(--target-size-min)')
    })

    it("sizes the last step's button too when it is the active one", () => {
      render(<ProgressRail activeIndex={LABELS.length - 1} labels={LABELS} accentColor={ACCENT} onSelect={() => {}} />)

      const last = screen.getByRole('button', { name: 'Result' })
      expect(last.getAttribute('aria-current')).toBe('step')
      expect(last.style.minWidth).toBe('var(--target-size-min)')
      // The bigger button must not have swallowed the dot's own sizing.
      expect(dotOf('Result').style.width).toBe('var(--dot-size-active)')
    })

    it('keeps no padding on the button, so the minimum size is what sets the hit area', () => {
      render(<ProgressRail activeIndex={0} labels={LABELS} accentColor={ACCENT} onSelect={() => {}} />)

      expect(dots()[0].style.padding).toBe('0px')
    })
  })
})
