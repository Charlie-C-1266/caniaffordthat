import type { ReactNode } from 'react'
import { Tile } from '../Tile'
import { VerdictBanner } from './VerdictBanner'
import { ResultHeadline } from './ResultHeadline'
import type { DerivedResult } from '../../lib/derive'

interface ResultCardProps {
  /** The verdict and headline copy. The vehicle result carries the same fields. */
  result: Pick<DerivedResult, 'isAffordable' | 'verdictText' | 'verdictSub' | 'resultEyebrow' | 'headline' | 'subheadline'>
  /** See resultAccents: the mode accent on a "Yes", neutral on a "No". */
  eyebrowColor: string
  /** The card's own body, under the headline: its chart, breakdowns and actions. */
  children: ReactNode
}

/** The frame every result card shares: the verdict banner across the top, then the headline, then the card's own content. */
export function ResultCard({ result, eyebrowColor, children }: ResultCardProps) {
  return (
    <Tile maxWidth={640} padding="0" style={{ overflow: 'hidden' }}>
      <VerdictBanner affordable={result.isAffordable} verdictText={result.verdictText} verdictSub={result.verdictSub} />

      <div style={{ padding: '26px 30px 30px' }}>
        <ResultHeadline
          eyebrow={result.resultEyebrow}
          eyebrowColor={eyebrowColor}
          headline={result.headline}
          subheadline={result.subheadline}
        />
        {children}
      </div>
    </Tile>
  )
}
