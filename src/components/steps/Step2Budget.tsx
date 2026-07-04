import type { KeyboardEvent } from 'react'
import { StepPanel } from '../StepPanel'
import { RevealTile } from '../RevealTile'
import { Tile } from '../Tile'
import { Eyebrow } from '../Eyebrow'
import { MoneyInput } from '../MoneyInput'
import { useCalculator } from '../../state/calculatorContext'
import { useDebouncedAdvance } from '../../hooks/useDebouncedAdvance'
import { num } from '../../lib/calculations'
import { accentColorFor } from '../../lib/mode'

type DivRefCallback = (el: HTMLDivElement | null) => void

interface Step2BudgetProps {
  panelRef: DivRefCallback
  wrapperRef: DivRefCallback
  scrollToIndex: (index: number) => void
}

type BudgetFieldKey = 'housing' | 'utilities' | 'groceries' | 'transport' | 'debts' | 'savings'

const OPTIONAL_FIELDS: { key: BudgetFieldKey; label: string }[] = [
  { key: 'housing', label: 'Housing (rent/mortgage)' },
  { key: 'utilities', label: 'Utilities & bills' },
  { key: 'groceries', label: 'Groceries & everyday spend' },
  { key: 'transport', label: 'Transport' },
  { key: 'debts', label: 'Debt repayments' },
  { key: 'savings', label: 'Already saved toward this' },
]

interface BudgetFieldProps {
  label: string
  value: string
  onChange: (value: string) => void
}

function BudgetField({ label, value, onChange }: BudgetFieldProps) {
  return (
    <div>
      <label
        style={{
          display: 'block',
          fontSize: 'var(--fs-label-sm)',
          fontWeight: 600,
          color: 'var(--text-secondary-dim)',
          marginBottom: 7,
        }}
      >
        {label}
      </label>
      <MoneyInput
        value={value}
        onChange={onChange}
        accentColor="var(--text-primary)"
        idleColor="var(--input-underline)"
        fontSize="var(--fs-body-lg)"
        fontWeight={700}
        fontFamily="inherit"
        borderWidth="var(--border-width-underline)"
        prefixFontSize="var(--fs-prefix-sm)"
        prefixTop={6}
        paddingBottom={7}
        paddingLeft={15}
      />
    </div>
  )
}

/** Step 2 — take-home pay (required) plus six optional monthly outgoings. */
export function Step2Budget({ panelRef, wrapperRef, scrollToIndex }: Step2BudgetProps) {
  const { state, setField } = useCalculator()
  const scheduleAdvance = useDebouncedAdvance(scrollToIndex)
  const accent = accentColorFor(state.mode)

  const handleTakeHomeChange = (value: string) => {
    setField('takeHome', value)
    if (num(value) > 0) scheduleAdvance(2, 3)
  }

  const handleTakeHomeKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && num(event.currentTarget.value) > 0) scrollToIndex(3)
  }

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
            Your budget
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
            What's coming in,
            <br />
            and going out?
          </h1>

          <div style={{ marginBottom: 24 }}>
            <label
              style={{
                display: 'block',
                fontSize: 'var(--fs-helper)',
                fontWeight: 600,
                color: 'var(--text-secondary-dim)',
                marginBottom: 8,
              }}
            >
              Take-home pay / month
            </label>
            <MoneyInput
              value={state.takeHome}
              onChange={handleTakeHomeChange}
              onKeyDown={handleTakeHomeKeyDown}
              accentColor={accent}
              fontSize="var(--fs-price-md)"
              prefixFontSize="var(--fs-prefix-md)"
              prefixTop={4}
              paddingBottom={10}
              paddingLeft={30}
            />
          </div>

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
            Monthly outgoings (optional, but more detail = a better number)
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 18px' }}>
            {OPTIONAL_FIELDS.map(({ key, label }) => (
              <BudgetField key={key} label={label} value={state[key]} onChange={(value) => setField(key, value)} />
            ))}
          </div>

          <div style={{ marginTop: 22, fontSize: 'var(--fs-helper)', color: 'var(--text-tertiary-dim)' }}>
            Only take-home is required — press Enter or pause to continue ↓
          </div>
        </Tile>
      </RevealTile>
    </StepPanel>
  )
}
