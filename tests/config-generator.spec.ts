import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { devices, type TestInfo } from '@playwright/test';
import { test, expect } from './pages/fixtures';
import * as prettier from 'prettier';
import {
  BROWSERS,
  DEFAULT_OPTIONS,
  DEVICES,
  REPORTERS,
  TRACES,
  configNotes,
  generateConfig,
  installCommand,
  type ConfigOptions,
} from '../src/lib/config-generator';

const everything: ConfigOptions = {
  browsers: BROWSERS.map(({ name }) => name),
  devices: DEVICES.map(({ name }) => name),
  retriesCI: 3,
  retriesLocal: 1,
  reporters: REPORTERS.map(({ name }) => name),
  trace: 'retain-on-failure',
};
const samples: ConfigOptions[] = [
  DEFAULT_OPTIONS,
  everything,
  { ...DEFAULT_OPTIONS, browsers: [], devices: [], reporters: [] },
  { ...DEFAULT_OPTIONS, browsers: ['Google Chrome'], reporters: ['github'], retriesCI: 1, retriesLocal: 1 },
  { ...DEFAULT_OPTIONS, devices: ['iPhone 15'], reporters: ['github', 'html', 'junit'], trace: 'off' },
];

interface Probe {
  project: string;
  retries: number;
  trace: unknown;
  channel?: string;
  browser?: string;
  viewport?: unknown;
  reporters: string[];
}

const PROBE_SPEC = `
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from '@playwright/test';

test('probe', ({}, info) => {
  const { name, retries, use } = info.project;
  const probe = {
    project: name,
    retries,
    trace: use.trace,
    channel: use.channel,
    browser: use.defaultBrowserType,
    viewport: use.viewport,
    reporters: info.config.reporter.map(([reporter]) => reporter),
  };
  writeFileSync(join(process.env.PROBE_DIR, encodeURIComponent(name) + '.json'), JSON.stringify(probe));
});
`;

/** Runs a generated config with the real Playwright CLI and reports what each project actually received. */
function runConfig(code: string, testInfo: TestInfo, label: string, ci: boolean) {
  const root = testInfo.outputPath(label);
  const probes = join(root, 'probes');
  mkdirSync(join(root, 'tests'), { recursive: true });
  mkdirSync(probes);
  // Playwright puts test-results/ beside the nearest package.json and empties it, which must not be this repo's.
  writeFileSync(join(root, 'package.json'), '{}');
  writeFileSync(join(root, 'playwright.config.ts'), code);
  writeFileSync(join(root, 'tests', 'probe.spec.ts'), PROBE_SPEC);

  const env = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !/^(PW_|PLAYWRIGHT_|TEST_|CI$)/.test(key)),
  );
  const packageJson = createRequire(import.meta.url).resolve('@playwright/test/package.json');
  const run = spawnSync(process.execPath, [join(dirname(packageJson), 'cli.js'), 'test', '--workers=1'], {
    cwd: root,
    env: { ...env, PROBE_DIR: probes, ...(ci ? { CI: '1' } : {}) },
    encoding: 'utf8',
  });
  expect(run.status, `${run.stdout}\n${run.stderr}`).toBe(0);
  return readdirSync(probes).map((file) => JSON.parse(readFileSync(join(probes, file), 'utf8')) as Probe);
}

