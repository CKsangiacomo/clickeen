import { defineConfig, devices, type PlaywrightTestConfig } from '@playwright/test';

const port = Number(process.env.CK_VENICE_RUNTIME_PORT || 3917);
const baseURL = process.env.CK_VENICE_RUNTIME_BASE_URL || `http://127.0.0.1:${port}`;
const tokyoURL = process.env.TOKYO_URL || process.env.NEXT_PUBLIC_TOKYO_URL || 'https://tokyo.dev.clickeen.com';

const projects: PlaywrightTestConfig['projects'] = [
  {
    name: 'chromium-desktop',
    use: { ...devices['Desktop Chrome'] },
  },
  {
    name: 'firefox-desktop',
    use: { ...devices['Desktop Firefox'] },
  },
  {
    name: 'android-chrome',
    use: { ...devices['Pixel 7'] },
  },
];

if (process.env.CK_VENICE_INCLUDE_WEBKIT === '1') {
  projects.push(
    {
      name: 'webkit-desktop',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'ios-safari',
      use: { ...devices['iPhone 15'] },
    },
  );
}

if (process.env.CK_VENICE_INCLUDE_MSEDGE === '1') {
  projects.push({
    name: 'edge-desktop',
    use: { ...devices['Desktop Edge'], channel: 'msedge' },
  });
}

export default defineConfig({
  testDir: './tests/runtime',
  timeout: 30_000,
  expect: { timeout: 12_000 },
  fullyParallel: false,
  reporter: [['list']],
  use: {
    baseURL,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `TOKYO_URL=${tokyoURL} NEXT_PUBLIC_TOKYO_URL=${tokyoURL} corepack pnpm exec next dev -p ${port}`,
    url: `${baseURL}/embed/v2.0.0/loader.js`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects,
});
