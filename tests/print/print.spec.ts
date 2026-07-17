import { readFileSync } from "node:fs"
import { expect, test, type Page, type TestInfo } from "@playwright/test"

import {
  canonicalizeHref,
  expectNoOrphanSectionHeadings,
  expectNoSparsePages,
  expectPaperSize,
  expectPdfLinks,
  expectPdfVisualIntegrity,
  expectSectionFlow,
  expectSkillsTypographicLine,
  expectPrintItemsNotSplit,
  extractPdfPages,
  normalizeText,
  type PaperFormat,
  type PrintItemContract,
  type PrintSectionContract,
  waitForPrintAssets,
} from "./pdf-assertions"

const LOCALES = ["en", "es"] as const
const REQUIRED_SECTIONS = [
  "about",
  "experience",
  "projects",
  "education",
  "skills",
] as const

type Locale = (typeof LOCALES)[number]

interface CvFixture {
  basics: {
    email: string
    phone: string
    profiles: Array<{ network: string; url: string }>
    url: string
  }
  education: unknown[]
  projects: Array<{
    name: string
    urls: { gitHub?: string; website: string }
  }>
  skills: Array<{ name: string }>
  work: unknown[]
}

interface DomPrintContract {
  contacts: Array<{ href: string; kind: string; visible: boolean }>
  items: PrintItemContract[]
  projectHrefs: string[]
  sections: PrintSectionContract[]
  styles: {
    bodyBackgroundColor: string
    clippedText: string[]
    heroFigureDisplay: string
    mainPadding: string
    minimumHeadingSizes: Record<string, number>
    minimumLineHeightRatio: number
    minimumTextContrast: number
    minimumTextFontSize: number
    minimumTextOpacity: number
    minimumTextRectHeight: number
    noPrintVisibleCount: number
    overlappingText: string[]
    printableItemBreaks: string[]
    projectBreakBefore: string
    projectCardHeights: number[]
    projectColumnCount: number
    textNodeCount: number
  }
}

for (const locale of LOCALES) {
  test.describe(`${locale.toUpperCase()} print contract`, () => {
    test("Letter PDF is exactly two intact, linked pages", async ({ page }, testInfo) => {
      const cv = loadCv(locale)
      const dom = await preparePrintPage(page, locale, "Letter")

      expectDomContract(dom, cv)

      const pdfBytes = await createPdf(page, "Letter", locale, testInfo)
      const pdfPages = await extractPdfPages(pdfBytes)

      expect(pdfPages, "Letter resume should be exactly two pages").toHaveLength(2)
      expectPaperSize(pdfPages, "Letter")
      expectNoSparsePages(pdfPages)
      expectPdfVisualIntegrity(pdfPages)
      expectPrintItemsNotSplit(pdfPages, dom.items)
      expectNoOrphanSectionHeadings(pdfPages, dom.sections)
      expectSectionFlow(pdfPages, dom.sections)
      expectSkillsList(pdfPages, dom, cv)
      expectPdfLinks(pdfPages, [
        ...expectedContactHrefs(cv),
        ...cv.projects.flatMap(({ urls }) => [
          urls.website,
          ...(urls.gitHub ? [urls.gitHub] : []),
        ]),
      ])
    })

    test("A4 PDF remains a two-page smoke test", async ({ page }, testInfo) => {
      const cv = loadCv(locale)
      const dom = await preparePrintPage(page, locale, "A4")

      expectDomContract(dom, cv)

      const pdfBytes = await createPdf(page, "A4", locale, testInfo)
      const pdfPages = await extractPdfPages(pdfBytes)

      expect(pdfPages, "A4 resume should remain exactly two pages").toHaveLength(2)
      expectPaperSize(pdfPages, "A4")
      expectNoSparsePages(pdfPages)
      expectPdfVisualIntegrity(pdfPages)
      expectPrintItemsNotSplit(pdfPages, dom.items)
      expectNoOrphanSectionHeadings(pdfPages, dom.sections)
      expectSectionFlow(pdfPages, dom.sections)
      expectSkillsList(pdfPages, dom, cv)
    })
  })
}

function expectSkillsList(
  pdfPages: Awaited<ReturnType<typeof extractPdfPages>>,
  dom: DomPrintContract,
  cv: CvFixture,
): void {
  const skillsSection = dom.sections.find(({ id }) => id === "skills")

  expect(skillsSection, "the skills section needs a printable heading").toBeDefined()
  expectSkillsTypographicLine(
    pdfPages,
    skillsSection?.heading ?? "",
    cv.skills.map(({ name }) => name),
  )
}

