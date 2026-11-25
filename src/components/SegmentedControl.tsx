/** One choice in a SegmentedControl. */
export interface SegmentedOption<T extends string> {
  value: T
  label: string
  /** Button background while this option is selected. */
  activeBackground: string
  /** Label colour while selected (must contrast with `activeBackground`). */
  activeColor: string
}

/**
 * How the group is named — exactly one of the two, never both and never
 * neither. `ariaLabelledBy` where the question is already on screen (so the
 * name can't drift from the visible text), `ariaLabel` where it isn't.
 *
 * Required rather than optional, deliberately: an unnamed group is the bug
 * #282 fixed, so the type is what stops a new call site reintroducing it.
 */
type SegmentedControlName = { ariaLabel: string; ariaLabelledBy?: never } | { ariaLabelledBy: string; ariaLabel?: never }

type SegmentedControlProps<T extends string> = {
  options: readonly SegmentedOption<T>[]
  /** The currently selected option's value. */
  value: T
  onChange: (value: T) => void
  /** `'md'`: full-width with equal-width segments (the pay-mode toggle). `'sm'`: compact, content-sized (the rate-mode toggle). */
  size?: 'md' | 'sm'
  /**
   * Lets a compact control run onto a second row when its options won't fit.
   * Opt-in, and only the five-option student-loan plan row takes it up: a
   * two- or three-option toggle that wraps stops reading as either/or, which
   * is what #313 fixed. Ignored at `md`, which is full-width already.
   */
  wrap?: boolean
} & SegmentedControlName

/**
 * The pill-shaped segmented toggle used for either/or choices — "Save up /
 * Pay monthly" in Details and "% of spare cash / Fixed amount" in Plan. One
 * component so the two toggles share their structure and interaction styling
 * rather than each rebuilding the pill from scratch.
 *
 * A compact control never runs onto a second row unless it asks to with
 * `wrap`. #291 made every compact control wrap, for the five student-loan
 * plans, on the reasoning that "two-option toggles never get that wide" —
 * which wasn't so: the Budget step's pay-mode toggle split onto two rows at
 * every width up to about 430px and the result's view switcher at 390px and
 * below, leaving a pill that looked broken and no longer read as either/or
 * (#313).
 *
 * The wrapper is a named `role="group"`. The buttons have always carried
 * `aria-pressed`, but before #282 the choice they belong to was never named
 * for assistive tech: the wrapper was a plain `<div>` with no role, and at
 * most call sites the question was shown only as an unassociated sibling
 * `<div>`. So tabbing into the Details step announced "Save up for it, toggle
 * button, pressed" with no idea what was being asked — a WCAG 1.3.1 (Info and
 * Relationships) / 4.1.2 (Name, Role, Value) gap, and the group-level
 * counterpart to the `ToggleButton` state gap #272 closed.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  size = 'md',
  wrap = false,
  ariaLabel,
  ariaLabelledBy,
}: SegmentedControlProps<T>) {
  const md = size === 'md'
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      style={{
        display: 'flex',
        gap: md ? 5 : 'var(--segmented-sm-gap)',
        padding: md ? 5 : 4,
        borderRadius: md ? 14 : 12,
        background: 'var(--tile-bg)',
        border: '1px solid var(--divider)',
        width: md ? undefined : 'fit-content',
        // A compact control sized to its content can still be asked for more
        // room than the tile has. Capping it keeps it inside instead of
        // pushing the page sideways, and the segments below share out what
        // there is.
        maxWidth: md ? undefined : '100%',
        // Only where it was asked for: a control with many options (the five
        // student loan plans) takes a second row rather than overflow, while
        // a two- or three-option toggle stays on one row and keeps reading as
        // either/or (#313).
        flexWrap: !md && wrap ? 'wrap' : undefined,
      }}
    >
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            style={{
              flex: md ? 1 : undefined,
              // A flex item won't shrink below its own content by default, so
              // without this the labels would push a capped control's
              // segments out of it rather than narrowing with it.
              minWidth: md ? undefined : 0,
              padding: md ? '11px 14px' : 'var(--segmented-sm-padding-block) var(--segmented-sm-padding-inline)',
              borderRadius: md ? 10 : 9,
              border: 'none',
              fontSize: md ? 14 : 'var(--segmented-sm-font-size)',
              fontWeight: 700,
              fontFamily: 'inherit',
              cursor: 'pointer',
              background: active ? option.activeBackground : 'transparent',
              color: active ? option.activeColor : 'var(--text-secondary)',
              transition: 'background 0.2s ease, color 0.2s ease',
            }}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
