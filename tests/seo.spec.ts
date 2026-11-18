import { test, expect, type Page } from '@playwright/test';

const meta = (page: Page, attr: 'name' | 'property', key: string) =>
  page.locator(`head meta[${attr}="${key}"]`).getAttribute('content');

const pages = [
  { path: '/', title: 'playwright-lab', type: 'website' },
  { path: '/chapters/', title: 'chapters · playwright-lab', type: 'website' },
  {
    path: '/chapters/02-selectors/',
    title: 'ch02 Advanced selectors and dynamic content · playwright-lab',
    type: 'article',
  },
  {
    path: '/chapters/08-headless-debugging/',
    title: 'ch08 Headless testing and debugging · playwright-lab',
    type: 'website',
  },
  { path: '/playground/', title: 'playground · playwright-lab', type: 'website' },
  { path: '/flashcards/', title: 'flashcards · playwright-lab', type: 'website' },
  { path: '/about/', title: 'about · playwright-lab', type: 'website' },
];

for (const { path, title, type } of pages) {
  test(`${path} has complete share metadata`, async ({ page }) => {
    await page.goto(path);
    await expect(page).toHaveTitle(title);

    const description = await meta(page, 'name', 'description');
    expect(description?.length).toBeGreaterThan(20);
    expect(await meta(page, 'property', 'og:title')).toBe(title);
    expect(await meta(page, 'property', 'og:description')).toBe(description);
    expect(await meta(page, 'property', 'og:type')).toBe(type);
    expect(await meta(page, 'name', 'twitter:card')).toBe('summary_large_image');

    const canonical = await page.locator('head link[rel="canonical"]').getAttribute('href');
    expect(new URL(canonical!).pathname).toBe(path);
    expect(await meta(page, 'property', 'og:url')).toBe(canonical);
    await expect(page.locator('head meta[name="robots"]')).toHaveCount(0);
  });
}

test('every page has its own description', async ({ page }) => {
  const descriptions = new Set<string | null>();
  for (const { path } of pages) {
    await page.goto(path);
    descriptions.add(await meta(page, 'name', 'description'));
  }
  expect(descriptions.size).toBe(pages.length);
});

test('the share image is a 1200×630 PNG', async ({ page, request }) => {
  await page.goto('/');
  const image = await meta(page, 'property', 'og:image');
  expect(image).toMatch(/^https?:\/\//);

  const res = await request.get(new URL(image!).pathname);
  expect(res.ok()).toBe(true);
  expect(res.headers()['content-type']).toContain('image/png');

  const png = await res.body();
  expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1200, 630]);
});

test('the favicon is the terminal mark, with an ICO fallback', async ({ page, request }) => {
  await page.goto('/');

  const svgHref = await page.locator('head link[rel="icon"][type="image/svg+xml"]').getAttribute('href');
  const svg = await request.get(svgHref!);
  expect(svg.ok()).toBe(true);
  expect(svg.headers()['content-type']).toContain('image/svg+xml');
  expect(await svg.text()).toContain('<title>playwright-lab</title>');
  // Loaded as an image, SVG is parsed as strict XML: decode() rejects if the file is malformed.
  await page.evaluate((href) => {
    const image = new Image();
    image.src = href;
    return image.decode();
  }, svgHref!);

  const icoHref = await page.locator('head link[rel="icon"][sizes="48x48"]').getAttribute('href');
  const ico = await request.get(icoHref!);
  expect(ico.ok()).toBe(true);

  const body = await ico.body();
  const count = body.readUInt16LE(4);
  const widths = Array.from({ length: count }, (_, i) => body.readUInt8(6 + i * 16));
  expect([body.readUInt16LE(2), widths]).toEqual([1, [16, 32, 48]]);
});

test('the 404 page is not indexed', async ({ page }) => {
  await page.goto('/does-not-exist');
  expect(await meta(page, 'name', 'robots')).toBe('noindex');
  await expect(page.locator('head link[rel="canonical"]')).toHaveCount(0);
});

test('robots.txt allows crawling and points at the sitemap', async ({ request }) => {
  const res = await request.get('/robots.txt');
  expect(res.ok()).toBe(true);

  const body = await res.text();
  expect(body).toContain('User-agent: *');
  const sitemap = body.match(/^Sitemap: (\S+)$/m)?.[1];
  expect(new URL(sitemap!).pathname).toBe('/sitemap-index.xml');
  expect((await request.get('/sitemap-index.xml')).ok()).toBe(true);
});
