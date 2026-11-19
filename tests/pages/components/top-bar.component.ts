import type { Locator, Page } from '@playwright/test';

export class TopBarComponent {
  constructor(private readonly page: Page) {}

  // ==================== Locators ====================

  get banner(): Locator {
    return this.page.getByRole('banner');
  }

  get nav(): Locator {
    return this.page.getByRole('navigation', { name: 'Main' });
  }

  get themeToggle(): Locator {
    return this.page.getByRole('button', { name: 'light theme' });
  }

  // The toggle's wrapper, found by attribute because it has no role while hidden.
  get themeToggleControl(): Locator {
    return this.page.locator('[data-theme-toggle]');
  }

  navLink(name: string): Locator {
    return this.nav.getByRole('link', { name });
  }
}
