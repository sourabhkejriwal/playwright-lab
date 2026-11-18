/**
 * The "spot the flaky test" challenges. `tests/flaky-challenges.spec.ts` runs every `flaky` and `fixed` listing on real
 * Playwright against the small app in `tests/support/flaky-world.ts`: the flaky code must pass when timing is kind and
 * fail with the `log` shown here when it isn't, and the fixed code must pass both ways.
 */
export interface FlakyChallenge {
  id: string;
  /** Names the feature under test, never the bug, because titles are visible before the visitor answers. */
  title: string;
  story: string;
  /** Lines of the real failure output. */
  log: string[];
  flaky: string;
  /** 1-based lines of `flaky` that count as the culprit. */
  culprit: number[];
  causes: string[];
  /** 0-based index into `causes`. */
  answer: number;
  explanation: string;
  fixed: string;
}

export const CHALLENGES: FlakyChallenge[] = [
  {
    id: 'profile-save',
    title: 'Saving a profile',
    story: 'Passes on every laptop. On the busy CI runner it fails about one run in five.',
    log: ['Expected: "Saved"', 'Received: "Saving…"'],
    flaky: `test('saves the profile', async ({ page }) => {
  await page.goto('/profile');
  await page.getByRole('button', { name: 'Save' }).click();
  const status = await page.getByRole('status').textContent();
  expect(status).toBe('Saved');
});`,
    culprit: [4, 5],
    causes: [
      'The click returns before the button is actionable.',
      'The text is read once, so the assertion never retries while the save finishes.',
      '`getByRole` can match more than one status element.',
      '`page.goto` resolves before the page has loaded.',
    ],
    answer: 1,
    explanation:
      '`textContent()` returns whatever is on the page at that instant, and `toBe` compares that one value. A web-first assertion such as `toHaveText` keeps reading the element until it matches or times out.',
    fixed: `test('saves the profile', async ({ page }) => {
  await page.goto('/profile');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('status')).toHaveText('Saved');
});`,
  },
  {
    id: 'report-rows',
    title: 'Loading a report',
    story:
      'Someone added a pause to stabilise this test. It helped for a while, until the reports API slowed down.',
    log: ['Expected: 3', 'Received: 0'],
    flaky: `test('lists the report rows', async ({ page }) => {
  await page.goto('/reports');
  await page.waitForTimeout(500);
  expect(await page.getByRole('row').count()).toBe(3);
});`,
    culprit: [3, 4],
    causes: [
      'The pause guesses how long loading takes, and `count()` checks only once after it.',
      '`getByRole("row")` does not match rows in a table.',
      '`page.goto` cancels the request for the rows.',
    ],
    answer: 0,
    explanation:
      'A fixed pause is too short on a slow run and wasted time on a fast one. `toHaveCount` waits for exactly as long as the rows need, up to the assertion timeout.',
    fixed: `test('lists the report rows', async ({ page }) => {
  await page.goto('/reports');
  await expect(page.getByRole('row')).toHaveCount(3);
});`,
  },
  {
    id: 'orders-response',
    title: 'Waiting for the orders API',
    story: 'After the API got faster, this test began timing out. Nothing in the test had changed.',
    log: [
      'TimeoutError: page.waitForResponse: Timeout 2000ms exceeded while waiting for event "response"',
      'waiting for response "**/api/orders"',
    ],
    flaky: `test('loads the orders', async ({ page }) => {
  await page.goto('/orders');
  const response = await page.waitForResponse('**/api/orders');
  expect(response.ok()).toBe(true);
});`,
    culprit: [2, 3],
    causes: [
      'The glob `**/api/orders` cannot match a full URL.',
      '`response.ok()` has to be awaited.',
      'The API can respond while `goto` is still loading, before anything is listening for the response.',
    ],
    answer: 2,
    explanation:
      '`waitForResponse` only sees responses that arrive after it is called. Start waiting before the action that triggers the request, then await the promise once the action is done.',
    fixed: `test('loads the orders', async ({ page }) => {
  const responsePromise = page.waitForResponse('**/api/orders');
  await page.goto('/orders');
  const response = await responsePromise;
  expect(response.ok()).toBe(true);
});`,
  },
  {
    id: 'cart-checkout',
    title: 'Going to checkout',
    story: 'The test already handles the cookie banner, yet the checkout click sometimes times out.',
    log: ['intercepts pointer events'],
    flaky: `test('opens checkout', async ({ page }) => {
  await page.goto('/cart');
  const cookies = page.getByRole('dialog', { name: 'Cookies' });
  if (await cookies.isVisible()) {
    await cookies.getByRole('button', { name: 'Accept' }).click();
  }
  await page.getByRole('link', { name: 'Checkout' }).click();
  await expect(page.getByRole('heading', { name: 'Checkout' })).toBeVisible();
});`,
    culprit: [4],
    causes: [
      'The checkout link is matched by more than one element.',
      '`isVisible()` answers immediately, so a banner that appears a moment later is never dismissed.',
      'The Accept button needs `force: true` to be clicked.',
    ],
    answer: 1,
    explanation:
      '`isVisible()` does not wait, so the branch depends on whether the banner has arrived yet. `addLocatorHandler` dismisses the banner whenever it blocks a later action, whenever it shows up.',
    fixed: `test('opens checkout', async ({ page }) => {
  const cookies = page.getByRole('dialog', { name: 'Cookies' });
  await page.addLocatorHandler(cookies, async () => {
    await cookies.getByRole('button', { name: 'Accept' }).click();
  });
  await page.goto('/cart');
  await page.getByRole('link', { name: 'Checkout' }).click();
  await expect(page.getByRole('heading', { name: 'Checkout' })).toBeVisible();
});`,
  },
  {
    id: 'order-details',
    title: 'Opening an order',
    story:
      'The whole file passes. Then the second test is retried, or run on its own, and it fails every time.',
    log: ['Expected: "Order A-1"', 'Received: "Order not found"'],
    flaky: `let orderId: string;

test('places an order', async ({ page }) => {
  await page.goto('/orders/new');
  await page.getByRole('button', { name: 'Place order' }).click();
  await expect(page).toHaveURL(/orders\\/A-\\d+$/);
  orderId = page.url().split('/').pop()!;
});

test('shows the order', async ({ page }) => {
  await page.goto(\`/orders/\${orderId}\`);
  await expect(page.getByRole('heading')).toHaveText('Order A-1');
});`,
    culprit: [1, 7, 11],
    causes: [
      'The second test depends on a variable set by the first, and a new worker starts with it empty.',
      '`toHaveURL` does not accept a regular expression.',
      'Two tests in one file cannot both use `page`.',
    ],
    answer: 0,
    explanation:
      'A retry or a `-g` filter runs the test in a fresh worker, where module variables are back to their initial values. Each test should create the data it needs, through a helper or a fixture.',
    fixed: `async function placeOrder(page: Page) {
  await page.goto('/orders/new');
  await page.getByRole('button', { name: 'Place order' }).click();
  await expect(page).toHaveURL(/orders\\/A-\\d+$/);
  return page.url().split('/').pop()!;
}

test('places an order', async ({ page }) => {
  expect(await placeOrder(page)).toMatch(/^A-\\d+$/);
});

test('shows the order', async ({ page }) => {
  const orderId = await placeOrder(page);
  await page.goto(\`/orders/\${orderId}\`);
  await expect(page.getByRole('heading')).toHaveText(\`Order \${orderId}\`);
});`,
  },
  {
    id: 'latest-invoice',
    title: 'Opening the latest invoice',
    story:
      'Newest invoices are sorted to the top after the page loads. Sometimes this test opens the wrong one.',
    log: ['Expected: "Invoice 1042"', 'Received: "Invoice 1041"'],
    flaky: `test('opens the latest invoice', async ({ page }) => {
  await page.goto('/invoices');
  await page.getByRole('link').first().click();
  await expect(page.getByRole('heading')).toHaveText('Invoice 1042');
});`,
    culprit: [3],
    causes: [
      '`toHaveText` compares the heading before the new page opens.',
      '`click()` needs a `waitForNavigation` call around it.',
      '`first()` picks by position, and the list can still be reordering when the click lands.',
    ],
    answer: 2,
    explanation:
      'Position is only meaningful once the list has settled, and auto-waiting cannot know that it will change. Locating the link by what it says clicks the right invoice in any order.',
    fixed: `test('opens the latest invoice', async ({ page }) => {
  await page.goto('/invoices');
  await page.getByRole('link', { name: 'Invoice 1042' }).click();
  await expect(page.getByRole('heading')).toHaveText('Invoice 1042');
});`,
  },
  {
    id: 'greeting',
    title: 'Greeting the user',
    story: 'Green all morning. The nightly build is fine too, but anything run after lunch goes red.',
    log: ['Expected: "Good morning"', 'Received: "Good afternoon"'],
    flaky: `test('greets the user', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page.getByRole('heading')).toHaveText('Good morning');
});`,
    culprit: [2, 3],
    causes: [
      'The heading is checked before the dashboard has rendered.',
      'The expected text depends on the time of day the test happens to run.',
      '`getByRole("heading")` needs a `level` option.',
    ],
    answer: 1,
    explanation:
      'The page reads the real clock, so the right answer changes during the day. `page.clock.setFixedTime` pins the time before the page loads, which makes the result the same on every run.',
    fixed: `test('greets the user', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-03-02T09:00:00'));
  await page.goto('/dashboard');
  await expect(page.getByRole('heading')).toHaveText('Good morning');
});`,
  },
];

export interface Verdict {
  line: boolean;
  cause: boolean;
  solved: boolean;
}

export function grade(challenge: FlakyChallenge, line: number | null, cause: number | null): Verdict {
  const lineRight = line !== null && challenge.culprit.includes(line);
  const causeRight = cause === challenge.answer;
  return { line: lineRight, cause: causeRight, solved: lineRight && causeRight };
}

/** The fixed listing, line by line, marking the lines that aren't in the flaky version. */
export function fixedLines({ flaky, fixed }: Pick<FlakyChallenge, 'flaky' | 'fixed'>) {
  const before = new Set(flaky.split('\n').map((line) => line.trim()));
  return fixed.split('\n').map((text) => ({ text, changed: text.trim() !== '' && !before.has(text.trim()) }));
}
