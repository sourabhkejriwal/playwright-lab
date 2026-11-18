import { useEffect, useMemo, useState } from 'react';
import {
  SCENARIOS,
  buildSteps,
  type CheckState,
  type Outcome,
  type PageState,
  type Scenario,
} from '../lib/auto-waiting';
import CodeText from './CodeText';

const PLAY_DELAY_MS = 1800;
const BUTTON =
  'min-h-11 cursor-pointer rounded-term border border-line-strong px-3 py-1.5 text-xs text-pass hover:border-pass disabled:cursor-not-allowed disabled:border-line disabled:text-muted';
const PANEL = 'min-w-0 rounded-term border border-line bg-surface p-4';
const HEADING = 'text-xs text-muted';

const CHECK_MARKS: Record<CheckState, { glyph: string; word: string; color: string }> = {
  idle: { glyph: '·', word: 'not yet', color: 'text-muted' },
  blocked: { glyph: '✘', word: 'blocked', color: 'text-fail' },
  passed: { glyph: '✓', word: 'passed', color: 'text-pass' },
};

const OUTCOMES: Record<Outcome, { word: string; color: string }> = {
  running: { word: 'waiting', color: 'text-pending' },
  passed: { word: 'passed', color: 'text-pass' },
  failed: { word: 'failed', color: 'text-fail' },
};

const PAGE_NOTES: Record<PageState, string> = {
  absent: 'not in the DOM yet',
  hidden: 'in the DOM, display: none',
  moving: 'sliding into place',
  disabled: 'disabled',
  covered: 'covered by an overlay',
  readonly: 'readonly',
  ready: 'ready',
  done: 'action performed',
};

/** A drawing of the page under test. Its state is also written out in the caption beneath it. */
function PagePreview({ state, action }: { state: PageState; action: Scenario['action'] }) {
  const control = 'inline-block rounded-term border px-4 py-2 text-sm';
  const isInput = action === 'fill';
  const text = isInput ? (state === 'done' ? 'Ada' : 'name') : state === 'done' ? 'saved ✓' : 'save';

  let drawing = <span className={`${control} border-pass text-pass`}>{text}</span>;
  if (state === 'absent' || state === 'hidden') {
    drawing = <span className={`${control} border-dashed border-line-strong text-muted`}>no box</span>;
  } else if (state === 'disabled' || state === 'readonly') {
    drawing = <span className={`${control} border-line text-muted`}>{text}</span>;
  } else if (state === 'moving') {
    drawing = (
      <span
        className={`${control} border-pending text-pending motion-safe:animate-[aw-drift_0.7s_ease-in-out_infinite_alternate]`}
      >
        {text}
      </span>
    );
  } else if (state === 'covered') {
    drawing = <span className={`${control} border-fail bg-raised text-fail`}>loading…</span>;
  }

  return (
    <div className="grid gap-2">
      <div
        aria-hidden="true"
        className="flex min-h-24 items-center justify-center overflow-hidden rounded-term border border-line bg-raised p-4"
      >
        {drawing}
      </div>
      <p className="text-xs text-muted">
        <span className="text-dim">page:</span> {PAGE_NOTES[state]}
      </p>
    </div>
  );
}

export default function AutoWaitingTimeline() {
  const [scenarioId, setScenarioId] = useState('disabled');
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => setHydrated(true), []);

  const scenario = SCENARIOS.find(({ id }) => id === scenarioId) ?? SCENARIOS[0];
  const steps = useMemo(() => buildSteps(scenario), [scenario]);
  const step = steps[index];
  const last = steps.length - 1;
  const log = steps.slice(0, index + 1).flatMap((item, at) => item.log.map((line) => ({ line, at })));

  useEffect(() => {
    if (!playing) return;
    if (index >= last) {
      setPlaying(false);
      return;
    }
    const timer = window.setTimeout(() => setIndex((current) => current + 1), PLAY_DELAY_MS);
    return () => clearTimeout(timer);
  }, [playing, index, last]);

  const goTo = (next: number) => {
    setPlaying(false);
    setIndex(next);
  };

  const togglePlay = () => {
    if (!playing && index >= last) setIndex(0);
    setPlaying(!playing);
  };

  const outcome = OUTCOMES[step.outcome];

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
        <pre
          tabIndex={0}
          role="region"
          aria-label="Test code"
          className="overflow-x-auto rounded-term bg-raised p-3 text-xs text-text"
        >
          <code>{scenario.code}</code>
        </pre>
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <section aria-labelledby="aw-timeline" className={PANEL}>
          <h2 id="aw-timeline" className={HEADING}>
            # timeline
          </h2>
          <ol className="mt-3 grid gap-1">
            {steps.map(({ title, time }, at) => (
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
                  <span className="shrink-0 text-xs text-muted">{time}</span>
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
          <section aria-labelledby="aw-step" className={PANEL}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="aw-step" className="text-sm font-semibold text-bright">
                {step.title}
              </h2>
              <p className={`text-xs ${outcome.color}`}>{outcome.word}</p>
            </div>
            <p role="status" className="mt-2 font-prose text-sm text-text">
              <span className="sr-only">
                Step {index + 1} of {steps.length}: {step.title}.{' '}
              </span>
              <CodeText text={step.detail} />
            </p>
          </section>

          <div className="grid gap-5 md:grid-cols-2">
            <section aria-labelledby="aw-page" className={PANEL}>
              <h2 id="aw-page" className={`${HEADING} mb-3`}>
                # page under test
              </h2>
              <PagePreview state={step.page} action={scenario.action} />
            </section>

            <section aria-labelledby="aw-checks" className={PANEL}>
              <h2 id="aw-checks" className={`${HEADING} mb-3`}>
                # actionability checks
              </h2>
              <ul aria-labelledby="aw-checks" className="grid gap-2 text-sm">
                {Object.entries(step.checks).map(([name, state]) => {
                  const mark = CHECK_MARKS[state];
                  return (
                    <li key={name} className="flex items-baseline justify-between gap-3">
                      <span className="min-w-0 break-words text-text">{name}</span>
                      <span className={`shrink-0 text-xs ${mark.color}`}>
                        <span aria-hidden="true">{mark.glyph} </span>
                        {mark.word}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          </div>

          <section aria-labelledby="aw-log" className={PANEL}>
            <h2 id="aw-log" className={`${HEADING} mb-3`}>
              # call log
            </h2>
            <pre
              tabIndex={0}
              role="region"
              aria-label="Call log"
              className="max-h-64 min-h-16 overflow-auto rounded-term bg-raised p-3 text-xs leading-relaxed"
            >
              <code>
                {log.map(({ line, at }, position) => (
                  <span key={position} className={`block ${at === index ? 'text-bright' : 'text-muted'}`}>
                    {line}
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
