import { test, expect } from './pages/fixtures';
import type { PlaygroundPage } from './pages/playground-page';
import { CHALLENGES } from '../src/data/playground-challenges';

/** Boxes are drawn this many pixels outside the element they mark. */
const BOX_OUTSET = 2;
const SIGN_IN_BUTTON = '[data-testid="sign-in-submit"]';

type HighlightState = 'match' | 'strict' | 'target';

interface ExpectedHighlights {
  state: HighlightState;
  /** CSS for the marked elements. Plain CSS keeps the expectation independent of the engine under test. */
  on: string;
  count: number;
  /** The number on each box. Defaults to 0, 1, 2… for matches; target boxes have none. */
  badges?: string[];
}

/** Checks every box on the sample page: its state, position, order and badge, and that no others exist. */
async function expectHighlights(playground: PlaygroundPage, expected: ExpectedHighlights[]) {
  await expect(async () => {
    for (const { state, on, count, badges } of expected) {
      const boxes = playground.highlightsIn(state);
      const elements = await playground.documentRects(playground.sample.locator(on));
      const drawn = await playground.documentRects(boxes);
      expect(elements, `elements for ${on}`).toHaveLength(count);
      expect(drawn, `${state} boxes`).toHaveLength(count);

      elements.forEach((element, index) => {
        const box = drawn[index];
        expect(box.left, `box ${index} left`).toBeCloseTo(element.left - BOX_OUTSET, 1);
        expect(box.top, `box ${index} top`).toBeCloseTo(element.top - BOX_OUTSET, 1);
        expect(box.width, `box ${index} width`).toBeCloseTo(element.width + BOX_OUTSET * 2, 1);
        expect(box.height, `box ${index} height`).toBeCloseTo(element.height + BOX_OUTSET * 2, 1);
      });

      const numbers = state === 'target' ? elements.map(() => '') : elements.map((_, index) => String(index));
      expect(await boxes.allTextContents(), `${state} badges`).toEqual(badges ?? numbers);
    }
    const total = expected.reduce((sum, { count }) => sum + count, 0);
    expect(await playground.highlights.count(), 'boxes on the page').toBe(total);
  }).toPass({ timeout: 5_000 });
}

const locatorCases = [
  { code: "page.locator('#email')", on: '#email', count: 1 },
  { code: "page.getByText('Trail Mug', { exact: true })", on: '.card:nth-child(2) h3', count: 1 },
  { code: "page.getByLabel('Standard')", on: 'fieldset label:first-of-type input', count: 1 },
  { code: "page.getByRole('button').last()", on: SIGN_IN_BUTTON, count: 1 },
  {
    code: "page.getByTestId('product-card').nth(1).getByRole('button')",
    on: '.card:nth-child(2) button',
    count: 1,
  },
  {
    code: "page.getByRole('row').filter({ hasText: 'Delivered' }).getByRole('button')",
    on: 'tbody tr:nth-child(3) button',
    count: 1,
  },
  { code: "page.locator('.card >> nth=-1 >> h3')", on: '.card:nth-child(4) h3', count: 1 },
  {
    code: "page.getByRole('button', { name: 'Add to cart' })",
    on: '.card:not(:nth-child(4)) button',
    count: 3,
  },
  { code: "page.getByRole('heading', { level: 3 })", on: '.card h3', count: 4 },
  { code: "page.getByAltText('mug')", on: '.card:nth-child(2) img, .card:nth-child(3) img', count: 2 },
  {
    code: "page.getByTestId('product-card').filter({ hasNotText: /Mug/ })",
    on: '.card:nth-child(1), .card:nth-child(4)',
    count: 2,
  },
  { code: "page.getByRole('button').and(page.getByText('View'))", on: 'tbody button', count: 3 },
  {
    code: "page.getByRole('button', { name: 'Search' }).or(page.getByRole('link', { name: 'Shop' }))",
    on: '.site li:first-child a, .site form button',
    count: 2,
  },
];

/** The element each preset challenge asks for. */
const challengeTargets: Record<string, string> = {
  'role-name': SIGN_IN_BUTTON,
  label: '#email',
  placeholder: 'input[type="search"]',
  'test-id': '[data-testid="order-summary"]',
  exact: '.card:nth-child(2) h3',
  'filter-text': '.card:nth-child(1) button',
  'filter-has': '.card:nth-child(4)',
  nth: 'tbody tr:nth-child(2)',
  'xpath-parent': 'tbody tr:nth-child(3)',
};

