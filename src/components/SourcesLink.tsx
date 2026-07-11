import { useState } from 'react'

/**
 * Small persistent top-right link (styled to match "Start over") straight to
 * the sources & ethos page, which carries the full annotated source list.
 * Replaces the old in-app sources popover — one click, less chrome. Opens in
 * a new tab like the app's other doc links, so figures typed mid-flow aren't
 * lost to the navigation.
 */
export function SourcesLink() {
  const [hovered, setHovered] = useState(false)

  return (
    <a
      href="/sources/"
      target="_blank"
      rel="noopener noreferrer"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'inline-block',
        background: hovered ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.06)',
        border: '1px solid rgba(255,255,255,0.12)',
        color: 'var(--text-primary)',
        fontSize: 12.5,
        fontWeight: 600,
        padding: '8px 14px',
        borderRadius: 20,
        textDecoration: 'none',
        fontFamily: 'inherit',
      }}
    >
      Our sources
    </a>
  )
}
