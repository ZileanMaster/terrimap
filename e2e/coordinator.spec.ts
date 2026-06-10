/**
 * e2e/coordinator.spec.ts - Coordinator role E2E tests
 * Scenario: Team overview workflow.
 */

import { test, expect } from '@playwright/test'
import { AppPage } from './pages/AppPage'

test.describe('Coordinator - Team overview', () => {
  test('[E2E-C1] switch sang Coordinator -> team-overview xuất hiện', async ({ page }) => {
    const app = new AppPage(page)
    await app.goto()
    await app.switchRole('coordinator')

    await expect(app.sidebar).toBeVisible()
    await expect(app.teamOverview).toBeVisible()
  })

  test('[E2E-C2] Coordinator KHÔNG thấy create-version button (Admin only)',
    async ({ page }) => {
    const app = new AppPage(page)
    await app.goto()
    await app.switchRole('coordinator')

    // btn-create-snapshot chỉ render trong AdminSidebar
    await expect(app.createSnapshotBtn).not.toBeVisible()
  })

  test('[E2E-C3] Coordinator vẫn thấy map sau khi Admin chạy algo', async ({ page }) => {
    const app = new AppPage(page)
    await app.goto()

    // Admin runs algo
    await app.algoGreedy.click()
    await app.runButton.click()
    await app.waitForResult()

    // Switch sang Coordinator
    await app.switchRole('coordinator')

    // Map vẫn visible
    await expect(app.mapContainer).toBeVisible()
    // Team overview visible
    await expect(app.teamOverview).toBeVisible()
  })

  test('[E2E-C4] Coordinator layout: sidebar visible, map visible, NO algorithm panel',
    async ({ page }) => {
    const app = new AppPage(page)
    await app.goto()
    await app.switchRole('coordinator')

    // Coordinator: Sidebar + Map (no RightPanel)
    await expect(app.sidebar).toBeVisible()
    await expect(app.mapContainer).toBeVisible()

    // RightPanel retorna null para 'sales', e para 'coordinator' não existe na CoordinatorPage
    await expect(app.runButton).not.toBeVisible()
  })
})
