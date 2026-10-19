import type { ReactNode } from 'react'
import { DataTable } from './DataTable'
import { Paragraph as P } from './Paragraph'
import { Section } from './Section'

/**
 * A methodology page's "What we deliberately don't model (yet)" section: one
 * row per simplification, with what it means for the reader. The frame is
 * shared so every calculator owns up to its limits in the same words. Only
 * the rows are each page's own.
 */
export function ModelLimitations({ rows }: { rows: ReactNode[][] }) {
  return (
    <Section title="What we deliberately don't model (yet)">
      <P>Being upfront about the edges of the model matters as much as the model:</P>
      <DataTable head={['Simplification', 'What it means for you']} rows={rows} />
    </Section>
  )
}
