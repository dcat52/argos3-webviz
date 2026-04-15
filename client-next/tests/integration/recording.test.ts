import { test, expect } from './fixtures'

test('record captures frames while playing', async ({ page }) => {
  await page.click('[data-testid="record-btn"]')
  await page.click('[data-testid="play-btn"]')

  // Poll until frame count shows captured frames
  await expect(async () => {
    const frameText = await page.locator('[data-testid="frame-count"]').textContent()
    const match = frameText?.match(/(\d+)/)
    expect(Number(match?.[1])).toBeGreaterThan(0)
  }).toPass({ timeout: 15000 })

  await page.click('[data-testid="stop-record-btn"]')
})
