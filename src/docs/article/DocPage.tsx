import type { ReactNode } from 'react'
import { Footer } from '../../components/Footer'
import { PageHeader } from './PageHeader'

interface DocPageProps {
  /** The page's one `h1`. */
  title: ReactNode
  /** The brand swatch's colour in the header. Absent, PageHeader's own default applies. */
  accentColor?: string
  children: ReactNode
}

/** The frame every doc page shares: the header, a single `h1`, the article itself, then the site footer. */
export function DocPage({ title, accentColor, children }: DocPageProps) {
  return (
    <>
      <main style={{ maxWidth: 780, margin: '0 auto', padding: '36px 28px 40px' }}>
        <PageHeader accentColor={accentColor} />

        <h1 style={{ fontSize: 'var(--fs-h1-md)', lineHeight: 1.1, fontWeight: 800, letterSpacing: '-0.02em', margin: '0 0 14px' }}>
          {title}
        </h1>
        {children}
      </main>
      <Footer />
    </>
  )
}