test.describe('generated config', () => {
  test.skip(
    ({ isMobile, browserName }) => isMobile || browserName !== 'chromium',
    'no browser involved, so one project is enough',
  );

  test('every offered device exists in Playwright', () => {
    for (const { device } of BROWSERS) expect(devices[device], device).toBeDefined();
    for (const { name, install } of DEVICES) {
      expect(devices[name], name).toBeDefined();
      expect(devices[name].defaultBrowserType, name).toBe(install);
    }
  });

  test('the output is already formatted', async () => {
    for (const options of samples) {
      const code = generateConfig(options);
      const formatted = await prettier.format(code, {
        parser: 'typescript',
        singleQuote: true,
        printWidth: 110,
      });
      expect(code).toBe(formatted);
    }
  });

  test('real Playwright applies every choice', async ({}, testInfo) => {
    test.slow();
    const code = generateConfig(everything);
    const reporterNames = REPORTERS.map(({ name }) => name);

    const onCI = runConfig(code, testInfo, 'ci', true);
    expect(onCI.map(({ project }) => project).toSorted()).toEqual(
      [...BROWSERS, ...DEVICES].map(({ name }) => name).toSorted(),
    );
    for (const probe of onCI) {
      expect(probe.retries).toBe(3);
      expect(probe.trace).toBe('retain-on-failure');
      expect(probe.reporters).toEqual(reporterNames);
    }
    const project = (name: string) => onCI.find((probe) => probe.project === name);
    expect(project('Google Chrome')?.channel).toBe('chrome');
    expect(project('Microsoft Edge')?.channel).toBe('msedge');
    expect(project('webkit')?.browser).toBe('webkit');
    expect(project('iPhone 15')?.browser).toBe('webkit');
    expect(project('Pixel 7')?.viewport).toEqual(devices['Pixel 7'].viewport);

    for (const probe of runConfig(code, testInfo, 'local', false)) {
      expect(probe.retries).toBe(1);
      expect(probe.reporters).toEqual(reporterNames.filter((name) => name !== 'github'));
    }
  });

  test('real Playwright accepts every trace mode', async ({}, testInfo) => {
    test.slow();
    for (const { name } of TRACES) {
      const code = generateConfig({ ...DEFAULT_OPTIONS, browsers: ['chromium'], trace: name });
      const [probe] = runConfig(code, testInfo, `trace-${name}`, false);
      expect(probe.trace).toBe(name);
    }
  });

  test('a config with nothing chosen still runs', async ({}, testInfo) => {
    const code = generateConfig({ ...DEFAULT_OPTIONS, browsers: [], devices: [], reporters: [] });
    expect(code).not.toContain('devices');
    expect(code).not.toContain('reporter:');
    expect(runConfig(code, testInfo, 'empty', false)).toHaveLength(1);
  });

  test('github alone falls back to list outside CI', async ({}, testInfo) => {
    const code = generateConfig({ ...DEFAULT_OPTIONS, browsers: ['chromium'], reporters: ['github'] });
    expect(runConfig(code, testInfo, 'github-ci', true)[0].reporters).toEqual(['github']);
    expect(runConfig(code, testInfo, 'github-local', false)[0].reporters).toEqual(['list']);
  });

  test('the install command lists each needed browser once', () => {
    const command = (options: Partial<ConfigOptions>) => installCommand({ ...DEFAULT_OPTIONS, ...options });
    expect(command({})).toBe('npx playwright install chromium firefox webkit');
    expect(command({ browsers: [], devices: ['Pixel 7', 'Galaxy S24'] })).toBe(
      'npx playwright install chromium',
    );
    expect(command({ browsers: ['Microsoft Edge'], devices: ['iPad Pro 11'] })).toBe(
      'npx playwright install webkit msedge',
    );
    expect(command({ browsers: [] })).toBe('npx playwright install chromium');
  });

  test('notes flag a trace mode that can never record', () => {
    const texts = (options: Partial<ConfigOptions>) =>
      configNotes({ ...DEFAULT_OPTIONS, ...options }).map(({ text }) => text);

    expect(texts({})).toEqual([]);
    expect(texts({ retriesCI: 0 })[0]).toContain('no trace is ever saved');
    expect(texts({ retriesCI: 0, retriesLocal: 2 })[0]).toContain('CI failures have no trace');
    expect(texts({ retriesCI: 0, trace: 'retain-on-failure' })).toEqual([]);
  });
});