test.describe('playground highlights', () => {
  test.beforeEach(async ({ playground }) => {
    await playground.goto();
  });

  for (const { code, on, count } of locatorCases) {
    test(`${code} highlights ${count} element${count === 1 ? '' : 's'}`, async ({ playground }) => {
      await playground.enterLocator(code);
      await expectHighlights(playground, [{ state: count === 1 ? 'match' : 'strict', on, count }]);
    });
  }

  for (const challenge of CHALLENGES) {
    test(`the "${challenge.title}" challenge marks its target and its answer`, async ({ playground }) => {
      const on = challengeTargets[challenge.id];
      await playground.challenge(challenge.title, { exact: true }).click();
      await expectHighlights(playground, [{ state: 'target', on, count: 1 }]);

      await playground.enterLocator(challenge.target);
      await expectHighlights(playground, [
        { state: 'target', on, count: 1 },
        { state: 'match', on, count: 1 },
      ]);
    });
  }

  test('opens with the default locator highlighted', async ({ playground }) => {
    await expectHighlights(playground, [
      { state: 'strict', on: '.card:not(:nth-child(4)) button', count: 3 },
    ]);
  });

  test('each state draws in its own color', async ({ playground }) => {
    const strict = await playground.highlightColor(playground.highlightsIn('strict').first(), '--term-fail');
    expect(strict.drawn).toBe(strict.token);

    await playground.enterLocator("page.locator('#email')");
    await expect(playground.highlightsIn('match')).toHaveCount(1);
    const match = await playground.highlightColor(playground.highlightsIn('match'), '--term-pass');
    expect(match.drawn).toBe(match.token);

    await playground.challenge('form label').click();
    await expect(playground.highlightsIn('target')).toHaveCount(1);
    const target = await playground.highlightColor(playground.highlightsIn('target'), '--term-purple');
    expect(target.drawn).toBe(target.token);
    await expect(playground.highlightsIn('target')).toHaveCSS('border-top-style', 'dashed');
  });

  test('a new locator replaces the previous highlights', async ({ playground }) => {
    await playground.enterLocator("page.locator('#email')");
    await expectHighlights(playground, [{ state: 'match', on: '#email', count: 1 }]);

    await playground.enterLocator("page.locator('#password')");
    await expectHighlights(playground, [{ state: 'match', on: '#password', count: 1 }]);
  });

  test('nothing stays highlighted without a match', async ({ playground }) => {
    await playground.enterLocator("page.getByRole('heading', { name: 'Checkout' })");
    await expect(playground.result).toHaveText('✗ 0 matches');
    await expect(playground.highlights).toHaveCount(0);

    await playground.enterLocator("page.locator('#email')");
    await expectHighlights(playground, [{ state: 'match', on: '#email', count: 1 }]);

    await playground.enterLocator("page.getByRol('button')");
    await expect(playground.result).toHaveText('✗ invalid locator');
    await expect(playground.highlights).toHaveCount(0);
  });

  test('hidden matches get no box but keep their place in the numbering', async ({ playground }) => {
    await playground.enterLocator("page.locator('main p')");
    await expect(playground.matches.getByRole('listitem')).toHaveCount(7);
    await expectHighlights(playground, [
      {
        state: 'strict',
        on: '.price, [data-testid="order-summary"]',
        count: 5,
        badges: ['1', '2', '3', '4', '5'],
      },
    ]);
  });

  test('opening a closed section highlights the match inside it', async ({ playground }) => {
    await playground.enterLocator("page.getByText('Orders leave')");
    await expect(playground.result).toHaveText('✓ 1 match');
    await expect(playground.highlights).toHaveCount(0);

    await playground.sample.getByText('Shipping questions').click();
    await expectHighlights(playground, [{ state: 'match', on: 'details p', count: 1 }]);
  });

  test('highlights follow the state of the sample page', async ({ playground }) => {
    const on = 'input[type="checkbox"]';
    const rememberMe = playground.sample.getByRole('checkbox', { name: 'Remember me' });
    await playground.enterLocator("page.getByRole('checkbox', { checked: true })");
    await expect(playground.result).toHaveText('✗ 0 matches');
    await expect(playground.highlights).toHaveCount(0);

    await rememberMe.check();
    await expectHighlights(playground, [{ state: 'match', on, count: 1 }]);

    await rememberMe.uncheck();
    await expect(playground.highlights).toHaveCount(0);
  });

  test('highlights stay on their elements when the layout changes', async ({ playground, page }) => {
    const on = '.card:nth-child(4)';
    await playground.enterLocator("page.getByTestId('product-card').last()");
    await expectHighlights(playground, [{ state: 'match', on, count: 1 }]);
    const [before] = await playground.documentRects(playground.sample.locator(on));

    await page.setViewportSize({ width: 320, height: 800 });
    await expect
      .poll(async () => (await playground.documentRects(playground.sample.locator(on)))[0].top)
      .not.toBe(before.top);
    await expectHighlights(playground, [{ state: 'match', on, count: 1 }]);
  });

  test('scrolls the sample page to a match below the fold', async ({ playground }) => {
    const backToTop = playground.sample.getByRole('link', { name: 'Back to top' });
    await expect.poll(() => playground.isInSampleView(backToTop)).toBe(false);

    await playground.enterLocator("page.getByRole('link', { name: 'Back to top' })");
    await expectHighlights(playground, [{ state: 'match', on: 'footer a', count: 1 }]);
    await expect.poll(() => playground.isInSampleView(backToTop)).toBe(true);
  });

  test('a challenge target stays marked until the challenge is closed', async ({ playground }) => {
    const on = challengeTargets['label'];
    const formLabel = playground.challenge('form label', { exact: true });
    await formLabel.click();

    await playground.enterLocator("page.getByRol('button')");
    await expect(playground.result).toHaveText('✗ invalid locator');
    await expectHighlights(playground, [{ state: 'target', on, count: 1 }]);

    await playground.enterLocator("page.locator('#password')");
    await expectHighlights(playground, [
      { state: 'target', on, count: 1 },
      { state: 'match', on: '#password', count: 1 },
    ]);

    await formLabel.click();
    await expectHighlights(playground, [
      { state: 'strict', on: '.card:not(:nth-child(4)) button', count: 3 },
    ]);
  });
});
