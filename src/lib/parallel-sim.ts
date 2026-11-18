// The parallel and shard simulator. Pure, and tests/parallel-sim.spec.ts runs the commands it shows on real Playwright:
// which tests land in each shard, how many workers start and where each job goes must all match.
// Durations are a model: real runs also spend time starting workers and browsers.

export interface SpecFile {
  name: string;
  /** How long each test takes, in seconds. */
  tests: number[];
}

export interface Suite {
  id: string;
  label: string;
  summary: string;
  /** In alphabetical order, because that is the order Playwright queues files in. */
  files: SpecFile[];
}

export interface Settings {
  workers: number;
  shards: number;
  fullyParallel: boolean;
}

export const LIMITS = { workers: 8, shards: 6 };

/** Assumed cost of each CI job before its first test: checkout, install, browsers. */
export const SHARD_SETUP_SECONDS = 40;

export const SUITES: Suite[] = [
  {
    id: 'balanced',
    label: 'balanced files',
    summary: 'Six files of about the same length, the easy case for both workers and shards.',
    files: [
      { name: 'account.spec.ts', tests: [12, 9, 11, 10] },
      { name: 'cart.spec.ts', tests: [10, 12, 9, 11] },
      { name: 'checkout.spec.ts', tests: [11, 10, 12, 9] },
      { name: 'login.spec.ts', tests: [9, 11, 10, 12] },
      { name: 'orders.spec.ts', tests: [12, 10, 9, 11] },
      { name: 'search.spec.ts', tests: [10, 9, 12, 11] },
    ],
  },
  {
    id: 'slow-file',
    label: 'one slow file',
    summary: 'One file holds most of the runtime, so its tests decide when the run can finish.',
    files: [
      { name: 'admin.spec.ts', tests: [8, 7, 9] },
      { name: 'checkout.spec.ts', tests: [95, 80, 70, 85] },
      { name: 'login.spec.ts', tests: [6, 8, 7] },
      { name: 'profile.spec.ts', tests: [7, 6, 9] },
      { name: 'search.spec.ts', tests: [8, 9, 6] },
      { name: 'settings.spec.ts', tests: [7, 8, 6] },
    ],
  },
  {
    id: 'big-file',
    label: 'one file with many tests',
    summary: 'Most tests live in one file, which makes shards uneven unless tests can be split up.',
    files: [
      { name: 'account.spec.ts', tests: [9, 11] },
      { name: 'catalog.spec.ts', tests: [8, 9, 7, 8, 10, 8, 9, 7, 8, 9, 8, 7, 10, 8] },
      { name: 'login.spec.ts', tests: [10, 8] },
      { name: 'search.spec.ts', tests: [12, 9] },
    ],
  },
];

/** Plain-language rules shown under the simulator. The spec checks them on real Playwright. */
export const RULES: { name: string; meaning: string }[] = [
  {
    name: 'workers share a machine',
    meaning: '`--workers` sets how many processes run at once on one machine, so they compete for its CPU.',
  },
  {
    name: 'shards split the machines',
    meaning:
      '`--shard=1/3` runs the first of three slices, so each CI job takes a different share of the suite.',
  },
  {
    name: 'a file stays together',
    meaning:
      'By default one worker runs a whole file in order. `fullyParallel` lets every test go on its own.',
  },
  {
    name: 'shards count tests',
    meaning: 'Shards hold about the same number of tests, whatever those tests cost in time.',
  },
];

export interface SimTest {
  title: string;
  file: string;
  seconds: number;
}

/** What Playwright hands to one worker in one go: a whole file, or a single test with `fullyParallel`. */
export interface Job {
  file: string;
  tests: SimTest[];
  seconds: number;
}

export interface Bar extends SimTest {
  worker: number;
  start: number;
  end: number;
}

export interface ShardRun {
  shard: number;
  tests: number;
  jobs: Job[];
  workersUsed: number;
  bars: Bar[];
  /** Seconds from the first test starting to the last test ending. */
  testing: number;
  /** Testing time plus the CI job's setup. */
  total: number;
}

export interface Simulation {
  shards: ShardRun[];
  /** How long the pipeline takes: shards run side by side, so the slowest one decides. */
  wallClock: number;
  /** Compute paid for: every shard's time added together. */
  machineTime: number;
  /** Share of the started machines' worker time spent running a test, from 0 to 1. */
  busy: number;
}

const stem = (file: string) => file.replace('.spec.ts', '');
const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

export const testCount = ({ files }: Suite) => sum(files.map(({ tests }) => tests.length));

/** The queue Playwright builds: one job per file, or one job per test with `fullyParallel`. */
export function buildJobs({ files }: Suite, fullyParallel: boolean): Job[] {
  return files.flatMap(({ name, tests }) => {
    const all = tests.map((seconds, at) => ({ title: `${stem(name)} ${at + 1}`, file: name, seconds }));
    if (fullyParallel) return all.map((test) => ({ file: name, tests: [test], seconds: test.seconds }));
    return [{ file: name, tests: all, seconds: sum(tests) }];
  });
}

/**
 * The jobs one shard runs. Each shard gets an equal slice of the tests, the first shards taking any remainder,
 * and a job belongs to the shard its first test falls in. A long job can therefore jump over a whole shard.
 */
export function jobsForShard(jobs: Job[], shard: number, shards: number) {
  const total = sum(jobs.map(({ tests }) => tests.length));
  const size = Math.floor(total / shards);
  const remainder = total - size * shards;
  const from = (shard - 1) * size + Math.min(shard - 1, remainder);
  const to = from + size + (shard - 1 < remainder ? 1 : 0);

  let position = 0;
  return jobs.filter(({ tests }) => {
    const first = position;
    position += tests.length;
    return first >= from && first < to;
  });
}

