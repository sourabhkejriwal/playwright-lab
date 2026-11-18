import { useEffect, useId, useMemo, useState } from 'react';
import {
  LIMITS,
  SHARD_SETUP_SECONDS,
  SUITES,
  commands,
  formatSeconds,
  insights,
  simulate,
  speedup,
  testCount,
  type ShardRun,
  type Suite,
} from '../lib/parallel-sim';
import CodeText from './CodeText';

const PANEL = 'min-w-0 rounded-term border border-line bg-surface p-4';
const HEADING = 'text-xs text-muted';
const FILE_COLORS = ['bg-info', 'bg-pass', 'bg-pending', 'bg-purple', 'bg-muted', 'bg-bright'];

function Slider({
  label,
  value,
  max,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  max: number;
  disabled: boolean;
  onChange: (value: number) => void;
}) {
  const id = useId();
  return (
    <div className="grid gap-1">
      <div className="flex items-baseline justify-between gap-3 text-sm text-text">
        <label htmlFor={id}>{label}</label>
        <span aria-hidden="true" className="font-semibold text-bright">
          {value}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={1}
        max={max}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-11 w-full cursor-pointer accent-pass disabled:cursor-not-allowed"
      />
    </div>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="min-w-0 rounded-term border border-line bg-raised p-3">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-1 text-xl font-semibold text-bright">{value}</dd>
      <dd className="mt-1 text-xs text-muted">{note}</dd>
    </div>
  );
}

/** The drawing is decorative: the "what each worker ran" list under it gives the same schedule in words. */
function ShardTimeline({
  run,
  suite,
  workers,
  shards,
  scale,
}: {
  run: ShardRun;
  suite: Suite;
  workers: number;
  shards: number;
  scale: number;
}) {
  const percent = (seconds: number) => `${(seconds / scale) * 100}%`;
  const colorOf = (file: string) =>
    FILE_COLORS[suite.files.findIndex(({ name }) => name === file) % FILE_COLORS.length];
  const rows = Array.from({ length: workers }, (_, worker) => worker);

  return (
    <div className="grid gap-2">
      <h3 className="flex flex-wrap items-baseline justify-between gap-x-3 text-xs">
        <span className="text-info">
          shard {run.shard} of {shards}
        </span>
        <span className="text-muted">
          {run.tests} {run.tests === 1 ? 'test' : 'tests'} · done at {formatSeconds(run.total)}
        </span>
      </h3>
      <div aria-hidden="true" className="grid gap-1">
        {rows.map((worker) => (
          <div key={worker} className="grid grid-cols-[1.75rem_minmax(0,1fr)] items-center gap-1">
            <span className="text-xs text-muted">w{worker}</span>
            <div className="relative h-4 overflow-hidden rounded-[3px] border border-line bg-raised">
              <span
                className="absolute inset-y-0 left-0 bg-line-strong"
                style={{ width: percent(SHARD_SETUP_SECONDS) }}
              />
              {run.bars
                .filter((bar) => bar.worker === worker)
                .map(({ title, file, start, seconds }) => (
                  <span
                    key={title}
                    title={`${title}: ${formatSeconds(seconds)}`}
                    className={`absolute inset-y-0 border-r border-bg ${colorOf(file)} motion-safe:transition-[left,width]`}
                    style={{ left: percent(SHARD_SETUP_SECONDS + start), width: percent(seconds) }}
                  />
                ))}
            </div>
          </div>
        ))}
      </div>
      <details className="text-xs text-muted">
        <summary className="cursor-pointer py-1 hover:text-bright">what each worker ran</summary>
        {run.tests === 0 ? (
          <p className="mt-1 text-text">This shard has no tests to run.</p>
        ) : (
          <ul aria-label={`shard ${run.shard} workers`} className="mt-1 grid gap-1 text-text">
            {rows.map((worker) => {
              const bars = run.bars.filter((bar) => bar.worker === worker);
              const files = [...new Set(bars.map(({ file }) => file))];
              return (
                <li key={worker} className="break-words">
                  worker {worker}:{' '}
                  {bars.length === 0
                    ? 'never started'
                    : `${bars.length} ${bars.length === 1 ? 'test' : 'tests'} from ${files.join(', ')}`}
                </li>
              );
            })}
          </ul>
        )}
      </details>
    </div>
  );
}

