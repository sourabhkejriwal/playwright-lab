import { test as base } from '@playwright/test';
import { ChapterListPage, ChapterPage, HomePage } from './chapter-pages';
import {
  AutoWaitingPage,
  FixtureGraphPage,
  FlakyChallengesPage,
  ParallelSimulatorPage,
} from './explainer-pages';
import { FlashcardsPage } from './flashcards-page';
import { CiBuilderPage, ConfigGeneratorPage } from './generator-pages';
import { PlaygroundPage } from './playground-page';
import { SitePage } from './site-page';

interface PageObjects {
  site: SitePage;
  home: HomePage;
  chapterList: ChapterListPage;
  chapter: ChapterPage;
  playground: PlaygroundPage;
  flashcards: FlashcardsPage;
  configGenerator: ConfigGeneratorPage;
  ciBuilder: CiBuilderPage;
  autoWaiting: AutoWaitingPage;
  fixtureGraph: FixtureGraphPage;
  parallelSimulator: ParallelSimulatorPage;
  flakyChallenges: FlakyChallengesPage;
}

/** Page objects as fixtures. Each is built only for the tests that ask for it, so Node-only tests open no browser. */
export const test = base.extend<PageObjects>({
  site: async ({ page }, use) => use(new SitePage(page)),
  home: async ({ page }, use) => use(new HomePage(page)),
  chapterList: async ({ page }, use) => use(new ChapterListPage(page)),
  chapter: async ({ page }, use) => use(new ChapterPage(page)),
  playground: async ({ page }, use) => use(new PlaygroundPage(page)),
  flashcards: async ({ page }, use) => use(new FlashcardsPage(page)),
  configGenerator: async ({ page }, use) => use(new ConfigGeneratorPage(page)),
  ciBuilder: async ({ page }, use) => use(new CiBuilderPage(page)),
  autoWaiting: async ({ page }, use) => use(new AutoWaitingPage(page)),
  fixtureGraph: async ({ page }, use) => use(new FixtureGraphPage(page)),
  parallelSimulator: async ({ page }, use) => use(new ParallelSimulatorPage(page)),
  flakyChallenges: async ({ page }, use) => use(new FlakyChallengesPage(page)),
});

export { expect } from '@playwright/test';
