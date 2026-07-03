import React, { useEffect, useRef, useState } from "react";
import { Icon } from "./ui.jsx";
import { useLanguage } from "../i18n/LanguageContext.jsx";

const languageOptions = [
  { code: "es", label: "Espa\u00F1ol", flag: "\uD83C\uDDEA\uD83C\uDDF8" },
  { code: "en", label: "English", flag: "\uD83C\uDDEC\uD83C\uDDE7" },
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
        <span className="language-flag" aria-hidden="true">{selectedLanguage.flag}</span>
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
              <span className="language-flag" aria-hidden="true">{option.flag}</span>
              <span className="language-label">{option.label}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
