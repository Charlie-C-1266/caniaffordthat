import type { ReactNode } from 'react'
import { TextLink } from '../../components/TextLink'

/** An underlined external link that opens in a new tab. The doc pages' default link treatment. */
export function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <TextLink href={href} newTab>
      {children}
    </TextLink>
  )
}
