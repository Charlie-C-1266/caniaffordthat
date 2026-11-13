// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup, screen, fireEvent } from '@testing-library/react'
import { StartButton } from './StartButton'
import { GOALS } from '../../../lib/goals'
import type { Goal } from '../../../lib/goals'

// The landing CTA. Two things here are deliberate design decisions rather
// than incidental, and both need pinning:
//
//  1. The visible text is a static "Get started" whatever goal is focused, so
//     it can never overflow the pill or read awkwardly. The goal's name rides
//     in the aria-label instead, so a screen reader user still knows what
//     they are starting.
//  2. For a "Soon" goal the handler isn't merely ignored — `onClick` is never
//     wired up at all, on top of `disabled`. That is the structural half of
//     the #207 guard, and a test that only checked `disabled` would let
//     someone delete it.

/** The real mortgage goal, which is the app's only `soon` one. */
const soonGoal = GOALS.find((goal) => goal.soon) as Goal
/** A real selectable goal, so the aria-label is asserted against live copy. */
const liveGoal = GOALS.find((goal) => !goal.soon) as Goal

describe('StartButton', () => {
  afterEach(cleanup)

  it('is built on real goal data, so these tests track the actual carousel', () => {
    expect(soonGoal).toBeDefined()
    expect(liveGoal).toBeDefined()
  })

  describe('for a goal that is ready', () => {
    it('reads "Get started", the same text for every goal', () => {
      render(<StartButton goal={liveGoal} onClick={() => {}} />)

      expect(screen.getByRole('button').textContent).toBe('Get started')
    })

    it('names the focused goal in its aria-label, where the text cannot', () => {
      render(<StartButton goal={liveGoal} onClick={() => {}} />)

      expect(screen.getByRole('button', { name: `Get started with ${liveGoal.name}` })).toBeDefined()
    })

    it('is enabled and fires onClick', () => {
      const onClick = vi.fn()
      render(<StartButton goal={liveGoal} onClick={onClick} />)
      const button = screen.getByRole('button')

      expect(button.hasAttribute('disabled')).toBe(false)
      fireEvent.click(button)

      expect(onClick).toHaveBeenCalledTimes(1)
    })

    it('shows the forward arrow that marks it as the step onwards', () => {
      const { container } = render(<StartButton goal={liveGoal} onClick={() => {}} />)

      expect(container.querySelector('svg')).not.toBeNull()
    })

    it('takes the save accent gradient and its shadow', () => {
      render(<StartButton goal={liveGoal} onClick={() => {}} />)
      const button = screen.getByRole('button')

      expect(button.style.background).toBe('var(--accent-save-gradient)')
      expect(button.style.color).toBe('var(--on-accent-save)')
      expect(button.style.boxShadow).toBe('var(--accent-save-shadow-strong)')
      expect(button.style.cursor).toBe('pointer')
    })

    it.each(GOALS.filter((goal) => !goal.soon).map((goal) => [goal.name, goal] as const))(
      'keeps the same static text for %s, with its own aria-label',
      (name, goal) => {
        render(<StartButton goal={goal} onClick={() => {}} />)

        expect(screen.getByRole('button').textContent).toBe('Get started')
        expect(screen.getByRole('button').getAttribute('aria-label')).toBe(`Get started with ${name}`)
      },
    )
  })

  describe('for a "Soon" goal', () => {
    it('reads "Coming soon" instead', () => {
      render(<StartButton goal={soonGoal} onClick={() => {}} />)

      expect(screen.getByRole('button').textContent).toBe('Coming soon')
    })

    it('is disabled', () => {
      render(<StartButton goal={soonGoal} onClick={() => {}} />)

      expect(screen.getByRole('button').hasAttribute('disabled')).toBe(true)
    })

    it('drops the aria-label, so its name comes from the "Coming soon" text', () => {
      // A "Get started with Mortgage" name on a button that cannot start
      // would be the opposite of what it does.
      render(<StartButton goal={soonGoal} onClick={() => {}} />)

      expect(screen.getByRole('button').getAttribute('aria-label')).toBeNull()
      expect(screen.getByRole('button', { name: 'Coming soon' })).toBeDefined()
    })

    it('never calls onClick, even when the click is dispatched past `disabled` (#207)', () => {
      // `disabled` stops a real user. This fires the event regardless, which
      // is what proves the handler is genuinely unwired rather than merely
      // unreachable — the structural second layer the component documents.
      const onClick = vi.fn()
      render(<StartButton goal={soonGoal} onClick={onClick} />)

      fireEvent.click(screen.getByRole('button'))

      expect(onClick).not.toHaveBeenCalled()
    })

    it('has no onclick property at all, not just an inert one', () => {
      const onClick = vi.fn()
      render(<StartButton goal={soonGoal} onClick={onClick} />)

      expect(screen.getByRole('button').onclick).toBeNull()
    })

    it('shows no arrow, so nothing suggests it leads anywhere', () => {
      const { container } = render(<StartButton goal={soonGoal} onClick={() => {}} />)

      expect(container.querySelector('svg')).toBeNull()
    })

    it('drops the accent for the disabled palette and the not-allowed cursor', () => {
      render(<StartButton goal={soonGoal} onClick={() => {}} />)
      const button = screen.getByRole('button')

      expect(button.style.background).toBe('var(--pill-bg)')
      expect(button.style.color).toBe('var(--text-disabled)')
      expect(button.style.boxShadow).toBe('none')
      expect(button.style.cursor).toBe('not-allowed')
    })
  })

  it('treats a goal with soon left off exactly as soon={false}', () => {
    // `soon` is optional on Goal, so most goals omit it. The component reads
    // it through Boolean(), and these two must not diverge.
    const base = { ...liveGoal, soon: undefined } as Goal
    const explicit = render(<StartButton goal={{ ...liveGoal, soon: false }} onClick={() => {}} />).container.innerHTML
    cleanup()
    const omitted = render(<StartButton goal={base} onClick={() => {}} />).container.innerHTML

    expect(explicit).toBe(omitted)
  })
})
