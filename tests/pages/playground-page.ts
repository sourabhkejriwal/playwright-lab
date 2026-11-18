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

  /** Where each element sits in the sample page's document, so the iframe's scroll position doesn't matter. */
  documentRects(elements: Locator) {
    return elements.evaluateAll((nodes) =>
      nodes.map((node) => {
        const rect = node.getBoundingClientRect();
        const view = node.ownerDocument.defaultView;
        return {
          left: rect.left + (view?.scrollX ?? 0),
          top: rect.top + (view?.scrollY ?? 0),
          width: rect.width,
          height: rect.height,
        };
      }),
    );
  }

  /** Whether the element is fully inside the part of the sample page the iframe shows. */
  isInSampleView(element: Locator) {
    return element.evaluate((node) => {
      const rect = node.getBoundingClientRect();
      return rect.top >= 0 && rect.bottom <= (node.ownerDocument.defaultView?.innerHeight ?? 0);
    });
  }

  /** The color a highlight is drawn in, and the sample page's value for the design token it should use. */
  highlightColor(highlight: Locator, token: string) {
    return highlight.evaluate((node, name) => {
      const read = (element: Element, property: string) =>
        getComputedStyle(element).getPropertyValue(property).trim();
      return { drawn: read(node, '--pl-color'), token: read(node.ownerDocument.documentElement, name) };
    }, token);
  }

  challenge(title: string, options: { exact?: boolean } = {}) {
    return this.page.getByRole('button', { name: title, ...options });
  }

  challengeList(name: RegExp) {
    return this.page.getByRole('region', { name });
  }

  async enterLocator(code: string) {
    // Not fill(): it types straight after selecting, and CodeMirror can still hold the old selection,
    // which leaves the new text next to the old. Two frames give it time to read the new selection.
    await this.editor.selectText();
    await this.page.evaluate(
      () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))),
    );
    await this.page.keyboard.insertText(code);
  }
}
