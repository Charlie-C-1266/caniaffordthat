import { Icon } from '../../Icon'
import type { MethodOption } from './methodOptions'

interface MethodChipProps {
  option: MethodOption
  active: boolean
  accentColor: string
  onSelect: () => void
}

/**
 * One selectable purchase-method chip: icon + name only, in a single row of
 * four. Each option's full blurb sits in its `title` (a hover tooltip, same
 * pattern as VehicleCostsStep's maintenance presets) and is shown as body
 * text once, for whichever method is active — four full two-line
 * descriptions stacked in a 2x2 grid was the single biggest contributor to
 * this tile outgrowing the viewport.
 */
export function MethodChip({ option, active, accentColor, onSelect }: MethodChipProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      title={option.blurb}
      onClick={onSelect}
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
        padding: '12px 8px',
        borderRadius: 12,
        border: `var(--border-width-card) solid ${active ? accentColor : 'var(--input-underline)'}`,
        background: active ? 'var(--surface-selected)' : 'transparent',
        color: 'var(--text-primary)',
        cursor: 'pointer',
        fontFamily: 'inherit',
      }}
    >
      <Icon name={option.icon} size={18} color={active ? accentColor : 'var(--text-tertiary)'} />
      <span style={{ fontSize: 12.5, fontWeight: 800, textAlign: 'center', lineHeight: 1.2 }}>{option.label}</span>
    </button>
  )
}
