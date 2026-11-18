import type { Locator, Page } from '@playwright/test';

export class TopBar {
  readonly banner: Locator;
  readonly nav: Locator;
  readonly themeToggle: Locator;
  /** The toggle's wrapper, found by attribute because it has no role while hidden. */
  readonly themeToggleControl: Locator;

  constructor(page: Page) {
    this.banner = page.getByRole('banner');
    this.nav = page.getByRole('navigation', { name: 'Main' });
    this.themeToggle = page.getByRole('button', { name: 'light theme' });
    this.themeToggleControl = page.locator('[data-theme-toggle]');
  }

  navLink(name: string) {
    return this.nav.getByRole('link', { name });
  }
}

export class Sidebar {
  readonly nav: Locator;
  readonly items: Locator;
  private readonly drawerToggle: Locator;

  constructor(page: Page) {
    this.nav = page.getByRole('navigation', { name: 'Chapters' });
    this.items = this.nav.getByRole('listitem');
    this.drawerToggle = page.getByText('browse chapters');
  }

  /** On small screens the sidebar lives in a collapsed drawer. */
  async open(isMobile: boolean) {
    if (isMobile) await this.drawerToggle.click();
  }

  link(name: string | RegExp) {
    return this.nav.getByRole('link', { name });
  }
}

export class SearchDialog {
  readonly button: Locator;
  readonly dialog: Locator;
  readonly input: Locator;
  readonly results: Locator;
  readonly status: Locator;

  constructor(page: Page) {
    this.button = page.getByRole('button', { name: 'search', exact: true });
    this.dialog = page.getByRole('dialog', { name: 'search' });
    this.input = this.dialog.getByRole('combobox', { name: 'search notes and tools' });
    this.results = this.dialog.getByRole('option');
    this.status = this.dialog.getByRole('status');
  }

  result(name: string | RegExp) {
    return this.dialog.getByRole('option', { name });
  }

  async searchFor(query: string) {
    await this.button.click();
    await this.input.fill(query);
  }
}
