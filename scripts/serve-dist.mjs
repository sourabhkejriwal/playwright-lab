#!/usr/bin/env node
// Minimal foreground static server for dist/, used by Playwright's webServer.
// Why not `astro preview`? Astro 7 auto-backgrounds preview when it detects an AI agent
// (AI_AGENT / CLAUDECODE env), which makes Playwright think the server exited.
// Mirrors GitHub Pages: /path → /path/index.html, unknown routes → 404.html with status 404.

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';

const root = resolve('dist');
const port = Number(process.argv[2] ?? process.env.PORT ?? 4322);
const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.xml': 'application/xml',
  '.txt': 'text/plain',
};

async function resolveFile(pathname) {
  const safe = normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, '');
  const full = join(root, safe);
  if (!full.startsWith(root)) return null;
  for (const candidate of [full, join(full, 'index.html'), `${full}.html`]) {
    try {
      if ((await stat(candidate)).isFile()) return candidate;
    } catch {}
  }
  return null;
}

createServer(async (req, res) => {
  const { pathname } = new URL(req.url ?? '/', 'http://localhost');
  const file = await resolveFile(pathname);
  const target = file ?? join(root, '404.html');
  try {
    const body = await readFile(target);
    res.writeHead(file ? 200 : 404, { 'content-type': types[extname(target)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404).end('Not found');
  }
}).listen(port, () => console.log(`serving dist/ on http://localhost:${port}`));
