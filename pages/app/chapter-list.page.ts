import type { Locator, Response } from '@playwright/test';
import { AppRoutes } from '../../enums/app/app';
import { SitePage } from './site.page';

export class ChapterListPage extends SitePage {
  // ==================== Locators ====================

  row(name: string | RegExp): Locator {
    return this.main.getByRole('link', { name });
  }

  // ==================== Actions ====================

  /**
   * Opens the list of chapters.
   *
   * @returns The navigation's response.
   */
  goto(): Promise<Response | null> {
    return this.visit(AppRoutes.CHAPTERS);
  }
}
