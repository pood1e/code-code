import { defineConfig, devices } from '@playwright/test';

/**
 * E2E tests automatically start their own isolated dev server on different ports.
 */
process.env.PORT = '3001';
process.env.VITE_PORT = '5174';
process.env.VITE_API_URL = 'http://localhost:3001';
process.env.DATABASE_URL = 'file:./e2e.db';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'html',
  timeout: 30_000,

  use: {
    baseURL: 'http://localhost:5174',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure'
  },

  webServer: {
    command: 'cd ../../ && pnpm build && pnpm start:e2e',
    url: 'http://localhost:3001/api/docs',
    timeout: 120 * 1000
  },

  projects: [
    {
      name: 'Desktop Chrome',
      use: { ...devices['Desktop Chrome'] }
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] }
    },
    {
      name: 'Dark Mode',
      use: {
        ...devices['Desktop Chrome'],
        colorScheme: 'dark'
      }
    }
  ]
});
