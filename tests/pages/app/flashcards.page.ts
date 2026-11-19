import type { Locator, Response } from '@playwright/test';
import { AppRoutes } from '../../enums/app/app';
import { SitePage } from './site.page';

export type Grade = 'again' | 'good' | 'easy';

export class FlashcardsPage extends SitePage {
  // ==================== Locators ====================

  get card(): Locator {
    return this.page.getByRole('article', { name: 'Flashcard' });
  }

  get question(): Locator {
    return this.card.getByRole('heading', { level: 2 });
  }

  get answer(): Locator {
    return this.page.getByRole('group', { name: 'Answer' });
  }

  get firstAnswerCode(): Locator {
    return this.answer.locator('code').first();
  }

  get revealButton(): Locator {
    return this.page.getByRole('button', { name: 'reveal answer' });
  }

  get caughtUp(): Locator {
    return this.page.getByRole('heading', { name: 'all caught up' });
  }

  get chapterFilter(): Locator {
    return this.page.getByRole('combobox', { name: 'chapter' });
  }

  gradeButton(grade: Grade): Locator {
    return this.page.getByRole('button', { name: new RegExp(`^${grade}\\b`) });
  }

  // ==================== Actions ====================

  /**
   * Opens the flashcards page.
   *
   * @returns The navigation's response.
   */
  goto(): Promise<Response | null> {
    return this.visit(AppRoutes.FLASHCARDS);
  }

  /**
   * Reveals the current card's answer and grades it.
   *
   * @param grade - How well the visitor remembered the answer.
   * @returns Resolves when the card has been graded.
   */
  async review(grade: Grade): Promise<void> {
    await this.revealButton.click();
    await this.gradeButton(grade).click();
  }
}