/** Hands each job, in queue order, to the worker that is free first. Ties go to the lowest worker. */
export function schedule(jobs: Job[], workers: number) {
  const freeAt = Array.from({ length: workers }, () => 0);
  const bars: Bar[] = [];
  for (const { tests } of jobs) {
    const worker = freeAt.indexOf(Math.min(...freeAt));
    for (const test of tests) {
      const start = freeAt[worker];
      freeAt[worker] = start + test.seconds;
      bars.push({ ...test, worker, start, end: freeAt[worker] });
    }
  }
  return bars;
}

export function simulate(suite: Suite, { workers, shards, fullyParallel }: Settings): Simulation {
  const queue = buildJobs(suite, fullyParallel);
  const runs = Array.from({ length: shards }, (_, at): ShardRun => {
    const jobs = jobsForShard(queue, at + 1, shards);
    const bars = schedule(jobs, workers);
    const testing = Math.max(0, ...bars.map(({ end }) => end));
    return {
      shard: at + 1,
      tests: bars.length,
      jobs,
      workersUsed: new Set(bars.map(({ worker }) => worker)).size,
      bars,
      testing,
      total: SHARD_SETUP_SECONDS + testing,
    };
  });

  const working = sum(runs.flatMap(({ bars }) => bars.map(({ seconds }) => seconds)));
  const available = sum(runs.map(({ testing }) => testing * workers));
  return {
    shards: runs,
    wallClock: Math.max(...runs.map(({ total }) => total)),
    machineTime: sum(runs.map(({ total }) => total)),
    busy: available > 0 ? working / available : 0,
  };
}

/** How many times faster this is than one worker on one machine. */
export function speedup(suite: Suite, settings: Settings) {
  const baseline = simulate(suite, { ...settings, workers: 1, shards: 1 });
  return baseline.wallClock / simulate(suite, settings).wallClock;
}

/** The command each CI job runs. The spec passes these same arguments to the real CLI. */
export function commandArgs({ workers, shards, fullyParallel }: Settings) {
  return Array.from({ length: shards }, (_, at) => [
    `--workers=${workers}`,
    ...(fullyParallel ? ['--fully-parallel'] : []),
    ...(shards > 1 ? [`--shard=${at + 1}/${shards}`] : []),
  ]);
}

export const commands = (settings: Settings) =>
  commandArgs(settings).map((args) => ['npx playwright test', ...args].join(' '));

export function formatSeconds(seconds: number) {
  const whole = Math.round(seconds);
  const minutes = Math.floor(whole / 60);
  const rest = whole % 60;
  if (minutes === 0) return `${rest}s`;
  return rest === 0 ? `${minutes}m` : `${minutes}m ${rest}s`;
}

export interface Insight {
  id: 'empty-shard' | 'long-job' | 'idle-workers' | 'uneven-shards' | 'no-gain' | 'healthy';
  text: string;
}

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

/** What the current settings teach, most important first. */
export function insights(suite: Suite, settings: Settings): Insight[] {
  const { workers, shards, fullyParallel } = settings;
  const { shards: runs, wallClock, busy } = simulate(suite, settings);
  const found: Insight[] = [];
  const active = runs.filter(({ tests }) => tests > 0);

  const empty = runs.filter(({ tests }) => tests === 0);
  if (empty.length > 0) {
    const names = empty.map(({ shard }) => shard).join(', ');
    found.push({
      id: 'empty-shard',
      text: `${empty.length === 1 ? 'Shard' : 'Shards'} ${names} got no tests, because a file stays whole and belongs to the shard its first test falls in. You still pay for the CI job.`,
    });
  }

  const slowest = active.reduce((worst, run) => (run.testing > worst.testing ? run : worst));
  const longest = slowest.jobs.reduce((worst, job) => (job.seconds > worst.seconds ? job : worst));
  if (!fullyParallel && longest.tests.length > 1 && longest.seconds === slowest.testing) {
    found.push({
      id: 'long-job',
      text: `\`${longest.file}\` takes ${formatSeconds(longest.seconds)} and one worker has to run it from start to finish, so more workers can't beat that. Try \`fullyParallel\`.`,
    });
  }

  const idle = active.find(({ workersUsed }) => workersUsed < workers);
  if (idle) {
    const unit = fullyParallel ? 'test' : 'file';
    found.push({
      id: 'idle-workers',
      text: `${shards > 1 ? `Shard ${idle.shard} has` : 'This run has'} only ${plural(idle.jobs.length, unit)} to hand out, so ${plural(workers - idle.workersUsed, 'worker')} never ${workers - idle.workersUsed === 1 ? 'starts' : 'start'}.`,
    });
  }

  const times = active.map(({ testing }) => testing);
  if (active.length > 1 && Math.max(...times) >= Math.min(...times) * 1.5) {
    found.push({
      id: 'uneven-shards',
      text: `Shards test for between ${formatSeconds(Math.min(...times))} and ${formatSeconds(Math.max(...times))}, because they are split by test count and not by duration.`,
    });
  }

  if (shards > 1 && wallClock >= simulate(suite, { ...settings, shards: shards - 1 }).wallClock) {
    found.push({
      id: 'no-gain',
      text: `Going from ${shards - 1} to ${shards} shards saves no time here, but it does add another CI job to pay for.`,
    });
  }

  if (found.length === 0) {
    found.push({
      id: 'healthy',
      text: `Workers are busy ${Math.round(busy * 100)}% of the time and no shard holds the others up.`,
    });
  }
  return found;
}
