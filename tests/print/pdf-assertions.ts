import { expect, type Page } from "@playwright/test"
import { getDocument, OPS } from "pdfjs-dist/legacy/build/pdf.mjs"

export type PaperFormat = "Letter" | "A4"

export interface PrintItemContract {
  chunks: string[]
  kind: string
  label: string
}

export interface PrintSectionContract {
  heading: string
  id: string
  probe: string
}

export interface ExtractedPdfPage {
  height: number
  lines: string[]
  links: string[]
  number: number
  text: string
  textContrasts: number[]
  textItems: PositionedText[]
  visualText: string
  width: number
}

export interface PositionedText {
  bottom: number
  height: number
  str: string
  top: number
  width: number
  x: number
  y: number
}

const PAPER_SIZE_POINTS: Record<
  PaperFormat,
  { height: number; width: number }
> = {
  Letter: { width: 8.5 * 72, height: 11 * 72 },
  A4: { width: (210 / 25.4) * 72, height: (297 / 25.4) * 72 },
}

export function normalizeText(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[\u00ad\u200b]/g, "")
    .replace(/[\u00a0\u202f]/g, " ")
    .replace(/[‐‑‒–—−]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("en-US")
}

export function canonicalizeHref(value: string): string {
  const href = value.trim().replace(/\u0000/g, "")
  const schemeMatch = /^(mailto|tel):/i.exec(href)

  if (schemeMatch) {
    const scheme = schemeMatch[1].toLowerCase()
    return `${scheme}:${href.slice(schemeMatch[0].length)}`
  }

  try {
    const url = new URL(href)
    url.hash = ""
    return url.toString()
  } catch {
    return href
  }
}

export async function waitForPrintAssets(page: Page): Promise<void> {
  await page.emulateMedia({
    colorScheme: "light",
    media: "print",
    reducedMotion: "reduce",
  })

  await page.evaluate(async () => {
    await document.fonts.ready

    await Promise.all(
      Array.from(document.images)
        .filter(
          (image) =>
            getComputedStyle(image).display !== "none" &&
            image.getClientRects().length > 0,
        )
        .map(
          (image) =>
            new Promise<void>((resolve, reject) => {
              const verify = () => {
                if (image.naturalWidth > 0 && image.naturalHeight > 0) {
                  resolve()
                  return
                }

                reject(
                  new Error(`Print image failed to load: ${image.currentSrc}`),
                )
              }

              if (image.complete) {
                verify()
                return
              }

              image.addEventListener("load", verify, { once: true })
              image.addEventListener(
                "error",
                () =>
                  reject(
                    new Error(`Print image failed to load: ${image.src}`),
                  ),
                { once: true },
              )
            }),
        ),
    )

    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    )
  })
}

export async function extractPdfPages(
  bytes: Uint8Array,
): Promise<ExtractedPdfPage[]> {
  const loadingTask = getDocument({ data: new Uint8Array(bytes) })
  const pdf = await loadingTask.promise
  const pages: ExtractedPdfPage[] = []

  try {
    for (let number = 1; number <= pdf.numPages; number += 1) {
      const pdfPage = await pdf.getPage(number)
      const viewport = pdfPage.getViewport({ scale: 1 })
      const textContent = await pdfPage.getTextContent()
      const positionedText = textContent.items.flatMap<PositionedText>(
        (item) => {
          if (!("str" in item)) return []

          const x = item.transform[4]
          const y = item.transform[5]
          if (typeof x !== "number" || typeof y !== "number") return []

          const fontSize =
            Math.hypot(item.transform[2], item.transform[3]) || item.height
          const style = textContent.styles[item.fontName]
          const ascent = Number.isFinite(style?.ascent) ? style.ascent : 0.8
          const descent = Number.isFinite(style?.descent) ? style.descent : -0.2

          return [
            {
              bottom: y + descent * fontSize,
              height: item.height,
              str: item.str,
              top: y + ascent * fontSize,
              width: item.width,
              x,
              y,
            },
          ]
        },
      )
      const lines = buildVisualLines(positionedText)
      const annotations = await pdfPage.getAnnotations()
      const operatorList = await pdfPage.getOperatorList()
      const links = annotations
        .map(annotationHref)
        .filter((href): href is string => Boolean(href))
        .map(canonicalizeHref)

      pages.push({
        height: viewport.height,
        lines,
        links,
        number,
        text: normalizeText(positionedText.map(({ str }) => str).join(" ")),
        textContrasts: extractTextContrasts(
          operatorList.fnArray,
          operatorList.argsArray,
        ),
        textItems: positionedText,
        visualText: normalizeText(lines.join(" ")),
        width: viewport.width,
      })

      pdfPage.cleanup()
    }
  } finally {
    await loadingTask.destroy()
  }

  return pages
}

