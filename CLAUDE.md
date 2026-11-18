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
| `pnpm build`            | Static build to `dist/`                                       |
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
(`css-variables` theme) · nanostores for client state · Playwright + @axe-core/playwright · pnpm · Node 24.
Planned: CodeMirror 6 (playground), Pagefind (search), Motion (explainers).

## Layout

```
src/
  styles/tokens.css      design tokens (ONLY place for raw colors)
  styles/global.css      Tailwind import, token → utility mapping, .prose-term chapter styles
  data/chapters.ts       master list of 16 chapters (num, slug, title, short, blurb)
  lib/chapters.ts        getChapters(): joins the list with MDX entries → status passed/pending
  lib/url.ts             url(): base-path-aware internal links
  content/chapters/      NN-slug.mdx chapter notes (content collection, schema in content.config.ts)
  components/            .astro UI: Sidebar, TableOfContents, CodeCopy, TerminalWindow, StatusMark, TopBar, Footer, TestRunHero, ComingSoon, Callout, Kbd, ApiRef, ThemeToggle
  islands/               (planned) React interactive components: Playground, Flashcards, Quiz, …
  stores/progress.ts     visitor progress in localStorage: chapters read, flashcard reviews, quiz scores
  layouts/BaseLayout.astro
  pages/                 routes; chapters/[slug].astro renders MDX or a "pending" placeholder
scripts/
  extract-chapters.mjs   PDF → source/chapters/NN-slug.txt (gitignored)
  serve-dist.mjs         tiny static server for tests (see gotchas)
tests/                   smoke.spec.ts, a11y.spec.ts (more to come: visual, mobile, playground)
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
  info/blue = links. Status glyphs via `<StatusMark status="passed|pending|failed|skipped" />`.
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
- A chapter becomes ✓ passed on the site as soon as its MDX exists and isn't a draft.
- Flashcard and quiz data will live beside chapters (see ROADMAP phase 3/4).

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

- **Don't use `astro preview` in tests.** Astro 7 auto-backgrounds `dev`/`preview` when it detects an AI
  agent (`AI_AGENT`, `CLAUDECODE` env), so Playwright's webServer thinks it exited. Tests use
  `scripts/serve-dist.mjs`. For the dev server, use `astro dev --background` / `astro dev stop` (see AGENTS.md).
- **TypeScript is pinned to 6.x**: `astro check` doesn't support TS 7 yet.
- Shiki theme is `css-variables`; token colors are `--astro-code-*` in `tokens.css`. Stock themes
  (github-dark, github-dark-dimmed) failed axe contrast on comments.
- Never put a `//` comment inside a one-line object in `astro.config.mjs`: it swallows the closing brace.
- **`robots.txt` is only honoured at a domain root.** Under the `/playwright-lab/` project path crawlers ignore it, so
  it takes effect only with a custom domain or a user site. Page-level `noindex` works either way.
