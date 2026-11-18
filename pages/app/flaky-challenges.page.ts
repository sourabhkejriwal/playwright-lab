import { expect, type Locator } from '@playwright/test';
import { AppRoutes } from '../../enums/app/app';
import { SitePage } from './site.page';

export class FlakyChallengesPage extends SitePage {
  // ==================== Locators ====================

  get checkButton(): Locator {
    return this.page.getByRole('button', { name: 'check answer' });
  }

  get result(): Locator {
    return this.page.getByRole('group', { name: 'Result' });
  }

  line(line: number): Locator {
    return this.page.getByRole('radio', { name: new RegExp(`^line ${line}\\b`) });
  }

  cause(text: string): Locator {
    return this.page
      .getByRole('group', { name: /Why does it fail/ })
      .getByRole('radio', { name: text.replaceAll('`', ''), exact: true });
  }

  challenge(name: string, options: { exact?: boolean } = {}): Locator {
    return this.page.getByRole('button', { name, ...options });
  }

  resultButton(name: string): Locator {
    return this.result.getByRole('button', { name });
  }

  solvedCount(solved: number, total: number): Locator {
    return this.page.getByText(`${solved} of ${total} solved`);
  }

  // ==================== Actions ====================

  /**
   * Opens the challenges and waits for the first one to show.
   *
   * @param firstTitle - The title of the first challenge.
   * @returns Resolves when the first challenge is visible.
   */
  async goto(firstTitle: string): Promise<void> {
    await this.visit(AppRoutes.FLAKY_CHALLENGES);
    await expect(this.h2(firstTitle)).toBeVisible();
  }

  /**
   * Picks a line and a cause, then checks the answer.
   *
   * @param line - The line number that causes the flakiness.
   * @param cause - The text of the chosen cause.
   * @returns Resolves when the answer has been checked.
   */
  async submit(line: number, cause: string): Promise<void> {
    await this.line(line).check();
    await this.cause(cause).check();
    await this.checkButton.click();
  }
}
