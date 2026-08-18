import { readFileSync } from "node:fs"
import { expect, test } from "@playwright/test"

const LOCALES = ["en", "es"] as const
const WIDTHS = [
  320, 360, 390, 393, 420, 480, 560, 620, 700, 701, 768,
] as const

type Locale = (typeof LOCALES)[number]

interface CvFixture {
  basics: { label: string }
  education: Array<{ institution: string }>
  work: Array<{ technologies?: string[]; workMode?: string }>
}

interface Box {
  bottom: number
  height: number
  left: number
  right: number
  top: number
  width: number
}

interface HeroLabelLayout {
  innerWidth: number
  parts: Array<Box & { lineCount: number; text: string }>
  scrollWidth: number
  separators: Array<Box & { visible: boolean }>
}

interface EducationLayout {
  entries: Array<{
    time: Box & { lineCount: number }
    title: Box & { lineCount: number }
  }>
  innerWidth: number
  scrollWidth: number
}

interface ExperienceLayout {
  entries: Array<{
    meta: Box
    modeVisible: boolean
    summary: Box
    usesMobilePlacement: boolean
    visibleMetaCount: number
  }>
  innerWidth: number
  scrollWidth: number
  sectionRight: number
}

for (const locale of LOCALES) {
  test.describe(`${locale.toUpperCase()} responsive contract`, () => {
    test("hero label never strands its separator", async ({ page }) => {
      const cv = loadCv(locale)
      const expectedParts = cv.basics.label.split(" | ")

      expect(
        expectedParts.length,
        "the professional title should keep its two-specialty shape",
      ).toBeGreaterThan(1)

      await page.goto(`/${locale}/`, { waitUntil: "domcontentloaded" })

      for (const width of WIDTHS) {
        await page.setViewportSize({ width, height: 900 })

        const layout = await page.evaluate((): HeroLabelLayout => {
          const box = (element: Element): Box => {
            const rect = element.getBoundingClientRect()
            return {
              bottom: rect.bottom,
              height: rect.height,
              left: rect.left,
              right: rect.right,
              top: rect.top,
              width: rect.width,
            }
          }
          const lineCount = (element: Element): number => {
            const range = document.createRange()
            range.selectNodeContents(element)
            const tops: number[] = []
            for (const rect of range.getClientRects()) {
              if (rect.width <= 0 || rect.height <= 0) continue
              if (tops.every((top) => Math.abs(top - rect.top) > 2)) {
                tops.push(rect.top)
              }
            }
            return tops.length
          }

          return {
            innerWidth: window.innerWidth,
            parts: Array.from(
              document.querySelectorAll("[data-hero-label-part]"),
            ).map((element) => ({
              ...box(element),
              lineCount: lineCount(element),
              text: element.textContent?.trim() ?? "",
            })),
            scrollWidth: document.documentElement.scrollWidth,
            separators: Array.from(
              document.querySelectorAll("[data-hero-label-separator]"),
            ).map((element) => ({
              ...box(element),
              visible:
                getComputedStyle(element).display !== "none" &&
                element.getClientRects().length > 0,
            })),
          }
        })

        expect(
          layout.scrollWidth,
          `no horizontal overflow at ${width}px`,
        ).toBeLessThanOrEqual(layout.innerWidth + 1)
        expect(
          layout.parts.map(({ text }) => text),
          `label content stays canonical at ${width}px`,
        ).toEqual(expectedParts)

        for (const part of layout.parts) {
          expect(
            part.lineCount,
            `"${part.text}" must not wrap internally at ${width}px`,
          ).toBe(1)
        }

        const [first, second] = layout.parts
        const separator = layout.separators[0]

        if (separator?.visible) {
          expect(
            Math.abs(first.top - second.top),
            `visible separator means one visual line at ${width}px`,
          ).toBeLessThanOrEqual(2)
          expect(
            separator.left,
            `separator sits between the parts at ${width}px`,
          ).toBeGreaterThanOrEqual(first.right - 1)
          expect(
            separator.right,
            `separator sits between the parts at ${width}px`,
          ).toBeLessThanOrEqual(second.left + 1)
        } else {
          expect(
            second.top,
            `hidden separator means stacked parts at ${width}px`,
          ).toBeGreaterThanOrEqual(first.bottom - 1)
        }
      }
    })

    test("experience metadata moves below the summary on mobile", async ({
      page,
    }) => {
      const cv = loadCv(locale)

      await page.goto(`/${locale}/`, { waitUntil: "domcontentloaded" })

      for (const width of WIDTHS) {
        await page.setViewportSize({ width, height: 900 })

        const layout = await page.evaluate((): ExperienceLayout => {
          const box = (element: Element): Box => {
            const rect = element.getBoundingClientRect()
            return {
              bottom: rect.bottom,
              height: rect.height,
              left: rect.left,
              right: rect.right,
              top: rect.top,
              width: rect.width,
            }
          }
          const section = document.querySelector(
            '[data-cv-section="experience"]',
          )
          const sectionRight = section?.getBoundingClientRect().right ?? -1
          return {
            entries: Array.from(
              document.querySelectorAll('[data-print-item="experience"]'),
            ).flatMap((article) => {
              const visibleMetas = Array.from(
                article.querySelectorAll(".meta"),
              ).filter(
                (meta) =>
                  getComputedStyle(meta).display !== "none" &&
                  meta.getClientRects().length > 0,
              )
              const meta = visibleMetas[0]
              const summary = article.querySelector("footer > p:first-child")
              if (!meta || !summary) return []

              const mode = meta.querySelector("[data-work-mode]")

              return [
                {
                  meta: box(meta),
                  modeVisible: mode
                    ? mode.getClientRects().length > 0
                    : false,
                  summary: box(summary),
                  usesMobilePlacement:
                    meta.classList.contains("meta--mobile"),
                  visibleMetaCount: visibleMetas.length,
                },
              ]
            }),
            innerWidth: window.innerWidth,
            scrollWidth: document.documentElement.scrollWidth,
            sectionRight,
          }
        })

        expect(
          layout.entries.length,
          `all jobs expose their metadata line at ${width}px`,
        ).toBe(cv.work.length)
        expect(
          layout.scrollWidth,
          `no horizontal overflow at ${width}px`,
        ).toBeLessThanOrEqual(layout.innerWidth + 1)

        for (const entry of layout.entries) {
          expect(
            entry.modeVisible,
            `work mode chip renders at ${width}px`,
          ).toBe(true)
          expect(
            entry.visibleMetaCount,
            `exactly one metadata line renders at ${width}px`,
          ).toBe(1)
          expect(
            entry.meta.right,
            `metadata never spills past the section at ${width}px`,
          ).toBeLessThanOrEqual(layout.sectionRight + 1)

          if (width <= 700) {
            expect(
              entry.usesMobilePlacement,
              `mobile uses the metadata placement below the summary at ${width}px`,
            ).toBe(true)
            expect(
              entry.meta.top,
              `mobile metadata follows the summary at ${width}px`,
            ).toBeGreaterThanOrEqual(entry.summary.bottom - 1)
          } else {
            expect(
              entry.usesMobilePlacement,
              `desktop keeps its original metadata placement at ${width}px`,
            ).toBe(false)
          }
        }
      }
    })

    test("long mobile metadata wraps into two intentional lines", async ({
      page,
    }) => {
      const cv = loadCv(locale)
      const workIndex = cv.work.findIndex(
        ({ technologies }) => (technologies?.length ?? 0) >= 4,
      )
      const technologies = cv.work[workIndex]?.technologies ?? []
      const splitIndex = technologies.length >= 4 ? 2 : technologies.length

      expect(
        workIndex,
        "fixture needs one long technology list",
      ).toBeGreaterThanOrEqual(0)

      await page.goto(`/${locale}/`, { waitUntil: "domcontentloaded" })

      for (const width of [390, 540, 541]) {
        await page.setViewportSize({ width, height: 900 })

        const layout = await page
          .locator('[data-print-item="experience"]')
          .nth(workIndex)
          .evaluate((article) => {
            const meta = article.querySelector<HTMLElement>(".meta--mobile")
            const mode = meta?.querySelector<HTMLElement>(".work-mode")
            const primary = meta?.querySelector<HTMLElement>(
              ".mobile-meta-primary .tech-list",
            )
            const tail = meta?.querySelector<HTMLElement>(
              ".mobile-tech-tail .tech-list",
            )
            const separator = meta?.querySelector<HTMLElement>(
              ".mobile-tech-separator",
            )
            if (!meta || !mode || !primary || !tail || !separator) return null

            const box = (element: Element): Box => {
              const rect = element.getBoundingClientRect()
              return {
                bottom: rect.bottom,
                height: rect.height,
                left: rect.left,
                right: rect.right,
                top: rect.top,
                width: rect.width,
              }
            }

            return {
              meta: box(meta),
              mode: box(mode),
              primary: {
                ...box(primary),
                text: primary.textContent?.trim() ?? "",
              },
              separatorVisible:
                getComputedStyle(separator).display !== "none" &&
                separator.getClientRects().length > 0,
              tail: {
                ...box(tail),
                text: tail.textContent?.trim() ?? "",
              },
            }
          })

        expect(layout).not.toBeNull()
        if (!layout) continue

        expect(layout.primary.text).toBe(
          technologies.slice(0, splitIndex).join(" / "),
        )
        expect(layout.tail.text).toBe(
          technologies.slice(splitIndex).join(" / "),
        )
        expect(
          Math.abs(layout.mode.top - layout.primary.top),
        ).toBeLessThanOrEqual(2)

        if (width <= 540) {
          expect(layout.separatorVisible).toBe(false)
          expect(layout.tail.top).toBeGreaterThanOrEqual(
            Math.max(layout.mode.bottom, layout.primary.bottom) - 1,
          )
          expect(
            Math.abs(layout.tail.left - layout.meta.left),
          ).toBeLessThanOrEqual(1)
        } else {
          expect(layout.separatorVisible).toBe(true)
          expect(
            Math.abs(layout.tail.top - layout.primary.top),
          ).toBeLessThanOrEqual(2)
        }
      }
    })

    test("education header never squeezes dates against the institution", async ({
      page,
    }) => {
      const cv = loadCv(locale)

      await page.goto(`/${locale}/`, { waitUntil: "domcontentloaded" })

      for (const width of WIDTHS) {
        await page.setViewportSize({ width, height: 900 })

        const layout = await page.evaluate((): EducationLayout => {
          const box = (element: Element): Box => {
            const rect = element.getBoundingClientRect()
            return {
              bottom: rect.bottom,
              height: rect.height,
              left: rect.left,
              right: rect.right,
              top: rect.top,
              width: rect.width,
            }
          }
          const lineCount = (element: Element): number => {
            const range = document.createRange()
            range.selectNodeContents(element)
            const tops: number[] = []
            for (const rect of range.getClientRects()) {
              if (rect.width <= 0 || rect.height <= 0) continue
              if (tops.every((top) => Math.abs(top - rect.top) > 2)) {
                tops.push(rect.top)
              }
            }
            return tops.length
          }

          return {
            entries: Array.from(
              document.querySelectorAll('[data-print-item="education"]'),
            ).flatMap((article) => {
              const title = article.querySelector("header h3")
              const time = article.querySelector("header time")
              if (!title || !time) return []

              return [
                {
                  time: { ...box(time), lineCount: lineCount(time) },
                  title: { ...box(title), lineCount: lineCount(title) },
                },
              ]
            }),
            innerWidth: window.innerWidth,
            scrollWidth: document.documentElement.scrollWidth,
          }
        })

        expect(
          layout.entries,
          `both education entries render at ${width}px`,
        ).toHaveLength(cv.education.length)
        expect(
          layout.scrollWidth,
          `no horizontal overflow at ${width}px`,
        ).toBeLessThanOrEqual(layout.innerWidth + 1)

        for (const { time, title } of layout.entries) {
          const overlapWidth =
            Math.min(title.right, time.right) - Math.max(title.left, time.left)
          const overlapHeight =
            Math.min(title.bottom, time.bottom) - Math.max(title.top, time.top)

          expect(
            overlapWidth <= 1 || overlapHeight <= 1,
            `institution and dates never overlap at ${width}px`,
          ).toBe(true)
          expect(
            time.right,
            `dates stay inside the viewport at ${width}px`,
          ).toBeLessThanOrEqual(layout.innerWidth)
          expect(
            time.lineCount,
            `dates stay on a single line at ${width}px`,
          ).toBe(1)
          expect(
            title.lineCount,
            `institution uses at most two lines at ${width}px`,
          ).toBeLessThanOrEqual(2)

          if (width <= 560) {
            expect(
              time.top,
              `single-column education layout at ${width}px`,
            ).toBeGreaterThanOrEqual(title.bottom - 1)
          } else {
            expect(
              time.top,
              `two-column education layout at ${width}px`,
            ).toBeLessThan(title.bottom)
          }
        }
      }
    })
  })
}

function loadCv(locale: Locale): CvFixture {
  const path = new URL(`../../cv-${locale}.json`, import.meta.url)
  return JSON.parse(readFileSync(path, "utf8")) as CvFixture
}
