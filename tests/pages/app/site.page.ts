import AxeBuilder from '@axe-core/playwright';
import type { Locator, Page, Response } from '@playwright/test';
import { appConfig } from '../../config/app';
import { StorageKeys } from '../../enums/app/app';
import { PROGRESS_STORAGE_KEY, type Progress } from '../../../src/stores/progress';
import { SearchDialogComponent } from '../components/search-dialog.component';
import { SidebarComponent } from '../components/sidebar.component';
import { TopBarComponent } from '../components/top-bar.component';

const DEFAULT_A11Y_TAGS = ['wcag2a', 'wcag2aa', 'wcag21aa'];

export type Theme = 'dark' | 'light';

type A11yViolations = Awaited<ReturnType<AxeBuilder['analyze']>>['violations'];

// A chapter's status mark inside `scope`, such as a heading or a chapter row.
export const statusMark = (scope: Locator, status: 'read' | 'ready'): Locator =>
  scope.locator(`[data-status="${status}"]`);

/** What every page of the site shares: the layout around the content, saved settings and page-wide checks. */
export class SitePage {
  /** The bar at the top of every page */
  readonly topBar: TopBarComponent;
  /** The chapter list beside the content */
  readonly sidebar: SidebarComponent;
  /** The search dialog */
  readonly search: SearchDialogComponent;

  constructor(protected readonly page: Page) {
    this.topBar = new TopBarComponent(page);
    this.sidebar = new SidebarComponent(page);
    this.search = new SearchDialogComponent(page);
  }

  // ==================== Locators ====================

  get html(): Locator {
    return this.page.locator('html');
  }

  get h1(): Locator {
    return this.page.getByRole('heading', { level: 1 });
  }

  get main(): Locator {
    return this.page.getByRole('main');
  }

  get status(): Locator {
    return this.page.getByRole('status');
  }

  get themeColor(): Locator {
    return this.page.locator('head meta[name="theme-color"]');
  }

  get canonicalLink(): Locator {
    return this.page.locator('head link[rel="canonical"]');
  }

  get robotsMeta(): Locator {
    return this.page.locator('head meta[name="robots"]');
  }

  get svgIconLink(): Locator {
    return this.page.locator('head link[rel="icon"][type="image/svg+xml"]');
  }

  get icoIconLink(): Locator {
    return this.page.locator('head link[rel="icon"][sizes="48x48"]');
  }

  // The first visible element that is shown only once a chapter has been read.
  get firstReadOnlyContent(): Locator {
    return this.page.locator('[data-if-read]:visible').first();
  }

  meta(attribute: 'name' | 'property', key: string): Locator {
    return this.page.locator(`head meta[${attribute}="${key}"]`);
  }

  h1Named(name: string): Locator {
    return this.page.getByRole('heading', { level: 1, name });
  }

  h2(name: string | RegExp): Locator {
    return this.page.getByRole('heading', { level: 2, name });
  }

  // ==================== Actions ====================

  /**
   * Opens a path on the site.
   *
   * @param path - The path, relative to the site's base path.
   * @returns The navigation's response.
   */
  visit(path: string): Promise<Response | null> {
    return this.page.goto(`${appConfig.basePath}${path}`);
  }

  /**
   * Makes every later page load start with this theme saved.
   *
   * @param theme - The theme to save.
   * @returns Resolves when the script is registered.
   */
  async presetTheme(theme: string): Promise<void> {
    await this.page.addInitScript(
      ([key, value]) => localStorage.setItem(key, value),
      [StorageKeys.THEME, theme],
    );
  }

  /**
   * Saves the theme on the open page and reloads it.
   *
   * @param theme - The theme to save.
   * @returns Resolves when the page has reloaded.
   */
  async saveThemeAndReload(theme: Theme): Promise<void> {
    await this.page.evaluate(([key, value]) => localStorage.setItem(key, value), [StorageKeys.THEME, theme]);
    await this.page.reload();
  }

  /**
   * Makes every later page load start from this saved progress, so changes don't survive a reload.
   *
   * @param raw - The text to keep in localStorage.
   * @returns Resolves when the script is registered.
   */
  async seedProgress(raw: string): Promise<void> {
    await this.page.addInitScript(
      ([key, value]) => localStorage.setItem(key, value),
      [PROGRESS_STORAGE_KEY, raw],
    );
  }

  /**
   * Gives only the tab's first page load this saved progress, so changes survive a reload.
   *
   * @param raw - The text to keep in localStorage.
   * @returns Resolves when the script is registered.
   */
  async seedProgressOnce(raw: string): Promise<void> {
    await this.page.addInitScript(
      ([key, value, seededKey]) => {
        if (!sessionStorage.getItem(seededKey)) localStorage.setItem(key, value);
        sessionStorage.setItem(seededKey, 'yes');
      },
      [PROGRESS_STORAGE_KEY, raw, StorageKeys.PROGRESS_SEEDED],
    );
  }

  /**
   * Saves progress on the open page, as another tab or an earlier visit would.
   *
   * @param raw - The text to keep in localStorage.
   * @returns Resolves when the progress is saved.
   */
  async writeProgress(raw: string): Promise<void> {
    await this.page.evaluate(([key, value]) => localStorage.setItem(key, value), [PROGRESS_STORAGE_KEY, raw]);
  }

  /**
   * Reads the progress saved in localStorage.
   *
   * @returns The saved progress, empty when nothing is saved.
   */
  savedProgress(): Promise<Partial<Progress>> {
    return this.page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '{}'), PROGRESS_STORAGE_KEY);
  }

  /**
   * Measures how far the page scrolls sideways.
   *
   * @returns The overflow in pixels; 0 or less means the page fits.
   */
  horizontalOverflow(): Promise<number> {
    return this.page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
  }

  /**
   * axe reads these properties for ARIA attributes, and on our hydrated islands that segfaults Firefox's page process
   * (`ariaLabelledByElements` on the generators' inputs, for one). Without them axe still checks the attributes.
   *
   * @returns Resolves when the properties are gone.
   */
  private async removeFirefoxAriaElementProperties(): Promise<void> {
    if (this.page.context().browser()?.browserType().name() !== 'firefox') return;
    await Promise.all(
      this.page.frames().map((frame) =>
        frame.evaluate(() => {
          for (const name of Object.getOwnPropertyNames(Element.prototype)) {
            if (/^aria\w+Elements?$/.test(name)) Reflect.deleteProperty(Element.prototype, name);
          }
        }),
      ),
    );
  }

  /**
   * Waits for the web fonts and then two painted frames, so the page has its final layout.
   * Scanned mid font swap, WebKit on CI reported every text node as black on the page background.
   *
   * @returns Resolves when the page has settled.
   */
  private async settleLayout(): Promise<void> {
    await this.page.evaluate(async () => {
      await document.fonts.ready;
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    });
  }

  /**
   * Scans the page with axe.
   *
   * @param options - The axe tags to run and, optionally, the only part of the page to scan.
   * @returns The violations axe found.
   */
  async a11yViolations({
    tags = DEFAULT_A11Y_TAGS,
    include,
  }: { tags?: readonly string[]; include?: string } = {}): Promise<A11yViolations> {
    await this.removeFirefoxAriaElementProperties();
    await this.settleLayout();
    const builder = new AxeBuilder({ page: this.page }).withTags([...tags]);
    if (include) builder.include(include);
    return (await builder.analyze()).violations;
  }
}
