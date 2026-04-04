import { defineConfig, devices } from '@playwright/test';

/**
 * E2E tests automatically start their own isolated dev server on different ports.
 */
const backendPort = process.env.PORT || '3001';
const frontendPort = process.env.VITE_PORT || '5174';
const apiOrigin = process.env.VITE_API_URL || `http://localhost:${backendPort}`;

process.env.PORT = backendPort;
process.env.VITE_PORT = frontendPort;
process.env.VITE_API_URL = apiOrigin;
process.env.VITE_API_BASE_URL = process.env.VITE_API_BASE_URL || `${apiOrigin}/api`;
process.env.DATABASE_URL = process.env.DATABASE_URL || 'file:./e2e.db';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'html',
  timeout: 30_000,

  use: {
    baseURL: `http://localhost:${frontendPort}`,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure'
  },

  webServer: {
    command: 'cd ../../ && pnpm build && pnpm start:e2e',
    url: `${apiOrigin}/api/docs`,
    timeout: 120 * 1000,
    reuseExistingServer: !process.env.CI
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
