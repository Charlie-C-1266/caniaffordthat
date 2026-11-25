import { test, expect, type Locator, type Page } from '@playwright/test'

// The large headline money inputs used a fixed font size — `--fs-price` (50px)
// on the Details step's price, `--fs-price-md` (36px) on the Budget step's
// take-home and salary. On a narrow screen the input box was narrower than the
// number, so the leading digits stayed visible and the rest was hidden off the
// end, with nothing to say the value had been cut off: a £25,000 price read as
// "2500" at 360px, and six-figure prices were clipped even on a 390px iPhone.
//
// The existing narrow-viewport specs only look at document-level horizontal
// scroll, which this never caused — the overflow is inside the input. These
// tests read the input's own scrollWidth against its clientWidth, which is
// exactly what "digits hidden off the end" means.

const WIDTHS = [320, 360, 375, 390] as const

/** `0` is the placeholder case: the field is empty and shows its "0" hint. */
const VALUES = ['0', '1200', '25000', '125000', '999999'] as const

/**
 * Which combinations must show every digit (#298's acceptance criteria).
 *
 * The Details price is the bigger of the two fields, so a six-figure price at
 * 320px is the one case still allowed to clip — fitting it would mean shrinking
 * the headline on every common phone width to serve the narrowest one. The
 * Budget fields are smaller and must fit six figures everywhere.
 */
function mustFit(field: 'price' | 'salary', width: number, value: string): boolean {
  if (field === 'salary') return true
  return value.replace(/\D/g, '').length <= (width >= 360 ? 6 : 5)
}

/** A share link carrying the same figure into the price, salary and take-home fields. */
const linkFor = (value: string) =>
  `/?goalId=big&mode=save&saveFlavor=goal&itemName=New+sofa&itemPrice=${value}` +
  `&takeHomeMode=salary&grossSalary=${value}&takeHome=${value}`

/** scrollWidth > clientWidth is the browser saying content is hidden off the end. */
async function expectNoClipping(input: Locator, label: string) {
  const { scrollWidth, clientWidth } = await input.evaluate((el) => ({ scrollWidth: el.scrollWidth, clientWidth: el.clientWidth }))
  expect(scrollWidth, `${label}: scrollWidth ${scrollWidth} must fit clientWidth ${clientWidth}`).toBeLessThanOrEqual(clientWidth)
}

/** The page itself must not gain a sideways scroll either. */
async function expectNoPageScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow, 'the page must not scroll sideways').toBeLessThanOrEqual(0)
}

/** The "£" glyph must end left of where the digits start, at every size. */
async function expectPrefixClearsDigits(input: Locator, label: string) {
  const gap = await input.evaluate((el) => {
    const prefix = el.parentElement?.querySelector('span')
    if (!prefix) throw new Error('expected a £ prefix beside the input')
    const padding = Number.parseFloat(getComputedStyle(el).paddingLeft)
    // Where the digits start, less where the "£" ends.
    return el.getBoundingClientRect().left + padding - prefix.getBoundingClientRect().right
  })
  expect(gap, `${label}: the £ must end left of the first digit`).toBeGreaterThan(0)
}

const priceField = (page: Page) => page.locator('input[type="number"]').nth(0)

/** The Budget step's salary field, reached through the progress rail. */
async function goToSalaryField(page: Page) {
  await page.getByLabel('Step progress').getByRole('button', { name: 'Budget', exact: true }).click()
  const salary = page.getByLabel('Annual salary (before tax)')
  await expect(salary).toBeVisible()
  return salary
}

for (const width of WIDTHS) {
  test.describe(`headline money inputs at ${width}px`, () => {
    test.use({ viewport: { width, height: 900 } })

    for (const value of VALUES) {
      test(`shows every digit of ${value} loaded from a share link`, async ({ page }) => {
        await page.goto(linkFor(value))

        const price = priceField(page)
        await expect(price).toBeVisible()
        if (mustFit('price', width, value)) await expectNoClipping(price, `price ${value}`)

        const salary = await goToSalaryField(page)
        if (mustFit('salary', width, value)) await expectNoClipping(salary, `salary ${value}`)

        await expectNoPageScroll(page)
      })
    }

    test('shows every digit of a value as it is typed, not just one loaded from a link', async ({ page }) => {
      // The live-typing path: the field is sized by CSS, not by the value, so
      // this must hold while the user is still entering the number.
      await page.goto('/?goalId=big&mode=save&saveFlavor=goal')
      await page.getByPlaceholder('e.g. Wedding, new kitchen, sofa').fill('New sofa')

      const price = priceField(page)
      /*
       * Typing is sequential by nature: each value replaces the one before it
       * in the same field, and the assertion has to see that value before the
       * next fill overwrites it. Promise.all would race them into one another.
       */
      // oxlint-disable eslint/no-await-in-loop -- see the note above
      for (const typed of ['1', '12', '125', '1250', '12500', width >= 360 ? '125000' : '99999']) {
        await price.fill(typed)
        await expectNoClipping(price, `typed price ${typed}`)
      }
      // oxlint-enable eslint/no-await-in-loop
      await expectNoPageScroll(page)
    })

    test('the £ prefix never overlaps the first digit', async ({ page }) => {
      await page.goto(linkFor('999999'))

      await expectPrefixClearsDigits(priceField(page), 'price')
      await expectPrefixClearsDigits(await goToSalaryField(page), 'salary')
    })
  })
}

test.describe('headline money inputs on desktop', () => {
  test.use({ viewport: { width: 1280, height: 900 } })

  test('are still exactly 50px and 36px, with the prefix and padding unchanged', async ({ page }) => {
    // The clamps top out well below desktop, so nothing about the desktop
    // layout may have shifted.
    await page.goto(linkFor('999999'))

    await expect(priceField(page)).toHaveCSS('font-size', '50px')
    await expect(priceField(page)).toHaveCSS('padding-left', '38px')

    const salary = await goToSalaryField(page)
    await expect(salary).toHaveCSS('font-size', '36px')
    await expect(salary).toHaveCSS('padding-left', '30px')

    // The derived prefix sizes land on their old fixed values too.
    const prefixSizes = await page.evaluate(() => {
      const style = getComputedStyle(document.documentElement)
      const resolve = (name: string) => {
        const probe = document.createElement('div')
        probe.style.fontSize = style.getPropertyValue(name)
        document.body.append(probe)
        const size = getComputedStyle(probe).fontSize
        probe.remove()
        return size
      }
      return { lg: resolve('--fs-prefix-lg'), md: resolve('--fs-prefix-md') }
    })
    expect(prefixSizes).toEqual({ lg: '40px', md: '28px' })
  })
})
