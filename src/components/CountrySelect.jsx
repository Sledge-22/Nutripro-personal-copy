import React, { useEffect, useRef, useState } from "react";
import CountryFlag from "./CountryFlag.jsx";
import { Icon } from "./ui.jsx";

export function CountrySelect({ value, options, placeholder, onChange, ariaLabel }) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!wrapperRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const selectedOption = options.find((option) => option.code === value) ?? null;

  return (
    <div className="custom-select" ref={wrapperRef}>
      <button
        type="button"
        className="custom-select-trigger country-select-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((current) => !current)}
      >
        {selectedOption ? (
          <>
            <CountryFlag
              code={selectedOption.code}
              name={selectedOption.name}
              fallbackFlag={selectedOption.flag}
              className="country-option-flag"
            />
            <span className="custom-select-value">{selectedOption.name}</span>
          </>
        ) : (
          <span className="custom-select-placeholder">{placeholder}</span>
        )}
        <Icon name="chevron" size={16} />
      </button>

      {open ? (
        <div className="custom-select-menu" role="listbox">
          <button
            type="button"
            className={`custom-select-option ${!selectedOption ? "active" : ""}`}
            role="option"
            aria-selected={!selectedOption}
            onClick={() => {
              onChange("");
              setOpen(false);
            }}
          >
            <span className="custom-select-placeholder">{placeholder}</span>
          </button>
          {options.map((option) => (
            <button
              key={option.code}
              type="button"
              className={`custom-select-option ${selectedOption?.code === option.code ? "active" : ""}`}
              role="option"
              aria-selected={selectedOption?.code === option.code}
              onClick={() => {
                onChange(option.code);
                setOpen(false);
              }}
            >
              <CountryFlag code={option.code} name={option.name} fallbackFlag={option.flag} className="country-option-flag" />
              <span className="custom-select-value">{option.name}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default CountrySelect;
