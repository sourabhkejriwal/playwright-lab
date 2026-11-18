import type { Locator, Page } from '@playwright/test';
import { SitePage } from './site-page';

export type Grade = 'again' | 'good' | 'easy';

export class FlashcardsPage extends SitePage {
  readonly card: Locator;
  readonly question: Locator;
  readonly answer: Locator;
  readonly revealButton: Locator;
  readonly caughtUp: Locator;
  readonly chapterFilter: Locator;

  constructor(page: Page) {
    super(page);
    this.card = page.getByRole('article', { name: 'Flashcard' });
    this.question = this.card.getByRole('heading', { level: 2 });
    this.answer = page.getByRole('group', { name: 'Answer' });
    this.revealButton = page.getByRole('button', { name: 'reveal answer' });
    this.caughtUp = page.getByRole('heading', { name: 'all caught up' });
    this.chapterFilter = page.getByRole('combobox', { name: 'chapter' });
  }

  goto() {
    return this.visit('/flashcards');
  }

  gradeButton(grade: Grade) {
    return this.page.getByRole('button', { name: new RegExp(`^${grade}\\b`) });
  }

  async review(grade: Grade) {
    await this.revealButton.click();
    await this.gradeButton(grade).click();
  }
}
