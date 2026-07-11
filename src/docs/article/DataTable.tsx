import type { CSSProperties, ReactNode } from 'react'

const cellStyle: CSSProperties = {
  padding: '10px 14px',
  borderBottom: '1px solid var(--divider)',
  fontSize: 'var(--fs-body)',
  color: 'var(--text-secondary)',
  lineHeight: 1.5,
  textAlign: 'left',
  verticalAlign: 'top',
}

/** A simple data table on a soft card; the first column is the row's name. Wide tables scroll within the card, not the page. */
export function DataTable({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div style={{ overflowX: 'auto', background: 'var(--tile-bg)', borderRadius: 'var(--radius-glass-sm)', marginBottom: 14 }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 480 }}>
        <thead>
          <tr>
            {head.map((h) => (
              <th
                key={h}
                style={{
                  ...cellStyle,
                  fontSize: 'var(--fs-label)',
                  fontWeight: 800,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: 'var(--text-tertiary)',
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j} style={{ ...cellStyle, ...(j === 0 ? { color: 'var(--text-primary)', fontWeight: 700 } : {}) }}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
