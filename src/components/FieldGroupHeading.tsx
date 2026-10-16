/**
 * The small uppercase heading above a group of money fields on the Budget
 * step — "Monthly outgoings", "Money you're already putting away". Pulled out
 * rather than written inline so the two groups can't drift apart in weight,
 * colour or spacing (and so the step file keeps to one component).
 */
export function FieldGroupHeading({ children }: { children: string }) {
  return (
    <div
      style={{
        fontSize: 'var(--fs-label)',
        fontWeight: 700,
        color: 'var(--text-tertiary)',
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        marginBottom: 14,
      }}
    >
      {children}
    </div>
  )
}
