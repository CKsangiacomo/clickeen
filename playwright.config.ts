import { defineConfig, devices } from '@playwright/test';

const romaBaseURL = process.env.E2E_ROMA_URL || process.env.E2E_BASE_URL || 'https://roma.dev.clickeen.com';
const authStatePath = process.env.E2E_AUTH_STATE || 'e2e/.auth/roma-dev.json';

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  timeout: 45_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  // Remote e2e mutates shared account/widget state; parallel workers make certification nondeterministic.
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['line'], ['html', { open: 'never' }]] : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: romaBaseURL,
    storageState: authStatePath,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],
});
