// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react'
import { ResultActions } from './ResultActions'
import { CalculatorProvider } from '../../state/CalculatorProvider'
import { copyToClipboard } from '../../lib/clipboard'

// The component's behavior under test is what it shows for each clipboard
// outcome, so the clipboard helper itself is mocked per-case.
vi.mock('../../lib/clipboard', () => ({ copyToClipboard: vi.fn() }))
const mockCopy = vi.mocked(copyToClipboard)

const LABEL_IDLE = 'Copy result link'
const LABEL_COPIED = 'Link copied ✓'
const LABEL_FAILED = "Couldn't copy — try again"
const LABEL_DURATION_MS = 2000

function renderActions() {
  render(
    <CalculatorProvider>
      <ResultActions scrollToIndex={vi.fn()} />
    </CalculatorProvider>,
  )
  return screen.getByRole('button', { name: LABEL_IDLE })
}

/** Clicks the copy button and flushes the async copy call's microtasks. */
async function clickAndSettle(button: HTMLElement) {
  fireEvent.click(button)
  await act(() => Promise.resolve())
}

/** Advances the fake clock, inside act so React flushes any revert that fires. */
async function advanceBy(ms: number) {
  await act(() => {
    vi.advanceTimersByTime(ms)
    return Promise.resolve()
  })
}

/** Advances the fake clock past the label window. */
async function advancePastLabelWindow() {
  await advanceBy(LABEL_DURATION_MS)
}

describe('ResultActions copy feedback', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockCopy.mockReset()
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('copies a shareable link for the current state', async () => {
    mockCopy.mockResolvedValue(true)
    const button = renderActions()
    await clickAndSettle(button)
    expect(mockCopy).toHaveBeenCalledTimes(1)
    const copiedUrl = mockCopy.mock.calls[0][0]
    // origin + pathname + the share params — a URL someone else can open.
    expect(copiedUrl.startsWith(`${window.location.origin}${window.location.pathname}?`)).toBe(true)
  })

  it('shows "Link copied ✓" on success, then reverts after the label window', async () => {
    mockCopy.mockResolvedValue(true)
    const button = renderActions()
    await clickAndSettle(button)
    expect(button.textContent).toBe(LABEL_COPIED)

    await advancePastLabelWindow()
    expect(button.textContent).toBe(LABEL_IDLE)
  })

  it('shows a visible failure label when the copy fails, then reverts after the same window', async () => {
    mockCopy.mockResolvedValue(false)
    const button = renderActions()
    await clickAndSettle(button)
    // Previously this path silently did nothing — the button must now say so.
    expect(button.textContent).toBe(LABEL_FAILED)

    await advancePastLabelWindow()
    expect(button.textContent).toBe(LABEL_IDLE)
  })

  it('recovers to the success label when a retry succeeds after a failure, for a full label window', async () => {
    mockCopy.mockResolvedValueOnce(false).mockResolvedValueOnce(true)
    const button = renderActions()
    await clickAndSettle(button)
    expect(button.textContent).toBe(LABEL_FAILED)

    // Retry partway through the failure label's window.
    await advanceBy(1500)
    await clickAndSettle(button)
    expect(button.textContent).toBe(LABEL_COPIED)

    // Past the failed click's original deadline: the confirmation must survive
    // it rather than being reverted by that earlier click's timer.
    await advanceBy(600)
    expect(button.textContent).toBe(LABEL_COPIED)

    // The full window after the successful click, then back to idle.
    await advanceBy(LABEL_DURATION_MS - 600)
    expect(button.textContent).toBe(LABEL_IDLE)
  })

  it('leaves no revert timer running once unmounted mid-window', async () => {
    mockCopy.mockResolvedValue(true)
    const button = renderActions()
    await clickAndSettle(button)
    expect(vi.getTimerCount()).toBe(1)

    cleanup()
    expect(vi.getTimerCount()).toBe(0)
  })
})