export function expectPaperSize(
  pages: ExtractedPdfPage[],
  format: PaperFormat,
): void {
  const expected = PAPER_SIZE_POINTS[format]
  const tolerance = 1

  for (const page of pages) {
    expect(
      Math.abs(page.width - expected.width),
      `page ${page.number} width should be ${expected.width.toFixed(2)}pt (${format})`,
    ).toBeLessThanOrEqual(tolerance)
    expect(
      Math.abs(page.height - expected.height),
      `page ${page.number} height should be ${expected.height.toFixed(2)}pt (${format})`,
    ).toBeLessThanOrEqual(tolerance)
    expect(page.width, `page ${page.number} should be portrait`).toBeLessThan(
      page.height,
    )
  }
}

export function expectNoSparsePages(pages: ExtractedPdfPage[]): void {
  for (const page of pages) {
    expect(
      page.text.length,
      `page ${page.number} should contain meaningful resume content`,
    ).toBeGreaterThan(300)
  }
}

export function expectPdfVisualIntegrity(pages: ExtractedPdfPage[]): void {
  const minimumMargin = 24
  const minimumTextHeight = 7
  const minimumMedianTextHeight = 8
  const minimumContrast = 4.5
  // Page 1 carries the hero through the first project rows; page 2 only
  // needs the remaining row plus Education and Skills, so trailing free
  // space there is deliberate (see docs/roadmap.md R0.4.2).
  const minimumVerticalSpan = [400, 170]

  for (const page of pages) {
    const textItems = page.textItems.filter(({ str }) => normalizeText(str))
    const heights = textItems.map(({ height }) => height).sort((a, b) => a - b)
    const collisions: string[] = []
    const outOfBounds: string[] = []

    expect(
      textItems.length,
      `page ${page.number} needs measurable text geometry`,
    ).toBeGreaterThan(0)
    expect(
      heights[0],
      `page ${page.number} must not contain unreadably small text`,
    ).toBeGreaterThanOrEqual(minimumTextHeight)
    expect(
      heights[Math.floor(heights.length / 2)],
      `page ${page.number} needs a readable median text size`,
    ).toBeGreaterThanOrEqual(minimumMedianTextHeight)
    expect(
      Math.max(...textItems.map(({ top }) => top)) -
        Math.min(...textItems.map(({ bottom }) => bottom)),
      `page ${page.number} content must retain its editorial vertical rhythm`,
    ).toBeGreaterThanOrEqual(minimumVerticalSpan[page.number - 1])

    for (const item of textItems) {
      const right = item.x + item.width
      if (
        item.x < minimumMargin ||
        right > page.width - minimumMargin ||
        item.bottom < minimumMargin ||
        item.top > page.height - minimumMargin
      ) {
        outOfBounds.push(
          `"${item.str.slice(0, 40)}" at (${item.x.toFixed(1)}, ${item.y.toFixed(1)})`,
        )
      }
    }

    for (let leftIndex = 0; leftIndex < textItems.length; leftIndex += 1) {
      const left = textItems[leftIndex]

      for (
        let rightIndex = leftIndex + 1;
        rightIndex < textItems.length;
        rightIndex += 1
      ) {
        const right = textItems[rightIndex]
        const minimumWidth = Math.min(left.width, right.width)
        const minimumHeight = Math.min(
          left.top - left.bottom,
          right.top - right.bottom,
        )
        const overlapWidth =
          Math.min(left.x + left.width, right.x + right.width) -
          Math.max(left.x, right.x)
        const overlapHeight =
          Math.min(left.top, right.top) - Math.max(left.bottom, right.bottom)

        if (
          overlapWidth > Math.max(0.75, minimumWidth * 0.05) &&
          overlapHeight > Math.max(0.5, minimumHeight * 0.2)
        ) {
          collisions.push(
            `"${left.str.slice(0, 24)}" ↔ "${right.str.slice(0, 24)}"`,
          )
        }
      }
    }

    expect(
      outOfBounds,
      `page ${page.number} text must stay inside safe print margins`,
    ).toEqual([])
    expect(
      collisions,
      `page ${page.number} text boxes must not overlap`,
    ).toEqual([])
    expect(
      page.textContrasts.length,
      `page ${page.number} needs measurable text colors`,
    ).toBeGreaterThan(0)
    expect(
      Math.min(...page.textContrasts),
      `page ${page.number} text must remain legible against white paper`,
    ).toBeGreaterThanOrEqual(minimumContrast)
  }
}

