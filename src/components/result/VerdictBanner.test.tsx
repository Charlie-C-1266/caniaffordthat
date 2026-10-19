// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { VerdictBanner } from './VerdictBanner'

// The banner is the one place the affordable/not-affordable colour lives, and
// its whole job is a single boolean branch — so an inverted or dropped
// `affordable` check would flip every result's verdict while the rest of the
// calculation stayed correct. These tests assert on what actually renders
// (the fill applied to the banner, the glyph in the chip, the copy), not on
// the component's internals.

/** The `<svg>` Lucide renders inside the icon chip. */
function glyph(container: HTMLElement): SVGSVGElement {
  const svg = container.querySelector('svg')
  if (!svg) throw new Error('expected the verdict banner to render an icon')
  return svg
}

describe('VerdictBanner', () => {
  afterEach(cleanup)

  it('renders the affordable fill, the check glyph and the given copy when affordable', () => {
    const { container } = render(<VerdictBanner affordable verdictText="Yes, you can afford this" verdictSub="£320 a month spare" />)

    const banner = screen.getByTestId('verdict-banner')
    expect(banner.style.background).toBe('var(--verdict-affordable)')

    const icon = glyph(container)
    expect(icon.getAttribute('class')).toContain('lucide-check')
    // The glyph is stroked in the same verdict colour as the fill behind it.
    expect(icon.getAttribute('stroke')).toBe('var(--verdict-affordable)')

    expect(screen.getByText('Yes, you can afford this')).toBeTruthy()
    expect(screen.getByText('£320 a month spare')).toBeTruthy()
  })

  it('renders the not-affordable fill, the x glyph and the given copy when not affordable', () => {
    const { container } = render(<VerdictBanner affordable={false} verdictText="Not right now" verdictSub="£140 a month short" />)

    const banner = screen.getByTestId('verdict-banner')
    expect(banner.style.background).toBe('var(--verdict-not-affordable)')

    const icon = glyph(container)
    expect(icon.getAttribute('class')).toContain('lucide-x')
    expect(icon.getAttribute('stroke')).toBe('var(--verdict-not-affordable)')

    expect(screen.getByText('Not right now')).toBeTruthy()
    expect(screen.getByText('£140 a month short')).toBeTruthy()
  })

  it('uses a different fill and glyph for each verdict', () => {
    const { container: yes } = render(<VerdictBanner affordable verdictText="Yes" verdictSub="sub" />)
    const { container: no } = render(<VerdictBanner affordable={false} verdictText="No" verdictSub="sub" />)

    const [yesBanner, noBanner] = screen.getAllByTestId('verdict-banner')
    expect(yesBanner.style.background).not.toBe(noBanner.style.background)
    expect(glyph(yes).getAttribute('class')).not.toBe(glyph(no).getAttribute('class'))
  })
})
