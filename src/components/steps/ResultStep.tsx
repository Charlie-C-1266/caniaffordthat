import type { ReactNode } from 'react'
import { StepPanel } from '../StepPanel'
import { RevealTile } from '../RevealTile'
import { Tile } from '../Tile'
import { StandardResultCard } from '../result/StandardResultCard'
import { VehicleResultCard } from '../result/VehicleResultCard'
import { useCalculator } from '../../state/calculatorContext'
import { deriveResult } from '../../lib/derive'
import { deriveVehicleResult } from '../../lib/vehicle'
import { goalById, presentationFor, type GoalKind } from '../../lib/goals'
import { flowForGoal } from '../../lib/flow'
import { deductionsTakeAllPay } from '../../lib/payProfile'
import type { DivRefCallback } from '../../lib/refs'
import type { CalculatorState } from '../../state/types'

interface ResultStepProps {
  /** Position in the active flow (always last). */
  index: number
  panelRef: DivRefCallback
  scrollToIndex: (index: number) => void
}

type ResultCardBuilder = (state: CalculatorState, scrollToIndex: (index: number) => void) => ReactNode

/** The standard engine and card, shared by the standard goals and the emergency fund. */
const standardCard: ResultCardBuilder = (state, scrollToIndex) => {
  const result = deriveResult(state)
  return result === null ? null : <StandardResultCard result={result} scrollToIndex={scrollToIndex} />
}

/**
 * Each kind of goal's result card, from the engine that kind uses, or `null`
 * while the plan is missing what that engine needs. A Record, so a new kind
 * won't compile until it picks its engine and card.
 */
const RESULT_CARDS: Record<GoalKind, ResultCardBuilder> = {
  standard: standardCard,
  emergency: standardCard,
  vehicle: (state, scrollToIndex) => {
    const result = deriveVehicleResult(state)
    return result === null ? null : <VehicleResultCard result={result} scrollToIndex={scrollToIndex} />
  },
}

/**
 * Why there is no result when "About your pay" has taken the whole salary
 * (#317). The goal's own `resultFallback` asks for a price and take-home the
 * user has already given; the real reason is the pension they entered, and
 * until now the page never said so. Shared by all three goal kinds, because
 * the dead end is the same whichever engine returned `null`.
 */
export const DEDUCTIONS_TAKE_ALL_PAY_RESULT =
  'Your pension takes all of the salary you entered, so there\u2019s no take-home pay left to plan with. Lower the pension contribution in \u201cAbout your pay\u201d on the Budget step and your result will appear.'

/** The nudge shown in place of the fallback when the pay profile leaves nothing to plan with, with a way straight back to the field that caused it. */
function DeductionsTakeAllPayNote({ onBackToBudget }: { onBackToBudget: () => void }) {
  return (
    <Tile maxWidth={640} padding="var(--tile-padding-y, 40px) var(--tile-padding-x, 44px)">
      <div style={{ fontSize: 15, color: 'var(--text-secondary)', fontWeight: 500 }}>{DEDUCTIONS_TAKE_ALL_PAY_RESULT}</div>
      <button
        type="button"
        onClick={onBackToBudget}
        style={{
          marginTop: 20,
          padding: 14,
          width: '100%',
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
        Back to your budget
      </button>
    </Tile>
  )
}

/** The final step: picks the result card for the active flow (vehicle vs standard), or the "fill these in first" fallback. */
export function ResultStep({ index, panelRef, scrollToIndex }: ResultStepProps) {
  const { state } = useCalculator()
  const goal = goalById(state.goalId)
  // Before a goal is chosen there's nothing to show, so the standard engine's
  // `null` and fallback stand in.
  const card = RESULT_CARDS[goal?.kind ?? 'standard'](state, scrollToIndex)
  // Which step to send someone back to. Every flow that reaches a result has
  // a Budget step; the pre-goal flow has neither, so it keeps the fallback
  // rather than offering a button with nowhere to go.
  const budgetIndex = flowForGoal(goal).findIndex((step) => step.id === 'budget')
  const deductionsTakeAll = deductionsTakeAllPay(state) && budgetIndex >= 0

  return (
    <StepPanel
      index={index}
      isFinal
      panelRef={panelRef}
      // Its own vertical padding, but the same gutters as every other step so
      // the result tile gets the phone width back too (#316).
      panelStyle={{
        background: 'var(--bg-dark-1)',
        padding: '80px var(--step-gutter-x-end) 56px var(--step-gutter-x-start)',
      }}
      panelTestId="result-panel"
    >
      <RevealTile
        revealed={Boolean(state.revealed[index])}
        style={{ width: '100%', maxWidth: 640, display: 'flex', justifyContent: 'center' }}
      >
        {card ??
          (deductionsTakeAll ? (
            <DeductionsTakeAllPayNote onBackToBudget={() => scrollToIndex(budgetIndex)} />
          ) : (
            <Tile maxWidth={640} padding="var(--tile-padding-y, 40px) var(--tile-padding-x, 44px)">
              <div style={{ fontSize: 15, color: 'var(--text-secondary)', fontWeight: 500 }}>{presentationFor(goal).resultFallback}</div>
            </Tile>
          ))}
      </RevealTile>
    </StepPanel>
  )
}
