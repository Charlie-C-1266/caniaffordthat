import { StepPanel } from '../StepPanel'
import { RevealTile } from '../RevealTile'
import { Tile } from '../Tile'
import { StandardResultCard } from '../result/StandardResultCard'
import { VehicleResultCard } from '../result/VehicleResultCard'
import { useCalculator } from '../../state/calculatorContext'
import { deriveResult } from '../../lib/derive'
import { deriveVehicleResult } from '../../lib/vehicle'
import { goalById } from '../../lib/goals'
import type { DivRefCallback } from '../../lib/refs'

interface ResultStepProps {
  /** Position in the active flow (always last). */
  index: number
  panelRef: DivRefCallback
  scrollToIndex: (index: number) => void
}

/** The final step: picks the result card for the active flow (vehicle vs standard), or the "fill these in first" fallback. */
export function ResultStep({ index, panelRef, scrollToIndex }: ResultStepProps) {
  const { state } = useCalculator()
  const goal = goalById(state.goalId)
  const isVehicle = goal?.vehicle === true

  const standardResult = isVehicle ? null : deriveResult(state)
  const vehicleResult = isVehicle ? deriveVehicleResult(state) : null

  const fallbackText = goal?.emergency
    ? 'Scroll back up and add your take-home pay and monthly essentials to see your result.'
    : isVehicle
      ? "Scroll back up and fill in the car's price and your take-home pay to see your result."
      : 'Scroll back up and fill in a price and take-home pay to see your result.'

  return (
    <StepPanel
      index={index}
      isFinal
      panelRef={panelRef}
      panelStyle={{ background: 'var(--bg-dark-1)', padding: '80px 40px 56px' }}
      panelTestId="result-panel"
    >
      <RevealTile revealed={Boolean(state.revealed[index])} style={{ width: '100%', maxWidth: 640, display: 'flex', justifyContent: 'center' }}>
        {vehicleResult !== null ? (
          <VehicleResultCard result={vehicleResult} scrollToIndex={scrollToIndex} />
        ) : standardResult !== null ? (
          <StandardResultCard result={standardResult} scrollToIndex={scrollToIndex} />
        ) : (
          <Tile maxWidth={640} padding="40px 44px">
            <div style={{ fontSize: 15, color: 'var(--text-secondary)', fontWeight: 500 }}>{fallbackText}</div>
          </Tile>
        )}
      </RevealTile>
    </StepPanel>
  )
}
