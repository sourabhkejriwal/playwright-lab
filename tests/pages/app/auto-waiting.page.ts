import type { Locator } from '@playwright/test';
import { AppRoutes } from '../../enums/app/app';
import { StepperPage } from './stepper.page';

export class AutoWaitingPage extends StepperPage {
  protected readonly path = AppRoutes.AUTO_WAITING;

  // ==================== Locators ====================

  get callLog(): Locator {
    return this.page.getByRole('region', { name: 'Call log', exact: true });
  }

  get testCode(): Locator {
    return this.page.getByRole('region', { name: 'Test code' });
  }

  get actionTable(): Locator {
    return this.page.getByRole('table');
  }

  checkRow(name: string): Locator {
    return this.page
      .getByRole('list', { name: '# actionability checks' })
      .getByRole('listitem')
      .filter({ hasText: name });
  }
}
