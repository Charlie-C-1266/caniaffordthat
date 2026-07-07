import type { KeyboardEvent } from 'react'
import { StepPanel } from '../StepPanel'
import { RevealTile } from '../RevealTile'
import { Tile } from '../Tile'
import { Eyebrow } from '../Eyebrow'
import { FieldLabel } from '../FieldLabel'
import { LabeledMoneyField } from '../LabeledMoneyField'
import { MoneyInput } from '../MoneyInput'
import { useCalculator } from '../../state/calculatorContext'
import { num } from '../../lib/calculations'
import { OUTGOING_FIELD_KEYS, OUTGOING_FIELD_LABELS, type OutgoingFieldKey } from '../../lib/budget'
import { goalById } from '../../lib/goals'
import { accentColorFor } from '../../lib/mode'
import type { DivRefCallback } from '../../lib/refs'

interface Step2BudgetProps {
  panelRef: DivRefCallback
  wrapperRef: DivRefCallback
  scrollToIndex: (index: number) => void
}

/** A field this step may render: the five shared outgoings plus "already saved". */
type BudgetFieldKey = OutgoingFieldKey | 'savings'

/**
 * Step 3 — take-home pay plus monthly outgoings. Which fields show depends on
 * the goal (see design/adr/0004-0005): the emergency fund already captured its
 * essentials in Details (so here it only needs take-home + what's set aside),
 * and the car captured its deposit in Details (so its "already saved" field is
 * hidden here). No pause-based auto-advance — with several fields on screen a
 * debounce firing mid-check-through yanks people away before they've looked.
 */
export function Step2Budget({ panelRef, wrapperRef, scrollToIndex }: Step2BudgetProps) {
  const { state, setField } = useCalculator()
  const goal = goalById(state.goalId)
  const accent = accentColorFor(state.mode)

  const isEmergency = goal?.emergency === true
  // The car's savings is its Details deposit; don't ask for it twice.
  const showSavings = !goal?.deposit
  const savingsLabel = isEmergency ? 'Already set aside' : 'Already saved toward this'
  // Emergency essentials live in Details; other goals collect outgoings here.
  const outgoings: readonly OutgoingFieldKey[] = isEmergency ? [] : OUTGOING_FIELD_KEYS
  const visibleKeys: BudgetFieldKey[] = [...outgoings, ...(showSavings ? (['savings'] as const) : [])]

  const isComplete = num(state.takeHome) > 0 && visibleKeys.every((key) => state[key] !== '')

  const handleEnterAdvance = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && isComplete) scrollToIndex(3)
  }

  const savingsField = showSavings && (
    <LabeledMoneyField
      label={savingsLabel}
      value={state.savings}
      onChange={(value) => setField('savings', value)}
      onKeyDown={handleEnterAdvance}
    />
  )

  return (
    <StepPanel
      index={2}
      panelRef={panelRef}
      wrapperRef={wrapperRef}
      wrapperHeightVh={170}
      panelStyle={{ background: 'var(--bg-dark-1)' }}
    >
      <RevealTile revealed={Boolean(state.revealed[2])} style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
        <Tile maxWidth={680} padding="48px 48px">
          <Eyebrow color={accent} marginBottom={16}>
            Step 2 — Your budget
          </Eyebrow>
          <h1
            style={{
              fontSize: 'var(--fs-h1-budget)',
              lineHeight: 1.1,
              fontWeight: 800,
              letterSpacing: '-0.02em',
              margin: '0 0 30px',
            }}
          >
            {isEmergency ? "What's coming in?" : "What's coming in, and going out?"}
          </h1>

          <div style={{ marginBottom: 24 }}>
            <FieldLabel>Take-home pay / month</FieldLabel>
            <MoneyInput
              value={state.takeHome}
              onChange={(value) => setField('takeHome', value)}
              onKeyDown={handleEnterAdvance}
              accentColor={accent}
              fontSize="var(--fs-price-md)"
              prefixFontSize="var(--fs-prefix-md)"
              prefixTop={4}
              paddingBottom={10}
              paddingLeft={30}
            />
          </div>

          {isEmergency ? (
            savingsField && <div style={{ maxWidth: 320 }}>{savingsField}</div>
          ) : (
            <>
              <div
                style={{
                  fontSize: 'var(--fs-label)',
                  fontWeight: 700,
                  color: 'var(--text-tertiary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  marginBottom: 14,
                }}
              >
                Monthly outgoings (defaulted to £0 — adjust what applies to you)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 18px' }}>
                {outgoings.map((key) => (
                  <LabeledMoneyField
                    key={key}
                    label={OUTGOING_FIELD_LABELS[key]}
                    value={state[key]}
                    onChange={(value) => setField(key, value)}
                    onKeyDown={handleEnterAdvance}
                  />
                ))}
                {savingsField}
              </div>
            </>
          )}

          <div style={{ marginTop: 22, fontSize: 'var(--fs-helper)', color: 'var(--text-tertiary-dim)' }}>
            Adjust anything that applies, then press Enter or scroll to continue ↓
          </div>
        </Tile>
      </RevealTile>
    </StepPanel>
  )
}
