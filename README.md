# Portfolio

This is my personal portfolio, where I share my experience, skills, and the most relevant projects I have worked on to date.

Original design by [Bartosz Jarocki](https://github.com/BartoszJarocki/cv).

I based my work on the project by [midudev](https://github.com/midudev/minimalist-portfolio-json/) in the following video: [How to Create a Minimalist Web Portfolio with Astro 4, HTML, CSS](https://www.youtube.com/watch?v=Zwh92LTB-Bk), who adapted the original code to [Astro](https://astro.build/).

The content is generated from a JSON file, based on the [JSON Resume](https://jsonresume.org/schema) schema.

---

<div align="center"> <!-- Centering elements is not possible with pure Markdown -->

[Portfolio](https://cv.luismarrero.me/en/) - [JSON](cv-en.json) - [License](LICENSE)

</div>

![portfolio](portfolio_screenshot.png)

## 🛠️ Stack

- [Astro](https://astro.build/) - A modern framework for building websites.
- [TypeScript](https://www.typescriptlang.org/) - A superset of JavaScript that adds static typing and class-based objects.
- [Ninja Keys](https://github.com/ssleptsov/ninja-keys) - A dropdown menu with keyboard shortcuts.

## Print and PDF quality

The print layout is a deliberate two-page resume rather than a copy of the web UI:

- Page 1 contains the print-specific header, profile, and work experience.
- Page 2 contains projects, education, and skills.
- Contact and project links remain clickable in exported PDFs.
- Letter is the canonical paper size; A4 is also covered as a compatibility check.

Run `pnpm test:print` to build the site and validate both locales in Letter and A4. The tests check page count and size, editorial page boundaries, intact entries, non-orphaned headings, PDF links, dark-theme reset, contrast, readable type, margins, clipping, and overlaps. Run `pnpm check` for the complete i18n, build, and print gate.

Node 22.13 or newer is required. After a fresh install, download the test browser once with `pnpm exec playwright install chromium`.

## Notes for Portfolio

- Work Experience organization titles must have a maximum of 3 meaningful words, excluding short articles or prepositions such as `of`. Prefer established abbreviations such as `SAC` when needed.
- Project titles must have a maximum of 2 words.
- Both files (`cv-en.json` and `cv-es.json`) must contain the same content.
- Projects must be sorted by importance (descending order).
- The portfolio must contain exactly 6 projects, active or inactive.
- A stronger new project must replace an existing project; never display more or fewer than 6.
- Project descriptions must not exceed 90 characters (one sentence).
- Projects must not have more than 3 highlights.

## 🔑 License

[MIT](LICENSE)
