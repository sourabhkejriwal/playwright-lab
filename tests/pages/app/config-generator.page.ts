import type { Locator } from '@playwright/test';
import { AppRoutes } from '../../enums/app/app';
import { GeneratorPage } from './generator.page';

export class ConfigGeneratorPage extends GeneratorPage {
  protected readonly path = AppRoutes.CONFIG_GENERATOR;

  // ==================== Locators ====================

  get output(): Locator {
    return this.page.getByRole('region', { name: 'playwright.config.ts' });
  }

  get notes(): Locator {
    return this.page.getByRole('list', { name: 'Notes on this config' });
  }

  protected get firstControl(): Locator {
    return this.checkbox('# browsers', 'chromium');
  }
}
