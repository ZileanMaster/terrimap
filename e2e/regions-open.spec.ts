import { test, expect } from '@playwright/test'

test.describe('Regions - open region should not crash', () => {
  test('[E2E-R1] open first region from RegionSelector -> map renders', async ({ page }) => {
    const errors: string[] = []
    const pageErrors: string[] = []

    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text())
    })
    page.on('pageerror', (err) => {
      pageErrors.push(String(err?.message || err))
    })

    await page.goto('/')
    await page.waitForTimeout(800)

    // Open "Khu vực & bản đồ" tab in DashboardLayout sidebar
    await page.getByRole('button', { name: /Khu vực & bản đồ/i }).click()
    await page.waitForTimeout(600)

    // RegionSelector should render cards; click the first region card (button)
    const firstRegionCard = page.locator('section').filter({ hasText: /Zones/i }).locator('button').first()
    await expect(firstRegionCard).toBeVisible()
    await firstRegionCard.click()

    // Map should render and root should not become empty/blank
    await expect(page.locator('#root')).not.toBeEmpty()
    await expect(page.getByTestId('territory-map')).toBeVisible({ timeout: 10000 })

    // Fail fast on runtime errors (ignore common offline/network noise)
    const serious = [...errors, ...pageErrors].filter((e) =>
      !e.includes('favicon')
      && !e.includes('404')
      && !e.includes('ERR_NAME_NOT_RESOLVED')
      && !e.includes('Failed to load resource')
      && !e.includes('[DB]')
      && !e.toLowerCase().includes('supabase')
    )
    expect(serious, serious.join('\n')).toHaveLength(0)
  })
})

