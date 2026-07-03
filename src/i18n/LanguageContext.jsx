import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { translations } from "./translations.js";

const LANGUAGE_STORAGE_KEY = "nutripro-language";
const DEFAULT_LANGUAGE = "es";

const LanguageContext = createContext(null);

function getNestedValue(object, path) {
  return path.split(".").reduce((value, segment) => value?.[segment], object);
}

function interpolate(template, values = {}) {
  return String(template).replace(/\{(\w+)\}/g, (_, key) => values[key] ?? "");
}

function fixMojibake(value) {
  return String(value)
    .replaceAll("Ã¡", "á")
    .replaceAll("Ã©", "é")
    .replaceAll("Ã­", "í")
    .replaceAll("Ã³", "ó")
    .replaceAll("Ãº", "ú")
    .replaceAll("Ã", "Á")
    .replaceAll("Ã‰", "É")
    .replaceAll("Ã", "Í")
    .replaceAll("Ã“", "Ó")
    .replaceAll("Ãš", "Ú")
    .replaceAll("Ã±", "ñ")
    .replaceAll("Ã‘", "Ñ")
    .replaceAll("Â¿", "¿")
    .replaceAll("Â¡", "¡")
    .replaceAll("Â·", "·")
    .replaceAll("â†’", "→")
    .replaceAll("â€”", "—")
    .replaceAll("â€¹", "←")
    .replaceAll("Ã—", "×")
    .replaceAll("ðŸ‡ªðŸ‡¸", "🇪🇸")
    .replaceAll("ðŸ‡¬ðŸ‡§", "🇬🇧");
}

function normalizeStatusKey(status) {
  return String(status ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

function getInitialLanguage() {
  if (typeof window === "undefined") return DEFAULT_LANGUAGE;

  const savedLanguage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  return savedLanguage === "en" || savedLanguage === "es" ? savedLanguage : DEFAULT_LANGUAGE;
}

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(getInitialLanguage);

  useEffect(() => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    document.documentElement.lang = language;
  }, [language]);

  const value = useMemo(() => {
    const translate = (key, values) => {
      const selectedLanguageValue = getNestedValue(translations[language], key);
      const fallbackValue = getNestedValue(translations[DEFAULT_LANGUAGE], key);
      const resolvedValue = selectedLanguageValue ?? fallbackValue ?? key;

      if (typeof resolvedValue === "string") return fixMojibake(interpolate(resolvedValue, values));
      return resolvedValue;
    };

    return {
      language,
      setLanguage: (nextLanguage) => setLanguageState(nextLanguage === "en" ? "en" : "es"),
      t: translate,
      translateStatus: (status) => translate(`status.${normalizeStatusKey(status)}`) || status,
      translateRole: (role) => translate(`roles.${role}`) || role,
      translateSubmissionType: (submissionType) =>
        translate(`submissionTypes.${normalizeStatusKey(submissionType)}`) || submissionType,
    };
  }, [language]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);

  if (!context) {
    throw new Error("useLanguage must be used within LanguageProvider.");
  }

  return context;
}
