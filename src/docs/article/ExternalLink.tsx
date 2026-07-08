import type { ReactNode } from 'react'

/** An underlined external link that opens in a new tab. The doc pages' default link treatment. */
export function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-secondary)', textDecoration: 'underline' }}>
      {children}
    </a>
  )
}