async function preparePrintPage(
  page: Page,
  locale: Locale,
  format: PaperFormat,
): Promise<DomPrintContract> {
  const viewport =
    format === "Letter"
      ? { width: 716, height: 964 }
      : { width: 694, height: 1030 }
  const theme = format === "Letter" ? "light" : "dark"

  await page.setViewportSize(viewport)
  await page.addInitScript((printTheme) => {
    localStorage.setItem("theme", printTheme)
  }, theme)
  await page.goto(`/${locale}/`, { waitUntil: "domcontentloaded" })
  await waitForPrintAssets(page)

  return page.evaluate(() => {
    const normalize = (value: string | null | undefined) =>
      (value ?? "")
        .normalize("NFKC")
        .replace(/[\u00ad\u200b]/g, "")
        .replace(/[\u00a0\u202f]/g, " ")
        .replace(/[‐‑‒–—−]/g, "-")
        .replace(/\s+/g, " ")
        .trim()

    const textChunks = (element: Element): string[] => {
      const chunks: string[] = []
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
      let node = walker.nextNode()

      while (node) {
        const chunk = normalize(node.nodeValue)
        if (chunk && /[\p{L}\p{N}]/u.test(chunk)) chunks.push(chunk)
        node = walker.nextNode()
      }

      return [...new Set(chunks)]
    }

    const primaryText = (element: Element): string => {
      const primary = element.querySelector("h3 a, h3, span")
      return normalize(primary?.textContent ?? textChunks(element)[0])
    }

    const probe = (value: string): string =>
      normalize(value).split(" ").slice(0, 6).join(" ")

    const items = Array.from(
      document.querySelectorAll<HTMLElement>("[data-print-item]"),
    ).map((element, index) => ({
      chunks: textChunks(element),
      kind: element.dataset.printItem ?? "unknown",
      label: primaryText(element) || `item-${index + 1}`,
    }))

    const sections = Array.from(
      document.querySelectorAll<HTMLElement>("[data-cv-section]"),
    ).flatMap((section) => {
      const heading = section.querySelector("h2")
      if (!heading) return []

      const firstItem = section.querySelector("[data-print-item]")
      const firstContent = firstItem
        ? primaryText(firstItem)
        : normalize(section.querySelector("p")?.textContent)

      return [
        {
          heading: normalize(heading.textContent),
          id: section.dataset.cvSection ?? "unknown",
          probe: probe(firstContent),
        },
      ]
    })

    const contacts = Array.from(
      document.querySelectorAll<HTMLAnchorElement>("a[data-print-contact]"),
    ).map((anchor) => ({
      href: anchor.getAttribute("href") ?? "",
      kind: anchor.dataset.printContact ?? "unknown",
      visible:
        getComputedStyle(anchor).display !== "none" &&
        anchor.getClientRects().length > 0,
    }))

    const projectHrefs = Array.from(
      document.querySelectorAll<HTMLElement>('[data-print-item="project"]'),
    ).map(
      (project) =>
        project.querySelector<HTMLAnchorElement>("h3 a[href]")?.href ?? "",
    )

    const main = document.querySelector("main")
    const heroFigure = document.querySelector(
      '[data-cv-section="profile"] figure',
    )
    const projectsSection = document.querySelector(
      '[data-cv-section="projects"]',
    )
    const projectsGrid = document.querySelector("#projects")
    const printableItems = Array.from(
      document.querySelectorAll<HTMLElement>(
        '[data-print-item]:not([data-print-item="skill"])',
      ),
    )
    const noPrintVisibleCount = Array.from(
      document.querySelectorAll<HTMLElement>(".no-print"),
    ).filter(
      (element) =>
        getComputedStyle(element).display !== "none" &&
        element.getClientRects().length > 0,
    ).length
    const projectCardHeights = Array.from(
      document.querySelectorAll<HTMLElement>('[data-print-item="project"]'),
    ).map((card) => card.getBoundingClientRect().height)
    const projectColumns = projectsGrid
      ? getComputedStyle(projectsGrid).gridTemplateColumns
          .split(/\s+/)
          .filter(Boolean)
      : []
    const textMetrics: Array<{
      contrast: number
      fontSize: number
      lineHeightRatio: number
      opacity: number
      rectHeight: number
    }> = []
    const clippedText: string[] = []
    const overlappingText: string[] = []

    const colorAgainstWhite = (value: string) => {
      const channels = value.match(/[\d.]+/g)?.map(Number)
      if (!channels || channels.length < 3) {
        return { alpha: 0, contrast: 1 }
      }

      const alpha = channels[3] ?? 1
      const composite = channels.slice(0, 3).map((channel) =>
        (channel / 255) * alpha + (1 - alpha),
      )
      const linearize = (channel: number) =>
        channel <= 0.04045
          ? channel / 12.92
          : ((channel + 0.055) / 1.055) ** 2.4
      const luminance =
        0.2126 * linearize(composite[0]) +
        0.7152 * linearize(composite[1]) +
        0.0722 * linearize(composite[2])

      return { alpha, contrast: 1.05 / (luminance + 0.05) }
    }

    if (main) {
      const mainRect = main.getBoundingClientRect()
      const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT)
      let textNode = walker.nextNode()

      while (textNode) {
        const content = normalize(textNode.nodeValue)
        const parent = textNode.parentElement

        if (parent && /[\p{L}\p{N}]/u.test(content)) {
          const range = document.createRange()
          range.selectNodeContents(textNode)
          const rects = Array.from(range.getClientRects()).filter(
            ({ height, width }) => height > 0 && width > 0,
          )

          if (rects.length > 0) {
            const computed = getComputedStyle(parent)
            const fontSize = Number.parseFloat(computed.fontSize)
            const numericLineHeight = Number.parseFloat(computed.lineHeight)
            const lineHeightRatio = Number.isFinite(numericLineHeight)
              ? numericLineHeight / fontSize
              : 1.2
            const color = colorAgainstWhite(computed.color)
            const textFill = colorAgainstWhite(
              computed.getPropertyValue("-webkit-text-fill-color") ||
                computed.color,
            )
            let effectiveOpacity = Math.min(color.alpha, textFill.alpha)
            let ancestor: HTMLElement | null = parent

            while (ancestor) {
              effectiveOpacity *= Number.parseFloat(
                getComputedStyle(ancestor).opacity,
              )
              if (ancestor === main) break
              ancestor = ancestor.parentElement
            }

            for (const rect of rects) {
              textMetrics.push({
                contrast: Math.min(color.contrast, textFill.contrast),
                fontSize,
                lineHeightRatio,
                opacity: effectiveOpacity,
                rectHeight: rect.height,
              })

              if (
                rect.left < mainRect.left - 2 ||
                rect.right > mainRect.right + 2
              ) {
                clippedText.push(`${content.slice(0, 40)} (outside main)`)
              }
            }

            if (
              computed.textOverflow !== "clip" ||
              computed.textShadow !== "none" ||
              (computed.getPropertyValue("-webkit-line-clamp") !== "none" &&
                computed.getPropertyValue("-webkit-line-clamp") !== "")
            ) {
              clippedText.push(`${content.slice(0, 40)} (text effect)`)
            }
          }
        }

        textNode = walker.nextNode()
      }

      for (const element of [
        main,
        ...Array.from(main.querySelectorAll<HTMLElement>("*")),
      ]) {
        const computed = getComputedStyle(element)
        const clipsHorizontally = ["clip", "hidden"].includes(
          computed.overflowX,
        )
        const clipsVertically = ["clip", "hidden"].includes(computed.overflowY)

        if (
          (clipsHorizontally && element.scrollWidth > element.clientWidth + 2) ||
          (clipsVertically && element.scrollHeight > element.clientHeight + 2)
        ) {
          clippedText.push(
            `${normalize(element.textContent).slice(0, 40)} (overflow)`,
          )
        }
      }

      const logicalBoxes = Array.from(
        main.querySelectorAll<HTMLElement>(
          '[data-cv-section="profile"] h1, [data-cv-section="profile"] .info > p, .print-contacts, [data-cv-section] > h2, [data-print-item] h3, [data-print-item] p, [data-print-item] time, [data-print-item="project"] .highlights, [data-print-item="skill"]',
        ),
      ).filter((element) => element.getClientRects().length > 0)

      for (let leftIndex = 0; leftIndex < logicalBoxes.length; leftIndex += 1) {
        const left = logicalBoxes[leftIndex]
        const leftRect = left.getBoundingClientRect()

        for (
          let rightIndex = leftIndex + 1;
          rightIndex < logicalBoxes.length;
          rightIndex += 1
        ) {
          const right = logicalBoxes[rightIndex]
          if (left.contains(right) || right.contains(left)) continue

          const rightRect = right.getBoundingClientRect()
          const overlapWidth =
            Math.min(leftRect.right, rightRect.right) -
            Math.max(leftRect.left, rightRect.left)
          const overlapHeight =
            Math.min(leftRect.bottom, rightRect.bottom) -
            Math.max(leftRect.top, rightRect.top)

          if (overlapWidth > 2 && overlapHeight > 2) {
            overlappingText.push(
              `${normalize(left.textContent).slice(0, 24)} ↔ ${normalize(right.textContent).slice(0, 24)}`,
            )
          }
        }
      }
    }

    const minimumHeadingSizes = Object.fromEntries(
      ["h1", "h2", "h3"].map((selector) => {
        const sizes = Array.from(
          document.querySelectorAll<HTMLElement>(selector),
        )
          .filter((element) => element.getClientRects().length > 0)
          .map((element) => Number.parseFloat(getComputedStyle(element).fontSize))

        return [selector, sizes.length > 0 ? Math.min(...sizes) : 0]
      }),
    )
    const styles = {
      bodyBackgroundColor: getComputedStyle(document.body).backgroundColor,
      clippedText,
      heroFigureDisplay: heroFigure
        ? getComputedStyle(heroFigure).display
        : "missing",
      mainPadding: main ? getComputedStyle(main).padding : "missing",
      minimumHeadingSizes,
      minimumLineHeightRatio:
        textMetrics.length > 0
          ? Math.min(...textMetrics.map(({ lineHeightRatio }) => lineHeightRatio))
          : 0,
      minimumTextContrast:
        textMetrics.length > 0
          ? Math.min(...textMetrics.map(({ contrast }) => contrast))
          : 0,
      minimumTextFontSize:
        textMetrics.length > 0
          ? Math.min(...textMetrics.map(({ fontSize }) => fontSize))
          : 0,
      minimumTextOpacity:
        textMetrics.length > 0
          ? Math.min(...textMetrics.map(({ opacity }) => opacity))
          : 0,
      minimumTextRectHeight:
        textMetrics.length > 0
          ? Math.min(...textMetrics.map(({ rectHeight }) => rectHeight))
          : 0,
      noPrintVisibleCount,
      overlappingText,
      printableItemBreaks: [
        ...new Set(
          printableItems.map((element) => getComputedStyle(element).breakInside),
        ),
      ],
      projectBreakBefore: projectsSection
        ? getComputedStyle(projectsSection).breakBefore
        : "missing",
      projectCardHeights,
      projectColumnCount: projectColumns.length,
      textNodeCount: textMetrics.length,
    }

    return { contacts, items, projectHrefs, sections, styles }
  })
}

