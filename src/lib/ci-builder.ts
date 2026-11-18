/** Writes a GitHub Actions workflow from a visitor's choices. Pure, so its commands can be run on real Playwright. */

export interface CiChoice {
  name: string;
  hint: string;
}

export const TRIGGERS: CiChoice[] = [
  { name: 'push', hint: 'every push to main' },
  { name: 'pull_request', hint: 'every pull request into main' },
  { name: 'schedule', hint: 'every night at 03:00 UTC' },
  { name: 'workflow_dispatch', hint: 'a run button in the actions tab' },
];

export const PACKAGE_MANAGERS: CiChoice[] = [
  { name: 'npm', hint: 'installs with npm ci' },
  { name: 'pnpm', hint: 'installs with a frozen lockfile' },
];

export const NODE_VERSIONS = ['lts/*', '24', '22', '.nvmrc'];

export const BROWSERS: CiChoice[] = [
  { name: 'chromium', hint: 'bundled Chromium' },
  { name: 'firefox', hint: 'patched Firefox' },
  { name: 'webkit', hint: 'the engine behind Safari' },
];

export const SETUPS: CiChoice[] = [
  { name: 'install', hint: 'download browsers in each job' },
  { name: 'container', hint: 'official image, browsers included' },
];

export const SHARD_COUNTS = [1, 2, 3, 4, 6, 8];
export const TIMEOUTS = [15, 30, 60];
export const RETENTIONS = [7, 14, 30];

/** The container tag must match the project's @playwright/test. The test suite fails when this falls behind. */
export const PLAYWRIGHT_VERSION = '1.65.1';

/** GitHub's free plan runs this many jobs at once. */
export const FREE_PLAN_JOBS = 20;

export interface CiOptions {
  triggers: string[];
  packageManager: string;
  nodeVersion: string;
  browsers: string[];
  splitBrowsers: boolean;
  shards: number;
  setup: string;
  timeout: number;
  retention: number;
  cancelOldRuns: boolean;
}

export const DEFAULT_OPTIONS: CiOptions = {
  triggers: ['push', 'pull_request'],
  packageManager: 'npm',
  nodeVersion: 'lts/*',
  browsers: ['chromium', 'firefox', 'webkit'],
  splitBrowsers: false,
  shards: 1,
  setup: 'install',
  timeout: 30,
  retention: 14,
  cancelOldRuns: true,
};

export interface CiNote {
  level: 'warn' | 'info';
  text: string;
}

const chosenBrowsers = ({ browsers }: CiOptions) =>
  BROWSERS.filter(({ name }) => browsers.includes(name)).map(({ name }) => name);

/** One job per browser only means something with two browsers or more. */
const hasBrowserMatrix = (options: CiOptions) => options.splitBrowsers && chosenBrowsers(options).length > 1;

/** Several test jobs each hold part of the results, so their reports have to be merged into one. */
export const needsMerge = (options: CiOptions) => options.shards > 1 || hasBrowserMatrix(options);

export function testJobCount(options: CiOptions) {
  return options.shards * (hasBrowserMatrix(options) ? chosenBrowsers(options).length : 1);
}

function triggerLines({ triggers }: CiOptions) {
  // A workflow must have a trigger, and this one starts nothing by surprise.
  const chosen = TRIGGERS.some(({ name }) => triggers.includes(name)) ? triggers : ['workflow_dispatch'];
  const has = (name: string) => chosen.includes(name);
  return [
    'on:',
    ...(has('push') ? ['  push:', '    branches: [main]'] : []),
    ...(has('pull_request') ? ['  pull_request:', '    branches: [main]'] : []),
    ...(has('schedule') ? ['  schedule:', "    - cron: '0 3 * * *'"] : []),
    ...(has('workflow_dispatch') ? ['  workflow_dispatch:'] : []),
  ];
}

function setupSteps({ packageManager, nodeVersion }: CiOptions) {
  const pnpm = packageManager === 'pnpm';
  const version =
    nodeVersion === '.nvmrc'
      ? 'node-version-file: .nvmrc'
      : `node-version: ${nodeVersion === 'lts/*' ? nodeVersion : `'${nodeVersion}'`}`;
  return [
    '      - uses: actions/checkout@v5',
    ...(pnpm ? ['      - uses: pnpm/action-setup@v4'] : []),
    '      - uses: actions/setup-node@v5',
    '        with:',
    `          ${version}`,
    `          cache: ${packageManager}`,
    '      - name: Install dependencies',
    `        run: ${pnpm ? 'pnpm install --frozen-lockfile' : 'npm ci'}`,
  ];
}

const playwright = ({ packageManager }: CiOptions) =>
  packageManager === 'pnpm' ? 'pnpm exec playwright' : 'npx playwright';

function installSteps(options: CiOptions) {
  if (options.setup === 'container') return [];
  const browsers = hasBrowserMatrix(options) ? ['${{ matrix.project }}'] : chosenBrowsers(options);
  return [
    '      - name: Install Playwright browsers',
    `        run: ${[`${playwright(options)} install --with-deps`, ...browsers].join(' ')}`,
  ];
}

function testCommand(options: CiOptions) {
  const projects = hasBrowserMatrix(options)
    ? ['--project=${{ matrix.project }}']
    : chosenBrowsers(options).map((name) => `--project=${name}`);
  return [
    `${playwright(options)} test`,
    ...projects,
    ...(options.shards > 1 ? ['--shard=${{ matrix.shardIndex }}/${{ matrix.shardTotal }}'] : []),
    `--reporter=${needsMerge(options) ? 'blob' : 'html'}`,
  ].join(' ');
}

