import React, { useEffect, useRef, useState } from "react";
import { Icon } from "./ui.jsx";
import { useLanguage } from "../i18n/LanguageContext.jsx";

const LANGUAGE_OPTIONS = [
  { code: "es", label: "Español", flag: "🇪🇸" },
  { code: "en", label: "English", flag: "🇬🇧" },
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

  const currentOption =
    LANGUAGE_OPTIONS.find((option) => option.code === language) ?? LANGUAGE_OPTIONS[0];

  return (
    <div className="language-dropdown" ref={wrapperRef}>
      <button
        type="button"
        className="language-trigger"
        aria-label={t("languages.select")}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="language-label">
          <span className="language-flag" aria-hidden="true">{currentOption.flag}</span>
          <span>{currentOption.label}</span>
        </span>
        <Icon name="chevron" size={16} />
      </button>

      {open ? (
        <div className="language-menu" role="menu">
          {LANGUAGE_OPTIONS.map((option) => (
            <button
              key={option.code}
              type="button"
              className={`language-option ${language === option.code ? "active" : ""}`}
              onClick={() => {
                setLanguage(option.code);
                setOpen(false);
              }}
            >
              <span className="language-label">
                <span className="language-flag" aria-hidden="true">{option.flag}</span>
                <span>{option.label}</span>
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
