import { useState } from 'react'
import { StepPanel } from '../StepPanel'
import { RevealTile } from '../RevealTile'
import { Tile } from '../Tile'
import { Eyebrow } from '../Eyebrow'
import { useCalculator } from '../../state/calculatorContext'
import type { Mode } from '../../state/types'
import type { DivRefCallback } from '../../lib/refs'

interface Step1ModeSelectProps {
  panelRef: DivRefCallback
  wrapperRef: DivRefCallback
  scrollToIndex: (index: number) => void
}

// Matches --delay-mode-select in tokens.css.
const MODE_SELECT_DELAY_MS = 250

interface ModeCardProps {
  title: string
  body: string
  active: boolean
  accentColor: string
  activeBg: string
  onClick: () => void
}

function ModeCard({ title, body, active, accentColor, activeBg, onClick }: ModeCardProps) {
  const [hovered, setHovered] = useState(false)

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        flex: 1,
        minWidth: 260,
        borderRadius: 'var(--radius-tile-sm)',
        padding: '32px 28px',
        cursor: 'pointer',
        textAlign: 'left',
        background: active ? activeBg : 'var(--tile-bg)',
        border: `var(--border-width-card) solid ${active ? accentColor : 'var(--tile-border-neutral)'}`,
        transition: `transform var(--duration-hover) ease`,
        transform: hovered ? 'translateY(-4px)' : 'translateY(0)',
        fontFamily: 'inherit',
        color: 'var(--text-primary)',
      }}
    >
      <div style={{ fontSize: 'var(--fs-input-md)', fontWeight: 800, marginBottom: 10 }}>{title}</div>
      <div style={{ fontSize: 'var(--fs-body)', color: 'var(--text-secondary)', lineHeight: 1.55 }}>{body}</div>
    </button>
  )
}

/** Step 1 — the user picks which question they want answered. */
export function Step1ModeSelect({ panelRef, wrapperRef, scrollToIndex }: Step1ModeSelectProps) {
  const { state, setField } = useCalculator()

  const selectMode = (mode: Mode) => {
    setField('mode', mode)
    setTimeout(() => scrollToIndex(2), MODE_SELECT_DELAY_MS)
  }

  return (
    <StepPanel index={1} panelRef={panelRef} wrapperRef={wrapperRef} panelStyle={{ background: 'var(--bg-dark-1)' }}>
      <RevealTile revealed={Boolean(state.revealed[1])} style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
        <Tile maxWidth={760} padding="52px 48px">
          <Eyebrow>Get started</Eyebrow>
          <h1
            style={{
              fontSize: 'var(--fs-h1-lg)',
              lineHeight: 1.05,
              fontWeight: 800,
              letterSpacing: '-0.03em',
              margin: '0 0 40px',
            }}
          >
            What do you
            <br />
            want to work out?
          </h1>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            <ModeCard
              title="Saving up"
              body="How long it'll take — or set a goal date and see the monthly amount."
              active={state.mode === 'save'}
              accentColor="var(--accent-save)"
              activeBg="var(--accent-save-bg)"
              onClick={() => selectMode('save')}
            />
            <ModeCard
              title="Paying monthly"
              body="Enter term and interest rate — see the payment and whether it fits."
              active={state.mode === 'monthly'}
              accentColor="var(--accent-finance)"
              activeBg="var(--accent-finance-bg)"
              onClick={() => selectMode('monthly')}
            />
          </div>
          <div style={{ marginTop: 32, fontSize: 'var(--fs-helper)', color: 'var(--text-tertiary-dim)' }}>
            ↓ Pick one to continue
          </div>
        </Tile>
      </RevealTile>
    </StepPanel>
  )
}
