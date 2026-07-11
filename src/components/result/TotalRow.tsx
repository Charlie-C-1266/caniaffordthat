/** The emphasised, rule-topped bottom line of a BreakdownBox (amount left to save / total monthly cost / total payable). */
export function TotalRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 9, borderTop: '1px solid rgba(245,243,255,0.12)' }}>
      <span style={{ color: 'var(--text-secondary-dim)' }}>{label}</span>
      <span style={{ color: 'var(--text-primary)' }}>{value}</span>
    </div>
  )
}
