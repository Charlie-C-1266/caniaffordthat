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
        background: hovered ? 'var(--pill-bg-hover)' : 'var(--pill-bg)',
        border: '1px solid var(--pill-border)',
        color: 'var(--text-primary)',
        fontSize: 'var(--pill-font-size)',
        fontWeight: 600,
        padding: 'var(--pill-padding-block) var(--pill-padding-inline)',
        borderRadius: 20,
        textDecoration: 'none',
        fontFamily: 'inherit',
        whiteSpace: 'nowrap',
      }}
    >
      Our sources
    </a>
  )
}
