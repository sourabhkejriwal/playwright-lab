# playwright-lab

Interactive study site for Playwright test automation. It's a portfolio piece: a static Astro site,
deployed to GitHub Pages, and tested with Playwright itself.

**This repo is public.** Never name the reference PDF, its title, or its author anywhere in tracked files
or on the site (code, comments, docs, commit messages). Refer to it only as "the reference PDF".

@AGENTS.md

## How to work in this repo (read first)

This project is built across many short sessions. Context lives in files, not in chat history.

1. Read `ROADMAP.md` and pick the **first unchecked task** (or the one the user names).
2. Do only that task. Keep the diff focused.
3. Run `pnpm check && pnpm format && pnpm test`; all must pass.
4. Tick the task in `ROADMAP.md` (add notes or new follow-up tasks if you found any).
5. Commit with a message like `feat(playground): …`, `content(ch05): …`, `test: …`.
6. If you made a decision future sessions need (a library, a convention, a gotcha), add it to this file.

Never read the whole PDF. Chapter text is pre-extracted (see "Content workflow").

## Commands

| Command                 | What it does                                                  |
| ----------------------- | ------------------------------------------------------------- |
| `pnpm dev`              | Dev server on http://localhost:4321                           |
| `pnpm build`            | Static build to `dist/`, then the Pagefind search index       |
| `pnpm preview`          | Build, then serve `dist/` on :4322 (foreground)               |
| `pnpm check`            | `astro check` type-checking (needs TypeScript 6, see gotchas) |
| `pnpm test`             | Playwright: e2e + a11y, desktop and mobile projects           |
| `pnpm test:ui`          | Playwright UI mode                                            |
| `pnpm format`           | Prettier (incl. `.astro`)                                     |
| `pnpm extract:chapters` | Re-extract `source/chapters/*.txt` from the PDF               |
| `pnpm og:image`         | Re-render the committed `public/og-image.png`                 |
| `pnpm favicon`          | Rebuild the committed `public/favicon.ico` from `favicon.svg` |
| `pnpm roadmap`          | Work through `ROADMAP.md` unattended (see below)              |

## Unattended roadmap runs

`pnpm roadmap` (`scripts/run-roadmap.mjs`) starts a fresh Claude session for each open task, then runs
`pnpm check`, `pnpm format:check` and `pnpm test` itself before starting the next one. It stops at the first
failure or blocked task. Options: `--max N`, `--model NAME` (default `opus`), `--dry-run`. To stop after the current task: `touch .roadmap/stop`.
Logs go to `.roadmap/logs/`. Work is committed to local `main` and pushing is disabled for these sessions.

## Stack

Astro 7 (static output) · React 19 islands · MDX content collections · Tailwind CSS 4 · Shiki
(`css-variables` theme) · nanostores for client state · CodeMirror 6 (playground) · Playwright +
@axe-core/playwright · Pagefind (search) · pnpm · Node 24. Planned: Motion (explainers).

## Layout

