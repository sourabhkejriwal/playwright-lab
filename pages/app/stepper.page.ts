import { expect, type Locator } from '@playwright/test';
import { Messages, type AppRoutes } from '../../enums/app/app';
import { SitePage } from './site.page';

/** The auto-waiting timeline and the fixture graph: a scenario played back one step at a time. */
export abstract class StepperPage extends SitePage {
  protected abstract readonly path: AppRoutes;

  // ==================== Locators ====================

  get nextButton(): Locator {
    return this.page.getByRole('button', { name: 'next', exact: true });
  }

  get backButton(): Locator {
    return this.page.getByRole('button', { name: 'back', exact: true });
  }

  get playButton(): Locator {
    return this.page.getByRole('button', { name: 'play', exact: true });
  }

  get pauseButton(): Locator {
    return this.page.getByRole('button', { name: 'pause', exact: true });
  }

  get scenario(): Locator {
    return this.page.getByLabel('scenario');
  }

  get failedBadge(): Locator {
    return this.page.getByText(Messages.STEP_FAILED, { exact: true });
  }

  get currentStep(): Locator {
    return this.page.locator('[aria-current="step"]');
  }

  step(name: string | RegExp): Locator {
    return this.page.getByRole('button', { name });
  }

  // ==================== Actions ====================

  /**
   * Opens the page and waits for its island, which hydrates when it scrolls into view.
   *
   * @returns Resolves when the controls respond.
   */
  async goto(): Promise<void> {
    await this.visit(this.path);
    await this.nextButton.scrollIntoViewIfNeeded();
    await expect(this.nextButton).toBeEnabled();
  }

  /**
   * Switches to another scenario.
   *
   * @param label - The scenario's name in the list.
   * @returns Resolves when the scenario is chosen.
   */
  async chooseScenario(label: string): Promise<void> {
    await this.scenario.selectOption({ label });
  }

  /**
   * Jumps straight to a step.
   *
   * @param name - The step button's accessible name.
   * @returns Resolves when the step has been clicked.
   */
  async goToStep(name: string | RegExp): Promise<void> {
    await this.step(name).click();
  }

  /**
   * Clicks next until the last step is showing, starting from the first.
   *
   * @param stepCount - How many steps the scenario has.
   * @returns Resolves when the last step is showing.
   */
  async walkToEnd(stepCount: number): Promise<void> {
    for (let at = 1; at < stepCount; at += 1) await this.nextButton.click();
  }
}
