import { expect, test } from "@playwright/test"

const SITE_URL = "https://cv.luismarrero.me"
const LOCALES = ["en", "es"] as const

for (const locale of LOCALES) {
  test(`${locale.toUpperCase()} exposes canonical and language alternatives`, async ({
    page,
  }) => {
    const canonicalUrl = `${SITE_URL}/${locale}/`

    await page.goto(`/${locale}/`, { waitUntil: "domcontentloaded" })

    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      canonicalUrl,
    )
    await expect(
      page.locator('link[rel="alternate"][hreflang="en"]'),
    ).toHaveAttribute("href", `${SITE_URL}/en/`)
    await expect(
      page.locator('link[rel="alternate"][hreflang="es"]'),
    ).toHaveAttribute("href", `${SITE_URL}/es/`)
    await expect(
      page.locator('link[rel="alternate"][hreflang="x-default"]'),
    ).toHaveAttribute("href", `${SITE_URL}/en/`)
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute(
      "content",
      canonicalUrl,
    )
    await expect(page.locator('meta[name="twitter:url"]')).toHaveAttribute(
      "content",
      canonicalUrl,
    )
  })
}
