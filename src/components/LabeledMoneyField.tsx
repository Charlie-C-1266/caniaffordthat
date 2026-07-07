import type { KeyboardEvent, ReactNode } from 'react'
import { FieldLabel } from './FieldLabel'
import { MoneyInput } from './MoneyInput'

interface LabeledMoneyFieldProps {
  label: ReactNode
  value: string
  onChange: (value: string) => void
  onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void
  /** `'grid'` for the compact two-column budget/essentials grids; `'single'` for a full-width standalone field (slightly larger prefix offset and label). */
  variant?: 'grid' | 'single'
  /** Underline color while focused. Defaults to the neutral primary-text color; pass the mode accent for fields that should light up. */
  accentColor?: string
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
}: LabeledMoneyFieldProps) {
  const grid = variant === 'grid'
  return (
    // minWidth:0 lets 1fr grid tracks shrink below the number input's
    // intrinsic width — without it a two-column grid refuses to narrow and
    // overflows the viewport on small screens. Harmless on standalone fields.
    <div style={{ minWidth: 0 }}>
      <FieldLabel size={grid ? 'sm' : 'md'}>{label}</FieldLabel>
      <MoneyInput
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
