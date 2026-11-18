import { test, expect } from '@playwright/test';
import { createProgressStore, PROGRESS_STORAGE_KEY as KEY } from '../src/stores/progress';

// The store has no UI yet, so these run in Node against an in-memory Storage.
test.skip(({ isMobile }) => isMobile, 'no browser involved, so one project is enough');

const REVIEW = { grade: 'good', intervalDays: 3, dueAt: '2026-12-01T00:00:00.000Z' } as const;

function fakeStorage(initial?: string) {
  const items = new Map<string, string>(initial === undefined ? [] : [[KEY, initial]]);
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
  };
}

const saved = (storage: ReturnType<typeof fakeStorage>) => JSON.parse(storage.getItem(KEY) ?? 'null');

function storageEvent(key: string | null) {
  return Object.assign(new Event('storage'), { key });
}

test.describe('progress store', () => {
  test('starts empty and not ready, without touching storage', () => {
    const store = createProgressStore({
      storage: () => {
        throw new Error('storage must not be read on import');
      },
    });
    expect(store.$progressReady.get()).toBe(false);
    expect(store.$progress.get()).toEqual({ version: 1, chapters: {}, flashcards: {}, quizzes: {} });
  });

  test('saved progress is there for the next page load', () => {
    const storage = fakeStorage();
    const first = createProgressStore({ storage: () => storage });
    first.setChapterRead('selectors');
    first.saveFlashcardReview('ch02-card-1', REVIEW);
    first.saveQuizScore('selectors', 4, 5);

    const second = createProgressStore({ storage: () => storage });
    second.loadProgress();
    expect(second.$progressReady.get()).toBe(true);
    expect(second.$progress.get()).toEqual(first.$progress.get());
    expect(Object.keys(second.$progress.get().chapters)).toEqual(['selectors']);
  });

  test('marking a chapter read twice keeps the first date, and it can be unmarked', () => {
    const readAt = '2026-01-01T00:00:00.000Z';
    const storage = fakeStorage(
      JSON.stringify({ version: 1, chapters: { selectors: { readAt } }, flashcards: {}, quizzes: {} }),
    );
    const store = createProgressStore({ storage: () => storage });

    store.setChapterRead('selectors');
    expect(store.$progress.get().chapters.selectors).toEqual({ readAt });

    store.setChapterRead('selectors', false);
    expect(store.$progress.get().chapters).toEqual({});
    expect(saved(storage).chapters).toEqual({});
  });

  test('flashcard reviews are counted and keep the latest schedule', () => {
    const storage = fakeStorage();
    const store = createProgressStore({ storage: () => storage });
    store.saveFlashcardReview('card', REVIEW);
    store.saveFlashcardReview('card', { ...REVIEW, grade: 'again', intervalDays: 0 });

    expect(store.$progress.get().flashcards.card).toMatchObject({
      grade: 'again',
      intervalDays: 0,
      reviews: 2,
    });
    expect(() => store.saveFlashcardReview('card', { ...REVIEW, dueAt: 'soon' })).toThrow(RangeError);
  });

  test('quiz scores keep the last attempt and the best percentage', () => {
    const storage = fakeStorage();
    const store = createProgressStore({ storage: () => storage });

    store.saveQuizScore('selectors', 4, 5);
    store.saveQuizScore('selectors', 2, 5);
    expect(store.$progress.get().quizzes.selectors).toMatchObject({
      last: { score: 2, total: 5 },
      best: { score: 4, total: 5 },
      attempts: 2,
    });

    store.saveQuizScore('selectors', 9, 10);
    expect(store.$progress.get().quizzes.selectors.best).toEqual({ score: 9, total: 10 });
  });

  test('rejects impossible quiz scores', () => {
    const storage = fakeStorage();
    const store = createProgressStore({ storage: () => storage });
    for (const [score, total] of [
      [6, 5],
      [-1, 5],
      [1.5, 5],
      [0, 0],
      [Number.NaN, 5],
    ]) {
      expect(() => store.saveQuizScore('selectors', score, total)).toThrow(RangeError);
    }
    expect(storage.getItem(KEY)).toBeNull();
  });

  test('a save keeps what another tab saved since this tab loaded', () => {
    const storage = fakeStorage();
    const tabA = createProgressStore({ storage: () => storage });
    const tabB = createProgressStore({ storage: () => storage });
    tabA.loadProgress();
    tabB.loadProgress();

    tabA.setChapterRead('setup');
    tabB.setChapterRead('selectors');

    expect(Object.keys(saved(storage).chapters).sort()).toEqual(['selectors', 'setup']);
  });

  test('follows changes from other tabs and ignores unrelated keys', () => {
    const storage = fakeStorage();
    const events = new EventTarget();
    const store = createProgressStore({ storage: () => storage, events });
    store.loadProgress();

    createProgressStore({ storage: () => storage }).setChapterRead('fixtures');
    events.dispatchEvent(storageEvent('playwright-lab:theme'));
    expect(store.$progress.get().chapters).toEqual({});

    events.dispatchEvent(storageEvent(KEY));
    expect(Object.keys(store.$progress.get().chapters)).toEqual(['fixtures']);

    storage.removeItem(KEY);
    events.dispatchEvent(storageEvent(null));
    expect(store.$progress.get().chapters).toEqual({});
  });

  test('refreshes when the page returns from the back/forward cache', () => {
    const storage = fakeStorage();
    const events = new EventTarget();
    const store = createProgressStore({ storage: () => storage, events });
    store.loadProgress();

    createProgressStore({ storage: () => storage }).setChapterRead('fixtures');
    events.dispatchEvent(Object.assign(new Event('pageshow'), { persisted: true }));
    expect(Object.keys(store.$progress.get().chapters)).toEqual(['fixtures']);
  });

  for (const [name, raw] of [
    ['invalid JSON', '{oops'],
    ['the wrong shape', '[1,2,3]'],
    ['an unknown version', '{"version":99,"chapters":{"setup":{"readAt":"2026-01-01"}}}'],
  ]) {
    test(`treats ${name} as no progress`, () => {
      const store = createProgressStore({ storage: () => fakeStorage(raw) });
      store.loadProgress();
      expect(store.$progress.get().chapters).toEqual({});
      expect(store.$progressReady.get()).toBe(true);
    });
  }

  test('drops damaged entries and keeps the valid ones', () => {
    const readAt = '2026-01-01T00:00:00.000Z';
    const raw = JSON.stringify({
      version: 1,
      chapters: { setup: { readAt }, selectors: { readAt: 'yesterday' }, fixtures: null },
      flashcards: {
        card: { grade: 'perfect', intervalDays: 1, dueAt: readAt, reviewedAt: readAt, reviews: 1 },
      },
      quizzes: {
        forms: { last: { score: 9, total: 5 }, best: { score: 1, total: 5 }, attempts: 1, takenAt: readAt },
      },
    });
    const store = createProgressStore({ storage: () => fakeStorage(raw) });
    store.loadProgress();
    expect(store.$progress.get()).toEqual({
      version: 1,
      chapters: { setup: { readAt } },
      flashcards: {},
      quizzes: {},
    });
  });

  test('a stored __proto__ key cannot change object prototypes', () => {
    const readAt = '2026-01-01T00:00:00.000Z';
    const raw = `{"version":1,"chapters":{"__proto__":{"readAt":"${readAt}"}},"flashcards":{},"quizzes":{}}`;
    const store = createProgressStore({ storage: () => fakeStorage(raw) });
    store.loadProgress();
    expect(Object.getPrototypeOf(store.$progress.get().chapters)).toBe(Object.prototype);
  });

  test('keeps working in memory when storage is blocked', () => {
    const store = createProgressStore({
      storage: () => {
        throw new DOMException('blocked', 'SecurityError');
      },
    });
    store.setChapterRead('setup');
    store.setChapterRead('selectors');
    store.saveQuizScore('setup', 3, 5);

    expect(Object.keys(store.$progress.get().chapters)).toEqual(['setup', 'selectors']);
    expect(store.$progress.get().quizzes.setup.attempts).toBe(1);
    expect(store.$progressReady.get()).toBe(true);
  });

  test('a full storage loses nothing once writes work again', () => {
    const storage = fakeStorage();
    let full = true;
    const store = createProgressStore({
      storage: () => ({
        ...storage,
        setItem: (key, value) => {
          if (full) throw new DOMException('full', 'QuotaExceededError');
          storage.setItem(key, value);
        },
      }),
    });

    store.setChapterRead('setup');
    store.setChapterRead('selectors');
    full = false;
    store.setChapterRead('fixtures');

    expect(Object.keys(saved(storage).chapters)).toEqual(['setup', 'selectors', 'fixtures']);
  });

  test('reset clears memory and storage', () => {
    const storage = fakeStorage();
    const store = createProgressStore({ storage: () => storage });
    store.setChapterRead('setup');

    store.resetProgress();

    expect(store.$progress.get().chapters).toEqual({});
    expect(storage.getItem(KEY)).toBeNull();
  });
});