export function expectPdfLinks(
  pages: ExtractedPdfPage[],
  expectedHrefs: string[],
): void {
  const actual = new Set(pages.flatMap(({ links }) => links))

  for (const href of expectedHrefs) {
    const canonicalHref = canonicalizeHref(href)
    expect(
      actual.has(canonicalHref),
      `PDF should contain a clickable annotation for ${canonicalHref}. Found: ${[
        ...actual,
      ].join(", ")}`,
    ).toBe(true)
  }
}

export function expectPrintItemsNotSplit(
  pages: ExtractedPdfPage[],
  items: PrintItemContract[],
): void {
  for (const item of items) {
    expect(
      item.chunks.length,
      `${item.kind} item "${item.label}" needs printable text probes`,
    ).toBeGreaterThan(0)

    const containingPages = pages.filter((page) =>
      item.chunks.every((chunk) => pageContains(page, chunk)),
    )

    expect(
      containingPages.length,
      `${item.kind} item "${item.label}" is missing from the PDF`,
    ).toBeGreaterThan(0)

    // A one-word skill can legitimately occur elsewhere in the resume, so its
    // text alone cannot identify a unique page. Multi-line entries must map to
    // exactly one page, which catches a page break inside the entry.
    if (item.kind !== "skill") {
      expect(
        containingPages.map(({ number }) => number),
        `${item.kind} item "${item.label}" is split across pages`,
      ).toHaveLength(1)
    }
  }
}

export function expectNoOrphanSectionHeadings(
  pages: ExtractedPdfPage[],
  sections: PrintSectionContract[],
): void {
  for (const section of sections) {
    const normalizedHeading = normalizeText(section.heading)
    const matches = pages.flatMap((page) =>
      page.lines.flatMap((line, lineIndex) =>
        line === normalizedHeading ? [{ lineIndex, page }] : [],
      ),
    )

    expect(
      matches.length,
      `section heading "${section.heading}" should occur on one PDF page`,
    ).toBe(1)

    const match = matches[0]
    const followingText = normalizeText(
      match.page.lines.slice(match.lineIndex + 1).join(" "),
    )

    expect(
      followingText.includes(normalizeText(section.probe)),
      `section heading "${section.heading}" is orphaned from its first content on page ${match.page.number}`,
    ).toBe(true)
  }
}

export function expectSectionFlow(
  pages: ExtractedPdfPage[],
  sections: PrintSectionContract[],
): void {
  let previous = { id: "start", page: 1 }

  for (const [index, section] of sections.entries()) {
    const page = pages.find((candidate) =>
      candidate.lines.includes(normalizeText(section.heading)),
    )?.number

    expect(
      page,
      `section "${section.id}" must appear on some PDF page`,
    ).toBeDefined()
    if (index === 0) {
      expect(
        page,
        `the resume must open with "${section.id}" on page 1`,
      ).toBe(1)
    }
    expect(
      page ?? 0,
      `section "${section.id}" must not start before "${previous.id}" (editorial order)`,
    ).toBeGreaterThanOrEqual(previous.page)

    previous = { id: section.id, page: page ?? 0 }
  }
}

