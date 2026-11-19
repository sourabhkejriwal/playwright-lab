/** Where the production build is served during a test run. */
export const appConfig = {
  port: 4322,
  baseUrl: 'http://localhost:4322',
  /** The path the site is served under, with no trailing slash. Empty unless BASE_PATH is set. */
  basePath: (process.env.BASE_PATH ?? '').replace(/\/$/, ''),
};

/** Time limits in milliseconds, shared by the Playwright config and the specs. */
export const timeouts = {
  /** One test, including its fixtures. `test.slow()` triples it. */
  test: 30_000,
  /** One web-first assertion. */
  expect: 5_000,
  /** One `expect().toPass()` block. Playwright's default is no limit. */
  toPass: 10_000,
  /** One click, fill or similar. Below `test`, so the failure names the action. */
  action: 10_000,
  /** One page load from the local static server. Below `test`, so the failure names the URL. */
  navigation: 15_000,
  /** Starting one browser. */
  browserLaunch: 60_000,
  /** Building the site and waiting for the server to answer. */
  webServer: 120_000,
  /** The whole run on CI, so a stuck run stops and still writes its report. */
  ciRun: 25 * 60_000,
  /** A spec that starts the real Playwright CLI several times. */
  nestedRun: 120_000,
  /** The playground redraws its highlights after the sample page settles. */
  highlightsSettle: 5_000,
};
