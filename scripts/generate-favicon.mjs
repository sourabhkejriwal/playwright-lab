// Renders public/favicon.svg into a multi-size public/favicon.ico with Playwright's Chromium.
// The ICO is committed, so this only needs re-running when the SVG changes: pnpm favicon
import { readFile, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const root = new URL('../', import.meta.url);
const svg = await readFile(new URL('public/favicon.svg', root), 'utf8');
const sizes = [16, 32, 48];

const browser = await chromium.launch();
const images = [];
try {
  for (const size of sizes) {
    const page = await browser.newPage({ viewport: { width: size, height: size } });
    await page.setContent(
      `<!doctype html><style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`,
    );
    images.push(await page.screenshot({ omitBackground: true }));
    await page.close();
  }
} finally {
  await browser.close();
}

// ICO layout: 6-byte header, a 16-byte directory entry per image, then the PNG data.
const header = Buffer.alloc(6);
header.writeUInt16LE(1, 2); // resource type: icon
header.writeUInt16LE(images.length, 4);

let offset = header.length + 16 * images.length;
const entries = images.map((png, i) => {
  const entry = Buffer.alloc(16);
  entry.writeUInt8(sizes[i], 0); // width
  entry.writeUInt8(sizes[i], 1); // height
  entry.writeUInt16LE(1, 4); // color planes
  entry.writeUInt16LE(32, 6); // bits per pixel
  entry.writeUInt32LE(png.length, 8);
  entry.writeUInt32LE(offset, 12);
  offset += png.length;
  return entry;
});

await writeFile(new URL('public/favicon.ico', root), Buffer.concat([header, ...entries, ...images]));