async function createPdf(
  page: Page,
  format: PaperFormat,
  locale: Locale,
  testInfo: TestInfo,
): Promise<Uint8Array> {
  const pdf = await page.pdf({
    displayHeaderFooter: false,
    format,
    preferCSSPageSize: false,
    printBackground: true,
  })

  await testInfo.attach(`${locale}-${format.toLowerCase()}.pdf`, {
    body: pdf,
    contentType: "application/pdf",
  })

  return pdf
}

function expectDomContract(dom: DomPrintContract, cv: CvFixture): void {
  const expectedCounts: Record<string, number> = {
    education: cv.education.length,
    experience: cv.work.length,
    project: cv.projects.length,
    skill: cv.skills.length,
  }

  expect(cv.projects, "the printed portfolio must keep six projects").toHaveLength(
    6,
  )

  for (const [kind, count] of Object.entries(expectedCounts)) {
    expect(
      dom.items.filter((item) => item.kind === kind),
      `every ${kind} entry needs data-print-item="${kind}"`,
    ).toHaveLength(count)
  }

  expect(
    dom.sections.map(({ id }) => id).sort(),
    "all printable sections need stable data-cv-section markers",
  ).toEqual([...REQUIRED_SECTIONS].sort())

  for (const section of dom.sections) {
    expect(section.heading, `${section.id} needs a printable h2`).not.toBe("")
    expect(section.probe, `${section.id} needs content after its h2`).not.toBe("")
  }

  const expectedContacts = expectedContactMap(cv)
  expect(
    dom.contacts.map(({ kind }) => kind).sort(),
    "print contacts must expose the four stable data-print-contact markers",
  ).toEqual(Object.keys(expectedContacts).sort())

  for (const contact of dom.contacts) {
    expect(contact.visible, `${contact.kind} must be visible in print media`).toBe(
      true,
    )
    expect(canonicalizeHref(contact.href)).toBe(
      canonicalizeHref(expectedContacts[contact.kind]),
    )
  }

  expect(dom.projectHrefs.map(canonicalizeHref)).toEqual(
    cv.projects.map(({ urls }) => canonicalizeHref(urls.website)),
  )

  expect(
    dom.styles.bodyBackgroundColor,
    "print must reset light and dark themes to white paper",
  ).toBe("rgb(255, 255, 255)")
  expect(
    dom.styles.textNodeCount,
    "print needs measurable visible text",
  ).toBeGreaterThan(50)
  expect(
    dom.styles.minimumTextFontSize,
    "print text must stay readable",
  ).toBeGreaterThanOrEqual(9)
  expect(
    dom.styles.minimumTextRectHeight,
    "print text must not be visually collapsed by transforms",
  ).toBeGreaterThanOrEqual(6)
  expect(
    dom.styles.minimumTextContrast,
    "print text must retain accessible contrast on white paper",
  ).toBeGreaterThanOrEqual(4.5)
  expect(
    dom.styles.minimumTextOpacity,
    "print text must remain fully visible",
  ).toBeGreaterThanOrEqual(0.99)
  expect(
    dom.styles.minimumLineHeightRatio,
    "print lines must retain readable leading",
  ).toBeGreaterThanOrEqual(1.04)
  expect(dom.styles.minimumHeadingSizes.h1).toBeGreaterThanOrEqual(28)
  expect(dom.styles.minimumHeadingSizes.h2).toBeGreaterThanOrEqual(18)
  expect(dom.styles.minimumHeadingSizes.h3).toBeGreaterThanOrEqual(13)
  expect(
    dom.styles.clippedText,
    "print text must not be clipped, truncated, or shadowed",
  ).toEqual([])
  expect(
    dom.styles.overlappingText,
    "print content blocks must not overlap",
  ).toEqual([])
  expect(dom.styles.heroFigureDisplay, "the web portrait must not print").toBe(
    "none",
  )
  expect(dom.styles.mainPadding, "print @page margins replace web padding").toBe(
    "0px",
  )
  expect(
    dom.styles.noPrintVisibleCount,
    "web-only controls must stay out of the PDF",
  ).toBe(0)
  expect(
    dom.styles.projectBreakBefore,
    "projects must flow into available space, not force a page break",
  ).toBe("auto")
  expect(
    dom.styles.projectCardHeights,
    "the print grid must measure all six project cards",
  ).toHaveLength(6)
  expect(
    Math.max(...dom.styles.projectCardHeights) -
      Math.min(...dom.styles.projectCardHeights),
    "printed project cards must share the same height (≤ 1px spread)",
  ).toBeLessThanOrEqual(1)
  expect(
    dom.styles.projectColumnCount,
    "projects must keep their two-column print grid",
  ).toBe(2)
  expect(
    dom.styles.printableItemBreaks.length > 0 &&
      dom.styles.printableItemBreaks.every((value) =>
        ["avoid", "avoid-page"].includes(value),
      ),
    "experience, project, and education entries must resist page splits",
  ).toBe(true)
}

function expectedContactMap(cv: CvFixture): Record<string, string> {
  const linkedin = cv.basics.profiles.find(
    ({ network }) => normalizeText(network) === "linkedin",
  )

  if (!linkedin) throw new Error("CV fixture needs a LinkedIn profile")

  return {
    email: `mailto:${cv.basics.email}`,
    phone: `tel:${cv.basics.phone}`,
    website: cv.basics.url,
    linkedin: linkedin.url,
  }
}

function expectedContactHrefs(cv: CvFixture): string[] {
  return Object.values(expectedContactMap(cv))
}

function loadCv(locale: Locale): CvFixture {
  const path = new URL(`../../cv-${locale}.json`, import.meta.url)
  return JSON.parse(readFileSync(path, "utf8")) as CvFixture
}
