import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { PROGRESS_STORAGE_KEY as KEY } from '../src/stores/progress';

const readAt = '2026-11-01T00:00:00.000Z';
const savedProgress = (...slugs: string[]) =>
  JSON.stringify({
    version: 1,
    chapters: Object.fromEntries(slugs.map((slug) => [slug, { readAt }])),
    flashcards: {},
    quizzes: {},
  });

async function seed(page: Page, value: string) {
  await page.addInitScript(([key, raw]) => localStorage.setItem(key, raw), [KEY, value]);
}

const heroRun = (page: Page) => page.getByRole('list', { name: 'Chapter progress' });
const chapterRow = (page: Page) => page.getByRole('main').getByRole('link', { name: /Advanced selectors/ });

async function openSidebar(page: Page, isMobile: boolean) {
  if (isMobile) await page.getByText('browse chapters').click();
  return page.getByRole('navigation', { name: 'Chapters' });
}

test.describe('chapter progress', () => {
  test('a new visitor sees written chapters as ready, not read', async ({ page, isMobile }) => {
    await page.goto('/');
    await expect(heroRun(page).getByRole('link', { name: 'Chapter 2, Selectors: ready' })).toBeVisible();
    await expect(heroRun(page).getByRole('link', { name: 'Chapter 5, Fixtures: pending' })).toBeVisible();
    await expect(page.getByText('0 read')).toBeVisible();
    await expect(page.getByText('1 ready')).toBeVisible();
    await expect(page.getByText('15 pending')).toBeVisible();
    await expect(page.getByRole('link', { name: 'ch02 Advanced selectors' })).toBeVisible();

    const sidebar = await openSidebar(page, isMobile);
    await expect(sidebar.getByText('0/16')).toBeVisible();
  });

  test('a read chapter shows as read on the homepage', async ({ page, isMobile }) => {
    await seed(page, savedProgress('selectors'));
    await page.goto('/');

    await expect(heroRun(page).getByRole('link', { name: 'Chapter 2, Selectors: read' })).toBeVisible();
    await expect(page.getByText('1 read')).toBeVisible();
    await expect(page.getByText('0 ready')).toBeVisible();
    await expect(page.getByText('all written chapters read')).toBeVisible();
    await expect(page.getByText(/next up/)).toBeHidden();

    const sidebar = await openSidebar(page, isMobile);
    await expect(sidebar.getByText('1/16')).toBeVisible();
    await expect(sidebar.getByRole('link', { name: 'read 02 Selectors' })).toBeVisible();
  });

  test('the chapter list and chapter page show the read mark', async ({ page }) => {
    await page.goto('/chapters');
    await expect(chapterRow(page).locator('[data-status="ready"]')).toBeAttached();
    await expect(chapterRow(page).locator('[data-status="read"]')).toBeHidden();

    await page.evaluate(([key, raw]) => localStorage.setItem(key, raw), [KEY, savedProgress('selectors')]);
    await page.reload();
    await expect(chapterRow(page).locator('[data-status="read"]')).toBeVisible();
    await expect(chapterRow(page).locator('[data-status="ready"]')).toBeHidden();

    await page.goto('/chapters/02-selectors');
    const heading = page.getByRole('heading', { level: 1 });
    await expect(heading.locator('[data-status="read"]')).toBeVisible();
  });

  test('a saved entry for an unwritten chapter stays pending and is not counted', async ({ page }) => {
    await seed(page, savedProgress('fixtures'));
    await page.goto('/');
    await expect(heroRun(page).getByRole('link', { name: 'Chapter 5, Fixtures: pending' })).toBeVisible();
    await expect(page.getByText('0 read')).toBeVisible();
    await expect(page.getByRole('link', { name: 'ch02 Advanced selectors' })).toBeVisible();
  });

  test('progress saved in another tab appears without a reload', async ({ page, context }) => {
    await page.goto('/');
    await expect(page.getByText('0 read')).toBeVisible();

    const other = await context.newPage();
    await other.goto('/about');
    await other.evaluate(([key, raw]) => localStorage.setItem(key, raw), [KEY, savedProgress('selectors')]);

    await expect(page.getByText('1 read')).toBeVisible();
    await expect(heroRun(page).getByRole('link', { name: 'Chapter 2, Selectors: read' })).toBeVisible();
  });

  test('damaged saved progress falls back to the unread state', async ({ page }) => {
    await seed(page, '{oops');
    await page.goto('/');
    await expect(heroRun(page).getByRole('link', { name: 'Chapter 2, Selectors: ready' })).toBeVisible();
    await expect(page.getByText('0 read')).toBeVisible();
  });

  test.describe('accessibility with a chapter read', () => {
    test.use({ reducedMotion: 'reduce' });

    for (const theme of ['dark', 'light']) {
      for (const path of ['/', '/chapters', '/chapters/02-selectors']) {
        test(`no detectable a11y violations on ${path} in the ${theme} theme`, async ({ page }) => {
          await seed(page, savedProgress('selectors'));
          await page.addInitScript((value) => localStorage.setItem('playwright-lab:theme', value), theme);
          await page.goto(path);
          // The homepage has no visible mark on mobile (the sidebar is closed), but its hero segment counts.
          await expect(page.locator('[data-if-read]:visible').first()).toBeVisible();
          const results = await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
            .analyze();
          expect(results.violations).toEqual([]);
        });
      }
    }
  });
});
