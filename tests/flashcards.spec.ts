import { readdirSync, readFileSync } from 'node:fs';
import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { chapters, pad } from '../src/data/chapters';
import {
  ALL_CHAPTERS,
  buildQueue,
  cardsForChapter,
  formatDueDate,
  MAX_INTERVAL_DAYS,
  nextInterval,
  scheduleReview,
  upcoming,
} from '../src/lib/flashcards';
import { PROGRESS_STORAGE_KEY as KEY, type FlashcardProgress } from '../src/stores/progress';

interface Deck {
  chapter: number;
  cards: { id: string; front: string; back: string }[];
}

// Every chapter's deck in chapter order, which is the order "all chapters" studies them in.
const deckDir = new URL('../src/content/flashcards/', import.meta.url);
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
  test.skip(({ isMobile }) => isMobile, 'no browser involved, so one project is enough');

  const card = (id: string) => ({ id, front: 'Question?', back: 'Answer.' });
  const now = new Date(2026, 5, 15, 21, 30);

  test('again resets the interval, and good and easy grow it at different rates', () => {
    expect(nextInterval('again', 30)).toBe(0);
    expect(nextInterval('good')).toBe(1);
    expect(nextInterval('easy')).toBe(4);
    expect(nextInterval('good', 4)).toBe(10);
    expect(nextInterval('easy', 4)).toBe(16);
    expect(nextInterval('easy', 300)).toBe(MAX_INTERVAL_DAYS);
  });

  test('a failed card is due at once, and a passed card at local midnight', () => {
    expect(scheduleReview('again', undefined, now).dueAt).toBe(now.toISOString());
    expect(scheduleReview('good', undefined, now)).toEqual({
      grade: 'good',
      intervalDays: 1,
      dueAt: new Date(2026, 5, 16).toISOString(),
    });
  });

  test('the queue puts the oldest due card first, new cards last, and skips future cards', () => {
    const cards = ['new', 'later', 'recent', 'oldest'].map(card);
    const saved = {
      later: savedCard(FUTURE),
      recent: savedCard('2026-06-10T00:00:00.000Z'),
      oldest: savedCard('2026-06-01T00:00:00.000Z'),
    };
    expect(buildQueue(cards, saved, now)).toEqual(['oldest', 'recent', 'new']);
    expect(upcoming(cards, saved, now)).toEqual({ scheduled: 1, nextDueAt: new Date(FUTURE) });
  });

  test('a chapter filter keeps only that chapter', () => {
    const decks = [
      { slug: 'selectors', label: 'ch02 selectors', cards: [card('selectors/a')] },
      { slug: 'fixtures', label: 'ch05 fixtures', cards: [card('fixtures/b')] },
    ];
    expect(cardsForChapter(decks, 'fixtures').map(({ id }) => id)).toEqual(['fixtures/b']);
    expect(cardsForChapter(decks, ALL_CHAPTERS)).toHaveLength(2);
  });

  test('due dates read as calendar days', () => {
    expect(formatDueDate(new Date(2026, 5, 16, 0), now)).toBe('tomorrow');
    expect(formatDueDate(new Date(2026, 5, 19, 0), now)).toBe('in 4 days');
  });
});

