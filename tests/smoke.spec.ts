import { test, expect } from './pages/fixtures';

test.describe('home', () => {
  test('shows the hero and the chapter test run', async ({ home, page }) => {
    await home.goto();
    await expect(page).toHaveTitle('playwright-lab');
    await expect(home.h1).toContainText('Learn Playwright by');

    await expect(home.chapterRun.getByRole('listitem')).toHaveCount(16);
    await expect(home.runLink('Chapter 2, Selectors: ready')).toBeVisible();
    await expect(home.nextUp).toContainText('ch01');
  });

  test('chapter sidebar lists every chapter and marks the current one', async ({
    chapter,
    page,
    isMobile,
  }) => {
    await chapter.goto('02-selectors');
    await chapter.sidebar.open(isMobile);

    await expect(chapter.sidebar.items).toHaveCount(16 + 8); // chapters + practice links
    await expect(chapter.sidebar.link(/Selectors/)).toHaveAttribute('aria-current', 'page');

    await chapter.sidebar.link(/Fixtures/).click();
    await expect(page).toHaveURL(/\/chapters\/05-fixtures\/?$/);
  });

  test('main navigation reaches every section', async ({ home }) => {
    await home.goto();
    for (const [label, heading] of [
      ['chapters', 'Chapters'],
      ['playground', 'Locator playground'],
      ['flashcards', 'Flashcards'],
      ['config', 'Config generator'],
      ['about', 'About'],
    ]) {
      await home.topBar.navLink(label).click();
      await expect(home.h1Named(heading)).toBeVisible();
      await expect(home.topBar.navLink(`./${label}`)).toHaveAttribute('aria-current', 'page');
    }
  });
});

