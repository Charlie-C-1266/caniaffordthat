// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react'
import { ResultActions } from './ResultActions'
import { CalculatorProvider } from '../../state/CalculatorProvider'
import { copyToClipboard } from '../../lib/clipboard'

// The component's behaviour under test is what it shows for each clipboard
// outcome, so the clipboard helper itself is mocked per-case.
vi.mock('../../lib/clipboard', () => ({ copyToClipboard: vi.fn() }))
const mockCopy = vi.mocked(copyToClipboard)

const LABEL_IDLE = 'Copy result link'
const LABEL_COPIED = 'Link copied ✓'
const LABEL_FAILED = "Couldn't copy — try again"
const LABEL_DURATION_MS = 2000

// What the live region says, which is deliberately not the visible label:
// read on its own it has to name the link, and the tick is decoration.
const ANNOUNCE_COPIED = 'Link copied'
const ANNOUNCE_FAILED = "Couldn't copy the link — try again"

function renderActions() {
  render(
    <CalculatorProvider>
      <ResultActions scrollToIndex={vi.fn()} />
    </CalculatorProvider>,
  )
  return screen.getByRole('button', { name: LABEL_IDLE })
}

/** The polite live region that reports the copy outcome. */
function liveRegion() {
  return screen.getByRole('status')
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

describe('ResultActions copy announcement', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockCopy.mockReset()
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('has an empty live region in the DOM before anything is clicked', () => {
    mockCopy.mockResolvedValue(true)
    renderActions()
    // Present from the first render and empty: a region inserted at the same
    // moment its text appears is not reliably announced, so it has to already
    // be there for the change to be noticed.
    expect(liveRegion()).toBeTruthy()
    expect(liveRegion().textContent).toBe('')
  })

  it('is announced to screen readers only — not visible, and the button label is untouched', async () => {
    mockCopy.mockResolvedValue(true)
    const button = renderActions()
    await clickAndSettle(button)

    // Hidden visually by the shared utility class (its declarations are
    // pinned in visuallyHidden.test.ts) rather than by inlined clip rules...
    expect(liveRegion().className).toBe('visually-hidden')
    // ...and not by anything that would drop it out of the accessibility
    // tree, which would make the region silent.
    expect(liveRegion().hidden).toBe(false)
    expect(liveRegion().getAttribute('aria-hidden')).toBeNull()

    // The announcement is a sibling of the button, not part of its name, so
    // the visible label and the button's accessible name are unchanged.
    expect(liveRegion().contains(button)).toBe(false)
    expect(button.textContent).toBe(LABEL_COPIED)
    expect(screen.getByRole('button', { name: LABEL_COPIED })).toBe(button)
  })

  it('announces a successful copy, then empties the region when the window ends', async () => {
    mockCopy.mockResolvedValue(true)
    const button = renderActions()
    await clickAndSettle(button)
    expect(liveRegion().textContent).toBe(ANNOUNCE_COPIED)

    await advancePastLabelWindow()
    // Emptied with the label, so the outcome isn't left sitting in the
    // accessibility tree long after the fact.
    expect(liveRegion().textContent).toBe('')
  })

  it('announces a failed copy, then empties the region when the window ends', async () => {
    mockCopy.mockResolvedValue(false)
    const button = renderActions()
    await clickAndSettle(button)
    // The failure is the message most worth hearing: previously this path
    // announced nothing at all.
    expect(liveRegion().textContent).toBe(ANNOUNCE_FAILED)

    await advancePastLabelWindow()
    expect(liveRegion().textContent).toBe('')
  })

  it('announces the new outcome on a quick retry, rather than being cleared early', async () => {
    mockCopy.mockResolvedValueOnce(false).mockResolvedValueOnce(true)
    const button = renderActions()
    await clickAndSettle(button)
    expect(liveRegion().textContent).toBe(ANNOUNCE_FAILED)

    // Retry partway through the failure's window.
    await advanceBy(1500)
    await clickAndSettle(button)
    expect(liveRegion().textContent).toBe(ANNOUNCE_COPIED)

    // Past the failed click's original deadline: its timer must not empty
    // the region out from under the confirmation.
    await advanceBy(600)
    expect(liveRegion().textContent).toBe(ANNOUNCE_COPIED)

    await advanceBy(LABEL_DURATION_MS - 600)
    expect(liveRegion().textContent).toBe('')
  })

  it('re-announces the same outcome on a second successful click', async () => {
    mockCopy.mockResolvedValue(true)
    const button = renderActions()
    await clickAndSettle(button)
    expect(liveRegion().textContent).toBe(ANNOUNCE_COPIED)

    // A live region is announced when its text *changes*, so writing the
    // identical string again would be silent. The region must therefore be
    // blanked while the copy is in flight...
    fireEvent.click(button)
    expect(liveRegion().textContent).toBe('')

    // ...and carry the outcome again once it settles, which is a real change.
    await act(() => Promise.resolve())
    expect(liveRegion().textContent).toBe(ANNOUNCE_COPIED)
  })

  it('leaves nothing running when unmounted mid-announcement', async () => {
    mockCopy.mockResolvedValue(true)
    const button = renderActions()
    await clickAndSettle(button)
    expect(liveRegion().textContent).toBe(ANNOUNCE_COPIED)
    expect(vi.getTimerCount()).toBe(1)

    cleanup()
    // The revert timer owns both the label and the announcement, so an
    // uncleared one would be a state update on an unmounted component.
    expect(vi.getTimerCount()).toBe(0)
    await advancePastLabelWindow()
  })
})

describe('ResultActions "Pick another goal"', () => {
  beforeEach(() => mockCopy.mockReset())
  afterEach(cleanup)

  it('sends the user back to the goal picker at flow index 0', () => {
    const scrollToIndex = vi.fn()
    render(
      <CalculatorProvider>
        <ResultActions scrollToIndex={scrollToIndex} />
      </CalculatorProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Pick another goal' }))

    // Index 0 is the goal picker in every flow — a hard-coded 0 rather than
    // anything derived, so this pins the contract the prop's doc states.
    expect(scrollToIndex).toHaveBeenCalledTimes(1)
    expect(scrollToIndex).toHaveBeenCalledWith(0)
    // Starting over is not a copy: the clipboard must stay untouched.
    expect(mockCopy).not.toHaveBeenCalled()
  })
})
