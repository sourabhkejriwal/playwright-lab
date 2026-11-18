import { atom, type ReadableAtom } from 'nanostores';

/**
 * The visitor's own progress, saved in localStorage. Importing this module is safe during the static build:
 * storage is only touched by loadProgress() and the save functions.
 *
 * In a React island, call loadProgress() from useEffect, not during render. The server-rendered HTML knows nothing
 * about this visitor, so the first client render has to match it. $progressReady says when the real data is in.
 */

// Namespaced because every project site on the same github.io origin shares localStorage.
export const PROGRESS_STORAGE_KEY = 'playwright-lab:progress';
const VERSION = 1;

export type FlashcardGrade = 'again' | 'good' | 'easy';

export interface ChapterProgress {
  readAt: string; // ISO date
}

export interface FlashcardProgress {
  grade: FlashcardGrade; // latest answer
  intervalDays: number;
  dueAt: string; // ISO date
  reviewedAt: string; // ISO date
  reviews: number;
}

export interface QuizAttempt {
  score: number;
  total: number;
}

export interface QuizProgress {
  last: QuizAttempt;
  best: QuizAttempt;
  attempts: number;
  takenAt: string; // ISO date of the last attempt
}

export interface Progress {
  version: typeof VERSION;
  chapters: Record<string, ChapterProgress>; // by chapter slug, e.g. "selectors"
  flashcards: Record<string, FlashcardProgress>; // by card id
  quizzes: Record<string, QuizProgress>; // by chapter slug
}

/** What the flashcard scheduler decided. The store records it and does not schedule anything itself. */
export type FlashcardReview = Pick<FlashcardProgress, 'grade' | 'intervalDays' | 'dueAt'>;

type ProgressStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

interface ProgressStoreOptions {
  /** A function because merely reading window.localStorage throws when the browser blocks site data. */
  storage?: () => ProgressStorage;
  events?: Pick<EventTarget, 'addEventListener'>;
}

const emptyProgress = (): Progress => ({ version: VERSION, chapters: {}, flashcards: {}, quizzes: {} });

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isDate = (value: unknown): value is string =>
  typeof value === 'string' && !Number.isNaN(Date.parse(value));
const isCount = (value: unknown): value is number => Number.isInteger(value) && (value as number) >= 0;

function parseChapter(value: unknown): ChapterProgress | null {
  return isObject(value) && isDate(value.readAt) ? { readAt: value.readAt } : null;
}

function parseFlashcard(value: unknown): FlashcardProgress | null {
  if (!isObject(value)) return null;
  const { grade, intervalDays, dueAt, reviewedAt, reviews } = value;
  const validGrade = grade === 'again' || grade === 'good' || grade === 'easy';
  const validInterval =
    typeof intervalDays === 'number' && Number.isFinite(intervalDays) && intervalDays >= 0;
  if (!validGrade || !validInterval || !isDate(dueAt) || !isDate(reviewedAt)) return null;
  if (!isCount(reviews) || reviews < 1) return null;
  return { grade, intervalDays, dueAt, reviewedAt, reviews };
}

function parseAttempt(value: unknown): QuizAttempt | null {
  if (!isObject(value)) return null;
  const { score, total } = value;
  if (!isCount(score) || !isCount(total) || total < 1 || score > total) return null;
  return { score, total };
}

function parseQuiz(value: unknown): QuizProgress | null {
  if (!isObject(value)) return null;
  const last = parseAttempt(value.last);
  const best = parseAttempt(value.best);
  const { attempts, takenAt } = value;
  if (!last || !best || !isCount(attempts) || attempts < 1 || !isDate(takenAt)) return null;
  return { last, best, attempts, takenAt };
}

/** Keeps the valid entries, so one damaged record doesn't cost the visitor everything else. */
function parseEntries<T>(value: unknown, parse: (entry: unknown) => T | null): Record<string, T> {
  if (!isObject(value)) return {};
  const entries = Object.entries(value).flatMap(([id, entry]): [string, T][] => {
    const parsed = parse(entry);
    return parsed ? [[id, parsed]] : [];
  });
  // fromEntries defines own properties, so a stored "__proto__" key can't change the prototype.
  return Object.fromEntries(entries);
}

function parseProgress(raw: string | null): Progress {
  if (raw === null) return emptyProgress();
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return emptyProgress();
  }
  if (!isObject(data) || data.version !== VERSION) return emptyProgress();
  return {
    version: VERSION,
    chapters: parseEntries(data.chapters, parseChapter),
    flashcards: parseEntries(data.flashcards, parseFlashcard),
    quizzes: parseEntries(data.quizzes, parseQuiz),
  };
}

