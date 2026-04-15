import { test, expect } from './fixtures'

test('play increases step counter', async ({ page }) => {
  const initial = Number(await page.locator('[data-testid="step-counter"]').textContent())
  await page.click('[data-testid="play-btn"]')
  // Poll until step counter advances — no fixed timeout
  await expect(async () => {
    const steps = Number(await page.locator('[data-testid="step-counter"]').textContent())
    expect(steps).toBeGreaterThan(initial)
  }).toPass({ timeout: 10000 })
})

test('pause stops step counter', async ({ page }) => {
  await page.click('[data-testid="play-btn"]')
  // Wait for some steps to accumulate
  await expect(async () => {
    const s = Number(await page.locator('[data-testid="step-counter"]').textContent())
    expect(s).toBeGreaterThan(0)
  }).toPass({ timeout: 10000 })

  await page.click('[data-testid="pause-btn"]')
  // Give server time to process pause before reading
  await page.waitForTimeout(500)
  const stepsA = Number(await page.locator('[data-testid="step-counter"]').textContent())
  await page.waitForTimeout(2000)
  const stepsB = Number(await page.locator('[data-testid="step-counter"]').textContent())
  expect(stepsB).toBe(stepsA)
})

test('step increments by 1', async ({ page }) => {
  await page.click('[data-testid="reset-btn"]')
  await page.waitForTimeout(500)
  await page.click('[data-testid="pause-btn"]')
  // Wait for pause to take effect
  await page.waitForTimeout(500)

  const before = Number(await page.locator('[data-testid="step-counter"]').textContent())
  await page.click('[data-testid="step-btn"]')
  await expect(async () => {
    const after = Number(await page.locator('[data-testid="step-counter"]').textContent())
    expect(after).toBe(before + 1)
  }).toPass({ timeout: 5000 })
})

test('reset returns to step 0', async ({ page }) => {
  await page.click('[data-testid="play-btn"]')
  await expect(async () => {
    const s = Number(await page.locator('[data-testid="step-counter"]').textContent())
    expect(s).toBeGreaterThan(0)
  }).toPass({ timeout: 10000 })

  await page.click('[data-testid="reset-btn"]')
  await expect(page.locator('[data-testid="step-counter"]')).toHaveText('0', { timeout: 5000 })
})

test('fast forward advances faster than play', async ({ page }) => {
  // Measure normal play rate
  await page.click('[data-testid="reset-btn"]')
  await expect(page.locator('[data-testid="step-counter"]')).toHaveText('0', { timeout: 5000 })
  await page.click('[data-testid="play-btn"]')
  await page.waitForTimeout(3000)
  await page.click('[data-testid="pause-btn"]')
  await page.waitForTimeout(500)
  const normalSteps = Number(await page.locator('[data-testid="step-counter"]').textContent())

  // Reset and measure FF rate
  await page.click('[data-testid="reset-btn"]')
  await expect(page.locator('[data-testid="step-counter"]')).toHaveText('0', { timeout: 5000 })
  await page.click('[data-testid="ff-btn"]')
  await page.waitForTimeout(3000)
  await page.click('[data-testid="pause-btn"]')
  await page.waitForTimeout(500)
  const ffSteps = Number(await page.locator('[data-testid="step-counter"]').textContent())

  expect(ffSteps).toBeGreaterThan(normalSteps * 2)
})
