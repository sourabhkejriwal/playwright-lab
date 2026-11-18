import type { Locator, Page } from '@playwright/test';
import { SitePage } from './site-page';

export class HomePage extends SitePage {
  readonly chapterRun: Locator;
  readonly nextUp: Locator;
  readonly pendingCount: Locator;
  readonly allRead: Locator;
  readonly firstChapterLink: Locator;

  constructor(page: Page) {
    super(page);
    this.chapterRun = page.getByRole('list', { name: 'Chapter progress' });
    this.nextUp = page.getByText(/next up/);
    this.pendingCount = page.getByText(/\d+ pending/);
    this.allRead = page.getByText('all written chapters read');
    this.firstChapterLink = page.getByRole('link', { name: 'ch01 Quick setup refresher' });
  }

  goto() {
    return this.visit('/');
  }

  runLink(name: string) {
    return this.chapterRun.getByRole('link', { name });
  }

  readCount(count: number) {
    return this.page.getByText(`${count} read`, { exact: true });
  }

  readyCount(count: number) {
    return this.page.getByText(`${count} ready`, { exact: true });
  }
}

export class ChapterListPage extends SitePage {
  goto() {
    return this.visit('/chapters');
  }

  row(name: string | RegExp) {
    return this.main.getByRole('link', { name });
  }
}

/** The quiz at the end of a chapter. It hydrates once it scrolls into view. */
export class QuizPanel {
  readonly region: Locator;
  readonly startButton: Locator;
  readonly checkButton: Locator;
  readonly nextButton: Locator;
  readonly scoreButton: Locator;
  readonly retakeButton: Locator;
  readonly explanation: Locator;
  readonly options: Locator;
  readonly checkedOptions: Locator;

  constructor(page: Page) {
    this.region = page.getByRole('region', { name: 'Chapter quiz' });
    this.startButton = this.button('start quiz');
    this.checkButton = this.button('check answer');
    this.nextButton = this.button('next question');
    this.scoreButton = this.button('see score');
    this.retakeButton = this.button('retake quiz');
    this.explanation = this.region.getByRole('group', { name: 'Explanation' });
    this.options = this.region.getByRole('radio');
    this.checkedOptions = this.region.getByRole('radio', { checked: true });
  }

  private button(name: string) {
    return this.region.getByRole('button', { name, exact: true });
  }

  option(name: string | RegExp) {
    return typeof name === 'string'
      ? this.region.getByRole('radio', { name, exact: true })
      : this.region.getByRole('radio', { name });
  }

  questionGroup(name: string) {
    return this.region.getByRole('group', { name });
  }

  heading(name: string | RegExp) {
    return this.region.getByRole('heading', { name });
  }

  text(text: string) {
    return this.region.getByText(text);
  }

  optionCode(text: string) {
    return this.region.locator('label code', { hasText: text });
  }

  async hydrate() {
    await this.region.scrollIntoViewIfNeeded();
  }

  async answer(name: string) {
    await this.option(name).check();
    await this.checkButton.click();
  }
}

export class ChapterPage extends SitePage {
  readonly quiz: QuizPanel;
  readonly doneButton: Locator;
  readonly toc: Locator;
  readonly prevNext: Locator;
  readonly firstCodeBlock: Locator;

  constructor(page: Page) {
    super(page);
    this.quiz = new QuizPanel(page);
    this.doneButton = page.getByRole('button', { name: 'mark chapter as done' });
    this.toc = page.getByRole('navigation', { name: 'On this page' });
    this.prevNext = page.getByRole('navigation', { name: 'Previous and next chapter' });
    this.firstCodeBlock = page.locator('pre').first();
  }

  goto(slug: string) {
    return this.visit(`/chapters/${slug}`);
  }

  /** A code block, named by the file in its title bar or, without a title, by its language. */
  codeBlock(name: string, options: { exact?: boolean } = {}) {
    return this.page.getByRole('group', { name, ...options });
  }

  highlightedLines(block: Locator) {
    return block.locator('[data-highlighted]');
  }

  copyButton(block: Locator) {
    return block.getByRole('button', { name: 'copy code' });
  }

  copiedButton(block: Locator) {
    return block.getByRole('button', { name: 'copied code' });
  }

  /** A link inside the notes, leaving out the sidebar's links with similar names. */
  notesLink(name: string) {
    return this.main.getByRole('link', { name, exact: true });
  }

  tocLink(name: string) {
    return this.toc.getByRole('link', { name });
  }

  note(name: string | RegExp, options: { exact?: boolean } = {}) {
    return this.page.getByRole('note', { name, ...options });
  }
}
