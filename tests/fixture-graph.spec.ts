import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { test, expect, type Page, type TestInfo } from '@playwright/test';
import {
  SCENARIOS,
  SCOPE_ERROR,
  buildSteps,
  expectedOutput,
  fixturesSource,
  specFiles,
  specSource,
} from '../src/lib/fixture-graph';

// Records each line with the worker that printed it, without changing the code the page shows.
const RECORDER = `import { appendFileSync } from 'node:fs';
const console = {
  log: (line: string) =>
    appendFileSync(process.env.TRACE_FILE!, process.env.TEST_WORKER_INDEX + '\\t' + line + '\\n'),
};
`;

/** Runs the files on the real Playwright CLI and returns what each worker printed. */
function runPlaywright(files: Record<string, string>, workers: number, testInfo: TestInfo, label: string) {
  const root = testInfo.outputPath(label);
  mkdirSync(root, { recursive: true });
  // Playwright puts test-results/ beside the nearest package.json and empties it, which must not be this repo's.
  writeFileSync(join(root, 'package.json'), '{}');
  for (const [name, code] of Object.entries(files)) writeFileSync(join(root, name), code);

  const trace = join(root, 'trace.log');
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !/^(PW_|PLAYWRIGHT_|TEST_|CI$)/.test(key)),
  );
  const packageJson = createRequire(import.meta.url).resolve('@playwright/test/package.json');
  const run = spawnSync(
    process.execPath,
    [join(dirname(packageJson), 'cli.js'), 'test', `--workers=${workers}`, '--reporter=line'],
    { cwd: root, env: { ...env, TRACE_FILE: trace }, encoding: 'utf8' },
  );

  const printed = new Map<string, string[]>();
  const rows = existsSync(trace) ? readFileSync(trace, 'utf8').trim().split('\n') : [];
  for (const row of rows) {
    const [worker, line] = row.split('\t');
    printed.set(worker, [...(printed.get(worker) ?? []), line]);
  }
  return { status: run.status, log: `${run.stdout}\n${run.stderr}`, printed: [...printed.values()] };
}

// Parallel workers can start in either order, so compare them as a set.
const unordered = (workers: string[][]) => workers.map((lines) => lines.join('\n')).toSorted();

test.describe('the explainer matches real Playwright', () => {
  test.skip(({ isMobile }) => isMobile, 'no browser involved, so one project is enough');

  for (const scenario of SCENARIOS) {
    test(`"${scenario.label}" prints what the explainer shows`, ({}, testInfo) => {
      const files: Record<string, string> = { 'fixtures.ts': fixturesSource(scenario) };
      for (const file of specFiles(scenario)) files[file] = specSource(scenario, file);
      const recorded = Object.fromEntries(
        Object.entries(files).map(([name, code]) => [name, `${RECORDER}${code}`]),
      );

      const { status, log, printed } = runPlaywright(recorded, scenario.workers, testInfo, scenario.id);

      const fails = scenario.tests.some(({ fails }) => fails);
      expect(status, log).toBe(fails ? 1 : 0);
      expect(unordered(printed), log).toEqual(unordered(expectedOutput(scenario)));
    });
  }

  test('a worker fixture cannot depend on a test fixture', ({}, testInfo) => {
    const { status, log } = runPlaywright(
      {
        'fixtures.ts': `import { test as base } from '@playwright/test';
export const test = base.extend<{ user: string }, { server: string }>({
  user: async ({}, use) => { await use('user'); },
  // @ts-expect-error the rule being tested
  server: [async ({ user }, use) => { await use(user); }, { scope: 'worker' }],
});
`,
        'scope.spec.ts': `import { test } from './fixtures';
test('uses the server', async ({ server }) => {});
`,
      },
      1,
      testInfo,
      'scope-rule',
    );
    expect(status).toBe(1);
    expect(log).toContain(SCOPE_ERROR);
  });
});

