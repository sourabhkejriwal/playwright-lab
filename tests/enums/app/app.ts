/** Routes of the site's pages, relative to the base URL. */
export enum AppRoutes {
  HOME = '/',
  CHAPTERS = '/chapters',
  PLAYGROUND = '/playground',
  FLASHCARDS = '/flashcards',
  CONFIG_GENERATOR = '/config',
  CI_BUILDER = '/ci',
  AUTO_WAITING = '/auto-waiting',
  FIXTURE_GRAPH = '/fixture-graph',
  PARALLEL_SIMULATOR = '/parallel',
  FLAKY_CHALLENGES = '/flaky',
}

/** Keys the tests read and write in the browser's web storage. */
export enum StorageKeys {
  THEME = 'playwright-lab:theme',
  PROGRESS_SEEDED = 'seeded',
}

/** Text the site shows, used to find elements that have no role or accessible name. */
export enum Messages {
  ALL_CHAPTERS_READ = 'all written chapters read',
  BROWSE_CHAPTERS = 'browse chapters',
  CHALLENGE_PASSED = '✓ challenge passed',
  EMPTY_SHARD = 'This shard has no tests to run.',
  STEP_FAILED = 'failed',
  WORKER_DETAILS = 'what each worker ran',
}
