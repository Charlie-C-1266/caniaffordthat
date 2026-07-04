import type { CSSProperties, ReactNode } from 'react'
import type { DivRefCallback } from '../lib/refs'

interface StepPanelProps {
  children: ReactNode
  /** Position in the 0-4 step sequence — drives z-index so later, still-sticky panels paint over earlier ones during scroll transitions. */
  index: number
  /** The last step has nothing after it, so it doesn't need scroll room to pin against. */
  isFinal?: boolean
  /** Extra scroll room above the pinned panel. Budget (step 2) needs more (170vh) than the others (160vh). */
  wrapperHeightVh?: number
  /** Observed by useStepObserver — this is the element whose visibility drives `activeIndex`. */
  panelRef: DivRefCallback
  /** Scroll target for this step (steps 0-3 only; the final step scrolls to its panel instead). */
  wrapperRef?: DivRefCallback
  panelStyle?: CSSProperties
  /** Test-only hook for e2e assertions (e.g. checking the result panel's background color) — never used for styling or behavior. */
  panelTestId?: string
}

const DEFAULT_WRAPPER_HEIGHT_VH = 160

const basePanelStyle: CSSProperties = {
  minHeight: '100vh',
  boxSizing: 'border-box',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  alignItems: 'center',
  padding: '120px 40px',
}

/**
 * Layout primitive behind the "pinned background, sliding-in tile" effect:
 * steps 0-3 sit in an oversized wrapper with a `position: sticky` inner
 * panel, so the panel stays pinned full-viewport while the user scrolls
 * through the extra height. The final step (`isFinal`) has nothing to pin
 * against, so it's just a plain full-viewport block.
 */
export function StepPanel({
  children,
  index,
  isFinal = false,
  wrapperHeightVh = DEFAULT_WRAPPER_HEIGHT_VH,
  panelRef,
  wrapperRef,
  panelStyle,
  panelTestId,
}: StepPanelProps) {
  const panel = (
    <div
      ref={panelRef}
      data-testid={panelTestId}
      style={{
        ...basePanelStyle,
        position: isFinal ? undefined : 'sticky',
        top: isFinal ? undefined : 0,
        zIndex: (index + 1) * 10,
        ...panelStyle,
      }}
    >
      {children}
    </div>
  )

  if (isFinal) return panel

  return (
    <div ref={wrapperRef} style={{ minHeight: `${wrapperHeightVh}vh`, position: 'relative' }}>
      {panel}
    </div>
  )
}
