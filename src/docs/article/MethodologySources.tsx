import { TextLink } from '../../components/TextLink'
import { CONTACT_EMAIL, contactMailto } from '../../lib/contact'
import type { Source } from '../../lib/sources'
import { BulletItem } from './BulletItem'
import { BulletList } from './BulletList'
import { ExternalLink } from './ExternalLink'
import { Paragraph as P } from './Paragraph'
import { Section } from './Section'

interface MethodologySourcesProps {
  /** The line introducing this calculator's sources. */
  intro: string
  sources: readonly Source[]
  /** The corrections email's subject, naming the page it was sent from. */
  emailSubject: string
}

/**
 * A methodology page's closing "Sources" section: the citations everything on
 * the page rests on, a pointer to the full sources & ethos page, and how to
 * report a correction.
 */
export function MethodologySources({ intro, sources, emailSubject }: MethodologySourcesProps) {
  return (
    <Section title="Sources">
      <P>{intro}</P>
      <BulletList>
        {sources.map((source) => (
          <BulletItem key={source.url}>
            <ExternalLink href={source.url}>{source.label}</ExternalLink>
          </BulletItem>
        ))}
      </BulletList>
      <P>
        For the full list behind every calculator — and more on how the site works and why —{' '}
        <TextLink href="/sources/">see our sources &amp; ethos page</TextLink>.
      </P>
      <P>
        Spotted something wrong, or a rate that's moved? Email{' '}
        <ExternalLink href={contactMailto(emailSubject)}>{CONTACT_EMAIL}</ExternalLink> — corrections are very welcome.
      </P>
    </Section>
  )
}
