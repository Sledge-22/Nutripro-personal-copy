import React, { useEffect, useRef, useState } from "react";
import CountryFlag from "./CountryFlag.jsx";
import { Icon } from "./ui.jsx";
import { useLanguage } from "../i18n/LanguageContext.jsx";

const languageOptions = [
  { code: "es", label: "Español", flagCode: "ES", fallbackFlag: "🇪🇸" },
  { code: "en", label: "English", flagCode: "GB", fallbackFlag: "🇬🇧" },
];

export function LanguageDropdown() {
  const { language, setLanguage, t } = useLanguage();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!wrapperRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };

    window.addEventListener("mousedown", handleClickOutside);
    return () => window.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedLanguage =
    languageOptions.find((option) => option.code === language) ?? languageOptions[0];

  return (
    <div className="language-dropdown" ref={wrapperRef}>
      <button
        type="button"
        className="language-trigger"
        aria-label={t("languages.select")}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <CountryFlag
          code={selectedLanguage.flagCode}
          name={selectedLanguage.label}
          fallbackFlag={selectedLanguage.fallbackFlag}
          className="language-flag"
        />
        <span className="language-label">{selectedLanguage.label}</span>
        <Icon name="chevron" size={16} />
      </button>

      {open ? (
        <div className="language-menu" role="menu">
          {languageOptions.map((option) => (
            <button
              key={option.code}
              type="button"
              className={`language-option ${language === option.code ? "active" : ""}`}
              onClick={() => {
                setLanguage(option.code);
                setOpen(false);
              }}
            >
              <CountryFlag
                code={option.flagCode}
                name={option.label}
                fallbackFlag={option.fallbackFlag}
                className="language-flag"
              />
              <span className="language-label">{option.label}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
