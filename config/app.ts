/** Where the production build is served during a test run. */
export const appConfig = {
  port: 4322,
  baseUrl: 'http://localhost:4322',
};

/** Time limits in milliseconds, shared by the Playwright config and the specs. */
export const timeouts = {
  action: 10_000,
  navigation: 30_000,
  webServer: 120_000,
  /** A spec that starts the real Playwright CLI several times. */
  nestedRun: 120_000,
  /** The playground redraws its highlights after the sample page settles. */
  highlightsSettle: 5_000,
};
