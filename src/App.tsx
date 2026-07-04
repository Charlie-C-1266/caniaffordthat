import { useState } from 'react'
import { useCalculator } from './state/calculatorContext'
import { useStepObserver } from './hooks/useStepObserver'
import { ProgressRail } from './components/ProgressRail'
import { Step0Intro } from './components/steps/Step0Intro'
import { Step1ModeSelect } from './components/steps/Step1ModeSelect'
import { Step2ItemPrice } from './components/steps/Step2ItemPrice'
import { Step3Budget } from './components/steps/Step3Budget'
import { Step4Timeframe } from './components/steps/Step4Timeframe'
import { Step5Result } from './components/steps/Step5Result'
import { Footer } from './components/Footer'
import { AlphaBadge } from './components/AlphaBadge'
import { STEP_LABELS } from './lib/constants'
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
        position: 'fixed',
        top: 20,
        right: 26,
        zIndex: 60,
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

  const handleReset = () => {
    reset()
    // If this page was opened via a shared result link, drop the query
    // params too — otherwise a refresh after "Start over" would silently
    // re-hydrate the old shared state.
    window.history.replaceState({}, '', window.location.pathname)
    scrollToIndex(0)
  }

  return (
    <>
      <BrandMark accentColor={accent} />
      <StartOverButton onClick={handleReset} />
      <ProgressRail activeIndex={state.activeIndex} labels={STEP_LABELS} accentColor={accent} onSelect={scrollToIndex} />

      <Step0Intro panelRef={registerPanel(0)} wrapperRef={registerWrapper(0)} />
      <Step1ModeSelect panelRef={registerPanel(1)} wrapperRef={registerWrapper(1)} scrollToIndex={scrollToIndex} />
      <Step2ItemPrice panelRef={registerPanel(2)} wrapperRef={registerWrapper(2)} scrollToIndex={scrollToIndex} />
      <Step3Budget panelRef={registerPanel(3)} wrapperRef={registerWrapper(3)} scrollToIndex={scrollToIndex} />
      <Step4Timeframe panelRef={registerPanel(4)} wrapperRef={registerWrapper(4)} />
      <Step5Result panelRef={registerPanel(5)} scrollToIndex={scrollToIndex} />
      <Footer />
    </>
  )
}

export default App
