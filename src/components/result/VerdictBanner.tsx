import { Icon } from '../Icon'

interface VerdictBannerProps {
  affordable: boolean
  verdictText: string
  verdictSub: string
}

/**
 * The verdict banner — the one place the affordable/not-affordable colour
 * lives. The rest of the result sits on the same tile as the earlier steps;
 * this solid colour header carries the yes/no. Dark text and a dark icon
 * chip keep it readable on both the green and red fills (both clear WCAG AA
 * for dark text) — via the `--verdict-on-fill*` tokens, which are
 * deliberately *not* overridden by the light theme, since this banner is
 * always a bright fill regardless of the surrounding theme. Shared by the
 * standard and vehicle result cards.
 */
export function VerdictBanner({ affordable, verdictText, verdictSub }: VerdictBannerProps) {
  const verdictColor = affordable ? 'var(--verdict-affordable)' : 'var(--verdict-not-affordable)'
  return (
    <div
      data-testid="verdict-banner"
      style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '18px 26px', background: verdictColor }}
    >
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: '50%',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--verdict-on-fill-chip)',
        }}
      >
        <Icon name={affordable ? 'check' : 'x'} size={19} color={verdictColor} strokeWidth={3} />
      </div>
      <div>
        <div style={{ fontSize: 17, fontWeight: 800, lineHeight: 1.2, color: 'var(--verdict-on-fill)' }}>{verdictText}</div>
        <div style={{ fontSize: 'var(--fs-helper)', marginTop: 2, lineHeight: 1.35, color: 'var(--verdict-on-fill-dim)' }}>
          {verdictSub}
        </div>
      </div>
    </div>
  )
}
