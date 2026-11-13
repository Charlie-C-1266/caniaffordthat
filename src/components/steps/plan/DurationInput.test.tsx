// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { screen, cleanup, fireEvent, act } from '@testing-library/react'
import { renderWithCalculator, calculator } from '../../../test/renderWithCalculator'
import { DurationInput } from './DurationInput'
import { fmt } from '../../../lib/calculations'
import { SAVE_RATE_RANGE } from '../../../lib/sliderRanges'

// The "how much a month?" input, in its two faces: a share-of-spare-cash
// slider and a fixed £ amount. The behaviour worth testing is all in the
// handoff between them and in the caption, because that caption is the only
// place the app tells someone they have over-committed.
//
// On spare cash: `spareCashOf` is `Math.max(0, takeHome - committed)`, so
// spare cash is floored at zero and can never actually be negative. The
// issue's "zero or negative" case therefore has exactly one reachable half,
// and the tests below cover zero plus an over-committed budget (outgoings
// above take-home) that would be negative but for the floor. That is the
// real boundary, so it is the one pinned here.
//
// £2,000 take-home less £800 housing = £1,200 spare cash; at 25% the
// %-equivalent is £300.
const TAKE_HOME = '2000'
const HOUSING = '800'
const SPARE_CASH = 1200
const RATE_PCT = 25
const RATE_AMOUNT = (SPARE_CASH * RATE_PCT) / 100 // 300

const ACCENT = 'rgb(16, 185, 129)'

const percentButton = () => screen.getByRole('button', { name: '% of spare cash' })
const fixedAmountButton = () => screen.getByRole('button', { name: 'Fixed amount' })
const slider = () => screen.getByRole('slider', { name: "Share of spare cash you'll save" })
const amountField = () => screen.getByLabelText<HTMLInputElement>('Monthly saving')
/** The caption under the fixed-amount field. Both wordings end in a full stop, which keeps this clear of the toggle's own text. */
const caption = () => screen.queryByText(/spare cash( a month)?\.$/)

/** Renders the input with a known budget, plus whatever else the test needs. */
function renderDuration(state: Record<string, unknown> = {}) {
  return renderWithCalculator(<DurationInput accentColor={ACCENT} />, {
    takeHome: TAKE_HOME,
    housing: HOUSING,
    rate: RATE_PCT,
    ...state,
  })
}

/** Seeds fixed-amount mode with an amount already typed, which is the only state the caption reads. */
function renderWithAmount(monthlyAmount: string, budget: Record<string, unknown> = {}) {
  renderDuration({ rateMode: 'amount', monthlyAmount, ...budget })
}

