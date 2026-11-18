import { expect, type Locator } from '@playwright/test';
import { AppRoutes, Messages } from '../../enums/app/app';
import { SitePage } from './site.page';

export class ParallelSimulatorPage extends SitePage {
  // ==================== Locators ====================

  get workers(): Locator {
    return this.page.getByRole('slider', { name: 'workers per shard' });
  }

  get shards(): Locator {
    return this.page.getByRole('slider', { name: 'shards' });
  }

  get suite(): Locator {
    return this.page.getByLabel('test suite');
  }

  get fullyParallel(): Locator {
    return this.page.getByRole('checkbox', { name: 'fullyParallel' });
  }

  get commands(): Locator {
    return this.page.getByRole('region', { name: 'Commands' });
  }

  get lessons(): Locator {
    return this.page.getByRole('list', { name: 'What these settings show' });
  }

  get workerDetails(): Locator {
    return this.page.getByText(Messages.WORKER_DETAILS);
  }

  get secondShardWorkerDetails(): Locator {
    return this.workerDetails.nth(1);
  }

  get firstEmptyShardNotice(): Locator {
    return this.page.getByText(Messages.EMPTY_SHARD).first();
  }

  // The value beside a label in the results summary. Each label has two definitions, and no role can
  // say "the first one after this term", so this is the one place that needs a CSS sibling selector.
  stat(label: string): Locator {
    return this.page.locator(`dt:has-text("${label}") + dd`);
  }

  shardHeadings(count: number): Locator {
    return this.page.getByRole('heading', { level: 3, name: new RegExp(`shard \\d of ${count}`) });
  }

  workersOfShard(shard: number): Locator {
    return this.page.getByRole('list', { name: `shard ${shard} workers` }).getByRole('listitem');
  }

  firstWorkerOfShard(shard: number): Locator {
    return this.workersOfShard(shard).first();
  }

  lastWorkerOfShard(shard: number): Locator {
    return this.workersOfShard(shard).last();
  }

  // ==================== Actions ====================

  /**
   * Opens the simulator and waits for its island, which hydrates when it scrolls into view.
   *
   * @returns Resolves when the controls respond.
   */
  async goto(): Promise<void> {
    await this.visit(AppRoutes.PARALLEL_SIMULATOR);
    await this.workers.scrollIntoViewIfNeeded();
    await expect(this.workers).toBeEnabled();
  }

  /**
   * Switches to another test suite.
   *
   * @param label - The suite's name in the list.
   * @returns Resolves when the suite is chosen.
   */
  async chooseSuite(label: string): Promise<void> {
    await this.suite.selectOption({ label });
  }
}