test.describe('the fixture graph page', () => {
  const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
  const row = (page: Page, worker: number, name: string) =>
    page
      .getByRole('list', { name: `worker ${worker} lifetimes` })
      .getByRole('listitem')
      .filter({ hasText: name });
  const goToStep = (page: Page, title: RegExp) => page.getByRole('button', { name: title }).click();

  test.beforeEach(async ({ page }) => {
    await page.goto('/fixture-graph');
    await button(page, 'next').scrollIntoViewIfNeeded();
    await expect(button(page, 'next')).toBeEnabled();
  });

  test('steps through a dependency chain in order', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1, name: 'Fixture graph' })).toBeVisible();
    await expect(button(page, 'back')).toBeDisabled();

    await button(page, 'next').click();
    await expect(page.getByRole('heading', { level: 2, name: 'setup db' })).toBeVisible();
    await expect(page.getByRole('status')).toContainText('user depends on it');
    await expect(row(page, 0, 'db')).toContainText('setting up');

    await button(page, 'next').click();
    await expect(row(page, 0, 'db')).toContainText('ready');
    await expect(row(page, 0, 'user')).toContainText('setting up');
    await expect(page.getByRole('region', { name: 'Console output', exact: true })).toHaveText(
      'setup dbsetup user',
    );
  });

  test('walking to the end prints the whole run', async ({ page }) => {
    const scenario = SCENARIOS.find(({ id }) => id === 'chain')!;
    const steps = buildSteps(scenario);
    for (let at = 1; at < steps.length; at += 1) await button(page, 'next').click();

    await expect(button(page, 'next')).toBeDisabled();
    await expect(page.getByRole('heading', { level: 2, name: 'worker 0 stops' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Console output', exact: true })).toHaveText(
      expectedOutput(scenario)[0].join(''),
    );
    await expect(row(page, 0, 'cart')).toContainText('created 2×');
  });

  test('a worker fixture is created once while test fixtures repeat', async ({ page }) => {
    await page.getByLabel('scenario').selectOption({ label: 'shared by a worker' });
    await goToStep(page, /\. worker 0 stops/);

    await expect(row(page, 0, 'server')).toContainText('created 1×');
    await expect(row(page, 0, 'api')).toContainText('created 3×');
    await expect(page.getByRole('region', { name: 'fixtures.ts' })).toContainText("scope: 'worker'");
  });

  test('an auto fixture runs for a test that never asks for it', async ({ page }) => {
    await page.getByLabel('scenario').selectOption({ label: 'auto fixtures' });
    await goToStep(page, /\. worker 0 stops/);

    await expect(row(page, 0, 'consoleGuard')).toContainText('created 2×');
    await expect(row(page, 0, 'user')).toContainText('created 1×');
  });

  test('each of two workers creates its own worker fixture', async ({ page }) => {
    await page.getByLabel('scenario').selectOption({ label: 'two workers' });
    await goToStep(page, /\. worker 1 stops/);

    await expect(row(page, 0, 'server')).toContainText('created 1×');
    await expect(row(page, 1, 'server')).toContainText('created 1×');
    await expect(page.getByRole('region', { name: 'search.spec.ts' })).toContainText('finds a product');
  });

  test('a failed test restarts the worker', async ({ page }) => {
    await page.getByLabel('scenario').selectOption({ label: 'a test fails' });

    await goToStep(page, /\. run loses an order/);
    await expect(page.getByText('failed', { exact: true })).toBeVisible();

    await goToStep(page, /\. worker 1 starts/);
    await expect(page.getByRole('status')).toContainText('new process');

    await goToStep(page, /\. worker 1 stops/);
    await expect(row(page, 0, 'server')).toContainText('created 1×');
    await expect(row(page, 1, 'server')).toContainText('created 1×');
  });

  test('changing scenario starts again from the first step', async ({ page }) => {
    await button(page, 'next').click();
    await page.getByLabel('scenario').selectOption({ label: 'auto fixtures' });

    await expect(page.getByRole('button', { name: '1. worker 0 starts' })).toHaveAttribute(
      'aria-current',
      'step',
    );
    await expect(page.getByRole('region', { name: 'Console output', exact: true })).toHaveText('');
  });

  test('the run order keeps the current step fully in view', async ({ page }) => {
    await page.getByLabel('scenario').selectOption({ label: 'a test fails' });
    const steps = buildSteps(SCENARIOS.find(({ id }) => id === 'failure')!);
    for (let at = 1; at < steps.length; at += 1) await button(page, 'next').click();

    const current = page.locator('[aria-current="step"]');
    await expect(current).toContainText('worker 1 stops');
    const clipped = await current.evaluate((element) => {
      const box = element.getBoundingClientRect();
      const list = element.closest('ol')!.getBoundingClientRect();
      return box.top < list.top || box.bottom > list.bottom + 1;
    });
    expect(clipped).toBe(false);
  });

  test('play advances on its own and pause stops it', async ({ page }) => {
    await button(page, 'play').click();
    await expect(page.getByRole('button', { name: '2. setup db' })).toHaveAttribute('aria-current', 'step');
    await button(page, 'pause').click();
    await expect(button(page, 'play')).toBeVisible();
  });

  test('fits a 375px page in the widest scenario', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.getByLabel('scenario').selectOption({ label: 'auto fixtures' });
    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
  });
});
