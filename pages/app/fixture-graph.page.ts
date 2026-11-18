import type { Locator } from '@playwright/test';
import { AppRoutes } from '../../enums/app/app';
import { StepperPage } from './stepper.page';

export class FixtureGraphPage extends StepperPage {
  protected readonly path = AppRoutes.FIXTURE_GRAPH;

  // ==================== Locators ====================

  get consoleOutput(): Locator {
    return this.page.getByRole('region', { name: 'Console output', exact: true });
  }

  // A fixture's row in one worker's list of lifetimes.
  fixture(worker: number, name: string): Locator {
    return this.page
      .getByRole('list', { name: `worker ${worker} lifetimes` })
      .getByRole('listitem')
      .filter({ hasText: name });
  }

  sourceFile(name: string): Locator {
    return this.page.getByRole('region', { name });
  }
}
