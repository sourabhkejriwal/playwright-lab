import { defineConfig, devices } from '@playwright/test';
import { appConfig, timeouts } from './config/app';

const isCI = !!process.env.CI;

// Tests run against the production build (astro preview), not the dev server,
// so what we test is what we deploy.
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 2 : undefined,
  reporter: isCI ? [['github'], ['html', { open: 'never' }]] : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: appConfig.baseUrl,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    actionTimeout: timeouts.action,
    navigationTimeout: timeouts.navigation,
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: {
    // Not `astro preview`: see scripts/serve-dist.mjs for why.
    command: `pnpm build && node scripts/serve-dist.mjs ${appConfig.port}`,
    url: appConfig.baseUrl,
    reuseExistingServer: !isCI,
    timeout: timeouts.webServer,
  },
});
