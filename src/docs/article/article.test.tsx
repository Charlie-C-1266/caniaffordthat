// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup, act } from '@testing-library/react'
import { ExternalLink } from './ExternalLink'
import { DataTable } from './DataTable'
import { PageHeader } from './PageHeader'
import { Section } from './Section'
import { Paragraph } from './Paragraph'
import { Formula } from './Formula'
import { Num } from './Num'
import { Strong } from './Strong'
import { BulletList } from './BulletList'
import { BulletItem } from './BulletItem'
import { DocPage } from './DocPage'
import { MethodologySources } from './MethodologySources'
import { ModelLimitations } from './ModelLimitations'
import { CONTACT_EMAIL } from '../../lib/contact'
import { installResizeObserver, resizeObserved } from '../../test/resizeObserver'

afterEach(cleanup)

// The two scroll containers below observe their own width to decide whether
// they currently overflow (#314), and jsdom has no ResizeObserver.
beforeEach(installResizeObserver)

/**
 * Makes every element report these widths for the rest of the test, so the
 * overflow check can be driven from here — jsdom lays nothing out and reports
 * 0 for both, which reads as "fits". Returns the undo.
 */
function stubWidths(scrollWidth: number, clientWidth: number): () => void {
  const originals = (['scrollWidth', 'clientWidth'] as const).map(
    (name) => [name, Object.getOwnPropertyDescriptor(HTMLElement.prototype, name)] as const,
  )
  Object.defineProperty(HTMLElement.prototype, 'scrollWidth', { configurable: true, get: () => scrollWidth })
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => clientWidth })

  return () => {
    for (const [name, descriptor] of originals) {
      if (descriptor === undefined) delete (HTMLElement.prototype as unknown as Record<string, unknown>)[name]
      else Object.defineProperty(HTMLElement.prototype, name, descriptor)
    }
  }
}

/** The scroll box a DataTable renders its table inside. */
const tableScroller = () => screen.getByRole('table').parentElement

