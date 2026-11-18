/**
 * Master list of chapters. Order, slugs, and titles live here; written content lives in
 * src/content/chapters/<NN>-<slug>.mdx. A chapter counts as "ready" once its MDX exists.
 * `source` points at the extracted reference text (gitignored) for authoring sessions.
 */
export interface ChapterMeta {
  num: number;
  slug: string;
  title: string;
  short: string; // nav / reporter label
  blurb: string;
  source: string;
}

const raw: [number, string, string, string, string][] = [
  [1, 'setup', 'Quick setup refresher', 'Setup', 'Install, configure, and run your first Playwright tests.'],
  [
    2,
    'selectors',
    'Advanced selectors and dynamic content',
    'Selectors',
    'getBy* locators, fallbacks, auto-waiting, dialogs, iframes, and shadow DOM.',
  ],
  [
    3,
    'cross-browser',
    'Cross-browser testing',
    'Cross-browser',
    'One suite across Chromium, Firefox, and WebKit.',
  ],
  [
    4,
    'ai-test-generation',
    'AI-powered test generation',
    'AI tests',
    'Using codegen and AI tools to draft and refine tests.',
  ],
  [
    5,
    'fixtures',
    'Scalable tests with fixtures',
    'Fixtures',
    'Built-in and custom fixtures, scopes, and composition.',
  ],
  [
    6,
    'parallelization',
    'Parallelization and performance',
    'Parallel',
    'Workers, sharding, and keeping suites fast.',
  ],
  [7, 'ci-cd', 'CI/CD pipelines', 'CI/CD', 'Running Playwright in GitHub Actions and other pipelines.'],
  [
    8,
    'headless-debugging',
    'Headless testing and debugging',
    'Debugging',
    'Headless runs, traces, UI mode, and the inspector.',
  ],
  [
    9,
    'accessibility',
    'Accessibility testing with axe-core',
    'Accessibility',
    'Automated a11y scans and what they miss.',
  ],
  [
    10,
    'visual-regression',
    'Visual regression testing',
    'Visual',
    'Screenshot comparisons, thresholds, and masking.',
  ],
  [
    11,
    'mobile',
    'Testing mobile web experiences',
    'Mobile',
    'Device emulation, touch, viewports, and geolocation.',
  ],
  [12, 'forms', 'Testing forms', 'Forms', 'Inputs, validation, selects, date pickers, and more.'],
  [
    13,
    'files',
    'File uploads and downloads',
    'Files',
    'setInputFiles, download events, and verifying files.',
  ],
  [14, 'security-auth', 'Security and authentication', 'Auth', 'Storage state, roles, and handling secrets.'],
  [
    15,
    'maintainability',
    'Best practices for maintainability',
    'Maintainability',
    'Structure, Page Object Model, and readable tests.',
  ],
  [
    16,
    'ecommerce-project',
    'Real-world project: e-commerce',
    'E-commerce',
    'Putting it all together on a shop test suite.',
  ],
];

export const chapters: ChapterMeta[] = raw.map(([num, slug, title, short, blurb]) => ({
  num,
  slug,
  title,
  short,
  blurb,
  source: `source/chapters/${String(num).padStart(2, '0')}-${slug}.txt`,
}));

export const pad = (n: number) => String(n).padStart(2, '0');
