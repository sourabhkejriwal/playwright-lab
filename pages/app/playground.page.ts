import { expect, type FrameLocator, type Locator } from '@playwright/test';
import { AppRoutes, Messages } from '../../enums/app/app';
import { SitePage } from './site.page';

export interface DocumentRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export class PlaygroundPage extends SitePage {
  // ==================== Locators ====================

  get editor(): Locator {
    return this.page.getByRole('textbox', { name: 'locator', exact: true });
  }

  get editorContent(): Locator {
    return this.page.locator('.cm-content');
  }

  get editorError(): Locator {
    return this.page.locator('.cm-locator-error');
  }

  get result(): Locator {
    return this.page.getByRole('status').first();
  }

  get sample(): FrameLocator {
    return this.page.frameLocator('iframe[title="Sample page for trying locators"]');
  }

  get sampleHtml(): Locator {
    return this.sample.locator('html');
  }

  get highlights(): Locator {
    return this.sample.locator('.pl-box');
  }

  get strictError(): Locator {
    return this.page.getByRole('region', { name: 'strict mode error' });
  }

  get matches(): Locator {
    return this.page.getByRole('list', { name: 'Matched elements' });
  }

  get alert(): Locator {
    return this.page.getByRole('alert');
  }

  get useSuggestion(): Locator {
    return this.page.getByRole('button', { name: 'use this locator' });
  }

  get challengePassed(): Locator {
    return this.page.getByText(Messages.CHALLENGE_PASSED);
  }

  get nextChallenge(): Locator {
    return this.page.getByRole('button', { name: 'next challenge' });
  }

  // Plain CSS, so that what a test expects doesn't depend on the locator engine under test.
  sampleElements(css: string): Locator {
    return this.sample.locator(css);
  }

  highlightsIn(state: 'match' | 'strict' | 'target'): Locator {
    return this.sample.locator(`.pl-box[data-state="${state}"]`);
  }

  challenge(title: string, options: { exact?: boolean } = {}): Locator {
    return this.page.getByRole('button', { name: title, ...options });
  }

  challengeList(name: RegExp): Locator {
    return this.page.getByRole('region', { name });
  }

  // ==================== Actions ====================

  /**
   * Opens the playground and waits for CodeMirror to replace the fallback textarea.
   *
   * @returns Resolves when the editor is ready.
   */
  async goto(): Promise<void> {
    await this.visit(AppRoutes.PLAYGROUND);
    await expect(this.editorContent).toBeVisible();
    await expect(this.result).not.toHaveText(/loading/);
  }

  /**
   * Measures elements in the sample page's document, so the iframe's scroll position doesn't matter.
   *
   * @param elements - The elements to measure.
   * @returns One rectangle per element, in document order.
   */
  documentRects(elements: Locator): Promise<DocumentRect[]> {
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

  /**
   * Tells whether an element is fully inside the part of the sample page the iframe shows.
   *
   * @param element - The element to check.
   * @returns True when the whole element is in view.
   */
  isInSampleView(element: Locator): Promise<boolean> {
    return element.evaluate((node) => {
      const rect = node.getBoundingClientRect();
      return rect.top >= 0 && rect.bottom <= (node.ownerDocument.defaultView?.innerHeight ?? 0);
    });
  }

  /**
   * Reads the color a highlight is drawn in and the sample page's value for its design token.
   *
   * @param highlight - The highlight box.
   * @param token - The CSS custom property the highlight should use.
   * @returns The drawn color and the token's value.
   */
  highlightColor(highlight: Locator, token: string): Promise<{ drawn: string; token: string }> {
    return highlight.evaluate((node, name) => {
      const read = (element: Element, property: string) =>
        getComputedStyle(element).getPropertyValue(property).trim();
      return { drawn: read(node, '--pl-color'), token: read(node.ownerDocument.documentElement, name) };
    }, token);
  }

  /**
   * Selects the editor's text while keeping the browser's selectionchange event from CodeMirror until
   * `release` runs. This holds open the moment between a visitor selecting text and the editor hearing about it.
   *
   * @returns A function that delivers the held event.
   */
  async selectBeforeEditorNotices(): Promise<{ release: () => Promise<void> }> {
    await this.editorContent.evaluate((content) => {
      const hold = (event: Event) => event.stopImmediatePropagation();
      document.addEventListener('selectionchange', hold, { capture: true });
      (window as Window & { releaseSelection?: () => void }).releaseSelection = () => {
        document.removeEventListener('selectionchange', hold, { capture: true });
        // The held event arrives late, as it would in a busy browser.
        document.dispatchEvent(new Event('selectionchange'));
      };
      (content as HTMLElement).focus();
      document.getSelection()?.selectAllChildren(content);
    });
    return {
      release: () =>
        this.page.evaluate(() => (window as Window & { releaseSelection?: () => void }).releaseSelection?.()),
    };
  }

  /**
   * Replaces the editor's text.
   *
   * Not fill(): it types straight after selecting. On Android, CodeMirror takes text through EditContext,
   * whose selection only updates once CodeMirror has handled selectionchange, so the new text lands next
   * to the old. Two frames give it time to read the new selection.
   *
   * @param code - The locator expression to enter.
   * @returns Resolves when the text has been inserted.
   */
  async enterLocator(code: string): Promise<void> {
    await this.editor.selectText();
    await this.page.evaluate(
      () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))),
    );
    await this.page.keyboard.insertText(code);
  }
}
