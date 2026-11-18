import { test, expect } from '@playwright/test';

test.describe('home', () => {
  test('shows the hero and the chapter test run', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle('playwright-lab');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Learn Playwright by');

    const run = page.getByRole('list', { name: 'Chapter progress' });
    await expect(run.getByRole('listitem')).toHaveCount(16);
    await expect(run.getByRole('link', { name: /Selectors/ })).toBeVisible();
  });

  test('main navigation reaches every section', async ({ page }) => {
    await page.goto('/');
    const nav = page.getByRole('navigation', { name: 'Main' });
    for (const [label, heading] of [
      ['chapters', 'Chapters'],
      ['playground', 'Locator playground'],
      ['flashcards', 'Flashcards'],
      ['about', 'About'],
    ]) {
      await nav.getByRole('link', { name: label }).click();
      await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
      await expect(nav.getByRole('link', { name: `./${label}` })).toHaveAttribute('aria-current', 'page');
    }
  });
});

test.describe('chapters', () => {
  test('a written chapter renders its MDX content', async ({ page }) => {
    await page.goto('/chapters/02-selectors');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Advanced selectors');
    await expect(
      page.getByRole('heading', { level: 2, name: 'Start with user-facing locators' }),
    ).toBeVisible();
    await expect(page.locator('pre').first()).toContainText('getByRole');
  });

  test('an unwritten chapter shows a pending placeholder', async ({ page }) => {
    await page.goto('/chapters/05-fixtures');
    await expect(page.getByText("notes for this chapter aren't written yet")).toBeVisible();
  });

  test('prev/next links walk the chapters', async ({ page }) => {
    await page.goto('/chapters/01-setup');
    await page
      .getByRole('navigation', { name: 'Chapter' })
      .getByRole('link', { name: /02 Selectors/ })
      .click();
    await expect(page).toHaveURL(/\/chapters\/02-selectors\/?$/);
  });
});

test('unknown routes show the 404 page', async ({ page }) => {
  const res = await page.goto('/does-not-exist');
  expect(res?.status()).toBe(404);
  await expect(page.getByText('page not found')).toBeVisible();
});
