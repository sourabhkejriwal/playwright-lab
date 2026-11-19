import { defineConfig, devices } from '@playwright/test';
import { appConfig, timeouts } from './tests/config/app';

const isCI = !!process.env.CI;
const serve = `node scripts/serve-dist.mjs ${appConfig.port}`;

// Tests run against the production build (astro preview), not the dev server,
// so what we test is what we deploy.
export default defineConfig({
  testDir: './tests',
  timeout: timeouts.test,
  // No limit locally (0), where a run can sit at a debugger.
  globalTimeout: isCI ? timeouts.ciRun : 0,
  expect: {
    timeout: timeouts.expect,
    toPass: { timeout: timeouts.toPass },
  },
  fullyParallel: true,
  forbidOnly: isCI,
  failOnFlakyTests: isCI,
  retries: isCI ? 2 : 0,
  // Locally, 75% of cores: Playwright's default of half took 8.5 minutes where this takes about 7.
  // At 100% two timing-sensitive tests (playground highlight colors, Firefox download) failed under load.
  workers: isCI ? 2 : '75%',
  reporter: isCI
    ? [['github'], ['list'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: appConfig.baseUrl,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    actionTimeout: timeouts.action,
    navigationTimeout: timeouts.navigation,
    launchOptions: { timeout: timeouts.browserLaunch },
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: {
    // Not `astro preview`: see scripts/serve-dist.mjs for why.
    // TEST_PREBUILT tests the release CI already built, so the deployed files are the tested ones.
    command: process.env.TEST_PREBUILT ? serve : `pnpm build && ${serve}`,
    url: `${appConfig.baseUrl}${appConfig.basePath}/`,
    reuseExistingServer: !isCI,
    timeout: timeouts.webServer,
  },
});
