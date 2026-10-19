import { useId, type KeyboardEvent } from 'react'
import { StepPanel } from '../StepPanel'
import { RevealTile } from '../RevealTile'
import { Tile } from '../Tile'
import { Eyebrow } from '../Eyebrow'
import { FieldLabel } from '../FieldLabel'
import { FieldGroupHeading } from '../FieldGroupHeading'
import { LabeledMoneyField } from '../LabeledMoneyField'
import { MoneyInput } from '../MoneyInput'
import { SegmentedControl, type SegmentedOption } from '../SegmentedControl'
import { TextLink } from '../TextLink'
import { useCalculator } from '../../state/calculatorContext'
import { fmt, num } from '../../lib/calculations'
import { monthlyTakeHomeFromGross } from '../../lib/salary'
import { CURRENT_TAX_YEAR } from '../../lib/taxYears'
import { OUTGOING_FIELD_KEYS, OUTGOING_FIELD_LABELS, REGULAR_SAVING_LABEL, type OutgoingFieldKey } from '../../lib/budget'
import { goalById, presentationFor } from '../../lib/goals'
import { accentColorFor } from '../../lib/mode'
import type { DivRefCallback } from '../../lib/refs'
import type { TakeHomeMode } from '../../state/types'

/** Neutral toggle between typing take-home directly and working it out from an annual salary. */
const TAKE_HOME_MODE_OPTIONS: readonly SegmentedOption<TakeHomeMode>[] = [
  { value: 'takehome', label: 'Monthly take-home', activeBackground: 'var(--surface-selected)', activeColor: 'var(--text-primary)' },
  { value: 'salary', label: 'Annual salary', activeBackground: 'var(--surface-selected)', activeColor: 'var(--text-primary)' },
]

/** Rounds a computed take-home to whole pence, so the stored value isn't a long float. */
const roundPence = (n: number): number => Math.round(n * 100) / 100

interface BudgetStepProps {
  /** Position in the active flow — the eyebrow number and the Enter-advance target follow it. */
  index: number
  panelRef: DivRefCallback
  wrapperRef: DivRefCallback
  scrollToIndex: (index: number) => void
}

/** A field this step may render: the five shared outgoings, the regular saving the user already does, and "already saved". */
type BudgetFieldKey = OutgoingFieldKey | 'savingsMonthly' | 'savings'

/**
 * The Budget step — take-home pay plus monthly outgoings. Which fields show
 * depends on the goal, because two goals already collect money fields on the
 * Details step and must not ask for them twice: the emergency fund captured
 * its essentials there (so here it only needs take-home + what's set aside),
 * and the car captured its deposit there (so its "already saved" field is
 * hidden here). No pause-based auto-advance — with several
 * fields on screen a debounce firing mid-check-through yanks people away
 * before they've looked.
 */
