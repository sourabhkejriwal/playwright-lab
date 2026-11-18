import { expect, type FrameLocator, type Locator, type Page } from '@playwright/test';
import { SitePage } from './site-page';

export class PlaygroundPage extends SitePage {
  readonly editor: Locator;
  readonly editorContent: Locator;
  readonly editorError: Locator;
  readonly result: Locator;
  readonly sample: FrameLocator;
  readonly highlights: Locator;
  readonly strictError: Locator;
  readonly matches: Locator;
  readonly alert: Locator;
  readonly useSuggestion: Locator;
  readonly challengePassed: Locator;
  readonly nextChallenge: Locator;

  constructor(page: Page) {
    super(page);
    this.editor = page.getByRole('textbox', { name: 'locator', exact: true });
    this.editorContent = page.locator('.cm-content');
    this.editorError = page.locator('.cm-locator-error');
    this.result = page.getByRole('status').first();
    this.sample = page.frameLocator('iframe[title="Sample page for trying locators"]');
    this.highlights = this.sample.locator('.pl-box');
    this.strictError = page.getByRole('region', { name: 'strict mode error' });
    this.matches = page.getByRole('list', { name: 'Matched elements' });
    this.alert = page.getByRole('alert');
    this.useSuggestion = page.getByRole('button', { name: 'use this locator' });
    this.challengePassed = page.getByText('✓ challenge passed');
    this.nextChallenge = page.getByRole('button', { name: 'next challenge' });
  }

  async goto() {
    await this.visit('/playground');
    // The contenteditable replaces the fallback textarea once CodeMirror has loaded.
    await expect(this.editorContent).toBeVisible();
    await expect(this.result).not.toHaveText(/loading/);
  }

  highlightsIn(state: 'match' | 'strict' | 'target') {
    return this.sample.locator(`.pl-box[data-state="${state}"]`);
  }

  challenge(title: string, options: { exact?: boolean } = {}) {
    return this.page.getByRole('button', { name: title, ...options });
  }

  challengeList(name: RegExp) {
    return this.page.getByRole('region', { name });
  }

  async enterLocator(code: string) {
    await this.editor.fill(code);
  }
}
