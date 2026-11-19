import { test, expect } from '../../fixtures/pom/test-options';
import { excerptParts, toHits } from '../../../src/lib/search';

test.describe('search results', () => {
  test('excerpts become plain text with the matches marked', { tag: '@regression' }, () => {
    expect(excerptParts('use <mark>getByRole</mark> &amp; &lt;button&gt;')).toEqual([
      { text: 'use ', match: false },
      { text: 'getByRole', match: true },
      { text: ' & <button>', match: false },
    ]);
  });

  test('entities are decoded once, so escaped text stays as written', { tag: '@regression' }, () => {
    expect(excerptParts('&amp;lt;')).toEqual([{ text: '&lt;', match: false }]);
  });

  test(
    'each matching section gets a row, and only headings are named as sections',
    { tag: '@regression' },
    () => {
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
    },
  );

  test('a page without sections still gets a row', { tag: '@regression' }, () => {
    const hits = toHits([{ url: '/b/', excerpt: 'text', meta: { title: 'About' } }]);
    expect(hits).toEqual([{ href: '/b/', page: 'About', section: null, excerpt: 'text' }]);
  });
});

test.describe('search layout', () => {
  test(
    'the top bar keeps to one row at the smallest desktop width',
    { tag: '@regression' },
    async ({ site, page, isMobile }) => {
      test.skip(isMobile, 'the fixed-height top bar starts at the lg breakpoint');
      await page.setViewportSize({ width: 1024, height: 768 });
      await site.visit('/about');
      await expect(site.search.button).toBeVisible();
      expect(await site.topBar.banner.evaluate((el) => el.scrollHeight <= el.clientHeight)).toBe(true);
    },
  );

  test('the open dialog fits a 375px screen', { tag: '@regression' }, async ({ site, page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await site.visit('/about');
    await site.search.searchFor('locator');
    await expect(site.search.firstResult).toBeVisible();

    const box = await site.search.dialog.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(375);
    expect(box!.y + box!.height).toBeLessThanOrEqual(667);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  });
});

test.describe('site search', () => {
  test.beforeEach(async ({ site }) => {
    await site.visit('/about');
    await expect(site.search.button).toBeVisible();
  });

  test(
    'the keyboard shortcut opens and closes the dialog',
    { tag: '@regression' },
    async ({ site, page }) => {
      await page.keyboard.press('ControlOrMeta+K');
      await expect(site.search.dialog).toBeVisible();
      await expect(site.search.input).toBeFocused();

      await page.keyboard.press('ControlOrMeta+K');
      await expect(site.search.dialog).toBeHidden();
    },
  );

  test(
    'escape closes the dialog and returns focus to the button',
    { tag: '@regression' },
    async ({ site, page }) => {
      // Opened from the keyboard, because Safari doesn't focus a button that is clicked.
      await site.search.button.focus();
      await page.keyboard.press('Enter');
      await expect(site.search.input).toBeFocused();

      await page.keyboard.press('Escape');
      await expect(site.search.dialog).toBeHidden();
      await expect(site.search.button).toBeFocused();
    },
  );

  test(
    'finds a section of the chapter notes and opens it',
    { tag: '@regression' },
    async ({ site, page }) => {
      await site.search.searchFor('user-facing locators');
      const result = site.search.result(/Start with user-facing locators/);
      await expect(result).toBeVisible();
      await expect(site.search.firstMark(result)).toBeVisible();

      await result.click();
      await expect(page).toHaveURL(/\/chapters\/02-selectors\/?#start-with-user-facing-locators$/);
      await expect(site.h1).toContainText('Advanced selectors');
      await expect(site.search.dialog).toBeHidden();
    },
  );

  test('arrow keys choose a result and enter opens it', { tag: '@regression' }, async ({ site, page }) => {
    await site.search.searchFor('locator');
    await expect(site.search.secondResult).toBeVisible();
    await expect(site.search.firstResult).toHaveAttribute('aria-selected', 'true');

    await page.keyboard.press('ArrowDown');
    await expect(site.search.secondResult).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowUp');
    await expect(site.search.lastResult).toHaveAttribute('aria-selected', 'true');

    const href = await site.search.lastResult.getAttribute('href');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL((current) => current.pathname + current.hash === href);
  });

  test(
    'a result on the current page closes the dialog',
    { tag: '@regression' },
    async ({ chapter, page }) => {
      await chapter.goto('02-selectors');
      await chapter.search.searchFor('user-facing locators');
      await chapter.search.result(/Start with user-facing locators/).click();
      await expect(chapter.search.dialog).toBeHidden();
      await expect(page).toHaveURL(/#start-with-user-facing-locators$/);
    },
  );

  test('says when nothing matches', { tag: '@regression' }, async ({ site }) => {
    await site.search.searchFor('xylophone');
    await expect(site.search.status).toHaveText('no results for "xylophone"');
    await expect(site.search.results).toHaveCount(0);
    await expect(site.search.input).toHaveAttribute('aria-expanded', 'false');
  });

  test('explains when the index cannot be loaded', { tag: '@regression' }, async ({ site, page }) => {
    await page.route('**/pagefind/pagefind.js', (route) => route.abort());
    await site.search.searchFor('locator');
    await expect(site.search.status).toHaveText("search isn't available right now");
  });

  test('leaves out listings and the quiz', { tag: '@regression' }, async ({ site }) => {
    await site.search.searchFor('e-commerce');
    await expect(site.search.status).toHaveText(/result/);
    const hrefs = await site.search.results.evaluateAll((all) => all.map((a) => a.getAttribute('href')));
    for (const href of hrefs) expect(href).not.toMatch(/\/chapters\/?$/);

    await site.search.input.fill('Chapter quiz');
    await expect(site.search.status).not.toHaveText(/type to search/);
    await expect(site.search.result(/Chapter quiz/)).toHaveCount(0);
  });

  for (const theme of ['dark', 'light']) {
    test(
      `the open dialog has no detectable a11y violations in the ${theme} theme`,
      { tag: '@regression' },
      async ({ site }) => {
        await site.presetTheme(theme);
        await site.visit('/about');
        await site.search.searchFor('locator');
        await expect(site.search.firstResult).toBeVisible();
        expect(await site.a11yViolations({ include: '[data-search-dialog]' })).toEqual([]);
      },
    );
  }
});
