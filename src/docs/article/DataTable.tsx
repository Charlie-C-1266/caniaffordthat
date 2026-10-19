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
          {/*
           * Rows and cells are keyed by position, deliberately. Every table
           * here is a static literal in a docs page: nothing is inserted,
           * removed or reordered at runtime, so position really is a cell's
           * identity. There is also no data-dependent key available —
           *   - a row's first cell is not always a string (VehicleMethodologyPage
           *     passes `<>Up to {pct(...)}</>`), so stringifying it would risk
           *     several rows keying as "[object Object]" — a silent collision,
           *     worse than the index;
           *   - `head[j]` can't key the cells, because a row may be longer than
           *     `head` (article.test.tsx covers that shape) and every extra
           *     cell would key as `undefined`.
           */}
          {rows.map((row, i) => (
            // oxlint-disable-next-line react/no-array-index-key -- static rows; see the note above
            <tr key={i}>
              {row.map((cell, j) => (
                // oxlint-disable-next-line react/no-array-index-key -- static cells; see the note above
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