export function expectSkillsTypographicLine(
  pages: ExtractedPdfPage[],
  heading: string,
  skillNames: string[],
): void {
  const normalizedHeading = normalizeText(heading)
  const match = pages.flatMap((page) =>
    page.lines.flatMap((line, lineIndex) =>
      line === normalizedHeading ? [{ lineIndex, page }] : [],
    ),
  )[0]

  expect(match, `skills heading "${heading}" must exist in the PDF`).toBeDefined()

  const printedList = normalizeText(
    match.page.lines.slice(match.lineIndex + 1).join(" "),
  )

  expect(
    printedList,
    "print skills must be a single comma-separated list, each skill exactly once and in order",
  ).toBe(normalizeText(skillNames.join(", ")))
}

function pageContains(page: ExtractedPdfPage, chunk: string): boolean {
  const normalizedChunk = normalizeText(chunk)
  return (
    page.text.includes(normalizedChunk) ||
    page.visualText.includes(normalizedChunk)
  )
}

function buildVisualLines(items: PositionedText[]): string[] {
  const lines: Array<{ items: PositionedText[]; y: number }> = []
  const baselineTolerance = 1.5
  const sorted = [...items].sort((left, right) => {
    if (Math.abs(left.y - right.y) > baselineTolerance) {
      return right.y - left.y
    }
    return left.x - right.x
  })

  for (const item of sorted) {
    if (!normalizeText(item.str)) continue

    const line = lines.find(
      (candidate) => Math.abs(candidate.y - item.y) <= baselineTolerance,
    )

    if (line) {
      line.items.push(item)
      continue
    }

    lines.push({ items: [item], y: item.y })
  }

  return lines
    .sort((left, right) => right.y - left.y)
    .map(({ items: lineItems }) =>
      normalizeText(
        lineItems
          .sort((left, right) => left.x - right.x)
          .map(({ str }) => str)
          .join(" "),
      ),
    )
    .filter(Boolean)
}

function annotationHref(value: unknown): string | undefined {
  if (!isRecord(value)) return undefined
  if (typeof value.url === "string") return value.url
  if (typeof value.unsafeUrl === "string") return value.unsafeUrl
  return undefined
}

type RgbColor = [number, number, number]
interface PaintState {
  fillAlpha: number
  fillColor: RgbColor
  strokeAlpha: number
  strokeColor: RgbColor
  textRenderingMode: number
}

function extractTextContrasts(
  operations: number[],
  operationArguments: unknown[],
): number[] {
  let state: PaintState = {
    fillAlpha: 1,
    fillColor: [0, 0, 0],
    strokeAlpha: 1,
    strokeColor: [0, 0, 0],
    textRenderingMode: 0,
  }
  const stateStack: PaintState[] = []
  const contrasts: number[] = []

  for (let index = 0; index < operations.length; index += 1) {
    const operation = operations[index]
    const args = operationArguments[index]

    if (operation === OPS.save) {
      stateStack.push(clonePaintState(state))
      continue
    }

    if (operation === OPS.restore) {
      state = stateStack.pop() ?? state
      continue
    }

    if ([OPS.setFillRGBColor, OPS.setFillColor].includes(operation)) {
      state.fillColor = parseRgbColor(args) ?? state.fillColor
      continue
    }

    if (operation === OPS.setFillGray) {
      const gray = parseColorChannels(args, 1)?.[0]
      if (gray !== undefined) state.fillColor = [gray, gray, gray]
      continue
    }

    if (operation === OPS.setFillCMYKColor) {
      const channels = parseColorChannels(args, 4)
      if (channels) state.fillColor = cmykToRgb(channels)
      continue
    }

    if ([OPS.setStrokeRGBColor, OPS.setStrokeColor].includes(operation)) {
      state.strokeColor = parseRgbColor(args) ?? state.strokeColor
      continue
    }

    if (operation === OPS.setStrokeGray) {
      const gray = parseColorChannels(args, 1)?.[0]
      if (gray !== undefined) state.strokeColor = [gray, gray, gray]
      continue
    }

    if (operation === OPS.setStrokeCMYKColor) {
      const channels = parseColorChannels(args, 4)
      if (channels) state.strokeColor = cmykToRgb(channels)
      continue
    }

    if (operation === OPS.setFillTransparent) {
      state.fillAlpha = 0
      continue
    }

    if (operation === OPS.setStrokeTransparent) {
      state.strokeAlpha = 0
      continue
    }

    if (operation === OPS.setGState) {
      for (const [key, value] of parseGraphicsState(args)) {
        if (key === "ca" && typeof value === "number") state.fillAlpha = value
        if (key === "CA" && typeof value === "number") state.strokeAlpha = value
      }
      continue
    }

    if (operation === OPS.setTextRenderingMode) {
      const mode = Array.isArray(args) ? args[0] : undefined
      if (typeof mode === "number") state.textRenderingMode = mode
      continue
    }

    if (
      [
        OPS.showText,
        OPS.showSpacedText,
        OPS.nextLineShowText,
        OPS.nextLineSetSpacingShowText,
      ].includes(operation) &&
      containsSemanticGlyph(args)
    ) {
      const paintContrasts: number[] = []

      if ([0, 2, 4, 6].includes(state.textRenderingMode)) {
        paintContrasts.push(
          contrastAgainstWhite(state.fillColor, state.fillAlpha),
        )
      }
      if ([1, 2, 5, 6].includes(state.textRenderingMode)) {
        paintContrasts.push(
          contrastAgainstWhite(state.strokeColor, state.strokeAlpha),
        )
      }

      contrasts.push(paintContrasts.length > 0 ? Math.max(...paintContrasts) : 1)
    }
  }

  return contrasts
}

