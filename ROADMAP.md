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
- [x] ⇉ **Flashcards**: seed from `../pdf/advanced-selectors-interview-questions.md`; reveal, again/good/easy
      with spaced repetition; filter by chapter
- [x] ⇉ **Chapter quizzes**: 5 multiple-choice questions per chapter, explanations, score saved
- [x] ⇉ **Config generator**: pick browsers, devices, retries, reporters, trace → `playwright.config.ts`
- [x] ⇉ **Explainer: auto-waiting timeline** (actionability checks, step through)
- [x] ⇉ **Explainer: fixture graph** (setup/teardown order, scopes)
- [x] ⇉ **Explainer: parallel and shard simulator** (workers/shards sliders → runtime)
- [x] ⇉ **"Spot the flaky test"** challenges
- [x] ⇉ **CI pipeline builder** → GitHub Actions YAML
- [x] ⌘K search with Pagefind

## Phase 5 · Chapter notes (each ⇉ independent; source in `source/chapters/`)

- [x] ⇉ 01 Quick setup refresher
- [x] ⇉ 02 Advanced selectors
- [x] ⇉ 03 Cross-browser testing
- [x] ⇉ 04 AI-powered test generation
- [x] ⇉ 05 Fixtures
- [x] ⇉ 06 Parallelization and performance
- [x] ⇉ 07 CI/CD pipelines
- [x] ⇉ 08 Headless testing and debugging
- [x] ⇉ 09 Accessibility testing with axe-core
- [x] ⇉ 10 Visual regression testing
- [x] ⇉ 11 Mobile web
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
- [x] Add `wcag21a` and `wcag22aa` to `tests/a11y.spec.ts`, and fix the 16 home page links that fail `target-size` (found while writing chapter 9)

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
- 2026-11-18: Flashcard scheduling is pure code in `src/lib/flashcards.ts`, using only the fields the progress store already
  saves. "again" keeps a card due now and sends it to the back of the session; "good" starts at 1 day and grows ×2.5; "easy"
  starts at 4 days and grows ×4, capped at 365 days. Cards fall due at local midnight so a card reviewed in the evening is
  ready the next morning. Only due and new cards are studied, because early reviews would distort the intervals. There are no
  single-key shortcuts, because WCAG 2.1.4 would then require a way to turn them off. The filter lists only chapters that have
  cards, so today it offers "all chapters" and chapter 2; the seed questions are all about selectors. Follow-up: delete
  `src/components/ComingSoon.astro`, which nothing uses now (the unattended session wasn't permitted to remove it).
- 2026-11-18: The quiz sits at the end of each written chapter that has a quiz file, above "mark chapter as done". Only chapter 2
  has one today: a quiz tests the notes, so each Phase 5 chapter task should add its 5 questions in
  `src/content/quizzes/NN-slug.json`, and unwritten chapters show no quiz. Options are shuffled when an attempt starts (in the
  click handler, so hydration is unaffected); question order stays as written. Answers use radio buttons with a separate "check
  answer" step, so arrow keys can't commit a choice by accident. The score is saved when the last answer is checked, so leaving
  before the score screen still counts. An unfinished attempt is not saved.
- 2026-11-18: The config generator lives at `/config`. `src/lib/config-generator.ts` is pure, and
  `tests/config-generator.spec.ts` runs its output through the real Playwright CLI, so a generated config can't silently stop
  being valid. Output order follows the option lists, not click order, so the same choices always give the same file. The
  `github` reporter is added on CI only, because it prints workflow commands anywhere else. `json` and `junit` write to
  `reports/`, because Playwright empties `test-results/` at the start of a run. Choices aren't saved between visits. Devices are
  models older Playwright versions also know, so the file works in projects that haven't upgraded.
- 2026-11-18: The auto-waiting timeline lives at `/auto-waiting`. Its scenarios and action table are data in
  `src/lib/auto-waiting.ts`, and `tests/auto-waiting.spec.ts` replays them on real Playwright: stuck scenarios must print the
  call log lines we show, and each table row is tested by breaking one check at a time. Scenarios use `page.locator('#save')`
  because `getByRole` can't match a hidden button, which would hide the check being taught. It is linked from the sidebar and
  home page, not the top bar, which has no room for the two explainers still to come.
- 2026-11-18: Watch for flakiness: the playground's "explains invalid input" failed once on mobile in a full run. Its error wasn't
  captured, and it then passed 40 repeats and two more full runs.
- 2026-11-18: The fixture graph lives at `/fixture-graph`. `src/lib/fixture-graph.ts` generates the code each scenario shows and
  simulates its run, and `tests/fixture-graph.spec.ts` runs that same code on the real Playwright CLI and compares what every
  worker prints. Parallel workers are compared as a set, because either can start first. The two-worker scenario uses one spec
  file per worker, because tests in one file stay in one worker by default. The graph drawing is hidden from screen readers;
  the lifetimes list gives each fixture's state and creation count in words.
- 2026-11-18: The parallel simulator lives at `/parallel`. `src/lib/parallel-sim.ts` follows Playwright's own rules: jobs leave the
  queue in order for the lowest free worker, shards hold equal test counts, and a file belongs to the shard its first test falls
  in, which can leave a shard empty. `tests/parallel-sim.spec.ts` passes the commands the page shows to the real CLI and compares
  shard contents, serial order, workers started and first job placement. Durations are not compared with real runs, because worker
  start-up varies; they are a model, and the 40 seconds of CI setup per shard is an assumption the page states.
- 2026-11-18: Watch for flakiness: the playground's "re-evaluates when the sample page changes state" failed once on mobile in a full
  run, showing "invalid locator" after `fill`. It then passed 40 repeats and two more full runs.
- 2026-11-18: "Spot the flaky test" lives at `/flaky`. `tests/flaky-challenges.spec.ts` runs each listing on real Playwright against
  `tests/support/flaky-world.ts`: the flaky code must pass with kind timing and fail with the output the page shows under hostile
  timing, and the fix must pass under both, so a challenge can't turn out to be simply broken. A challenge is solved only with the
  right line and the right cause; some accept several lines, because the bug spans them. Titles name the feature, never the bug.
  Solved challenges last for the visit only, like the playground's, to keep the saved progress format unchanged.
- 2026-11-18: The CI pipeline builder lives at `/ci`. `src/lib/ci-builder.ts` is pure, and `tests/ci-builder.spec.ts` reads the
  generated YAML and runs its own commands on the real CLI: every matrix job, the artifact merge and `merge-reports`, then checks
  each test ran exactly once. Actions themselves can't run locally, so their versions copy `.github/workflows/deploy.yml`, and
  `download-artifact` stays on the same major as `upload-artifact`. The unattended session had no network access, so `actionlint` was not run and
  the `v1.65.1-noble` container tag follows the naming convention without being pulled. `PLAYWRIGHT_VERSION` must equal the installed
  `@playwright/test`, and a test fails when an upgrade leaves it behind. Reports merge whenever more than one test job runs. Yarn is
  left out because classic and modern Yarn need different install flags. `GeneratorParts.tsx` holds what this and the config generator share.
- 2026-11-18: Search is a native `<dialog>` in `Search.astro` with a small script rather than a React island, so every page doesn't
  load React for it. Pagefind's index downloads on first open. The home page, the chapter list and unwritten chapters stay out of the
  index, because they only repeat titles or lead to a dead end; quizzes stay out too. Results are links with `role="option"`, so they
  can still open in a new tab. On a Mac only Cmd+K opens search, because Ctrl+K deletes to the end of the line in text fields. Pagefind's
  excerpts are split into text pieces instead of being rendered as HTML. The unattended session could not run a build under
  `/playwright-lab/`, so check search on the live site after the next deploy: `url()` sets Pagefind's `baseUrl` for that path.
- 2026-11-18: Chapter 1 notes follow the installed Playwright (1.65) where the reference PDF differs: `testDir` defaults to the config's
  folder, workers default to half the logical cores, and devices are spread from `devices[...]` because `use` has no `device` option.
  Check a chapter's claims against `node_modules` the same way. Each chapter can add a flashcard deck as well as its quiz:
  `tests/flashcards.spec.ts` now reads every deck, so new decks need no test changes. Each newly written chapter still has to update
  the ready and pending counts in `tests/chapter-progress.spec.ts`. Watch for flakiness: the playground's "explains invalid input" failed
  on mobile again in one full run, with the previous input still showing in the alert. It then passed 30 repeats and a full run.
- 2026-11-18: Chapter 2 notes follow the installed Playwright (1.65) where the reference PDF differs: `page.waitForEvent('navigated')` is not
  a real event, an unhandled dialog is dismissed automatically instead of blocking the test, `accept()` on a prompt returns an empty string
  rather than the default, and `>>>` is unnecessary for open shadow roots. Every snippet was run on real Playwright in a throwaway project.
  The quiz stays at 5 questions, so four of the sample questions gave way to custom waits, dialogs, iframes and shadow DOM. Existing
  flashcard ids are unchanged. `tests/smoke.spec.ts` counts this chapter's table of contents links, so it changes when the headings do.
- 2026-11-18: Chapter 3 notes follow the installed Playwright (1.65) where the reference PDF differs: `--project` names are case-insensitive
  and accept `*`, `isMobile` adds neither touch nor a mobile user agent, IndexedDB is saved only with `indexedDB: true`, and proxy credentials
  use separate fields. Added from testing on Chromium, Firefox and WebKit: Firefox throws on most permission names, WebKit accepts any name,
  and a device in a file-level `test.use()` forces its engine in every project. Snippets ran in a throwaway project, except that branded
  channels were only checked for their error when the browser is missing, and headed mode and the Inspector were not opened.
  Watch for flakiness: the playground's "suggests a sturdier locator and can apply it" failed once on mobile in a full run. Its error wasn't
  captured, and it then passed alone and in another full run.
- 2026-11-18: Chapter 4 notes follow the installed Playwright (1.65) where the reference PDF differs: Codegen's language flag is `--target`, not
  `--lang`; `toPass` takes `intervals`, not `interval`; `waitForFunction` options are the third argument; and Playwright now ships planner,
  generator and healer agents through `init-agents`. The notes advise against the PDF's rethrowing `try`/`catch` and its `page.goto()` fallback,
  which hides a broken link. Runtime behaviour was checked in a throwaway spec on Chromium. CLI flags, agent definitions and the Copy prompt
  button were read from the installed package, because the unattended session could not run `npx`. Codegen, `init-agents` and the MCP server
  were not run, and the `@playwright/mcp` setup was not installed or tried.
- 2026-11-18: Chapter 5 notes follow the installed Playwright (1.65) where the reference PDF differs: `browser` is worker-scoped rather than
  launched per test, and a worker fixture can't depend on `page`, so a shared signed-in page has to be built from `browser`. Added from testing:
  a missing `await` before `use()` passes silently with cleanup running first, uncaught exceptions fire `pageerror` rather than `console`,
  `page.request` throws on `data:` images, and a failed test restarts the worker. Snippets ran on desktop Chromium in temporary specs against a
  local server, since removed. Chapter 6 is now the "unwritten chapter" example in the smoke, quiz, search, SEO, a11y and progress tests, so
  whoever writes chapter 6 must move those to chapter 7. Avoid a lone `x` as a word in chapter text: with one in this chapter, Pagefind
  returned a result for "xylophone" and `tests/search.spec.ts` failed until it was reworded.
- 2026-11-18: Chapter 6 notes follow the installed Playwright (1.65) where the reference PDF differs: workers default to half the logical cores,
  parallel tests run in separate processes, `shard` is a top-level config option and not a project option, shards balance test counts rather
  than files, and `test.describe.configure()` is preferred over `test.describe.parallel()`. The LCP budget uses the common 2.5 seconds. The
  unattended session was not permitted to run a scratch project, so **the chapter's snippets were not executed**: claims were checked by reading the
  installed source and type docs. Worth running them once, especially the CDP throttling and `requestfinished` examples. Chapter 7 is now the
  "unwritten chapter" example in the smoke, quiz, search, SEO, a11y and progress tests, so whoever writes chapter 7 must move those to chapter 8.
- 2026-11-18: The flaky challenges' hostile cart shows its cookie banner on the first click, not after a timer, because a busy
  machine could reach `isVisible()` after any fixed delay and make the flaky code pass. Nested runs have a 20 second test timeout
  so a slow machine can't replace the timeout message a challenge expects.
- 2026-11-18: Chapter 7 notes follow the installed Playwright (1.65) and current GitHub behaviour where the reference PDF differs: the report is
  published with `actions/deploy-pages` and also after failed runs, rather than pushed to `gh-pages` only on green runs; matrix jobs use
  `fail-fast: false` and unique artifact names; the Dockerfile uses `npm ci` with a `.dockerignore`; and `docker run` passes `-e CI=true`, because
  containers don't inherit `CI`. Action versions copy `.github/workflows/deploy.yml`. Checked in throwaway projects on real Playwright: flaky exit
  codes, `--fail-on-flaky-tests`, `forbidOnly`, the `github` reporter, blob file names, `merge-reports`, `--only-changed`, and the sample config
  (loaded and type-checked). Every YAML snippet was parsed. **Not run:** the workflows on GitHub, `actionlint`, and all Docker commands, because
  Docker wasn't available to the unattended session, so the `v1.65.1-noble` tag is still unpulled. Chapter 8 is now the "unwritten chapter" example in
  the smoke, quiz, search, SEO, a11y and progress tests, so whoever writes chapter 8 must move those to chapter 9.
- 2026-11-18: Chapter 8 notes follow the installed Playwright (1.65) where the reference PDF differs: `playwright test` has no `--headless` flag,
  `page.pause()` returns immediately when headless, `'on-first-retry'` is not a screenshot mode (the real one is `'on-first-failure'`, and the wrong
  value silently gives no screenshots), `contextOptions.recordVideo.dir` is ignored while `video` is on, `page.video().path()` is a temporary path
  during a test, `locator.screenshot()` has no `fullPage` or `clip`, the `devtools` launch option is gone from the types, and Node 24 runs TypeScript
  without `ts-node`. Trace Viewer was added because it is the tool for CI failures. Checked in a throwaway project on desktop Chromium, since removed: the
  flag error, every screenshot mode, the video modes in the notes except `on-all-retries` and `retain-on-failure-and-retries`, file names, `saveAs`, `attach`, and a
  script run with `node`. **Not run:** anything needing a window (Inspector, UI Mode, `--headed`, `show-trace`), `xvfb-run`, `channel: 'chromium'` and
  `--auto-open-devtools-for-tabs`. Their descriptions come from the installed CLI help, types and bundled UI. Chapter 9 is now the "unwritten chapter"
  example in the smoke, quiz, search, SEO, a11y and progress tests, so whoever writes chapter 9 must move those to chapter 10.
- 2026-11-18: Chapter 9 notes follow the installed axe-core (4.14) and Playwright (1.65) where the reference PDF differs: axe tags are exact, so
  `wcag21aa` alone skips Level A and WCAG 2.0 rules and reported nothing on a badly broken page; `wcag2a` and `wcag2aa` mean WCAG 2.0 only; and
  `networkidle` is discouraged. Added from testing: an unknown tag silently runs zero rules, `withTags()` and `withRules()` replace each other, `include()`
  throws when nothing matches, hidden content is skipped, cross-origin iframes are scanned, and text mid-fade can fail `color-contrast`. Snippets ran in a
  throwaway project on desktop Chromium, since removed. **Not run:** any screen reader, so the live region announcement advice comes from the ARIA
  specification and common guidance. Legal references were not checked against the standards' text. Chapter 10 is now the "unwritten chapter" example in the
  smoke, quiz, search, SEO, a11y and progress tests, so whoever writes chapter 10 must move those to chapter 11.
- 2026-11-18: The home page progress bar is now two rows of 8 links instead of one row of 16, because 16 columns left each link under the 24px that WCAG 2.2
  `target-size` asks for. `tests/a11y.spec.ts` now scans with the full WCAG 2.0, 2.1 and 2.2 A and AA tags. That exposed `label-content-name-mismatch` on the theme toggle in the
  light theme, so its decorative `x` is now CSS content and the button keeps the name "light theme".
- 2026-11-18: Chapter 10 notes follow the installed Playwright (1.65) where the reference PDF differs: `threshold` is a perceived color difference, not a percentage
  (black to `#000096` passes at the default 0.2 with every pixel changed); the file name holds the project name, not the browser;
  plain `--update-snapshots` means `changed`, so matching baselines are left alone; and `toHaveScreenshot()` already disables animations, so the CSS reset is dropped. Added from
  testing: the stricter of `maxDiffPixels` and `maxDiffPixelRatio` wins, a size change always fails, a mask matching nothing passes silently, a resized mask fails, and a missing
  baseline under `CI` is written to the runner and still fails. Snippets ran in a throwaway project on desktop Chromium on macOS, since removed, and the workflow YAML was parsed.
  **Not run:** the workflow on GitHub and the `docker run` command, because Docker wasn't available to the unattended session. The advice that arm64 and x64 Linux images can render
  differently is general guidance and wasn't measured. Chapter 11 is now the "unwritten chapter" example in the smoke, quiz, search, SEO, a11y and progress tests, so whoever writes
  chapter 11 must move those to chapter 12.
- 2026-11-18: Chapter 11 notes follow the installed Playwright (1.65) where the reference PDF differs: `isMobile` doesn't enable touch (`hasTouch` does, and `tap()` fails without it);
  `permissions` is an array of grants, and the object form throws; `page.touchscreen.tap()` takes coordinates, not a selector; swapping `screen` doesn't rotate the layout, so the notes use
  landscape presets or `setViewportSize()`; `dragTo()` sends only mouse events, so swipes use `locator.dispatchEvent()`; and `tap()` auto-waits, so the extra `waitFor()` is dropped. Added from
  testing: a preset can't go inside `test.describe()`, `browser.newContext()` keeps the project's engine, `mouse.wheel()` throws on mobile WebKit, `orientationchange` fired only on WebKit, and a page
  with no meta viewport laid out at 980px. Snippets and behaviours ran in a throwaway project on Pixel 5 (Chromium) and iPhone 15 (WebKit) presets, with engine differences also checked on desktop Chromium,
  WebKit and Firefox, since removed. **Not run:** anything on a real phone. The statements that emulation can't show real hardware performance or every iOS bug are general guidance and weren't measured.
  Chapter 12 is now the "unwritten chapter" example in the smoke, quiz, search, SEO, a11y and progress tests, so whoever writes chapter 12 must move those to chapter 13.
