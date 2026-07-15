import React from "react";

export default function CountryFlag({ code, name, fallbackFlag = "", className = "" }) {
  const normalizedCode = `${code ?? ""}`.trim().toLowerCase();

  if (normalizedCode === "xk") {
    return (
      <img
        src="/assets/flags/kosovo.png"
        alt={name || "Kosovo"}
        title={name || "Kosovo"}
        className={`country-flag-icon country-flag-image ${className}`.trim()}
      />
    );
  }

  const supportsIcon = Boolean(normalizedCode);

  if (supportsIcon) {
    return (
      <span
        className={`country-flag-icon fi fi-${normalizedCode} ${className}`.trim()}
        title={name || code}
        aria-label={name || code}
      />
    );
  }

  if (fallbackFlag) {
    return (
      <span className={`country-flag-icon country-flag-emoji ${className}`.trim()} title={name || code} aria-label={name || code}>
        {fallbackFlag}
      </span>
    );
  }

  return null;
}
