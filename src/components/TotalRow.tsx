import { BreakdownRow } from './BreakdownRow'

/** The emphasised, rule-topped bottom line of a BreakdownBox (amount left to save / total monthly cost / total payable). */
export function TotalRow({ label, value }: { label: string; value: string }) {
  return <BreakdownRow label={label} value={value} total />
}
