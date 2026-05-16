import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import ptBR from "../locales/pt-BR/translation.json";
import en from "../locales/en/translation.json";

export const LANGUAGE_STORAGE_KEY = "boraali_lang";
const SUPPORTED_LANGUAGES = ["pt-BR", "en"] as const;
type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

function getInitialLanguage(): SupportedLanguage {
  const storedLanguage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  if (storedLanguage && SUPPORTED_LANGUAGES.includes(storedLanguage as SupportedLanguage)) {
    return storedLanguage as SupportedLanguage;
  }
  return "pt-BR";
}

i18n
  .use(initReactI18next)
  .init({
    lng: getInitialLanguage(),
    resources: {
      "pt-BR": { translation: ptBR },
      en: { translation: en },
    },
    fallbackLng: "pt-BR",
    supportedLngs: [...SUPPORTED_LANGUAGES],
    interpolation: { escapeValue: false },
  });

export default i18n;
