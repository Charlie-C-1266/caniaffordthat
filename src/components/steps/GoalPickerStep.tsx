import { useEffect, useRef, useState } from 'react'
import { StepPanel } from '../StepPanel'
import { RevealTile } from '../RevealTile'
import { GoalCard } from './goalPicker/GoalCard'
import { LandingPill } from './goalPicker/LandingPill'
import { RoundButton } from './goalPicker/RoundButton'
import { StartButton } from './goalPicker/StartButton'
import { prefersReducedMotion } from '../../lib/motion'
import { useCalculator } from '../../state/calculatorContext'
import { GOALS, circularOffset, seedFromGoal, wrapIndex, type Goal } from '../../lib/goals'
import type { DivRefCallback } from '../../lib/refs'

interface GoalPickerStepProps {
  /** Position in the active flow (always 0 — the picker is every flow's landing). */
  index: number
  panelRef: DivRefCallback
  wrapperRef: DivRefCallback
  scrollToIndex: (index: number) => void
}

// Delay after selecting a goal before scrolling to Details, so the card's
// selection state is visible for a beat first (design: 260ms).
const SELECT_SCROLL_DELAY_MS = 260
// How long each goal holds focus while the carousel auto-rotates on the landing
// screen (before the user has touched it).
const AUTO_ROTATE_MS = 3200

