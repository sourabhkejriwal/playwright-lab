// The fixture graph explainer's data and simulator. Pure, and tests/fixture-graph.spec.ts runs the code shown for
// every scenario on real Playwright: what it prints, worker by worker, must equal what `buildSteps` predicts.

export type FixtureScope = 'test' | 'worker';
export type FixtureState = 'idle' | 'setup' | 'ready' | 'teardown' | 'done';
export type StepKind = 'worker-start' | 'setup' | 'test' | 'teardown' | 'worker-stop';

export interface FixtureDef {
  name: string;
  scope: FixtureScope;
  deps: string[];
  auto?: boolean;
}

export interface TestDef {
  title: string;
  file: string;
  uses: string[];
  fails?: boolean;
}

export interface Scenario {
  id: string;
  label: string;
  summary: string;
  /** With 2 workers, each spec file runs in its own worker. */
  workers: 1 | 2;
  fixtures: FixtureDef[];
  tests: TestDef[];
}

const CHECKOUT = 'checkout.spec.ts';
const SEARCH = 'search.spec.ts';

const server: FixtureDef = { name: 'server', scope: 'worker', deps: [] };
const api: FixtureDef = { name: 'api', scope: 'test', deps: ['server'] };

export const SCENARIOS: Scenario[] = [
  {
    id: 'chain',
    label: 'dependency chain',
    summary: 'Dependencies are ready first and leave last, and each test gets fresh copies.',
    workers: 1,
    fixtures: [
      { name: 'db', scope: 'test', deps: [] },
      { name: 'user', scope: 'test', deps: ['db'] },
      { name: 'cart', scope: 'test', deps: ['user'] },
    ],
    tests: [
      { title: 'adds an item', file: CHECKOUT, uses: ['cart'] },
      { title: 'removes an item', file: CHECKOUT, uses: ['cart'] },
    ],
  },
  {
    id: 'lazy',
    label: 'only what a test asks for',
    summary: 'A fixture runs only when a test, or a fixture that test needs, asks for it.',
    workers: 1,
    fixtures: [
      { name: 'db', scope: 'test', deps: [] },
      { name: 'mailbox', scope: 'test', deps: [] },
      { name: 'user', scope: 'test', deps: ['db'] },
    ],
    tests: [
      { title: 'shows the profile', file: CHECKOUT, uses: ['user'] },
      { title: 'sends a receipt', file: CHECKOUT, uses: ['mailbox'] },
      { title: 'adds two numbers', file: CHECKOUT, uses: [] },
    ],
  },
  {
    id: 'worker',
    label: 'shared by a worker',
    summary: 'A worker fixture is created once and shared by every test that worker runs.',
    workers: 1,
    fixtures: [server, api],
    tests: [
      { title: 'lists orders', file: CHECKOUT, uses: ['api'] },
      { title: 'creates an order', file: CHECKOUT, uses: ['api'] },
      { title: 'cancels an order', file: CHECKOUT, uses: ['api'] },
    ],
  },
  {
    id: 'auto',
    label: 'auto fixtures',
    summary: 'An auto fixture runs for every test, and no test has to ask for it.',
    workers: 1,
    fixtures: [
      { name: 'telemetry', scope: 'worker', deps: [], auto: true },
      { name: 'consoleGuard', scope: 'test', deps: [], auto: true },
      { name: 'user', scope: 'test', deps: [] },
    ],
    tests: [
      { title: 'shows the profile', file: CHECKOUT, uses: ['user'] },
      { title: 'adds two numbers', file: CHECKOUT, uses: [] },
    ],
  },
  {
    id: 'two-workers',
    label: 'two workers',
    summary: 'Workers share nothing, so each one creates its own copy of a worker fixture.',
    workers: 2,
    fixtures: [server, api],
    tests: [
      { title: 'pays by card', file: CHECKOUT, uses: ['api'] },
      { title: 'pays by invoice', file: CHECKOUT, uses: ['api'] },
      { title: 'finds a product', file: SEARCH, uses: ['api'] },
      { title: 'filters by price', file: SEARCH, uses: ['api'] },
    ],
  },
  {
    id: 'failure',
    label: 'a test fails',
    summary: 'A failure ends the worker, so the next test starts in a new one and worker fixtures run again.',
    workers: 1,
    fixtures: [server, api],
    tests: [
      { title: 'lists orders', file: CHECKOUT, uses: ['api'] },
      { title: 'loses an order', file: CHECKOUT, uses: ['api'], fails: true },
      { title: 'creates an order', file: CHECKOUT, uses: ['api'] },
    ],
  },
];

