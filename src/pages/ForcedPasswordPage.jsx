import React, { useState } from "react";
import { Brand } from "../components/ui.jsx";
import { LanguageDropdown } from "../components/LanguageDropdown.jsx";
import { useLanguage } from "../i18n/LanguageContext.jsx";

export function ForcedPasswordPage({ onSubmit, loading = false }) {
  const { t } = useLanguage();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");

    if (newPassword.length < 8) {
      setError(t("auth.passwordMinLength"));
      return;
    }

    if (newPassword !== confirmPassword) {
      setError(t("auth.passwordsDoNotMatch"));
      return;
    }

    const result = await onSubmit(newPassword);
    if (!result?.ok) {
      setError(result?.error || t("auth.passwordChangeFailed"));
      return;
    }

    setMessage(t("auth.passwordUpdated"));
    setNewPassword("");
    setConfirmPassword("");
  };

  return (
    <main className="login-page auth-page">
      <section className="login-panel auth-panel">
        <div className="login-topbar">
          <Brand />
          <LanguageDropdown />
        </div>

        <div className="login-copy">
          <span className="eyebrow">{t("auth.forcePasswordEyebrow")}</span>
          <h1>{t("auth.forcePasswordTitle")}</h1>
          <p>{t("auth.forcePasswordDescription")}</p>
        </div>

        <form className="auth-form" onSubmit={(event) => void handleSubmit(event)}>
          <label>
            {t("auth.newPassword")}
            <input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              autoComplete="new-password"
              required
            />
          </label>

          <label>
            {t("auth.confirmPassword")}
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
              required
            />
          </label>

          {message ? <small className="field-note">{message}</small> : null}
          {error ? <small className="field-note danger-text">{error}</small> : null}

          <div className="form-actions">
            <button type="submit" className="primary-btn" disabled={loading}>
              {loading ? t("common.saving") : t("auth.changePassword")}
            </button>
          </div>
        </form>
      </section>

      <aside className="login-visual auth-visual">
        <div className="visual-card auth-message-card">
          <div className="leaf">N</div>
          <p>{t("auth.forcePasswordHelpTitle")}</p>
          <strong>{t("auth.forcePasswordHelpBody")}</strong>
        </div>
      </aside>
    </main>
  );
}
