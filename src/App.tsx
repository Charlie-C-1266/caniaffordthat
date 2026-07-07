import { useState } from 'react'
import { useCalculator } from './state/calculatorContext'
import { useStepObserver } from './hooks/useStepObserver'
import { ProgressRail } from './components/ProgressRail'
import { GoalPickerStep } from './components/steps/GoalPickerStep'
import { DetailsStep } from './components/steps/DetailsStep'
import { VehiclePurchaseStep } from './components/steps/VehiclePurchaseStep'
import { VehicleCostsStep } from './components/steps/VehicleCostsStep'
import { BudgetStep } from './components/steps/BudgetStep'
import { PlanStep } from './components/steps/PlanStep'
import { ResultStep } from './components/steps/ResultStep'
import { Footer } from './components/Footer'
import { AlphaBadge } from './components/AlphaBadge'
import { SourcesButton } from './components/SourcesButton'
import { flowForGoal, type FlowStep } from './lib/flow'
import { goalById } from './lib/goals'
import { accentColorFor } from './lib/mode'

function StartOverButton({ onClick }: { onClick: () => void }) {
  const [hovered, setHovered] = useState(false)

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.06)',
        border: '1px solid rgba(255,255,255,0.12)',
        color: 'var(--text-primary)',
        fontSize: 12.5,
        fontWeight: 600,
        padding: '8px 14px',
        borderRadius: 20,
        cursor: 'pointer',
        fontFamily: 'inherit',
      }}
    >
      Start over
    </button>
  )
}

/** Fixed top-right button row — both share this single positioning context rather than guessing pixel offsets against each other. */
function TopRightControls({ onReset }: { onReset: () => void }) {
  return (
    <div style={{ position: 'fixed', top: 20, right: 26, zIndex: 60, display: 'flex', gap: 10, alignItems: 'center' }}>
      <SourcesButton />
      <StartOverButton onClick={onReset} />
    </div>
  )
}

function BrandMark({ accentColor }: { accentColor: string }) {
  return (
    <div style={{ position: 'fixed', top: 22, left: 26, zIndex: 60, display: 'flex', alignItems: 'center', gap: 9 }}>
      <div style={{ width: 20, height: 20, borderRadius: 5, background: accentColor }} />
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Can I Afford That?</div>
      <AlphaBadge />
    </div>
  )
}

function App() {
  const { state, reset } = useCalculator()
  const { registerPanel, registerWrapper, scrollToIndex } = useStepObserver()
  const accent = accentColorFor(state.mode)
  // The step sequence is data, not layout (see lib/flow.ts): before a goal is
  // picked it's just the carousel and the "pick a goal" placeholder; the
  // vehicle gets its bespoke six-step flow; everything else gets the standard
  // five. Each component takes its index from its position in the flow.
  const flow = flowForGoal(goalById(state.goalId))

  const handleReset = () => {
    reset()
    // If this page was opened via a shared result link, drop the query
    // params too — otherwise a refresh after "Start over" would silently
    // re-hydrate the old shared state.
    window.history.replaceState({}, '', window.location.pathname)
    scrollToIndex(0)
  }

  const renderStep = (step: FlowStep, index: number) => {
    const common = { index, panelRef: registerPanel(index), wrapperRef: registerWrapper(index) }
    switch (step.id) {
      case 'goal':
        return <GoalPickerStep key={step.id} {...common} scrollToIndex={scrollToIndex} />
      case 'details':
        return <DetailsStep key={step.id} {...common} scrollToIndex={scrollToIndex} />
      case 'vehiclePurchase':
        return <VehiclePurchaseStep key={step.id} {...common} scrollToIndex={scrollToIndex} />
      case 'vehicleCosts':
        return <VehicleCostsStep key={step.id} {...common} scrollToIndex={scrollToIndex} />
      case 'budget':
        return <BudgetStep key={step.id} {...common} scrollToIndex={scrollToIndex} />
      case 'plan':
        return <PlanStep key={step.id} {...common} />
      case 'result':
        return <ResultStep key={step.id} index={index} panelRef={registerPanel(index)} scrollToIndex={scrollToIndex} />
    }
  }

  return (
    <>
      <BrandMark accentColor={accent} />
      <TopRightControls onReset={handleReset} />
      <ProgressRail
        activeIndex={state.activeIndex}
        labels={flow.map((step) => step.label)}
        accentColor={accent}
        onSelect={scrollToIndex}
      />

      <main>{flow.map(renderStep)}</main>
      <Footer />
    </>
  )
}

export default App