export default function ParallelSimulator() {
  const [suiteId, setSuiteId] = useState(SUITES[0].id);
  const [workers, setWorkers] = useState(2);
  const [shards, setShards] = useState(1);
  const [fullyParallel, setFullyParallel] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => setHydrated(true), []);

  const suite = SUITES.find(({ id }) => id === suiteId) ?? SUITES[0];
  const settings = useMemo(() => ({ workers, shards, fullyParallel }), [workers, shards, fullyParallel]);
  const result = useMemo(() => simulate(suite, settings), [suite, settings]);
  const lessons = useMemo(() => insights(suite, settings), [suite, settings]);
  const faster = speedup(suite, settings);
  const wall = formatSeconds(result.wallClock);
  const middle = formatSeconds(result.wallClock / 2);

  return (
    <div className="mt-8 grid gap-5">
      <div className={`${PANEL} grid gap-4`}>
        <label className="flex flex-wrap items-center gap-3 text-sm text-text">
          test suite
          <select
            className="min-h-11 max-w-full rounded-term border border-line-strong bg-raised px-2 text-sm text-bright"
            value={suiteId}
            disabled={!hydrated}
            onChange={(event) => setSuiteId(event.target.value)}
          >
            {SUITES.map(({ id, label }) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <p className="font-prose text-sm text-text">
          {suite.summary} {testCount(suite)} tests in {suite.files.length} files.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <Slider
            label="workers per shard"
            value={workers}
            max={LIMITS.workers}
            disabled={!hydrated}
            onChange={setWorkers}
          />
          <Slider
            label="shards"
            value={shards}
            max={LIMITS.shards}
            disabled={!hydrated}
            onChange={setShards}
          />
        </div>
        <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-text">
          <input
            type="checkbox"
            checked={fullyParallel}
            disabled={!hydrated}
            onChange={(event) => setFullyParallel(event.target.checked)}
            className="size-4 accent-pass"
          />
          fullyParallel
        </label>
      </div>

      <section aria-labelledby="ps-result" className={PANEL}>
        <h2 id="ps-result" className={`${HEADING} mb-3`}>
          # result
        </h2>
        <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="pipeline time" value={wall} note="the slowest shard" />
          <Stat label="machine time" value={formatSeconds(result.machineTime)} note="all shards added up" />
          <Stat label="speedup" value={`${faster.toFixed(1)}×`} note="against 1 worker, 1 shard" />
          <Stat label="workers busy" value={`${Math.round(result.busy * 100)}%`} note="the rest is waiting" />
        </dl>
        <ul aria-label="What these settings show" className="mt-4 grid gap-2">
          {lessons.map(({ id, text }) => (
            <li key={id} className="flex gap-2 font-prose text-sm text-text">
              <span aria-hidden="true" className={id === 'healthy' ? 'text-pass' : 'text-pending'}>
                {id === 'healthy' ? '✓' : '!'}
              </span>
              <span className="min-w-0">
                <CodeText text={text} />
              </span>
            </li>
          ))}
        </ul>
        <p role="status" className="sr-only">
          Pipeline time {wall}, {faster.toFixed(1)} times faster than one worker.
        </p>
      </section>

      <section aria-labelledby="ps-timeline" className={PANEL}>
        <h2 id="ps-timeline" className={`${HEADING} mb-3`}>
          # timeline
        </h2>
        <div className="grid gap-5">
          {result.shards.map((run) => (
            <ShardTimeline
              key={run.shard}
              run={run}
              suite={suite}
              workers={workers}
              shards={shards}
              scale={result.wallClock}
            />
          ))}
        </div>
        <div aria-hidden="true" className="mt-2 ml-8 flex justify-between text-xs text-muted">
          <span>0s</span>
          <span>{middle}</span>
          <span>{wall}</span>
        </div>
        <ul aria-label="Timeline key" className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
          <li className="flex items-center gap-1.5">
            <span aria-hidden="true" className="size-2.5 rounded-[2px] bg-line-strong" />
            ci setup ({SHARD_SETUP_SECONDS}s)
          </li>
          {suite.files.map(({ name }, at) => (
            <li key={name} className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className={`size-2.5 rounded-[2px] ${FILE_COLORS[at % FILE_COLORS.length]}`}
              />
              {name}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="ps-commands" className={PANEL}>
        <h2 id="ps-commands" className={`${HEADING} mb-3`}>
          # {shards === 1 ? 'the command' : 'one command per ci job'}
        </h2>
        <pre
          tabIndex={0}
          role="region"
          aria-label="Commands"
          className="max-h-56 overflow-auto rounded-term bg-raised p-3 text-xs leading-relaxed text-text"
        >
          <code>{commands(settings).join('\n')}</code>
        </pre>
      </section>
    </div>
  );
}
