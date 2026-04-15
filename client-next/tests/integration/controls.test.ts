import { test, expect } from './fixtures'

test('play increases step counter', async ({ page }) => {
  await page.click('[data-testid="play-btn"]')
  await page.waitForTimeout(1500)
  const steps = await page.locator('[data-testid="step-counter"]').textContent()
  expect(Number(steps)).toBeGreaterThan(0)
})

test('pause stops step counter', async ({ page }) => {
  await page.click('[data-testid="play-btn"]')
  await page.waitForTimeout(1000)
  await page.click('[data-testid="pause-btn"]')
  const stepsA = await page.locator('[data-testid="step-counter"]').textContent()
  await page.waitForTimeout(1000)
  const stepsB = await page.locator('[data-testid="step-counter"]').textContent()
  expect(stepsA).toBe(stepsB)
})

test('step increments by 1', async ({ page }) => {
  // Reset to known state first
  await page.click('[data-testid="reset-btn"]')
  await page.waitForTimeout(500)
  // Pause to stop auto-broadcasting step increments
  await page.click('[data-testid="pause-btn"]')
  await page.waitForTimeout(300)

  const before = Number(await page.locator('[data-testid="step-counter"]').textContent())
  await page.click('[data-testid="step-btn"]')
  await page.waitForTimeout(300)
  const after = Number(await page.locator('[data-testid="step-counter"]').textContent())
  expect(after).toBe(before + 1)
})

test('reset returns to step 0', async ({ page }) => {
  await page.click('[data-testid="play-btn"]')
  await page.waitForTimeout(1000)
  await page.click('[data-testid="reset-btn"]')
  await page.waitForTimeout(500)
  const steps = await page.locator('[data-testid="step-counter"]').textContent()
  expect(Number(steps)).toBe(0)
})

test('fast forward advances faster than play', async ({ page }) => {
  // Measure normal play rate
  await page.click('[data-testid="reset-btn"]')
  await page.waitForTimeout(500)
  await page.click('[data-testid="play-btn"]')
  await page.waitForTimeout(2000)
  await page.click('[data-testid="pause-btn"]')
  await page.waitForTimeout(200)
  const normalSteps = Number(await page.locator('[data-testid="step-counter"]').textContent())

  // Reset and measure FF rate
  await page.click('[data-testid="reset-btn"]')
  await page.waitForTimeout(500)
  await page.click('[data-testid="ff-btn"]')
  await page.waitForTimeout(2000)
  await page.click('[data-testid="pause-btn"]')
  await page.waitForTimeout(200)
  const ffSteps = Number(await page.locator('[data-testid="step-counter"]').textContent())

  expect(ffSteps).toBeGreaterThan(normalSteps * 2)
})
