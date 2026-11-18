import { test, expect } from '../../../fixtures/pom/test-options';

const DARK_BG = 'rgb(11, 14, 20)';
const LIGHT_BG = 'rgb(247, 248, 250)';

test.describe('theme toggle', () => {
  test(
    'dark is the default, even when the system prefers light',
    { tag: '@regression' },
    async ({ home, page }) => {
      await page.emulateMedia({ colorScheme: 'light' });
      await home.goto();
      await expect(home.html).toHaveAttribute('data-theme', 'dark');
      await expect(home.html).toHaveCSS('background-color', DARK_BG);
      await expect(home.topBar.themeToggle).toHaveAttribute('aria-pressed', 'false');
    },
  );

  test('switches to light and back', { tag: '@regression' }, async ({ home }) => {
    await home.goto();

    await home.topBar.themeToggle.click();
    await expect(home.topBar.themeToggle).toHaveAttribute('aria-pressed', 'true');
    await expect(home.html).toHaveCSS('background-color', LIGHT_BG);
    await expect(home.html).toHaveCSS('color-scheme', 'light');
    await expect(home.themeColor).toHaveAttribute('content', '#f7f8fa');

    await home.topBar.themeToggle.click();
    await expect(home.topBar.themeToggle).toHaveAttribute('aria-pressed', 'false');
    await expect(home.html).toHaveCSS('background-color', DARK_BG);
    await expect(home.themeColor).toHaveAttribute('content', '#0b0e14');
  });

  test('works from the keyboard', { tag: '@regression' }, async ({ home, page }) => {
    await home.goto();
    await home.topBar.themeToggle.focus();
    await page.keyboard.press('Enter');
    await expect(home.topBar.themeToggle).toHaveAttribute('aria-pressed', 'true');
  });

  test('the choice survives navigation and reload', { tag: '@regression' }, async ({ home, page }) => {
    await home.goto();
    await home.topBar.themeToggle.click();
    await expect(home.topBar.themeToggle).toHaveAttribute('aria-pressed', 'true');

    await home.visit('/about');
    await expect(home.html).toHaveCSS('background-color', LIGHT_BG);
    await expect(home.topBar.themeToggle).toHaveAttribute('aria-pressed', 'true');

    await page.reload();
    await expect(home.html).toHaveCSS('background-color', LIGHT_BG);
    await expect(home.themeColor).toHaveAttribute('content', '#f7f8fa');
  });

  test(
    'a saved light theme is set before the body renders',
    { tag: '@regression' },
    async ({ home, page }) => {
      await page.addInitScript(() => {
        localStorage.setItem('playwright-lab:theme', 'light');
        new MutationObserver((_, observer) => {
          if (!document.body) return;
          document.documentElement.setAttribute(
            'data-theme-at-body',
            document.documentElement.dataset.theme ?? '',
          );
          observer.disconnect();
        }).observe(document, { childList: true, subtree: true });
      });
      await home.goto();
      await expect(home.html).toHaveAttribute('data-theme-at-body', 'light');
    },
  );

  test('an unknown saved value falls back to dark', { tag: '@regression' }, async ({ home }) => {
    await home.presetTheme('solarized');
    await home.goto();
    await expect(home.html).toHaveAttribute('data-theme', 'dark');
    await expect(home.topBar.themeToggle).toHaveAttribute('aria-pressed', 'false');
  });

  test('the top bar fits a 375px screen', { tag: '@regression' }, async ({ home, page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await home.goto();
    await expect(home.topBar.themeToggle).toBeInViewport();
    expect(await home.horizontalOverflow()).toBeLessThanOrEqual(0);
  });
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('the site stays dark and hides the toggle', { tag: '@regression' }, async ({ home }) => {
    await home.goto();
    await expect(home.html).toHaveCSS('background-color', DARK_BG);
    await expect(home.topBar.themeToggleControl).toBeHidden();
  });
});
