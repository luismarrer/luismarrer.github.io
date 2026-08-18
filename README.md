# Portfolio

This is my personal portfolio, where I share my experience, skills, and the most relevant projects I have worked on to date.

Original design by [Bartosz Jarocki](https://github.com/BartoszJarocki/cv).

I based my work on the project by [midudev](https://github.com/midudev/minimalist-portfolio-json/) in the following video: [How to Create a Minimalist Web Portfolio with Astro 4, HTML, CSS](https://www.youtube.com/watch?v=Zwh92LTB-Bk), who adapted the original code to [Astro](https://astro.build/).

Resume content is generated from two locale-specific files, `cv-en.json` and
`cv-es.json`, based on the [JSON Resume](https://jsonresume.org/schema) schema.

---

<div align="center"> <!-- Centering elements is not possible with pure Markdown -->

[Portfolio](https://cv.luismarrero.me/en/) - [JSON](cv-en.json) - [License](LICENSE)

</div>

![portfolio](portfolio_screenshot.png)

## 🛠️ Stack

- [Astro](https://astro.build/) - A modern framework for building websites.
- [TypeScript](https://www.typescriptlang.org/) - A superset of JavaScript that adds static typing and class-based objects.
- Native command palette (`Cmd/Ctrl + K`) - a dependency-free dialog/combobox whose open panel exposes Control shortcuts for print (`P`), theme (`T`), language (`E`), personal site (`S`), GitHub (`G`), LinkedIn (`L`), and X (`X`).

## Print and PDF quality

The print layout is a deliberate two-page resume rather than a copy of the web UI:

- The print-specific header, profile, work experience, projects, education, and
  skills flow across exactly two pages.
- Projects use the available space instead of forcing a fixed page break; their
  exact page distribution may change as resume content evolves.
- The six project cards share exactly the same height in the printed grid.
- Skills print as a single comma-separated typographic list instead of pills.
- Contact and project links remain clickable in exported PDFs, with the `•` separators outside the underlined links.
- Letter is the canonical paper size; A4 is also covered as a compatibility check.

Run `pnpm test:print` to build the site and validate both locales in Letter and
A4. The tests check page count and size, editorial section order, intact entries,
non-orphaned headings, equal project-card heights, the skills list, PDF links,
dark-theme reset, contrast, readable type, margins, clipping, and overlaps. Run
`pnpm test:ui` for the responsive contracts covering the hero label separator,
Experience metadata placement, and Education header. Run `pnpm check` for the
local structure/invariant i18n check, production build, and the complete
Playwright suite: print, responsive, and command-palette contracts in Chromium,
plus the mobile command-palette contract in WebKit.

Detecting a translatable field changed in only one locale requires a git
baseline: use `pnpm i18n:check --base <ref>`. Without `--base`, the check
validates structure and invariant fields only.

Node 22.13 or newer is required. After a fresh install, download the test browsers once with `pnpm exec playwright install chromium webkit`.

## Notes for Portfolio

- Work Experience organization titles must have a maximum of 3 meaningful words, excluding short articles or prepositions such as `of`. Prefer established abbreviations such as `SAC` when needed.
- Project titles must have a maximum of 2 words.
- Both files (`cv-en.json` and `cv-es.json`) must contain the same content.
- `work[].workMode` is a canonical enum (`remote` | `hybrid` | `on-site`) and
  `work[].technologies` contains canonical technology names. Both fields must
  be identical in EN/ES; the UI localizes the work-mode label.
- Projects must be sorted by importance (descending order).
- The portfolio must contain exactly 6 projects, active or inactive.
- A stronger new project must replace an existing project; never display more or fewer than 6.
- Project descriptions must not exceed 90 characters (one sentence).
- Projects must not have more than 3 highlights.

## 🔑 License

[MIT](LICENSE)
