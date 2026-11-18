import { test, expect } from './pages/fixtures';
import { CHALLENGES } from '../src/data/playground-challenges';

test.describe('locator playground', () => {
  test.beforeEach(async ({ playground }) => {
    await playground.goto();
  });

  test('opens on a strict mode violation with numbered highlights', async ({ playground }) => {
    await expect(playground.result).toHaveText('✗ 3 matches: strict mode violation');
    await expect(playground.strictError).toContainText(
      "strict mode violation: getByRole('button', { name: 'Add to cart' }) resolved to 3 elements",
    );
    await expect(playground.strictError).toContainText(
      "aka getByRole('listitem').filter({ hasText: 'Canvas Tote' }).getByRole('button', { name: 'Add to cart' })",
    );
    await expect(playground.highlightsIn('strict')).toHaveCount(3);
    await expect(playground.matches.getByRole('listitem')).toHaveCount(3);
  });

  test('a unique locator gets one green highlight', async ({ playground }) => {
    await playground.enterLocator("page.getByRole('button', { name: 'Sign in' })");
    await expect(playground.result).toHaveText('✓ 1 match');
    await expect(playground.highlightsIn('match')).toHaveCount(1);
    await expect(playground.strictError).toHaveCount(0);
  });

  test('flags hidden matches, which have nothing to highlight', async ({ playground }) => {
    await playground.enterLocator("page.getByText('Free shipping')");
    await expect(playground.result).toHaveText('✓ 1 match');
    await expect(playground.matches).toContainText('hidden');
    await expect(playground.highlights).toHaveCount(0);
  });

  test('explains invalid input', async ({ playground }) => {
    await playground.enterLocator("page.getByRol('button')");
    await expect(playground.result).toHaveText('✗ invalid locator');
    await expect(playground.alert).toHaveText('Unknown method .getByRol(). Did you mean .getByRole()?');
    await expect(playground.editorError).toHaveText('getByRol');

    await playground.enterLocator("page.getByRole('button').click()");
    await expect(playground.alert).toContainText('.click() is an action');
  });

  test('lists what exists when nothing matches', async ({ playground, page }) => {
    await playground.enterLocator("page.getByRole('heading', { name: 'Checkout' })");
    await expect(playground.result).toHaveText('✗ 0 matches');
    await expect(page.getByText(/The heading elements on this page are named/)).toContainText('Field kit');
  });

  test('suggests a sturdier locator and can apply it', async ({ playground, page }) => {
    await playground.enterLocator("page.locator('#email')");
    await expect(playground.result).toHaveText('✓ 1 match');
    await expect(page.getByText("page.getByRole('textbox', { name: 'Email address' })")).toBeVisible();

    await playground.useSuggestion.click();
    await expect(playground.editorContent).toHaveText("page.getByRole('textbox', { name: 'Email address' })");
    await expect(playground.useSuggestion).toHaveCount(0);
    await expect(playground.result).toHaveText('✓ 1 match');
  });

  test('re-evaluates when the sample page changes state', async ({ playground }) => {
    await playground.enterLocator("page.getByRole('checkbox', { checked: true })");
    await expect(playground.result).toHaveText('✗ 0 matches');
    await playground.sample.getByRole('checkbox', { name: 'Remember me' }).check();
    await expect(playground.result).toHaveText('✓ 1 match');
  });

  test('a challenge needs the right element and the right technique', async ({ playground }) => {
    await playground.challenge('filter by text').click();
    await expect(playground.highlightsIn('target')).toHaveCount(1);

    // The right element through the wrong technique doesn't count.
    await playground.enterLocator("page.getByRole('button', { name: 'Add to cart' }).first()");
    await expect(playground.result).toHaveText('✓ 1 match');
    await expect(playground.challengePassed).toHaveCount(0);

    await playground.enterLocator(
      "page.getByRole('listitem').filter({ hasText: 'Canvas Tote' }).getByRole('button')",
    );
    await expect(playground.challengePassed).toBeVisible();
    await expect(playground.challengeList(/challenges \(1\/9 solved\)/)).toBeVisible();

    await playground.nextChallenge.click();
    await expect(playground.challenge('filter by child')).toHaveAttribute('aria-pressed', 'true');
  });

  test('every challenge can be solved with its own target', async ({ playground }) => {
    for (const challenge of CHALLENGES) {
      await playground.challenge(challenge.title, { exact: true }).click();
      await playground.enterLocator(challenge.target);
      await expect(playground.challengePassed, challenge.id).toBeVisible();
    }
  });

  test('the sample page follows the site theme', async ({ playground }) => {
    const html = playground.sample.locator('html');
    await expect(html).toHaveAttribute('data-theme', 'dark');
    await playground.topBar.themeToggle.click();
    await expect(html).toHaveAttribute('data-theme', 'light');
  });

  for (const theme of ['dark', 'light']) {
    test(`has no a11y violations once interactive, in the ${theme} theme`, async ({ playground }) => {
      if (theme === 'light') await playground.topBar.themeToggle.click();
      await expect(playground.sample.locator('html')).toHaveAttribute('data-theme', theme);

      // The strict mode error, its highlights and the match list.
      await expect(playground.strictError).toBeVisible();
      expect(await playground.a11yViolations()).toEqual([]);

      // An open challenge with a suggestion showing.
      await playground.challenge('filter by text').click();
      await playground.enterLocator("page.locator('#email')");
      await expect(playground.useSuggestion).toBeVisible();
      expect(await playground.a11yViolations()).toEqual([]);

      // An error message.
      await playground.enterLocator('page.nope()');
      await expect(playground.alert).toBeVisible();
      expect(await playground.a11yViolations()).toEqual([]);
    });
  }
});
