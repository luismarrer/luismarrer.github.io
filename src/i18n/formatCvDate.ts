const localeMap = {
  en: "en-US",
  es: "es-PR",
} as const

export function formatCvDate(value: string, locale: keyof typeof localeMap) {
  const [year, month] = value.split("-").map(Number)

  if (!year) return value
  if (!month) return String(year)

  return new Intl.DateTimeFormat(localeMap[locale], {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)))
}
