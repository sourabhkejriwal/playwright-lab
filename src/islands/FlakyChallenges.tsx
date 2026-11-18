import { useEffect, useId, useRef, useState, type SyntheticEvent } from 'react';
import { CHALLENGES, fixedLines, grade, type FlakyChallenge } from '../lib/flaky-challenges';
import CodeText from './CodeText';

interface Answer {
  line: number | null;
  cause: number | null;
  checked: boolean;
  revealed: boolean;
}

const EMPTY: Answer = { line: null, cause: null, checked: false, revealed: false };
const PANEL = 'min-w-0 rounded-term border border-line bg-surface p-4';
const BUTTON =
  'min-h-11 w-fit cursor-pointer rounded-term border border-line-strong px-4 py-2 text-sm text-pass hover:border-pass';
const CODE = 'font-mono text-xs leading-relaxed break-words whitespace-pre-wrap';

function Solution({ challenge }: { challenge: FlakyChallenge }) {
  return (
    <>
      <p className="font-prose leading-relaxed text-text">
        <CodeText text={challenge.explanation} />
      </p>
      <h3 className="text-xs text-muted">the fix</h3>
      <pre className={`${CODE} rounded-term border border-line bg-raised p-3 text-text`}>
        {fixedLines(challenge).map(({ text, changed }, index) => (
          <span key={index} className={`block min-h-[1.625em] ${changed ? 'text-pass' : ''}`}>
            {changed && <span className="sr-only">changed line: </span>}
            <span aria-hidden="true">{changed ? '+ ' : '  '}</span>
            {text}
          </span>
        ))}
      </pre>
    </>
  );
}

