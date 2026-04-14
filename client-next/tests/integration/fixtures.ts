import { test as base, expect } from '@playwright/test'

export const test = base.extend<{ connected: void }>({
  connected: [async ({ page }, use) => {
    await page.goto('/')
    // Wait for WebSocket connection
    await expect(page.locator('[data-testid="connection-status"]')).toHaveText('connected', { timeout: 10000 })
    await use()
  }, { auto: true }],
})

export { expect }
