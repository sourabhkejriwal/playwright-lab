import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { CHALLENGES } from '../src/data/playground-challenges';

const editor = (page: Page) => page.getByRole('textbox', { name: 'locator', exact: true });
const status = (page: Page) => page.getByRole('status').first();
const sample = (page: Page) => page.frameLocator('iframe[title="Sample page for trying locators"]');

async function typeLocator(page: Page, code: string) {
  await editor(page).fill(code);
}

test.describe('locator playground', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/playground');
    // The contenteditable replaces the fallback textarea once CodeMirror has loaded.
    await expect(page.locator('.cm-content')).toBeVisible();
    await expect(status(page)).not.toHaveText(/loading/);
  });

  test('opens on a strict mode violation with numbered highlights', async ({ page }) => {
    await expect(status(page)).toHaveText('✗ 3 matches: strict mode violation');
    const error = page.getByRole('region', { name: 'strict mode error' });
    await expect(error).toContainText(
      "strict mode violation: getByRole('button', { name: 'Add to cart' }) resolved to 3 elements",
    );
    await expect(error).toContainText(
      "aka getByRole('listitem').filter({ hasText: 'Canvas Tote' }).getByRole('button', { name: 'Add to cart' })",
    );
    await expect(sample(page).locator('.pl-box[data-state="strict"]')).toHaveCount(3);
    await expect(page.getByRole('list', { name: 'Matched elements' }).getByRole('listitem')).toHaveCount(3);
  });

  test('a unique locator gets one green highlight', async ({ page }) => {
    await typeLocator(page, "page.getByRole('button', { name: 'Sign in' })");
    await expect(status(page)).toHaveText('✓ 1 match');
    await expect(sample(page).locator('.pl-box[data-state="match"]')).toHaveCount(1);
    await expect(page.getByRole('region', { name: 'strict mode error' })).toHaveCount(0);
  });

  test('flags hidden matches, which have nothing to highlight', async ({ page }) => {
    await typeLocator(page, "page.getByText('Free shipping')");
    await expect(status(page)).toHaveText('✓ 1 match');
    await expect(page.getByRole('list', { name: 'Matched elements' })).toContainText('hidden');
    await expect(sample(page).locator('.pl-box')).toHaveCount(0);
  });

  test('explains invalid input', async ({ page }) => {
    await typeLocator(page, "page.getByRol('button')");
    await expect(status(page)).toHaveText('✗ invalid locator');
    await expect(page.getByRole('alert')).toHaveText(
      'Unknown method .getByRol(). Did you mean .getByRole()?',
    );
    await expect(page.locator('.cm-locator-error')).toHaveText('getByRol');

    await typeLocator(page, "page.getByRole('button').click()");
    await expect(page.getByRole('alert')).toContainText('.click() is an action');
  });

  test('lists what exists when nothing matches', async ({ page }) => {
    await typeLocator(page, "page.getByRole('heading', { name: 'Checkout' })");
    await expect(status(page)).toHaveText('✗ 0 matches');
    await expect(page.getByText(/The heading elements on this page are named/)).toContainText('Field kit');
  });

  test('suggests a sturdier locator and can apply it', async ({ page }) => {
    await typeLocator(page, "page.locator('#email')");
    await expect(status(page)).toHaveText('✓ 1 match');
    await expect(page.getByText("page.getByRole('textbox', { name: 'Email address' })")).toBeVisible();

    await page.getByRole('button', { name: 'use this locator' }).click();
    await expect(page.locator('.cm-content')).toHaveText(
      "page.getByRole('textbox', { name: 'Email address' })",
    );
    await expect(page.getByRole('button', { name: 'use this locator' })).toHaveCount(0);
    await expect(status(page)).toHaveText('✓ 1 match');
  });

  test('re-evaluates when the sample page changes state', async ({ page }) => {
    await typeLocator(page, "page.getByRole('checkbox', { checked: true })");
    await expect(status(page)).toHaveText('✗ 0 matches');
    await sample(page).getByRole('checkbox', { name: 'Remember me' }).check();
    await expect(status(page)).toHaveText('✓ 1 match');
  });

  test('a challenge needs the right element and the right technique', async ({ page }) => {
    await page.getByRole('button', { name: 'filter by text' }).click();
    await expect(sample(page).locator('.pl-box[data-state="target"]')).toHaveCount(1);

    // The right element through the wrong technique doesn't count.
    await typeLocator(page, "page.getByRole('button', { name: 'Add to cart' }).first()");
    await expect(status(page)).toHaveText('✓ 1 match');
    await expect(page.getByText('✓ challenge passed')).toHaveCount(0);

    await typeLocator(
      page,
      "page.getByRole('listitem').filter({ hasText: 'Canvas Tote' }).getByRole('button')",
    );
    await expect(page.getByText('✓ challenge passed')).toBeVisible();
    await expect(page.getByRole('region', { name: /challenges \(1\/9 solved\)/ })).toBeVisible();

    await page.getByRole('button', { name: 'next challenge' }).click();
    await expect(page.getByRole('button', { name: 'filter by child' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  test('every challenge can be solved with its own target', async ({ page }) => {
    for (const challenge of CHALLENGES) {
      await page.getByRole('button', { name: challenge.title, exact: true }).click();
      await typeLocator(page, challenge.target);
      await expect(page.getByText('✓ challenge passed'), challenge.id).toBeVisible();
    }
  });

  test('the sample page follows the site theme', async ({ page }) => {
    const html = sample(page).locator('html');
    await expect(html).toHaveAttribute('data-theme', 'dark');
    await page.getByRole('button', { name: 'light theme' }).click();
    await expect(html).toHaveAttribute('data-theme', 'light');
  });

  for (const theme of ['dark', 'light']) {
    test(`has no a11y violations once interactive, in the ${theme} theme`, async ({ page }) => {
      const scan = async () => {
        const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
        expect(results.violations).toEqual([]);
      };
      if (theme === 'light') await page.getByRole('button', { name: 'light theme' }).click();
      await expect(sample(page).locator('html')).toHaveAttribute('data-theme', theme);

      // The strict mode error, its highlights and the match list.
      await expect(page.getByRole('region', { name: 'strict mode error' })).toBeVisible();
      await scan();

      // An open challenge with a suggestion showing.
      await page.getByRole('button', { name: 'filter by text' }).click();
      await typeLocator(page, "page.locator('#email')");
      await expect(page.getByRole('button', { name: 'use this locator' })).toBeVisible();
      await scan();

      // An error message.
      await typeLocator(page, 'page.nope()');
      await expect(page.getByRole('alert')).toBeVisible();
      await scan();
    });
  }
});
