// Turns an API name like `page.getByRole()` into its page on the official Playwright docs.
const DOCS_BASE = 'https://playwright.dev/docs/api';

interface ApiClass {
  page: string; // docs page, as in class-<page>
  anchor: string; // anchor prefix, as in #<anchor>-get-by-role
}

const RECEIVERS: Record<string, ApiClass> = {
  browser: { page: 'browser', anchor: 'browser' },
  clock: { page: 'clock', anchor: 'clock' },
  context: { page: 'browsercontext', anchor: 'browser-context' },
  dialog: { page: 'dialog', anchor: 'dialog' },
  download: { page: 'download', anchor: 'download' },
  fileChooser: { page: 'filechooser', anchor: 'file-chooser' },
  frame: { page: 'frame', anchor: 'frame' },
  frameLocator: { page: 'framelocator', anchor: 'frame-locator' },
  keyboard: { page: 'keyboard', anchor: 'keyboard' },
  locator: { page: 'locator', anchor: 'locator' },
  mouse: { page: 'mouse', anchor: 'mouse' },
  page: { page: 'page', anchor: 'page' },
  request: { page: 'apirequestcontext', anchor: 'api-request-context' },
  response: { page: 'response', anchor: 'response' },
  route: { page: 'route', anchor: 'route' },
  test: { page: 'test', anchor: 'test' },
  testInfo: { page: 'testinfo', anchor: 'test-info' },
  'expect(locator)': { page: 'locatorassertions', anchor: 'locator-assertions' },
  'expect(page)': { page: 'pageassertions', anchor: 'page-assertions' },
  'expect(response)': { page: 'apiresponseassertions', anchor: 'api-response-assertions' },
};

// getByRole → get-by-role, waitForURL → wait-for-url
const kebab = (member: string) =>
  member
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .toLowerCase();

/** Throws on an unknown receiver, so a typo in a chapter fails the build instead of shipping a dead link. */
export function apiRefHref(name: string): string {
  const match = name.replace(/\(\)$/, '').match(/^(expect\(\w+\)|\w+)\.(?:not\.)?([\w.]+)$/);
  const apiClass = match && RECEIVERS[match[1]];
  if (!match || !apiClass) {
    throw new Error(
      `<ApiRef name="${name}">: expected "receiver.member" with one of: ${Object.keys(RECEIVERS).join(', ')}`,
    );
  }
  const member = match[2].split('.').map(kebab).join('-');
  return `${DOCS_BASE}/class-${apiClass.page}#${apiClass.anchor}-${member}`;
}
