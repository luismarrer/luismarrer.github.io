# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Keep this repository guidance synchronized with `AGENTS.md`; only the heading,
agent-specific introductory sentence, and reciprocal filename in this note
should differ.

## Commands

Uses Node 22.13 or newer and pnpm (pinned in `package.json`).

- `pnpm install` — install dependencies
- `pnpm dev` — start dev server
- `pnpm build` — build static site to `dist/`
- `pnpm preview` — preview the production build
- `pnpm i18n:check` — verify EN/ES structure and invariant fields; add `--base <ref>` to detect translatable fields changed on only one side
- `pnpm test:print` — build and validate EN/ES PDFs in Letter and A4 with Chromium
- `pnpm test:ui` — build and run the Chromium responsive contracts (hero label separator, Experience metadata placement, Education header)
- `pnpm check` — run the local structure/invariant i18n check, production build, and all Playwright contracts (print, responsive, command palette in Chromium, plus the mobile palette contract in WebKit)

There is no linter. Print/PDF, responsive, and command-palette regression tests run with Playwright. After a fresh install, download Chromium and WebKit once with `pnpm exec playwright install chromium webkit`. Production is hosted on Vercel at https://cv.luismarrero.me. Vercel evaluates pushes to `main` and eligible PRs through its git integration; `vercel.json` may skip a build when the i18n gate blocks it or only irrelevant files changed. `.github/workflows/deploy.yml` only publishes the redirect page in `redirect/` to GitHub Pages, so the old `luismarrer.github.io` URL forwards to production. See `docs/prd-cv-i18n-sync.md` for the translation-sync pipeline design.

## Architecture

Astro 5 static portfolio site. All resume content is generated from two JSON Resume–schema files at the repo root: `cv-en.json` and `cv-es.json`. Locale-dependent UI copy and the fixed browser title live in `src/i18n/ui.ts`. Most resume-content changes are edits to the JSON files, not to components.

### Content flow

1. `src/i18n/loadCv.ts` dynamically imports the CV JSON for the current locale.
2. Locale pages (`src/pages/en/index.astro`, `src/pages/es/index.astro` — intentionally identical files) load the CV and pass the whole `cv` object as a prop into `src/layouts/Layout.astro` and each section component.
3. Section components in `src/components/sections/` (Hero, About, Experience, Projects, Education, Skills) each read their slice of the CV object.

`src/pages/index.astro` is intentionally empty — it exists so Astro's i18n routing (`prefixDefaultLocale: true` in `astro.config.mjs`) generates the redirect from `/` to `/en/`. Don't delete it or add content to it.

### i18n

Two locales, `en` (default) and `es`. `src/i18n/ui.ts` owns the fixed `resumeTitle` plus locale-aware section titles, present/education/work-mode labels, theme-toggle label, and command-palette copy. Section titles and palette strings use `useTranslations` / `useCommandPalette`; `cvLabels` and `theme` are read directly by their components. Add every new locale-dependent user-visible string to both locales in `ui.ts` (or to both CV JSON files when it is resume content).

### Icons

Each tech/social icon is an inline-SVG `.astro` component in `src/icons/`. Components map string names from the CV JSON to icon components via lookup objects (e.g. `SKILLS_ICONS`). A new skill requires its icon and `Skills.astro` mapping. A new social network requires its icon plus mappings in both `Hero.astro` and `CommandPalette.astro`; palette links also require an intentional shortcut entry and updated tests.

### Other notes

- Path alias `@/*` → `src/*` (defined in `tsconfig.json`, which extends Astro's strict config).
- `CommandPalette.astro` plus `src/lib/commandPalette.ts` implement the native dialog/combobox. `Cmd/Ctrl+K` opens it; Control+letter shortcuts are active only while it is open. The personal-site command comes from `cv.basics.url`, network commands come from `cv.basics.profiles`, and the theme action shares `src/lib/theme.ts` with the visible toggle.
- `scripts/i18n-check.mjs` always checks EN/ES structure and invariants. Stale-translation detection additionally requires a baseline (`--base <ref>`); local `pnpm i18n:check` and the i18n phase inside `pnpm check` have no baseline. In `--vercel` mode, the script reads the previous successful deployment SHA from `VERCEL_GIT_PREVIOUS_SHA`; `i18n-sync.yml` passes the pre-push commit with `--base`. `TRANSLATABLE` lives in `scripts/i18n-shared.mjs` and must be updated when CV schema usage changes.
- The translation pipeline (docs/prd-cv-i18n-sync.md): `i18n-sync.yml` translates diverged fields on pushes to `main` and opens an `i18n/sync-<sha>` PR, `i18n-preview-links.yml` comments the Vercel preview links, and `i18n-validate.yml` (`/delegate` comment or `auto-merge` label, repo owner only) reviews and merges. The LLM client is provider-pluggable in `scripts/translation-client.mjs` (OpenAI + a `mock` provider for tests). Requires `OPENAI_API_KEY` and `I18N_BOT_TOKEN` secrets. R2 acceptance remains open: PRD §6.6 records the risk that a squash merge may trigger a reverse sync PR, which the E2E test must rule out or guard against.
- The browser title is intentionally fixed to `Luis Marrero González - Resume` in both locale pages. Keep this minimal title unchanged and do not derive it from `basics.label` or other CV content.
- Certification data may remain in the CV JSON files, but certifications must never be rendered as a UI section or added to the locale page layout.

## Content rules (from README)

When editing the CV JSON files:

- `cv-en.json` and `cv-es.json` must contain the same content (translated).
- `work[].workMode` is a canonical enum (`remote` | `hybrid` | `on-site`) and `work[].technologies` are canonical tech names — both identical in the two files (invariants, never translated; the UI translates the mode label via `ui.ts`).
- Work Experience organization titles must stay concise: maximum 3 meaningful words, excluding short articles or prepositions such as `of`. Prefer established abbreviations such as `SAC` when the full organization name is longer.
- Project titles: maximum 2 words.
- Projects sorted by importance, descending.
- Keep exactly 6 projects, whether active or inactive.
- When adding a stronger project, replace an existing one; never show more or fewer than 6.
- Project descriptions: one sentence, max 90 characters.
- Projects: no more than 3 highlights each.
