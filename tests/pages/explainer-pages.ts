import { expect, type Locator, type Page } from '@playwright/test';
import { SitePage } from './site-page';

/** The auto-waiting timeline and the fixture graph: a scenario played back one step at a time. */
abstract class StepperPage extends SitePage {
  protected abstract readonly path: string;

  readonly nextButton: Locator;
  readonly backButton: Locator;
  readonly playButton: Locator;
  readonly pauseButton: Locator;
  readonly scenario: Locator;
  readonly failedBadge: Locator;
  readonly currentStep: Locator;

  constructor(page: Page) {
    super(page);
    this.nextButton = page.getByRole('button', { name: 'next', exact: true });
    this.backButton = page.getByRole('button', { name: 'back', exact: true });
    this.playButton = page.getByRole('button', { name: 'play', exact: true });
    this.pauseButton = page.getByRole('button', { name: 'pause', exact: true });
    this.scenario = page.getByLabel('scenario');
    this.failedBadge = page.getByText('failed', { exact: true });
    this.currentStep = page.locator('[aria-current="step"]');
  }

  async goto() {
    await this.visit(this.path);
    // The island hydrates when it scrolls into view.
    await this.nextButton.scrollIntoViewIfNeeded();
    await expect(this.nextButton).toBeEnabled();
  }

  step(name: string | RegExp) {
    return this.page.getByRole('button', { name });
  }

  async chooseScenario(label: string) {
    await this.scenario.selectOption({ label });
  }

  async goToStep(name: string | RegExp) {
    await this.step(name).click();
  }

  /** Clicks next until the last of `stepCount` steps is showing, starting from the first. */
  async walkToEnd(stepCount: number) {
    for (let at = 1; at < stepCount; at += 1) await this.nextButton.click();
  }
}

export class AutoWaitingPage extends StepperPage {
  protected readonly path = '/auto-waiting';

  readonly callLog: Locator;
  readonly testCode: Locator;
  readonly actionTable: Locator;

  constructor(page: Page) {
    super(page);
    this.callLog = page.getByRole('region', { name: 'Call log', exact: true });
    this.testCode = page.getByRole('region', { name: 'Test code' });
    this.actionTable = page.getByRole('table');
  }

  checkRow(name: string) {
    return this.page
      .getByRole('list', { name: '# actionability checks' })
      .getByRole('listitem')
      .filter({ hasText: name });
  }
}

export class FixtureGraphPage extends StepperPage {
  protected readonly path = '/fixture-graph';

  readonly consoleOutput: Locator;

  constructor(page: Page) {
    super(page);
    this.consoleOutput = page.getByRole('region', { name: 'Console output', exact: true });
  }

  /** A fixture's row in one worker's list of lifetimes. */
  fixture(worker: number, name: string) {
    return this.page
      .getByRole('list', { name: `worker ${worker} lifetimes` })
      .getByRole('listitem')
      .filter({ hasText: name });
  }

  sourceFile(name: string) {
    return this.page.getByRole('region', { name });
  }
}

export class ParallelSimulatorPage extends SitePage {
  readonly workers: Locator;
  readonly shards: Locator;
  readonly suite: Locator;
  readonly fullyParallel: Locator;
  readonly commands: Locator;
  readonly lessons: Locator;
  readonly workerDetails: Locator;

  constructor(page: Page) {
    super(page);
    this.workers = page.getByRole('slider', { name: 'workers per shard' });
    this.shards = page.getByRole('slider', { name: 'shards' });
    this.suite = page.getByLabel('test suite');
    this.fullyParallel = page.getByRole('checkbox', { name: 'fullyParallel' });
    this.commands = page.getByRole('region', { name: 'Commands' });
    this.lessons = page.getByRole('list', { name: 'What these settings show' });
    this.workerDetails = page.getByText('what each worker ran');
  }

  async goto() {
    await this.visit('/parallel');
    // The island hydrates when it scrolls into view.
    await this.workers.scrollIntoViewIfNeeded();
    await expect(this.workers).toBeEnabled();
  }

  /** The value shown beside a label in the results summary. */
  stat(label: string) {
    return this.page.getByRole('term').filter({ hasText: label }).locator('xpath=following-sibling::dd[1]');
  }

  shardHeadings(count: number) {
    return this.page.getByRole('heading', { level: 3, name: new RegExp(`shard \\d of ${count}`) });
  }

  workersOfShard(shard: number) {
    return this.page.getByRole('list', { name: `shard ${shard} workers` }).getByRole('listitem');
  }

  async chooseSuite(label: string) {
    await this.suite.selectOption({ label });
  }
}

export class FlakyChallengesPage extends SitePage {
  readonly checkButton: Locator;
  readonly result: Locator;

  constructor(page: Page) {
    super(page);
    this.checkButton = page.getByRole('button', { name: 'check answer' });
    this.result = page.getByRole('group', { name: 'Result' });
  }

  async goto(firstTitle: string) {
    await this.visit('/flaky');
    await expect(this.h2(firstTitle)).toBeVisible();
  }

  line(line: number) {
    return this.page.getByRole('radio', { name: new RegExp(`^line ${line}\\b`) });
  }

  cause(text: string) {
    return this.page
      .getByRole('group', { name: /Why does it fail/ })
      .getByRole('radio', { name: text.replaceAll('`', ''), exact: true });
  }

  challenge(name: string, options: { exact?: boolean } = {}) {
    return this.page.getByRole('button', { name, ...options });
  }

  resultButton(name: string) {
    return this.result.getByRole('button', { name });
  }

  solvedCount(solved: number, total: number) {
    return this.page.getByText(`${solved} of ${total} solved`);
  }

  async submit(line: number, cause: string) {
    await this.line(line).check();
    await this.cause(cause).check();
    await this.checkButton.click();
  }
}