```
src/
  styles/tokens.css      design tokens (ONLY place for raw colors)
  styles/global.css      Tailwind import, token → utility mapping, .prose-term chapter styles
  data/chapters.ts       master list of 16 chapters (num, slug, title, short, blurb)
  data/playground-*.ts   the playground's sample page and preset challenges
  lib/locator/           locator playground engine: parser, aria (roles and names), engine, analyze (strict errors, suggestions)
  lib/chapters.ts        getChapters(): joins the list with MDX entries → status ready/pending
  lib/url.ts             url(): base-path-aware internal links
  lib/study-schema.ts    Zod schemas for flashcard decks and quizzes
  lib/flashcards.ts      spaced repetition: intervals, due dates, the study queue (pure, tested in Node)
  lib/quiz.ts            shuffles a question's options and keeps the answer index right (pure, tested in Node)
  lib/search.ts          turns Pagefind results into search dialog rows (pure, tested in Node)
  lib/config-generator.ts  writes playwright.config.ts from the generator's choices (pure, tested by running real Playwright)
  lib/ci-builder.ts      writes a GitHub Actions workflow from the CI builder's choices (pure, its commands are run on real Playwright)
  lib/auto-waiting.ts    auto-waiting explainer's scenarios, steps and action table (pure, tested against real Playwright)
  lib/fixture-graph.ts   fixture graph explainer's scenarios, generated code and run simulator (pure, tested against real Playwright)
  lib/parallel-sim.ts    parallel simulator's suites, shard split, worker schedule and insights (pure, tested against real Playwright)
  lib/flaky-challenges.ts  "spot the flaky test" challenges and grading (pure, every listing is run on real Playwright)
  content/chapters/      NN-slug.mdx chapter notes (content collection, schema in content.config.ts)
  content/flashcards/    NN-slug.json flashcard deck per chapter
  content/quizzes/       NN-slug.json quiz per chapter
  components/            .astro UI: Sidebar, TableOfContents, CodeCopy, TerminalWindow, StatusMark, ChapterStatus, ChapterDone, ChapterProgressSync, TopBar, Footer, TestRunHero, ComingSoon, Callout, Kbd, ApiRef, ThemeToggle, Search
  islands/               React interactive components: Playground, LocatorEditor, Flashcards, Quiz, ConfigGenerator, CiBuilder, GeneratorParts (shared by those two), AutoWaitingTimeline, FixtureGraph, ParallelSimulator, FlakyChallenges, CodeText (renders `backticks` as code)
  stores/progress.ts     visitor progress in localStorage: chapters read, flashcard reviews, quiz scores
  layouts/BaseLayout.astro
  pages/                 routes; chapters/[slug].astro renders MDX or a "pending" placeholder
scripts/
  extract-chapters.mjs   PDF → source/chapters/NN-slug.txt (gitignored)
  serve-dist.mjs         tiny static server for tests (see gotchas)
tests/                   smoke, a11y, playground, locator-engine (compares the engine with real Playwright), and more
  support/flaky-world.ts the app the flaky challenges run against, with kind and hostile timing
source/chapters/         raw reference text per chapter + INDEX.tsv: reference only, NEVER committed
```

## Design system: "Terminal dev" (design A)

The site looks like a Playwright test run in a dark terminal.

- **Colors**: use only the token utilities: `bg-bg`, `bg-surface`, `bg-raised`, `border-line`,
  `border-line-strong`, `text-text`, `text-bright`, `text-muted`, `text-dim`, `text-pass`, `text-pending`,
  `text-fail`, `text-info`, `text-purple`. Never write hex in components. New colors go in `tokens.css`
  and must reach **≥4.5:1 contrast on `--term-raised`** (the a11y tests enforce this) in both themes.
- **Themes**: dark is the default. `:root[data-theme='light']` in `tokens.css` overrides the color tokens, so a new
  color token needs a light value too. `ThemeToggle` saves the choice; an inline script in `BaseLayout` applies it before first paint.
- **Semantics**: pass/green = done or primary action; pending/amber = in progress; fail/red = errors;
  info/blue = links. Status glyphs via `<StatusMark status="passed|read|ready|pending|failed|skipped" />`.
- **Type**: JetBrains Mono for UI and headings; Inter (`font-prose`, `.prose-term`) for long-form reading.
  Lowercase, terminal-flavoured microcopy (`$ ls chapters/`, `./chapters`, `# tools`).
- **Shapes**: `rounded-term` (6px), 1px `border-line` borders, no shadows, no gradients.
- **Frames**: wrap demos and callouts in `<TerminalWindow title="…">`.
- **Motion**: subtle only; anything animated must respect `prefers-reduced-motion` (use `motion-safe:`).
- **Layout**: two columns from `lg` (16rem sticky chapter `Sidebar` + content, `max-w-7xl`); below `lg` the sidebar is a `<details>` drawer. Mobile-first; everything must work at 375px wide.

## Content workflow (chapters)

- Source text: `source/chapters/NN-slug.txt` (about 25–35 PDF pages each). Read only the chapter you're
  writing. If `source/` is missing, run `pnpm extract:chapters` (needs `pdftotext` and the PDF at `../pdf/`).
- Output: `src/content/chapters/NN-slug.mdx` with frontmatter `chapter`, `title`, `summary`,
  `readingMinutes`, optional `draft: true` (drafts show as pending).
- Write **study notes in our own words**: summaries, our own short code examples, key APIs, gotchas,
  "interview angle". Do not paste source text or long listings verbatim.
