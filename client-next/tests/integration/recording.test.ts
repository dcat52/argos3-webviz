import { test, expect } from './fixtures'

test('record captures frames while playing', async ({ page }) => {
  // Start recording
  await page.click('[data-testid="record-btn"]')
  await page.click('[data-testid="play-btn"]')
  await page.waitForTimeout(2000)

  // Check frame count while still recording (element only exists in recording state)
  const frameText = await page.locator('[data-testid="frame-count"]').textContent()
  expect(frameText).toContain('frames')

  // Extract number from "⏺ 20 frames"
  const match = frameText?.match(/(\d+)/)
  expect(Number(match?.[1])).toBeGreaterThan(0)

  // Stop recording
  await page.click('[data-testid="stop-record-btn"]')
})
