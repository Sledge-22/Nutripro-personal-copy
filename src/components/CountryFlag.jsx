import React from "react";

export default function CountryFlag({ code, name, fallbackFlag = "", className = "" }) {
  const normalizedCode = `${code ?? ""}`.trim().toLowerCase();
  const supportsIcon = normalizedCode && normalizedCode !== "xk";

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
