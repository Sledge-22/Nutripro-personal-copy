import React, { useState } from "react";
import { Brand } from "../components/ui.jsx";
import { LanguageDropdown } from "../components/LanguageDropdown.jsx";
import { useLanguage } from "../i18n/LanguageContext.jsx";
import { ROUTES } from "../routes/appRoutes.js";

export function ForcedPasswordPage({
  onSubmit,
  onDismissReminder,
  loading = false,
  currentUsername = "",
  requirePasswordChange = true,
  requirePrivacyConsent = false,
  showPrivacyReminder = false,
}) {
  const { t, language } = useLanguage();
  const [username, setUsername] = useState(currentUsername || "");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const needsUsername = requirePasswordChange && !`${currentUsername ?? ""}`.trim();
  const policyVersion = "2026-07-draft";
  const isReminderOnly = showPrivacyReminder && !requirePasswordChange && !requirePrivacyConsent;
  const passwordStrengthText = t("auth.passwordStrengthRequirement") !== "auth.passwordStrengthRequirement"
    ? t("auth.passwordStrengthRequirement")
    : language === "es"
      ? "La contraseña debe incluir al menos 10 caracteres, letras mayúsculas y minúsculas, un número y un símbolo."
      : "Password must include at least 10 characters, uppercase and lowercase letters, a number, and a symbol.";

  const title = isReminderOnly
    ? (language === "es" ? "Recordatorio de privacidad" : "Privacy reminder")
    : requirePasswordChange
      ? t("auth.setUpAccount")
      : language === "es"
        ? "Confirma privacidad y uso de datos"
        : "Confirm privacy and data use";

  const description = isReminderOnly
    ? (language === "es"
        ? "Nutripro usa la información de tu cuenta, cursos, tareas y comunidad para proporcionar acceso a la plataforma y funciones de aprendizaje. Puedes revisar la Política de privacidad y uso de datos en cualquier momento."
        : "Nutripro uses your account, course, assignment, and community information to provide platform access and learning features. You can review the Privacy Policy and Data Use terms at any time.")
    : requirePasswordChange
      ? t("auth.forcePasswordDescription")
      : language === "es"
        ? "Revisa y acepta la Política de privacidad y los términos de uso de datos antes de continuar."
        : "Please review and accept the Privacy Policy and Data Use terms before continuing.";

  const checkboxText = language === "es"
    ? "He leído y acepto la Política de privacidad y los términos de uso de datos."
    : "I have read and agree to the Privacy Policy and Data Use terms.";

  const readPolicyText = language === "es" ? "Leer política de privacidad" : "Read privacy policy";

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");

    if (needsUsername && !username.trim()) {
      setError(t("auth.chooseUsername"));
      return;
    }

    if (requirePrivacyConsent && !privacyAccepted) {
      setError(
        language === "es"
          ? "Debes aceptar la Política de privacidad y los términos de uso de datos para continuar."
          : "You must accept the Privacy Policy and Data Use terms to continue.",
      );
      return;
    }

    if (requirePasswordChange && (
      newPassword.length < 10 ||
      !/[A-Z]/.test(newPassword) ||
      !/[a-z]/.test(newPassword) ||
      !/\d/.test(newPassword) ||
      !/[^A-Za-z0-9]/.test(newPassword)
    )) {
      setError(passwordStrengthText);
      return;
    }

    if (requirePasswordChange && newPassword !== confirmPassword) {
      setError(t("auth.passwordsDoNotMatch"));
      return;
    }

    const result = await onSubmit({
      username: username.trim(),
      password: newPassword,
      privacyPolicyAccepted: privacyAccepted,
      privacyPolicyVersion: policyVersion,
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
          <h1>{title}</h1>
          <p>{description}</p>
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

          {requirePasswordChange ? (
            <>
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
            </>
          ) : null}

          {requirePrivacyConsent ? (
            <label className="privacy-consent-card">
              <span className="checkbox-row">
                <input
                  type="checkbox"
                  checked={privacyAccepted}
                  onChange={(event) => setPrivacyAccepted(event.target.checked)}
                />
                <span>{checkboxText}</span>
              </span>
              <a className="text-link" href={ROUTES.privacy}>
                {readPolicyText}
              </a>
            </label>
          ) : null}

          {message ? <small className="field-note">{message}</small> : null}
          {error ? <small className="field-note danger-text">{error}</small> : null}

          <div className="form-actions">
            <button type="submit" className="primary-btn" disabled={loading}>
              {loading
                ? t("common.saving")
                : isReminderOnly
                  ? (language === "es" ? "Continuar" : "Continue")
                  : requirePasswordChange
                    ? t("auth.changePassword")
                    : language === "es"
                      ? "Aceptar y continuar"
                      : "Accept and continue"}
            </button>
            {isReminderOnly ? (
              <button
                type="button"
                className="secondary-btn"
                disabled={loading}
                onClick={() => void onDismissReminder?.()}
              >
                {language === "es" ? "No volver a mostrar" : "Never show again"}
              </button>
            ) : null}
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
