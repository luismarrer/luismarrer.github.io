import { readFileSync } from "node:fs"
import { expect, test } from "@playwright/test"

const LOCALES = ["en", "es"] as const
const WIDTHS = [320, 360, 390, 393, 420, 480, 560, 620, 700, 768] as const

type Locale = (typeof LOCALES)[number]

interface CvFixture {
  basics: { label: string }
  education: Array<{ institution: string }>
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

    test("experience metadata stays inside the layout at every width", async ({
      page,
    }) => {
      await page.goto(`/${locale}/`, { waitUntil: "domcontentloaded" })

      for (const width of WIDTHS) {
        await page.setViewportSize({ width, height: 900 })

        const layout = await page.evaluate(() => {
          const section = document.querySelector(
            '[data-cv-section="experience"]',
          )
          const sectionRight = section?.getBoundingClientRect().right ?? -1
          return {
            innerWidth: window.innerWidth,
            metas: Array.from(
              document.querySelectorAll(
                '[data-print-item="experience"] .meta',
              ),
            ).map((meta) => {
              const rect = meta.getBoundingClientRect()
              const mode = meta.querySelector("[data-work-mode]")
              return {
                modeVisible: mode
                  ? mode.getClientRects().length > 0
                  : false,
                right: rect.right,
              }
            }),
            scrollWidth: document.documentElement.scrollWidth,
            sectionRight,
          }
        })

        expect(
          layout.metas.length,
          `all four jobs expose their metadata line at ${width}px`,
        ).toBe(4)
        expect(
          layout.scrollWidth,
          `no horizontal overflow at ${width}px`,
        ).toBeLessThanOrEqual(layout.innerWidth + 1)

        for (const meta of layout.metas) {
          expect(
            meta.modeVisible,
            `work mode chip renders at ${width}px`,
          ).toBe(true)
          expect(
            meta.right,
            `metadata never spills past the section at ${width}px`,
          ).toBeLessThanOrEqual(layout.sectionRight + 1)
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