test.describe('flashcards page', () => {
  const flashcard = (page: Page) => page.getByRole('article', { name: 'Flashcard' });
  const question = (page: Page) => flashcard(page).getByRole('heading', { level: 2 });
  const reveal = (page: Page) => page.getByRole('button', { name: 'reveal answer' });
  const gradeButton = (page: Page, name: string) =>
    page.getByRole('button', { name: new RegExp(`^${name}\\b`) });
  const status = (page: Page) => page.getByRole('status');

  async function seed(page: Page, flashcards: Record<string, FlashcardProgress>) {
    const raw = JSON.stringify({ version: 1, chapters: {}, flashcards, quizzes: {} });
    await page.addInitScript(([key, value]) => localStorage.setItem(key, value), [KEY, raw]);
  }

  test('the answer stays hidden until it is revealed', async ({ page }) => {
    await page.goto('/flashcards');
    await expect(question(page)).toHaveText(first.front.replaceAll('`', ''));
    await expect(status(page)).toHaveText(`${total} to review · 0 scheduled`);
    await expect(page.getByRole('group', { name: 'Answer' })).toBeHidden();
    await expect(gradeButton(page, 'good')).toBeHidden();

    await reveal(page).click();
    await expect(page.getByRole('group', { name: 'Answer' })).toHaveText(first.back.replaceAll('`', ''));
    await expect(gradeButton(page, 'again')).toContainText('now');
    await expect(gradeButton(page, 'good')).toContainText('1 day');
    await expect(gradeButton(page, 'easy')).toContainText('4 days');
  });

  test('code in backticks renders as code', async ({ page }) => {
    await page.goto('/flashcards');
    await reveal(page).click();
    const code = first.back.match(/`([^`]+)`/)?.[1] ?? '';
    await expect(page.getByRole('group', { name: 'Answer' }).locator('code').first()).toHaveText(code);
  });

  test('a graded card is saved and stays away after a reload', async ({ page }) => {
    await page.goto('/flashcards');
    await reveal(page).click();
    await gradeButton(page, 'good').click();

    await expect(question(page)).toHaveText(second.front.replaceAll('`', ''));
    await expect(status(page)).toHaveText(`${total - 1} to review · 1 scheduled`);

    await page.reload();
    await expect(question(page)).toHaveText(second.front.replaceAll('`', ''));
    const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '{}'), KEY);
    expect(saved.flashcards[first.id]).toMatchObject({ grade: 'good', intervalDays: 1, reviews: 1 });
  });

  test('again sends the card to the back of the queue', async ({ page }) => {
    const others = deck.cards.slice(2).map(({ id }) => [id, savedCard(FUTURE)]);
    await seed(page, Object.fromEntries(others));
    await page.goto('/flashcards');
    await expect(status(page)).toHaveText(`2 to review · ${total - 2} scheduled`);

    await reveal(page).click();
    await gradeButton(page, 'again').click();
    await expect(question(page)).toHaveText(second.front.replaceAll('`', ''));
    await expect(status(page)).toHaveText(`2 to review · ${total - 2} scheduled`);

    await reveal(page).click();
    await gradeButton(page, 'easy').click();
    await expect(question(page)).toHaveText(first.front.replaceAll('`', ''));

    await reveal(page).click();
    await gradeButton(page, 'good').click();
    await expect(page.getByRole('heading', { name: 'all caught up' })).toBeFocused();
    await expect(page.getByText('3 reviews this session. Next card due tomorrow.')).toBeVisible();
  });

  test('a card that is due comes before new cards', async ({ page }) => {
    await seed(page, { [second.id]: savedCard(PAST) });
    await page.goto('/flashcards');
    await expect(question(page)).toHaveText(second.front.replaceAll('`', ''));
    await reveal(page).click();
    await expect(gradeButton(page, 'good')).toContainText('8 days');
  });

  test('a visitor with nothing due sees when to come back', async ({ page }) => {
    await seed(page, Object.fromEntries(deck.cards.map(({ id }) => [id, savedCard(FUTURE)])));
    await page.goto('/flashcards');
    await expect(page.getByRole('heading', { name: 'all caught up' })).toBeVisible();
    await expect(status(page)).toHaveText(`0 to review · ${total} scheduled`);
    await expect(flashcard(page)).toBeHidden();
  });

  test('choosing a chapter starts a new session for it', async ({ page }) => {
    await page.goto('/flashcards');
    const chapter = page.getByRole('combobox', { name: 'chapter' });
    await expect(chapter.getByRole('option')).toHaveText([
      `all chapters (${total})`,
      ...decks.map(deckOption),
    ]);

    await reveal(page).click();
    await chapter.focus();
    await chapter.selectOption({ label: deckOption(decks[decks.length - 1]) });
    await expect(reveal(page)).toBeVisible();
    await expect(page.getByRole('group', { name: 'Answer' })).toBeHidden();
    await expect(chapter).toBeFocused();
  });

  test('long code wraps instead of widening a 375px page', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    const longest = 'selectors/scoped-continue';
    const others = deck.cards.filter(({ id }) => id !== longest).map(({ id }) => [id, savedCard(FUTURE)]);
    await seed(page, Object.fromEntries(others));
    await page.goto('/flashcards');
    await reveal(page).click();
    await expect(gradeButton(page, 'easy')).toBeVisible();

    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
  });

  test('a keyboard user can work through a card', async ({ page, isMobile }) => {
    test.skip(isMobile, 'covers keyboard use only');
    await page.goto('/flashcards');
    await reveal(page).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('group', { name: 'Answer' })).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(gradeButton(page, 'again')).toBeFocused();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    await expect(question(page)).toBeFocused();
    await expect(question(page)).toHaveText(second.front.replaceAll('`', ''));
  });

  for (const theme of ['dark', 'light']) {
    test(`a revealed card has no detectable a11y violations in the ${theme} theme`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.addInitScript((value) => localStorage.setItem('playwright-lab:theme', value), theme);
      await page.goto('/flashcards');
      await reveal(page).click();
      await expect(gradeButton(page, 'good')).toBeVisible();
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
      expect(results.violations).toEqual([]);
    });
  }
});
