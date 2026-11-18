import { expect, type Locator, type Page } from '@playwright/test';
import { SitePage } from './site-page';

/** The config generator and the CI builder: options on one side, a generated file on the other. */
abstract class GeneratorPage extends SitePage {
  abstract readonly output: Locator;
  abstract readonly notes: Locator;
  protected abstract readonly path: string;
  /** A control that stays disabled until the island can respond to it. */
  protected abstract readonly firstControl: Locator;

  readonly copyButton: Locator;
  readonly copiedButton: Locator;
  readonly downloadButton: Locator;

  constructor(page: Page) {
    super(page);
    this.copyButton = page.getByRole('button', { name: 'copy', exact: true });
    this.copiedButton = page.getByRole('button', { name: 'copied', exact: true });
    this.downloadButton = page.getByRole('button', { name: 'download' });
  }

  async goto() {
    await this.visit(this.path);
    await this.waitUntilReady();
  }

  async waitUntilReady() {
    await expect(this.firstControl).toBeEnabled();
  }

  section(name: string) {
    return this.page.getByRole('group', { name });
  }

  checkbox(section: string, name: string) {
    return this.section(section).getByRole('checkbox', { name, exact: true });
  }

  radio(section: string, name: string) {
    return this.section(section).getByRole('radio', { name, exact: true });
  }

  select(name: string) {
    return this.page.getByRole('combobox', { name });
  }

  async download() {
    const downloading = this.page.waitForEvent('download');
    await this.downloadButton.click();
    return downloading;
  }
}

export class ConfigGeneratorPage extends GeneratorPage {
  readonly output: Locator;
  readonly notes: Locator;
  protected readonly path = '/config';
  protected readonly firstControl: Locator;

  constructor(page: Page) {
    super(page);
    this.output = page.getByRole('region', { name: 'playwright.config.ts' });
    this.notes = page.getByRole('list', { name: 'Notes on this config' });
    this.firstControl = this.checkbox('# browsers', 'chromium');
  }
}

export class CiBuilderPage extends GeneratorPage {
  readonly output: Locator;
  readonly notes: Locator;
  protected readonly path = '/ci';
  protected readonly firstControl: Locator;

  constructor(page: Page) {
    super(page);
    this.output = page.getByRole('region', { name: 'playwright.yml' });
    this.notes = page.getByRole('list', { name: 'Notes on this workflow' });
    this.firstControl = this.checkbox('# triggers', 'push');
  }
}
