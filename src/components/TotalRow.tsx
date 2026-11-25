import { BreakdownRow } from './BreakdownRow'

/**
 * The emphasised, rule-topped bottom line of a BreakdownBox (amount left to
 * save / total monthly cost / total payable).
 *
 * `wrapValue` is passed straight through: SalaryFlip's bottom line is the one
 * total whose value is prose rather than a figure ("£1,200 to spare"), so it
 * needs to wrap. See BreakdownRow for why.
 */
export function TotalRow({ label, value, wrapValue = false }: { label: string; value: string; wrapValue?: boolean }) {
  return <BreakdownRow label={label} value={value} total wrapValue={wrapValue} />
}
