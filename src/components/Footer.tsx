/** Legal disclaimer shown after the result step — estimates only, not financial advice. */
export function Footer() {
  return (
    <footer
      style={{
        padding: '32px 40px',
        textAlign: 'center',
        background: 'var(--bg-dark-1)',
      }}
    >
      <p
        style={{
          margin: '0 auto',
          maxWidth: 640,
          fontSize: 'var(--fs-helper)',
          color: 'var(--text-tertiary-dim)',
          lineHeight: 1.6,
        }}
      >
        Can I Afford That? provides estimates for illustrative purposes only. It
        is not financial advice, and results depend entirely on the figures you
        enter — they don't account for tax, fees, interest rate changes, or
        changes in your circumstances. Please speak to a qualified financial
        adviser before making significant financial decisions.
      </p>
    </footer>
  )
}
