import { useStore } from '@nanostores/react';
import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import {
  ALL_CHAPTERS,
  buildQueue,
  cardsForChapter,
  formatDueDate,
  formatInterval,
  scheduleReview,
  upcoming,
  type Deck,
} from '../lib/flashcards';
import { $progress, loadProgress, saveFlashcardReview, type FlashcardGrade } from '../stores/progress';

interface Session {
  chapter: string;
  queue: string[];
  revealed: boolean;
  reviewed: number;
  now: number;
}

const GRADES: { grade: FlashcardGrade; tone: string }[] = [
  { grade: 'again', tone: 'text-fail hover:border-fail' },
  { grade: 'good', tone: 'text-pass hover:border-pass' },
  { grade: 'easy', tone: 'text-info hover:border-info' },
];

/** Card text is plain, with code in `backticks`. */
function CardText({ text }: { text: string }) {
  return text.split(/`([^`]+)`/).map((part, index) =>
    index % 2 === 1 ? (
      <code
        key={index}
        className="rounded-[4px] border border-line bg-raised px-1 font-mono text-[0.875em] break-words text-purple"
      >
        {part}
      </code>
    ) : (
      part
    ),
  );
}

export default function Flashcards({ decks }: { decks: Deck[] }) {
  const progress = useStore($progress);
  // Null until saved progress is loaded, so the first client render matches the static HTML.
  const [session, setSession] = useState<Session | null>(null);
  const focusTarget = useRef<HTMLElement | null>(null);
  const moveFocus = useRef(false);

  const startSession = (chapter: string) => {
    const now = new Date();
    const queue = buildQueue(cardsForChapter(decks, chapter), $progress.get().flashcards, now);
    setSession({ chapter, queue, revealed: false, reviewed: 0, now: now.getTime() });
  };

  useEffect(() => {
    loadProgress();
    startSession(ALL_CHAPTERS);
  }, []);

  // The button that was just pressed is gone, so keyboard and screen reader users need a new place to continue from.
  useEffect(() => {
    if (!moveFocus.current) return;
    moveFocus.current = false;
    focusTarget.current?.focus();
  }, [session]);

  if (!session) {
    return (
      <p role="status" className="min-h-64 text-muted">
        loading cards…
      </p>
    );
  }

  const cards = cardsForChapter(decks, session.chapter);
  const card = cards.find(({ id }) => id === session.queue[0]);
  const saved = progress.flashcards;
  const previous = card && Object.hasOwn(saved, card.id) ? saved[card.id] : undefined;
  const now = new Date(session.now);
  const { scheduled, nextDueAt } = upcoming(cards, saved, now);

  const reveal = () => {
    moveFocus.current = true;
    setSession({ ...session, revealed: true });
  };

  const grade = (choice: FlashcardGrade) => {
    if (!card) return;
    const reviewedAt = new Date();
    saveFlashcardReview(card.id, scheduleReview(choice, previous, reviewedAt));
    const [, ...rest] = session.queue;
    moveFocus.current = true;
    setSession({
      ...session,
      queue: choice === 'again' ? [...rest, card.id] : rest,
      revealed: false,
      reviewed: session.reviewed + 1,
      now: reviewedAt.getTime(),
    });
  };

  return (
    <div className="grid min-h-64 content-start gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-xs text-muted">
          chapter
          <select
            value={session.chapter}
            onChange={(event: ChangeEvent<HTMLSelectElement>) => startSession(event.target.value)}
            className="min-h-11 cursor-pointer rounded-term border border-line-strong bg-raised px-2 text-text"
          >
            <option value={ALL_CHAPTERS}>
              all chapters ({decks.reduce((total, deck) => total + deck.cards.length, 0)})
            </option>
            {decks.map((deck) => (
              <option key={deck.slug} value={deck.slug}>
                {deck.label} ({deck.cards.length})
              </option>
            ))}
          </select>
        </label>
        <p role="status" className="text-xs text-muted">
          {session.queue.length} to review · {scheduled} scheduled
        </p>
      </div>

      {card ? (
        <article aria-label="Flashcard" className="grid gap-5">
          <h2
            key={card.id}
            ref={session.revealed ? undefined : (element) => void (focusTarget.current = element)}
            tabIndex={-1}
            className="font-prose text-lg leading-relaxed font-medium text-bright outline-none"
          >
            <CardText text={card.front} />
          </h2>

          {session.revealed ? (
            <>
              <div
                ref={(element) => void (focusTarget.current = element)}
                tabIndex={-1}
                role="group"
                aria-label="Answer"
                className="border-t border-line pt-5 font-prose leading-relaxed text-text outline-none"
              >
                <p>
                  <CardText text={card.back} />
                </p>
              </div>
              <div role="group" aria-label="How well did you know it?" className="grid grid-cols-3 gap-2">
                {GRADES.map(({ grade: choice, tone }) => {
                  const { intervalDays } = scheduleReview(choice, previous, now);
                  return (
                    <button
                      key={choice}
                      type="button"
                      onClick={() => grade(choice)}
                      className={`grid min-h-11 cursor-pointer gap-0.5 rounded-term border border-line-strong px-2 py-2 text-sm ${tone}`}
                    >
                      <span>{choice}</span>
                      <span className="text-xs text-muted">{formatInterval(intervalDays)}</span>
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <button
              type="button"
              onClick={reveal}
              className="min-h-11 w-fit cursor-pointer rounded-term border border-line-strong px-4 py-2 text-sm text-pass hover:border-pass"
            >
              reveal answer
            </button>
          )}
        </article>
      ) : (
        <div className="grid gap-2">
          <h2
            ref={(element) => void (focusTarget.current = element)}
            tabIndex={-1}
            className="text-lg font-semibold text-pass outline-none"
          >
            <span aria-hidden="true">✓ </span>all caught up
          </h2>
          <p className="font-prose text-muted">
            {session.reviewed > 0 &&
              `${session.reviewed} ${session.reviewed === 1 ? 'review' : 'reviews'} this session. `}
            {nextDueAt && `Next card due ${formatDueDate(nextDueAt, now)}.`}
          </p>
        </div>
      )}
    </div>
  );
}
