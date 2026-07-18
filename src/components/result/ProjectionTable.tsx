import { fmt } from '../../lib/calculations'
import type { Projection } from '../../lib/projection'

// The month-by-month projection as a plain table — an exact read-off the chart
// can only approximate, and the accessible/no-hover fallback for the same
// series. Scrolls within a fixed height so a long plan doesn't push the rest
// of the result card down.

interface ProjectionTableProps {
  projection: Projection
}

const cellStyle = {
  padding: '5px 10px',
  fontSize: 'var(--fs-label-sm)',
  whiteSpace: 'nowrap',
} as const

const headStyle = {
  ...cellStyle,
  position: 'sticky',
  top: 0,
  background: 'var(--bg-dark-2)',
  fontSize: 'var(--fs-rail-label)',
  fontWeight: 800,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  color: 'var(--text-tertiary)',
  textAlign: 'right',
} as const

/** The projection as a scrollable month/date/balance/% table. */
export function ProjectionTable({ projection }: ProjectionTableProps) {
  const { points, target, kind } = projection
  const valueHeading = kind === 'save' ? 'Saved' : 'Repaid'

  return (
    <div style={{ maxHeight: 208, overflowY: 'auto', borderRadius: 'var(--radius-glass-sm)', border: '1px solid var(--divider)' }}>
      <table
        className="mono"
        style={{ width: '100%', borderCollapse: 'collapse', fontVariantNumeric: 'tabular-nums', color: 'var(--text-primary)' }}
      >
        <thead>
          <tr>
            <th scope="col" style={{ ...headStyle, textAlign: 'left' }}>
              Month
            </th>
            <th scope="col" style={{ ...headStyle, textAlign: 'left' }}>
              Date
            </th>
            <th scope="col" style={headStyle}>
              {valueHeading}
            </th>
            <th scope="col" style={headStyle}>
              % of goal
            </th>
          </tr>
        </thead>
        <tbody>
          {points.map((p) => (
            <tr key={p.month} style={{ borderTop: '1px solid var(--divider)' }}>
              <th scope="row" style={{ ...cellStyle, textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)' }}>
                {p.month === 0 ? 'Now' : p.month}
              </th>
              <td style={{ ...cellStyle, textAlign: 'left', color: 'var(--text-secondary)' }}>{p.dateLabel}</td>
              <td style={{ ...cellStyle, textAlign: 'right' }}>{fmt(p.value)}</td>
              <td style={{ ...cellStyle, textAlign: 'right', color: 'var(--text-secondary)' }}>
                {target > 0 ? Math.round((p.value / target) * 100) : 0}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
