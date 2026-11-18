import { test, expect, type Locator, type Page } from '@playwright/test';
import {
  ACTIONS,
  CHECKS,
  SCENARIOS,
  buildSteps,
  expectedCallLog,
  type CheckName,
  type Scenario,
} from '../src/lib/auto-waiting';

const SHORT_TIMEOUT = 500;

const act = (page: Page, scenario: Scenario, timeout: number) => {
  const target = page.locator(scenario.selector);
  return scenario.action === 'click' ? target.click({ timeout }) : target.fill('Ada', { timeout });
};

test.describe('the explainer matches real Playwright', () => {
  test.skip(({ isMobile }) => isMobile, 'engine behaviour does not depend on the viewport');

  for (const scenario of SCENARIOS) {
    if (scenario.blocker) {
      test(`"${scenario.label}" prints the call log we show`, async ({ page }) => {
        await page.setContent(scenario.html);
        const error = await act(page, scenario, SHORT_TIMEOUT).catch((caught: Error) => caught);
        expect(error).toBeInstanceOf(Error);
        for (const line of expectedCallLog(scenario)) expect((error as Error).message).toContain(line);
      });
    }

    if (scenario.releaseAt !== null) {
      test(`"${scenario.label}" acts only after the app is ready`, async ({ page }) => {
        const releaseAt = scenario.blocker ? scenario.releaseAt! : 0;
        await page.setContent(scenario.html);
        await page.evaluate(
          ({ release, delay }) => {
            const state = window as unknown as { actedAt?: number; releasedAt?: number };
            const acted = () => (state.actedAt ??= performance.now());
            document.addEventListener('click', acted);
            document.addEventListener('input', acted);
            setTimeout(() => {
              state.releasedAt = performance.now();
              new Function(release)();
            }, delay);
          },
          { release: scenario.release, delay: releaseAt },
        );

        await act(page, scenario, 5000);
        const { actedAt, releasedAt } = await page.evaluate(() => {
          const { actedAt, releasedAt } = window as unknown as { actedAt: number; releasedAt: number };
          return { actedAt, releasedAt };
        });
        expect(actedAt).toBeGreaterThanOrEqual(releasedAt);
      });
    }
  }

  const button = '<button id="target">Go</button>';
  const input = '<input id="target" value="text">';
  const runners: Record<
    string,
    { html: string; run: (target: Locator, timeout: number) => Promise<unknown> }
  > = {
    'click()': { html: button, run: (target, timeout) => target.click({ timeout }) },
    'dblclick()': { html: button, run: (target, timeout) => target.dblclick({ timeout }) },
    'check()': { html: '<input id="target" type="checkbox">', run: (t, timeout) => t.check({ timeout }) },
    'uncheck()': {
      html: '<input id="target" type="checkbox" checked>',
      run: (target, timeout) => target.uncheck({ timeout }),
    },
    'hover()': { html: button, run: (target, timeout) => target.hover({ timeout }) },
    'screenshot()': { html: button, run: (target, timeout) => target.screenshot({ timeout }) },
    'fill()': { html: input, run: (target, timeout) => target.fill('new', { timeout }) },
    'clear()': { html: input, run: (target, timeout) => target.clear({ timeout }) },
    'selectOption()': {
      html: '<select id="target"><option>a</option><option>b</option></select>',
      run: (target, timeout) => target.selectOption('b', { timeout }),
    },
    'selectText()': { html: input, run: (target, timeout) => target.selectText({ timeout }) },
    'scrollIntoViewIfNeeded()': {
      html: button,
      run: (target, timeout) => target.scrollIntoViewIfNeeded({ timeout }),
    },
    'focus()': { html: button, run: (target, timeout) => target.focus({ timeout }) },
    'press()': { html: button, run: (target, timeout) => target.press('a', { timeout }) },
    'dispatchEvent()': {
      html: button,
      run: (target, timeout) => target.dispatchEvent('click', undefined, { timeout }),
    },
  };

  /** Breaks exactly one check on the element, leaving the others satisfied. */
  const breakCheck = (html: string, check: CheckName) => {
    const withAttribute = (attribute: string) => html.replace('id="target"', `id="target" ${attribute}`);
    if (check === 'visible') return withAttribute('style="display: none"');
    if (check === 'enabled') return withAttribute('disabled');
    if (check === 'editable') return withAttribute('readonly');
    if (check === 'receives events') return `${html}<div style="position: fixed; inset: 0"></div>`;
    return `<style>@keyframes slide { from { margin-left: 0 } to { margin-left: 200px } }
#target { animation: slide 0.2s linear infinite alternate }</style>${html}`;
  };

  for (const { name, checks } of ACTIONS) {
    test(`${name} waits for exactly the checks in the table`, async ({ page }) => {
      const runner = runners[name];
      expect(runner, `add a runner for ${name}`).toBeDefined();

      for (const { name: check } of CHECKS) {
        // Only text inputs can be read-only.
        if (check === 'editable' && runner.html !== input) continue;
        await page.setContent(breakCheck(runner.html, check));
        const waited = await runner.run(page.locator('#target'), SHORT_TIMEOUT).then(
          () => false,
          (error: Error) => {
            expect(error.message).toContain('Timeout');
            return true;
          },
        );
        expect(waited, `${name} with "${check}" broken`).toBe(checks.includes(check));
      }
    });
  }

  test('every scenario ends in the outcome it promises', () => {
    for (const scenario of SCENARIOS) {
      const outcome = buildSteps(scenario).at(-1)?.outcome;
      expect(outcome, scenario.id).toBe(scenario.releaseAt === null ? 'failed' : 'passed');
    }
  });
});