- Headings are `##`/`###` (h1 comes from the layout). Code fences use `ts`, with optional filename and
  highlighted lines: ` ```ts title="login.spec.ts" {1,3-5} ` (`src/lib/shiki-code-frame.mjs`).
- Chapters can use these components without importing them (registered in `src/components/mdx.ts`):
  `<Callout type="tip|warn|gotcha" title="optional">`, `<Kbd>Ctrl</Kbd>`, and `<ApiRef name="page.getByRole()" />`.
  `ApiRef` builds the Playwright docs link from the name (`src/lib/api-ref.ts`); an unknown receiver fails the build,
  so add new classes to `RECEIVERS` there.
- A chapter becomes ● ready on the site as soon as its MDX exists and isn't a draft. It shows ✓ read only for a visitor
  who has read it: static pages ship the unread state and `ChapterProgressSync` applies saved progress in the browser
  (use `<ChapterStatus>` for a chapter's mark, and the `data-if-read`/`data-if-unread` attributes for anything else).
- A written chapter shows its quiz automatically once `src/content/quizzes/NN-slug.json` exists, so add the quiz along with the notes.
- Flashcards and quizzes are JSON, one file per chapter, named like the chapter's MDX: `src/content/flashcards/NN-slug.json`
  (`{ chapter, cards: [{ id, front, back }] }`) and `src/content/quizzes/NN-slug.json`
  (`{ chapter, questions: [{ question, options, answer, explanation }] }`). Schemas are in `src/lib/study-schema.ts`.
  Card ids are `<chapter-slug>/<name>` and key the visitor's saved progress, so don't rename them. `answer` is a 0-based index
  into `options`. Aim for 5 questions per quiz. Text is plain, with code in `backticks`.

## Coding conventions

- TypeScript strict. `.astro` for static UI, React (`src/islands/*.tsx`) only when interactive, hydrated
  with the lightest directive that works (`client:visible` > `client:idle` > `client:load`).
- Internal links and assets always go through `url()`; the site is served under `/<repo>/` on Pages.
- Progress: read `$progress` with `useStore`, change it only through the store's save functions, and call `loadProgress()`
  in `useEffect`, never during render, so the first client render matches the static HTML. Use `$progressReady` to avoid
  showing "unread" before saved data arrives.
- Prefer accessible markup (landmarks, labelled lists and navs); tests locate by role and name, so
  keep accessible names stable.
- Tests: user-facing locators (`getByRole`, `getByLabel`, `getByText`), web-first assertions, no
  `waitForTimeout`. Every new page gets a smoke test and an entry in `tests/a11y.spec.ts`.

## Deploy

`.github/workflows/deploy.yml`: on PRs runs format check, `astro check` and Playwright; on `main` it also
builds with `SITE_URL`/`BASE_PATH` from `actions/configure-pages` and deploys to GitHub Pages.
Repo setting needed once: Settings → Pages → Source: **GitHub Actions**.

## Gotchas

- **Don't import `url` by that name in an MDX chapter.** Astro's MDX output already exports a `url`, so the build fails with a parse error.
  Use `import { url as siteUrl } from '../../lib/url';` for internal links.
- **Search only works on a build.** Pagefind indexes `dist/` after `astro build`, so under `pnpm dev` the dialog says search isn't
  available. Pages are indexed through `BaseLayout`'s `searchable` prop; wrap anything that shouldn't be found in `data-pagefind-ignore`.
- **Don't use `astro preview` in tests.** Astro 7 auto-backgrounds `dev`/`preview` when it detects an AI
  agent (`AI_AGENT`, `CLAUDECODE` env), so Playwright's webServer thinks it exited. Tests use
  `scripts/serve-dist.mjs`. For the dev server, use `astro dev --background` / `astro dev stop` (see AGENTS.md).
- **TypeScript is pinned to 6.x**: `astro check` doesn't support TS 7 yet.
- Shiki theme is `css-variables`; token colors are `--astro-code-*` in `tokens.css`. Stock themes
  (github-dark, github-dark-dimmed) failed axe contrast on comments.
- Never put a `//` comment inside a one-line object in `astro.config.mjs`: it swallows the closing brace.
- **`robots.txt` is only honoured at a domain root.** Under the `/playwright-lab/` project path crawlers ignore it, so
  it takes effect only with a custom domain or a user site. Page-level `noindex` works either way.
- **`client:visible` islands don't hydrate off-screen.** A test must scroll to one first (`scrollIntoViewIfNeeded()`), or its controls never appear.
- **A test that runs the Playwright CLI needs its own `package.json` in the temp project.** Otherwise the nested run uses this
  repo's `test-results/` as its output folder and empties it mid-run. `tsconfig.json` excludes `test-results` so these temp projects aren't type-checked.
- **Changing the playground's sample page or engine?** Add the new cases to `expressions` in `tests/locator-engine.spec.ts`:
  real Playwright is the reference. Code touching the iframe must not use `instanceof` (its elements belong to another
  window), and the iframe needs `allow-scripts` in its sandbox or axe hangs.
