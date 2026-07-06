import React, { useState } from "react";
import { Brand, Icon } from "../components/ui.jsx";
import { LanguageDropdown } from "../components/LanguageDropdown.jsx";
import { useLanguage } from "../i18n/LanguageContext.jsx";
import heroPlaceholder from "../assets/home-hero-placeholder.svg";

export function LoginPage({
  onChoose,
  onLogin,
  authMode = "demo",
  loading = false,
  error = "",
  info = "",
}) {
  const { t } = useLanguage();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!onLogin) return;
    await onLogin({
      identifier,
      password,
    });
  };

  // Demo homepage layout stays asset-ready here. Replace heroPlaceholder and the Brand logo import
  // with the uploaded soccer photo and transparent Nutripro logo once the exact files are available.
  return <main className="login-page">
    <section className="login-panel">
      <div className="login-topbar">
        <Brand />
        <LanguageDropdown />
      </div>
      <div className="login-copy"><span className="eyebrow">{t("login.eyebrow")}</span><h1>{t("login.title").split("\n").map((line, index) => <React.Fragment key={line}>{index ? <br /> : null}{line}</React.Fragment>)}</h1><p>{t("login.description")}</p><strong className="login-slogan">{t("login.slogan")}</strong></div>

      {authMode === "demo" ? (
        <>
          <div className="role-options">
            <button onClick={() => onChoose?.("Admin")}><span className="role-icon admin"><Icon name="users" size={24} /></span><span><strong>{t("login.continueAsAdmin")}</strong><small>{t("login.adminDescription")}</small></span><Icon name="arrow" /></button>
            <button onClick={() => onChoose?.("Student")}><span className="role-icon student"><Icon name="courses" size={24} /></span><span><strong>{t("login.continueAsStudent")}</strong><small>{t("login.studentDescription")}</small></span><Icon name="arrow" /></button>
          </div>
          <p className="demo-note">{t("login.demoAccess")}</p>
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

          <div className="form-actions">
            <button type="submit" className="primary-btn" disabled={loading}>
              {loading ? t("common.loading") : t("auth.signIn")}
            </button>
          </div>
        </form>
      )}

      <footer className="login-footer">{t("login.footer")}</footer>
    </section>
    <aside className="login-visual hero-visual"><div className="visual-orbit one" /><div className="visual-orbit two" /><img className="hero-placeholder-image hero-image" src={heroPlaceholder} alt="Nutripro homepage hero" /><div className="visual-card hero-overlay-card"><div className="leaf">N</div><p>{t("login.learnAtYourPace")}</p><strong>{t("login.practicalNutrition").split("\n").map((line, index) => <React.Fragment key={line}>{index ? <br /> : null}{line}</React.Fragment>)}</strong><div className="mini-progress"><span /></div></div></aside>
  </main>;
}
