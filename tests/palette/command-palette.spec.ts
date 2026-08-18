import { readFileSync } from "node:fs"
import { devices, expect, test, type Page } from "@playwright/test"

const LOCALES = ["en", "es"] as const
const BASE_URL = "http://127.0.0.1:4322"

type Locale = (typeof LOCALES)[number]

interface CvFixture {
  basics: {
    profiles: Array<{ network: string; url: string }>
    url: string
  }
}

const DIALOG = "[data-command-palette-root] dialog"
const INPUT = `${DIALOG} input[type="search"]`
const COMMAND_SHORTCUTS = [
  ["palette-cmd-print", "p"],
  ["palette-cmd-theme", "t"],
  ["palette-cmd-language", "e"],
  ["palette-cmd-website", "s"],
  ["palette-cmd-github", "g"],
  ["palette-cmd-linkedin", "l"],
  ["palette-cmd-x", "x"],
] as const

async function openWithKeyboard(page: Page): Promise<void> {
  await page.keyboard.press("ControlOrMeta+KeyK")
  await expect(page.locator(DIALOG)).toHaveAttribute("open", "")
}

function visibleOptions(page: Page) {
  return page.locator(`${DIALOG} [role="option"]:not([hidden])`)
}

for (const locale of LOCALES) {
  test.describe(`${locale.toUpperCase()} command palette`, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(`/${locale}/`, { waitUntil: "domcontentloaded" })
      await expect(
        page.locator("[data-command-palette-root]"),
      ).toHaveAttribute("data-palette-ready", "true")
    })

    test("keyboard shortcut opens one dialog, focuses search, activates the first command", async ({
      page,
    }) => {
      await openWithKeyboard(page)

      await expect(page.locator(`${DIALOG}[open]`)).toHaveCount(1)
      await expect(page.locator(INPUT)).toBeFocused()
      await expect(page.locator(INPUT)).toHaveAttribute(
        "aria-activedescendant",
        "palette-cmd-print",
      )
      await expect(visibleOptions(page)).toHaveCount(7)

      await page.keyboard.press("ControlOrMeta+KeyK")
      await expect(page.locator(`${DIALOG}[open]`)).toHaveCount(0)

      await page.keyboard.press("Meta+KeyK")
      await expect(page.locator(`${DIALOG}[open]`)).toHaveCount(1)
      await page.keyboard.press("Meta+KeyK")
      await expect(page.locator(`${DIALOG}[open]`)).toHaveCount(0)

      await page.keyboard.press("Control+KeyK")
      await expect(page.locator(`${DIALOG}[open]`)).toHaveCount(1)
      await page.keyboard.press("Control+KeyK")
      await expect(page.locator(`${DIALOG}[open]`)).toHaveCount(0)
    })

    test("commands expose unique Control keyboard shortcuts", async ({
      page,
    }) => {
      await openWithKeyboard(page)

      const isApplePlatform = await page.evaluate(() =>
        /mac|iphone|ipad|ipod/i.test(navigator.platform),
      )
      await expect(page.locator("[data-palette-key]")).toHaveText(
        isApplePlatform ? "⌘ K" : "Ctrl K",
      )
      await expect(page.locator("[data-palette-trigger]")).toHaveAttribute(
        "aria-keyshortcuts",
        "Control+K Meta+K",
      )

      for (const [id, key] of COMMAND_SHORTCUTS) {
        const option = page.locator(`#${id}`)
        await expect(option).toHaveAttribute("data-shortcut", key)
        await expect(option).toHaveAttribute(
          "aria-keyshortcuts",
          `Control+${key.toUpperCase()}`,
        )
        const shortcutKeycaps = option.locator(".option-shortcut kbd")
        await expect(shortcutKeycaps).toHaveCount(2)
        await expect(shortcutKeycaps.nth(0)).toHaveText("Ctrl")
        await expect(shortcutKeycaps.nth(1)).toHaveText(key.toUpperCase())
      }

      const shortcutKeys = await page
        .locator(`${DIALOG} [role="option"][data-shortcut]`)
        .evaluateAll((options) =>
          options.map((option) => option.getAttribute("data-shortcut")),
        )
      expect(shortcutKeys).toHaveLength(COMMAND_SHORTCUTS.length)
      expect(new Set(shortcutKeys).size).toBe(shortcutKeys.length)
    })

    test("escape and the close button dismiss the palette", async ({ page }) => {
      await openWithKeyboard(page)
      await page.keyboard.press("Escape")
      await expect(page.locator(`${DIALOG}[open]`)).toHaveCount(0)

      // A non-empty search field must not eat the first Escape to clear
      // itself — one press always closes.
      await openWithKeyboard(page)
      await page.locator(INPUT).fill("print")
      await page.keyboard.press("Escape")
      await expect(page.locator(`${DIALOG}[open]`)).toHaveCount(0)

      await openWithKeyboard(page)
      await page.locator("[data-palette-close]").click()
      await expect(page.locator(`${DIALOG}[open]`)).toHaveCount(0)
    })

    test("backdrop click closes only when press and release stay outside", async ({
      page,
    }) => {
      await openWithKeyboard(page)
      await page.mouse.click(8, 8)
      await expect(page.locator(`${DIALOG}[open]`)).toHaveCount(0)
    })

    test("search is diacritic-insensitive, uses AND tokens, and recovers from zero results", async ({
      page,
    }) => {
      await openWithKeyboard(page)
      const input = page.locator(INPUT)

      const languageQuery = locale === "es" ? "ingles" : "spanish"
      await input.fill(languageQuery)
      await expect(visibleOptions(page)).toHaveCount(1)
      await expect(visibleOptions(page)).toHaveId("palette-cmd-language")

      await input.fill("git hub")
      await expect(visibleOptions(page)).toHaveCount(1)
      await expect(visibleOptions(page)).toHaveId("palette-cmd-github")

      await input.fill("zzzz")
      await expect(visibleOptions(page)).toHaveCount(0)
      await expect(page.locator("[data-palette-empty]")).toBeVisible()
      await expect(page.locator("[data-palette-count]")).not.toBeEmpty()

      await input.fill("")
      await expect(visibleOptions(page)).toHaveCount(7)
      await expect(page.locator(INPUT)).toHaveAttribute(
        "aria-activedescendant",
        "palette-cmd-print",
      )
    })

    test("arrow navigation wraps and keeps ARIA in sync", async ({ page }) => {
      await openWithKeyboard(page)
      const input = page.locator(INPUT)

      await page.keyboard.press("ArrowUp")
      await expect(input).toHaveAttribute(
        "aria-activedescendant",
        "palette-cmd-x",
      )
      await page.keyboard.press("ArrowDown")
      await expect(input).toHaveAttribute(
        "aria-activedescendant",
        "palette-cmd-print",
      )
      await page.keyboard.press("End")
      await expect(input).toHaveAttribute(
        "aria-activedescendant",
        "palette-cmd-x",
      )
      await page.keyboard.press("Home")
      await expect(input).toHaveAttribute(
        "aria-activedescendant",
        "palette-cmd-print",
      )

      await expect(
        page.locator(`${DIALOG} [role="option"][aria-selected="true"]`),
      ).toHaveId("palette-cmd-print")
    })

    test("print command and Ctrl+P call window.print exactly once each", async ({
      page,
    }) => {
      await page.addInitScript(() => {
        const counter = { calls: 0 }
        Object.assign(window, { __printProbe: counter })
        window.print = () => {
          counter.calls += 1
        }
      })
      await page.reload({ waitUntil: "domcontentloaded" })

      await openWithKeyboard(page)
      await page.keyboard.press("Enter")

      await expect(page.locator(`${DIALOG}[open]`)).toHaveCount(0)
      await page.waitForFunction(
        () =>
          (window as unknown as { __printProbe: { calls: number } })
            .__printProbe.calls === 1,
      )

      await openWithKeyboard(page)
      await page.keyboard.press("Control+KeyP")
      await page.waitForFunction(
        () =>
          (window as unknown as { __printProbe: { calls: number } })
            .__printProbe.calls === 2,
      )
      await expect(page.locator(`${DIALOG}[open]`)).toHaveCount(0)
    })

    test("Ctrl+S, Ctrl+G, Ctrl+L, and Ctrl+X activate the matching links", async ({
      page,
    }) => {
      await page.evaluate(() => {
        const probe: string[] = []
        Object.assign(window, { __shortcutProbe: probe })
        document.addEventListener(
          "click",
          (event) => {
            const target = event.target
            if (!(target instanceof Element)) return
            const option = target.closest<HTMLAnchorElement>(
              'a[data-command="external-link"]',
            )
            if (!option) return
            event.preventDefault()
            probe.push(option.id)
          },
          { capture: true },
        )
      })

      await page.evaluate(() => {
        for (const key of ["s", "g", "l", "x"])
          document.dispatchEvent(
            new KeyboardEvent("keydown", {
              bubbles: true,
              cancelable: true,
              ctrlKey: true,
              key,
            }),
          )
      })
      expect(
        await page.evaluate(
          () =>
            (window as unknown as { __shortcutProbe: string[] })
              .__shortcutProbe,
        ),
      ).toEqual([])

      const commands = [
        ["S", "palette-cmd-website"],
        ["G", "palette-cmd-github"],
        ["L", "palette-cmd-linkedin"],
        ["X", "palette-cmd-x"],
      ] as const
      for (const [key, id] of commands) {
        await openWithKeyboard(page)
        if (key === "G") {
          await page.keyboard.press("Meta+KeyG")
          await expect(page.locator(`${DIALOG}[open]`)).toHaveCount(1)
        }
        await page.keyboard.press(`Control+Key${key}`)
        await expect
          .poll(() =>
            page.evaluate(
              () =>
                (window as unknown as { __shortcutProbe: string[] })
                  .__shortcutProbe,
            ),
          )
          .toContain(id)
        await expect(page.locator(`${DIALOG}[open]`)).toHaveCount(0)
      }
    })

    test("Ctrl+T toggles the theme and Ctrl+E switches language", async ({
      page,
    }) => {
      const initial = await page.evaluate(
        () => document.documentElement.dataset.theme,
      )
      const flipped = initial === "dark" ? "light" : "dark"

      await openWithKeyboard(page)
      await page.keyboard.press("Control+KeyT")
      await expect(page.locator("html")).toHaveAttribute("data-theme", flipped)
      await expect(page.locator(`${DIALOG}[open]`)).toHaveCount(1)

      await page.keyboard.press("Control+KeyE")
      await page.waitForURL(locale === "es" ? "**/en/" : "**/es/")
    })

    test("theme command flips the theme, persists it, and renames itself", async ({
      page,
    }) => {
      const initial = await page.evaluate(
        () => document.documentElement.dataset.theme,
      )
      const flipped = initial === "dark" ? "light" : "dark"

      await openWithKeyboard(page)
      await page.keyboard.press("ArrowDown")
      await expect(page.locator(INPUT)).toHaveAttribute(
        "aria-activedescendant",
        "palette-cmd-theme",
      )
      await page.keyboard.press("Enter")

      await expect(page.locator("html")).toHaveAttribute("data-theme", flipped)
      expect(await page.evaluate(() => localStorage.getItem("theme"))).toBe(
        flipped,
      )
      await expect(page.locator(`${DIALOG}[open]`)).toHaveCount(1)

      const visibleLabel = page
        .locator("#palette-cmd-theme .option-label")
        .locator("visible=true")
      await expect(visibleLabel).toHaveCount(1)
      const labelText = (await visibleLabel.textContent())?.trim() ?? ""
      const expectedDestination = initial === "dark" ? "dark" : "light"
      expect(labelText.toLowerCase()).toContain(
        locale === "es"
          ? expectedDestination === "dark"
            ? "oscuro"
            : "claro"
          : expectedDestination,
      )
    })

    test("language and network commands are real CV-derived links", async ({
      page,
    }) => {
      const cv = loadCv(locale)
      await openWithKeyboard(page)

      await expect(page.locator("#palette-cmd-language")).toHaveAttribute(
        "href",
        locale === "es" ? "/en/" : "/es/",
      )

      const networkAnchors = page.locator(
        `${DIALOG} a[data-command="external-link"]`,
      )
      await expect(networkAnchors).toHaveCount(cv.basics.profiles.length + 1)

      const hrefs = await networkAnchors.evaluateAll((anchors) =>
        anchors.map((anchor) => anchor.getAttribute("href")),
      )
      expect(hrefs).toEqual([
        cv.basics.url,
        ...cv.basics.profiles.map(({ url }) => url),
      ])

      for (const anchor of await networkAnchors.all()) {
        await expect(anchor).toHaveAttribute("target", "_blank")
        await expect(anchor).toHaveAttribute("rel", "noopener noreferrer")
      }

      await page.locator("#palette-cmd-language").click()
      await page.waitForURL(locale === "es" ? "**/en/" : "**/es/")
    })
  })
}