/** Plain-language rules shown under the explainer. The spec checks each one on real Playwright. */
export const RULES: { name: string; meaning: string }[] = [
  { name: 'lazy', meaning: 'A fixture nothing asks for never runs, unless it is marked `auto`.' },
  { name: 'dependencies first', meaning: 'A fixture starts only after everything it depends on is ready.' },
  { name: 'reverse teardown', meaning: 'Teardown runs newest first, so a fixture never loses a dependency.' },
  {
    name: 'scope direction',
    meaning: 'A test fixture can use a worker fixture. A worker fixture can never use a test fixture.',
  },
];

/** The error real Playwright reports when a worker fixture depends on a test fixture. */
export const SCOPE_ERROR = 'worker fixture "server" cannot depend on a test fixture "user"';

const quote = (text: string) => `'${text.replace(/'/g, "\\'")}'`;

function fixtureSource({ name, scope, deps, auto }: FixtureDef) {
  const args = deps.length > 0 ? `{ ${deps.join(', ')} }` : '{}';
  const options = [...(scope === 'worker' ? ["scope: 'worker'"] : []), ...(auto ? ['auto: true'] : [])];
  const body = (indent: string) =>
    [
      `${indent}console.log('setup ${name}');`,
      `${indent}await use('${name}');`,
      `${indent}console.log('teardown ${name}');`,
    ].join('\n');

  if (options.length === 0) return `  ${name}: async (${args}, use) => {\n${body('    ')}\n  },`;
  return `  ${name}: [\n    async (${args}, use) => {\n${body('      ')}\n    },\n    { ${options.join(', ')} },\n  ],`;
}

const typeList = (fixtures: FixtureDef[]) =>
  fixtures.length > 0 ? `{ ${fixtures.map(({ name }) => `${name}: string`).join('; ')} }` : '{}';

export function fixturesSource({ fixtures }: Scenario) {
  const testTypes = typeList(fixtures.filter(({ scope }) => scope === 'test'));
  const workerTypes = typeList(fixtures.filter(({ scope }) => scope === 'worker'));
  return [
    `import { test as base } from '@playwright/test';`,
    '',
    `export const test = base.extend<${testTypes}, ${workerTypes}>({`,
    ...fixtures.map(fixtureSource),
    '});',
    '',
  ].join('\n');
}

export const specFiles = ({ tests }: Scenario) => [...new Set(tests.map(({ file }) => file))];

export function specSource(scenario: Scenario, file: string) {
  const tests = scenario.tests
    .filter((item) => item.file === file)
    .map(({ title, uses, fails }) => {
      const args = uses.length > 0 ? `{ ${uses.join(', ')} }` : '';
      const failure = fails ? `\n  throw new Error('order not found');` : '';
      return `test(${quote(title)}, async (${args}) => {\n  console.log(${quote(`test ${title}`)});${failure}\n});`;
    });
  return [`import { test } from './fixtures';`, '', tests.join('\n\n'), ''].join('\n');
}

export interface Step {
  kind: StepKind;
  worker: number;
  title: string;
  detail: string;
  /** What this step prints, if anything. */
  line?: string;
  fixture?: string;
  test?: TestDef;
  failed?: boolean;
}

const list = (names: string[]) => {
  const quoted = names.map((name) => `\`${name}\``);
  return quoted.length > 1 ? `${quoted.slice(0, -1).join(', ')} and ${quoted.at(-1)}` : quoted[0];
};

