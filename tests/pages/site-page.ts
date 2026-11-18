import AxeBuilder from '@axe-core/playwright';
import type { Locator, Page } from '@playwright/test';
import { PROGRESS_STORAGE_KEY } from '../../src/stores/progress';
import { SearchDialog, Sidebar, TopBar } from './site-chrome';

const THEME_STORAGE_KEY = 'playwright-lab:theme';
const DEFAULT_A11Y_TAGS = ['wcag2a', 'wcag2aa', 'wcag21aa'];

export type Theme = 'dark' | 'light';

/** A chapter's status mark inside `scope`, such as a heading or a chapter row. */
export const statusMark = (scope: Locator, status: 'read' | 'ready') =>
  scope.locator(`[data-status="${status}"]`);

/** What every page of the site shares: the layout around the content, saved settings and page-wide checks. */
export class SitePage {
  readonly topBar: TopBar;
  readonly sidebar: Sidebar;
  readonly search: SearchDialog;
  readonly html: Locator;
  readonly h1: Locator;
  readonly main: Locator;
  readonly status: Locator;
  readonly themeColor: Locator;

  constructor(readonly page: Page) {
    this.topBar = new TopBar(page);
    this.sidebar = new Sidebar(page);
    this.search = new SearchDialog(page);
    this.html = page.locator('html');
    this.h1 = page.getByRole('heading', { level: 1 });
    this.main = page.getByRole('main');
    this.status = page.getByRole('status');
    this.themeColor = page.locator('head meta[name="theme-color"]');
  }

  visit(path: string) {
    return this.page.goto(path);
  }

  h1Named(name: string) {
    return this.page.getByRole('heading', { level: 1, name });
  }

  h2(name: string | RegExp) {
    return this.page.getByRole('heading', { level: 2, name });
  }

  /** Every later page load starts with this theme saved. */
  async presetTheme(theme: string) {
    await this.page.addInitScript(
      ([key, value]) => localStorage.setItem(key, value),
      [THEME_STORAGE_KEY, theme],
    );
  }

  /** Saves the theme on the open page and reloads it. */
  async saveThemeAndReload(theme: Theme) {
    await this.page.evaluate(([key, value]) => localStorage.setItem(key, value), [THEME_STORAGE_KEY, theme]);
    await this.page.reload();
  }

  /** Every later page load starts from this saved progress, so changes don't survive a reload. */
  async seedProgress(raw: string) {
    await this.page.addInitScript(
      ([key, value]) => localStorage.setItem(key, value),
      [PROGRESS_STORAGE_KEY, raw],
    );
  }

  /** Only the first page load of the tab gets this saved progress, so changes survive a reload. */
  async seedProgressOnce(raw: string) {
    await this.page.addInitScript(
      ([key, value]) => {
        if (!sessionStorage.getItem('seeded')) localStorage.setItem(key, value);
        sessionStorage.setItem('seeded', 'yes');
      },
      [PROGRESS_STORAGE_KEY, raw],
    );
  }

  /** Saves progress on the open page, as another tab or an earlier visit would. */
  async writeProgress(raw: string) {
    await this.page.evaluate(([key, value]) => localStorage.setItem(key, value), [PROGRESS_STORAGE_KEY, raw]);
  }

  async savedProgress() {
    return this.page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '{}'), PROGRESS_STORAGE_KEY);
  }

  /** How many pixels the page scrolls sideways; 0 or less means it fits. */
  horizontalOverflow() {
    return this.page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
  }

  async a11yViolations({ tags = DEFAULT_A11Y_TAGS, include }: { tags?: string[]; include?: string } = {}) {
    const builder = new AxeBuilder({ page: this.page }).withTags(tags);
    if (include) builder.include(include);
    return (await builder.analyze()).violations;
  }
}
