import { readFileSync } from 'node:fs';
import { test, expect, type Locator, type Page } from '@playwright/test';
import { buildSync } from 'esbuild';
import { CHALLENGES } from '../src/data/playground-challenges';
import { buildSamplePage } from '../src/data/playground-sample';
import { parseLocator, type LocatorExpr, type Value } from '../src/lib/locator/parser';

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

const expressions = [
  // getByRole
  "page.getByRole('button')",
  "page.getByRole('button', { name: 'Add to cart' })",
  "page.getByRole('button', { name: 'sign IN' })",
  "page.getByRole('button', { name: 'Sign', exact: true })",
  "page.getByRole('button', { name: /^(view|search)$/i })",
  "page.getByRole('button', { disabled: true })",
  "page.getByRole('button', { disabled: false })",
  "page.getByRole('link')",
  "page.getByRole('link', { name: 'Forgot password?' })",
  "page.getByRole('heading')",
  "page.getByRole('heading', { level: 3 })",
  "page.getByRole('heading', { name: 'Trail Mug' })",
  "page.getByRole('heading', { name: 'Trail Mug', exact: true })",
  "page.getByRole('heading', { name: 'Sign in', level: 2 })",
  "page.getByRole('textbox')",
  "page.getByRole('textbox', { name: 'Email address' })",
  "page.getByRole('searchbox')",
  "page.getByRole('searchbox', { name: 'Search products' })",
  "page.getByRole('combobox', { name: 'Country' })",
  "page.getByRole('option')",
  "page.getByRole('option', { selected: true })",
  "page.getByRole('radio')",
  "page.getByRole('radio', { checked: true })",
  "page.getByRole('radio', { name: 'Express' })",
  "page.getByRole('checkbox', { name: 'Remember me' })",
  "page.getByRole('checkbox', { checked: false })",
  "page.getByRole('group', { name: 'Delivery' })",
  "page.getByRole('list')",
  "page.getByRole('list', { name: 'Products' })",
  "page.getByRole('listitem')",
  "page.getByRole('navigation', { name: 'Main' })",
  "page.getByRole('search')",
  "page.getByRole('banner')",
  "page.getByRole('main')",
  "page.getByRole('contentinfo')",
  "page.getByRole('region', { name: 'Recent orders' })",
  "page.getByRole('form', { name: 'Sign in' })",
  "page.getByRole('table', { name: 'Your last three orders' })",
  "page.getByRole('row')",
  "page.getByRole('row', { name: '#1042' })",
  "page.getByRole('cell')",
  "page.getByRole('cell', { name: '#1043' })",
  "page.getByRole('columnheader')",
  "page.getByRole('columnheader', { name: 'Status' })",
  "page.getByRole('rowgroup')",
  "page.getByRole('img')",
  "page.getByRole('img', { name: 'Enamel camping mug' })",
  "page.getByRole('paragraph')",
  "page.getByRole('paragraph', { includeHidden: true })",
  "page.getByRole('group')",
  // text
  "page.getByText('Sign in')",
  "page.getByText('sign in')",
  "page.getByText('Sign in', { exact: true })",
  "page.getByText('Trail Mug')",
  "page.getByText('Trail Mug', { exact: true })",
  'page.getByText(/^\\$\\d+$/)',
  "page.getByText('Free shipping')",
  "page.getByText('Orders leave')",
  "page.getByText('Shipping questions')",
  "page.getByText('Standard')",
  // label, placeholder, alt, test id
  "page.getByLabel('Email address')",
  "page.getByLabel('email')",
  "page.getByLabel('Email', { exact: true })",
  "page.getByLabel('Password')",
  "page.getByLabel('Search products')",
  "page.getByLabel('Standard')",
  "page.getByLabel('Remember me')",
  "page.getByLabel('Sign in')",
  'page.getByLabel(/country/i)',
  "page.getByPlaceholder('Search the shop')",
  "page.getByPlaceholder('search')",
  "page.getByPlaceholder('you@example.com', { exact: true })",
  "page.getByPlaceholder('YOU@example.com', { exact: true })",
  'page.getByPlaceholder(/example/)',
  "page.getByAltText('mug')",
  "page.getByAltText('Enamel camping mug', { exact: true })",
  "page.getByTitle('nothing has this title')",
  "page.getByTestId('product-card')",
  "page.getByTestId('order-summary')",
  "page.getByTestId('ORDER-SUMMARY')",
  'page.getByTestId(/^sign-in/)',
  // css, xpath, selector engines
  "page.locator('button')",
  "page.locator('.card h3')",
  "page.locator('#email')",
  "page.locator('css=input[type=radio]')",
  "page.locator('ul > li')",
  "page.locator('//button')",
  "page.locator('xpath=//h3')",
  'page.locator(\'//li[@data-testid="product-card"]//button\')',
  "page.locator('text=Sign in')",
  'page.locator(\'text="Sign in"\')',
  "page.locator('text=/^view$/i')",
  "page.locator('id=email')",
  "page.locator('data-testid=order-summary')",
  "page.locator('.card >> button')",
  "page.locator('.card >> nth=1')",
  "page.locator('.card >> nth=-1 >> h3')",
  // chaining
  "page.getByRole('listitem').getByRole('button')",
  "page.getByTestId('product-card').getByRole('heading')",
  "page.locator('.card').locator('button')",
  "page.locator('.card').locator('//h3')",
  "page.locator('.card').locator('xpath=..')",
  "page.locator('main').getByText('Sign in')",
  "page.locator('h3').getByText('Trail')",
  "page.locator('.card').getByText('Trail Mug')",
  "page.getByRole('cell', { name: '#1043' }).locator('xpath=..')",
  "page.getByRole('row').locator(page.getByRole('button'))",
  // filter
  "page.getByRole('listitem').filter({ hasText: 'Canvas Tote' })",
  "page.getByRole('listitem').filter({ hasText: /trail/i })",
  "page.getByRole('listitem').filter({ hasNotText: 'Trail' })",
  "page.getByTestId('product-card').filter({ hasNotText: /Mug/ })",
  "page.getByRole('listitem').filter({ has: page.getByRole('button', { name: 'Sold out' }) })",
  "page.getByRole('listitem').filter({ hasNot: page.getByRole('button') })",
  "page.getByTestId('product-card').filter({ has: page.locator('h3') })",
  "page.getByRole('row').filter({ hasText: 'Delivered' }).getByRole('button')",
  "page.locator('p').filter({ visible: true })",
  "page.locator('p').filter({ visible: false })",
  "page.locator('.card', { hasText: 'Trail' })",
  "page.locator('.card', { has: page.locator('button:disabled') })",
  "page.locator('.card', { hasNot: page.getByText('Add to cart') })",
  // position and combinations
  "page.getByRole('button').first()",
  "page.getByRole('button').last()",
  "page.getByRole('button').nth(2)",
  "page.getByRole('button').nth(-1)",
  "page.getByRole('button').nth(99)",
  "page.getByTestId('product-card').nth(1).getByRole('button')",
  "page.getByRole('button').and(page.getByTestId('sign-in-submit'))",
  "page.getByRole('button').and(page.getByText('View'))",
  "page.getByRole('button', { name: 'Search' }).or(page.getByRole('link', { name: 'Shop' }))",
  "page.getByRole('link', { name: 'Shop' }).or(page.getByRole('button', { name: 'Search' })).first()",
  "page.locator('.card').getByRole('button').or(page.locator('h1'))",
  "page.locator('.card').filter({ has: page.getByRole('button').and(page.getByText('Sold out')) })",
];

test.describe('locator engine matches real Playwright', () => {
  test.beforeEach(({ isMobile }) => {
    test.skip(isMobile, 'the engine does not depend on the viewport');
  });

  test('on every expression', async ({ page }) => {
    await page.setContent(samplePage);
    await page.addScriptTag({ content: engineBundle });

    const challengeTargets = CHALLENGES.map((challenge) => challenge.target);
    for (const source of [...expressions, ...challengeTargets]) {
      const real = await toPlaywrightLocator(page, parseLocator(source)).evaluateAll((elements) => {
        const all = [...document.querySelectorAll('*')];
        return elements.map((element) => all.indexOf(element));
      });
      const ours = await page.evaluate((code) => (window as any).resolveForTest(code), source);
      expect.soft(ours, source).toEqual(real);
    }
  });
});
