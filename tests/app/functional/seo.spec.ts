import { test, expect } from '../../../fixtures/pom/test-options';
import { SEO_PAGES } from '../../../test-data/static/app/seo-pages';

for (const { path, title, type } of SEO_PAGES) {
  test(`${path} has complete share metadata`, { tag: '@regression' }, async ({ site, page }) => {
    await site.visit(path);
    await expect(page).toHaveTitle(title);

    const description = await site.meta('name', 'description').getAttribute('content');
    expect(description?.length).toBeGreaterThan(20);
    expect(await site.meta('property', 'og:title').getAttribute('content')).toBe(title);
    expect(await site.meta('property', 'og:description').getAttribute('content')).toBe(description);
    expect(await site.meta('property', 'og:type').getAttribute('content')).toBe(type);
    expect(await site.meta('name', 'twitter:card').getAttribute('content')).toBe('summary_large_image');

    const canonical = await site.canonicalLink.getAttribute('href');
    expect(new URL(canonical!).pathname).toBe(path);
    expect(await site.meta('property', 'og:url').getAttribute('content')).toBe(canonical);
    await expect(site.robotsMeta).toHaveCount(0);
  });
}

test('every page has its own description', { tag: '@regression' }, async ({ site }) => {
  const descriptions = new Set<string | null>();
  for (const { path } of SEO_PAGES) {
    await site.visit(path);
    descriptions.add(await site.meta('name', 'description').getAttribute('content'));
  }
  expect(descriptions.size).toBe(SEO_PAGES.length);
});

test('the share image is a 1200×630 PNG', { tag: '@regression' }, async ({ site, request }) => {
  await site.visit('/');
  const image = await site.meta('property', 'og:image').getAttribute('content');
  expect(image).toMatch(/^https?:\/\//);

  const res = await request.get(new URL(image!).pathname);
  expect(res.ok()).toBe(true);
  expect(res.headers()['content-type']).toContain('image/png');

  const png = await res.body();
  expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1200, 630]);
});

test(
  'the favicon is the terminal mark, with an ICO fallback',
  { tag: '@regression' },
  async ({ site, page, request }) => {
    await site.visit('/');

    const svgHref = await site.svgIconLink.getAttribute('href');
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

    const icoHref = await site.icoIconLink.getAttribute('href');
    const ico = await request.get(icoHref!);
    expect(ico.ok()).toBe(true);

    const body = await ico.body();
    const count = body.readUInt16LE(4);
    const widths = Array.from({ length: count }, (_, i) => body.readUInt8(6 + i * 16));
    expect([body.readUInt16LE(2), widths]).toEqual([1, [16, 32, 48]]);
  },
);

test('the 404 page is not indexed', { tag: '@regression' }, async ({ site }) => {
  await site.visit('/does-not-exist');
  expect(await site.meta('name', 'robots').getAttribute('content')).toBe('noindex');
  await expect(site.canonicalLink).toHaveCount(0);
});

test('robots.txt allows crawling and points at the sitemap', { tag: '@regression' }, async ({ request }) => {
  const res = await request.get('/robots.txt');
  expect(res.ok()).toBe(true);

  const body = await res.text();
  expect(body).toContain('User-agent: *');
  const sitemap = body.match(/^Sitemap: (\S+)$/m)?.[1];
  expect(new URL(sitemap!).pathname).toBe('/sitemap-index.xml');
  expect((await request.get('/sitemap-index.xml')).ok()).toBe(true);
});
