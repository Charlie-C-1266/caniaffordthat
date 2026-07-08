interface ResultHeadlineProps {
  eyebrow: string
  /** The mode accent on a "Yes"; a neutral tone on a "No" (see the cards' colour notes). */
  eyebrowColor: string
  headline: string
  subheadline: string
}

/** The result card's header: uppercase eyebrow, big mono headline, and explanatory sub-line. Shared by the standard and vehicle cards. */
export function ResultHeadline({ eyebrow, eyebrowColor, headline, subheadline }: ResultHeadlineProps) {
  return (
    <>
      <div
        style={{
          fontSize: 'var(--fs-label)',
          fontWeight: 800,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: eyebrowColor,
          marginBottom: 8,
        }}
      >
        {eyebrow}
      </div>
      <h1
        className="mono"
        style={{
          fontSize: 'var(--fs-result-headline)',
          lineHeight: 1.08,
          fontWeight: 800,
          letterSpacing: '-0.02em',
          margin: '0 0 6px',
          fontVariantNumeric: 'tabular-nums',
          color: 'var(--text-primary)',
        }}
      >
        {headline}
      </h1>
      <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-secondary)', margin: '0 0 16px', maxWidth: '54ch', fontWeight: 500 }}>
        {subheadline}
      </p>
    </>
  )
}
