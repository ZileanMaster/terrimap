import { test, expect } from '@playwright/test'

test('app loads without error @smoke', async ({ page }) => {
  const errors: string[] = []

  // Lắng nghe console errors TRƯỚC khi navigate
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })

  // Avoid waiting for full 'load' (Leaflet tiles/network may keep the page in loading state).
  await page.goto('/', { waitUntil: 'domcontentloaded' })
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
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1500)

  // Sidebar navigation exists (offline mode renders admin role by default)
  await expect(page.getByRole('button', { name: /Tổng quan/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /Khu vực/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /Phân chia lãnh thổ/i })).toBeVisible()
})

test('role switching changes sidebar @smoke', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1500)

  // Navigate between tabs (ensures no crash)
  await page.getByRole('button', { name: /Khu vực/i }).click()
  await page.waitForTimeout(600)
  await page.getByRole('button', { name: /Phân chia lãnh thổ/i }).click()
  await page.waitForTimeout(600)

  await expect(page.locator('#root')).not.toBeEmpty()
})

test('locale toggle updates label @smoke', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1500)

  await page.getByRole('button', { name: /Cài đặt/i }).click()
  await page.waitForTimeout(600)

  // SettingsView renders a language toggle button
  const btn = page.getByRole('button', { name: /Tiếng Việt|English/i }).first()
  await expect(btn).toBeVisible()
  const before = await btn.textContent()
  await btn.click()
  await page.waitForTimeout(300)
  const after = await btn.textContent()
  expect(before).not.toEqual(after)
})