describe('DurationInput', () => {
  afterEach(cleanup)

  describe('the slider face', () => {
    it('is what the step opens on', () => {
      renderDuration()

      expect(slider()).toBeDefined()
      expect(screen.queryByLabelText('Monthly saving')).toBeNull()
    })

    it('reads out the percentage and the £ it comes to, once there is spare cash', () => {
      renderDuration()

      expect(slider().getAttribute('aria-valuetext')).toBe(`${RATE_PCT}% · ${fmt(RATE_AMOUNT)}/mo`)
    })

    it('drops the £ figure when there is no spare cash, rather than reading out "£0/mo"', () => {
      renderDuration({ takeHome: '', housing: '' })

      expect(slider().getAttribute('aria-valuetext')).toBe(`${RATE_PCT}%`)
    })

    it('drops it for an over-committed budget too, where spare cash is floored at zero', () => {
      renderDuration({ takeHome: '1000', housing: '1500' })

      expect(slider().getAttribute('aria-valuetext')).toBe(`${RATE_PCT}%`)
    })

    it('rounds the £ figure to whole pounds', () => {
      // 33% of £1,200 is £396 exactly; 7% is £84. A rate that doesn't divide
      // cleanly must not leak pence into the read-out.
      renderDuration({ rate: 37 })

      expect(slider().getAttribute('aria-valuetext')).toBe(`37% · ${fmt(Math.round(SPARE_CASH * 0.37))}/mo`)
    })

    it('writes a dragged value to `rate`', () => {
      renderDuration()

      fireEvent.change(slider(), { target: { value: '60' } })

      expect(calculator().state.rate).toBe(60)
    })

    it('is held to the shared save-rate range', () => {
      renderDuration()
      const input = slider()

      expect(input.getAttribute('min')).toBe(String(SAVE_RATE_RANGE.min))
      expect(input.getAttribute('max')).toBe(String(SAVE_RATE_RANGE.max))
      expect(input.getAttribute('step')).toBe(String(SAVE_RATE_RANGE.step))
    })
  })

  describe('switching to a fixed amount', () => {
    it('seeds the field with the current %-equivalent, so the figure does not vanish', () => {
      renderDuration()

      fireEvent.click(fixedAmountButton())

      expect(calculator().state.rateMode).toBe('amount')
      expect(calculator().state.monthlyAmount).toBe(String(RATE_AMOUNT))
      expect(amountField().value).toBe(String(RATE_AMOUNT))
    })

    it('leaves an amount the user has already typed alone', () => {
      renderDuration({ monthlyAmount: '450' })

      fireEvent.click(fixedAmountButton())

      expect(calculator().state.monthlyAmount).toBe('450')
    })

    it('seeds nothing when there is no spare cash to work from', () => {
      // rateAmount is 0, so there is no meaningful figure to carry over.
      renderDuration({ takeHome: '', housing: '' })

      fireEvent.click(fixedAmountButton())

      expect(calculator().state.rateMode).toBe('amount')
      expect(calculator().state.monthlyAmount).toBe('')
    })

    it('seeds only once, so a round trip does not overwrite a later edit', () => {
      renderDuration()

      fireEvent.click(fixedAmountButton())
      fireEvent.change(amountField(), { target: { value: '500' } })
      fireEvent.click(percentButton())
      fireEvent.click(fixedAmountButton())

      expect(calculator().state.monthlyAmount).toBe('500')
    })

    it('switches back to the slider without touching the amount', () => {
      renderDuration({ rateMode: 'amount', monthlyAmount: '400' })

      fireEvent.click(percentButton())

      expect(calculator().state.rateMode).toBe('percent')
      expect(calculator().state.monthlyAmount).toBe('400')
      expect(slider()).toBeDefined()
    })

    it('writes a typed amount to `monthlyAmount`', () => {
      renderDuration({ rateMode: 'amount' })

      fireEvent.change(amountField(), { target: { value: '275' } })

      expect(calculator().state.monthlyAmount).toBe('275')
    })
  })

  describe('the caption under the fixed-amount field', () => {
    it('says what share of spare cash the amount is', () => {
      renderWithAmount('300')

      expect(caption()?.textContent).toBe(`25% of your ${fmt(SPARE_CASH)} spare cash.`)
    })

    it('rounds that share to a whole percent', () => {
      // £500 of £1,200 is 41.666…%.
      renderWithAmount('500')

      expect(caption()?.textContent).toBe(`42% of your ${fmt(SPARE_CASH)} spare cash.`)
    })

    it('warns when the amount is more than the spare cash', () => {
      renderWithAmount('1500')

      expect(caption()?.textContent).toBe(`That's more than your ${fmt(SPARE_CASH)} spare cash a month.`)
    })

    it('treats spending exactly all the spare cash as 100%, not as over-committing', () => {
      // The boundary is `amount > spareCash`, so the equal case stays on the
      // reassuring side of it.
      renderWithAmount(String(SPARE_CASH))

      expect(caption()?.textContent).toBe(`100% of your ${fmt(SPARE_CASH)} spare cash.`)
    })

    it('warns at a single pound over', () => {
      renderWithAmount(String(SPARE_CASH + 1))

      expect(caption()?.textContent).toContain("That's more than your")
    })

    it('says nothing while the field is blank', () => {
      renderWithAmount('')

      expect(caption()).toBeNull()
    })

    it('says nothing for a zero amount', () => {
      renderWithAmount('0')

      expect(caption()).toBeNull()
    })

    it('says nothing when there is no spare cash, rather than dividing by zero', () => {
      renderWithAmount('300', { takeHome: '', housing: '' })

      expect(caption()).toBeNull()
    })

    it('says nothing for an over-committed budget, where spare cash floors at zero', () => {
      renderWithAmount('300', { takeHome: '1000', housing: '1500' })

      expect(caption()).toBeNull()
    })

    it('never appears on the slider face, which has its own read-out', () => {
      renderDuration({ monthlyAmount: '300' })

      expect(caption()).toBeNull()
    })

    it('follows the amount as it is edited', () => {
      renderWithAmount('300')
      expect(caption()?.textContent).toContain('25% of your')

      act(() => calculator().setField('monthlyAmount', '1500'))

      expect(caption()?.textContent).toContain("That's more than your")
    })
  })

  describe('the mode toggle itself', () => {
    it('offers the two ways of setting the amount, in that order', () => {
      renderDuration()

      expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual(['% of spare cash', 'Fixed amount'])
    })

    it('marks the active face as pressed', () => {
      renderDuration()

      expect(percentButton().getAttribute('aria-pressed')).toBe('true')
      expect(fixedAmountButton().getAttribute('aria-pressed')).toBe('false')
    })

    it('gives both segments the same accent, since this choice does not change the app accent', () => {
      renderDuration()
      expect(percentButton().style.background).toBe(ACCENT)
      cleanup()

      renderDuration({ rateMode: 'amount' })
      expect(fixedAmountButton().style.background).toBe(ACCENT)
    })
  })
})
