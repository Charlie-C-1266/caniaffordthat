import type { KeyboardEvent } from 'react'
import { StepPanel } from '../StepPanel'
import { RevealTile } from '../RevealTile'
import { Tile } from '../Tile'
import { Eyebrow } from '../Eyebrow'
import { UnderlineInput } from '../UnderlineInput'
import { MoneyInput } from '../MoneyInput'
import { useCalculator } from '../../state/calculatorContext'
import { useDebouncedAdvance } from '../../hooks/useDebouncedAdvance'
import { num } from '../../lib/calculations'
import { accentColorFor, modeLabelFor } from '../../lib/mode'

type DivRefCallback = (el: HTMLDivElement | null) => void

interface Step1ItemPriceProps {
  panelRef: DivRefCallback
  wrapperRef: DivRefCallback
  scrollToIndex: (index: number) => void
}

/** Step 1 — what they're buying, and its price. Auto-advances once a valid price is entered. */
export function Step1ItemPrice({ panelRef, wrapperRef, scrollToIndex }: Step1ItemPriceProps) {
  const { state, setField } = useCalculator()
  const scheduleAdvance = useDebouncedAdvance(scrollToIndex)
  const accent = accentColorFor(state.mode)

  const handlePriceChange = (value: string) => {
    setField('itemPrice', value)
    if (num(value) > 0) scheduleAdvance(1, 2)
  }

  const handlePriceKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && num(event.currentTarget.value) > 0) scrollToIndex(2)
  }

  return (
    <StepPanel index={1} panelRef={panelRef} wrapperRef={wrapperRef} panelStyle={{ background: 'var(--bg-dark-2)' }}>
      <RevealTile revealed={Boolean(state.revealed[1])} style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
        <Tile maxWidth={640} padding="52px 48px">
          <Eyebrow color={accent}>{modeLabelFor(state.mode)}</Eyebrow>
          <h1
            style={{
              fontSize: 'var(--fs-h1-md)',
              lineHeight: 1.1,
              fontWeight: 800,
              letterSpacing: '-0.02em',
              margin: '0 0 36px',
            }}
          >
            What are you buying,
            <br />
            and how much is it?
          </h1>
          <div style={{ marginBottom: 32 }}>
            <UnderlineInput
              value={state.itemName}
              onChange={(value) => setField('itemName', value)}
              placeholder="e.g. New sofa"
              fontSize="var(--fs-input-md)"
              accentColor={accent}
            />
          </div>
          <MoneyInput
            value={state.itemPrice}
            onChange={handlePriceChange}
            onKeyDown={handlePriceKeyDown}
            accentColor={accent}
            fontSize="var(--fs-price)"
            prefixFontSize="var(--fs-prefix-lg)"
            prefixTop={6}
            paddingBottom={14}
            paddingLeft={38}
          />
          <div style={{ marginTop: 26, fontSize: 'var(--fs-helper)', color: 'var(--text-tertiary-dim)' }}>
            Press Enter, or just pause — we'll move on ↓
          </div>
        </Tile>
      </RevealTile>
    </StepPanel>
  )
}
