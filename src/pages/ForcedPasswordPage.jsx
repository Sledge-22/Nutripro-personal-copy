import React, { useState } from "react";
import { Brand } from "../components/ui.jsx";
import { LanguageDropdown } from "../components/LanguageDropdown.jsx";
import { useLanguage } from "../i18n/LanguageContext.jsx";

export function ForcedPasswordPage({ onSubmit, loading = false, currentUsername = "" }) {
  const { t, language } = useLanguage();
  const [username, setUsername] = useState(currentUsername || "");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const needsUsername = !`${currentUsername ?? ""}`.trim();
  const passwordStrengthText = t("auth.passwordStrengthRequirement") !== "auth.passwordStrengthRequirement"
    ? t("auth.passwordStrengthRequirement")
    : language === "es"
      ? "La contraseña debe incluir al menos 10 caracteres, letras mayúsculas y minúsculas, un número y un símbolo."
      : "Password must include at least 10 characters, uppercase and lowercase letters, a number, and a symbol.";

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");

    if (needsUsername && !username.trim()) {
      setError(t("auth.chooseUsername"));
      return;
    }

    if (
      newPassword.length < 10 ||
      !/[A-Z]/.test(newPassword) ||
      !/[a-z]/.test(newPassword) ||
      !/\d/.test(newPassword) ||
      !/[^A-Za-z0-9]/.test(newPassword)
    ) {
      setError(passwordStrengthText);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError(t("auth.passwordsDoNotMatch"));
      return;
    }

    const result = await onSubmit({
      username: username.trim(),
      password: newPassword,
    });
    if (!result?.ok) {
      setError(result?.error || t("auth.passwordChangeFailed"));
      return;
    }

    setMessage(t("auth.passwordUpdated"));
    setUsername("");
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
          <h1>{t("auth.setUpAccount")}</h1>
          <p>{t("auth.forcePasswordDescription")}</p>
        </div>

        <form className="auth-form" onSubmit={(event) => void handleSubmit(event)}>
          {needsUsername ? (
            <label>
              {t("auth.chooseUsername")}
              <input
                type="text"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="username"
                required
              />
            </label>
          ) : null}

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

          <small className="field-note">{passwordStrengthText}</small>

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
