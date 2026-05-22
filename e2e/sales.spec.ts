/**
 * e2e/sales.spec.ts — Sales role E2E tests
 * Scenario: Read-only district view.
 */

import { test, expect } from '@playwright/test'
import { AppPage } from './pages/AppPage'

test.describe('Sales — Read-only district view', () => {
  test('[E2E-S1] switch sang Sales → sidebar hiển thị', async ({ page }) => {
    const app = new AppPage(page)
    await app.goto()
    await app.switchRole('sales')

    await expect(app.sidebar).toBeVisible()
  })

  test('[E2E-S2] Sales KHÔNG thấy algorithm panel', async ({ page }) => {
    const app = new AppPage(page)
    await app.goto()
    await app.switchRole('sales')

    // RightPanel trả về null khi role='sales'
    await expect(app.runButton).not.toBeVisible()
    await expect(app.algoLocalSearch).not.toBeVisible()
    await expect(app.algoGreedy).not.toBeVisible()
  })

  test('[E2E-S3] Sales thấy map (không có nút gán zone)', async ({ page }) => {
    const app = new AppPage(page)
    await app.goto()
    await app.switchRole('sales')

    // Map vẫn hiển thị
    await expect(app.mapContainer).toBeVisible()

    // Không có assign-zone-btn (coordinator-only feature)
    await expect(page.getByTestId('assign-zone-btn')).not.toBeVisible()
  })

  test('[E2E-S4] Sales sidebar có forecast widget (order-forecast)', async ({ page }) => {
    const app = new AppPage(page)
    await app.goto()
    await app.switchRole('sales')

    await expect(app.orderForecast).toBeVisible()
  })
})
