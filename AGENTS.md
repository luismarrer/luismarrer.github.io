# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Commands

Uses Node 22.13 or newer and pnpm (pinned in `package.json`).

- `pnpm install` — install dependencies
- `pnpm dev` — start dev server
- `pnpm build` — build static site to `dist/`
- `pnpm preview` — preview the production build
- `pnpm i18n:check` — verify `cv-en.json` and `cv-es.json` are in sync (structure, invariant fields, stale translations; `--base <ref>` to compare against a commit)
- `pnpm test:print` — build and validate EN/ES PDFs in Letter and A4 with Playwright
- `pnpm test:ui` — build and run the responsive contracts (hero label separator, education header) with Playwright
- `pnpm check` — run i18n coherence, production build, and all Playwright checks (print + responsive)

There is no linter. Print/PDF and responsive regression tests run with Playwright. Production is hosted on Vercel at https://cv.luismarrero.me — every push to `main` auto-deploys via Vercel's git integration, and PRs get preview deploys. `.github/workflows/deploy.yml` only publishes the redirect page in `redirect/` to GitHub Pages, so the old `luismarrer.github.io` URL forwards to production. See `docs/prd-cv-i18n-sync.md` for the translation-sync pipeline design.

## Architecture

Astro 5 static portfolio site. All page content is generated from two JSON Resume–schema files at the repo root: `cv-en.json` and `cv-es.json`. Most changes to the site's content are edits to these JSON files, not to components.

### Content flow

1. `src/i18n/loadCv.ts` dynamically imports the CV JSON for the current locale.
2. Locale pages (`src/pages/en/index.astro`, `src/pages/es/index.astro` — intentionally identical files) load the CV and pass the whole `cv` object as a prop into `src/layouts/Layout.astro` and each section component.
3. Section components in `src/components/sections/` (Hero, About, Experience, Projects, Skills, Education) each read their slice of the CV object.

`src/pages/index.astro` is intentionally empty — it exists so Astro's i18n routing (`prefixDefaultLocale: true` in `astro.config.mjs`) generates the redirect from `/` to `/en/`. Don't delete it or add content to it.

### i18n

Two locales, `en` (default) and `es`. UI strings that aren't part of the CV data (section titles, command-palette text) live in `src/i18n/ui.ts`, accessed via the `useTranslations` / `useKeyboardManager` helpers in `src/i18n/utils.ts`. Adding user-visible text means adding it to both locales in `ui.ts` (or both CV JSON files).

### Icons

Each tech/social icon is an inline-SVG `.astro` component in `src/icons/`. Components like `Skills.astro` and `Hero.astro` map string names from the CV JSON to icon components via a lookup object (e.g. `SKILLS_ICONS`). Adding a new skill or social network in the JSON requires the matching icon component and an entry in that map.

### Other notes

- Path alias `@/*` → `src/*` (defined in `tsconfig.json`, which extends Astro's strict config).
- `KeyboardManager.astro` wraps the `ninja-keys` web component (Cmd+K command palette); its actions are built from the CV's social profiles.
- `scripts/i18n-check.mjs` is the EN/ES coherence gate. It also runs as Vercel's `ignoreCommand` (see `vercel.json`): if the CV files are out of sync, the production deploy is skipped and the site stays on the last good deploy. Its list of translatable field paths (`TRANSLATABLE`) must be updated if the CV schema usage changes.
- The browser title is intentionally fixed to `Luis Marrero González - Resume` in both locale pages. Keep this minimal title unchanged and do not derive it from `basics.label` or other CV content.
- Certification data may remain in the CV JSON files, but certifications must never be rendered as a UI section or added to the locale page layout.

## Content rules (from README)

When editing the CV JSON files:

- `cv-en.json` and `cv-es.json` must contain the same content (translated).
- Work Experience organization titles must stay concise: maximum 3 meaningful words, excluding short articles or prepositions such as `of`. Prefer established abbreviations such as `SAC` when the full organization name is longer.
- Project titles: maximum 2 words.
- Projects sorted by importance, descending.
- Keep exactly 6 projects, whether active or inactive.
- When adding a stronger project, replace an existing one; never show more or fewer than 6.
- Project descriptions: one sentence, max 90 characters.
- Projects: no more than 3 highlights each.
