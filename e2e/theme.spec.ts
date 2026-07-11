import { test, expect } from '@playwright/test'

/** Whether <html> currently carries the light-theme attribute, i.e. the resolved theme. */
async function currentTheme(page: import('@playwright/test').Page): Promise<'light' | 'dark'> {
  const hasLight = await page.evaluate(() => document.documentElement.getAttribute('data-theme') === 'light')
  return hasLight ? 'light' : 'dark'
}

test.describe('theme', () => {
  test('first visit, OS prefers light, no stored preference -> resolves to light before paint', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' })
    await page.goto('/')
    expect(await currentTheme(page)).toBe('light')
  })

  test('first visit, OS prefers dark, no stored preference -> resolves to dark (the pre-existing default)', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.goto('/')
    expect(await currentTheme(page)).toBe('dark')
  })

  test('toggling persists across a reload', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.goto('/')
    expect(await currentTheme(page)).toBe('dark')

    await page.getByTestId('theme-toggle').click()
    expect(await currentTheme(page)).toBe('light')

    await page.reload()
    expect(await currentTheme(page)).toBe('light')
  })

  test('an explicit choice overrides and outlives the OS preference', async ({ page }) => {
    // OS prefers light throughout — first visit resolves to light, matching it.
    await page.emulateMedia({ colorScheme: 'light' })
    await page.goto('/')
    expect(await currentTheme(page)).toBe('light')

    // Toggle to dark despite the OS still preferring light.
    await page.getByTestId('theme-toggle').click()
    expect(await currentTheme(page)).toBe('dark')

    // Reload with the OS preference unchanged (still light) — the explicit
    // choice must win, not snap back to the system setting.
    await page.reload()
    expect(await currentTheme(page)).toBe('dark')
  })

  test('the toggle is reachable from the main app and both docs pages, and its accessible name reflects the current state', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' })

    await page.goto('/')
    const appToggle = page.getByTestId('theme-toggle')
    await expect(appToggle).toHaveAttribute('aria-label', 'Switch to light theme')
    await appToggle.click()
    expect(await currentTheme(page)).toBe('light')
    await expect(appToggle).toHaveAttribute('aria-label', 'Switch to dark theme')

    // A fresh visit to a docs page picks up the same persisted choice...
    await page.goto('/sources/')
    expect(await currentTheme(page)).toBe('light')

    // ...and its own toggle instance (PageHeader) works independently.
    const sourcesToggle = page.getByTestId('theme-toggle')
    await sourcesToggle.click()
    expect(await currentTheme(page)).toBe('dark')

    await page.goto('/methodology/vehicle/')
    expect(await currentTheme(page)).toBe('dark')
  })
})
