import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { excerptParts, toHits } from '../src/lib/search';

const searchButton = (page: Page) => page.getByRole('button', { name: 'search', exact: true });

test.describe('search results', () => {
  test('excerpts become plain text with the matches marked', () => {
    expect(excerptParts('use <mark>getByRole</mark> &amp; &lt;button&gt;')).toEqual([
      { text: 'use ', match: false },
      { text: 'getByRole', match: true },
      { text: ' & <button>', match: false },
    ]);
  });

  test('entities are decoded once, so escaped text stays as written', () => {
    expect(excerptParts('&amp;lt;')).toEqual([{ text: '&lt;', match: false }]);
  });

  test('each matching section gets a row, and only headings are named as sections', () => {
    const hits = toHits([
      {
        url: '/a/',
        excerpt: 'page',
        meta: { title: 'ch02 Selectors' },
        sub_results: [
          { title: 'ch02 Selectors', url: '/a/', excerpt: 'intro' },
          { title: 'Roles', url: '/a/#roles', excerpt: 'roles' },
          { title: 'Roles', url: '/a/#roles', excerpt: 'duplicate' },
        ],
      },
    ]);
    expect(hits).toEqual([
      { href: '/a/', page: 'ch02 Selectors', section: null, excerpt: 'intro' },
      { href: '/a/#roles', page: 'ch02 Selectors', section: 'Roles', excerpt: 'roles' },
    ]);
  });

  test('a page without sections still gets a row', () => {
    const hits = toHits([{ url: '/b/', excerpt: 'text', meta: { title: 'About' } }]);
    expect(hits).toEqual([{ href: '/b/', page: 'About', section: null, excerpt: 'text' }]);
  });
});

test.describe('search layout', () => {
  test('the top bar keeps to one row at the smallest desktop width', async ({ page, isMobile }) => {
    test.skip(isMobile, 'the fixed-height top bar starts at the lg breakpoint');
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto('/about');
    await expect(searchButton(page)).toBeVisible();
    const header = page.getByRole('banner');
    expect(await header.evaluate((el) => el.scrollHeight <= el.clientHeight)).toBe(true);
  });

  test('the open dialog fits a 375px screen', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/about');
    const dialog = await searchFor(page, 'locator');
    await expect(dialog.getByRole('option').first()).toBeVisible();

    const box = await dialog.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(375);
    expect(box!.y + box!.height).toBeLessThanOrEqual(667);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  });
});

async function searchFor(page: Page, query: string) {
  await searchButton(page).click();
  const dialog = page.getByRole('dialog', { name: 'search' });
  await dialog.getByRole('combobox', { name: 'search notes and tools' }).fill(query);
  return dialog;
}

test.describe('site search', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/about');
    await expect(searchButton(page)).toBeVisible();
  });

  test('the keyboard shortcut opens and closes the dialog', async ({ page }) => {
    const dialog = page.getByRole('dialog', { name: 'search' });
    await page.keyboard.press('ControlOrMeta+K');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('combobox')).toBeFocused();

    await page.keyboard.press('ControlOrMeta+K');
    await expect(dialog).toBeHidden();
  });

  test('escape closes the dialog and returns focus to the button', async ({ page }) => {
    await searchButton(page).click();
    const dialog = page.getByRole('dialog', { name: 'search' });
    await expect(dialog.getByRole('combobox')).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(searchButton(page)).toBeFocused();
  });

  test('finds a section of the chapter notes and opens it', async ({ page }) => {
    const dialog = await searchFor(page, 'user-facing locators');
    const result = dialog.getByRole('option', { name: /Start with user-facing locators/ });
    await expect(result).toBeVisible();
    await expect(result.locator('mark').first()).toBeVisible();

    await result.click();
    await expect(page).toHaveURL(/\/chapters\/02-selectors\/?#start-with-user-facing-locators$/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Advanced selectors');
    await expect(dialog).toBeHidden();
  });

  test('arrow keys choose a result and enter opens it', async ({ page }) => {
    const dialog = await searchFor(page, 'locator');
    const results = dialog.getByRole('option');
    await expect(results.nth(1)).toBeVisible();
    await expect(results.first()).toHaveAttribute('aria-selected', 'true');

    await page.keyboard.press('ArrowDown');
    await expect(results.nth(1)).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowUp');
    await expect(results.last()).toHaveAttribute('aria-selected', 'true');

    const href = await results.last().getAttribute('href');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL((current) => current.pathname + current.hash === href);
  });

  test('a result on the current page closes the dialog', async ({ page }) => {
    await page.goto('/chapters/02-selectors');
    const dialog = await searchFor(page, 'user-facing locators');
    await dialog.getByRole('option', { name: /Start with user-facing locators/ }).click();
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(/#start-with-user-facing-locators$/);
  });

  test('says when nothing matches', async ({ page }) => {
    const dialog = await searchFor(page, 'xylophone');
    await expect(dialog.getByRole('status')).toHaveText('no results for "xylophone"');
    await expect(dialog.getByRole('option')).toHaveCount(0);
    await expect(dialog.getByRole('combobox')).toHaveAttribute('aria-expanded', 'false');
  });

  test('explains when the index cannot be loaded', async ({ page }) => {
    await page.route('**/pagefind/pagefind.js', (route) => route.abort());
    const dialog = await searchFor(page, 'locator');
    await expect(dialog.getByRole('status')).toHaveText("search isn't available right now");
  });

  test('leaves out listings, placeholders and the quiz', async ({ page }) => {
    const dialog = await searchFor(page, 'pipeline');
    await expect(dialog.getByRole('status')).toHaveText(/result/);
    const hrefs = await dialog
      .getByRole('option')
      .evaluateAll((all) => all.map((a) => a.getAttribute('href')));
    for (const href of hrefs) expect(href).not.toMatch(/\/chapters\/?$|\/chapters\/07-ci-cd/);

    await dialog.getByRole('combobox').fill('Chapter quiz');
    await expect(dialog.getByRole('status')).not.toHaveText(/type to search/);
    await expect(dialog.getByRole('option', { name: /Chapter quiz/ })).toHaveCount(0);
  });

  for (const theme of ['dark', 'light']) {
    test(`the open dialog has no detectable a11y violations in the ${theme} theme`, async ({ page }) => {
      await page.addInitScript((value) => localStorage.setItem('playwright-lab:theme', value), theme);
      await page.goto('/about');
      const dialog = await searchFor(page, 'locator');
      await expect(dialog.getByRole('option').first()).toBeVisible();
      const results = await new AxeBuilder({ page })
        .include('[data-search-dialog]')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();
      expect(results.violations).toEqual([]);
    });
  }
});
