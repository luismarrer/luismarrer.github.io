# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Uses pnpm (pinned in `package.json`).

- `pnpm install` — install dependencies
- `pnpm dev` — start dev server
- `pnpm build` — build static site to `dist/`
- `pnpm preview` — preview the production build

There are no tests or linters. Production is hosted on Vercel at https://cv.luismarrero.me — every push to `main` auto-deploys via Vercel's git integration, and PRs get preview deploys. `.github/workflows/deploy.yml` only publishes the redirect page in `redirect/` to GitHub Pages, so the old `luismarrer.github.io` URL forwards to production. See `docs/prd-cv-i18n-sync.md` for the translation-sync pipeline design.

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

## Content rules (from README)

When editing the CV JSON files:

- `cv-en.json` and `cv-es.json` must contain the same content (translated).
- Project titles: maximum 2 words.
- Projects sorted by importance, descending.
- Project descriptions: one sentence, max 90 characters.
- Projects: no more than 3 highlights each.
