import { execFile, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';
import type { TestInfo } from '@playwright/test';
import { timeouts } from '../../../config/app';
import { test, expect } from '../../../fixtures/pom/test-options';
import {
  SUITES,
  buildJobs,
  commandArgs,
  commands,
  formatSeconds,
  insights,
  jobsForShard,
  simulate,
  testCount,
  type Settings,
  type Suite,
} from '../../../src/lib/parallel-sim';

const run = promisify(execFile);
const cli = join(dirname(createRequire(import.meta.url).resolve('@playwright/test/package.json')), 'cli.js');
const env = Object.fromEntries(
  Object.entries(process.env).filter(([key]) => !/^(PW_|PLAYWRIGHT_|TEST_|CI$)/.test(key)),
);

/** Writes the suite as real spec files. Each test records where it ran and takes no time. */
function writeProject(suite: Suite, testInfo: TestInfo, label: string): string {
  const root = testInfo.outputPath(label);
  mkdirSync(root, { recursive: true });
  // Playwright puts test-results/ beside the nearest package.json and empties it, which must not be this repo's.
  writeFileSync(join(root, 'package.json'), '{}');
  for (const { name, tests } of suite.files) {
    const stem = name.replace('.spec.ts', '');
    const body = tests.map(
      (_, at) => `test('${stem} ${at + 1}', () => {
  appendFileSync(process.env.TRACE_FILE!, process.env.TEST_PARALLEL_INDEX + '\\t${stem} ${at + 1}\\n');
});`,
    );
    writeFileSync(
      join(root, name),
      `import { appendFileSync } from 'node:fs';\nimport { test } from '@playwright/test';\n\n${body.join('\n\n')}\n`,
    );
  }
  return root;
}

/** The titles real Playwright puts in one shard, read from `--list`. */
async function listedTitles(root: string, args: string[]): Promise<string[]> {
  const { stdout } = await run(process.execPath, [cli, 'test', '--list', '--reporter=list', ...args], {
    cwd: root,
    env,
    maxBuffer: 1024 * 1024,
  }).catch((error: { stdout: string }) => ({ stdout: error.stdout }));
  return stdout.split('\n').flatMap((line) => line.match(/spec\.ts:\d+:\d+ › (.+)$/)?.[1] ?? []);
}

/** Really runs the suite and returns which worker slot ran each test, in the order they ran. */
function execute(
  root: string,
  args: string[],
): {
  status: number | null;
  log: string;
  ran: { slot: number; title: string }[];
} {
  const trace = join(root, 'trace.log');
  writeFileSync(trace, '');
  const result = spawnSync(process.execPath, [cli, 'test', '--reporter=line', ...args], {
    cwd: root,
    env: { ...env, TRACE_FILE: trace },
    encoding: 'utf8',
  });
  const rows = existsSync(trace) ? readFileSync(trace, 'utf8').trim().split('\n') : [];
  const ran = rows.filter(Boolean).map((row) => {
    const [slot, title] = row.split('\t');
    return { slot: Number(slot), title };
  });
  return { status: result.status, log: `${result.stdout}\n${result.stderr}`, ran };
}

const suiteById = (id: string): Suite => SUITES.find((suite): boolean => suite.id === id)!;

test.describe('the simulator matches real Playwright', () => {
  test.skip(
    ({ isMobile, browserName }) => isMobile || browserName !== 'chromium',
    'no browser involved, so one project is enough',
  );
  test.setTimeout(timeouts.nestedRun);

  for (const suite of SUITES) {
    for (const fullyParallel of [false, true]) {
      test(
        `"${suite.label}" shards the same way with fullyParallel ${fullyParallel}`,
        { tag: '@regression' },
        async ({}, testInfo) => {
          const root = writeProject(suite, testInfo, 'project');
          for (const shards of [2, 3, 4, 6]) {
            const settings: Settings = { workers: 2, shards, fullyParallel };
            const { shards: predicted } = simulate(suite, settings);
            const real = await Promise.all(commandArgs(settings).map((args) => listedTitles(root, args)));
            expect(
              real.map((titles) => titles.toSorted()),
              `${shards} shards`,
            ).toEqual(predicted.map(({ bars }) => bars.map(({ title }) => title).toSorted()));
          }
        },
      );
    }
  }

  test('one worker runs tests in the predicted order', { tag: '@regression' }, ({}, testInfo) => {
    const suite = suiteById('balanced');
    const settings: Settings = { workers: 1, shards: 1, fullyParallel: false };
    const { status, log, ran } = execute(writeProject(suite, testInfo, 'serial'), commandArgs(settings)[0]);
    expect(status, log).toBe(0);
    expect(ran.map(({ title }) => title)).toEqual(
      simulate(suite, settings).shards[0].bars.map(({ title }) => title),
    );
  });

  for (const fullyParallel of [false, true]) {
    test(
      `jobs reach the predicted workers with fullyParallel ${fullyParallel}`,
      { tag: '@regression' },
      ({}, testInfo) => {
        const suite = suiteById('balanced');
        const settings: Settings = { workers: 3, shards: 1, fullyParallel };
        const { status, log, ran } = execute(
          writeProject(suite, testInfo, 'workers'),
          commandArgs(settings)[0],
        );
        expect(status, log).toBe(0);
        expect(ran).toHaveLength(testCount(suite));

        const [shard] = simulate(suite, settings).shards;
        expect(new Set(ran.map(({ slot }) => slot)).size).toBe(shard.workersUsed);
        // The first jobs are handed out together, one to each worker in queue order.
        shard.jobs.slice(0, settings.workers).forEach((job, slot) => {
          expect(ran.find(({ title }) => title === job.tests[0].title)?.slot).toBe(slot);
        });
        // eslint-disable-next-line playwright/no-conditional-in-test -- the rule below holds only without fullyParallel
        if (fullyParallel) return;
        // Without fullyParallel, a file never leaves its worker.
        for (const job of shard.jobs) {
          const slots = ran.filter(({ title }) => job.tests.some((item) => item.title === title));
          expect(new Set(slots.map(({ slot }) => slot)).size, job.file).toBe(1);
        }
      },
    );
  }

  test('more workers than files only starts one worker per file', { tag: '@regression' }, ({}, testInfo) => {
    const suite = suiteById('big-file');
    const settings: Settings = { workers: 8, shards: 1, fullyParallel: false };
    const { status, log, ran } = execute(writeProject(suite, testInfo, 'idle'), commandArgs(settings)[0]);
    expect(status, log).toBe(0);
    expect(new Set(ran.map(({ slot }) => slot)).size).toBe(suite.files.length);
    expect(simulate(suite, settings).shards[0].workersUsed).toBe(suite.files.length);
  });
});

test.describe('the simulator model', () => {
  test.skip(
    ({ isMobile, browserName }) => isMobile || browserName !== 'chromium',
    'no browser involved, so one project is enough',
  );

  test('every test runs exactly once and workers never overlap', { tag: '@regression' }, () => {
    for (const suite of SUITES) {
      for (const fullyParallel of [false, true]) {
        for (let workers = 1; workers <= 8; workers += 1) {
          for (let shards = 1; shards <= 6; shards += 1) {
            const { shards: runs } = simulate(suite, { workers, shards, fullyParallel });
            const titles = runs.flatMap(({ bars }) => bars.map(({ title }) => title));
            expect(titles).toHaveLength(testCount(suite));
            expect(new Set(titles).size).toBe(testCount(suite));

            for (const { bars } of runs) {
              for (let worker = 0; worker < workers; worker += 1) {
                const own = bars.filter((bar) => bar.worker === worker).toSorted((a, b) => a.start - b.start);
                own.slice(1).forEach((bar, at) => expect(bar.start).toBeGreaterThanOrEqual(own[at].end));
              }
            }
          }
        }
      }
    }
  });

  test(
    'a job goes to the shard its first test falls in, even if that empties another shard',
    { tag: '@regression' },
    () => {
      const jobs = buildJobs(suiteById('big-file'), false);
      const files = (shard: number): string[] => jobsForShard(jobs, shard, 4).map(({ file }): string => file);
      expect(files(1)).toEqual(['account.spec.ts', 'catalog.spec.ts']);
      expect(files(2)).toEqual([]);
      expect(files(3)).toEqual([]);
      expect(files(4)).toEqual(['login.spec.ts', 'search.spec.ts']);
    },
  );

  test('insights name the limit that applies', { tag: '@regression' }, () => {
    const ids = (
      suite: string,
      settings: Settings,
    ): ('empty-shard' | 'long-job' | 'idle-workers' | 'uneven-shards' | 'no-gain' | 'healthy')[] =>
      insights(suiteById(suite), settings).map(({ id }) => id);

    expect(ids('slow-file', { workers: 4, shards: 1, fullyParallel: false })).toContain('long-job');
    expect(ids('balanced', { workers: 8, shards: 1, fullyParallel: false })).toContain('idle-workers');
    expect(ids('big-file', { workers: 2, shards: 4, fullyParallel: false })).toContain('empty-shard');
    expect(ids('big-file', { workers: 2, shards: 3, fullyParallel: false })).toContain('no-gain');
    expect(ids('balanced', { workers: 4, shards: 2, fullyParallel: true })).toEqual(['healthy']);
  });

  test('formats durations the way the page shows them', { tag: '@regression' }, () => {
    expect(formatSeconds(45)).toBe('45s');
    expect(formatSeconds(120)).toBe('2m');
    expect(formatSeconds(292)).toBe('4m 52s');
  });
});

test.describe('the parallel simulator page', () => {
  test.beforeEach(async ({ parallelSimulator }) => {
    await parallelSimulator.goto();
  });

  test('shows the default run', { tag: '@regression' }, async ({ parallelSimulator }) => {
    const suite = suiteById('balanced');
    const result = simulate(suite, { workers: 2, shards: 1, fullyParallel: false });

    await expect(parallelSimulator.h1Named('Parallel and shard simulator')).toBeVisible();
    await expect(parallelSimulator.stat('pipeline time')).toHaveText(formatSeconds(result.wallClock));
    await expect(parallelSimulator.commands).toHaveText('npx playwright test --workers=2');
  });

  test('more workers shorten the pipeline', { tag: '@regression' }, async ({ parallelSimulator }) => {
    const suite = suiteById('balanced');
    await parallelSimulator.workers.fill('4');

    const expected = simulate(suite, { workers: 4, shards: 1, fullyParallel: false }).wallClock;
    await expect(parallelSimulator.stat('pipeline time')).toHaveText(formatSeconds(expected));
    await expect(parallelSimulator.status).toContainText(formatSeconds(expected));
  });

  test(
    'shards add one command and one timeline each',
    { tag: '@regression' },
    async ({ parallelSimulator }) => {
      await parallelSimulator.shards.fill('3');

      await expect(parallelSimulator.shardHeadings(3)).toHaveCount(3);
      const settings: Settings = { workers: 2, shards: 3, fullyParallel: false };
      await expect(parallelSimulator.commands).toHaveText(commands(settings).join('\n'));
    },
  );

  test('fullyParallel breaks up the slow file', { tag: '@regression' }, async ({ parallelSimulator }) => {
    const suite = suiteById('slow-file');
    await parallelSimulator.chooseSuite('one slow file');
    await parallelSimulator.workers.fill('4');
    await expect(parallelSimulator.lessons).toContainText('checkout.spec.ts');

    await parallelSimulator.fullyParallel.check();

    const expected = simulate(suite, { workers: 4, shards: 1, fullyParallel: true }).wallClock;
    await expect(parallelSimulator.stat('pipeline time')).toHaveText(formatSeconds(expected));
    await expect(parallelSimulator.lessons).not.toContainText('one worker has to run it');
    await expect(parallelSimulator.commands).toContainText('--fully-parallel');
  });

  test('warns about a shard with no tests', { tag: '@regression' }, async ({ parallelSimulator }) => {
    await parallelSimulator.chooseSuite('one file with many tests');
    await parallelSimulator.shards.fill('4');

    await expect(parallelSimulator.lessons).toContainText('Shards 2, 3 got no tests');
    await parallelSimulator.secondShardWorkerDetails.click();
    await expect(parallelSimulator.firstEmptyShardNotice).toBeVisible();
  });

  test('lists what each worker ran in words', { tag: '@regression' }, async ({ parallelSimulator }) => {
    await parallelSimulator.workers.fill('8');
    await parallelSimulator.workerDetails.click();

    await expect(parallelSimulator.workersOfShard(1)).toHaveCount(8);
    await expect(parallelSimulator.firstWorkerOfShard(1)).toHaveText(
      'worker 0: 4 tests from account.spec.ts',
    );
    await expect(parallelSimulator.lastWorkerOfShard(1)).toHaveText('worker 7: never started');
  });

  test(
    'fits a 375px page with the largest settings',
    { tag: '@regression' },
    async ({ parallelSimulator, page }) => {
      await page.setViewportSize({ width: 375, height: 800 });
      await parallelSimulator.chooseSuite('one slow file');
      await parallelSimulator.workers.fill('8');
      await parallelSimulator.shards.fill('6');
      await parallelSimulator.fullyParallel.check();

      await expect(parallelSimulator.shardHeadings(6)).toHaveCount(6);
      expect(await parallelSimulator.horizontalOverflow()).toBeLessThanOrEqual(0);
    },
  );
});
