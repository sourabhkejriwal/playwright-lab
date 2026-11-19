import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import type { TestInfo } from '@playwright/test';
import { test, expect } from '../../fixtures/pom/test-options';
import * as prettier from 'prettier';
import { parse } from 'yaml';
import {
  DEFAULT_OPTIONS,
  FREE_PLAN_JOBS,
  NODE_VERSIONS,
  PLAYWRIGHT_VERSION,
  TRIGGERS,
  generateWorkflow,
  needsMerge,
  testJobCount,
  workflowNotes,
  type CiOptions,
} from '../../../src/lib/ci-builder';

interface Step {
  name?: string;
  uses?: string;
  run?: string;
  if?: string;
  with?: Record<string, string | number | boolean>;
}

interface Job {
  name: string;
  'runs-on': string;
  'timeout-minutes': number;
  needs?: string[];
  if?: string;
  container?: { image: string; options: string };
  strategy?: { 'fail-fast': boolean; matrix: Record<string, (string | number)[]> };
  steps: Step[];
}

interface Workflow {
  name: string;
  on: Record<string, unknown>;
  permissions: Record<string, string>;
  concurrency?: { group: string; 'cancel-in-progress': boolean };
  jobs: Record<string, Job>;
}

const workflow = (options: Partial<CiOptions> = {}): Workflow =>
  parse(generateWorkflow({ ...DEFAULT_OPTIONS, ...options })) as Workflow;

const samples: CiOptions[] = [
  DEFAULT_OPTIONS,
  { ...DEFAULT_OPTIONS, shards: 4 },
  { ...DEFAULT_OPTIONS, splitBrowsers: true },
  { ...DEFAULT_OPTIONS, splitBrowsers: true, shards: 8, packageManager: 'pnpm', nodeVersion: '.nvmrc' },
  { ...DEFAULT_OPTIONS, setup: 'container', shards: 2, nodeVersion: '24', cancelOldRuns: false },
  {
    ...DEFAULT_OPTIONS,
    triggers: TRIGGERS.map(({ name }) => name),
    browsers: ['webkit'],
    splitBrowsers: true,
  },
  { ...DEFAULT_OPTIONS, triggers: [], browsers: [] },
];

/** Every combination of a job's matrix, like GitHub expands it. */
function expandMatrix(matrix: Record<string, (string | number)[]> = {}): Record<string, string>[] {
  return Object.entries(matrix).reduce<Record<string, string>[]>(
    (combos, [key, values]) =>
      combos.flatMap((combo) => values.map((value) => ({ ...combo, [key]: String(value) }))),
    [{}],
  );
}

const fill = (text: string, combo: Record<string, string>): string =>
  text.replace(/\$\{\{ matrix\.(\w+) \}\}/g, (_, key: string) => combo[key]);

const SPEC = `
import { test } from '@playwright/test';
for (let index = 1; index <= 6; index++) test('case ' + index, () => {});
`;

const CONFIG = `
import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  projects: [{ name: 'chromium' }, { name: 'firefox' }, { name: 'webkit' }],
});
`;

/** A project the workflow's own commands can run in. These tests need no browser. */
function createProject(testInfo: TestInfo, label: string): string {
  const root = testInfo.outputPath(label);
  mkdirSync(join(root, 'tests'), { recursive: true });
  // Playwright puts test-results/ beside the nearest package.json and empties it, which must not be this repo's.
  writeFileSync(join(root, 'package.json'), '{}');
  writeFileSync(join(root, 'playwright.config.ts'), CONFIG);
  writeFileSync(join(root, 'tests', 'sample.spec.ts'), SPEC);
  return root;
}

