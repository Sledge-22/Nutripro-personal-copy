import React, { useEffect, useRef, useState } from "react";
import { Icon } from "./ui.jsx";
import { useLanguage } from "../i18n/LanguageContext.jsx";

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

  const currentLabel = t(`languages.${language}`);

  return (
    <div className="language-dropdown" ref={wrapperRef}>
      <button
        type="button"
        className="language-trigger"
        aria-label={t("languages.select")}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span>{currentLabel}</span>
        <Icon name="chevron" size={16} />
      </button>

      {open ? (
        <div className="language-menu" role="menu">
          {["es", "en"].map((option) => (
            <button
              key={option}
              type="button"
              className={`language-option ${language === option ? "active" : ""}`}
              onClick={() => {
                setLanguage(option);
                setOpen(false);
              }}
            >
              {t(`languages.${option}`)}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
