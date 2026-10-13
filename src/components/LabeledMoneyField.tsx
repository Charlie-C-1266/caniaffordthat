import { useId, type KeyboardEvent, type ReactNode } from 'react'
import { FieldLabel } from './FieldLabel'
import { InfoHint } from './InfoHint'
import { MoneyInput } from './MoneyInput'

/** Matches the two call sites that previously built their own "?" inline. */
const HINT_SIZE = 14

interface LabeledMoneyFieldProps {
  label: ReactNode
  value: string
  onChange: (value: string) => void
  onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void
  /** `'grid'` for the compact two-column budget/essentials grids; `'single'` for a full-width standalone field (slightly larger prefix offset and label). */
  variant?: 'grid' | 'single'
  /** Underline color while focused. Defaults to the neutral primary-text color; pass the mode accent for fields that should light up. */
  accentColor?: string
  /**
   * Explanatory text for a "?" affordance beside the label.
   *
   * Pass it here rather than building an `InfoHint` into `label`: a
   * `<label for>` names its input from the label's *entire* content, so a
   * hint nested in there lands in the input's accessible **name** — the VED
   * field used to be announced as "Road tax (VED) / year £200/year is the
   * standard rate for most cars. Brand-new cars over £40,000…" every time
   * focus reached it. A name should be short and identify the field, so the
   * text becomes the input's accessible **description** instead, read after
   * the name or on request.
   */
  hint?: string
}

/**
 * A labelled body-size money input — the small-field counterpart to the hero
 * price/take-home inputs. Shared by the Budget step's outgoings grid, the
 * emergency fund's essentials grid, the car deposit, and the fixed
 * monthly-saving field, so their label + input styling stays identical.
 */
export function LabeledMoneyField({
  label,
  value,
  onChange,
  onKeyDown,
  variant = 'grid',
  accentColor = 'var(--text-primary)',
  hint,
}: LabeledMoneyFieldProps) {
  const grid = variant === 'grid'
  // Generated rather than a caller prop: every one of the nine call sites
  // needs the label/input pair associated, and a per-instance useId() can't
  // collide the way a hand-written id repeated across steps could.
  const inputId = useId()
  // Only used with a hint. `useId` is a hook, so both are called either way.
  const labelTextId = useId()
  const hintId = useId()
  return (
    // minWidth:0 lets 1fr grid tracks shrink below the number input's
    // intrinsic width — without it a two-column grid refuses to narrow and
    // overflows the viewport on small screens. Harmless on standalone fields.
    <div style={{ minWidth: 0 }}>
      {/*
       * `htmlFor` stays in both cases, so clicking the label still focuses
       * the input. With a hint, the name comes from `aria-labelledby` instead
       * — it points at a span holding only the label text, and takes
       * precedence over the <label> element, which would otherwise pull the
       * "?" button's aria-label (the whole hint) into the name.
       */}
      <FieldLabel size={grid ? 'sm' : 'md'} htmlFor={inputId}>
        {hint === undefined ? (
          label
        ) : (
          <>
            <span id={labelTextId}>{label}</span> <InfoHint size={HINT_SIZE} text={hint} />
          </>
        )}
      </FieldLabel>
      {/*
       * The input's description. `hidden`, not visually-hidden: an element
       * referenced by aria-describedby is still read as the description when
       * hidden, but a visually-hidden one would also be read where it sits,
       * so a screen reader reading down the page would hear the hint twice
       * (once as the "?" button's name, once here) before reaching the field.
       */}
      {hint !== undefined && (
        <span id={hintId} hidden>
          {hint}
        </span>
      )}
      <MoneyInput
        id={inputId}
        ariaLabelledBy={hint === undefined ? undefined : labelTextId}
        ariaDescribedBy={hint === undefined ? undefined : hintId}
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        accentColor={accentColor}
        idleColor="var(--input-underline)"
        fontSize="var(--fs-body-lg)"
        fontWeight={700}
        fontFamily="inherit"
        borderWidth="var(--border-width-underline)"
        prefixFontSize="var(--fs-prefix-sm)"
        prefixTop={grid ? 6 : 4}
        paddingBottom={7}
        paddingLeft={grid ? 15 : 18}
      />
    </div>
  )
}
