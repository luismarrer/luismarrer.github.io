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
    })

    test("escape and the close button dismiss the palette", async ({ page }) => {
      await openWithKeyboard(page)
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

    test("print command closes the palette and calls window.print once", async ({
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
  test("mobile trigger opens a floating sheet inside safe insets without keyboard chrome", async ({
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
      const footer = document.querySelector(".palette-footer")
      const root = document.querySelector<HTMLElement>(
        "[data-command-palette-root]",
      )
      const rect = panel?.getBoundingClientRect()
      return {
        bottomInset: rect ? window.innerHeight - rect.bottom : -1,
        footerDisplay: footer ? getComputedStyle(footer).display : "missing",
        leftInset: rect ? rect.left : -1,
        rightInset: rect ? window.innerWidth - rect.right : -1,
        showActive: root?.dataset.showActive,
      }
    })

    expect(metrics.leftInset).toBeGreaterThanOrEqual(12)
    expect(metrics.rightInset).toBeGreaterThanOrEqual(12)
    expect(metrics.bottomInset).toBeGreaterThanOrEqual(12)
    expect(metrics.footerDisplay).toBe("none")
    expect(metrics.showActive).toBe("false")

    await context.close()
  })
})

function loadCv(locale: Locale): CvFixture {
  const path = new URL(`../../cv-${locale}.json`, import.meta.url)
  return JSON.parse(readFileSync(path, "utf8")) as CvFixture
}
