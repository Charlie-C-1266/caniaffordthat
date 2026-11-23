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

/** The final step: picks the result card for the active flow (vehicle vs standard), or the "fill these in first" fallback. */
export function ResultStep({ index, panelRef, scrollToIndex }: ResultStepProps) {
  const { state } = useCalculator()
  const goal = goalById(state.goalId)
  // Before a goal is chosen there's nothing to show, so the standard engine's
  // `null` and fallback stand in.
  const card = RESULT_CARDS[goal?.kind ?? 'standard'](state, scrollToIndex)

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
        {card ?? (
          <Tile maxWidth={640} padding="var(--tile-padding-y, 40px) var(--tile-padding-x, 44px)">
            <div style={{ fontSize: 15, color: 'var(--text-secondary)', fontWeight: 500 }}>{presentationFor(goal).resultFallback}</div>
          </Tile>
        )}
      </RevealTile>
    </StepPanel>
  )
}
