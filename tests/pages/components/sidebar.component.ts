import type { Locator, Page } from '@playwright/test';
import { Messages } from '../../enums/app/app';

export class SidebarComponent {
  constructor(private readonly page: Page) {}

  // ==================== Locators ====================

  get nav(): Locator {
    return this.page.getByRole('navigation', { name: 'Chapters' });
  }

  get items(): Locator {
    return this.nav.getByRole('listitem');
  }

  private get drawerToggle(): Locator {
    return this.page.getByText(Messages.BROWSE_CHAPTERS);
  }

  link(name: string | RegExp): Locator {
    return this.nav.getByRole('link', { name });
  }

  // ==================== Actions ====================

  /**
   * Opens the drawer that holds the sidebar on small screens.
   *
   * @param isMobile - Whether the test runs on a small screen; larger screens have no drawer.
   * @returns Resolves when the sidebar can be used.
   */
  async open(isMobile: boolean): Promise<void> {
    if (isMobile) await this.drawerToggle.click();
  }
}
