// Captures the README screenshots from the production build into docs/screenshots/.
// The PNGs are committed, so this only needs re-running when the design changes: pnpm screenshots
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { chromium, devices } from '@playwright/test';

const PORT = 4323;
const baseURL = `http://localhost:${PORT}`;
const outDir = new URL('../docs/screenshots/', import.meta.url);

const desktop = { viewport: { width: 1280, height: 800 } };
const mobile = { ...devices['Pixel 7'] };
delete mobile.defaultBrowserType;

/** Scrolls an island into view, which is also what makes a `client:visible` island hydrate. */
async function showIsland(page, control) {
  await control.scrollIntoViewIfNeeded();
  await control.waitFor();
}

const shots = [
  { name: 'home', path: '/', context: desktop },
  { name: 'chapter', path: '/chapters/02-selectors', context: desktop },
  {
    name: 'playground',
    path: '/playground',
    context: desktop,
    async prepare(page) {
      const editor = page.getByRole('textbox', { name: 'locator', exact: true });
      await page.locator('.cm-content').waitFor();
      await editor.selectText();
      // Two frames let CodeMirror read the selection, as PlaygroundPage.enterLocator() explains.
      await page.evaluate(
        () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))),
      );
      await page.keyboard.insertText("page.getByRole('button', { name: 'Sign in' })");
      await page
        .frameLocator('iframe[title="Sample page for trying locators"]')
        .locator('.pl-box')
        .first()
        .waitFor();
    },
  },
  {
    name: 'fixture-graph',
    path: '/fixture-graph',
    context: desktop,
    async prepare(page) {
      const next = page.getByRole('button', { name: 'next', exact: true });
      await showIsland(page, next);
      for (let step = 0; step < 3; step += 1) await next.click();
      // Line the run order and the graph up just below the sticky top bar.
      await page.getByText('# run order').evaluate((heading) => {
        const top = heading.getBoundingClientRect().top + window.scrollY - 76;
        window.scrollTo({ top, behavior: 'instant' });
      });
    },
  },
  {
    name: 'parallel',
    path: '/parallel',
    context: desktop,
    async prepare(page) {
      await showIsland(page, page.getByRole('slider').first());
    },
  },
  { name: 'mobile', path: '/', context: mobile },
];

const server = spawn(process.execPath, ['scripts/serve-dist.mjs', String(PORT)], { stdio: 'ignore' });
const browser = await chromium.launch();
try {
  await mkdir(outDir, { recursive: true });
  for (let attempt = 0; ; attempt += 1) {
    const up = await fetch(baseURL).then(
      (response) => response.ok,
      () => false,
    );
    if (up) break;
    if (attempt === 50) throw new Error(`Nothing is serving ${baseURL}. Run pnpm build first.`);
    await new Promise((done) => setTimeout(done, 100));
  }

  for (const { name, path, context: options, prepare } of shots) {
    const context = await browser.newContext({ ...options, baseURL, reducedMotion: 'reduce' });
    const page = await context.newPage();
    await page.goto(path);
    await page.evaluate(() => document.fonts.ready);
    await prepare?.(page);
    await page.screenshot({ path: new URL(`${name}.png`, outDir).pathname });
    await context.close();
    console.log(`docs/screenshots/${name}.png`);
  }
} finally {
  await browser.close();
  server.kill();
}
