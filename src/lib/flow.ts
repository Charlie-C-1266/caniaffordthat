import type { Goal } from './goals'

// The per-goal step sequence. Steps used to be a fixed five-strong list
// (Goal -> Details -> Budget -> Plan -> Result) with indices hard-coded into
// each component; the vehicle flow broke that assumption (it swaps Plan for
// two bespoke steps), so the sequence is now data: components take their
// index from their position here, and adding another bespoke flow means
// adding a branch below — not re-threading indices through the app.

/** Identifies which step component renders at a position in the flow. */
export type StepId = 'goal' | 'details' | 'vehiclePurchase' | 'vehicleCosts' | 'budget' | 'plan' | 'result'

/** One step of the active flow: which component, plus its progress-rail label. */
export interface FlowStep {
  id: StepId
  label: string
}

const GOAL_STEP: FlowStep = { id: 'goal', label: 'Goal' }
const DETAILS_STEP: FlowStep = { id: 'details', label: 'Details' }
const BUDGET_STEP: FlowStep = { id: 'budget', label: 'Budget' }
const RESULT_STEP: FlowStep = { id: 'result', label: 'Result' }

/**
 * Until a goal is picked, only the carousel and the Details placeholder exist —
 * the later steps have nothing to work from, so they aren't part of the flow
 * (and can't be scrolled into).
 */
const PRE_GOAL_FLOW: readonly FlowStep[] = [GOAL_STEP, DETAILS_STEP]

/** The standard five-step flow every non-vehicle goal uses. */
const STANDARD_FLOW: readonly FlowStep[] = [
  GOAL_STEP,
  DETAILS_STEP,
  BUDGET_STEP,
  { id: 'plan', label: 'Plan' },
  RESULT_STEP,
]

// The vehicle flow replaces the generic Plan step with two car-specific ones:
// how the car is being paid for (cash/PCP/HP/loan, including any balloon),
// then its running costs (fuel, maintenance, insurance, tax). Budget stays
// last before the result so the verdict compares the full monthly cost
// against spare cash.
const VEHICLE_FLOW: readonly FlowStep[] = [
  GOAL_STEP,
  DETAILS_STEP,
  { id: 'vehiclePurchase', label: 'Paying for it' },
  { id: 'vehicleCosts', label: 'Running costs' },
  BUDGET_STEP,
  RESULT_STEP,
]

/** The ordered steps for the chosen goal (or the two-step pre-goal flow). */
export function flowForGoal(goal: Goal | null): readonly FlowStep[] {
  if (goal === null) return PRE_GOAL_FLOW
  return goal.vehicle ? VEHICLE_FLOW : STANDARD_FLOW
}
