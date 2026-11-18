import { test, expect } from '@playwright/test';

test.describe('home', () => {
  test('shows the hero and the chapter test run', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle('playwright-lab');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Learn Playwright by');

    const run = page.getByRole('list', { name: 'Chapter progress' });
    await expect(run.getByRole('listitem')).toHaveCount(16);
    await expect(run.getByRole('link', { name: 'Chapter 2, Selectors: ready' })).toBeVisible();
    await expect(page.getByText(/next up/)).toContainText('ch01');
  });

  test('chapter sidebar lists every chapter and marks the current one', async ({ page, isMobile }) => {
    await page.goto('/chapters/02-selectors');
    // On small screens the sidebar lives in a collapsed drawer.
    if (isMobile) await page.getByText('browse chapters').click();

    const sidebar = page.getByRole('navigation', { name: 'Chapters' });
    await expect(sidebar.getByRole('listitem')).toHaveCount(16 + 8); // chapters + practice links
    await expect(sidebar.getByRole('link', { name: /Selectors/ })).toHaveAttribute('aria-current', 'page');

    await sidebar.getByRole('link', { name: /Fixtures/ }).click();
    await expect(page).toHaveURL(/\/chapters\/05-fixtures\/?$/);
  });

  test('main navigation reaches every section', async ({ page }) => {
    await page.goto('/');
    const nav = page.getByRole('navigation', { name: 'Main' });
    for (const [label, heading] of [
      ['chapters', 'Chapters'],
      ['playground', 'Locator playground'],
      ['flashcards', 'Flashcards'],
      ['config', 'Config generator'],
      ['about', 'About'],
    ]) {
      await nav.getByRole('link', { name: label }).click();
      await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
      await expect(nav.getByRole('link', { name: `./${label}` })).toHaveAttribute('aria-current', 'page');
    }
  });
});

