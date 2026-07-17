import { defaultLanguage, titles, commandPalette } from "./ui"

export function useTranslations(lang: keyof typeof titles) {
  return function translate(key: keyof typeof titles[typeof defaultLanguage]) {
    return titles[lang][key] || titles[defaultLanguage][key];
  }
}

export function useCommandPalette(lang: keyof typeof commandPalette) {
  return function translate(key: keyof typeof commandPalette[typeof defaultLanguage]) {
    return commandPalette[lang][key] || commandPalette[defaultLanguage][key];
  }
}

