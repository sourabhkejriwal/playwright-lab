#!/usr/bin/env node
// Splits the reference PDF into one plain-text file per chapter under source/chapters/.
// Needs `pdftotext` (poppler). Output is gitignored: it's reference material, not site content.
//
// Usage: node scripts/extract-chapters.mjs [path/to/reference.pdf]
// With no argument, uses the only .pdf in ../pdf/ (or $REFERENCE_PDF).

import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

function findPdf() {
  const explicit = process.argv[2] ?? process.env.REFERENCE_PDF;
  if (explicit) return resolve(explicit);
  const dir = resolve('../pdf');
  const pdfs = readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.pdf'));
  if (pdfs.length !== 1) {
    throw new Error(`Expected exactly one PDF in ${dir}, found ${pdfs.length}. Pass a path instead.`);
  }
  return resolve(dir, pdfs[0]);
}

const pdf = findPdf();
const outDir = resolve('source/chapters');

// [number, slug, title, firstPdfPage]. Each chapter ends the page before the next starts.
const chapters = [
  [1, 'setup', 'Quick Setup Refresher', 20],
  [2, 'selectors', 'Advanced Selectors and Handling Dynamic Content', 46],
  [3, 'cross-browser', 'Browser-Agnostic Testing Across Chromium, Firefox, and WebKit', 76],
  [4, 'ai-test-generation', 'AI-Powered Test Generation', 107],
  [5, 'fixtures', 'Crafting Scalable Tests with the Fixture System', 134],
  [6, 'parallelization', 'Test Parallelization and Performance Optimization', 157],
  [7, 'ci-cd', 'Integrating Workflows with CI/CD Pipelines', 193],
  [8, 'headless-debugging', 'Headless Testing and Debugging', 225],
  [9, 'accessibility', 'Accessibility Testing with Playwright and Axe-core', 250],
  [10, 'visual-regression', 'Setting Up Visual Regression Testing', 277],
  [11, 'mobile', 'Testing Mobile Web Experiences', 301],
  [12, 'forms', 'Testing Forms', 335],
  [13, 'files', 'Handling File Uploads and Downloads', 362],
  [14, 'security-auth', 'Security and Authentication', 383],
  [15, 'maintainability', 'Best Practices for Test Maintainability', 406],
  [16, 'ecommerce-project', 'Real-World Project – Testing an E-commerce Website', 429],
];
const LAST_CONTENT_PAGE = 462;

mkdirSync(outDir, { recursive: true });

const index = [];
chapters.forEach(([num, slug, title, first], i) => {
  const last = i + 1 < chapters.length ? chapters[i + 1][3] - 1 : LAST_CONTENT_PAGE;
  const text = execFileSync('pdftotext', ['-layout', '-f', String(first), '-l', String(last), pdf, '-'], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  const file = `${String(num).padStart(2, '0')}-${slug}.txt`;
  writeFileSync(resolve(outDir, file), `# Chapter ${num}: ${title}\n# PDF pages ${first}-${last}\n\n${text}`);
  index.push(`${file}\tpp. ${first}-${last}\t${title}`);
  console.log(`✓ ${file} (pp. ${first}-${last})`);
});

writeFileSync(resolve(outDir, 'INDEX.tsv'), index.join('\n') + '\n');
