import { readdirSync, readFileSync } from 'node:fs';
import { test, expect } from '../../../fixtures/pom/test-options';
import type { FlashcardsPage } from '../../../pages/app/flashcards.page';
import { savedProgress } from '../../../helpers/app/saved-progress';
import { chapters, pad } from '../../../src/data/chapters';
import {
  ALL_CHAPTERS,
  buildQueue,
  cardsForChapter,
  formatDueDate,
  MAX_INTERVAL_DAYS,
  nextInterval,
  scheduleReview,
  upcoming,
} from '../../../src/lib/flashcards';
import type { FlashcardProgress } from '../../../src/stores/progress';

interface Deck {
  chapter: number;
  cards: { id: string; front: string; back: string }[];
}

// Every chapter's deck in chapter order, which is the order "all chapters" studies them in.
const deckDir = new URL('../../../src/content/flashcards/', import.meta.url);
const decks: Deck[] = readdirSync(deckDir)
  .toSorted()
  .map((file) => JSON.parse(readFileSync(new URL(file, deckDir), 'utf8')));
const deck = { cards: decks.flatMap(({ cards }) => cards) };
const [first, second] = deck.cards;
const total = deck.cards.length;

const deckOption = ({ chapter, cards }: Deck) => {
  const short = chapters.find(({ num }) => num === chapter)?.short.toLowerCase();
  return `ch${pad(chapter)} ${short} (${cards.length})`;
};

const PAST = '2026-01-01T00:00:00.000Z';
const FUTURE = '2999-01-01T00:00:00.000Z';
const savedCard = (dueAt: string, intervalDays = 3): FlashcardProgress => ({
  grade: 'good',
  intervalDays,
  dueAt,
  reviewedAt: PAST,
  reviews: 1,
});

test.describe('scheduler', () => {
  test.skip(
    ({ isMobile, browserName }) => isMobile || browserName !== 'chromium',
    'no browser involved, so one project is enough',
  );

  const card = (id: string) => ({ id, front: 'Question?', back: 'Answer.' });
  const now = new Date(2026, 5, 15, 21, 30);

  test(
    'again resets the interval, and good and easy grow it at different rates',
    { tag: '@regression' },
    () => {
      expect(nextInterval('again', 30)).toBe(0);
      expect(nextInterval('good')).toBe(1);
      expect(nextInterval('easy')).toBe(4);
      expect(nextInterval('good', 4)).toBe(10);
      expect(nextInterval('easy', 4)).toBe(16);
      expect(nextInterval('easy', 300)).toBe(MAX_INTERVAL_DAYS);
    },
  );

  test('a failed card is due at once, and a passed card at local midnight', { tag: '@regression' }, () => {
    expect(scheduleReview('again', undefined, now).dueAt).toBe(now.toISOString());
    expect(scheduleReview('good', undefined, now)).toEqual({
      grade: 'good',
      intervalDays: 1,
      dueAt: new Date(2026, 5, 16).toISOString(),
    });
  });

  test(
    'the queue puts the oldest due card first, new cards last, and skips future cards',
    { tag: '@regression' },
    () => {
      const cards = ['new', 'later', 'recent', 'oldest'].map(card);
      const saved = {
        later: savedCard(FUTURE),
        recent: savedCard('2026-06-10T00:00:00.000Z'),
        oldest: savedCard('2026-06-01T00:00:00.000Z'),
      };
      expect(buildQueue(cards, saved, now)).toEqual(['oldest', 'recent', 'new']);
      expect(upcoming(cards, saved, now)).toEqual({ scheduled: 1, nextDueAt: new Date(FUTURE) });
    },
  );

  test('a chapter filter keeps only that chapter', { tag: '@regression' }, () => {
    const decks = [
      { slug: 'selectors', label: 'ch02 selectors', cards: [card('selectors/a')] },
      { slug: 'fixtures', label: 'ch05 fixtures', cards: [card('fixtures/b')] },
    ];
    expect(cardsForChapter(decks, 'fixtures').map(({ id }) => id)).toEqual(['fixtures/b']);
    expect(cardsForChapter(decks, ALL_CHAPTERS)).toHaveLength(2);
  });

  test('due dates read as calendar days', { tag: '@regression' }, () => {
    expect(formatDueDate(new Date(2026, 5, 16, 0), now)).toBe('tomorrow');
    expect(formatDueDate(new Date(2026, 5, 19, 0), now)).toBe('in 4 days');
  });
});

