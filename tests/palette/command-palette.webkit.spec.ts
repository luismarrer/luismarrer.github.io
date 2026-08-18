import { expect, test } from "@playwright/test"

const DIALOG = "[data-command-palette-root] dialog"

test("touch sheet reserves a real results viewport in WebKit", async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem("theme", "dark"))
  await page.goto("/en/", { waitUntil: "domcontentloaded" })

  await expect(page.locator("[data-palette-trigger]")).toBeVisible()
  await page.locator("[data-palette-trigger]").tap()

  const dialog = page.locator(DIALOG)
  await expect(dialog).toHaveAttribute("open", "")
  await dialog.evaluate((element) =>
    Promise.all(element.getAnimations().map(({ finished }) => finished)),
  )

  const metrics = await page.evaluate(() => {
    const panel = document.querySelector<HTMLElement>(
      "[data-command-palette-root] dialog",
    )
    const results = panel?.querySelector<HTMLElement>(".palette-results")
    const firstOption = results?.querySelector<HTMLElement>('[role="option"]')
    const panelRect = panel?.getBoundingClientRect()
    const resultsRect = results?.getBoundingClientRect()
    const optionRect = firstOption?.getBoundingClientRect()

    return {
      activeElement: document.activeElement?.tagName,
      dialogHeight: panelRect?.height ?? -1,
      firstOptionVisibleHeight:
        optionRect && resultsRect
          ? Math.max(
              0,
              Math.min(optionRect.bottom, resultsRect.bottom) -
                Math.max(optionRect.top, resultsRect.top),
            )
          : -1,
      optionCount: results?.querySelectorAll('[role="option"]').length ?? 0,
      resultsHeight: resultsRect?.height ?? -1,
    }
  })

  expect(metrics.activeElement).toBe("DIALOG")
  expect(metrics.dialogHeight).toBeCloseTo(480, 0)
  expect(metrics.resultsHeight).toBeGreaterThanOrEqual(44 * 3)
  expect(metrics.firstOptionVisibleHeight).toBeGreaterThanOrEqual(44)
  expect(metrics.optionCount).toBe(7)
})
