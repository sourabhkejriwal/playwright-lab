import type { Locator } from '@playwright/test';
import { AppRoutes } from '../../enums/app/app';
import { GeneratorPage } from './generator.page';

export class CiBuilderPage extends GeneratorPage {
  protected readonly path = AppRoutes.CI_BUILDER;

  // ==================== Locators ====================

  get output(): Locator {
    return this.page.getByRole('region', { name: 'playwright.yml' });
  }

  get notes(): Locator {
    return this.page.getByRole('list', { name: 'Notes on this workflow' });
  }

  protected get firstControl(): Locator {
    return this.checkbox('# triggers', 'push');
  }
}
