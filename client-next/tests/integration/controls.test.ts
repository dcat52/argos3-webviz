import { test, expect } from './fixtures'

test('play increases step counter', async ({ page }) => {
  await page.click('[data-testid="play-btn"]')
  await expect(async () => {
    const steps = Number(await page.locator('[data-testid="step-counter"]').textContent())
    expect(steps).toBeGreaterThan(0)
  }).toPass({ timeout: 15000 })
})

test('pause stops step counter', async ({ page }) => {
  await page.click('[data-testid="play-btn"]')
  await expect(async () => {
    const s = Number(await page.locator('[data-testid="step-counter"]').textContent())
    expect(s).toBeGreaterThan(0)
  }).toPass({ timeout: 15000 })

  // Toggle pause, then poll until counter stabilizes
  await page.click('[data-testid="play-btn"]')
  await expect(async () => {
    const a = Number(await page.locator('[data-testid="step-counter"]').textContent())
    await page.waitForTimeout(500)
    const b = Number(await page.locator('[data-testid="step-counter"]').textContent())
    expect(b).toBe(a)
  }).toPass({ timeout: 15000 })
})

test('step increments counter', async ({ page }) => {
  const before = Number(await page.locator('[data-testid="step-counter"]').textContent())
  await page.click('[data-testid="step-btn"]')
  await expect(async () => {
    const after = Number(await page.locator('[data-testid="step-counter"]').textContent())
    expect(after).toBeGreaterThan(before)
  }).toPass({ timeout: 5000 })
})

test('reset returns to step 0', async ({ page }) => {
  await page.click('[data-testid="play-btn"]')
  await expect(async () => {
    const s = Number(await page.locator('[data-testid="step-counter"]').textContent())
    expect(s).toBeGreaterThan(0)
  }).toPass({ timeout: 15000 })

  await page.click('[data-testid="reset-btn"]')
  await expect(page.locator('[data-testid="step-counter"]')).toHaveText('0', { timeout: 5000 })
})