test.describe('flashcards page', () => {
  const plain = (text: string) => text.replaceAll('`', '');
  const seedCards = (flashcards: FlashcardsPage, cards: Record<string, FlashcardProgress>) =>
    flashcards.seedProgress(savedProgress({ flashcards: cards }));

  test('the answer stays hidden until it is revealed', { tag: '@regression' }, async ({ flashcards }) => {
    await flashcards.goto();
    await expect(flashcards.question).toHaveText(plain(first.front));
    await expect(flashcards.status).toHaveText(`${total} to review · 0 scheduled`);
    await expect(flashcards.answer).toBeHidden();
    await expect(flashcards.gradeButton('good')).toBeHidden();

    await flashcards.revealButton.click();
    await expect(flashcards.answer).toHaveText(plain(first.back));
    await expect(flashcards.gradeButton('again')).toContainText('now');
    await expect(flashcards.gradeButton('good')).toContainText('1 day');
    await expect(flashcards.gradeButton('easy')).toContainText('4 days');
  });

  test('code in backticks renders as code', { tag: '@regression' }, async ({ flashcards }) => {
    await flashcards.goto();
    await flashcards.revealButton.click();
    const code = first.back.match(/`([^`]+)`/)?.[1] ?? '';
    await expect(flashcards.firstAnswerCode).toHaveText(code);
  });

  test(
    'a graded card is saved and stays away after a reload',
    { tag: '@regression' },
    async ({ flashcards, page }) => {
      await flashcards.goto();
      await flashcards.review('good');

      await expect(flashcards.question).toHaveText(plain(second.front));
      await expect(flashcards.status).toHaveText(`${total - 1} to review · 1 scheduled`);

      await page.reload();
      await expect(flashcards.question).toHaveText(plain(second.front));
      const saved = await flashcards.savedProgress();
      expect(saved.flashcards?.[first.id]).toMatchObject({ grade: 'good', intervalDays: 1, reviews: 1 });
    },
  );

  test(
    'again sends the card to the back of the queue',
    { tag: '@regression' },
    async ({ flashcards, page }) => {
      const others = deck.cards.slice(2).map(({ id }) => [id, savedCard(FUTURE)]);
      await seedCards(flashcards, Object.fromEntries(others));
      await flashcards.goto();
      await expect(flashcards.status).toHaveText(`2 to review · ${total - 2} scheduled`);

      await flashcards.review('again');
      await expect(flashcards.question).toHaveText(plain(second.front));
      await expect(flashcards.status).toHaveText(`2 to review · ${total - 2} scheduled`);

      await flashcards.review('easy');
      await expect(flashcards.question).toHaveText(plain(first.front));

      await flashcards.review('good');
      await expect(flashcards.caughtUp).toBeFocused();
      await expect(page.getByText('3 reviews this session. Next card due tomorrow.')).toBeVisible();
    },
  );

  test('a card that is due comes before new cards', { tag: '@regression' }, async ({ flashcards }) => {
    await seedCards(flashcards, { [second.id]: savedCard(PAST) });
    await flashcards.goto();
    await expect(flashcards.question).toHaveText(plain(second.front));
    await flashcards.revealButton.click();
    await expect(flashcards.gradeButton('good')).toContainText('8 days');
  });

  test(
    'a visitor with nothing due sees when to come back',
    { tag: '@regression' },
    async ({ flashcards }) => {
      await seedCards(flashcards, Object.fromEntries(deck.cards.map(({ id }) => [id, savedCard(FUTURE)])));
      await flashcards.goto();
      await expect(flashcards.caughtUp).toBeVisible();
      await expect(flashcards.status).toHaveText(`0 to review · ${total} scheduled`);
      await expect(flashcards.card).toBeHidden();
    },
  );

  test('choosing a chapter starts a new session for it', { tag: '@regression' }, async ({ flashcards }) => {
    await flashcards.goto();
    const { chapterFilter } = flashcards;
    await expect(chapterFilter.getByRole('option')).toHaveText([
      `all chapters (${total})`,
      ...decks.map(deckOption),
    ]);

    await flashcards.revealButton.click();
    await chapterFilter.focus();
    await chapterFilter.selectOption({ label: deckOption(decks[decks.length - 1]) });
    await expect(flashcards.revealButton).toBeVisible();
    await expect(flashcards.answer).toBeHidden();
    await expect(chapterFilter).toBeFocused();
  });

  test(
    'long code wraps instead of widening a 375px page',
    { tag: '@regression' },
    async ({ flashcards, page }) => {
      await page.setViewportSize({ width: 375, height: 800 });
      const longest = 'selectors/scoped-continue';
      const others = deck.cards.filter(({ id }) => id !== longest).map(({ id }) => [id, savedCard(FUTURE)]);
      await seedCards(flashcards, Object.fromEntries(others));
      await flashcards.goto();
      await flashcards.revealButton.click();
      await expect(flashcards.gradeButton('easy')).toBeVisible();
      expect(await flashcards.horizontalOverflow()).toBeLessThanOrEqual(0);
    },
  );

  test(
    'a keyboard user can work through a card',
    { tag: '@regression' },
    async ({ flashcards, page, isMobile }) => {
      test.skip(isMobile, 'covers keyboard use only');
      await flashcards.goto();
      await flashcards.revealButton.focus();
      await page.keyboard.press('Enter');
      await expect(flashcards.answer).toBeFocused();

      await page.keyboard.press('Tab');
      await expect(flashcards.gradeButton('again')).toBeFocused();
      await page.keyboard.press('Tab');
      await page.keyboard.press('Enter');
      await expect(flashcards.question).toBeFocused();
      await expect(flashcards.question).toHaveText(plain(second.front));
    },
  );

  for (const theme of ['dark', 'light']) {
    test(
      `a revealed card has no detectable a11y violations in the ${theme} theme`,
      { tag: '@regression' },
      async ({ flashcards, page }) => {
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await flashcards.presetTheme(theme);
        await flashcards.goto();
        await flashcards.revealButton.click();
        await expect(flashcards.gradeButton('good')).toBeVisible();
        expect(await flashcards.a11yViolations()).toEqual([]);
      },
    );
  }
});
