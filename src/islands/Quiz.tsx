import { useStore } from '@nanostores/react';
import { useEffect, useId, useRef, useState, type SyntheticEvent } from 'react';
import { shuffleOptions, type QuizQuestion } from '../lib/quiz';
import { $progress, loadProgress, saveQuizScore, type QuizProgress } from '../stores/progress';
import CodeText from './CodeText';

interface Attempt {
  questions: QuizQuestion[];
  index: number;
  choice: number | null;
  checked: boolean;
  score: number;
  finished: boolean;
}

const BUTTON =
  'min-h-11 w-fit cursor-pointer rounded-term border border-line-strong px-4 py-2 text-sm text-pass hover:border-pass';

function savedSummary({ last, best, attempts }: QuizProgress) {
  const times = `${attempts} ${attempts === 1 ? 'attempt' : 'attempts'}`;
  return `last ${last.score}/${last.total} · best ${best.score}/${best.total} · ${times}`;
}

export default function Quiz({ slug, questions }: { slug: string; questions: QuizQuestion[] }) {
  const progress = useStore($progress);
  // Saved progress may already be loaded by another script, so $progressReady can't tell us the first render is over.
  const [hydrated, setHydrated] = useState(false);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const radioName = useId();
  const focusTarget = useRef<HTMLElement | null>(null);
  const moveFocus = useRef(false);

  useEffect(() => {
    loadProgress();
    setHydrated(true);
  }, []);

  // The button that was just pressed is gone or disabled, so keyboard and screen reader users need a new place to continue.
  useEffect(() => {
    if (!moveFocus.current) return;
    moveFocus.current = false;
    focusTarget.current?.focus();
  }, [attempt]);

  if (!hydrated) {
    return <p className="min-h-32 text-muted">loading quiz…</p>;
  }

  const saved = Object.hasOwn(progress.quizzes, slug) ? progress.quizzes[slug] : undefined;
  const total = questions.length;

  const start = () => {
    moveFocus.current = true;
    setAttempt({
      questions: questions.map((question) => shuffleOptions(question)),
      index: 0,
      choice: null,
      checked: false,
      score: 0,
      finished: false,
    });
  };

  if (!attempt) {
    return (
      <div className="grid min-h-32 content-start gap-4">
        <p className="font-prose text-muted">
          {total} multiple-choice {total === 1 ? 'question' : 'questions'} on this chapter. Your score stays
          in this browser.
        </p>
        {saved && <p className="text-xs text-muted">{savedSummary(saved)}</p>}
        <button type="button" onClick={start} className={BUTTON}>
          {saved ? 'retake quiz' : 'start quiz'}
        </button>
      </div>
    );
  }

  if (attempt.finished) {
    const perfect = attempt.score === total;
    return (
      <div className="grid min-h-32 content-start gap-4">
        <h3
          ref={(element) => void (focusTarget.current = element)}
          tabIndex={-1}
          className={`text-lg font-semibold outline-none ${perfect ? 'text-pass' : 'text-bright'}`}
        >
          {perfect && <span aria-hidden="true">✓ </span>}
          {attempt.score}/{total} correct
        </h3>
        {saved && <p className="text-xs text-muted">{savedSummary(saved)}</p>}
        <button type="button" onClick={start} className={BUTTON}>
          retake quiz
        </button>
      </div>
    );
  }

  const question = attempt.questions[attempt.index];
  const isLast = attempt.index === total - 1;
  const isRight = attempt.choice === question.answer;

  const check = (event: SyntheticEvent) => {
    event.preventDefault();
    if (attempt.choice === null || attempt.checked) return;
    const score = attempt.score + (isRight ? 1 : 0);
    // Saved now rather than on the score screen, so leaving after the last answer still counts.
    if (isLast) saveQuizScore(slug, score, total);
    moveFocus.current = true;
    setAttempt({ ...attempt, checked: true, score });
  };

  const next = () => {
    moveFocus.current = true;
    setAttempt(
      isLast
        ? { ...attempt, finished: true }
        : { ...attempt, index: attempt.index + 1, choice: null, checked: false },
    );
  };

  return (
    <form key={attempt.index} onSubmit={check} className="grid min-h-32 content-start gap-4">
      <p className="text-xs text-muted">
        question {attempt.index + 1} of {total}
      </p>
      <fieldset className="grid min-w-0 gap-3">
        <legend className="mb-3 w-full">
          <h3
            ref={attempt.checked ? undefined : (element) => void (focusTarget.current = element)}
            tabIndex={-1}
            className="font-prose text-lg leading-relaxed font-medium text-bright outline-none"
          >
            <CodeText text={question.question} />
          </h3>
        </legend>
        {question.options.map((option, index) => {
          const chosen = attempt.choice === index;
          const correct = attempt.checked && index === question.answer;
          const wrong = attempt.checked && chosen && !correct;
          const state = correct
            ? 'border-pass'
            : wrong
              ? 'border-fail'
              : attempt.checked
                ? 'border-line'
                : 'cursor-pointer border-line-strong hover:border-info has-checked:border-info';
          return (
            <label
              key={option}
              className={`flex min-h-11 items-start gap-3 rounded-term border bg-raised px-3 py-2.5 font-prose text-sm text-text ${state}`}
            >
              <input
                type="radio"
                name={radioName}
                checked={chosen}
                disabled={attempt.checked}
                onChange={() => setAttempt({ ...attempt, choice: index })}
                className="mt-0.5 size-4 shrink-0 accent-pass"
              />
              <span className="min-w-0 break-words">
                <CodeText text={option} />
                {correct && <span className="ml-2 font-mono text-xs text-pass">correct answer</span>}
                {wrong && <span className="ml-2 font-mono text-xs text-fail">your answer</span>}
              </span>
            </label>
          );
        })}
      </fieldset>

      {attempt.checked ? (
        <>
          <div
            ref={(element) => void (focusTarget.current = element)}
            tabIndex={-1}
            role="group"
            aria-label="Explanation"
            className="grid gap-1 border-t border-line pt-4 outline-none"
          >
            <p className={`text-sm font-semibold ${isRight ? 'text-pass' : 'text-fail'}`}>
              <span aria-hidden="true">{isRight ? '✓ ' : '✗ '}</span>
              {isRight ? 'correct' : 'not quite'}
            </p>
            <p className="font-prose leading-relaxed text-text">
              <CodeText text={question.explanation} />
            </p>
          </div>
          <button type="button" onClick={next} className={BUTTON}>
            {isLast ? 'see score' : 'next question'}
          </button>
        </>
      ) : (
        <button
          type="submit"
          disabled={attempt.choice === null}
          className={`${BUTTON} disabled:cursor-not-allowed disabled:border-line disabled:text-muted`}
        >
          check answer
        </button>
      )}
    </form>
  );
}
