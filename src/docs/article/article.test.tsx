// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { ExternalLink } from './ExternalLink'
import { DataTable } from './DataTable'
import { PageHeader } from './PageHeader'
import { Section } from './Section'
import { Paragraph } from './Paragraph'
import { Formula } from './Formula'
import { Num } from './Num'
import { Strong } from './Strong'

afterEach(cleanup)

describe('ExternalLink', () => {
  it('opens in a new tab with the full noopener/noreferrer guard', () => {
    // target="_blank" without rel="noopener" hands the opened page a live
    // window.opener handle back to ours — the reason this component exists
    // rather than every page hand-writing its own anchor.
    render(<ExternalLink href="https://www.gov.uk/income-tax-rates">Income Tax rates</ExternalLink>)
    const link = screen.getByRole('link', { name: 'Income Tax rates' })
    expect(link).toHaveProperty('href', 'https://www.gov.uk/income-tax-rates')
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toContain('noopener')
    expect(link.getAttribute('rel')).toContain('noreferrer')
  })

  it('renders rich children, not just text', () => {
    render(
      <ExternalLink href="https://example.com">
        <strong>GitHub</strong>
      </ExternalLink>,
    )
    expect(screen.getByRole('link').querySelector('strong')?.textContent).toBe('GitHub')
  })
})

describe('DataTable', () => {
  it('renders one th per head entry and one td per cell', () => {
    render(
      <DataTable
        head={['Source', 'What we use it for']}
        rows={[
          ['MoneyHelper', 'The 30% rule'],
          ['GOV.UK', 'Vehicle tax rates'],
        ]}
      />,
    )
    expect(screen.getAllByRole('columnheader').map((th) => th.textContent)).toEqual(['Source', 'What we use it for'])
    expect(screen.getAllByRole('cell').map((td) => td.textContent)).toEqual(['MoneyHelper', 'The 30% rule', 'GOV.UK', 'Vehicle tax rates'])
  })

  it('renders the headers and an empty body when rows is empty', () => {
    // The shape a data-driven table takes if its source list is ever emptied:
    // headers still render, body is empty, nothing throws.
    render(<DataTable head={['Source', 'What we use it for']} rows={[]} />)
    expect(screen.getAllByRole('columnheader')).toHaveLength(2)
    expect(screen.queryAllByRole('cell')).toHaveLength(0)
    expect(screen.getAllByRole('row')).toHaveLength(1)
  })

  it('renders a row shorter than the header without padding or throwing', () => {
    // Ragged rows are a type-level possibility (ReactNode[][] doesn't pin the
    // width), so pin the actual behaviour: cells are rendered 1:1 with the
    // row's own length, no filler cells invented.
    render(<DataTable head={['A', 'B', 'C']} rows={[['only one']]} />)
    expect(screen.getAllByRole('columnheader')).toHaveLength(3)
    expect(screen.getAllByRole('cell').map((td) => td.textContent)).toEqual(['only one'])
  })

  it('renders a row longer than the header without dropping the extra cells', () => {
    render(<DataTable head={['A']} rows={[['one', 'two', 'three']]} />)
    expect(screen.getAllByRole('columnheader')).toHaveLength(1)
    expect(screen.getAllByRole('cell').map((td) => td.textContent)).toEqual(['one', 'two', 'three'])
  })

  it('renders empty and nullish cells as empty cells rather than failing', () => {
    // What a source rendered without its optional annotation produces: the
    // cell is still there (so the row's columns stay aligned), just blank.
    render(
      <DataTable
        head={['Source', 'What we use it for']}
        rows={[
          ['MoneyHelper', ''],
          ['GOV.UK', undefined],
        ]}
      />,
    )
    const cells = screen.getAllByRole('cell')
    expect(cells).toHaveLength(4)
    expect(cells[1].textContent).toBe('')
    expect(cells[3].textContent).toBe('')
  })

  it('renders element cells, so a cell can hold a link', () => {
    render(
      <DataTable
        head={['Source']}
        rows={[
          [
            <ExternalLink key="l" href="https://example.com">
              MoneyHelper
            </ExternalLink>,
          ],
        ]}
      />,
    )
    expect(screen.getByRole('cell').querySelector('a')?.getAttribute('rel')).toContain('noopener')
  })
})

describe('PageHeader', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-theme')
  })

  it('renders the brand mark, a link back to the calculator, and the theme toggle', () => {
    render(<PageHeader />)
    const homeLinks = screen.getAllByRole('link').filter((a) => a.getAttribute('href') === '/')
    // Two routes home: the brand mark and the explicit "back" link.
    expect(homeLinks).toHaveLength(2)
    expect(screen.getByText('Can I Afford That?')).toBeDefined()
    expect(screen.getByText('← Back to the calculator')).toBeDefined()
    // ThemeToggle renders a button labelled for the theme it would switch to.
    expect(screen.getByRole('button', { name: /switch to .* theme/i })).toBeDefined()
  })

  it('uses the save accent by default and honours an explicit accentColor', () => {
    const { container, unmount } = render(<PageHeader />)
    expect(container.querySelector('header span')?.getAttribute('style')).toContain('var(--accent-save)')
    unmount()

    const finance = render(<PageHeader accentColor="var(--accent-finance)" />)
    expect(finance.container.querySelector('header span')?.getAttribute('style')).toContain('var(--accent-finance)')
  })

  it('keeps the header links internal — nothing here opens a new tab', () => {
    render(<PageHeader />)
    for (const link of screen.getAllByRole('link')) {
      expect(link.getAttribute('target')).toBeNull()
    }
  })
})

describe('inline helpers', () => {
  it('Section renders its title as an h2 above its children', () => {
    render(
      <Section title="How we work">
        <p>body</p>
      </Section>,
    )
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('How we work')
    expect(screen.getByText('body')).toBeDefined()
  })

  it('Paragraph renders a p carrying its children', () => {
    const { container } = render(<Paragraph>Some prose</Paragraph>)
    expect(container.querySelector('p')?.textContent).toBe('Some prose')
  })

  it('Formula renders a mono pre that preserves whitespace', () => {
    const { container } = render(<Formula>{'monthly = target / months'}</Formula>)
    const pre = container.querySelector('pre')
    expect(pre?.textContent).toBe('monthly = target / months')
    expect(pre?.className).toBe('mono')
    expect(pre?.getAttribute('style')).toContain('white-space: pre')
  })

  it('Num renders a mono span', () => {
    const { container } = render(<Num>£200</Num>)
    const span = container.querySelector('span')
    expect(span?.textContent).toBe('£200')
    expect(span?.className).toBe('mono')
  })

  it('Strong renders a strong element', () => {
    const { container } = render(<Strong>60 months</Strong>)
    expect(container.querySelector('strong')?.textContent).toBe('60 months')
  })
})
