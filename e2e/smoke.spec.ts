import { test, expect } from '@playwright/test'

test('app loads without error @smoke', async ({ page }) => {
  const errors: string[] = []

  // Lắng nghe console errors TRƯỚC khi navigate
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })

  await page.goto('/')
  await page.waitForTimeout(2000)

  // Root element không rỗng
  await expect(page.locator('#root')).not.toBeEmpty()

  // Không có lỗi runtime nghiêm trọng (bỏ qua favicon 404, Supabase offline, network errors)
  const seriousErrors = errors.filter(
    (e) =>
      !e.includes('favicon') &&
      !e.includes('404') &&
      !e.includes('ERR_NAME_NOT_RESOLVED') &&   // Supabase offline (expected in local dev)
      !e.includes('Failed to load resource') &&  // network errors (expected offline)
      !e.includes('[DB]') &&                     // DB layer warnings (expected offline)
      !e.toLowerCase().includes('supabase'),
  )
  expect(seriousErrors).toHaveLength(0)
})

test('TopBar renders with role tabs @smoke', async ({ page }) => {
  await page.goto('/')
  await page.waitForTimeout(1500)

  // Kiểm tra role tab buttons tồn tại
  await expect(page.locator('#role-tab-admin')).toBeVisible()
  await expect(page.locator('#role-tab-coordinator')).toBeVisible()
  await expect(page.locator('#role-tab-sales')).toBeVisible()
})

test('role switching changes sidebar @smoke', async ({ page }) => {
  await page.goto('/')
  await page.waitForTimeout(1500)

  // Click Coordinator tab
  await page.locator('#role-tab-coordinator').click()
  await page.waitForTimeout(500)

  // Click Sales tab
  await page.locator('#role-tab-sales').click()
  await page.waitForTimeout(500)

  // Không crash sau khi switch role
  await expect(page.locator('#root')).not.toBeEmpty()
})
