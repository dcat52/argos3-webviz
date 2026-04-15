import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'tests/integration',
  timeout: 60000,
  retries: 1,
  use: {
    baseURL: 'http://localhost:5173',
    headless: true,
  },
  webServer: [
    {
      command: 'npx tsx src/mock/server.ts swarm',
      port: 3000,
      reuseExistingServer: true,
    },
    {
      command: 'npx vite --port 5173',
      port: 5173,
      reuseExistingServer: true,
    },
  ],
})