test.describe('the timeline', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/auto-waiting');
    await page.getByRole('button', { name: 'next', exact: true }).scrollIntoViewIfNeeded();
    await expect(page.getByRole('button', { name: 'next', exact: true })).toBeEnabled();
  });

  const checkRow = (page: Page, name: string) =>
    page
      .getByRole('list', { name: '# actionability checks' })
      .getByRole('listitem')
      .filter({ hasText: name });

  test('steps through a blocked click until it passes', async ({ page }) => {
    const next = page.getByRole('button', { name: 'next', exact: true });
    const log = page.getByRole('region', { name: 'Call log', exact: true });

    await expect(page.getByRole('button', { name: 'back', exact: true })).toBeDisabled();
    await expect(log).toContainText("waiting for locator('#save')");

    await next.click();
    await expect(page.getByRole('heading', { level: 2, name: 'Check: enabled' })).toBeVisible();
    await expect(log).toContainText('element is not enabled');
    await expect(checkRow(page, 'visible')).toContainText('passed');
    await expect(checkRow(page, 'enabled')).toContainText('blocked');
    await expect(checkRow(page, 'stable')).toContainText('not yet');

    const steps = buildSteps(SCENARIOS.find(({ id }) => id === 'disabled')!);
    for (let at = 2; at < steps.length; at += 1) await next.click();

    await expect(page.getByRole('heading', { level: 2, name: 'Perform the click' })).toBeVisible();
    await expect(log).toContainText('click action done');
    await expect(checkRow(page, 'receives events')).toContainText('passed');
    await expect(next).toBeDisabled();
  });

  test('a scenario that never clears ends in a timeout', async ({ page }) => {
    await page.getByLabel('scenario').selectOption({ label: 'never enabled (timeout)' });
    await page.getByRole('button', { name: /^\d+\. Timeout/ }).click();

    await expect(page.getByRole('heading', { level: 2, name: 'Timeout' })).toBeVisible();
    await expect(page.getByText('failed', { exact: true })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Call log', exact: true })).toContainText(
      'locator.click: Timeout 5000ms exceeded.',
    );
  });

  test('changing scenario starts again from the first step', async ({ page }) => {
    await page.getByRole('button', { name: 'next', exact: true }).click();
    await page.getByLabel('scenario').selectOption({ label: 'read-only input' });

    await expect(page.getByRole('button', { name: '1. Find the element' })).toHaveAttribute(
      'aria-current',
      'step',
    );
    await expect(page.getByRole('region', { name: 'Test code' })).toContainText(".fill('Ada')");
    await expect(checkRow(page, 'editable')).toContainText('not yet');
  });

  test('play advances on its own and pause stops it', async ({ page }) => {
    await page.getByRole('button', { name: 'play', exact: true }).click();
    await expect(page.getByRole('button', { name: '2. Check: enabled' })).toHaveAttribute(
      'aria-current',
      'step',
    );
    await page.getByRole('button', { name: 'pause', exact: true }).click();
    await expect(page.getByRole('button', { name: 'play', exact: true })).toBeVisible();
  });

  test('lists what every action waits for', async ({ page }) => {
    const table = page.getByRole('table');
    await expect(table.getByRole('row')).toHaveCount(ACTIONS.length + 1);
    const fill = table.getByRole('row', { name: /^fill\(\)/ });
    await expect(fill.getByRole('cell')).toContainText([
      'waits',
      'does not wait',
      'waits',
      'waits',
      'does not wait',
    ]);
  });
});