function matrixLines(options: CiOptions) {
  if (!needsMerge(options)) return [];
  const indexes = Array.from({ length: options.shards }, (_, index) => index + 1);
  return [
    '    strategy:',
    '      fail-fast: false',
    '      matrix:',
    ...(hasBrowserMatrix(options) ? [`        project: [${chosenBrowsers(options).join(', ')}]`] : []),
    ...(options.shards > 1
      ? [`        shardIndex: [${indexes.join(', ')}]`, `        shardTotal: [${options.shards}]`]
      : []),
  ];
}

function containerLines({ setup }: CiOptions) {
  if (setup !== 'container') return [];
  return [
    '    container:',
    `      image: mcr.microsoft.com/playwright:v${PLAYWRIGHT_VERSION}-noble`,
    '      options: --user 1001',
  ];
}

function reportUpload({ retention }: CiOptions) {
  return [
    '      - uses: actions/upload-artifact@v4',
    '        if: ${{ !cancelled() }}',
    '        with:',
    '          name: playwright-report',
    '          path: playwright-report/',
    `          retention-days: ${retention}`,
  ];
}

function blobUpload(options: CiOptions) {
  const parts = [
    ...(hasBrowserMatrix(options) ? ['${{ matrix.project }}'] : []),
    ...(options.shards > 1 ? ['${{ matrix.shardIndex }}'] : []),
  ];
  return [
    '      - uses: actions/upload-artifact@v4',
    '        if: ${{ !cancelled() }}',
    '        with:',
    `          name: blob-report-${parts.join('-')}`,
    '          path: blob-report/',
    '          retention-days: 1',
  ];
}

function mergeJob(options: CiOptions) {
  return [
    '',
    '  merge-reports:',
    '    name: Merge reports',
    '    if: ${{ !cancelled() }}',
    '    needs: [test]',
    '    runs-on: ubuntu-latest',
    '    timeout-minutes: 10',
    '    steps:',
    ...setupSteps(options),
    '      - uses: actions/download-artifact@v4',
    '        with:',
    '          path: all-blob-reports',
    '          pattern: blob-report-*',
    '          merge-multiple: true',
    '      - name: Merge into one HTML report',
    `        run: ${playwright(options)} merge-reports --reporter=html ./all-blob-reports`,
    ...reportUpload(options),
  ];
}

export function generateWorkflow(options: CiOptions) {
  const merge = needsMerge(options);
  return [
    'name: Playwright tests',
    '',
    ...triggerLines(options),
    '',
    'permissions:',
    '  contents: read',
    '',
    ...(options.cancelOldRuns
      ? [
          'concurrency:',
          '  group: ${{ github.workflow }}-${{ github.ref }}',
          '  cancel-in-progress: true',
          '',
        ]
      : []),
    'jobs:',
    '  test:',
    '    name: Test',
    '    runs-on: ubuntu-latest',
    `    timeout-minutes: ${options.timeout}`,
    ...containerLines(options),
    ...matrixLines(options),
    '    steps:',
    ...setupSteps(options),
    ...installSteps(options),
    '      - name: Run Playwright tests',
    `        run: ${testCommand(options)}`,
    ...(merge ? blobUpload(options) : reportUpload(options)),
    ...(merge ? mergeJob(options) : []),
    '',
  ].join('\n');
}

/** Things a visitor has to do or know for this workflow to work. Text uses `backticks` for code. */
export function workflowNotes(options: CiOptions): CiNote[] {
  const notes: CiNote[] = [];
  const { triggers, packageManager, nodeVersion, setup, shards } = options;

  if (!TRIGGERS.some(({ name }) => triggers.includes(name))) {
    notes.push({
      level: 'warn',
      text: 'No trigger chosen, so the workflow only starts by hand, through `workflow_dispatch`.',
    });
  }
  if (chosenBrowsers(options).length === 0) {
    notes.push({
      level: 'warn',
      text: 'No browser chosen, so every project in your config runs. Each one needs its browser available.',
    });
  }
  if (setup === 'container') {
    notes.push({
      level: 'warn',
      text: `The image is for Playwright ${PLAYWRIGHT_VERSION}. Keep its tag equal to your \`@playwright/test\` version, or the browsers won't be found.`,
    });
  }
  if (testJobCount(options) > FREE_PLAN_JOBS) {
    notes.push({
      level: 'warn',
      text: `This starts ${testJobCount(options)} test jobs, and GitHub's free plan runs ${FREE_PLAN_JOBS} at a time, so the rest wait in a queue.`,
    });
  }
  if (shards > 1) {
    notes.push({
      level: 'info',
      text: 'Set `fullyParallel: true` in your config so shards split by test. Otherwise they split by whole files and can end up uneven.',
    });
  }
  if (packageManager === 'pnpm') {
    notes.push({
      level: 'info',
      text: '`pnpm/action-setup` reads the pnpm version from the `packageManager` field in `package.json`, so set it there.',
    });
  }
  if (nodeVersion === '.nvmrc') {
    notes.push({ level: 'info', text: 'Commit a `.nvmrc` file at the root of your repository.' });
  }
  if (triggers.includes('schedule')) {
    notes.push({
      level: 'info',
      text: 'Scheduled runs only use the default branch, and can start late when GitHub is busy.',
    });
  }
  return notes;
}