export function createProgressStore({
  storage = () => globalThis.localStorage,
  events = globalThis.window,
}: ProgressStoreOptions = {}) {
  const $progress = atom<Progress>(emptyProgress());
  const $progressReady = atom(false);
  let loaded = false;
  // After a failed read or write, memory is the only complete copy until a write succeeds again.
  let storageInSync = true;

  /** The newest saved state, so a save from this tab doesn't undo one made in another tab. */
  function latest(): Progress {
    if (!storageInSync) return $progress.get();
    try {
      return parseProgress(storage().getItem(PROGRESS_STORAGE_KEY));
    } catch {
      storageInSync = false;
      return $progress.get();
    }
  }

  function persist(progress: Progress) {
    try {
      storage().setItem(PROGRESS_STORAGE_KEY, JSON.stringify(progress));
      storageInSync = true;
    } catch {
      // Blocked or full: progress still works until the page closes.
      storageInSync = false;
    }
  }

  function refresh() {
    $progress.set(latest());
  }

  /** Reads saved progress and starts following other tabs. Safe to call more than once. */
  function loadProgress() {
    if (loaded) return;
    loaded = true;
    refresh();
    $progressReady.set(true);
    events?.addEventListener('storage', (event) => {
      // The key is null when another tab calls localStorage.clear().
      const { key } = event as StorageEvent;
      if (key === PROGRESS_STORAGE_KEY || key === null) refresh();
    });
    // A page restored from the back/forward cache may hold older progress.
    events?.addEventListener('pageshow', (event) => {
      if ((event as PageTransitionEvent).persisted) refresh();
    });
  }

  function update(change: (current: Progress) => Progress) {
    loadProgress();
    const current = latest();
    const next = change(current);
    if (next !== current) persist(next);
    $progress.set(next);
  }

  /** Marks a chapter read or unread. Marking it read again keeps the original date. */
  function setChapterRead(slug: string, read = true) {
    update((current) => {
      const isRead = Object.hasOwn(current.chapters, slug);
      if (read === isRead) return current;
      const { [slug]: _removed, ...others } = current.chapters;
      const chapters = read ? { ...others, [slug]: { readAt: new Date().toISOString() } } : others;
      return { ...current, chapters };
    });
  }

  function saveFlashcardReview(cardId: string, review: FlashcardReview) {
    update((current) => {
      const previous = Object.hasOwn(current.flashcards, cardId) ? current.flashcards[cardId] : undefined;
      const card = parseFlashcard({
        ...review,
        reviewedAt: new Date().toISOString(),
        reviews: (previous?.reviews ?? 0) + 1,
      });
      if (!card) throw new RangeError(`Invalid flashcard review for "${cardId}"`);
      return { ...current, flashcards: { ...current.flashcards, [cardId]: card } };
    });
  }

  /** Records an attempt. Best is compared as a percentage, because a quiz can change length later. */
  function saveQuizScore(slug: string, score: number, total: number) {
    const last = parseAttempt({ score, total });
    if (!last) throw new RangeError(`Invalid quiz score ${score}/${total} for "${slug}"`);
    update((current) => {
      const previous = Object.hasOwn(current.quizzes, slug) ? current.quizzes[slug] : undefined;
      const beatsBest = !previous || last.score * previous.best.total >= previous.best.score * last.total;
      const quiz: QuizProgress = {
        last,
        best: beatsBest ? last : previous.best,
        attempts: (previous?.attempts ?? 0) + 1,
        takenAt: new Date().toISOString(),
      };
      return { ...current, quizzes: { ...current.quizzes, [slug]: quiz } };
    });
  }

  function resetProgress() {
    loadProgress();
    try {
      storage().removeItem(PROGRESS_STORAGE_KEY);
      storageInSync = true;
    } catch {
      storageInSync = false;
    }
    $progress.set(emptyProgress());
  }

  return {
    // Read-only on purpose: every change goes through the functions below, so it gets saved.
    $progress: $progress as ReadableAtom<Progress>,
    $progressReady: $progressReady as ReadableAtom<boolean>,
    loadProgress,
    setChapterRead,
    saveFlashcardReview,
    saveQuizScore,
    resetProgress,
  };
}

export const {
  $progress,
  $progressReady,
  loadProgress,
  setChapterRead,
  saveFlashcardReview,
  saveQuizScore,
  resetProgress,
} = createProgressStore();
