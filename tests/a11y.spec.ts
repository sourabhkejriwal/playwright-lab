import { test, expect } from './pages/fixtures';

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
  '/chapters/11-mobile',
  '/chapters/12-forms',
  '/chapters/13-files',
  '/chapters/14-security-auth',
  '/chapters/15-maintainability',
  '/chapters/16-ecommerce-project',
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
  test(`no detectable a11y violations on ${path}`, async ({ site }) => {
    await site.visit(path);
    expect(await site.a11yViolations({ tags: wcagTags })).toEqual([]);
  });

  test(`no detectable a11y violations on ${path} in the light theme`, async ({ site }) => {
    await site.presetTheme('light');
    await site.visit(path);
    await expect(site.html).toHaveAttribute('data-theme', 'light');
    expect(await site.a11yViolations({ tags: wcagTags })).toEqual([]);
  });
}
