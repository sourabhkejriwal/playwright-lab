# playwright-lab

Interactive study notes, a locator playground, and drills for end-to-end testing with
[Playwright](https://playwright.dev). It's a static site, and it's tested with Playwright itself.

> **Live site:** https://sourabhkejriwal.github.io/playwright-lab/

[![Test and deploy](https://github.com/sourabhkejriwal/playwright-lab/actions/workflows/deploy.yml/badge.svg)](https://github.com/sourabhkejriwal/playwright-lab/actions/workflows/deploy.yml)

## Features

- **Chapter notes:** 16 chapters, from setup and selectors to CI, accessibility, visual regression, and a
  real-world e-commerce suite, shown as a Playwright-style test run.
- **Locator playground** _(in progress)_: type a locator and see what it matches.
- **Flashcards and quizzes** _(in progress)_: interview-style drills with progress saved locally.

## Tech

Astro 7 · React 19 islands · MDX · Tailwind CSS 4 · Shiki · Playwright · axe-core · GitHub Actions ·
GitHub Pages

## Testing

Every push runs type-checking, formatting, and the Playwright suite (end-to-end and accessibility checks
on desktop and mobile viewports) against the production build. `main` deploys only when everything passes.

```bash
pnpm install
pnpm exec playwright install chromium
pnpm test
```

## Development

```bash
pnpm dev        # http://localhost:4321
pnpm build      # static output in dist/
pnpm check      # astro check
```
