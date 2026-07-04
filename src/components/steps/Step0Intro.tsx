import { StepPanel } from '../StepPanel'
import { RevealTile } from '../RevealTile'
import { Tile } from '../Tile'
import { useCalculator } from '../../state/calculatorContext'
import type { DivRefCallback } from '../../lib/refs'

interface Step0IntroProps {
  panelRef: DivRefCallback
  wrapperRef: DivRefCallback
}

// Same accent-tinted radial glow used in the marketing/OG image — a bit of
// polish for the one screen that's meant to read as a "title screen" rather
// than a form step. Purely decorative, so it's hidden from screen readers.
function Glow() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        top: -250,
        right: -200,
        width: 700,
        height: 700,
        borderRadius: '50%',
        background: 'radial-gradient(circle, var(--accent-finance-bg) 0%, transparent 70%)',
        pointerEvents: 'none',
      }}
    />
  )
}

/** Step 0 — the title screen: explains what the tool does and how to use it. No input, no auto-advance; the user just scrolls on. */
export function Step0Intro({ panelRef, wrapperRef }: Step0IntroProps) {
  const { state } = useCalculator()

  return (
    <StepPanel
      index={0}
      panelRef={panelRef}
      wrapperRef={wrapperRef}
      panelStyle={{ background: 'var(--bg-dark-2)', position: 'relative', overflow: 'hidden' }}
    >
      <Glow />
      <RevealTile revealed={Boolean(state.revealed[0])} style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
        <Tile maxWidth={760} padding="52px 48px">
          <h1
            style={{
              fontSize: 'var(--fs-h1-lg)',
              lineHeight: 1.05,
              fontWeight: 800,
              letterSpacing: '-0.03em',
              margin: '0 0 24px',
            }}
          >
            Work out whether it's
            <br />
            within reach.
          </h1>
          <p style={{ margin: '0 0 0', fontSize: 'var(--fs-body)', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
            Answer a few quick questions about what you're buying, what you
            earn, and how you'd pay — and you'll get a straight yes-or-no
            verdict, backed by the actual numbers. Pick "saving up" or "paying
            monthly" next to get started; each step moves on by itself once
            you've filled it in, so just answer and keep scrolling.
          </p>
          <div style={{ marginTop: 32, fontSize: 'var(--fs-helper)', color: 'var(--text-tertiary-dim)' }}>
            ↓ Scroll to begin
          </div>
        </Tile>
      </RevealTile>
    </StepPanel>
  )
}
