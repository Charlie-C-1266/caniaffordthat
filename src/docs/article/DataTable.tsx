import type { CSSProperties, ReactNode } from 'react'
import { useOverflowX } from '../../hooks/useOverflowX'
import { scrollerRegionProps } from './scrollerRegion'

const cellStyle: CSSProperties = {
  padding: '10px 14px',
  borderBottom: '1px solid var(--divider)',
  fontSize: 'var(--fs-body)',
  color: 'var(--text-secondary)',
  lineHeight: 1.5,
  textAlign: 'left',
  verticalAlign: 'top',
}

interface DataTableProps {
  head: string[]
  rows: ReactNode[][]
  /**
   * What a screen reader calls this table once it is wide enough to scroll.
   * Falls back to the first column's heading, which names the thing each row
   * is about ("Band", "Plan", "Source") and is the best name available
   * without one.
   */
  label?: string
}

/**
 * The first cell of each body row. Styled as the row's name, and marked up as
 * one: `<th scope="row">`, so a screen reader reads the row's name alongside
 * each of its values instead of announcing them with no context (WCAG 1.3.1).
 * The `<th>` defaults for alignment and weight are reset, so it renders exactly
 * as the `<td>` it replaced.
 */
const rowHeaderStyle: CSSProperties = {
  ...cellStyle,
  color: 'var(--text-primary)',
  fontWeight: 700,
  textAlign: 'left',
}

/**
 * A simple data table on a soft card; the first column is the row's name. Wide
 * tables scroll within the card, not the page.
 *
 * Headers are `<th scope="col">` and each row's first cell is
 * `<th scope="row">`, the same pattern as the calculator's own
 * result/ProjectionTable. Before #285 the first column was *styled* as a row
 * name but emitted as a plain `<td>` and the column headers had no `scope`, so
 * moving across a row in a screen reader's table navigation read values with no
 * row context — on the "Model limitations" table, "What it means for you" cells
 * came through without the simplification they belong to.
 */
export function DataTable({ head, rows, label }: DataTableProps) {
  const [scrollerRef, overflowing] = useOverflowX<HTMLDivElement>()

  return (
    <div
      ref={scrollerRef}
      className="doc-scroller"
      {...scrollerRegionProps(overflowing, label ?? head[0] ?? 'Table')}
      style={{ overflowX: 'auto', background: 'var(--tile-bg)', borderRadius: 'var(--radius-glass-sm)', marginBottom: 14 }}
    >
      <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 480 }}>
        <thead>
          <tr>
            {head.map((h) => (
              <th
                key={h}
                scope="col"
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
              {row.map((cell, j) =>
                j === 0 ? (
                  // oxlint-disable-next-line react/no-array-index-key -- static cells; see the note above
                  <th key={j} scope="row" style={rowHeaderStyle}>
                    {cell}
                  </th>
                ) : (
                  // oxlint-disable-next-line react/no-array-index-key -- static cells; see the note above
                  <td key={j} style={cellStyle}>
                    {cell}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