test.describe('config generator page', () => {
  test.beforeEach(async ({ configGenerator }) => {
    await configGenerator.goto();
  });

  test('starts with a working default config', async ({ configGenerator, page }) => {
    await expect(configGenerator.h1Named('Config generator')).toBeVisible();
    await expect(page.getByText('copy the finished playwright.config.ts into')).toBeVisible();
    await expect(configGenerator.output).toHaveText(generateConfig(DEFAULT_OPTIONS));
    await expect(configGenerator.status).toHaveText('3 projects · 1 reporter · trace on-first-retry');
    await expect(page.getByText('npx playwright install chromium firefox webkit')).toBeVisible();
  });

  test('each choice updates the config', async ({ configGenerator }) => {
    const { output } = configGenerator;
    await configGenerator.checkbox('# browsers', 'firefox').uncheck();
    await expect(output).not.toContainText("name: 'firefox'");

    await configGenerator.checkbox('# devices', 'iPhone 15').check();
    await expect(output).toContainText("{ name: 'iPhone 15', use: { ...devices['iPhone 15'] } }");

    await configGenerator.select('on CI').selectOption('4');
    await configGenerator.select('locally').selectOption('1');
    await expect(output).toContainText('retries: process.env.CI ? 4 : 1,');

    await configGenerator.checkbox('# reporters', 'junit').check();
    await expect(output).toContainText("['junit', { outputFile: 'reports/junit.xml' }]");

    await configGenerator.radio('# trace', 'retain-on-failure').check();
    await expect(output).toContainText("trace: 'retain-on-failure',");

    await expect(output).toHaveText(
      generateConfig({
        browsers: ['chromium', 'webkit'],
        devices: ['iPhone 15'],
        retriesCI: 4,
        retriesLocal: 1,
        reporters: ['html', 'junit'],
        trace: 'retain-on-failure',
      }),
    );
    await expect(configGenerator.status).toHaveText('3 projects · 2 reporters · trace retain-on-failure');
  });

  test('warns when the trace setting can never record', async ({ configGenerator }) => {
    const { notes } = configGenerator;
    await expect(notes).toBeHidden();
    await configGenerator.select('on CI').selectOption('0');
    await expect(notes).toContainText('no trace is ever saved');
    await configGenerator.select('on CI').selectOption('1');
    await expect(notes).toBeHidden();
  });

  test('copies the config to the clipboard', async ({ configGenerator, page, context, browserName }) => {
    test.skip(browserName !== 'chromium', 'only Chromium lets a test grant clipboard access');
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await configGenerator.copyButton.click();
    await expect(configGenerator.status).toHaveText('config copied to clipboard');
    await expect(configGenerator.copiedButton).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(generateConfig(DEFAULT_OPTIONS));
  });

  test('downloads the config as playwright.config.ts', async ({ configGenerator }) => {
    const download = await configGenerator.download();
    expect(download.suggestedFilename()).toBe('playwright.config.ts');
    expect(readFileSync(await download.path(), 'utf8')).toBe(generateConfig(DEFAULT_OPTIONS));
  });

  test('fits a 375px page with every option on', async ({ configGenerator, page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    for (const { name } of REPORTERS) await configGenerator.checkbox('# reporters', name).check();
    await configGenerator.checkbox('# devices', 'iPhone 15 Pro Max').check();
    expect(await configGenerator.horizontalOverflow()).toBeLessThanOrEqual(0);
  });

  test.describe('accessibility', () => {
    test.skip(({ browserName }) => browserName === 'firefox', 'axe crashes the Firefox page on this island');
    test.use({ reducedMotion: 'reduce' });

    for (const theme of ['dark', 'light'] as const) {
      test(`no detectable a11y violations with notes showing in the ${theme} theme`, async ({
        configGenerator,
      }) => {
        await configGenerator.saveThemeAndReload(theme);
        await configGenerator.waitUntilReady();
        await configGenerator.select('on CI').selectOption('0');
        await configGenerator.checkbox('# reporters', 'html').uncheck();
        await expect(configGenerator.notes).toBeVisible();
        expect(await configGenerator.a11yViolations()).toEqual([]);
      });
    }
  });
});
