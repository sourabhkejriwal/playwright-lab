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
- [x] Optional light theme (override tokens under `[data-theme='light']`) and toggle

## Phase 3 · Progress and learning engine

- [x] nanostores progress store in `localStorage`: chapter read state, flashcard state, quiz scores
- [x] Hero and chapter list reflect the user's own progress (read ✓ vs content-ready)
- [x] "Mark chapter as done" control at the end of each chapter
- [x] Data format for flashcards and quizzes (content collection, Zod schema) per chapter

## Phase 4 · Interactive features (each ⇉ independent)

- [x] ⇉ **Locator playground**: sample page in an iframe, CodeMirror input, locator engine for
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
- 2026-11-18: Light theme is opt-in. Dark stays the default whatever the OS prefers, because the terminal look is the
  site's identity; the choice is saved in `localStorage` (`playwright-lab:theme`). Without JavaScript the toggle is hidden.
- 2026-11-18: Progress lives in `src/stores/progress.ts` under one versioned key (`playwright-lab:progress`), written by
  hand on plain nanostores atoms instead of adding `@nanostores/persistent`, because saves must re-read storage to merge
  other tabs and damaged entries must be dropped one by one. Chapters and quizzes are keyed by chapter slug, flashcards by
  card id. The store only records flashcard schedules; the spaced-repetition maths belongs to the flashcards task.
- 2026-11-18: Chapters have three visible states: ✓ read (this visitor), ● ready (notes written, unread), ◌ pending (not
  written). ✓ no longer means "written". Pages ship the unread state and one small script (`ChapterProgressSync`) applies
  saved progress, instead of a React island for each of the many marks. "next up" now points at the first unread written
  chapter, because sending readers to an unwritten placeholder is a dead end. The sidebar counter is chapters read / 16.
- 2026-11-18: "Mark chapter as done" is one toggle button (`aria-pressed`, stable name) on written chapters only, so a
  visitor can undo it by clicking again. Chapters are marked read only by this button, never by scrolling. It is a small
  `.astro` script rather than a React island, and it stays hidden until that script runs, so it never appears dead.
- 2026-11-18: Flashcards and quizzes are two JSON content collections with one file per chapter, named like the chapter's
  MDX file, so a chapter's data loads with `getEntry('quizzes', '02-selectors')`. Card ids are written in full as
  `<chapter-slug>/<name>` and are the progress keys, which keeps them unique across chapters. Quiz questions have exactly
  one right answer, stored as an index into `options`; the quiz island does any shuffling. The schema requires at least
  one question rather than exactly 5, because 5 is an authoring target and saved scores already handle quizzes changing
  length. Chapter 2 has sample data. `tests/study-data.spec.ts` checks file names, which a Zod schema can't see.
- 2026-11-18: The locator playground parses input with its own reader (`src/lib/locator/parser.ts`) and never evaluates it,
  because a static site can't run Playwright and visitor input shouldn't be executed. `tests/locator-engine.spec.ts` replays
  each expression on real Playwright and requires the same elements in the same order, so the engine can't drift unnoticed;
  `esbuild` is a dev dependency only to bundle the engine for that test. The sample page is an iframe `srcdoc` that embeds
  `tokens.css`, so it needs no extra route and follows the site's themes. Its sandbox includes `allow-scripts` because axe
  hangs without it, which logs a harmless browser warning; the page's content is our own static HTML. Suggestions rank role,
  label, placeholder, alt text, text, then test id. Solved challenges last for the visit only, to keep the saved progress
  format unchanged. Follow-up: save solved challenges if visitors ask for it. Watch for flakiness: "flags hidden matches"
  failed once on mobile in a full run, its error wasn't captured, and it then passed 300 repeats under load.
