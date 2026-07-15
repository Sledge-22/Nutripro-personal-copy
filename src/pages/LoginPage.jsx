import React, { useState } from "react";
import { Brand, Icon } from "../components/ui.jsx";
import { LanguageDropdown } from "../components/LanguageDropdown.jsx";
import { useLanguage } from "../i18n/LanguageContext.jsx";

const HERO_IMAGE_SRC = "/assets/homepage-hero.png";

export function LoginPage({
  onChoose,
  onLogin,
  onOpenProductionLogin,
  onBackToHome,
  authMode = "demo",
  siteAccessMode = "demo",
  canShowProductionEntry = true,
  loading = false,
  error = "",
  info = "",
}) {
  const { t, language } = useLanguage();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const productionLoginLabel = t("login.productionLogin") !== "login.productionLogin"
    ? t("login.productionLogin")
    : language === "es"
      ? "Inicio de sesión de producción"
      : "Production Login";
  const productionLoginDescription = t("login.productionLoginDescription") !== "login.productionLoginDescription"
    ? t("login.productionLoginDescription")
    : language === "es"
      ? "Accede con tu correo y contraseña de invitación"
      : "Sign in with your invited email and password";
  const backToDemoHomeLabel = t("login.backToDemoHome") !== "login.backToDemoHome"
    ? t("login.backToDemoHome")
    : language === "es"
      ? "Volver al inicio demo"
      : "Back to demo home";
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
  const demoModeHelp = language === "es"
    ? "Usa el acceso demo para pruebas y presentaciones."
    : "Use demo access for testing and presentations.";
  const loginModeHelp = language === "es"
    ? "Usa el modo de inicio de sesión para usuarios invitados reales."
    : "Use login mode for real invited users.";
  const demoAdminLabel = language === "es" ? "Admin demo" : "Demo Admin";
  const demoStudentLabel = language === "es" ? "Estudiante demo" : "Demo Student";

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
      <div className="login-copy"><span className="eyebrow">{t("login.eyebrow")}</span><h1>{t("login.title").split("\n").map((line, index) => <React.Fragment key={line}>{index ? <br /> : null}{line}</React.Fragment>)}</h1><p>{t("login.description")}</p><strong className="login-slogan">{t("login.slogan")}</strong></div>

      {authMode === "demo" ? (
        <>
          {siteAccessMode === "production" ? (
            <>
              <div className="role-options">
                <button onClick={() => onOpenProductionLogin?.()}><span className="role-icon production"><Icon name="certificate" size={24} /></span><span><strong>{productionLoginLabel}</strong><small>{productionLoginDescription}</small></span><Icon name="arrow" /></button>
              </div>
              <p className="demo-note">{loginModeHelp}</p>
            </>
          ) : (
            <>
              <div className="role-options">
                <button onClick={() => onChoose?.("Admin")}><span className="role-icon admin"><Icon name="users" size={24} /></span><span><strong>{demoAdminLabel}</strong><small>{t("login.adminDescription")}</small></span><Icon name="arrow" /></button>
                <button onClick={() => onChoose?.("Student")}><span className="role-icon student"><Icon name="courses" size={24} /></span><span><strong>{demoStudentLabel}</strong><small>{t("login.studentDescription")}</small></span><Icon name="arrow" /></button>
                {canShowProductionEntry ? (
                  <button onClick={() => onOpenProductionLogin?.()}><span className="role-icon production"><Icon name="certificate" size={24} /></span><span><strong>{productionLoginLabel}</strong><small>{productionLoginDescription}</small></span><Icon name="arrow" /></button>
                ) : null}
              </div>
              <p className="demo-note">{demoModeHelp}</p>
            </>
          )}
        </>
      ) : (
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
          <button type="button" className="text-link-btn" onClick={() => onBackToHome?.()}>
            {backToDemoHomeLabel}
          </button>
          <button type="button" className="text-link-btn" onClick={() => window.alert(forgotPasswordHelp)}>
            {forgotPasswordLabel}
          </button>

          <div className="form-actions">
            <button type="submit" className="primary-btn" disabled={loading}>
              {loading ? t("common.loading") : t("auth.signIn")}
            </button>
          </div>
        </form>
      )}

      <footer className="login-footer">{t("login.footer")}</footer>
    </section>
    <aside className="login-visual hero-visual"><div className="visual-orbit one" /><div className="visual-orbit two" /><img className="hero-placeholder-image hero-image" src={HERO_IMAGE_SRC} alt="Woman standing on a soccer field with a soccer ball" /><div className="visual-card hero-overlay-card"><div className="leaf">N</div><p>{t("login.learnAtYourPace")}</p><strong>{t("login.practicalNutrition").split("\n").map((line, index) => <React.Fragment key={line}>{index ? <br /> : null}{line}</React.Fragment>)}</strong><div className="mini-progress"><span /></div></div></aside>
  </main>;
}
