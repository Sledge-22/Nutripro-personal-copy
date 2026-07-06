import React from "react";

export function ToggleSwitch({
  checked,
  onChange,
  disabled = false,
  label,
  id,
  className = "",
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`toggle-switch ${checked ? "is-on" : "is-off"} ${className}`.trim()}
      disabled={disabled}
      onClick={() => {
        if (!disabled) onChange?.(!checked);
      }}
    >
      <span className="toggle-switch-track" aria-hidden="true">
        <span className="toggle-switch-thumb" />
      </span>
      {label ? <span className="toggle-switch-label">{label}</span> : null}
    </button>
  );
}
