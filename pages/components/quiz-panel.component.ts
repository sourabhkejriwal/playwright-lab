import type { Locator, Page } from '@playwright/test';

/** The quiz at the end of a chapter. It hydrates once it scrolls into view. */
export class QuizPanelComponent {
  constructor(private readonly page: Page) {}

  // ==================== Locators ====================

  get region(): Locator {
    return this.page.getByRole('region', { name: 'Chapter quiz' });
  }

  get startButton(): Locator {
    return this.button('start quiz');
  }

  get checkButton(): Locator {
    return this.button('check answer');
  }

  get nextButton(): Locator {
    return this.button('next question');
  }

  get scoreButton(): Locator {
    return this.button('see score');
  }

  get retakeButton(): Locator {
    return this.button('retake quiz');
  }

  get explanation(): Locator {
    return this.region.getByRole('group', { name: 'Explanation' });
  }

  get options(): Locator {
    return this.region.getByRole('radio');
  }

  get checkedOptions(): Locator {
    return this.region.getByRole('radio', { checked: true });
  }

  private button(name: string): Locator {
    return this.region.getByRole('button', { name, exact: true });
  }

  option(name: string | RegExp): Locator {
    return typeof name === 'string'
      ? this.region.getByRole('radio', { name, exact: true })
      : this.region.getByRole('radio', { name });
  }

  questionGroup(name: string): Locator {
    return this.region.getByRole('group', { name });
  }

  heading(name: string | RegExp): Locator {
    return this.region.getByRole('heading', { name });
  }

  text(text: string): Locator {
    return this.region.getByText(text);
  }

  optionCode(text: string): Locator {
    return this.region.locator('label code', { hasText: text });
  }

  // ==================== Actions ====================

  /**
   * Scrolls the quiz into view so that its island hydrates.
   *
   * @returns Resolves when the quiz is in view.
   */
  async hydrate(): Promise<void> {
    await this.region.scrollIntoViewIfNeeded();
  }

  /**
   * Chooses an option and checks the answer.
   *
   * @param name - The option's exact accessible name.
   * @returns Resolves when the answer has been checked.
   */
  async answer(name: string): Promise<void> {
    await this.option(name).check();
    await this.checkButton.click();
  }
}
