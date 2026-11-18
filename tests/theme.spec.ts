import { test, expect, type Page } from '@playwright/test';

const DARK_BG = 'rgb(11, 14, 20)';
const LIGHT_BG = 'rgb(247, 248, 250)';

const toggle = (page: Page) => page.getByRole('button', { name: 'light theme' });
const themeColor = (page: Page) => page.locator('head meta[name="theme-color"]');

test.describe('theme toggle', () => {
  test('dark is the default, even when the system prefers light', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(page.locator('html')).toHaveCSS('background-color', DARK_BG);
    await expect(toggle(page)).toHaveAttribute('aria-pressed', 'false');
  });

  test('switches to light and back', async ({ page }) => {
    await page.goto('/');

    await toggle(page).click();
    await expect(toggle(page)).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('html')).toHaveCSS('background-color', LIGHT_BG);
    await expect(page.locator('html')).toHaveCSS('color-scheme', 'light');
    await expect(themeColor(page)).toHaveAttribute('content', '#f7f8fa');

    await toggle(page).click();
    await expect(toggle(page)).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('html')).toHaveCSS('background-color', DARK_BG);
    await expect(themeColor(page)).toHaveAttribute('content', '#0b0e14');
  });

  test('works from the keyboard', async ({ page }) => {
    await page.goto('/');
    await toggle(page).focus();
    await page.keyboard.press('Enter');
    await expect(toggle(page)).toHaveAttribute('aria-pressed', 'true');
  });

  test('the choice survives navigation and reload', async ({ page }) => {
    await page.goto('/');
    await toggle(page).click();
    await expect(toggle(page)).toHaveAttribute('aria-pressed', 'true');

    await page.goto('/about');
    await expect(page.locator('html')).toHaveCSS('background-color', LIGHT_BG);
    await expect(toggle(page)).toHaveAttribute('aria-pressed', 'true');

    await page.reload();
    await expect(page.locator('html')).toHaveCSS('background-color', LIGHT_BG);
    await expect(themeColor(page)).toHaveAttribute('content', '#f7f8fa');
  });

  test('a saved light theme is set before the body renders', async ({ page }) => {
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
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-theme-at-body', 'light');
  });

  test('an unknown saved value falls back to dark', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('playwright-lab:theme', 'solarized'));
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(toggle(page)).toHaveAttribute('aria-pressed', 'false');
  });

  test('the top bar fits a 375px screen', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await expect(toggle(page)).toBeInViewport();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('the site stays dark and hides the toggle', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveCSS('background-color', DARK_BG);
    await expect(page.locator('[data-theme-toggle]')).toBeHidden();
  });
});
