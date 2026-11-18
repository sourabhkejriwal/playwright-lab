export const HIGHLIGHT_LOCATOR_CASES = [
  { code: "page.locator('#email')", on: '#email', count: 1 },
  { code: "page.getByText('Trail Mug', { exact: true })", on: '.card:nth-child(2) h3', count: 1 },
  { code: "page.getByLabel('Standard')", on: 'fieldset label:first-of-type input', count: 1 },
  { code: "page.getByRole('button').last()", on: '[data-testid="sign-in-submit"]', count: 1 },
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
] as const;

/** The element each preset challenge asks for. */
export const CHALLENGE_TARGETS = {
  'role-name': '[data-testid="sign-in-submit"]',
  label: '#email',
  placeholder: 'input[type="search"]',
  'test-id': '[data-testid="order-summary"]',
  exact: '.card:nth-child(2) h3',
  'filter-text': '.card:nth-child(1) button',
  'filter-has': '.card:nth-child(4)',
  nth: 'tbody tr:nth-child(2)',
  'xpath-parent': 'tbody tr:nth-child(3)',
} as const;
