import { test, expect } from './pages/fixtures';
import { apiRefHref } from '../src/lib/api-ref';

test.describe('chapter MDX components', () => {
  test.beforeEach(async ({ chapter }) => {
    await chapter.goto('02-selectors');
  });

  test('callouts expose their type and title', async ({ chapter }) => {
    await expect(chapter.note('tip: find the accessible name')).toBeVisible();
    await expect(chapter.note('warn', { exact: true })).toContainText('Locators are strict');
    await expect(chapter.note('gotcha: await the assertion')).toContainText('Without await');
  });

  test('keys render as keyboard elements', async ({ chapter }) => {
    await expect(chapter.note(/^tip/).locator('kbd')).toHaveText(['Ctrl', 'Shift', 'I']);
  });

  test('api references link to the Playwright docs', async ({ page }) => {
    await expect(page.getByRole('link', { name: 'page.getByRole() (Playwright docs)' })).toHaveAttribute(
      'href',
      'https://playwright.dev/docs/api/class-page#page-get-by-role',
    );
  });
});

test.describe('apiRefHref', () => {
  const docs = 'https://playwright.dev/docs/api';

  for (const [name, href] of [
    ['locator.click', 'class-locator#locator-click'],
    ['page.waitForURL()', 'class-page#page-wait-for-url'],
    ['context.newPage()', 'class-browsercontext#browser-context-new-page'],
    ['frameLocator.getByRole()', 'class-framelocator#frame-locator-get-by-role'],
    ['request.get()', 'class-apirequestcontext#api-request-context-get'],
    ['test.describe.configure()', 'class-test#test-describe-configure'],
    ['expect(locator).toBeVisible()', 'class-locatorassertions#locator-assertions-to-be-visible'],
    ['expect(locator).not.toBeVisible()', 'class-locatorassertions#locator-assertions-to-be-visible'],
    ['expect(page).toHaveURL()', 'class-pageassertions#page-assertions-to-have-url'],
    ['expect(response).toBeOK()', 'class-apiresponseassertions#api-response-assertions-to-be-ok'],
  ]) {
    test(`maps ${name}`, () => {
      expect(apiRefHref(name)).toBe(`${docs}/${href}`);
    });
  }

  test('rejects an unknown receiver', () => {
    expect(() => apiRefHref('pgae.click()')).toThrow('<ApiRef name="pgae.click()">');
  });
});