/** The fixtures a test needs, in the order Playwright sets them up: auto fixtures first, then what it asks for. */
function setupOrder(scenario: Scenario, test: TestDef) {
  const byName = new Map(scenario.fixtures.map((fixture) => [fixture.name, fixture]));
  const ordered: FixtureDef[] = [];
  const visit = (name: string) => {
    const fixture = byName.get(name)!;
    if (ordered.includes(fixture)) return;
    fixture.deps.forEach(visit);
    ordered.push(fixture);
  };
  const autos = (scope: FixtureScope) =>
    scenario.fixtures.filter((fixture) => fixture.auto && fixture.scope === scope);
  [...autos('worker'), ...autos('test')].forEach(({ name }) => visit(name));
  test.uses.forEach(visit);
  return ordered;
}

function setupReason(scenario: Scenario, test: TestDef, fixture: FixtureDef) {
  if (fixture.auto)
    return `It is marked \`auto\`, so it runs even though \`${test.title}\` never asks for it.`;
  const needs = scenario.fixtures
    .filter((other) => other.deps.includes(fixture.name))
    .filter((other) => setupOrder(scenario, test).includes(other))
    .map(({ name }) => name);
  const direct = test.uses.includes(fixture.name);
  if (direct && needs.length === 0) return `\`${test.title}\` asks for it by name.`;
  return `${list(needs)} depends on it, so it has to be ready first.`;
}

/** Runs one worker's share of the tests. A failure ends the worker, so this can return several workers. */
function runTests(scenario: Scenario, tests: TestDef[], firstWorker: number) {
  const workers: Step[][] = [];
  let steps: Step[] | null = null;
  let worker = firstWorker - 1;
  let shared: FixtureDef[] = [];

  const stopWorker = (reason: string) => {
    if (!steps) return;
    [...shared].reverse().forEach(({ name }, position) => {
      steps!.push({
        kind: 'teardown',
        worker,
        fixture: name,
        title: `teardown ${name}`,
        line: `teardown ${name}`,
        detail: position === 0 ? reason : 'Worker fixtures also leave newest first.',
      });
    });
    steps.push({
      kind: 'worker-stop',
      worker,
      title: `worker ${worker} stops`,
      detail: 'Everything this worker created is gone, and its process exits.',
    });
    workers.push(steps);
    steps = null;
    shared = [];
  };

  for (const test of tests) {
    if (!steps) {
      worker += 1;
      steps = [
        {
          kind: 'worker-start',
          worker,
          title: `worker ${worker} starts`,
          detail:
            workers.length > 0
              ? 'Playwright starts a new process for the remaining tests. It remembers nothing from the last one.'
              : `A worker is a separate process that runs tests one at a time. Next up is \`${test.title}\`.`,
        },
      ];
    }

    const current = steps;
    const needed = setupOrder(scenario, test);
    const reused = needed.filter((fixture) => shared.includes(fixture)).map(({ name }) => name);
    const created: FixtureDef[] = [];

    for (const fixture of needed) {
      if (shared.includes(fixture)) continue;
      if (fixture.scope === 'worker') shared.push(fixture);
      else created.push(fixture);
      current.push({
        kind: 'setup',
        worker,
        test,
        fixture: fixture.name,
        title: `setup ${fixture.name}`,
        line: `setup ${fixture.name}`,
        detail: setupReason(scenario, test, fixture),
      });
    }

    const given = test.uses.length > 0 ? `It receives ${list(test.uses)}.` : 'It asks for no fixtures.';
    const reuse = reused.length > 0 ? ` ${list(reused)} is reused, so it was not set up again.` : '';
    current.push({
      kind: 'test',
      worker,
      test,
      failed: test.fails,
      title: `run ${test.title}`,
      line: `test ${test.title}`,
      detail: test.fails
        ? `The test throws. Teardown still runs, so nothing is left behind. ${given}`
        : `Setup is finished, so the test body runs. ${given}${reuse}`,
    });

    [...created].reverse().forEach(({ name }, position) => {
      current.push({
        kind: 'teardown',
        worker,
        test,
        fixture: name,
        title: `teardown ${name}`,
        line: `teardown ${name}`,
        detail:
          position === 0
            ? `The test is over. Test fixtures are torn down now, starting with the newest.`
            : `Whatever depended on it has already gone, so it is now safe to remove.`,
      });
    });

    if (test.fails) {
      stopWorker(
        shared.length > 0
          ? 'A failure can leave a worker in a bad state, so Playwright throws the worker away, shared fixtures included.'
          : '',
      );
    }
  }
  stopWorker('The worker has no tests left, so its fixtures finally leave. They outlived every test.');
  return workers;
}

