import { useState } from 'react'
import { useCalculator } from '../../state/calculatorContext'
import { copyToClipboard } from '../../lib/clipboard'
import { buildShareParams } from '../../lib/urlState'

const COPIED_LABEL_DURATION_MS = 2000

interface ResultActionsProps {
  /** Jumps back to the goal picker (flow index 0 in every flow). */
  scrollToIndex: (index: number) => void
}

/** The result card's action row: copy a shareable link to this result, or start again from the goal picker. */
/** What the copy button last did: quiet until clicked, then a brief confirmation or failure label. */
type CopyStatus = 'idle' | 'copied' | 'failed'

const COPY_LABELS: Record<CopyStatus, string> = {
  idle: 'Copy result link',
  copied: 'Link copied ✓',
  failed: "Couldn't copy — try again",
}

export function ResultActions({ scrollToIndex }: ResultActionsProps) {
  const { state } = useCalculator()
  const [copyStatus, setCopyStatus] = useState<CopyStatus>('idle')

  const copyLink = async () => {
    const params = buildShareParams(state)
    const url = `${window.location.origin}${window.location.pathname}?${params.toString()}`
    const succeeded = await copyToClipboard(url)
    // Both outcomes get the same brief label window: a confirmation on
    // success, and on failure (clipboard API unavailable/denied and the
    // execCommand fallback also failed) a quiet nudge instead of a button
    // that visibly does nothing.
    setCopyStatus(succeeded ? 'copied' : 'failed')
    setTimeout(() => setCopyStatus('idle'), COPIED_LABEL_DURATION_MS)
  }

  return (
    <div style={{ display: 'flex', gap: 12 }}>
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
