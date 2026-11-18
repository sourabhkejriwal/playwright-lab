/** Preset exercises for the locator playground, easiest first. */
export interface Challenge {
  id: string;
  title: string;
  brief: string;
  /** Resolves to exactly the elements a correct answer must find. */
  target: string;
  /** Techniques the answer has to use, as named by featuresOf(). */
  requires: string[];
  hint: string;
}

export const CHALLENGES: Challenge[] = [
  {
    id: 'role-name',
    title: 'role and name',
    brief: 'Find the sign-in button by its role and accessible name.',
    target: "page.getByRole('button', { name: 'Sign in' })",
    requires: ['getByRole', 'name'],
    hint: "getByRole takes the role first, then { name: '…' }.",
  },
  {
    id: 'label',
    title: 'form label',
    brief: 'Find the email field through the label a user reads.',
    target: "page.getByLabel('Email address')",
    requires: ['getByLabel'],
    hint: 'getByLabel returns the control, not the label element.',
  },
  {
    id: 'placeholder',
    title: 'placeholder',
    brief: 'Find the search box in the header by its placeholder.',
    target: "page.getByPlaceholder('Search the shop')",
    requires: ['getByPlaceholder'],
    hint: 'Partial, case-insensitive text is enough.',
  },
  {
    id: 'test-id',
    title: 'test id',
    brief: 'Find the order summary line through its data-testid.',
    target: "page.getByTestId('order-summary')",
    requires: ['getByTestId'],
    hint: 'Test ids are matched exactly, including case.',
  },
  {
    id: 'exact',
    title: 'exact match',
    brief: 'Find the Trail Mug heading, without also matching Trail Mug Lid.',
    target: "page.getByRole('heading', { name: 'Trail Mug', exact: true })",
    requires: ['getByRole', 'exact'],
    hint: 'Names match on substrings until you add exact: true.',
  },
  {
    id: 'filter-text',
    title: 'filter by text',
    brief: 'Find the add-to-cart button on the Canvas Tote card only.',
    target: "page.getByRole('listitem').filter({ hasText: 'Canvas Tote' }).getByRole('button')",
    requires: ['filter', 'hasText'],
    hint: 'Narrow the list items with filter, then chain to the button.',
  },
  {
    id: 'filter-has',
    title: 'filter by child',
    brief: 'Find the product card that contains a sold-out button.',
    target: "page.getByRole('listitem').filter({ has: page.getByRole('button', { name: 'Sold out' }) })",
    requires: ['filter', 'has'],
    hint: 'The locator inside has is relative to each card.',
  },
  {
    id: 'nth',
    title: 'by position',
    brief: 'Find the second order in the table. The header counts as a row.',
    target: "page.getByRole('row').nth(2)",
    requires: ['nth'],
    hint: 'nth counts from zero.',
  },
  {
    id: 'xpath-parent',
    title: 'up to the parent',
    brief: 'Start at the cell with #1043 and climb to its table row with XPath.',
    target: "page.getByRole('cell', { name: '#1043' }).locator('xpath=..')",
    requires: ['getByRole', 'xpath'],
    hint: 'xpath=.. selects the parent of the current element.',
  },
];
