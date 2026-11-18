import { useEffect, useMemo, useRef, useState } from 'react';
import {
  SCENARIOS,
  buildSteps,
  currentTest,
  fixtureStates,
  fixturesSource,
  graphLayers,
  lifetimes,
  specFiles,
  specSource,
  workersIn,
  type FixtureDef,
  type FixtureState,
  type Scenario,
  type Span,
  type Step,
  type StepKind,
} from '../lib/fixture-graph';
import CodeText from './CodeText';

const PLAY_DELAY_MS = 1600;
const BUTTON =
  'min-h-11 cursor-pointer rounded-term border border-line-strong px-3 py-1.5 text-xs text-pass hover:border-pass disabled:cursor-not-allowed disabled:border-line disabled:text-muted';
const PANEL = 'min-w-0 rounded-term border border-line bg-surface p-4';
const HEADING = 'text-xs text-muted';

const STATES: Record<FixtureState, { word: string; box: string; text: string }> = {
  idle: { word: 'not created', box: 'fill-surface stroke-line', text: 'fill-muted' },
  setup: { word: 'setting up', box: 'fill-raised stroke-pending', text: 'fill-pending' },
  ready: { word: 'ready', box: 'fill-raised stroke-pass', text: 'fill-pass' },
  teardown: { word: 'tearing down', box: 'fill-raised stroke-purple', text: 'fill-purple' },
  done: { word: 'torn down', box: 'fill-surface stroke-line-strong', text: 'fill-muted' },
};

const STATE_COLORS: Record<FixtureState, string> = {
  idle: 'text-muted',
  setup: 'text-pending',
  ready: 'text-pass',
  teardown: 'text-purple',
  done: 'text-muted',
};

const KINDS: Record<StepKind, { word: string; color: string }> = {
  'worker-start': { word: 'worker', color: 'text-info' },
  setup: { word: 'setup', color: 'text-pending' },
  test: { word: 'test', color: 'text-pass' },
  teardown: { word: 'teardown', color: 'text-purple' },
  'worker-stop': { word: 'worker', color: 'text-info' },
};

const WIDTH = 340;
const NODE_HEIGHT = 58;
const ROW_HEIGHT = 86;
const GAP = 12;

/** Spreads a row of nodes evenly across the drawing. */
function rowBoxes(count: number) {
  const width = Math.min(150, (WIDTH - GAP * (count - 1)) / count);
  const used = width * count + GAP * (count - 1);
  return Array.from({ length: count }, (_, at) => ({ x: (WIDTH - used) / 2 + at * (width + GAP), width }));
}

function Arrow({
  x1,
  y1,
  x2,
  y2,
  active,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  active?: boolean;
}) {
  const tip = y2 - 1;
  const stroke = active ? 'stroke-info' : 'stroke-line-strong';
  return (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={tip - 6} strokeWidth="1.5" className={stroke} />
      <polygon
        points={`${x2 - 4},${tip - 7} ${x2 + 4},${tip - 7} ${x2},${tip}`}
        className={active ? 'fill-info' : 'fill-line-strong'}
      />
    </g>
  );
}

