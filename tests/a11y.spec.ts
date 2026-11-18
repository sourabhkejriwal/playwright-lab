import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const pages = ['/', '/chapters', '/chapters/02-selectors', '/chapters/05-fixtures', '/playground', '/about'];

// Reduced motion makes the reveal animations finish instantly, so axe measures contrast
// on final colors rather than mid-fade. It also exercises the reduced-motion styles.
test.use({ reducedMotion: 'reduce' });

for (const path of pages) {
  test(`no detectable a11y violations on ${path}`, async ({ page }) => {
    await page.goto(path);
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(results.violations).toEqual([]);
  });
}
