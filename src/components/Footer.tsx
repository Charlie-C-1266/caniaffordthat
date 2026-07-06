/** Shown after the result step — leads with the alpha notice, then the estimates-only / not-financial-advice disclaimer and a feedback link. */
export function Footer() {
  return (
    <footer
      style={{
        padding: '32px 40px',
        textAlign: 'center',
        background: 'var(--bg-dark-1)',
      }}
    >
      {/* Alpha notice first and emphasised, so it's the clearest thing here. */}
      <p
        style={{
          margin: '0 auto 18px',
          maxWidth: 640,
          fontSize: 'var(--fs-body)',
          fontWeight: 700,
          color: 'var(--text-secondary)',
          lineHeight: 1.5,
        }}
      >
        Heads up: Can I Afford That? is currently in <strong style={{ color: 'var(--text-primary)' }}>early alpha</strong>.
        It's actively being built, so expect bugs, rough edges, and things changing from one visit to the next.
      </p>
      <p
        style={{
          margin: '0 auto',
          maxWidth: 640,
          fontSize: 'var(--fs-helper)',
          color: 'var(--text-tertiary-dim)',
          lineHeight: 1.6,
        }}
      >
        It provides estimates for illustrative purposes only. It is not financial
        advice, and results depend entirely on the figures you enter — they don't
        account for tax, fees, interest rate changes, or changes in your
        circumstances. Please speak to a qualified financial adviser before making
        significant financial decisions.
        <br />
        <br />
        Found a bug, or got an idea for something you'd like to see? Email{' '}
        <a
          href="mailto:hello@caniaffordthat.co.uk?subject=Can%20I%20Afford%20That%3F%20feedback"
          style={{ color: 'var(--text-secondary)', textDecoration: 'underline' }}
        >
          hello@caniaffordthat.co.uk
        </a>{' '}
        — we'd love to hear from you.
      </p>
    </footer>
  )
}
