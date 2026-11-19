import { readFileSync } from 'node:fs';
import type { Locator, Page } from '@playwright/test';
import { test, expect } from '../../fixtures/pom/test-options';
import { LOCATOR_EXPRESSIONS } from '../../test-data/static/app/locator-expressions';
import { buildSync } from 'esbuild';
import { CHALLENGES } from '../../../src/data/playground-challenges';
import { buildSamplePage } from '../../../src/data/playground-sample';
import { parseLocator, type LocatorExpr, type Value } from '../../../src/lib/locator/parser';

/**
 * The playground reimplements locator resolution for the browser, so real Playwright is the reference:
 * every expression must find the same elements, in the same order, with both.
 */
const engineBundle = buildSync({
  stdin: {
    contents: `
      import { resolveLocator } from './src/lib/locator/engine';
      import { parseLocator } from './src/lib/locator/parser';
      window.resolveForTest = (source) => {
        const all = [...document.querySelectorAll('*')];
        return resolveLocator(parseLocator(source), document).map((element) => all.indexOf(element));
      };`,
    resolveDir: process.cwd(),
    loader: 'ts',
  },
  bundle: true,
  format: 'iife',
  write: false,
}).outputFiles[0].text;

const samplePage = buildSamplePage(readFileSync('src/styles/tokens.css', 'utf8'));

type Root = Page | Locator;

function toPlaywrightValue(page: Page, value: Value): unknown {
  if (typeof value !== 'object' || value instanceof RegExp) return value;
  if (value.type === 'locator') return toPlaywrightLocator(page, value);
  return Object.fromEntries(
    Object.entries(value.entries).map(([key, entry]) => [key, toPlaywrightValue(page, entry)]),
  );
}

/** Replays the parsed calls on the real Playwright API. */
function toPlaywrightLocator(page: Page, expr: LocatorExpr): Locator {
  let current: Root = page;
  for (const call of expr.calls) {
    const target = current as unknown as Record<string, (...args: unknown[]) => Locator>;
    const args = call.args.map((arg) => toPlaywrightValue(page, arg));
    current = target[call.method](...args);
  }
  return current as Locator;
}

test.describe('locator engine matches real Playwright', () => {
  test.beforeEach(({ isMobile }) => {
    test.skip(isMobile, 'the engine does not depend on the viewport');
  });

  test('on every expression', { tag: '@regression' }, async ({ page }) => {
    await page.setContent(samplePage);
    await page.addScriptTag({ content: engineBundle });

    const challengeTargets = CHALLENGES.map((challenge) => challenge.target);
    for (const source of [...LOCATOR_EXPRESSIONS, ...challengeTargets]) {
      const real = await toPlaywrightLocator(page, parseLocator(source)).evaluateAll((elements) => {
        const all = [...document.querySelectorAll('*')];
        return elements.map((element) => all.indexOf(element));
      });
      const ours = await page.evaluate(
        (code) =>
          (window as unknown as { resolveForTest: (source: string) => number[] }).resolveForTest(code),
        source,
      );
      expect.soft(ours, source).toEqual(real);
    }
  });
});