export default function FlakyChallenges() {
  const [hydrated, setHydrated] = useState(false);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [solved, setSolved] = useState<string[]>([]);
  const lineName = useId();
  const causeName = useId();
  const focusTarget = useRef<HTMLElement | null>(null);
  const moveFocus = useRef(false);

  useEffect(() => setHydrated(true), []);

  // The button that was just pressed is gone or disabled, so keyboard and screen reader users need a new place to continue.
  useEffect(() => {
    if (!moveFocus.current) return;
    moveFocus.current = false;
    focusTarget.current?.focus();
  }, [answers, index]);

  if (!hydrated) return <p className="mt-8 min-h-96 text-muted">loading challenges…</p>;

  const challenge = CHALLENGES[index];
  const answer = answers[challenge.id] ?? EMPTY;
  const verdict = grade(challenge, answer.line, answer.cause);
  const isSolved = solved.includes(challenge.id);
  const showSolution = answer.checked && (verdict.solved || answer.revealed);

  const update = (change: Partial<Answer>) =>
    setAnswers((current) => ({ ...current, [challenge.id]: { ...answer, ...change } }));

  const open = (next: number) => {
    moveFocus.current = true;
    setIndex(next);
  };

  const check = (event: SyntheticEvent) => {
    event.preventDefault();
    if (answer.line === null || answer.cause === null || answer.checked) return;
    if (verdict.solved && !isSolved) setSolved([...solved, challenge.id]);
    moveFocus.current = true;
    update({ checked: true });
  };

  const retry = () => {
    moveFocus.current = true;
    update(EMPTY);
  };

  const reveal = () => {
    moveFocus.current = true;
    update({ revealed: true });
  };

  return (
    <div className="mt-8 grid grid-cols-[minmax(0,1fr)] gap-4">
      <nav aria-label="Challenges" className="flex flex-wrap items-center gap-2">
        <ol className="flex flex-wrap gap-2">
          {CHALLENGES.map(({ id }, at) => {
            const done = solved.includes(id);
            return (
              <li key={id}>
                <button
                  type="button"
                  aria-current={at === index ? 'step' : undefined}
                  aria-label={`Challenge ${at + 1}${done ? ', solved' : ''}`}
                  onClick={() => open(at)}
                  className={`size-11 cursor-pointer rounded-term border text-sm ${
                    at === index
                      ? 'border-pass text-bright'
                      : 'border-line-strong text-muted hover:border-info'
                  }`}
                >
                  <span aria-hidden="true">{done ? '✓' : at + 1}</span>
                </button>
              </li>
            );
          })}
        </ol>
        <p role="status" className="text-xs text-muted">
          {solved.length} of {CHALLENGES.length} solved
        </p>
      </nav>

      <form key={challenge.id} onSubmit={check} className="grid grid-cols-[minmax(0,1fr)] gap-4">
        <section className={PANEL}>
          <h2
            ref={answer.checked ? undefined : (element) => void (focusTarget.current = element)}
            tabIndex={-1}
            className="text-lg font-semibold text-bright outline-none"
          >
            {challenge.title}
          </h2>
          <p className="mt-2 font-prose text-text">{challenge.story}</p>
          <h3 className="mt-4 text-xs text-muted">ci output</h3>
          <pre className={`${CODE} mt-1 rounded-term border border-line bg-raised p-3 text-fail`}>
            {challenge.log.join('\n')}
          </pre>
        </section>

        <fieldset className={PANEL}>
          <legend className="px-1 text-sm text-bright">1. Which line causes the flakiness?</legend>
          <div className="mt-2 grid grid-cols-[minmax(0,1fr)] gap-px">
            {challenge.flaky.split('\n').map((text, at) => {
              const line = at + 1;
              if (text.trim() === '') return <span key={line} aria-hidden="true" className="h-3" />;
              const culprit = showSolution && challenge.culprit.includes(line);
              return (
                <label
                  key={line}
                  className={`flex min-h-8 items-start gap-2 rounded-[3px] border px-2 py-1 ${
                    culprit
                      ? 'border-pass'
                      : answer.line === line
                        ? 'border-info'
                        : 'border-transparent hover:border-line-strong'
                  } ${answer.checked ? '' : 'cursor-pointer'}`}
                >
                  <input
                    type="radio"
                    name={lineName}
                    checked={answer.line === line}
                    disabled={answer.checked}
                    onChange={() => update({ line })}
                    className="mt-0.5 size-4 shrink-0 accent-pass"
                  />
                  <span className="w-5 shrink-0 text-right text-xs leading-relaxed text-muted">
                    <span className="sr-only">line </span>
                    {line}
                  </span>
                  <code className={`${CODE} min-w-0 text-text`}>{text}</code>
                </label>
              );
            })}
          </div>
        </fieldset>

        <fieldset className={`${PANEL} grid gap-2`}>
          <legend className="px-1 text-sm text-bright">2. Why does it fail only sometimes?</legend>
          {challenge.causes.map((cause, at) => {
            const right = showSolution && at === challenge.answer;
            return (
              <label
                key={cause}
                className={`flex min-h-11 items-start gap-3 rounded-term border bg-raised px-3 py-2.5 font-prose text-sm text-text ${
                  right ? 'border-pass' : answer.cause === at ? 'border-info' : 'border-line-strong'
                } ${answer.checked ? '' : 'cursor-pointer hover:border-info'}`}
              >
                <input
                  type="radio"
                  name={causeName}
                  checked={answer.cause === at}
                  disabled={answer.checked}
                  onChange={() => update({ cause: at })}
                  className="mt-0.5 size-4 shrink-0 accent-pass"
                />
                <span className="min-w-0 break-words">
                  <CodeText text={cause} />
                </span>
              </label>
            );
          })}
        </fieldset>

        {answer.checked ? (
          <div
            ref={(element) => void (focusTarget.current = element)}
            tabIndex={-1}
            role="group"
            aria-label="Result"
            className={`${PANEL} grid grid-cols-[minmax(0,1fr)] gap-3 outline-none`}
          >
            <p className={`text-sm font-semibold ${verdict.solved ? 'text-pass' : 'text-fail'}`}>
              <span aria-hidden="true">{verdict.solved ? '✓ ' : '✗ '}</span>
              {verdict.solved ? 'solved' : 'not quite'}
            </p>
            {!verdict.solved && (
              <ul className="grid gap-1 font-prose text-sm text-text">
                <li>{verdict.line ? 'The line is right.' : 'The line is wrong.'}</li>
                <li>{verdict.cause ? 'The cause is right.' : 'The cause is wrong.'}</li>
              </ul>
            )}
            {showSolution && <Solution challenge={challenge} />}
            <div className="flex flex-wrap gap-3">
              {!verdict.solved && (
                <button type="button" onClick={retry} className={BUTTON}>
                  try again
                </button>
              )}
              {!showSolution && (
                <button type="button" onClick={reveal} className={BUTTON}>
                  show the answer
                </button>
              )}
              {index < CHALLENGES.length - 1 && (
                <button type="button" onClick={() => open(index + 1)} className={BUTTON}>
                  next challenge
                </button>
              )}
            </div>
          </div>
        ) : (
          <button
            type="submit"
            disabled={answer.line === null || answer.cause === null}
            className={`${BUTTON} disabled:cursor-not-allowed disabled:border-line disabled:text-muted`}
          >
            check answer
          </button>
        )}
      </form>
    </div>
  );
}