/** A table wider than its box, as every docs table is on a phone: 480px of content in a 304px card. */
const overflowing = () => stubWidths(480, 304)
/** The same table on a desktop, where it fits. */
const fitting = () => stubWidths(480, 640)

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
  // Every table on the three docs pages is a DataTable. Its first column is
  // the row's name — styled that way, and since #285 marked up that way too:
  // `<th scope="row">`, with `scope="col"` on the headers, so a screen reader
  // reads a row's name alongside each of its values rather than announcing
  // them with no context (WCAG 1.3.1). `rowheader` and `cell` are therefore
  // distinct roles here, which is what these tests pin.
  it('renders one scoped column header per head entry, a row header per row, and cells for the rest', () => {
    render(
      <DataTable
        head={['Source', 'What we use it for']}
        rows={[
          ['MoneyHelper', 'The 30% rule'],
          ['GOV.UK', 'Vehicle tax rates'],
        ]}
      />,
    )
    const columnHeaders = screen.getAllByRole('columnheader')
    expect(columnHeaders.map((th) => th.textContent)).toEqual(['Source', 'What we use it for'])
    expect(columnHeaders.map((th) => th.getAttribute('scope'))).toEqual(['col', 'col'])

    const rowHeaders = screen.getAllByRole('rowheader')
    expect(rowHeaders.map((th) => th.textContent)).toEqual(['MoneyHelper', 'GOV.UK'])
    expect(rowHeaders.map((th) => th.getAttribute('scope'))).toEqual(['row', 'row'])
    expect(rowHeaders.map((th) => th.tagName)).toEqual(['TH', 'TH'])

    // The remaining cells stay <td>, so each row is one row header plus its values.
    expect(screen.getAllByRole('cell').map((td) => td.textContent)).toEqual(['The 30% rule', 'Vehicle tax rates'])
  })

  it('keeps the first column looking exactly as it did as a td', () => {
    // A <th> defaults to centred and bold; both are reset so the change is
    // semantic only. The colour and weight match the old inline style.
    render(<DataTable head={['Source', 'Use']} rows={[['MoneyHelper', 'The 30% rule']]} />)
    const rowHeader = screen.getByRole('rowheader')

    expect(rowHeader.style.textAlign).toBe('left')
    expect(rowHeader.style.fontWeight).toBe('700')
    expect(rowHeader.style.color).toBe('var(--text-primary)')
    // The shared cell styling is still there.
    expect(rowHeader.style.padding).toBe('10px 14px')
    expect(rowHeader.style.verticalAlign).toBe('top')
    expect(rowHeader.style.fontSize).toBe('var(--fs-body)')

    // And an ordinary cell is unchanged.
    const cell = screen.getByRole('cell')
    expect(cell.style.color).toBe('var(--text-secondary)')
    expect(cell.style.fontWeight).toBe('')
  })

  it('makes a non-string first cell a row header too', () => {
    // VehicleMethodologyPage passes `<>Up to {pct(...)}</>` as a row's name.
    render(<DataTable head={['Age', 'Drop']} rows={[[<>Up to {'40%'}</>, 'per year']]} />)
    const rowHeader = screen.getByRole('rowheader')
    expect(rowHeader.textContent).toBe('Up to 40%')
    expect(rowHeader.getAttribute('scope')).toBe('row')
  })

  it('renders the headers and an empty body when rows is empty', () => {
    // The shape a data-driven table takes if its source list is ever emptied:
    // headers still render, body is empty, nothing throws.
    render(<DataTable head={['Source', 'What we use it for']} rows={[]} />)
    expect(screen.getAllByRole('columnheader')).toHaveLength(2)
    expect(screen.queryAllByRole('cell')).toHaveLength(0)
    // No body rows means no row headers either.
    expect(screen.queryAllByRole('rowheader')).toHaveLength(0)
    expect(screen.getAllByRole('row')).toHaveLength(1)
  })

  it('renders a row shorter than the header without padding or throwing', () => {
    // Ragged rows are a type-level possibility (ReactNode[][] doesn't pin the
    // width), so pin the actual behaviour: cells are rendered 1:1 with the
    // row's own length, no filler cells invented.
    render(<DataTable head={['A', 'B', 'C']} rows={[['only one']]} />)
    expect(screen.getAllByRole('columnheader')).toHaveLength(3)
    // The one cell it has is the row's name, so it is the row header.
    expect(screen.getAllByRole('rowheader').map((th) => th.textContent)).toEqual(['only one'])
    expect(screen.queryAllByRole('cell')).toHaveLength(0)
  })

  it('renders a row longer than the header without dropping the extra cells', () => {
    render(<DataTable head={['A']} rows={[['one', 'two', 'three']]} />)
    expect(screen.getAllByRole('columnheader')).toHaveLength(1)
    // Still one row header plus every extra cell: nothing is dropped.
    expect(screen.getAllByRole('rowheader').map((th) => th.textContent)).toEqual(['one'])
    expect(screen.getAllByRole('cell').map((td) => td.textContent)).toEqual(['two', 'three'])
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
    expect(screen.getAllByRole('rowheader').map((th) => th.textContent)).toEqual(['MoneyHelper', 'GOV.UK'])
    const cells = screen.getAllByRole('cell')
    expect(cells).toHaveLength(2)
    expect(cells[0].textContent).toBe('')
    expect(cells[1].textContent).toBe('')
  })

  it('renders element cells, so a row header and a cell can each hold a link', () => {
    // The Sources page puts its citation links in both columns.
    render(
      <DataTable
        head={['Source', 'Guidance']}
        rows={[
          [
            <ExternalLink key="name" href="https://example.com">
              MoneyHelper
            </ExternalLink>,
            <ExternalLink key="guidance" href="https://example.org">
              The 30% rule
            </ExternalLink>,
          ],
        ]}
      />,
    )
    expect(screen.getByRole('rowheader').querySelector('a')?.getAttribute('rel')).toContain('noopener')
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
    // Plus the shared scroll-container class the focus ring hangs off (#314).
    expect(pre?.className).toBe('mono doc-scroller')
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

describe('BulletList and BulletItem', () => {
  it('render a list with one item per entry, in order', () => {
    render(
      <BulletList>
        <BulletItem>GOV.UK</BulletItem>
        <BulletItem>MoneyHelper</BulletItem>
      </BulletList>,
    )
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual(['GOV.UK', 'MoneyHelper'])
  })
})

const follows = (a: Node, b: Node) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)

const swatch = () => screen.getByText('Can I Afford That?').previousElementSibling as HTMLElement

describe('DocPage', () => {
  it('gives the page one h1, between the header and the article, with the footer after', () => {
    render(
      <DocPage title="How the vehicle calculator works">
        <p>The article body</p>
      </DocPage>,
    )
    expect(screen.getAllByRole('heading', { level: 1 }).map((h) => h.textContent)).toEqual(['How the vehicle calculator works'])
    // The header's way back, then the title, then the body, then the footer.
    const back = screen.getByRole('link', { name: '← Back to the calculator' })
    const title = screen.getByRole('heading', { level: 1 })
    const body = screen.getByText('The article body')
    const footer = screen.getByRole('contentinfo')
    expect(follows(back, title) && follows(title, body) && follows(body, footer)).toBe(true)
  })

  it("passes its accent to the header's brand swatch, and leaves the header's default otherwise", () => {
    render(<DocPage title="Finance">{null}</DocPage>)
    expect(swatch().style.background).toBe('var(--accent-save)')
    cleanup()
    render(
      <DocPage title="Finance" accentColor="var(--accent-finance)">
        {null}
      </DocPage>,
    )
    expect(swatch().style.background).toBe('var(--accent-finance)')
  })
})

describe('MethodologySources', () => {
  const SOURCES = [
    { label: 'Income Tax rates', url: 'https://www.gov.uk/income-tax-rates', usedFor: 'The bands' },
    { label: 'National Insurance rates', url: 'https://www.gov.uk/national-insurance-rates-letters', usedFor: 'NI' },
  ]

  it('lists every source as a new-tab link, after its own intro line', () => {
    render(
      <MethodologySources intro="The official rates everything above is built on:" sources={SOURCES} emailSubject="Salary methodology" />,
    )
    expect(screen.getByRole('heading', { name: 'Sources' })).toBeTruthy()
    expect(screen.getByText('The official rates everything above is built on:')).toBeTruthy()
    for (const { label, url } of SOURCES) {
      const link = screen.getByRole('link', { name: label })
      expect(link.getAttribute('href')).toBe(url)
      expect(link.getAttribute('target')).toBe('_blank')
    }
  })

  it('points to the sources & ethos page in the same tab', () => {
    render(<MethodologySources intro="Sources:" sources={SOURCES} emailSubject="Salary methodology" />)
    const link = screen.getByRole('link', { name: 'see our sources & ethos page' })
    expect(link.getAttribute('href')).toBe('/sources/')
    expect(link.hasAttribute('target')).toBe(false)
  })

  it('addresses the corrections email with the subject it was given', () => {
    render(<MethodologySources intro="Sources:" sources={SOURCES} emailSubject="Vehicle methodology" />)
    const href = screen.getByRole('link', { name: CONTACT_EMAIL }).getAttribute('href') ?? ''
    expect(href.startsWith(`mailto:${CONTACT_EMAIL}`)).toBe(true)
    expect(decodeURIComponent(href)).toContain('Vehicle methodology')
  })
})

describe('ModelLimitations', () => {
  it("frames the page's own rows in the shared heading, intro and table head", () => {
    render(<ModelLimitations rows={[['Scottish tax', 'Scotland has its own bands.']]} />)
    expect(screen.getByRole('heading', { name: "What we deliberately don't model (yet)" })).toBeTruthy()
    expect(screen.getByText('Being upfront about the edges of the model matters as much as the model:')).toBeTruthy()
    expect(screen.getAllByRole('columnheader').map((th) => th.textContent)).toEqual(['Simplification', 'What it means for you'])
    // The simplification names the row, so it is the row header and the
    // consequence beside it is the cell.
    expect(screen.getAllByRole('rowheader').map((th) => th.textContent)).toEqual(['Scottish tax'])
    expect(screen.getAllByRole('cell').map((td) => td.textContent)).toEqual(['Scotland has its own bands.'])
  })
})

// #314: every DataTable and Formula on the three docs pages is a
// `overflowX: auto` box whose hidden columns contain nothing focusable, and
// none of them had a tabIndex, a role or a name. Safari and older Chromium
// don't make scrollers focusable on their own, so the rate and threshold
// columns of the tax-band and student-loan tables were simply out of keyboard
// reach — WCAG 2.1.1, and axe's `scrollable-region-focusable`.
describe('the docs scroll containers', () => {
  // Null rather than a no-op, so each test's width stub is undone exactly once.
  let restore: (() => void) | null = null

  afterEach(() => {
    restore?.()
    restore = null
  })

  it('names an overflowing table as a region a keyboard can reach', () => {
    restore = overflowing()
    render(<DataTable label="Income tax bands and rates" head={['Band', 'Rate']} rows={[['Basic rate', '20%']]} />)

    const region = screen.getByRole('region', { name: 'Income tax bands and rates' })
    expect(region.getAttribute('tabindex')).toBe('0')
    // The focus ring comes from the shared .doc-scroller rule in index.css.
    expect(region.className).toContain('doc-scroller')
  })

  it('falls back to the first column heading when given no label', () => {
    restore = overflowing()
    render(<DataTable head={['Band', 'Rate']} rows={[['Basic rate', '20%']]} />)

    // "Band" names what each row is about, which is the best name available.
    expect(screen.getByRole('region', { name: 'Band' })).toBeTruthy()
  })

  it('falls back again to a plain name when there are no headings at all', () => {
    restore = overflowing()
    render(<DataTable head={[]} rows={[['Basic rate']]} />)

    expect(screen.getByRole('region', { name: 'Table' })).toBeTruthy()
  })

  it('adds no tab stop to a table that fits, so desktop gains no extra stops', () => {
    restore = fitting()
    render(<DataTable label="Income tax bands and rates" head={['Band', 'Rate']} rows={[['Basic rate', '20%']]} />)

    expect(screen.queryByRole('region')).toBeNull()
    expect(tableScroller()?.hasAttribute('tabindex')).toBe(false)
    expect(tableScroller()?.hasAttribute('aria-label')).toBe(false)
  })

  it('becomes reachable when a resize makes it overflow, and stops when it fits again', () => {
    // The viewport narrowing, or a web font loading — both resize the element
    // with no React render to hang a re-measure off.
    restore = fitting()
    render(<DataTable label="Income tax bands and rates" head={['Band', 'Rate']} rows={[['Basic rate', '20%']]} />)
    expect(screen.queryByRole('region')).toBeNull()

    restore()
    restore = overflowing()
    act(resizeObserved)
    expect(screen.getByRole('region', { name: 'Income tax bands and rates' })).toBeTruthy()

    restore()
    restore = fitting()
    act(resizeObserved)
    expect(screen.queryByRole('region')).toBeNull()
  })

  it('names an overflowing formula by what it works out', () => {
    restore = overflowing()
    render(<Formula label="take-home">{'take-home = gross − tax'}</Formula>)

    const region = screen.getByRole('region', { name: 'Formula: take-home' })
    expect(region.tagName).toBe('PRE')
    expect(region.getAttribute('tabindex')).toBe('0')
    expect(region.className).toContain('doc-scroller')
  })

  it('names an unlabelled formula plainly rather than leaving it unnamed', () => {
    restore = overflowing()
    render(<Formula>{'take-home = gross − tax'}</Formula>)

    expect(screen.getByRole('region', { name: 'Formula' })).toBeTruthy()
  })

  it('adds no tab stop to a formula that fits', () => {
    restore = fitting()
    const { container } = render(<Formula label="take-home">{'take-home = gross − tax'}</Formula>)

    expect(screen.queryByRole('region')).toBeNull()
    expect(container.querySelector('pre')?.hasAttribute('tabindex')).toBe(false)
  })

  it('still renders an empty or single-row table', () => {
    restore = overflowing()
    render(<DataTable label="Empty" head={['Band', 'Rate']} rows={[]} />)
    expect(screen.getByRole('region', { name: 'Empty' })).toBeTruthy()
    expect(screen.queryAllByRole('cell')).toEqual([])
    cleanup()

    render(<DataTable label="One row" head={['Band']} rows={[['Basic rate']]} />)
    expect(screen.getByRole('region', { name: 'One row' })).toBeTruthy()
    // A one-column row is all row header since #285, so its one cell is a rowheader.
    expect(screen.getAllByRole('rowheader')).toHaveLength(1)
  })
})
