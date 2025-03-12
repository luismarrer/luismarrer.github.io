import { defaultLanguage, titles } from "./ui"

export function useTranslations(lang: keyof typeof titles) {
  return function translate(key: keyof typeof titles[typeof defaultLanguage]) {
    return titles[lang][key] || titles[defaultLanguage][key];
  }
}
