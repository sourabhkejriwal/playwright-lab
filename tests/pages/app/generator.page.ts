import { expect, type Download, type Locator } from '@playwright/test';
import type { AppRoutes } from '../../enums/app/app';
import { SitePage } from './site.page';

/** The config generator and the CI builder: options on one side, a generated file on the other. */
export abstract class GeneratorPage extends SitePage {
  protected abstract readonly path: AppRoutes;

  // ==================== Locators ====================

  abstract get output(): Locator;

  abstract get notes(): Locator;

  // A control that stays disabled until the island can respond to it.
  protected abstract get firstControl(): Locator;

  get copyButton(): Locator {
    return this.page.getByRole('button', { name: 'copy', exact: true });
  }

  get copiedButton(): Locator {
    return this.page.getByRole('button', { name: 'copied', exact: true });
  }

  get downloadButton(): Locator {
    return this.page.getByRole('button', { name: 'download' });
  }

  section(name: string): Locator {
    return this.page.getByRole('group', { name });
  }

  checkbox(section: string, name: string): Locator {
    return this.section(section).getByRole('checkbox', { name, exact: true });
  }

  radio(section: string, name: string): Locator {
    return this.section(section).getByRole('radio', { name, exact: true });
  }

  select(name: string): Locator {
    return this.page.getByRole('combobox', { name });
  }

  // ==================== Actions ====================

  /**
   * Opens the generator and waits for its island to hydrate.
   *
   * @returns Resolves when the controls respond.
   */
  async goto(): Promise<void> {
    await this.visit(this.path);
    await this.waitUntilReady();
  }

  /**
   * Waits for the island to hydrate.
   *
   * @returns Resolves when the controls respond.
   */
  async waitUntilReady(): Promise<void> {
    await expect(this.firstControl).toBeEnabled();
  }

  /**
   * Downloads the generated file.
   *
   * @returns The finished download.
   */
  async download(): Promise<Download> {
    const downloading = this.page.waitForEvent('download');
    await this.downloadButton.click();
    return downloading;
  }
}