test.describe('chapters', () => {
  test('a written chapter renders its MDX content', async ({ chapter }) => {
    await chapter.goto('02-selectors');
    await expect(chapter.h1).toContainText('Advanced selectors');
    await expect(chapter.h2('Start with user-facing locators')).toBeVisible();
    await expect(chapter.firstCodeBlock).toContainText('getByRole');
  });

  const writtenChapters = [
    {
      name: 'setup',
      slug: '01-setup',
      title: 'Quick setup refresher',
      section: 'Configure the run',
      code: ['playwright.config.ts', 'defineConfig'],
    },
    {
      name: 'cross-browser',
      slug: '03-cross-browser',
      title: 'Cross-browser testing',
      section: 'One suite, many projects',
      code: ['menu.spec.ts', 'isMobile'],
    },
    {
      name: 'AI test generation',
      slug: '04-ai-test-generation',
      title: 'AI-powered test generation',
      section: 'Review what comes back',
      code: ['refresh.spec.ts', 'toPass'],
    },
    {
      name: 'fixtures',
      slug: '05-fixtures',
      title: 'Scalable tests with fixtures',
      section: 'Scope and life cycle',
      code: ['console-guard.fixture.ts', 'pageerror'],
      link: ['fixture graph explainer', /\/fixture-graph\/?$/],
    },
    {
      name: 'parallelization',
      slug: '06-parallelization',
      title: 'Parallelization and performance',
      section: 'Shard across machines',
      code: ['lcp.perf.ts', 'PerformanceObserver'],
      link: ['parallel simulator', /\/parallel\/?$/],
    },
    {
      name: 'CI/CD',
      slug: '07-ci-cd',
      title: 'CI/CD pipelines',
      section: 'A first workflow',
      code: ['Dockerfile', 'mcr.microsoft.com/playwright'],
      link: ['CI pipeline builder', /\/ci\/?$/],
    },
    {
      name: 'debugging',
      slug: '08-headless-debugging',
      title: 'Headless testing and debugging',
      section: 'Playwright Inspector',
      code: ['login.spec.ts', '#email-input'],
      link: ['auto-waiting timeline', /\/auto-waiting\/?$/],
    },
    {
      name: 'accessibility',
      slug: '09-accessibility',
      title: 'Accessibility testing with axe-core',
      section: 'Choose axe tags carefully',
      code: ['tests/fixtures.ts', 'makeAxeBuilder'],
      link: ['locator playground', /\/playground\/?$/],
    },
    {
      name: 'visual regression',
      slug: '10-visual-regression',
      title: 'Visual regression testing',
      section: 'Set tolerances you can defend',
      code: ['tests/orders.spec.ts', 'setFixedTime'],
      link: ['Chapter 7', /\/chapters\/07-ci-cd\/?$/],
    },
    {
      name: 'mobile',
      slug: '11-mobile',
      title: 'Testing mobile web experiences',
      section: 'Touch input',
      code: ['tests/stores.spec.ts', 'setGeolocation'],
      link: ['chapter 10', /\/chapters\/10-visual-regression\/?$/],
    },
    {
      name: 'forms',
      slug: '12-forms',
      title: 'Testing forms',
      section: 'Checkboxes and radio buttons',
      code: ['tests/shipping.spec.ts', 'getByRole'],
      link: ['Chapter 9', /\/chapters\/09-accessibility\/?$/],
    },
    {
      name: 'files',
      slug: '13-files',
      title: 'File uploads and downloads',
      section: 'When downloads fail',
      code: ['tests/report.spec.ts', 'waitForEvent'],
      link: ['Chapter 12', /\/chapters\/12-forms\/?$/],
    },
    {
      name: 'security',
      slug: '14-security-auth',
      title: 'Security and authentication',
      section: 'Testing logout properly',
      code: ['tests/logout.spec.ts', 'extraHTTPHeaders'],
      link: ['Chapter 5', /\/chapters\/05-fixtures\/?$/],
    },
    {
      name: 'maintainability',
      slug: '15-maintainability',
      title: 'Best practices for maintainability',
      section: 'Managing test data',
      code: ['tests/pages/todo-page.ts', 'box: true'],
      link: ['Chapter 5', /\/chapters\/05-fixtures\/?$/],
    },
    {
      name: 'e-commerce',
      slug: '16-ecommerce-project',
      title: 'Real-world project: e-commerce',
      section: 'Keep carts apart',
      code: ['tests/auth.setup.ts', 'storageState'],
      link: ['Chapter 15', /\/chapters\/15-maintainability\/?$/],
    },
  ] satisfies {
    name: string;
    slug: string;
    title: string;
    section: string;
    code: [string, string];
    link?: [string, RegExp];
  }[];

  for (const written of writtenChapters) {
    test(`the ${written.name} chapter renders its notes and quiz`, async ({ chapter }) => {
      await chapter.goto(written.slug);
      await expect(chapter.h1).toContainText(written.title);
      await expect(chapter.h2(written.section)).toBeVisible();
      const [file, snippet] = written.code;
      await expect(chapter.codeBlock(file)).toContainText(snippet);
      if (written.link) {
        const [name, href] = written.link;
        await expect(chapter.notesLink(name)).toHaveAttribute('href', href);
      }
      await expect(chapter.quiz.region).toBeAttached();
    });
  }

  for (const slug of [
    '10-visual-regression',
    '12-forms',
    '13-files',
    '14-security-auth',
    '15-maintainability',
    '16-ecommerce-project',
  ]) {
    test(`chapter ${slug} fits a 375px screen`, async ({ chapter, page }) => {
      await page.setViewportSize({ width: 375, height: 800 });
      await chapter.goto(slug);
      expect(await chapter.horizontalOverflow()).toBe(0);
    });
  }

  test('code blocks show a title bar and highlighted lines', async ({ chapter }) => {
    await chapter.goto('02-selectors');

    const titled = chapter.codeBlock('profile.spec.ts');
    await expect(titled).toContainText('profile.spec.ts');
    await expect(chapter.highlightedLines(titled)).toHaveCount(1);
    await expect(chapter.highlightedLines(titled)).toContainText("getByRole('button'");

    // Without a title the bar falls back to the language.
    const untitled = chapter.codeBlock('ts', { exact: true });
    await expect(chapter.highlightedLines(untitled)).toContainText('brittle');
  });

  test('the copy button copies the code block', async ({ chapter, page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await chapter.goto('02-selectors');

    const block = chapter.codeBlock('profile.spec.ts');
    await chapter.copyButton(block).click();
    // The pointer is still over the button, so this also proves hover doesn't hide the success color.
    await expect(chapter.copiedButton(block)).toHaveCSS('color', 'rgb(63, 185, 80)');
    await expect(chapter.status).toHaveText('Code copied to clipboard');

    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied.split('\n')).toHaveLength(3);
    expect(copied).toContain("await page.getByLabel('Email address').fill('ada@example.com');");

    await expect(chapter.copyButton(block)).toBeVisible();
  });

  test('table of contents jumps to a section and marks it current', async ({ chapter, page, isMobile }) => {
    test.skip(isMobile, 'the table of contents only shows on xl screens');
    // Tall enough that the page bottoms out before this section reaches the top of the viewport.
    await page.setViewportSize({ width: 1280, height: 1000 });
    await chapter.goto('02-selectors');

    await expect(chapter.toc.getByRole('link')).toHaveCount(11);

    const link = chapter.tocLink('Fall back deliberately');
    await link.click();
    await expect(page).toHaveURL(/#fall-back-deliberately$/);
    await expect(chapter.h2('Fall back deliberately')).toBeInViewport();
    await expect(link).toHaveAttribute('aria-current', 'location');

    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(link).not.toHaveAttribute('aria-current', 'location');
  });

  test('table of contents is hidden on small screens', async ({ chapter, isMobile }) => {
    test.skip(!isMobile, 'covers the mobile layout only');
    await chapter.goto('02-selectors');
    await expect(chapter.toc).toBeHidden();
  });

  test('prev/next links walk the chapters', async ({ chapter, page }) => {
    await chapter.goto('01-setup');
    await chapter.prevNext.getByRole('link', { name: /02 Selectors/ }).click();
    await expect(page).toHaveURL(/\/chapters\/02-selectors\/?$/);
  });
});

test('unknown routes show the 404 page', async ({ site, page }) => {
  const res = await site.visit('/does-not-exist');
  expect(res?.status()).toBe(404);
  await expect(page.getByText('page not found')).toBeVisible();
});