function clonePaintState(state: PaintState): PaintState {
  return {
    ...state,
    fillColor: [...state.fillColor],
    strokeColor: [...state.strokeColor],
  }
}

function parseGraphicsState(value: unknown): Array<[string, unknown]> {
  if (!Array.isArray(value) || !Array.isArray(value[0])) return []

  return value[0].flatMap((entry) =>
    Array.isArray(entry) && typeof entry[0] === "string"
      ? [[entry[0], entry[1]] as [string, unknown]]
      : [],
  )
}

function parseRgbColor(value: unknown): RgbColor | undefined {
  if (!Array.isArray(value)) return undefined

  const serialized = value[0]
  if (typeof serialized === "string") {
    const match = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(serialized)
    if (!match) return undefined

    return [
      Number.parseInt(match[1], 16) / 255,
      Number.parseInt(match[2], 16) / 255,
      Number.parseInt(match[3], 16) / 255,
    ]
  }

  const channels = parseColorChannels(value, 3)
  return channels ? [channels[0], channels[1], channels[2]] : undefined
}

function parseColorChannels(
  value: unknown,
  count: number,
): number[] | undefined {
  if (!Array.isArray(value)) return undefined

  const channels = value.slice(0, count)
  if (
    channels.length !== count ||
    channels.some((channel) => typeof channel !== "number")
  ) {
    return undefined
  }

  const numericChannels = channels as number[]
  const scale = numericChannels.some((channel) => channel > 1) ? 255 : 1
  return numericChannels.map((channel) =>
    Math.min(1, Math.max(0, channel / scale)),
  )
}

function cmykToRgb([cyan, magenta, yellow, black]: number[]): RgbColor {
  return [
    1 - Math.min(1, cyan * (1 - black) + black),
    1 - Math.min(1, magenta * (1 - black) + black),
    1 - Math.min(1, yellow * (1 - black) + black),
  ]
}

function containsSemanticGlyph(value: unknown): boolean {
  if (typeof value === "string") return /[\p{L}\p{N}]/u.test(value)
  if (Array.isArray(value)) return value.some(containsSemanticGlyph)
  if (!isRecord(value)) return false

  return (
    (typeof value.unicode === "string" &&
      /[\p{L}\p{N}]/u.test(value.unicode)) ||
    Object.values(value).some(containsSemanticGlyph)
  )
}

function contrastAgainstWhite(
  [red, green, blue]: RgbColor,
  alpha = 1,
): number {
  const composite = (channel: number) => channel * alpha + (1 - alpha)
  const linearize = (channel: number) =>
    channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4
  const luminance =
    0.2126 * linearize(composite(red)) +
    0.7152 * linearize(composite(green)) +
    0.0722 * linearize(composite(blue))

  return 1.05 / (luminance + 0.05)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}