/** Runs a workflow's playwright command with the real CLI, as GitHub would. */
function runCommand(command: string, cwd: string): string {
  const args = command.replace(/^(npx|pnpm exec) playwright /, '').split(' ');
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !/^(PW_|PLAYWRIGHT_|TEST_|CI$)/.test(key)),
  );
  const packageJson = createRequire(import.meta.url).resolve('@playwright/test/package.json');
  const run = spawnSync(process.execPath, [join(dirname(packageJson), 'cli.js'), ...args], {
    cwd,
    env: { ...env, CI: '1' },
    encoding: 'utf8',
  });
  expect(run.status, `${command}\n${run.stdout}\n${run.stderr}`).toBe(0);
  return run.stdout;
}

const stepRunning = (job: Job, text: string): Step | undefined =>
  job.steps.find(({ run }): boolean | undefined => run?.includes(text));

/** Plays a whole sharded workflow: every test job, then the artifact download and the merge job. */
function playMergedWorkflow(options: CiOptions, testInfo: TestInfo, label: string): string[] {
  const { test: testJob, 'merge-reports': mergeJob } = workflow(options).jobs;
  const root = createProject(testInfo, label);
  const command = stepRunning(testJob, 'playwright test')?.run as string;
  const upload = testJob.steps.find(({ uses }) => uses?.startsWith('actions/upload-artifact')) as Step;
  const download = mergeJob.steps.find(({ uses }) => uses?.startsWith('actions/download-artifact')) as Step;
  const merged = join(root, String(download.with?.path));
  mkdirSync(merged);

  const artifacts = new Set<string>();
  const combos = expandMatrix(testJob.strategy?.matrix);
  for (const combo of combos) {
    artifacts.add(fill(String(upload.with?.name), combo));
    runCommand(fill(command, combo), root);
    const folder = join(root, String(upload.with?.path));
    // merge-multiple puts every artifact in one folder, so a repeated file name would lose results.
    for (const file of readdirSync(folder)) {
      expect(existsSync(join(merged, file)), `${file} is written twice`).toBe(false);
      cpSync(join(folder, file), join(merged, file));
    }
  }
  expect(artifacts.size, 'each job needs its own artifact name').toBe(combos.length);
  for (const name of artifacts) expect(name).toMatch(/^blob-report-/);

  runCommand(stepRunning(mergeJob, 'merge-reports')?.run as string, root);
  expect(existsSync(join(root, 'playwright-report', 'index.html'))).toBe(true);

  const json = runCommand(`npx playwright merge-reports --reporter=json ./${download.with?.path}`, root);
  const report = JSON.parse(json) as {
    suites: { suites?: unknown[]; specs: { title: string; tests: { projectName: string }[] }[] }[];
  };
  return report.suites
    .flatMap(({ specs }) => specs)
    .flatMap(({ title, tests }) => tests.map(({ projectName }) => `${projectName}: ${title}`))
    .toSorted();
}

const everyTest = (projects: string[]): string[] =>
  projects.flatMap((name) => [1, 2, 3, 4, 5, 6].map((index) => `${name}: case ${index}`)).toSorted();

