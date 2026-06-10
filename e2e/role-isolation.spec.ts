/**
 * e2e/role-isolation.spec.ts - Role switching isolation tests
 */

import { test, expect } from '@playwright/test'
import { AppPage } from './pages/AppPage'

test.describe('Role isolation', () => {
  test('[E2E-I1] Admin -> Sales -> Admin: app không crash', async ({ page }) => {
    const app = new AppPage(page)
    await app.goto()

    // Admin: chọn SA algo
    await app.algoSA.click()
    await expect(app.algoSA).toHaveAttribute('data-selected', 'true')

    // Switch sang Sales: algo panel biến mất
    await app.switchRole('sales')
    await expect(app.algoSA).not.toBeVisible()

    // Switch về Admin: run button vẫn có (không crash)
    await app.switchRole('admin')
    await expect(app.runButton).toBeVisible()
  })

  test('[E2E-I2] switch role 3 lần không có console error', async ({ page }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text())
    })

    const app = new AppPage(page)
    await app.goto()
    await app.switchRole('sales')
    await app.switchRole('coordinator')
    await app.switchRole('admin')
    await page.waitForTimeout(500)

    // Lọc bỏ các lỗi không nghiêm trọng (offline mode expected)
    const realErrors = errors.filter(
      (e) =>
        !e.includes('favicon') &&
        !e.includes('404') &&
        !e.toLowerCase().includes('warning') &&
        !e.includes('ERR_NAME_NOT_RESOLVED') &&
        !e.includes('Failed to load resource') &&
        !e.includes('[DB]') &&
        !e.toLowerCase().includes('supabase'),
    )
    expect(realErrors, `Console errors: ${realErrors.join('\n')}`).toHaveLength(0)
  })

  test('[E2E-I3] locale toggle vi -> en -> vi không crash', async ({ page }) => {
    const app = new AppPage(page)
    await app.goto()

    // Toggle to EN
    await app.localeToggle.click()
    await page.waitForTimeout(400)

    // Toggle back to VI
    await app.localeToggle.click()
    await page.waitForTimeout(400)

    // App vẫn functional - logo vẫn hiển thị
    await expect(page.getByTestId('logo')).toBeVisible()
    // Map vẫn hiển thị
    await expect(app.mapContainer).toBeVisible()
  })

  test('[E2E-I4] toàn bộ 3 roles: sidebar luôn visible', async ({ page }) => {
    const app = new AppPage(page)
    await app.goto()

    // Admin
    await expect(app.sidebar).toBeVisible()

    // Coordinator
    await app.switchRole('coordinator')
    await expect(app.sidebar).toBeVisible()

    // Sales
    await app.switchRole('sales')
    await expect(app.sidebar).toBeVisible()
  })
})