test.describe('chapters', () => {
  test('a written chapter renders its MDX content', async ({ page }) => {
    await page.goto('/chapters/02-selectors');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Advanced selectors');
    await expect(
      page.getByRole('heading', { level: 2, name: 'Start with user-facing locators' }),
    ).toBeVisible();
    await expect(page.locator('pre').first()).toContainText('getByRole');
  });

  test('the setup chapter renders its notes and quiz', async ({ page }) => {
    await page.goto('/chapters/01-setup');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Quick setup refresher');
    await expect(page.getByRole('heading', { level: 2, name: 'Configure the run' })).toBeVisible();
    await expect(page.getByRole('group', { name: 'playwright.config.ts' })).toContainText('defineConfig');
    await expect(page.getByRole('region', { name: 'Chapter quiz' })).toBeAttached();
  });

  test('the cross-browser chapter renders its notes and quiz', async ({ page }) => {
    await page.goto('/chapters/03-cross-browser');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Cross-browser testing');
    await expect(page.getByRole('heading', { level: 2, name: 'One suite, many projects' })).toBeVisible();
    await expect(page.getByRole('group', { name: 'menu.spec.ts' })).toContainText('isMobile');
    await expect(page.getByRole('region', { name: 'Chapter quiz' })).toBeAttached();
  });

  test('the AI test generation chapter renders its notes and quiz', async ({ page }) => {
    await page.goto('/chapters/04-ai-test-generation');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('AI-powered test generation');
    await expect(page.getByRole('heading', { level: 2, name: 'Review what comes back' })).toBeVisible();
    await expect(page.getByRole('group', { name: 'refresh.spec.ts' })).toContainText('toPass');
    await expect(page.getByRole('region', { name: 'Chapter quiz' })).toBeAttached();
  });

  test('the fixtures chapter renders its notes and quiz', async ({ page }) => {
    await page.goto('/chapters/05-fixtures');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Scalable tests with fixtures');
    await expect(page.getByRole('heading', { level: 2, name: 'Scope and life cycle' })).toBeVisible();
    await expect(page.getByRole('group', { name: 'console-guard.fixture.ts' })).toContainText('pageerror');
    await expect(page.getByRole('link', { name: 'fixture graph explainer' })).toHaveAttribute(
      'href',
      /\/fixture-graph\/?$/,
    );
    await expect(page.getByRole('region', { name: 'Chapter quiz' })).toBeAttached();
  });

  test('the parallelization chapter renders its notes and quiz', async ({ page }) => {
    await page.goto('/chapters/06-parallelization');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Parallelization and performance');
    await expect(page.getByRole('heading', { level: 2, name: 'Shard across machines' })).toBeVisible();
    await expect(page.getByRole('group', { name: 'lcp.perf.ts' })).toContainText('PerformanceObserver');
    await expect(page.getByRole('link', { name: 'parallel simulator', exact: true })).toHaveAttribute(
      'href',
      /\/parallel\/?$/,
    );
    await expect(page.getByRole('region', { name: 'Chapter quiz' })).toBeAttached();
  });

  test('the CI/CD chapter renders its notes and quiz', async ({ page }) => {
    await page.goto('/chapters/07-ci-cd');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('CI/CD pipelines');
    await expect(page.getByRole('heading', { level: 2, name: 'A first workflow' })).toBeVisible();
    await expect(page.getByRole('group', { name: 'Dockerfile' })).toContainText(
      'mcr.microsoft.com/playwright',
    );
    await expect(
      page.getByRole('main').getByRole('link', { name: 'CI pipeline builder', exact: true }),
    ).toHaveAttribute('href', /\/ci\/?$/);
    await expect(page.getByRole('region', { name: 'Chapter quiz' })).toBeAttached();
  });

  test('the debugging chapter renders its notes and quiz', async ({ page }) => {
    await page.goto('/chapters/08-headless-debugging');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Headless testing and debugging');
    await expect(page.getByRole('heading', { level: 2, name: 'Playwright Inspector' })).toBeVisible();
    await expect(page.getByRole('group', { name: 'login.spec.ts' })).toContainText('#email-input');
    await expect(
      page.getByRole('main').getByRole('link', { name: 'auto-waiting timeline', exact: true }),
    ).toHaveAttribute('href', /\/auto-waiting\/?$/);
    await expect(page.getByRole('region', { name: 'Chapter quiz' })).toBeAttached();
  });

  test('the accessibility chapter renders its notes and quiz', async ({ page }) => {
    await page.goto('/chapters/09-accessibility');
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      'Accessibility testing with axe-core',
    );
    await expect(page.getByRole('heading', { level: 2, name: 'Choose axe tags carefully' })).toBeVisible();
    await expect(page.getByRole('group', { name: 'tests/fixtures.ts' })).toContainText('makeAxeBuilder');
    await expect(
      page.getByRole('main').getByRole('link', { name: 'locator playground', exact: true }),
    ).toHaveAttribute('href', /\/playground\/?$/);
    await expect(page.getByRole('region', { name: 'Chapter quiz' })).toBeAttached();
  });

  test('the visual regression chapter renders its notes and quiz', async ({ page }) => {
    await page.goto('/chapters/10-visual-regression');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Visual regression testing');
    await expect(
      page.getByRole('heading', { level: 2, name: 'Set tolerances you can defend' }),
    ).toBeVisible();
    await expect(page.getByRole('group', { name: 'tests/orders.spec.ts' })).toContainText('setFixedTime');
    await expect(
      page.getByRole('main').getByRole('link', { name: 'Chapter 7', exact: true }),
    ).toHaveAttribute('href', /\/chapters\/07-ci-cd\/?$/);
    await expect(page.getByRole('region', { name: 'Chapter quiz' })).toBeAttached();
  });

  test('the mobile chapter renders its notes and quiz', async ({ page }) => {
    await page.goto('/chapters/11-mobile');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Testing mobile web experiences');
    await expect(page.getByRole('heading', { level: 2, name: 'Touch input' })).toBeVisible();
    await expect(page.getByRole('group', { name: 'tests/stores.spec.ts' })).toContainText('setGeolocation');
    await expect(
      page.getByRole('main').getByRole('link', { name: 'chapter 10', exact: true }),
    ).toHaveAttribute('href', /\/chapters\/10-visual-regression\/?$/);
    await expect(page.getByRole('region', { name: 'Chapter quiz' })).toBeAttached();
  });

  test('the forms chapter renders its notes and quiz', async ({ page }) => {
    await page.goto('/chapters/12-forms');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Testing forms');
    await expect(page.getByRole('heading', { level: 2, name: 'Checkboxes and radio buttons' })).toBeVisible();
    await expect(page.getByRole('group', { name: 'tests/shipping.spec.ts' })).toContainText('getByRole');
    await expect(
      page.getByRole('main').getByRole('link', { name: 'Chapter 9', exact: true }),
    ).toHaveAttribute('href', /\/chapters\/09-accessibility\/?$/);
    await expect(page.getByRole('region', { name: 'Chapter quiz' })).toBeAttached();
  });

  test('the files chapter renders its notes and quiz', async ({ page }) => {
    await page.goto('/chapters/13-files');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('File uploads and downloads');
    await expect(page.getByRole('heading', { level: 2, name: 'When downloads fail' })).toBeVisible();
    await expect(page.getByRole('group', { name: 'tests/report.spec.ts' })).toContainText('waitForEvent');
    await expect(
      page.getByRole('main').getByRole('link', { name: 'Chapter 12', exact: true }),
    ).toHaveAttribute('href', /\/chapters\/12-forms\/?$/);
    await expect(page.getByRole('region', { name: 'Chapter quiz' })).toBeAttached();
  });

  test('the security chapter renders its notes and quiz', async ({ page }) => {
    await page.goto('/chapters/14-security-auth');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Security and authentication');
    await expect(page.getByRole('heading', { level: 2, name: 'Testing logout properly' })).toBeVisible();
    await expect(page.getByRole('group', { name: 'tests/logout.spec.ts' })).toContainText('extraHTTPHeaders');
    await expect(
      page.getByRole('main').getByRole('link', { name: 'Chapter 5', exact: true }),
    ).toHaveAttribute('href', /\/chapters\/05-fixtures\/?$/);
    await expect(page.getByRole('region', { name: 'Chapter quiz' })).toBeAttached();
  });

  test('the maintainability chapter renders its notes and quiz', async ({ page }) => {
    await page.goto('/chapters/15-maintainability');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Best practices for maintainability');
    await expect(page.getByRole('heading', { level: 2, name: 'Managing test data' })).toBeVisible();
    await expect(page.getByRole('group', { name: 'tests/pages/todo-page.ts' })).toContainText('box: true');
    await expect(
      page.getByRole('main').getByRole('link', { name: 'Chapter 5', exact: true }),
    ).toHaveAttribute('href', /\/chapters\/05-fixtures\/?$/);
    await expect(page.getByRole('region', { name: 'Chapter quiz' })).toBeAttached();
  });

  for (const chapter of [
    '10-visual-regression',
    '12-forms',
    '13-files',
    '14-security-auth',
    '15-maintainability',
  ]) {
    test(`chapter ${chapter} fits a 375px screen`, async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 800 });
      await page.goto(`/chapters/${chapter}`);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBe(0);
    });
  }

  test('code blocks show a title bar and highlighted lines', async ({ page }) => {
    await page.goto('/chapters/02-selectors');

    const titled = page.getByRole('group', { name: 'profile.spec.ts' });
    await expect(titled).toContainText('profile.spec.ts');
    await expect(titled.locator('[data-highlighted]')).toHaveCount(1);
    await expect(titled.locator('[data-highlighted]')).toContainText("getByRole('button'");

    // Without a title the bar falls back to the language.
    const untitled = page.getByRole('group', { name: 'ts', exact: true });
    await expect(untitled.locator('[data-highlighted]')).toContainText('brittle');
  });

  test('the copy button copies the code block', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/chapters/02-selectors');

    const block = page.getByRole('group', { name: 'profile.spec.ts' });
    await block.getByRole('button', { name: 'copy code' }).click();
    // The pointer is still over the button, so this also proves hover doesn't hide the success color.
    await expect(block.getByRole('button', { name: 'copied code' })).toHaveCSS('color', 'rgb(63, 185, 80)');
    await expect(page.getByRole('status')).toHaveText('Code copied to clipboard');

    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied.split('\n')).toHaveLength(3);
    expect(copied).toContain("await page.getByLabel('Email address').fill('ada@example.com');");

    await expect(block.getByRole('button', { name: 'copy code' })).toBeVisible();
  });

  test('an unwritten chapter shows a pending placeholder', async ({ page }) => {
    await page.goto('/chapters/16-ecommerce-project');
    await expect(page.getByText("notes for this chapter aren't written yet")).toBeVisible();
  });

  test('table of contents jumps to a section and marks it current', async ({ page, isMobile }) => {
    test.skip(isMobile, 'the table of contents only shows on xl screens');
    // Tall enough that the page bottoms out before this section reaches the top of the viewport.
    await page.setViewportSize({ width: 1280, height: 1000 });
    await page.goto('/chapters/02-selectors');

    const toc = page.getByRole('navigation', { name: 'On this page' });
    await expect(toc.getByRole('link')).toHaveCount(11);

    const link = toc.getByRole('link', { name: 'Fall back deliberately' });
    await link.click();
    await expect(page).toHaveURL(/#fall-back-deliberately$/);
    await expect(page.getByRole('heading', { level: 2, name: 'Fall back deliberately' })).toBeInViewport();
    await expect(link).toHaveAttribute('aria-current', 'location');

    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(link).not.toHaveAttribute('aria-current', 'location');
  });

  test('table of contents is hidden on small screens', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'covers the mobile layout only');
    await page.goto('/chapters/02-selectors');
    await expect(page.getByRole('navigation', { name: 'On this page' })).toBeHidden();
  });

  test('an unwritten chapter has no table of contents', async ({ page }) => {
    await page.goto('/chapters/16-ecommerce-project');
    await expect(page.locator('[data-toc]')).toHaveCount(0);
  });

  test('prev/next links walk the chapters', async ({ page }) => {
    await page.goto('/chapters/01-setup');
    await page
      .getByRole('navigation', { name: 'Previous and next chapter' })
      .getByRole('link', { name: /02 Selectors/ })
      .click();
    await expect(page).toHaveURL(/\/chapters\/02-selectors\/?$/);
  });
});

test('unknown routes show the 404 page', async ({ page }) => {
  const res = await page.goto('/does-not-exist');
  expect(res?.status()).toBe(404);
  await expect(page.getByText('page not found')).toBeVisible();
});