test.describe('generated workflow', () => {
  test.skip(
    ({ isMobile, browserName }) => isMobile || browserName !== 'chromium',
    'no browser involved, so one project is enough',
  );

  test('the output is already formatted', { tag: '@regression' }, async () => {
    for (const options of samples) {
      const code = generateWorkflow(options);
      const formatted = await prettier.format(code, { parser: 'yaml', singleQuote: true, printWidth: 110 });
      expect(code).toBe(formatted);
    }
  });

  test('every sample is a well-formed workflow', { tag: '@regression' }, () => {
    for (const options of samples) {
      const { on, jobs, permissions } = parse(generateWorkflow(options)) as Workflow;
      expect(Object.keys(on).length).toBeGreaterThan(0);
      expect(permissions).toEqual({ contents: 'read' });

      for (const job of Object.values(jobs)) {
        expect(job['runs-on']).toBe('ubuntu-latest');
        expect(job['timeout-minutes']).toBeGreaterThan(0);
        for (const need of job.needs ?? []) expect(Object.keys(jobs)).toContain(need);
        for (const step of job.steps) expect(Boolean(step.uses) !== Boolean(step.run)).toBe(true);

        // A matrix value used anywhere in the job has to be defined by that job.
        const used = JSON.stringify(job.steps).matchAll(/matrix\.(\w+)/g);
        for (const [, key] of used) expect(Object.keys(job.strategy?.matrix ?? {})).toContain(key);
      }
    }
  });

  test('a report is uploaded even when tests fail', { tag: '@regression' }, () => {
    for (const options of samples) {
      for (const job of Object.values((parse(generateWorkflow(options)) as Workflow).jobs)) {
        const uploads = job.steps.filter(({ uses }) => uses?.startsWith('actions/upload-artifact'));
        for (const upload of uploads) expect(upload.if).toBe('${{ !cancelled() }}');
      }
    }
  });

  test('triggers follow the choices, and a workflow always has one', { tag: '@regression' }, () => {
    expect(Object.keys(workflow().on)).toEqual(['push', 'pull_request']);
    expect(workflow({ triggers: ['schedule'] }).on).toEqual({ schedule: [{ cron: '0 3 * * *' }] });
    expect(Object.keys(workflow({ triggers: [] }).on)).toEqual(['workflow_dispatch']);
  });

  test('the package manager decides every command', { tag: '@regression' }, () => {
    const { test: job } = workflow({ packageManager: 'pnpm' }).jobs;
    const uses = job.steps.flatMap((step) => step.uses ?? []);
    expect(uses.indexOf('pnpm/action-setup@v4')).toBeLessThan(uses.indexOf('actions/setup-node@v5'));
    expect(stepRunning(job, 'install --frozen-lockfile')).toBeDefined();
    expect(stepRunning(job, 'pnpm exec playwright test')).toBeDefined();
    expect(generateWorkflow({ ...DEFAULT_OPTIONS, packageManager: 'pnpm' })).not.toContain('npx');

    const npm = workflow().jobs.test;
    expect(stepRunning(npm, 'npm ci')).toBeDefined();
    expect(generateWorkflow(DEFAULT_OPTIONS)).not.toContain('pnpm');
  });

  const nodeInput = (nodeVersion: string): Record<string, string> =>
    nodeVersion === '.nvmrc' ? { 'node-version-file': '.nvmrc' } : { 'node-version': nodeVersion };

  test('node versions stay strings and .nvmrc is read from the file', { tag: '@regression' }, () => {
    for (const nodeVersion of NODE_VERSIONS) {
      const setup = workflow({ nodeVersion }).jobs.test.steps.find(({ uses }) =>
        uses?.startsWith('actions/setup-node'),
      );
      expect(setup?.with).toMatchObject(nodeInput(nodeVersion));
    }
  });

  test(
    'the container image matches the installed Playwright and replaces the browser download',
    { tag: '@regression' },
    () => {
      const packageJson = createRequire(import.meta.url)('@playwright/test/package.json') as {
        version: string;
      };
      expect(PLAYWRIGHT_VERSION).toBe(packageJson.version);

      const { test: job } = workflow({ setup: 'container' }).jobs;
      expect(job.container?.image).toBe(`mcr.microsoft.com/playwright:v${packageJson.version}-noble`);
      expect(stepRunning(job, 'playwright install')).toBeUndefined();
      expect(stepRunning(workflow().jobs.test, 'playwright install')?.run).toBe(
        'npx playwright install --with-deps chromium firefox webkit',
      );
    },
  );

  test('one browser never builds a matrix', { tag: '@regression' }, () => {
    const options = { ...DEFAULT_OPTIONS, browsers: ['webkit'], splitBrowsers: true };
    expect(needsMerge(options)).toBe(false);
    expect(testJobCount(options)).toBe(1);
    expect(workflow(options).jobs.test.strategy).toBeUndefined();
  });

  test(
    'real Playwright produces the report the single job uploads',
    { tag: '@regression' },
    async ({}, testInfo) => {
      test.slow();
      const { test: job } = workflow().jobs;
      const root = createProject(testInfo, 'single');
      runCommand(stepRunning(job, 'playwright test')?.run as string, root);
      const upload = job.steps.find(({ uses }) => uses?.startsWith('actions/upload-artifact'));
      expect(existsSync(join(root, String(upload?.with?.path), 'index.html'))).toBe(true);
    },
  );

  test('real Playwright runs every test once across shards', { tag: '@regression' }, async ({}, testInfo) => {
    test.slow();
    const options = { ...DEFAULT_OPTIONS, shards: 3 };
    expect(playMergedWorkflow(options, testInfo, 'shards')).toEqual(
      everyTest(['chromium', 'firefox', 'webkit']),
    );
  });

  test(
    'real Playwright runs every test once across browsers and shards',
    { tag: '@regression' },
    async ({}, testInfo) => {
      test.slow();
      const options = {
        ...DEFAULT_OPTIONS,
        browsers: ['chromium', 'webkit'],
        splitBrowsers: true,
        shards: 2,
      };
      expect(testJobCount(options)).toBe(4);
      expect(playMergedWorkflow(options, testInfo, 'matrix')).toEqual(everyTest(['chromium', 'webkit']));
    },
  );

  test(
    'real Playwright merges one job per browser without shards',
    { tag: '@regression' },
    async ({}, testInfo) => {
      test.slow();
      const options = { ...DEFAULT_OPTIONS, browsers: ['firefox', 'webkit'], splitBrowsers: true };
      expect(playMergedWorkflow(options, testInfo, 'browsers')).toEqual(everyTest(['firefox', 'webkit']));
    },
  );

  test('notes explain what the workflow depends on', { tag: '@regression' }, () => {
    const texts = (options: Partial<CiOptions>): string[] =>
      workflowNotes({ ...DEFAULT_OPTIONS, ...options }).map(({ text }) => text);

    expect(texts({})).toEqual([]);
    expect(texts({ triggers: [] })[0]).toContain('only starts by hand');
    expect(texts({ browsers: [] })[0]).toContain('every project in your config runs');
    expect(texts({ setup: 'container' })[0]).toContain(PLAYWRIGHT_VERSION);
    expect(texts({ shards: 2 })[0]).toContain('fullyParallel: true');
    expect(texts({ packageManager: 'pnpm' })[0]).toContain('packageManager');
    expect(texts({ nodeVersion: '.nvmrc' })[0]).toContain('.nvmrc');
    expect(texts({ triggers: ['schedule'] })[0]).toContain('default branch');
    expect(texts({ splitBrowsers: true, shards: 8 })[0]).toContain(`runs ${FREE_PLAN_JOBS} at a time`);
    expect(texts({ splitBrowsers: true, shards: 6 }).join()).not.toContain('queue');
  });
});