test.describe("palette resilience", () => {
  test("Control actions only run inside the open palette", async ({
    page,
  }) => {
    await page.goto("/en/", { waitUntil: "domcontentloaded" })
    await page.evaluate(() => {
      const input = document.createElement("input")
      input.id = "shortcut-editable-probe"
      input.value = "do not open X"
      document.body.append(input)
      input.focus()

      const clicks: string[] = []
      Object.assign(window, { __editableShortcutProbe: clicks })
      document.addEventListener(
        "click",
        (event) => {
          const target = event.target
          if (!(target instanceof Element)) return
          const option = target.closest<HTMLAnchorElement>(
            'a[data-command="external-link"]',
          )
          if (!option) return
          event.preventDefault()
          clicks.push(option.id)
        },
        { capture: true },
      )
    })

    await page.keyboard.press("Control+KeyX")
    expect(
      await page.evaluate(
        () =>
          (window as unknown as { __editableShortcutProbe: string[] })
            .__editableShortcutProbe,
      ),
    ).toEqual([])

    await page.locator("#shortcut-editable-probe").blur()
    await openWithKeyboard(page)
    await page.locator(INPUT).fill("x")
    await page.keyboard.press("Control+KeyX")
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (window as unknown as { __editableShortcutProbe: string[] })
              .__editableShortcutProbe,
        ),
      )
      .toEqual(["palette-cmd-x"])
    await expect(page.locator(`${DIALOG}[open]`)).toHaveCount(0)
  })

  test("repeated open/close cycles never duplicate palette state", async ({
    page,
  }) => {
    await page.goto("/en/", { waitUntil: "domcontentloaded" })

    for (let cycle = 0; cycle < 3; cycle += 1) {
      await openWithKeyboard(page)
      await page.keyboard.press("Escape")
      await expect(page.locator(`${DIALOG}[open]`)).toHaveCount(0)
    }

    await expect(page.locator(DIALOG)).toHaveCount(1)
    await expect(page.locator(`${DIALOG} [role="option"]`)).toHaveCount(7)
  })

  test("no horizontal overflow with the palette open at 320px", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 700 })
    await page.goto("/en/", { waitUntil: "domcontentloaded" })
    await openWithKeyboard(page)

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    )
    expect(overflow).toBeLessThanOrEqual(1)
  })

  test("the palette stays out of print media", async ({ page }) => {
    await page.goto("/en/", { waitUntil: "domcontentloaded" })
    await page.emulateMedia({ media: "print" })

    const rootDisplay = await page.evaluate(() => {
      const root = document.querySelector("[data-command-palette-root]")
      return root ? getComputedStyle(root).display : "missing"
    })
    expect(rootDisplay).toBe("none")
  })
})

