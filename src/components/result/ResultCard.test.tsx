// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { ResultCard } from './ResultCard'

// The frame both result cards share. Its job is order and pass-through: the
// verdict banner first, then the headline in the colour the card chose, then
// the card's own body. The two cards' own tests cover what goes inside.

const RESULT = {
  isAffordable: true,
  verdictText: "Yes — it's within reach.",
  verdictSub: 'It fits comfortably.',
  resultEyebrow: 'Your plan',
  headline: '8 months',
  subheadline: 'Saving £150 a month.',
}

describe('ResultCard', () => {
  afterEach(cleanup)

  it('renders the verdict, then the headline, then its children', () => {
    render(
      <ResultCard result={RESULT} eyebrowColor="var(--accent-save)">
        <p>The card's own body</p>
      </ResultCard>,
    )
    const text = document.body.textContent ?? ''
    const order = [RESULT.verdictText, RESULT.headline, "The card's own body"].map((part) => text.indexOf(part))
    expect(order.every((at) => at >= 0)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
    expect(screen.getByText(RESULT.subheadline)).toBeTruthy()
  })

  it('gives the eyebrow the colour the card passes in', () => {
    render(
      <ResultCard result={RESULT} eyebrowColor="var(--text-tertiary)">
        {null}
      </ResultCard>,
    )
    expect(screen.getByText(RESULT.resultEyebrow).style.color).toBe('var(--text-tertiary)')
  })
})
