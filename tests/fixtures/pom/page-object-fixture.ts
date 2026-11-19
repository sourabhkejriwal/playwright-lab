import { test as base } from '@playwright/test';
import { AutoWaitingPage } from '../../pages/app/auto-waiting.page';
import { ChapterListPage } from '../../pages/app/chapter-list.page';
import { ChapterPage } from '../../pages/app/chapter.page';
import { CiBuilderPage } from '../../pages/app/ci-builder.page';
import { ConfigGeneratorPage } from '../../pages/app/config-generator.page';
import { FixtureGraphPage } from '../../pages/app/fixture-graph.page';
import { FlakyChallengesPage } from '../../pages/app/flaky-challenges.page';
import { FlashcardsPage } from '../../pages/app/flashcards.page';
import { HomePage } from '../../pages/app/home.page';
import { ParallelSimulatorPage } from '../../pages/app/parallel-simulator.page';
import { PlaygroundPage } from '../../pages/app/playground.page';
import { SitePage } from '../../pages/app/site.page';

/** Page objects as fixtures. Each is built only for the tests that ask for it, so Node-only tests open no browser. */
export type FrameworkFixtures = {
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
  /** Opens a second tab in the same browser context, for tests about changes made in another tab. */
  openSiteTab: () => Promise<SitePage>;
};

export const test = base.extend<FrameworkFixtures>({
  site: async ({ page }, use) => {
    await use(new SitePage(page));
  },
  home: async ({ page }, use) => {
    await use(new HomePage(page));
  },
  chapterList: async ({ page }, use) => {
    await use(new ChapterListPage(page));
  },
  chapter: async ({ page }, use) => {
    await use(new ChapterPage(page));
  },
  playground: async ({ page }, use) => {
    await use(new PlaygroundPage(page));
  },
  flashcards: async ({ page }, use) => {
    await use(new FlashcardsPage(page));
  },
  configGenerator: async ({ page }, use) => {
    await use(new ConfigGeneratorPage(page));
  },
  ciBuilder: async ({ page }, use) => {
    await use(new CiBuilderPage(page));
  },
  autoWaiting: async ({ page }, use) => {
    await use(new AutoWaitingPage(page));
  },
  fixtureGraph: async ({ page }, use) => {
    await use(new FixtureGraphPage(page));
  },
  parallelSimulator: async ({ page }, use) => {
    await use(new ParallelSimulatorPage(page));
  },
  flakyChallenges: async ({ page }, use) => {
    await use(new FlakyChallengesPage(page));
  },
  openSiteTab: async ({ context }, use) => {
    await use(async () => new SitePage(await context.newPage()));
  },
});
