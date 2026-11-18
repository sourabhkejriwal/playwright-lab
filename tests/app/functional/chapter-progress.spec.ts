import { test, expect } from '../../../fixtures/pom/test-options';
import { statusMark } from '../../../pages/app/site.page';
import { savedProgress } from '../../../helpers/app/saved-progress';

const readAt = '2026-11-01T00:00:00.000Z';
const chaptersRead = (...slugs: string[]) =>
  savedProgress({ chapters: Object.fromEntries(slugs.map((slug) => [slug, { readAt }])) });

test.describe('chapter progress', () => {
  test(
    'a new visitor sees written chapters as ready, not read',
    { tag: '@regression' },
    async ({ home, isMobile }) => {
      await home.goto();
      await expect(home.runLink('Chapter 2, Selectors: ready')).toBeVisible();
      await expect(home.runLink('Chapter 16, E-commerce: ready')).toBeVisible();
      await expect(home.readCount(0)).toBeVisible();
      await expect(home.readyCount(16)).toBeVisible();
      await expect(home.pendingCount).toBeHidden();
      await expect(home.firstChapterLink).toBeVisible();

      await home.sidebar.open(isMobile);
      await expect(home.sidebar.nav.getByText('0/16')).toBeVisible();
    },
  );

  test('read chapters show as read on the homepage', { tag: '@regression' }, async ({ home, isMobile }) => {
    await home.seedProgress(
      chaptersRead(
        'setup',
        'selectors',
        'cross-browser',
        'ai-test-generation',
        'fixtures',
        'parallelization',
        'ci-cd',
        'headless-debugging',
        'accessibility',
        'visual-regression',
        'mobile',
        'forms',
        'files',
        'security-auth',
        'maintainability',
        'ecommerce-project',
      ),
    );
    await home.goto();

    await expect(home.runLink('Chapter 2, Selectors: read')).toBeVisible();
    await expect(home.readCount(16)).toBeVisible();
    await expect(home.readyCount(0)).toBeVisible();
    await expect(home.allRead).toBeVisible();
    await expect(home.nextUp).toBeHidden();

    await home.sidebar.open(isMobile);
    await expect(home.sidebar.nav.getByText('16/16')).toBeVisible();
    await expect(home.sidebar.link('read 02 Selectors')).toBeVisible();
  });

  test(
    'the chapter list and chapter page show the read mark',
    { tag: '@regression' },
    async ({ chapterList, chapter, page }) => {
      const row = chapterList.row(/Advanced selectors/);
      await chapterList.goto();
      await expect(statusMark(row, 'ready')).toBeAttached();
      await expect(statusMark(row, 'read')).toBeHidden();

      await chapterList.writeProgress(chaptersRead('selectors'));
      await page.reload();
      await expect(statusMark(row, 'read')).toBeVisible();
      await expect(statusMark(row, 'ready')).toBeHidden();

      await chapter.goto('02-selectors');
      await expect(statusMark(chapter.h1, 'read')).toBeVisible();
    },
  );

  test('a saved entry for an unknown chapter is not counted', { tag: '@regression' }, async ({ home }) => {
    await home.seedProgress(chaptersRead('retired-chapter'));
    await home.goto();
    await expect(home.runLink('Chapter 16, E-commerce: ready')).toBeVisible();
    await expect(home.readCount(0)).toBeVisible();
    await expect(home.firstChapterLink).toBeVisible();
  });

  test(
    'progress saved in another tab appears without a reload',
    { tag: '@regression' },
    async ({ home, openSiteTab }) => {
      await home.goto();
      await expect(home.readCount(0)).toBeVisible();

      const otherTab = await openSiteTab();
      await otherTab.visit('/about');
      await otherTab.writeProgress(chaptersRead('selectors'));

      await expect(home.readCount(1)).toBeVisible();
      await expect(home.runLink('Chapter 2, Selectors: read')).toBeVisible();
    },
  );

  test('damaged saved progress falls back to the unread state', { tag: '@regression' }, async ({ home }) => {
    await home.seedProgress('{oops');
    await home.goto();
    await expect(home.runLink('Chapter 2, Selectors: ready')).toBeVisible();
    await expect(home.readCount(0)).toBeVisible();
  });

  test.describe('mark chapter as done', () => {
    test(
      'marking a chapter done updates the page and survives a reload',
      { tag: '@regression' },
      async ({ chapter, page, isMobile }) => {
        await chapter.goto('02-selectors');
        await expect(chapter.doneButton).toHaveAttribute('aria-pressed', 'false');
        await expect(statusMark(chapter.h1, 'ready')).toBeVisible();

        await chapter.doneButton.click();

        await expect(chapter.doneButton).toHaveAttribute('aria-pressed', 'true');
        await expect(statusMark(chapter.h1, 'read')).toBeVisible();
        await expect(page.getByText('chapter done. click again to mark it unread.')).toBeVisible();
        await chapter.sidebar.open(isMobile);
        await expect(chapter.sidebar.nav.getByText('1/16')).toBeVisible();

        await page.reload();
        await expect(chapter.doneButton).toHaveAttribute('aria-pressed', 'true');
        await expect(statusMark(chapter.h1, 'read')).toBeVisible();
      },
    );

    test('clicking again marks the chapter unread', { tag: '@regression' }, async ({ chapter, page }) => {
      await chapter.seedProgress(chaptersRead('selectors'));
      await chapter.goto('02-selectors');
      await expect(chapter.doneButton).toHaveAttribute('aria-pressed', 'true');

      await chapter.doneButton.click();

      await expect(chapter.doneButton).toHaveAttribute('aria-pressed', 'false');
      await expect(statusMark(chapter.h1, 'ready')).toBeVisible();
      await expect(page.getByText('finished these notes?')).toBeVisible();
      expect((await chapter.savedProgress()).chapters).toEqual({});
    });

    test('follows a change made in another tab', { tag: '@regression' }, async ({ chapter, openSiteTab }) => {
      await chapter.goto('02-selectors');
      await expect(chapter.doneButton).toHaveAttribute('aria-pressed', 'false');

      const otherTab = await openSiteTab();
      await otherTab.visit('/about');
      await otherTab.writeProgress(chaptersRead('selectors'));

      await expect(chapter.doneButton).toHaveAttribute('aria-pressed', 'true');
    });

    test.describe('without JavaScript', () => {
      test.use({ javaScriptEnabled: false });

      test('the control stays hidden', { tag: '@regression' }, async ({ chapter }) => {
        await chapter.goto('02-selectors');
        await expect(chapter.h1).toBeVisible();
        await expect(chapter.doneButton).toHaveCount(0);
      });
    });

    test.describe('accessibility', () => {
      test.use({ reducedMotion: 'reduce' });

      for (const theme of ['dark', 'light']) {
        for (const state of ['unread', 'done']) {
          test(
            `no detectable a11y violations when ${state} in the ${theme} theme`,
            { tag: '@regression' },
            async ({ chapter }) => {
              if (state === 'done') await chapter.seedProgress(chaptersRead('selectors'));
              await chapter.presetTheme(theme);
              await chapter.goto('02-selectors');
              await expect(chapter.doneButton).toHaveAttribute('aria-pressed', String(state === 'done'));
              expect(await chapter.a11yViolations()).toEqual([]);
            },
          );
        }
      }
    });
  });

  test.describe('accessibility with a chapter read', () => {
    test.use({ reducedMotion: 'reduce' });

    for (const theme of ['dark', 'light']) {
      for (const path of ['/', '/chapters', '/chapters/02-selectors']) {
        test(
          `no detectable a11y violations on ${path} in the ${theme} theme`,
          { tag: '@regression' },
          async ({ site }) => {
            await site.seedProgress(chaptersRead('selectors'));
            await site.presetTheme(theme);
            await site.visit(path);
            // The homepage has no visible mark on mobile (the sidebar is closed), but its hero segment counts.
            await expect(site.firstReadOnlyContent).toBeVisible();
            expect(await site.a11yViolations()).toEqual([]);
          },
        );
      }
    }
  });
});