export function BudgetStep({ index, panelRef, wrapperRef, scrollToIndex }: BudgetStepProps) {
  const { state, setField, setFields } = useCalculator()
  const goal = goalById(state.goalId)
  const accent = accentColorFor(state.mode)
  // Names whichever income input is showing. The visible FieldLabel above it
  // already says which one it is; without the association a screen reader
  // announces the step's most important field as a bare "spin button".
  // Generated rather than hand-written, as LabeledMoneyField does, so it
  // can't collide with another step's id.
  const incomeInputId = useId()

  // Take-home entry: typed directly, or worked out from an annual salary. In
  // salary mode the tax engine computes the monthly take-home and writes it to
  // `takeHome`, so everything downstream (spare cash, the verdict, the reverse
  // flip) reads a single source of truth and needs no salary awareness.
  const salaryMode = state.takeHomeMode === 'salary'
  const monthlyTakeHome = monthlyTakeHomeFromGross(num(state.grossSalary))

  const handleSalaryChange = (value: string) => {
    setFields({ grossSalary: value, takeHome: num(value) > 0 ? String(roundPence(monthlyTakeHomeFromGross(num(value)))) : '' })
  }

  const handleTakeHomeModeChange = (mode: TakeHomeMode) => {
    // Switching to salary mode with a salary already typed syncs take-home to
    // it; otherwise just flip the toggle and leave take-home untouched.
    if (mode === 'salary' && num(state.grossSalary) > 0) {
      setFields({ takeHomeMode: 'salary', takeHome: String(roundPence(monthlyTakeHomeFromGross(num(state.grossSalary)))) })
    } else {
      setField('takeHomeMode', mode)
    }
  }

  // What differs by kind of goal: see KIND_PRESENTATION in lib/goals.ts.
  const presentation = presentationFor(goal).budget
  // `null` when another step asks for the same figure, as the car's deposit does.
  const { savingsLabel } = presentation
  const outgoings: readonly OutgoingFieldKey[] = presentation.asksOutgoings ? OUTGOING_FIELD_KEYS : []
  const visibleKeys: BudgetFieldKey[] = [...outgoings, 'savingsMonthly', ...(savingsLabel !== null ? (['savings'] as const) : [])]

  // The user's current savings rate, shown back to them as they type. Without
  // it the field is just another box; with it they can see what share of
  // their pay already has a job before the new commitment is weighed up.
  const takeHomeMonthly = num(state.takeHome)
  const regularSaving = num(state.savingsMonthly)
  const savingRateCaption =
    takeHomeMonthly > 0 && regularSaving > 0 ? `That's ${Math.round((regularSaving / takeHomeMonthly) * 100)}% of your take-home pay.` : ''

  const { regularSavingHint } = presentation
  const outgoingLabel = (key: OutgoingFieldKey): string => presentation.outgoingOverrides[key]?.label ?? OUTGOING_FIELD_LABELS[key]
  const outgoingHint = (key: OutgoingFieldKey): string | undefined => presentation.outgoingOverrides[key]?.hint

  const isComplete = num(state.takeHome) > 0 && visibleKeys.every((key) => state[key] !== '')

  const handleEnterAdvance = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && isComplete) scrollToIndex(index + 1)
  }

  const savingsField = savingsLabel !== null && (
    <LabeledMoneyField
      label={savingsLabel}
      value={state.savings}
      onChange={(value) => setField('savings', value)}
      onKeyDown={handleEnterAdvance}
    />
  )

  // Regular saving and the lump sum already put by are grouped together and
  // kept out of the "outgoings" grid on purpose: neither is essential
  // spending, and only the first of the two reduces spare cash.
  const puttingAwaySection = (
    <div style={{ marginTop: outgoings.length > 0 ? 26 : 0 }}>
      <FieldGroupHeading>Money you&rsquo;re already putting away</FieldGroupHeading>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 18px' }}>
        <div>
          <LabeledMoneyField
            label={REGULAR_SAVING_LABEL}
            hint={regularSavingHint}
            value={state.savingsMonthly}
            onChange={(value) => setField('savingsMonthly', value)}
            onKeyDown={handleEnterAdvance}
          />
          {savingRateCaption && (
            <div style={{ marginTop: 8, fontSize: 'var(--fs-helper)', color: 'var(--text-tertiary-dim)', fontWeight: 600 }}>
              {savingRateCaption}
            </div>
          )}
        </div>
        {savingsField}
      </div>
    </div>
  )

  return (
    <StepPanel
      index={index}
      panelRef={panelRef}
      wrapperRef={wrapperRef}
      wrapperHeightVh={170}
      panelStyle={{ background: 'var(--bg-dark-1)' }}
    >
      <RevealTile revealed={Boolean(state.revealed[index])} style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
        <Tile maxWidth={680} padding="48px 48px">
          <Eyebrow color={accent} marginBottom={16}>
            Step {index} — Your budget
          </Eyebrow>
          <h2
            style={{
              fontSize: 'var(--fs-h1-budget)',
              lineHeight: 1.1,
              fontWeight: 800,
              letterSpacing: '-0.02em',
              margin: '0 0 30px',
            }}
          >
            {presentation.heading}
          </h2>

          <div style={{ marginBottom: 24 }}>
            <div style={{ marginBottom: 14 }}>
              <SegmentedControl options={TAKE_HOME_MODE_OPTIONS} value={state.takeHomeMode} onChange={handleTakeHomeModeChange} size="sm" />
            </div>
            <FieldLabel htmlFor={incomeInputId}>{salaryMode ? 'Annual salary (before tax)' : 'Take-home pay / month'}</FieldLabel>
            {salaryMode ? (
              <>
                <MoneyInput
                  id={incomeInputId}
                  value={state.grossSalary}
                  onChange={handleSalaryChange}
                  onKeyDown={handleEnterAdvance}
                  accentColor={accent}
                  fontSize="var(--fs-price-md)"
                  prefixFontSize="var(--fs-prefix-md)"
                  prefixTop={4}
                  paddingBottom={10}
                  paddingLeft={30}
                />
                {num(state.grossSalary) > 0 && (
                  <div style={{ marginTop: 12, fontSize: 'var(--fs-body)', color: 'var(--text-secondary)', fontWeight: 500 }}>
                    ≈{' '}
                    <span className="mono" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>
                      {fmt(monthlyTakeHome)}
                    </span>
                    /month take-home after tax &amp; NI
                    <div style={{ marginTop: 5, fontSize: 'var(--fs-helper)', color: 'var(--text-tertiary-dim)', fontWeight: 600 }}>
                      England, Wales &amp; NI, {CURRENT_TAX_YEAR.label} — single PAYE salary, no student loan or pension.{' '}
                      <TextLink href="/methodology/salary/" newTab>
                        How this is worked out →
                      </TextLink>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <MoneyInput
                id={incomeInputId}
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
            )}
          </div>

          {outgoings.length > 0 && (
            <>
              <FieldGroupHeading>Monthly outgoings (defaulted to £0 — adjust what applies to you)</FieldGroupHeading>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 18px' }}>
                {outgoings.map((key) => (
                  <LabeledMoneyField
                    key={key}
                    label={outgoingLabel(key)}
                    hint={outgoingHint(key)}
                    value={state[key]}
                    onChange={(value) => setField(key, value)}
                    onKeyDown={handleEnterAdvance}
                  />
                ))}
              </div>
            </>
          )}
          {puttingAwaySection}

          <div style={{ marginTop: 22, fontSize: 'var(--fs-helper)', color: 'var(--text-tertiary-dim)' }}>
            Adjust anything that applies, then press Enter or scroll to continue ↓
          </div>
        </Tile>
      </RevealTile>
    </StepPanel>
  )
}
