import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// axe tags are exact: each one selects only the rules added at that WCAG version and level.
const wcagTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

const pages = [
  '/',
  '/chapters',
  '/chapters/01-setup',
  '/chapters/02-selectors',
  '/chapters/03-cross-browser',
  '/chapters/04-ai-test-generation',
  '/chapters/05-fixtures',
  '/chapters/06-parallelization',
  '/chapters/07-ci-cd',
  '/chapters/08-headless-debugging',
  '/chapters/09-accessibility',
  '/chapters/10-visual-regression',
  '/playground',
  '/flashcards',
  '/config',
  '/ci',
  '/auto-waiting',
  '/fixture-graph',
  '/parallel',
  '/flaky',
  '/about',
];

// Reduced motion makes the reveal animations finish instantly, so axe measures contrast
// on final colors rather than mid-fade. It also exercises the reduced-motion styles.
test.use({ reducedMotion: 'reduce' });

for (const path of pages) {
  test(`no detectable a11y violations on ${path}`, async ({ page }) => {
    await page.goto(path);
    const results = await new AxeBuilder({ page }).withTags(wcagTags).analyze();
    expect(results.violations).toEqual([]);
  });

  test(`no detectable a11y violations on ${path} in the light theme`, async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('playwright-lab:theme', 'light'));
    await page.goto(path);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    const results = await new AxeBuilder({ page }).withTags(wcagTags).analyze();
    expect(results.violations).toEqual([]);
  });
}
