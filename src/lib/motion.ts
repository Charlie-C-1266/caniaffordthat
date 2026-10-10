/**
 * The media query browsers expose the OS "reduce motion" accessibility
 * setting through. One constant so every caller asks the same question — the
 * goal carousel's auto-rotate, the step reveal and step-to-step scrolling all
 * have to agree on it.
 */
export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

/**
 * Whether the visitor has asked their OS for reduced motion.
 *
 * `matchMedia?.` because jsdom doesn't implement it; an absent `matchMedia` is
 * read as "no preference", which keeps the normal animation rather than
 * silently disabling motion for everyone.
 */
export function prefersReducedMotion(): boolean {
  return window.matchMedia?.(REDUCED_MOTION_QUERY).matches ?? false
}

/**
 * The `scrollTo` behaviour to use for step-to-step jumps: instant for someone
 * who has asked for less motion, smooth otherwise.
 *
 * Read at call time, not module load, so a visitor who changes the setting
 * mid-session is honoured without a reload.
 */
export function scrollBehaviour(): ScrollBehavior {
  return prefersReducedMotion() ? 'auto' : 'smooth'
}
