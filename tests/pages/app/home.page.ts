import type { Locator, Response } from '@playwright/test';
import { AppRoutes, Messages } from '../../enums/app/app';
import { SitePage } from './site.page';

export class HomePage extends SitePage {
  // ==================== Locators ====================

  get chapterRun(): Locator {
    return this.page.getByRole('list', { name: 'Chapter progress' });
  }

  get nextUp(): Locator {
    return this.page.getByText(/next up/);
  }

  get pendingCount(): Locator {
    return this.page.getByText(/\d+ pending/);
  }

  get allRead(): Locator {
    return this.page.getByText(Messages.ALL_CHAPTERS_READ);
  }

  get firstChapterLink(): Locator {
    return this.page.getByRole('link', { name: 'ch01 Quick setup refresher' });
  }

  runLink(name: string): Locator {
    return this.chapterRun.getByRole('link', { name });
  }

  readCount(count: number): Locator {
    return this.page.getByText(`${count} read`, { exact: true });
  }

  readyCount(count: number): Locator {
    return this.page.getByText(`${count} ready`, { exact: true });
  }

  // ==================== Actions ====================

  /**
   * Opens the home page.
   *
   * @returns The navigation's response.
   */
  goto(): Promise<Response | null> {
    return this.visit(AppRoutes.HOME);
  }
}
