import React, { useState } from "react";
import { Brand } from "../components/ui.jsx";
import { LanguageDropdown } from "../components/LanguageDropdown.jsx";
import { useLanguage } from "../i18n/LanguageContext.jsx";

const HERO_IMAGE_SRC = "/assets/homepage-hero.png";

export function LoginPage({
  onLogin,
  loading = false,
  error = "",
  info = "",
}) {
  const { t, language } = useLanguage();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const eyebrow = language === "es" ? "BIENVENIDO A NUTRIPRO" : "WELCOME TO NUTRIPRO";
  const title = language === "es" ? "Hacete experto en tu deporte." : "Become an expert in your sport.";
  const description = language === "es"
    ? "Inicia sesión para acceder a tus cursos, comunidad, tareas y certificados."
    : "Log in to access your courses, community, assignments, and certificates.";
  const forgotPasswordLabel = t("auth.forgotPassword") !== "auth.forgotPassword"
    ? t("auth.forgotPassword")
    : language === "es"
      ? "¿Olvidaste tu contraseña?"
      : "Forgot password?";
  const forgotPasswordHelp = t("auth.forgotPasswordHelp") !== "auth.forgotPasswordHelp"
    ? t("auth.forgotPasswordHelp")
    : language === "es"
      ? "Pide a un administrador de Nutripro que restablezca tu acceso."
      : "Ask a Nutripro administrator to reset your access.";

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!onLogin) return;
    await onLogin({
      identifier,
      password,
    });
  };

  return <main className="login-page">
    <section className="login-panel">
      <div className="login-topbar">
        <Brand />
        <LanguageDropdown />
      </div>
      <div className="login-copy"><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p><strong className="login-slogan">{t("login.slogan")}</strong></div>

      <form className="auth-form" onSubmit={(event) => void handleSubmit(event)}>
        <label>
          {t("auth.emailOrUsername")}
          <input
            type="text"
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            placeholder={t("auth.emailOrUsernamePlaceholder")}
            autoComplete="username"
            required
          />
        </label>

        <label>
          {t("auth.password")}
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder={t("auth.passwordPlaceholder")}
            autoComplete="current-password"
            required
          />
        </label>

        {info ? <small className="field-note">{info}</small> : null}
        {error ? <small className="field-note danger-text">{error}</small> : null}
        <button type="button" className="text-link-btn" onClick={() => window.alert(forgotPasswordHelp)}>
          {forgotPasswordLabel}
        </button>

        <div className="form-actions">
          <button type="submit" className="primary-btn" disabled={loading}>
            {loading ? t("common.loading") : t("auth.signIn")}
          </button>
        </div>
      </form>

      <footer className="login-footer">{t("login.footer")}</footer>
    </section>
    <aside className="login-visual hero-visual"><div className="visual-orbit one" /><div className="visual-orbit two" /><img className="hero-placeholder-image hero-image" src={HERO_IMAGE_SRC} alt="Woman standing on a soccer field with a soccer ball" /><div className="visual-card hero-overlay-card"><div className="leaf">N</div><p>{t("login.learnAtYourPace")}</p><strong>{t("login.practicalNutrition").split("\n").map((line, index) => <React.Fragment key={line}>{index ? <br /> : null}{line}</React.Fragment>)}</strong><div className="mini-progress"><span /></div></div></aside>
  </main>;
}
