import { useEffect, useRef, useState } from 'react'
import { useCalculator } from '../../state/calculatorContext'
import { copyToClipboard } from '../../lib/clipboard'
import { buildShareParams } from '../../lib/urlState'

const COPIED_LABEL_DURATION_MS = 2000

interface ResultActionsProps {
  /** Jumps back to the goal picker (flow index 0 in every flow). */
  scrollToIndex: (index: number) => void
}

/** What the copy button last did: quiet until clicked, then a brief confirmation or failure label. */
type CopyStatus = 'idle' | 'copied' | 'failed'

const COPY_LABELS: Record<CopyStatus, string> = {
  idle: 'Copy result link',
  copied: 'Link copied ✓',
  failed: "Couldn't copy — try again",
}

/*
 * What the live region announces for each outcome. Separate from COPY_LABELS
 * because the two are read in different ways: the visible label sits inside
 * the button, whose name gives it context, while the announcement is read on
 * its own and so names the link explicitly. The tick is dropped too — it is
 * decoration a screen reader would otherwise spell out.
 */
const COPY_ANNOUNCEMENTS: Record<CopyStatus, string> = {
  idle: '',
  copied: 'Link copied',
  failed: "Couldn't copy the link — try again",
}

/** The result card's action row: copy a shareable link to this result, or start again from the goal picker. */
export function ResultActions({ scrollToIndex }: ResultActionsProps) {
  const { state } = useCalculator()
  const [copyStatus, setCopyStatus] = useState<CopyStatus>('idle')
  // The announcement is held separately from copyStatus rather than derived
  // from it, so it can be blanked at the start of a click while the visible
  // label still shows the previous outcome. See copyLink below for why that
  // matters.
  const [announcement, setAnnouncement] = useState('')
  // Only one revert-to-idle timer may be pending: each click restarts the
  // label window, so a quick retry after "Couldn't copy" isn't cut short by
  // the failed click's timer.
  const revertTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => () => clearTimeout(revertTimer.current), [])

  const copyLink = async () => {
    // Blank the region before awaiting the copy. A live region is announced
    // when its text *changes*, so writing the same string into it twice —
    // two successful clicks in a row — would be silent. This render commits
    // before the await resolves, making the outcome below a real change
    // every time. It also means the region is never left reading a stale
    // outcome while the copy is still in flight.
    setAnnouncement('')

    const params = buildShareParams(state)
    const url = `${window.location.origin}${window.location.pathname}?${params.toString()}`
    const succeeded = await copyToClipboard(url)
    // Both outcomes get the same brief label window: a confirmation on
    // success, and on failure (clipboard API unavailable/denied and the
    // execCommand fallback also failed) a quiet nudge instead of a button
    // that visibly does nothing.
    const status: CopyStatus = succeeded ? 'copied' : 'failed'
    setCopyStatus(status)
    setAnnouncement(COPY_ANNOUNCEMENTS[status])
    clearTimeout(revertTimer.current)
    revertTimer.current = setTimeout(() => {
      setCopyStatus('idle')
      setAnnouncement('')
    }, COPIED_LABEL_DURATION_MS)
  }

  return (
    <div style={{ display: 'flex', gap: 12 }}>
      {/*
       * Announces the copy outcome, which the visible label change alone does
       * not: this is the result card's main share action, and its failure
       * message is the one most worth hearing. Rendered unconditionally and
       * left empty when idle, because a live region inserted into the DOM at
       * the same moment its text appears is not reliably announced — it has
       * to already be there for the change to be noticed.
       */}
      <span role="status" className="visually-hidden">
        {announcement}
      </span>
      <button
        type="button"
        onClick={() => void copyLink()}
        style={{
          flex: 1,
          padding: 14,
          border: '1.5px solid var(--button-outline-strong)',
          borderRadius: 'var(--radius-button)',
          background: 'transparent',
          color: 'var(--text-primary)',
          fontSize: 'var(--fs-body)',
          fontWeight: 700,
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        {COPY_LABELS[copyStatus]}
      </button>
      <button
        type="button"
        onClick={() => scrollToIndex(0)}
        style={{
          flex: 1,
          padding: 14,
          border: 'none',
          borderRadius: 'var(--radius-button)',
          background: 'var(--text-primary)',
          color: 'var(--bg-dark-1)',
          fontSize: 'var(--fs-body)',
          fontWeight: 700,
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        Pick another goal
      </button>
    </div>
  )
}
