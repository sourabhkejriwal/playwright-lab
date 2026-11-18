import type { Locator, Page } from '@playwright/test';

export class SearchDialogComponent {
  constructor(private readonly page: Page) {}

  // ==================== Locators ====================

  get button(): Locator {
    return this.page.getByRole('button', { name: 'search', exact: true });
  }

  get dialog(): Locator {
    return this.page.getByRole('dialog', { name: 'search' });
  }

  get input(): Locator {
    return this.dialog.getByRole('combobox', { name: 'search notes and tools' });
  }

  get results(): Locator {
    return this.dialog.getByRole('option');
  }

  get status(): Locator {
    return this.dialog.getByRole('status');
  }

  result(name: string | RegExp): Locator {
    return this.dialog.getByRole('option', { name });
  }

  // The first highlighted word in a search result.
  firstMark(result: Locator): Locator {
    return result.locator('mark').first();
  }

  // ==================== Actions ====================

  /**
   * Opens the dialog and types a search.
   *
   * @param query - The text to search for.
   * @returns Resolves when the text has been entered.
   */
  async searchFor(query: string): Promise<void> {
    await this.button.click();
    await this.input.fill(query);
  }
}