/** Each worker's steps, in the order that worker runs them. */
export function workerRuns(scenario: Scenario) {
  const groups =
    scenario.workers === 1
      ? [scenario.tests]
      : specFiles(scenario).map((file) => scenario.tests.filter((test) => test.file === file));
  const runs: Step[][] = [];
  for (const tests of groups) runs.push(...runTests(scenario, tests, runs.length));
  return runs;
}

/** What each worker prints, which is what the real run must print too. */
export const expectedOutput = (scenario: Scenario) =>
  workerRuns(scenario).map((steps) => steps.flatMap(({ line }) => (line ? [line] : [])));

/** Every step of the run. Parallel workers take turns here, because they really do run side by side. */
export function buildSteps(scenario: Scenario) {
  const runs = workerRuns(scenario);
  if (scenario.workers === 1) return runs.flat();
  const steps: Step[] = [];
  for (let at = 0; at < Math.max(...runs.map((run) => run.length)); at += 1) {
    for (const run of runs) if (run[at]) steps.push(run[at]);
  }
  return steps;
}

export const workersIn = (steps: Step[]) => [...new Set(steps.map(({ worker }) => worker))];

/** Each fixture's state in one worker, after the steps up to and including `index`. */
export function fixtureStates(scenario: Scenario, steps: Step[], index: number, worker: number) {
  const states = Object.fromEntries(
    scenario.fixtures.map(({ name }) => [name, 'idle' as FixtureState]),
  ) as Record<string, FixtureState>;

  steps.slice(0, index + 1).forEach((step, at) => {
    if (step.worker !== worker || !step.fixture) return;
    const settled = at < index;
    if (step.kind === 'setup') states[step.fixture] = settled ? 'ready' : 'setup';
    if (step.kind === 'teardown') states[step.fixture] = settled ? 'done' : 'teardown';
  });
  return states;
}

/** The test a worker is on at `index`. Null once its tests are over. */
export function currentTest(steps: Step[], index: number, worker: number) {
  const seen = steps.slice(0, index + 1).filter((step) => step.worker === worker);
  return seen.at(-1)?.test ?? null;
}

export interface Span {
  from: number;
  to: number;
  failed?: boolean;
}

export interface Lifetime {
  name: string;
  spans: Span[];
}

/** When each fixture and test was alive in one worker, measured in that worker's own steps. */
export function lifetimes(scenario: Scenario, steps: Step[], index: number, worker: number) {
  const own = steps.map((step, at) => ({ step, at })).filter(({ step }) => step.worker === worker);
  const reached = own.filter(({ at }) => at <= index);
  const now = reached.length;

  const fixtures: Lifetime[] = scenario.fixtures.map(({ name }) => {
    const spans: Span[] = [];
    reached.forEach(({ step }, tick) => {
      if (step.fixture !== name) return;
      if (step.kind === 'setup') spans.push({ from: tick, to: now });
      if (step.kind === 'teardown') spans[spans.length - 1].to = tick + 1;
    });
    return { name, spans };
  });
  const tests: Span[] = reached.flatMap(({ step }, tick) =>
    step.kind === 'test' ? [{ from: tick, to: tick + 1, failed: step.failed }] : [],
  );
  return { total: own.length, now, fixtures, tests };
}

/** Rows of the graph, top to bottom: a fixture sits one row below its deepest dependency. */
export function graphLayers({ fixtures }: Scenario) {
  const byName = new Map(fixtures.map((fixture) => [fixture.name, fixture]));
  const depth = (fixture: FixtureDef): number =>
    fixture.deps.length === 0 ? 0 : 1 + Math.max(...fixture.deps.map((dep) => depth(byName.get(dep)!)));
  const layers: FixtureDef[][] = [];
  for (const fixture of fixtures) (layers[depth(fixture)] ??= []).push(fixture);
  return layers;
}