test.describe("touch presentation", () => {
  test("touch opens a usable sheet without summoning the keyboard", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      ...devices["iPhone 13"],
      baseURL: BASE_URL,
    })
    const page = await context.newPage()

    await page.goto("/en/", { waitUntil: "domcontentloaded" })
    await expect(page.locator("[data-palette-trigger]")).toBeVisible()
    await page.locator("[data-palette-trigger]").tap()

    const dialog = page.locator(DIALOG)
    await expect(dialog).toHaveAttribute("open", "")
    await dialog.evaluate((element) =>
      Promise.all(element.getAnimations().map(({ finished }) => finished)),
    )

    const metrics = await page.evaluate(() => {
      const panel = document.querySelector(
        "[data-command-palette-root] dialog",
      )
      const input = panel?.querySelector<HTMLInputElement>(
        'input[type="search"]',
      )
      const close = panel?.querySelector<HTMLElement>("[data-palette-close]")
      const results = panel?.querySelector<HTMLElement>(".palette-results")
      const footer = document.querySelector(".palette-footer")
      const shortcut = panel?.querySelector<HTMLElement>(".option-shortcut")
      const firstOption = panel?.querySelector<HTMLElement>('[role="option"]')
      const root = document.querySelector<HTMLElement>(
        "[data-command-palette-root]",
      )
      const rect = panel?.getBoundingClientRect()
      const closeRect = close?.getBoundingClientRect()
      const firstOptionRect = firstOption?.getBoundingClientRect()
      const resultsRect = results?.getBoundingClientRect()
      const optionRects = Array.from(
        panel?.querySelectorAll<HTMLElement>('[role="option"]') ?? [],
        (option) => option.getBoundingClientRect(),
      )
      return {
        activeElement: document.activeElement?.tagName,
        bottomInset: rect ? window.innerHeight - rect.bottom : -1,
        dialogHeight: rect?.height ?? -1,
        closeHeight: closeRect?.height ?? -1,
        closeWidth: closeRect?.width ?? -1,
        footerDisplay: footer ? getComputedStyle(footer).display : "missing",
        inputFontSize: input
          ? Number.parseFloat(getComputedStyle(input).fontSize)
          : -1,
        leftInset: rect ? rect.left : -1,
        minOptionHeight: Math.min(...optionRects.map(({ height }) => height)),
        firstOptionVisibleHeight:
          firstOptionRect && resultsRect
            ? Math.max(
                0,
                Math.min(firstOptionRect.bottom, resultsRect.bottom) -
                  Math.max(firstOptionRect.top, resultsRect.top),
              )
            : -1,
        resultsHeight: results?.clientHeight ?? -1,
        rightInset: rect ? window.innerWidth - rect.right : -1,
        shortcutDisplay: shortcut
          ? getComputedStyle(shortcut).display
          : "missing",
        showActive: root?.dataset.showActive,
      }
    })

    expect(metrics.activeElement).toBe("DIALOG")
    expect(metrics.leftInset).toBeGreaterThanOrEqual(12)
    expect(metrics.rightInset).toBeGreaterThanOrEqual(12)
    expect(metrics.bottomInset).toBeGreaterThanOrEqual(12)
    expect(metrics.dialogHeight).toBeCloseTo(480, 0)
    expect(metrics.closeWidth).toBeGreaterThanOrEqual(44)
    expect(metrics.closeHeight).toBeGreaterThanOrEqual(44)
    expect(metrics.minOptionHeight).toBeGreaterThanOrEqual(44)
    expect(metrics.inputFontSize).toBeGreaterThanOrEqual(16)
    expect(metrics.resultsHeight).toBeGreaterThanOrEqual(44 * 3)
    expect(metrics.firstOptionVisibleHeight).toBeGreaterThanOrEqual(44)
    expect(metrics.footerDisplay).toBe("none")
    expect(metrics.shortcutDisplay).toBe("none")
    expect(metrics.showActive).toBe("false")
    await expect(page.locator(INPUT)).not.toBeFocused()
    await expect(page.locator('meta[name="viewport"]')).toHaveAttribute(
      "content",
      /viewport-fit=cover.*interactive-widget=resizes-content/,
    )

    await page.locator(INPUT).tap()
    await expect(page.locator(INPUT)).toBeFocused()

    await page.locator("[data-palette-close]").tap()
    await expect(dialog).not.toHaveAttribute("open", "")
    await expect(page.locator("[data-palette-trigger]")).toBeFocused()

    await context.close()
  })

  for (const { height, width } of [
    { width: 667, height: 375 },
    { width: 844, height: 390 },
  ]) {
    test(`touch controls stay available in ${width}x${height} landscape`, async ({
      browser,
    }) => {
      const context = await browser.newContext({
        ...devices["iPhone 13"],
        baseURL: BASE_URL,
        viewport: { width, height },
      })
      const page = await context.newPage()

      await page.goto("/en/", { waitUntil: "domcontentloaded" })
      await expect(page.locator("[data-palette-trigger]")).toBeVisible()
      await expect(page.locator(".palette-hint")).toBeHidden()
      await page.locator("[data-palette-trigger]").tap()

      const dialog = page.locator(DIALOG)
      await expect(dialog).toHaveAttribute("open", "")
      await dialog.evaluate((element) =>
        Promise.all(element.getAnimations().map(({ finished }) => finished)),
      )
      await expect(dialog.locator(".option-shortcut").first()).toBeHidden()
      await expect(dialog.locator(".palette-footer")).toBeHidden()

      const rect = await dialog.boundingBox()
      expect(rect).not.toBeNull()
      if (!rect) throw new Error("The open palette has no layout box")
      expect(rect.x).toBeGreaterThanOrEqual(12)
      expect(width - rect.x - rect.width).toBeGreaterThanOrEqual(12)
      expect(rect.y).toBeGreaterThanOrEqual(12)
      expect(height - rect.y - rect.height).toBeGreaterThanOrEqual(12)

      await context.close()
    })
  }

  test("virtual keyboard keeps search, results, and close inside the visual viewport", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      ...devices["iPhone 13"],
      baseURL: BASE_URL,
    })
    await context.addInitScript(() => {
      const viewport = Object.assign(new EventTarget(), {
        height: 664,
        offsetLeft: 0,
        offsetTop: 0,
        pageLeft: 0,
        pageTop: 0,
        scale: 1,
        width: 390,
      })
      Object.defineProperty(window, "visualViewport", {
        configurable: true,
        value: viewport,
      })
      Object.assign(window, {
        __setPaletteVisualViewport: (height: number, offsetTop = 0) => {
          viewport.height = height
          viewport.offsetTop = offsetTop
          viewport.dispatchEvent(new Event("resize"))
        },
      })
    })
    const page = await context.newPage()

    await page.goto("/en/", { waitUntil: "domcontentloaded" })
    const initialScrollY = await page.evaluate(() => window.scrollY)
    await page.locator("[data-palette-trigger]").tap()
    await page.locator(INPUT).tap()
    await page.evaluate(() =>
      (
        window as unknown as {
          __setPaletteVisualViewport: (
            height: number,
            offsetTop?: number,
          ) => void
        }
      ).__setPaletteVisualViewport(350),
    )

    const dialog = page.locator(DIALOG)
    await expect
      .poll(() =>
        dialog.evaluate((element) =>
          element.style.getPropertyValue("--palette-vv-height"),
        ),
      )
      .toBe("350px")

    const metrics = await page.evaluate(() => {
      const viewport = window.visualViewport
      const panel = document.querySelector<HTMLElement>(
        "[data-command-palette-root] dialog",
      )
      const header = panel?.querySelector<HTMLElement>(".palette-header")
      const results = panel?.querySelector<HTMLElement>(".palette-results")
      const rect = panel?.getBoundingClientRect()
      const visualTop = viewport?.offsetTop ?? 0
      const visualBottom = visualTop + (viewport?.height ?? window.innerHeight)
      return {
        bottomInset: rect ? visualBottom - rect.bottom : -1,
        headerHeight: header?.clientHeight ?? -1,
        resultsHeight: results?.clientHeight ?? -1,
        topInset: rect ? rect.top - visualTop : -1,
      }
    })

    expect(metrics.topInset).toBeGreaterThanOrEqual(12)
    expect(metrics.bottomInset).toBeGreaterThanOrEqual(12)
    expect(metrics.headerHeight).toBeGreaterThanOrEqual(44)
    expect(metrics.resultsHeight).toBeGreaterThanOrEqual(88)

    await page.locator("#palette-cmd-x").scrollIntoViewIfNeeded()
    const [lastOption, results] = await Promise.all([
      page.locator("#palette-cmd-x").boundingBox(),
      page.locator(".palette-results").boundingBox(),
    ])
    expect(lastOption?.y).toBeGreaterThanOrEqual(results?.y ?? 0)
    expect((lastOption?.y ?? 0) + (lastOption?.height ?? 0)).toBeLessThanOrEqual(
      (results?.y ?? 0) + (results?.height ?? 0) + 1,
    )
    expect(await page.evaluate(() => window.scrollY)).toBe(initialScrollY)

    await page.locator("[data-palette-close]").tap()
    await expect(dialog).not.toHaveAttribute("open", "")
    await context.close()
  })
})

function loadCv(locale: Locale): CvFixture {
  const path = new URL(`../../cv-${locale}.json`, import.meta.url)
  return JSON.parse(readFileSync(path, "utf8")) as CvFixture
}
