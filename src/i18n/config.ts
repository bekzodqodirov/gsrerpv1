export const locales = ["uz", "ru", "en", "zh"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "uz";

export const localeNames: Record<Locale, string> = {
  uz: "O'zbekcha",
  ru: "Русский",
  en: "English",
  zh: "中文",
};
