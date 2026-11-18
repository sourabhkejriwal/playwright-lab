# Roadmap

One task per session. Work top to bottom unless told otherwise; tick `[x]` when done and committed.
Tasks marked ⇉ are independent of their siblings and can run in parallel sessions (separate worktrees).

## Phase 1 · Foundation ✓

- [x] Scaffold Astro 7 + React + MDX + Tailwind 4 + sitemap (pnpm, Node 24)
- [x] Extract PDF into `source/chapters/NN-slug.txt` (gitignored) via `scripts/extract-chapters.mjs`
- [x] Design tokens (`tokens.css`) and Tailwind mapping for the "Terminal dev" theme
- [x] Base layout: top bar, footer, skip link, `TerminalWindow`, `StatusMark`
- [x] Homepage with animated test-run hero, chapter index, chapter route (MDX or pending placeholder)
- [x] Placeholder pages: playground, flashcards, about, 404
- [x] Sample chapter `02-selectors.mdx` (proves the MDX + Shiki pipeline)
- [x] Playwright: smoke + axe a11y tests, desktop and mobile projects (24 passing)
- [x] GitHub Actions: check → test → deploy to GitHub Pages
- [x] `CLAUDE.md`, `ROADMAP.md`, README

## Phase 2 · Publish and polish the shell

- [x] Create GitHub repo, push, set Pages source to "GitHub Actions", confirm first deploy: live at https://sourabhkejriwal.github.io/playwright-lab/
- [x] Two-column layout: sticky chapter sidebar (desktop), collapsible drawer (mobile)
- [x] Table of contents from headings on chapter pages (right rail on xl screens)
- [x] Code block polish: filename/title bar, copy button, line highlighting (`TerminalWindow` style)
- [x] MDX components: `<Callout type="tip|warn|gotcha">`, `<Kbd>`, `<ApiRef name="…">`
- [x] SEO: Open Graph image (terminal-style), meta per page, `robots.txt`
- [x] Custom favicon (terminal `$_` mark)
- [ ] Optional light theme (override tokens under `[data-theme='light']`) and toggle

## Phase 3 · Progress and learning engine

- [ ] nanostores progress store in `localStorage`: chapter read state, flashcard state, quiz scores
- [ ] Hero and chapter list reflect the user's own progress (read ✓ vs content-ready)
- [ ] "Mark chapter as done" control at the end of each chapter
- [ ] Data format for flashcards and quizzes (content collection, Zod schema) per chapter

## Phase 4 · Interactive features (each ⇉ independent)

- [ ] ⇉ **Locator playground**: sample page in an iframe, CodeMirror input, locator engine for
      `getByRole/Text/Label/Placeholder/TestId`, CSS, XPath, chaining, `filter`, `nth`; highlights matches,
      strict-mode violation message, suggestion of a better locator; preset challenges
- [ ] ⇉ **Flashcards**: seed from `../pdf/advanced-selectors-interview-questions.md`; reveal, again/good/easy
      with spaced repetition; filter by chapter
- [ ] ⇉ **Chapter quizzes**: 5 multiple-choice questions per chapter, explanations, score saved
- [ ] ⇉ **Config generator**: pick browsers, devices, retries, reporters, trace → `playwright.config.ts`
- [ ] ⇉ **Explainer: auto-waiting timeline** (actionability checks, step through)
- [ ] ⇉ **Explainer: fixture graph** (setup/teardown order, scopes)
- [ ] ⇉ **Explainer: parallel and shard simulator** (workers/shards sliders → runtime)
- [ ] ⇉ **"Spot the flaky test"** challenges
- [ ] ⇉ **CI pipeline builder** → GitHub Actions YAML
- [ ] ⌘K search with Pagefind

## Phase 5 · Chapter notes (each ⇉ independent; source in `source/chapters/`)

- [ ] ⇉ 01 Quick setup refresher
- [~] ⇉ 02 Advanced selectors: sample written; still needs dialogs, iframes, shadow DOM, custom waits
- [ ] ⇉ 03 Cross-browser testing
- [ ] ⇉ 04 AI-powered test generation
- [ ] ⇉ 05 Fixtures
- [ ] ⇉ 06 Parallelization and performance
- [ ] ⇉ 07 CI/CD pipelines
- [ ] ⇉ 08 Headless testing and debugging
- [ ] ⇉ 09 Accessibility testing with axe-core
- [ ] ⇉ 10 Visual regression testing
- [ ] ⇉ 11 Mobile web
- [ ] ⇉ 12 Forms
- [ ] ⇉ 13 File uploads and downloads
- [ ] ⇉ 14 Security and authentication
- [ ] ⇉ 15 Maintainability and Page Object Model
- [ ] ⇉ 16 Real-world e-commerce project

## Phase 6 · Testing the site (the portfolio story)

- [ ] Page Object Model for the site's own tests (`tests/pages/*`)
- [ ] Visual regression snapshots for key pages (desktop and mobile), run in CI on Linux
- [ ] Playground behaviour tests (locator → expected highlights)
- [ ] Cross-browser projects (Firefox, WebKit) in CI
- [ ] README: architecture, test strategy, badges, screenshots, live link

## Notes and decisions log

- 2026-11-18: Chose design A "Terminal dev"; Astro over Next.js (static content, GitHub Pages).
- 2026-11-18: Tests serve `dist/` via `scripts/serve-dist.mjs` (Astro 7 backgrounds preview under AI agents).
- 2026-11-18: Favicon `$_` is drawn with SVG paths (no font dependency) on a dark tile so it reads on light and dark
  browser tabs. `favicon.ico` (16, 32, 48) is generated from the SVG and linked explicitly, because browsers only
  auto-discover `/favicon.ico` at the domain root and Pages serves the site under `/playwright-lab/`.
