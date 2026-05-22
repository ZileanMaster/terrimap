/**
 * e2e/admin.spec.ts — Admin role E2E tests
 * Scenario: Algorithm selection và execution flow.
 */

import { test, expect } from '@playwright/test'
import { AppPage } from './pages/AppPage'

test.describe('Admin — Algorithm flow', () => {
  test('[E2E-A1] app load: logo và map hiển thị', async ({ page }) => {
    const app = new AppPage(page)
    await app.goto()

    // Logo container với hex symbol
    await expect(page.getByTestId('logo')).toBeVisible()
    // Hex symbol ⬡
    await expect(app.logoHex).toContainText('⬡')
    // Map container
    await expect(app.mapContainer).toBeVisible()
  })

  test('[E2E-A2] Admin mặc định: thấy right panel thuật toán', async ({ page }) => {
    const app = new AppPage(page)
    await app.goto()

    // Default role là admin → all 3 algo cards visible
    await expect(app.algoGreedy).toBeVisible()
    await expect(app.algoLocalSearch).toBeVisible()
    await expect(app.algoSA).toBeVisible()
    await expect(app.runButton).toBeVisible()
  })

  test('[E2E-A3] Local Search card hiển thị', async ({ page }) => {
    const app = new AppPage(page)
    await app.goto()

    // Local Search card visible
    await expect(app.algoLocalSearch).toBeVisible()
  })

  test('[E2E-A4] chọn Local Search → card được highlight (data-selected=true)',
    async ({ page }) => {
    const app = new AppPage(page)
    await app.goto()

    // Ban đầu local-search mặc định selected
    // Click greedy trước để unselect
    await app.algoGreedy.click()
    await expect(app.algoGreedy).toHaveAttribute('data-selected', 'true')

    // Click local-search
    await app.algoLocalSearch.click()
    await expect(app.algoLocalSearch).toHaveAttribute('data-selected', 'true')
    await expect(app.algoGreedy).toHaveAttribute('data-selected', 'false')
    await expect(app.algoSA).toHaveAttribute('data-selected', 'false')
  })

  test('[E2E-A5] run greedy → progress hoặc result xuất hiện', async ({ page }) => {
    const app = new AppPage(page)
    await app.goto()

    await app.algoGreedy.click()
    await app.runButton.click()

    // Run button bị disabled khi đang chạy hoặc xuất hiện result
    // Greedy rất nhanh — có thể đã xong trước khi check
    await expect(app.resultMetrics).toBeVisible({ timeout: 15000 })

    // Sau khi xong, run button enabled trở lại
    await expect(app.runButton).toBeEnabled({ timeout: 5000 })
  })

  test('[E2E-A6] result metrics sau Greedy: balanceScore + label xuất hiện', async ({ page }) => {
    const app = new AppPage(page)
    await app.goto()

    await app.algoGreedy.click()
    await app.runButton.click()
    await app.waitForResult()

    // result-metrics div tồn tại (đã được check bởi waitForResult)
    await expect(app.resultMetrics).toBeVisible()

    // "Điểm cân bằng" label luôn xuất hiện bên trong result-metrics
    const metricsSection = app.resultMetrics
    await expect(metricsSection.getByText('Điểm cân bằng')).toBeVisible()

    // Một trong 3 balance quality labels phải xuất hiện
    const labels = ['Tốt', 'Trung bình', 'Thấp — nên dùng SA']
    const visibleLabels = await Promise.all(
      labels.map((l) =>
        metricsSection.getByText(l).isVisible().catch(() => false),
      ),
    )
    expect(
      visibleLabels.some(Boolean),
      `Không thấy balance label nào trong: ${labels.join(', ')}`,
    ).toBe(true)
  })

  test('[E2E-A7] dark mode toggle: click dark → html class dark', async ({ page }) => {
    const app = new AppPage(page)
    await app.goto()

    // Click dark theme button
    await app.themeDark.click()
    await page.waitForTimeout(300)
    await expect(page.locator('html')).toHaveClass(/dark/)

    // Click light theme button
    await app.themeLight.click()
    await page.waitForTimeout(300)
    await expect(page.locator('html')).not.toHaveClass(/dark/)
  })
})
