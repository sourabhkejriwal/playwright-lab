import { test, expect } from '../../../fixtures/pom/test-options';
import { WCAG_TAGS, A11Y_PAGES } from '../../../test-data/static/app/a11y-pages';

// Reduced motion makes the reveal animations finish instantly, so axe measures contrast
// on final colors rather than mid-fade. It also exercises the reduced-motion styles.
test.use({ reducedMotion: 'reduce' });

for (const path of A11Y_PAGES) {
  test(`no detectable a11y violations on ${path}`, { tag: '@regression' }, async ({ site }) => {
    await site.visit(path);
    expect(await site.a11yViolations({ tags: WCAG_TAGS })).toEqual([]);
  });

  test(
    `no detectable a11y violations on ${path} in the light theme`,
    { tag: '@regression' },
    async ({ site }) => {
      await site.presetTheme('light');
      await site.visit(path);
      await expect(site.html).toHaveAttribute('data-theme', 'light');
      expect(await site.a11yViolations({ tags: WCAG_TAGS })).toEqual([]);
    },
  );
}
