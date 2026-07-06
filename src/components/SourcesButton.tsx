import { useEffect, useRef, useState } from 'react'

interface Source {
  label: string
  url: string
}

// The actual pages behind the thresholds in lib/derive.ts — kept here so the
// citations are one click away from the app itself, not just in code
// comments. All UK, mostly MoneyHelper (the government-backed money
// guidance service).
const SOURCES: Source[] = [
  {
    label: 'MoneyHelper — Should I save or invest? (the 5-year rule)',
    url: 'https://www.moneyhelper.org.uk/en/savings/how-to-save/should-i-save-or-invest',
  },
  {
    label: 'MoneyHelper — Emergency savings: how much is enough? (3–6 months)',
    url: 'https://www.moneyhelper.org.uk/en/savings/types-of-savings/emergency-savings-how-much-is-enough',
  },
  {
    label: 'MoneyHelper — Can I afford to rent? (the 30% rule)',
    url: 'https://www.moneyhelper.org.uk/en/homes/renting/how-much-rent-can-you-afford',
  },
  {
    label: 'MoneyHelper — How much should I spend on a mortgage?',
    url: 'https://www.moneyhelper.org.uk/en/blog/buy-or-rent-a-home/how-much-should-i-spend-on-a-mortgage',
  },
  {
    label: 'Halifax — The 50/30/20 rule',
    url: 'https://www.halifax.co.uk/helpcentre/support-and-wellbeing/managing-your-money/50-30-20.html',
  },
]

/** Small persistent button (styled to match "Start over") that opens a panel of the UK finance guidance our thresholds are based on. */
export function SourcesButton() {
  const [open, setOpen] = useState(false)
  const [hovered, setHovered] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        aria-expanded={open}
        style={{
          background: open || hovered ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.12)',
          color: 'var(--text-primary)',
          fontSize: 12.5,
          fontWeight: 600,
          padding: '8px 14px',
          borderRadius: 20,
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        Our sources
      </button>
      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            width: 280,
            background: 'var(--bg-dark-1)',
            border: '1px solid rgba(255,255,255,0.14)',
            borderRadius: 12,
            padding: 14,
            boxShadow: 'var(--shadow-tile)',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <div
            style={{
              fontSize: 'var(--fs-helper-sm)',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'var(--text-tertiary)',
            }}
          >
            What our thresholds are based on
          </div>
          {SOURCES.map((source) => (
            <a
              key={source.url}
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              style={{
                fontSize: 13,
                color: 'var(--text-secondary)',
                textDecoration: 'underline',
                lineHeight: 1.4,
              }}
            >
              {source.label}
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
