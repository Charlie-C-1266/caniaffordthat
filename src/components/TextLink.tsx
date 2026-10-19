import type { ReactNode } from 'react'

interface TextLinkProps {
  href: string
  children: ReactNode
  /** Open in a new tab — for links that would otherwise lose a half-filled calculator or step away from the site. */
  newTab?: boolean
}

/**
 * The site's underlined in-text link, in the secondary text colour. One
 * component so the footer, the calculator's "how this is worked out" links and
 * the doc pages can't drift apart in how a link looks.
 */
export function TextLink({ href, children, newTab = false }: TextLinkProps) {
  return (
    <a
      href={href}
      target={newTab ? '_blank' : undefined}
      rel={newTab ? 'noopener noreferrer' : undefined}
      style={{ color: 'var(--text-secondary)', textDecoration: 'underline' }}
    >
      {children}
    </a>
  )
}
