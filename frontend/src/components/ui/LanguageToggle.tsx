import { useTranslation } from "react-i18next";

const LANGUAGE_OPTIONS = [
  { value: "pt-BR", label: "PT" },
  { value: "en", label: "EN" },
] as const;

export function LanguageToggle() {
  const { i18n, t } = useTranslation();
  const currentLanguage = i18n.resolvedLanguage === "pt-BR" ? "pt-BR" : "en";

  return (
    <div
      className="inline-flex rounded-xl border border-border bg-surface p-1 shadow-sm"
      role="group"
      aria-label={t("languageToggle.ariaLabel")}
    >
      {LANGUAGE_OPTIONS.map((language) => {
        const isActive = currentLanguage === language.value;
        return (
          <button
            key={language.value}
            type="button"
            onClick={() => i18n.changeLanguage(language.value)}
            className={`min-w-11 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors duration-150 ${
              isActive
                ? "bg-primary text-white shadow-sm"
                : "text-text hover:bg-background"
            }`}
            aria-pressed={isActive}
          >
            {language.label}
          </button>
        );
      })}
    </div>
  );
}