test.describe('ci builder page', () => {
  test.beforeEach(async ({ ciBuilder }) => {
    await ciBuilder.goto();
  });

  test('starts with a working default workflow', { tag: '@regression' }, async ({ ciBuilder }) => {
    await expect(ciBuilder.h1Named('CI pipeline builder')).toBeVisible();
    await expect(ciBuilder.h2('.github/workflows/playwright.yml')).toBeVisible();
    await expect(ciBuilder.output).toHaveText(generateWorkflow(DEFAULT_OPTIONS));
    await expect(ciBuilder.status).toHaveText('1 test job · single report · kept 14 days');
  });

  test('each choice updates the workflow', { tag: '@regression' }, async ({ ciBuilder }) => {
    const { output } = ciBuilder;
    await ciBuilder.checkbox('# triggers', 'schedule').check();
    await expect(output).toContainText("cron: '0 3 * * *'");

    await ciBuilder.checkbox('# browsers', 'firefox').uncheck();
    await expect(output).not.toContainText('--project=firefox');

    await ciBuilder.select('shards').selectOption('4');
    await expect(output).toContainText('shardIndex: [1, 2, 3, 4]');
    await expect(output).toContainText('merge-reports:');

    await ciBuilder.checkbox('# jobs', 'one job per browser').check();
    await expect(output).toContainText('project: [chromium, webkit]');

    await ciBuilder.checkbox('# jobs', 'cancel older runs').uncheck();
    await expect(output).not.toContainText('concurrency:');

    await ciBuilder.radio('# browser setup', 'container').check();
    await ciBuilder.radio('# package manager', 'pnpm').check();
    await ciBuilder.select('node version').selectOption('.nvmrc');
    await ciBuilder.select('timeout (minutes)').selectOption('60');
    await ciBuilder.select('keep for (days)').selectOption('30');

    await expect(output).toHaveText(
      generateWorkflow({
        triggers: ['push', 'pull_request', 'schedule'],
        packageManager: 'pnpm',
        nodeVersion: '.nvmrc',
        browsers: ['chromium', 'webkit'],
        splitBrowsers: true,
        shards: 4,
        setup: 'container',
        timeout: 60,
        retention: 30,
        cancelOldRuns: false,
      }),
    );
    await expect(ciBuilder.status).toHaveText('8 test jobs · merged report · kept 30 days');
  });

  test(
    'notes appear for choices that need something from the project',
    { tag: '@regression' },
    async ({ ciBuilder }) => {
      const { notes } = ciBuilder;
      await expect(notes).toBeHidden();
      await ciBuilder.select('shards').selectOption('2');
      await expect(notes).toContainText('fullyParallel: true');
      await ciBuilder.select('shards').selectOption('1');
      await expect(notes).toBeHidden();
    },
  );

  test(
    'copies the workflow to the clipboard',
    { tag: '@regression' },
    async ({ ciBuilder, page, context, browserName }) => {
      test.skip(browserName !== 'chromium', 'only Chromium lets a test grant clipboard access');
      await context.grantPermissions(['clipboard-read', 'clipboard-write']);
      await ciBuilder.copyButton.click();
      await expect(ciBuilder.status).toHaveText('workflow copied to clipboard');
      await expect(ciBuilder.copiedButton).toBeVisible();
      expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
        generateWorkflow(DEFAULT_OPTIONS),
      );
    },
  );

  test('downloads the workflow as playwright.yml', { tag: '@regression' }, async ({ ciBuilder }) => {
    const download = await ciBuilder.download();
    expect(download.suggestedFilename()).toBe('playwright.yml');
    expect(readFileSync(await download.path(), 'utf8')).toBe(generateWorkflow(DEFAULT_OPTIONS));
  });

  test('fits a 375px page with the longest workflow', { tag: '@regression' }, async ({ ciBuilder, page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await ciBuilder.select('shards').selectOption('8');
    await ciBuilder.checkbox('# jobs', 'one job per browser').check();
    await expect(ciBuilder.status).toContainText('24 test jobs');
    expect(await ciBuilder.horizontalOverflow()).toBeLessThanOrEqual(0);
  });

  test.describe('accessibility', () => {
    test.use({ reducedMotion: 'reduce' });

    for (const theme of ['dark', 'light'] as const) {
      test(
        `no detectable a11y violations with notes showing in the ${theme} theme`,
        { tag: '@regression' },
        async ({ ciBuilder }) => {
          await ciBuilder.saveThemeAndReload(theme);
          await ciBuilder.waitUntilReady();
          await ciBuilder.select('shards').selectOption('8');
          await ciBuilder.checkbox('# jobs', 'one job per browser').check();
          await expect(ciBuilder.notes).toBeVisible();
          expect(await ciBuilder.a11yViolations()).toEqual([]);
        },
      );
    }
  });
});
