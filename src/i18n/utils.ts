import { defaultLanguage, titles, keyboardManager } from "./ui"

export function useTranslations(lang: keyof typeof titles) {
  return function translate(key: keyof typeof titles[typeof defaultLanguage]) {
    return titles[lang][key] || titles[defaultLanguage][key];
  }
}

export function useKeyboardManager(lang: keyof typeof keyboardManager) {
  return function translate(key: keyof typeof keyboardManager[typeof defaultLanguage]) {
    return keyboardManager[lang][key] || keyboardManager[defaultLanguage][key];
  }
}

