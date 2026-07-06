import type { ReactNode } from 'react'

interface FieldLabelProps {
  children: ReactNode
  /** `'md'` for standalone fields (helper-size text), `'sm'` for the compact two-column budget/essentials grids. */
  size?: 'md' | 'sm'
}

/**
 * The label above an input field. One component instead of the same inline
 * style block repeated per field, so label typography can't drift between
 * steps.
 */
export function FieldLabel({ children, size = 'md' }: FieldLabelProps) {
  const small = size === 'sm'
  return (
    <label
      style={{
        display: 'block',
        fontSize: small ? 'var(--fs-label-sm)' : 'var(--fs-helper)',
        fontWeight: 600,
        color: 'var(--text-secondary-dim)',
        marginBottom: small ? 7 : 8,
      }}
    >
      {children}
    </label>
  )
}