/** The drawing is decorative: the lifetimes list beside it gives every fixture's state in words. */
function Graph({
  scenario,
  steps,
  index,
  worker,
}: {
  scenario: Scenario;
  steps: Step[];
  index: number;
  worker: number;
}) {
  const layers = graphLayers(scenario);
  const states = fixtureStates(scenario, steps, index, worker);
  const test = currentTest(steps, index, worker);

  const places = new Map<string, { fixture: FixtureDef; x: number; y: number; width: number }>();
  layers.forEach((layer, row) => {
    const boxes = rowBoxes(layer.length);
    layer.forEach((fixture, at) => {
      places.set(fixture.name, { fixture, ...boxes[at], y: row * ROW_HEIGHT + 2 });
    });
  });

  const testY = layers.length * ROW_HEIGHT + 2;
  const height = testY + 40;

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${height}`}
      aria-hidden="true"
      className="mx-auto block w-full max-w-md font-mono"
    >
      {[...places.values()].flatMap(({ fixture, x, y, width }) =>
        fixture.deps.map((dep) => {
          const from = places.get(dep)!;
          return (
            <Arrow
              key={`${dep}-${fixture.name}`}
              x1={from.x + from.width / 2}
              y1={from.y + NODE_HEIGHT}
              x2={x + width / 2}
              y2={y}
            />
          );
        }),
      )}
      {test?.uses.map((name) => {
        const from = places.get(name)!;
        return (
          <Arrow
            key={`test-${name}`}
            active
            x1={from.x + from.width / 2}
            y1={from.y + NODE_HEIGHT}
            x2={WIDTH / 2}
            y2={testY}
          />
        );
      })}

      {[...places.values()].map(({ fixture, x, y, width }) => {
        const state = STATES[states[fixture.name]];
        const middle = x + width / 2;
        return (
          <g key={fixture.name}>
            <rect
              x={x}
              y={y}
              width={width}
              height={NODE_HEIGHT}
              rx="6"
              strokeWidth="1.5"
              strokeDasharray={fixture.auto ? '5 3' : undefined}
              className={`${state.box} motion-safe:transition-colors`}
            />
            <text x={middle} y={y + 18} textAnchor="middle" fontSize="13" className="fill-bright">
              {fixture.name}
            </text>
            <text x={middle} y={y + 33} textAnchor="middle" fontSize="10" className="fill-muted">
              {fixture.scope}
              {fixture.auto ? ' · auto' : ''}
            </text>
            <text x={middle} y={y + 49} textAnchor="middle" fontSize="10" className={state.text}>
              {state.word}
            </text>
          </g>
        );
      })}

      <rect
        x="1"
        y={testY}
        width={WIDTH - 2}
        height="36"
        rx="6"
        strokeWidth="1.5"
        strokeDasharray={test ? undefined : '5 3'}
        className={test ? 'fill-raised stroke-info' : 'fill-surface stroke-line'}
      />
      <text
        x={WIDTH / 2}
        y={testY + 22}
        textAnchor="middle"
        fontSize="12"
        className={test ? 'fill-bright' : 'fill-muted'}
      >
        {test ? `test: ${test.title}` : 'no test running'}
      </text>
    </svg>
  );
}

function Track({ spans, total, now, color }: { spans: Span[]; total: number; now: number; color: string }) {
  const percent = (value: number) => `${(value / total) * 100}%`;
  return (
    <div
      aria-hidden="true"
      className="relative h-3 overflow-hidden rounded-[3px] border border-line bg-raised"
    >
      {spans.map(({ from, to, failed }) => (
        <span
          key={from}
          className={`absolute inset-y-0 ${failed ? 'bg-fail' : color}`}
          style={{ left: percent(from), width: percent(to - from) }}
        />
      ))}
      {now > 0 && now < total ? (
        <span className="absolute inset-y-0 w-px bg-bright" style={{ left: percent(now) }} />
      ) : null}
    </div>
  );
}

function Lifetimes({
  scenario,
  steps,
  index,
  worker,
}: {
  scenario: Scenario;
  steps: Step[];
  index: number;
  worker: number;
}) {
  const { total, now, fixtures, tests } = lifetimes(scenario, steps, index, worker);
  const states = fixtureStates(scenario, steps, index, worker);
  const scopes = new Map(scenario.fixtures.map(({ name, scope }) => [name, scope]));

  return (
    <ul aria-label={`worker ${worker} lifetimes`} className="grid gap-3">
      {fixtures.map(({ name, spans }) => {
        const state = states[name];
        return (
          <li key={name} className="grid gap-1">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-xs">
              <span className="min-w-0 break-words text-text">
                {name} <span className="text-muted">({scopes.get(name)})</span>
              </span>
              <span className="shrink-0 text-muted">
                <span className={STATE_COLORS[state]}>{STATES[state].word}</span> · created {spans.length}×
              </span>
            </div>
            <Track
              spans={spans}
              total={total}
              now={now}
              color={scopes.get(name) === 'worker' ? 'bg-purple' : 'bg-info'}
            />
          </li>
        );
      })}
      <li className="grid gap-1">
        <div className="flex items-baseline justify-between gap-3 text-xs">
          <span className="text-text">test bodies</span>
          <span className="shrink-0 text-muted">{tests.length} run</span>
        </div>
        <Track spans={tests} total={total} now={now} color="bg-pass" />
      </li>
    </ul>
  );
}

export default function FixtureGraph() {
  const [scenarioId, setScenarioId] = useState(SCENARIOS[0].id);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const timeline = useRef<HTMLOListElement>(null);
  const output = useRef<HTMLPreElement>(null);

  useEffect(() => setHydrated(true), []);

  const scenario = SCENARIOS.find(({ id }) => id === scenarioId) ?? SCENARIOS[0];
  const steps = useMemo(() => buildSteps(scenario), [scenario]);
  const workers = useMemo(() => workersIn(steps), [steps]);
  const step = steps[index];
  const last = steps.length - 1;
  const parallel = scenario.workers > 1;
  const graphWorkers = parallel ? workers : [step.worker];
  const printed = steps.slice(0, index + 1).flatMap((item, at) => (item.line ? [{ item, at }] : []));

  useEffect(() => {
    if (!playing) return;
    if (index >= last) {
      setPlaying(false);
      return;
    }
    const timer = window.setTimeout(() => setIndex((current) => current + 1), PLAY_DELAY_MS);
    return () => clearTimeout(timer);
  }, [playing, index, last]);

  // Keep the current step and the newest output in view, moving only these lists and never the page.
  useEffect(() => {
    const list = timeline.current;
    const current = list?.querySelector<HTMLElement>('[aria-current="step"]');
    if (list && current) {
      const top = current.offsetTop; // The list is positioned, so this is measured from its top.
      if (top < list.scrollTop) list.scrollTop = top;
      else if (top + current.offsetHeight > list.scrollTop + list.clientHeight) {
        list.scrollTop = top + current.offsetHeight - list.clientHeight;
      }
    }
    if (output.current) output.current.scrollTop = output.current.scrollHeight;
  }, [index, scenarioId]);

  const goTo = (next: number) => {
    setPlaying(false);
    setIndex(next);
  };

  const togglePlay = () => {
    if (!playing && index >= last) setIndex(0);
    setPlaying(!playing);
  };

  const files = [
    { name: 'fixtures.ts', code: fixturesSource(scenario) },
    ...specFiles(scenario).map((name) => ({ name, code: specSource(scenario, name) })),
  ];
  const kind = KINDS[step.kind];

  return (
    <div className="mt-8 grid gap-5">
      <div className={`${PANEL} grid gap-3`}>
        <label className="flex flex-wrap items-center gap-3 text-sm text-text">
          scenario
          <select
            className="min-h-11 max-w-full rounded-term border border-line-strong bg-raised px-2 text-sm text-bright"
            value={scenarioId}
            disabled={!hydrated}
            onChange={(event) => {
              setScenarioId(event.target.value);
              goTo(0);
            }}
          >
            {SCENARIOS.map(({ id, label }) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <p className="font-prose text-sm text-text">{scenario.summary}</p>
        <div className="grid gap-3 lg:grid-cols-2">
          {files.map(({ name, code }) => (
            <div key={name} className="grid min-w-0 content-start gap-1">
              <p className="text-xs text-muted">{name}</p>
              <pre
                tabIndex={0}
                role="region"
                aria-label={name}
                className="max-h-72 overflow-auto rounded-term bg-raised p-3 text-xs text-text"
              >
                <code>{code}</code>
              </pre>
            </div>
          ))}
        </div>
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <section aria-labelledby="fg-timeline" className={PANEL}>
          <h2 id="fg-timeline" className={HEADING}>
            # run order
          </h2>
          <ol
            ref={timeline}
            tabIndex={0}
            aria-labelledby="fg-timeline"
            className="relative mt-3 grid max-h-[32rem] gap-1 overflow-y-auto"
          >
            {steps.map(({ title, kind: stepKind, worker }, at) => (
              <li key={`${title}-${at}`}>
                <button
                  type="button"
                  disabled={!hydrated}
                  aria-current={at === index ? 'step' : undefined}
                  onClick={() => goTo(at)}
                  className={`flex min-h-11 w-full cursor-pointer items-center justify-between gap-3 rounded-term border px-3 py-1.5 text-left text-sm ${
                    at === index
                      ? 'border-info bg-raised text-bright'
                      : 'border-transparent text-muted hover:border-line-strong'
                  }`}
                >
                  <span className="min-w-0 break-words">
                    {at + 1}. {title}
                  </span>
                  <span className={`shrink-0 text-xs ${KINDS[stepKind].color}`}>
                    {parallel ? `w${worker} ` : ''}
                    {KINDS[stepKind].word}
                  </span>
                </button>
              </li>
            ))}
          </ol>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              className={BUTTON}
              disabled={!hydrated || index === 0}
              onClick={() => goTo(index - 1)}
            >
              back
            </button>
            <button
              type="button"
              className={BUTTON}
              disabled={!hydrated || index === last}
              onClick={() => goTo(index + 1)}
            >
              next
            </button>
            <button type="button" className={BUTTON} disabled={!hydrated} onClick={togglePlay}>
              {playing ? 'pause' : 'play'}
            </button>
            <button type="button" className={BUTTON} disabled={!hydrated} onClick={() => goTo(0)}>
              restart
            </button>
          </div>
        </section>

        <div className="grid min-w-0 gap-5">
          <section aria-labelledby="fg-step" className={PANEL}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="fg-step" className="text-sm font-semibold text-bright">
                {step.title}
              </h2>
              <p className={`text-xs ${step.failed ? 'text-fail' : kind.color}`}>
                {step.failed ? 'failed' : kind.word}
              </p>
            </div>
            <p role="status" className="mt-2 font-prose text-sm text-text">
              <span className="sr-only">
                Step {index + 1} of {steps.length}: {step.title}.{' '}
              </span>
              <CodeText text={step.detail} />
            </p>
          </section>

          <section aria-labelledby="fg-graph" className={PANEL}>
            <h2 id="fg-graph" className={`${HEADING} mb-3`}>
              # fixture graph
            </h2>
            <div className="grid gap-5">
              {graphWorkers.map((worker) => (
                <div key={worker} className="grid gap-2">
                  <p className="text-xs text-info">worker {worker}</p>
                  <Graph scenario={scenario} steps={steps} index={index} worker={worker} />
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted">
              Arrows point from a fixture to what needs it. A dashed box is an auto fixture.
            </p>
          </section>

          <section aria-labelledby="fg-lifetimes" className={PANEL}>
            <h2 id="fg-lifetimes" className={`${HEADING} mb-3`}>
              # lifetimes
            </h2>
            <div className="grid gap-5">
              {workers.map((worker) => (
                <div key={worker} className="grid gap-3">
                  <h3 className="text-xs text-info">worker {worker}</h3>
                  <Lifetimes scenario={scenario} steps={steps} index={index} worker={worker} />
                </div>
              ))}
            </div>
          </section>

          <section aria-labelledby="fg-output" className={PANEL}>
            <h2 id="fg-output" className={`${HEADING} mb-3`}>
              # console output
            </h2>
            <pre
              ref={output}
              tabIndex={0}
              role="region"
              aria-label="Console output"
              className="max-h-64 min-h-16 overflow-auto rounded-term bg-raised p-3 text-xs leading-relaxed"
            >
              <code>
                {printed.map(({ item, at }) => (
                  <span key={at} className={`block ${at === index ? 'text-bright' : 'text-muted'}`}>
                    {parallel ? `[worker ${item.worker}] ` : ''}
                    {item.line}
                  </span>
                ))}
              </code>
            </pre>
          </section>
        </div>
      </div>
    </div>
  );
}
