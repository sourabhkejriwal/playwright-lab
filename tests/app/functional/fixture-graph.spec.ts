import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import type { TestInfo } from '@playwright/test';
import { test, expect } from '../../../fixtures/pom/test-options';
import {
  SCENARIOS,
  SCOPE_ERROR,
  buildSteps,
  expectedOutput,
  fixturesSource,
  specFiles,
  specSource,
} from '../../../src/lib/fixture-graph';

// Records each line with the worker that printed it, without changing the code the page shows.
const RECORDER = `import { appendFileSync } from 'node:fs';
const console = {
  log: (line: string) =>
    appendFileSync(process.env.TRACE_FILE!, process.env.TEST_WORKER_INDEX + '\\t' + line + '\\n'),
};
`;

/** Runs the files on the real Playwright CLI and returns what each worker printed. */
function runPlaywright(
  files: Record<string, string>,
  workers: number,
  testInfo: TestInfo,
  label: string,
): { status: number | null; log: string; printed: string[][] } {
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
const unordered = (workers: string[][]): string[] =>
  workers.map((lines): string => lines.join('\n')).toSorted();

test.describe('the explainer matches real Playwright', () => {
  test.skip(
    ({ isMobile, browserName }) => isMobile || browserName !== 'chromium',
    'no browser involved, so one project is enough',
  );

  for (const scenario of SCENARIOS) {
    test(`"${scenario.label}" prints what the explainer shows`, { tag: '@regression' }, ({}, testInfo) => {
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

  test('a worker fixture cannot depend on a test fixture', { tag: '@regression' }, ({}, testInfo) => {
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
  test.beforeEach(async ({ fixtureGraph }) => {
    await fixtureGraph.goto();
  });

  test('steps through a dependency chain in order', { tag: '@regression' }, async ({ fixtureGraph }) => {
    await expect(fixtureGraph.h1Named('Fixture graph')).toBeVisible();
    await expect(fixtureGraph.backButton).toBeDisabled();

    await fixtureGraph.nextButton.click();
    await expect(fixtureGraph.h2('setup db')).toBeVisible();
    await expect(fixtureGraph.status).toContainText('user depends on it');
    await expect(fixtureGraph.fixture(0, 'db')).toContainText('setting up');

    await fixtureGraph.nextButton.click();
    await expect(fixtureGraph.fixture(0, 'db')).toContainText('ready');
    await expect(fixtureGraph.fixture(0, 'user')).toContainText('setting up');
    await expect(fixtureGraph.consoleOutput).toHaveText('setup dbsetup user');
  });

  test('walking to the end prints the whole run', { tag: '@regression' }, async ({ fixtureGraph }) => {
    const scenario = SCENARIOS.find(({ id }) => id === 'chain')!;
    await fixtureGraph.walkToEnd(buildSteps(scenario).length);

    await expect(fixtureGraph.nextButton).toBeDisabled();
    await expect(fixtureGraph.h2('worker 0 stops')).toBeVisible();
    await expect(fixtureGraph.consoleOutput).toHaveText(expectedOutput(scenario)[0].join(''));
    await expect(fixtureGraph.fixture(0, 'cart')).toContainText('created 2×');
  });

  test(
    'a worker fixture is created once while test fixtures repeat',
    { tag: '@regression' },
    async ({ fixtureGraph }) => {
      await fixtureGraph.chooseScenario('shared by a worker');
      await fixtureGraph.goToStep(/\. worker 0 stops/);

      await expect(fixtureGraph.fixture(0, 'server')).toContainText('created 1×');
      await expect(fixtureGraph.fixture(0, 'api')).toContainText('created 3×');
      await expect(fixtureGraph.sourceFile('fixtures.ts')).toContainText("scope: 'worker'");
    },
  );

  test(
    'an auto fixture runs for a test that never asks for it',
    { tag: '@regression' },
    async ({ fixtureGraph }) => {
      await fixtureGraph.chooseScenario('auto fixtures');
      await fixtureGraph.goToStep(/\. worker 0 stops/);

      await expect(fixtureGraph.fixture(0, 'consoleGuard')).toContainText('created 2×');
      await expect(fixtureGraph.fixture(0, 'user')).toContainText('created 1×');
    },
  );

  test(
    'each of two workers creates its own worker fixture',
    { tag: '@regression' },
    async ({ fixtureGraph }) => {
      await fixtureGraph.chooseScenario('two workers');
      await fixtureGraph.goToStep(/\. worker 1 stops/);

      await expect(fixtureGraph.fixture(0, 'server')).toContainText('created 1×');
      await expect(fixtureGraph.fixture(1, 'server')).toContainText('created 1×');
      await expect(fixtureGraph.sourceFile('search.spec.ts')).toContainText('finds a product');
    },
  );

  test('a failed test restarts the worker', { tag: '@regression' }, async ({ fixtureGraph }) => {
    await fixtureGraph.chooseScenario('a test fails');

    await fixtureGraph.goToStep(/\. run loses an order/);
    await expect(fixtureGraph.failedBadge).toBeVisible();

    await fixtureGraph.goToStep(/\. worker 1 starts/);
    await expect(fixtureGraph.status).toContainText('new process');

    await fixtureGraph.goToStep(/\. worker 1 stops/);
    await expect(fixtureGraph.fixture(0, 'server')).toContainText('created 1×');
    await expect(fixtureGraph.fixture(1, 'server')).toContainText('created 1×');
  });

  test(
    'changing scenario starts again from the first step',
    { tag: '@regression' },
    async ({ fixtureGraph }) => {
      await fixtureGraph.nextButton.click();
      await fixtureGraph.chooseScenario('auto fixtures');

      await expect(fixtureGraph.step('1. worker 0 starts')).toHaveAttribute('aria-current', 'step');
      await expect(fixtureGraph.consoleOutput).toHaveText('');
    },
  );

  test(
    'the run order keeps the current step fully in view',
    { tag: '@regression' },
    async ({ fixtureGraph }) => {
      await fixtureGraph.chooseScenario('a test fails');
      await fixtureGraph.walkToEnd(buildSteps(SCENARIOS.find(({ id }) => id === 'failure')!).length);

      const current = fixtureGraph.currentStep;
      await expect(current).toContainText('worker 1 stops');
      const clipped = await current.evaluate((element) => {
        const box = element.getBoundingClientRect();
        const list = element.closest('ol')!.getBoundingClientRect();
        return box.top < list.top || box.bottom > list.bottom + 1;
      });
      expect(clipped).toBe(false);
    },
  );

  test('play advances on its own and pause stops it', { tag: '@regression' }, async ({ fixtureGraph }) => {
    await fixtureGraph.playButton.click();
    await expect(fixtureGraph.step('2. setup db')).toHaveAttribute('aria-current', 'step');
    await fixtureGraph.pauseButton.click();
    await expect(fixtureGraph.playButton).toBeVisible();
  });

  test('fits a 375px page in the widest scenario', { tag: '@regression' }, async ({ fixtureGraph, page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await fixtureGraph.chooseScenario('auto fixtures');
    expect(await fixtureGraph.horizontalOverflow()).toBeLessThanOrEqual(0);
  });
});
