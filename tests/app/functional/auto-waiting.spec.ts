import type { Locator, Page } from '@playwright/test';
import { test, expect } from '../../../fixtures/pom/test-options';
import {
  ACTIONS,
  CHECKS,
  SCENARIOS,
  buildSteps,
  expectedCallLog,
  type CheckName,
  type Scenario,
} from '../../../src/lib/auto-waiting';

const SHORT_TIMEOUT = 500;

const act = (page: Page, scenario: Scenario, timeout: number): Promise<void> => {
  const target = page.locator(scenario.selector);
  return scenario.action === 'click' ? target.click({ timeout }) : target.fill('Ada', { timeout });
};

test.describe('the explainer matches real Playwright', () => {
  test.skip(({ isMobile }) => isMobile, 'engine behaviour does not depend on the viewport');

  for (const scenario of SCENARIOS) {
    if (scenario.blocker) {
      test(`"${scenario.label}" prints the call log we show`, { tag: '@regression' }, async ({ page }) => {
        await page.setContent(scenario.html);
        const error = await act(page, scenario, SHORT_TIMEOUT).catch((caught: Error) => caught);
        expect(error).toBeInstanceOf(Error);
        for (const line of expectedCallLog(scenario)) expect((error as Error).message).toContain(line);
      });
    }

    if (scenario.releaseAt !== null) {
      const releaseAt = scenario.blocker ? scenario.releaseAt : 0;

      test(
        `"${scenario.label}" acts only after the app is ready`,
        { tag: '@regression' },
        async ({ page }) => {
          await page.setContent(scenario.html);
          await page.evaluate(
            ({ release, delay }) => {
              const state = window as unknown as { actedAt?: number; releasedAt?: number };
              const acted = (): number => (state.actedAt ??= performance.now());
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
        },
      );
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
  const breakCheck = (html: string, check: CheckName): string => {
    const withAttribute = (attribute: string): string =>
      html.replace('id="target"', `id="target" ${attribute}`);
    if (check === 'visible') return withAttribute('style="display: none"');
    if (check === 'enabled') return withAttribute('disabled');
    if (check === 'editable') return withAttribute('readonly');
    if (check === 'receives events') return `${html}<div style="position: fixed; inset: 0"></div>`;
    // One way only: an element sliding back and forth can be in the same place on two slow frames.
    return `<style>@keyframes slide { from { margin-left: 0 } to { margin-left: 2000px } }
#target { animation: slide 20s linear }</style>${html}`;
  };

  // Only text inputs can be read-only.
  const checksFor = (html: string): typeof CHECKS =>
    CHECKS.filter(({ name: check }) => check !== 'editable' || html === input);

  for (const { name, checks } of ACTIONS) {
    test(`${name} waits for exactly the checks in the table`, { tag: '@regression' }, async ({ page }) => {
      const runner = runners[name];
      expect(runner, `add a runner for ${name}`).toBeDefined();

      for (const { name: check } of checksFor(runner.html)) {
        await page.setContent(breakCheck(runner.html, check));
        // eslint-disable-next-line playwright/no-raw-locators -- getByRole can't find the hidden element this test needs
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

  test('every scenario ends in the outcome it promises', { tag: '@regression' }, () => {
    for (const scenario of SCENARIOS) {
      const outcome = buildSteps(scenario).at(-1)?.outcome;
      expect(outcome, scenario.id).toBe(scenario.releaseAt === null ? 'failed' : 'passed');
    }
  });
});

test.describe('the timeline', () => {
  test.beforeEach(async ({ autoWaiting }) => {
    await autoWaiting.goto();
  });

  test('steps through a blocked click until it passes', { tag: '@regression' }, async ({ autoWaiting }) => {
    const { nextButton, callLog } = autoWaiting;

    await expect(autoWaiting.backButton).toBeDisabled();
    await expect(callLog).toContainText("waiting for locator('#save')");

    await nextButton.click();
    await expect(autoWaiting.h2('Check: enabled')).toBeVisible();
    await expect(callLog).toContainText('element is not enabled');
    await expect(autoWaiting.checkRow('visible')).toContainText('passed');
    await expect(autoWaiting.checkRow('enabled')).toContainText('blocked');
    await expect(autoWaiting.checkRow('stable')).toContainText('not yet');

    const steps = buildSteps(SCENARIOS.find(({ id }) => id === 'disabled')!);
    for (let at = 2; at < steps.length; at += 1) await nextButton.click();

    await expect(autoWaiting.h2('Perform the click')).toBeVisible();
    await expect(callLog).toContainText('click action done');
    await expect(autoWaiting.checkRow('receives events')).toContainText('passed');
    await expect(nextButton).toBeDisabled();
  });

  test('a scenario that never clears ends in a timeout', { tag: '@regression' }, async ({ autoWaiting }) => {
    await autoWaiting.chooseScenario('never enabled (timeout)');
    await autoWaiting.goToStep(/^\d+\. Timeout/);

    await expect(autoWaiting.h2('Timeout')).toBeVisible();
    await expect(autoWaiting.failedBadge).toBeVisible();
    await expect(autoWaiting.callLog).toContainText('locator.click: Timeout 5000ms exceeded.');
  });

  test(
    'changing scenario starts again from the first step',
    { tag: '@regression' },
    async ({ autoWaiting }) => {
      await autoWaiting.nextButton.click();
      await autoWaiting.chooseScenario('read-only input');

      await expect(autoWaiting.step('1. Find the element')).toHaveAttribute('aria-current', 'step');
      await expect(autoWaiting.testCode).toContainText(".fill('Ada')");
      await expect(autoWaiting.checkRow('editable')).toContainText('not yet');
    },
  );

  test('play advances on its own and pause stops it', { tag: '@regression' }, async ({ autoWaiting }) => {
    await autoWaiting.playButton.click();
    await expect(autoWaiting.step('2. Check: enabled')).toHaveAttribute('aria-current', 'step');
    await autoWaiting.pauseButton.click();
    await expect(autoWaiting.playButton).toBeVisible();
  });

  test('lists what every action waits for', { tag: '@regression' }, async ({ autoWaiting }) => {
    const table = autoWaiting.actionTable;
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
