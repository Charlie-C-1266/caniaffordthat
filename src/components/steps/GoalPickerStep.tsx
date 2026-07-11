import { useEffect, useRef, useState } from 'react'
import { StepPanel } from '../StepPanel'
import { RevealTile } from '../RevealTile'
import { Icon, type IconName } from '../Icon'
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

/** The landing pill: a reassurance line that this is quick and free, carrying the old title card's value prop onto the carousel. */
function LandingPill() {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '7px 15px',
        borderRadius: 99,
        border: '1px solid var(--accent-save-border-soft)',
        background: 'var(--accent-save-bg-pill)',
        marginBottom: 20,
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-save)', boxShadow: '0 0 10px var(--accent-save)' }} />
      <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--brand-mint)' }}>Free · no sign-up · takes 2 minutes</span>
    </div>
  )
}

const CARD_WIDTH = 250
// Horizontal gap between adjacent cards' centers, from the design's cover-flow
// spec: translateX(offset * 268px).
const CARD_STEP_X = 268
// Cards more than this many positions from center are faded out / non-interactive.
const MAX_VISIBLE_OFFSET = 2
// Delay after selecting a goal before scrolling to Details, so the card's
// selection state is visible for a beat first (design: 260ms).
const SELECT_SCROLL_DELAY_MS = 260
// How long each goal holds focus while the carousel auto-rotates on the landing
// screen (before the user has touched it).
const AUTO_ROTATE_MS = 3200

/** Per-card cover-flow transform, opacity, and stacking from its distance to the focused card. */
function cardGeometry(offset: number) {
  const ax = Math.abs(offset)
  const scale = Math.max(0.7, 1 - ax * 0.13)
  return {
    transform: `translateX(calc(-50% + ${offset * CARD_STEP_X}px)) scale(${scale})`,
    opacity: ax > MAX_VISIBLE_OFFSET ? 0 : 1 - ax * 0.32,
    zIndex: 20 - ax,
    pointerEvents: (ax > MAX_VISIBLE_OFFSET ? 'none' : 'auto') as 'none' | 'auto',
  }
}

interface GoalCardProps {
  goal: Goal
  offset: number
  focused: boolean
  /** When true, don't animate the horizontal move — the card is jumping across the wrap seam and should re-appear on the other side rather than fly across. */
  teleport: boolean
  onFocus: () => void
  onSelect: () => void
}

function GoalCard({ goal, offset, focused, teleport, onFocus, onSelect }: GoalCardProps) {
  const geo = cardGeometry(offset)
  // The text-safe variant: this accent is used for the card border, icon
  // fill, and tag-label text below, and --accent-save fails contrast as
  // text/icon color in the light theme (see tokens.css).
  const accent = 'var(--accent-save-text)'
  // Opacity still eases (so a wrapped card fades in/out in place) but the
  // transform jumps instantly across the seam when teleporting.
  const transition = teleport
    ? 'opacity 0.5s ease, background 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease'
    : 'transform 0.5s cubic-bezier(0.16,1,0.3,1), opacity 0.5s ease, background 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease'

  return (
    <button
      type="button"
      onClick={focused ? onSelect : onFocus}
      disabled={goal.soon && focused}
      aria-label={
        goal.soon ? `${goal.name} (coming soon)` : focused ? `Continue with ${goal.name}` : `Focus ${goal.name}`
      }
      style={{
        position: 'absolute',
        top: 0,
        left: '50%',
        width: CARD_WIDTH,
        boxSizing: 'border-box',
        textAlign: 'left',
        borderRadius: 22,
        padding: '30px 26px 26px',
        backdropFilter: 'blur(12px)',
        cursor: goal.soon ? 'not-allowed' : 'pointer',
        fontFamily: 'inherit',
        color: 'var(--text-primary)',
        background: focused ? 'var(--accent-save-bg-card)' : 'var(--tile-bg-neutral)',
        border: `1.5px solid ${focused ? accent : 'var(--divider)'}`,
        boxShadow: focused ? 'var(--shadow-card-focused)' : 'var(--shadow-card)',
        transition,
        ...geo,
      }}
    >
      {goal.soon && (
        <span
          style={{
            position: 'absolute',
            top: 16,
            right: 16,
            fontSize: 10.5,
            fontWeight: 700,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            padding: '4px 9px',
            borderRadius: 99,
            background: 'var(--surface-selected)',
            border: '1px solid var(--tile-border-neutral)',
            color: 'var(--text-secondary-mid)',
          }}
        >
          Soon
        </span>
      )}
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 18,
          background: focused ? 'var(--accent-save-bg-chip)' : 'var(--surface-faint)',
          color: focused ? accent : 'var(--icon-chip-fg)',
        }}
      >
        <Icon name={goal.icon} size={26} />
      </div>
      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: focused ? accent : 'var(--text-tertiary)',
          marginBottom: 8,
        }}
      >
        {goal.tag}
      </div>
      <div style={{ fontSize: 23, fontWeight: 800, marginBottom: 8 }}>{goal.name}</div>
      <div
        style={{
          fontSize: 13.5,
          fontWeight: 500,
          lineHeight: 1.5,
          color: 'var(--text-secondary-mid)',
          minHeight: 40,
        }}
      >
        {goal.blurb}
      </div>
    </button>
  )
}

