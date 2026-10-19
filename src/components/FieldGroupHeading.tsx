/**
 * The small uppercase heading above a group of fields: the Budget step's
 * "Monthly outgoings" and "Money you're already putting away", and the vehicle
 * running-costs groups ("Fuel", "Maintenance", "Insurance & tax"). One
 * component so the groups can't drift apart in weight, colour or spacing. The
 * running-costs step once kept its own copy, which had drifted to 2px less
 * space below.
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
