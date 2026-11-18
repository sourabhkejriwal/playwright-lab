// Renders the 1200×630 social preview to public/og-image.png with Playwright's Chromium.
// The PNG is committed, so this only needs re-running when the design changes: pnpm og:image
import { readFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const root = new URL('../', import.meta.url);
const tokens = await readFile(new URL('src/styles/tokens.css', root), 'utf8');
const font = await readFile(
  new URL(
    'node_modules/@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2',
    root,
  ),
);

const html = `<!doctype html>
<meta charset="utf-8" />
<style>
  ${tokens}
  @font-face {
    font-family: 'JetBrains Mono Variable';
    src: url(data:font/woff2;base64,${font.toString('base64')}) format('woff2');
    font-weight: 100 800;
  }
  * { box-sizing: border-box; margin: 0; }
  body {
    width: 1200px;
    height: 630px;
    padding: 56px;
    background: var(--term-bg);
    color: var(--term-text);
    font-family: var(--font-mono);
  }
  .window {
    height: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    border: 2px solid var(--term-line-strong);
    border-radius: 12px;
    background: var(--term-surface);
  }
  .bar {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 18px 24px;
    border-bottom: 2px solid var(--term-line);
    background: var(--term-raised);
    color: var(--term-dim);
    font-size: 22px;
  }
  .dot { width: 18px; height: 18px; border-radius: 50%; }
  .bar span:last-child { margin-left: 12px; }
  .body { flex: 1; display: flex; flex-direction: column; justify-content: center; padding: 0 56px; }
  .cmd { color: var(--term-muted); font-size: 28px; }
  .cmd b { color: var(--term-pass); font-weight: 500; }
  h1 { margin-top: 20px; color: var(--term-bright); font-size: 84px; font-weight: 700; letter-spacing: -2px; }
  p.tag { margin-top: 16px; font-size: 36px; }
  p.tag em { color: var(--term-pass); font-style: normal; }
  p.result { margin-top: 40px; color: var(--term-pass); font-size: 28px; }
  p.result span { color: var(--term-dim); }
</style>
<div class="window">
  <div class="bar">
    <span class="dot" style="background: var(--term-fail)"></span>
    <span class="dot" style="background: var(--term-pending)"></span>
    <span class="dot" style="background: var(--term-pass)"></span>
    <span>zsh</span>
  </div>
  <div class="body">
    <p class="cmd"><b>$</b> npx playwright test</p>
    <h1>playwright-lab</h1>
    <p class="tag">Learn Playwright by <em>running it</em>.</p>
    <p class="result">16 chapters <span>·</span> playground <span>·</span> drills</p>
  </div>
</div>`;

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  await page.setContent(html);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: new URL('public/og-image.png', root).pathname });
} finally {
  await browser.close();
}
