import { StepPanel } from '../StepPanel'
import { RevealTile } from '../RevealTile'
import { Tile } from '../Tile'
import { Eyebrow } from '../Eyebrow'
import { useCalculator } from '../../state/calculatorContext'

type DivRefCallback = (el: HTMLDivElement | null) => void

interface Step0IntroProps {
  panelRef: DivRefCallback
  wrapperRef: DivRefCallback
}

/** Step 0 — explains what the tool does and how to use it. No input, no auto-advance; the user just scrolls on. */
export function Step0Intro({ panelRef, wrapperRef }: Step0IntroProps) {
  const { state } = useCalculator()

  return (
    <StepPanel index={0} panelRef={panelRef} wrapperRef={wrapperRef} panelStyle={{ background: 'var(--bg-dark-2)' }}>
      <RevealTile revealed={Boolean(state.revealed[0])} style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
        <Tile maxWidth={760} padding="52px 48px">
          <Eyebrow>Welcome</Eyebrow>
          <h1
            style={{
              fontSize: 'var(--fs-h1-lg)',
              lineHeight: 1.05,
              fontWeight: 800,
              letterSpacing: '-0.03em',
              margin: '0 0 24px',
            }}
          >
            Can I Afford That?
          </h1>
          <p style={{ margin: '0 0 0', fontSize: 'var(--fs-body)', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
            Can I Afford That? helps you work out whether something is
            actually within reach — not just whether the card will go
            through. Tell us what you're buying, what you earn, and how
            you'd pay for it, and you'll get a straight yes-or-no verdict,
            backed by the actual numbers. Pick "saving up" or "paying
            monthly" on the next screen to get started — each step moves on
            by itself once you've filled it in, so just answer and keep
            scrolling.
          </p>
          <div style={{ marginTop: 32, fontSize: 'var(--fs-helper)', color: 'var(--text-tertiary-dim)' }}>
            ↓ Scroll to begin
          </div>
        </Tile>
      </RevealTile>
    </StepPanel>
  )
}