interface RoundButtonProps {
  icon: IconName
  label: string
  onClick: () => void
}

function RoundButton({ icon, label, onClick }: RoundButtonProps) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-label={label}
      style={{
        width: 48,
        height: 48,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: '1px solid var(--icon-button-border)',
        background: hovered ? 'var(--surface-selected)' : 'var(--tile-bg)',
        color: 'var(--text-primary)',
        cursor: 'pointer',
      }}
    >
      <Icon name={icon} size={22} />
    </button>
  )
}

/** The landing screen: the cover-flow goal picker. Choosing a goal seeds its tailored config and scrolls on to Details. */
export function GoalPickerStep({ index, panelRef, wrapperRef, scrollToIndex }: GoalPickerStepProps) {
  const { state, setField, setFields } = useCalculator()
  const focused = GOALS[state.carouselIndex]

  // Auto-rotate until the user takes over (or hovers, or a goal is picked).
  const [engaged, setEngaged] = useState(false)
  const [hovered, setHovered] = useState(false)

  // Track the previous focus so we can tell which card crossed the wrap seam
  // this step and let it teleport instead of flying across the stage.
  const prevIndexRef = useRef(state.carouselIndex)
  const indexRef = useRef(state.carouselIndex)
  indexRef.current = state.carouselIndex
  const prevIndex = prevIndexRef.current
  useEffect(() => {
    prevIndexRef.current = state.carouselIndex
  }, [state.carouselIndex])

  const focus = (index: number) => setField('carouselIndex', wrapIndex(index))

  const move = (delta: number) => {
    setEngaged(true)
    focus(state.carouselIndex + delta)
  }

  const goTo = (index: number) => {
    setEngaged(true)
    focus(index)
  }

  const select = (goal: Goal) => {
    if (goal.soon) return
    setEngaged(true)
    setFields(seedFromGoal(goal))
    setTimeout(() => scrollToIndex(index + 1), SELECT_SCROLL_DELAY_MS)
  }

  useEffect(() => {
    if (engaged || hovered || state.goalId !== null) return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const timer = setInterval(() => {
      setField('carouselIndex', wrapIndex(indexRef.current + 1))
    }, AUTO_ROTATE_MS)
    return () => clearInterval(timer)
  }, [engaged, hovered, state.goalId, setField])

  return (
    <StepPanel index={index} panelRef={panelRef} wrapperRef={wrapperRef} panelStyle={{ background: 'var(--bg-dark-1)' }}>
      <RevealTile
        revealed={Boolean(state.revealed[index])}
        style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}
      >
        <LandingPill />
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
          style={{ position: 'relative', width: '100%', maxWidth: 1100, height: 360 }}
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
                  teleport={Math.abs(offset - prevOffset) > 1}
                  focused={i === state.carouselIndex}
                  onFocus={() => goTo(i)}
                  onSelect={() => select(goal)}
                />
              )
            })}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 22, marginTop: 26 }}>
          <RoundButton icon="chevron-left" label="Previous goal" onClick={() => move(-1)} />
          <StartButton goal={focused} onClick={() => select(focused)} />
          <RoundButton icon="chevron-right" label="Next goal" onClick={() => move(1)} />
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

/** The primary landing CTA. Text stays a static "Get started" so it never overflows or reads awkwardly per goal; the focused goal's name rides along in the aria-label for screen readers (clicking the focused card selects it too). */
function StartButton({ goal, onClick }: { goal: Goal; onClick: () => void }) {
  const [hovered, setHovered] = useState(false)
  const disabled = Boolean(goal.soon)

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={disabled ? undefined : `Get started with ${goal.name}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        minWidth: 230,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: '16px 30px',
        borderRadius: 99,
        border: 'none',
        fontSize: 15.5,
        fontWeight: 800,
        fontFamily: 'inherit',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transform: hovered && !disabled ? 'translateY(-2px)' : 'translateY(0)',
        transition: 'transform var(--duration-hover) ease',
        background: disabled ? 'var(--pill-bg)' : 'var(--accent-save-gradient)',
        color: disabled ? 'var(--text-disabled)' : 'var(--on-accent-save)',
        boxShadow: disabled ? 'none' : 'var(--accent-save-shadow-strong)',
      }}
    >
      {disabled ? 'Coming soon' : 'Get started'}
      {!disabled && <Icon name="arrow-right" size={18} />}
    </button>
  )
}