/** The landing screen: the cover-flow goal picker. Choosing a goal seeds its tailored config and scrolls on to Details. */
export function GoalPickerStep({ index, panelRef, wrapperRef, scrollToIndex }: GoalPickerStepProps) {
  const { state, setField, setFields } = useCalculator()
  const focused = GOALS[state.carouselIndex]

  // Auto-rotate until the user takes over (or hovers, or a goal is picked).
  const [engaged, setEngaged] = useState(false)
  const [hovered, setHovered] = useState(false)

  // Track the previous focus so we can tell which card crossed the wrap seam
  // this step and let it teleport instead of flying across the stage.
  // `jump` is how far the focus moved, the short way round — the distance
  // every card's offset shifts by, unless it wrapped.
  //
  // Held in state and updated during render when the focus moves, React's
  // pattern for "the previous value of a prop". It used to be a ref read and
  // written during render, which isn't safe once a render can be thrown away
  // and retried.
  const [move, setMove] = useState({ from: state.carouselIndex, to: state.carouselIndex })
  if (move.to !== state.carouselIndex) setMove({ from: move.to, to: state.carouselIndex })
  const prevIndex = move.from
  const jump = circularOffset(state.carouselIndex, prevIndex)

  const focus = (nextIndex: number) => setField('carouselIndex', wrapIndex(nextIndex))

  const step = (delta: number) => {
    setEngaged(true)
    focus(state.carouselIndex + delta)
  }

  const goTo = (nextIndex: number) => {
    setEngaged(true)
    focus(nextIndex)
  }

  // The pending post-selection scroll, held so it can be cancelled — see
  // select() below, and the unmount cleanup under the auto-rotate effect.
  const selectScrollTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  // Only ever called for a selectable goal: GoalCard wires `onSelect` only
  // when the focused card is not "Soon", and StartButton is `disabled` for
  // one. That is what keeps a "Soon" goal from scheduling a scroll or
  // cancelling one already pending — it used to be an `if (goal.soon) return`
  // here, which no test could reach because both controls are disabled, and
  // so sat as the repo's last uncovered branch (#207).
  const select = (goal: Goal) => {
    setEngaged(true)
    setFields(seedFromGoal(goal))
    // At most one pending scroll. Two selections inside the delay — the
    // focused card clicked twice, or Enter pressed twice — would otherwise
    // each schedule one, and the second could land after the user has
    // already scrolled on or started over, yanking the page to the wrong
    // step.
    clearTimeout(selectScrollTimer.current)
    selectScrollTimer.current = setTimeout(() => scrollToIndex(index + 1), SELECT_SCROLL_DELAY_MS)
  }

  // One step per AUTO_ROTATE_MS: each step changes the index, which re-arms
  // the timer from the new position, so the callback never needs to read a
  // stale index through a ref.
  useEffect(() => {
    if (engaged || hovered || state.goalId !== null) return
    if (prefersReducedMotion()) return
    const timer = setTimeout(() => {
      setField('carouselIndex', wrapIndex(state.carouselIndex + 1))
    }, AUTO_ROTATE_MS)
    return () => clearTimeout(timer)
  }, [engaged, hovered, state.goalId, state.carouselIndex, setField])

  // Unmounting inside the selection delay would otherwise still run the
  // scroll against refs the hook has already torn down. Same pattern as
  // ResultActions' revert timer.
  //
  // Unmount only, on purpose. The timer's callback captures `scrollToIndex`
  // and `index`, which the rule reads as dependencies of this cleanup; adding
  // them would make any change to either cancel a pending post-selection
  // scroll.
  // oxlint-disable-next-line react/exhaustive-effect-dependencies -- unmount-only cleanup; see above
  useEffect(() => () => clearTimeout(selectScrollTimer.current), [])

  return (
    <StepPanel index={index} panelRef={panelRef} wrapperRef={wrapperRef} panelStyle={{ background: 'var(--bg-dark-1)' }}>
      <RevealTile
        revealed={Boolean(state.revealed[index])}
        style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}
      >
        <LandingPill />
        {/*
         * The calculator is one scrolling page, so this is its *only* h1 —
         * the landing question that opens every flow. Each later step's
         * question, and the result headline, is an h2 under it. A new step
         * adding its own h1 would flatten the heading outline back into a
         * list of unrelated top-level headings for a screen reader; the e2e
         * suite counts the h1s in every flow to catch that.
         */}
        <h1
          style={{
            fontSize: 'var(--fs-h1-md)',
            lineHeight: 1.05,
            fontWeight: 800,
            letterSpacing: '-0.03em',
            margin: '0 0 12px',
          }}
        >
          What are you saving for?
        </h1>
        <p style={{ margin: '0 0 40px', fontSize: 'var(--fs-body-lg)', color: 'var(--text-secondary-dim)', maxWidth: 540 }}>
          See if it's within reach — how long to save, or what it costs each month.
        </p>

        <div
          data-testid="goal-carousel"
          style={{
            position: 'relative',
            width: '100%',
            height: 360,
            // The cards are absolutely positioned off a centred rail, so at
            // any viewport narrower than the full cover-flow spread they used
            // to push `document.documentElement`'s scroll width past the
            // window and put the *whole page* into horizontal scroll. Clipping
            // here contains them. `clip` (not `hidden`) so the vertical axis
            // can stay `visible`: the cards' drop shadows spill well past the
            // 360px stage, and `hidden` on one axis would force the other to
            // `auto` and cut them off.
            overflowX: 'clip',
            overflowY: 'visible',
          }}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          <div style={{ position: 'absolute', left: '50%', top: 0, width: 0, height: '100%' }}>
            {GOALS.map((goal, i) => {
              const offset = circularOffset(i, state.carouselIndex)
              const prevOffset = circularOffset(i, prevIndex)
              return (
                <GoalCard
                  key={goal.id}
                  goal={goal}
                  offset={offset}
                  // A card that didn't wrap shifts by exactly the jump, the
                  // other way to the focus; a seam-crosser's shift is that
                  // ± GOALS.length. So anything but `-jump` crossed the seam
                  // and should re-appear on the other side rather than fly
                  // across. Comparing against the jump rather than against 1
                  // keeps multi-position dot clicks sliding (#156).
                  teleport={offset - prevOffset !== -jump}
                  focused={i === state.carouselIndex}
                  onFocus={() => goTo(i)}
                  onSelect={() => select(goal)}
                />
              )
            })}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--goal-controls-gap)', marginTop: 26 }}>
          <RoundButton icon="chevron-left" label="Previous goal" onClick={() => step(-1)} />
          <StartButton goal={focused} onClick={() => select(focused)} />
          <RoundButton icon="chevron-right" label="Next goal" onClick={() => step(1)} />
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 22 }}>
          {GOALS.map((goal, i) => {
            const active = i === state.carouselIndex
            return (
              <button
                key={goal.id}
                type="button"
                aria-label={`Go to ${goal.name}`}
                onClick={() => goTo(i)}
                style={{
                  width: active ? 22 : 8,
                  height: 8,
                  padding: 0,
                  border: 'none',
                  borderRadius: 99,
                  cursor: 'pointer',
                  background: active ? 'var(--accent-save)' : 'var(--dot-inactive-bg)',
                  transition: 'width 0.3s ease, background 0.3s ease',
                }}
              />
            )
          })}
        </div>
      </RevealTile>
    </StepPanel>
  )
}
