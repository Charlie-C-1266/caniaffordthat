import type { SegmentedOption } from '../../SegmentedControl'

/**
 * A SegmentedControl option in the neutral style "About your pay" uses
 * throughout: a choice about the user's pay, not about the plan, so it never
 * takes the mode's accent colour. The same style as the take-home / salary
 * toggle above it.
 */
export function neutralOption<T extends string>(value: T, label: string): SegmentedOption<T> {
  return { value, label, activeBackground: 'var(--surface-selected)', activeColor: 'var(--text-primary)' }
}
