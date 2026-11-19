import type { Locator, Page, Response } from '@playwright/test';
import { AppRoutes } from '../../enums/app/app';
import { QuizPanelComponent } from '../components/quiz-panel.component';
import { SitePage } from './site.page';

export class ChapterPage extends SitePage {
  /** The quiz at the end of the chapter */
  readonly quiz: QuizPanelComponent;

  constructor(page: Page) {
    super(page);
    this.quiz = new QuizPanelComponent(page);
  }

  // ==================== Locators ====================

  get doneButton(): Locator {
    return this.page.getByRole('button', { name: 'mark chapter as done' });
  }

  get toc(): Locator {
    return this.page.getByRole('navigation', { name: 'On this page' });
  }

  get prevNext(): Locator {
    return this.page.getByRole('navigation', { name: 'Previous and next chapter' });
  }

  get firstCodeBlock(): Locator {
    return this.page.locator('pre').first();
  }

  // A code block, named by the file in its title bar or, without a title, by its language.
  codeBlock(name: string, options: { exact?: boolean } = {}): Locator {
    return this.page.getByRole('group', { name, ...options });
  }

  highlightedLines(block: Locator): Locator {
    return block.locator('[data-highlighted]');
  }

  copyButton(block: Locator): Locator {
    return block.getByRole('button', { name: 'copy code' });
  }

  copiedButton(block: Locator): Locator {
    return block.getByRole('button', { name: 'copied code' });
  }

  // A link inside the notes, leaving out the sidebar's links with similar names.
  notesLink(name: string): Locator {
    return this.main.getByRole('link', { name, exact: true });
  }

  keys(note: Locator): Locator {
    return note.locator('kbd');
  }

  tocLink(name: string): Locator {
    return this.toc.getByRole('link', { name });
  }

  note(name: string | RegExp, options: { exact?: boolean } = {}): Locator {
    return this.page.getByRole('note', { name, ...options });
  }

  // ==================== Actions ====================

  /**
   * Opens a chapter.
   *
   * @param slug - The chapter's slug, such as `02-selectors`.
   * @returns The navigation's response.
   */
  goto(slug: string): Promise<Response | null> {
    return this.visit(`${AppRoutes.CHAPTERS}/${slug}`);
  }
}
