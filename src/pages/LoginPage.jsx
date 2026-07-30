import React, { useState } from "react";
import { Brand, Icon } from "../components/ui.jsx";
import { LanguageDropdown } from "../components/LanguageDropdown.jsx";
import { useLanguage } from "../i18n/LanguageContext.jsx";
import { submitTeamApplication } from "../services/teamApplicationService.js";
import { sanitizeErrorDetails } from "../utils/errorDisplay.js";

const HERO_IMAGE_SRC = "/assets/homepage-hero.png";

export function LoginPage({
  onLogin,
  loading = false,
  error = "",
  errorDetails = "",
  info = "",
}) {
  const { t, language } = useLanguage();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [teamFormOpen, setTeamFormOpen] = useState(false);
  const [teamForm, setTeamForm] = useState({
    fullName: "",
    email: "",
    teachingTopic: "",
    experience: "",
    portfolioUrl: "",
    message: "",
  });
  const [teamSubmitting, setTeamSubmitting] = useState(false);
  const [teamMessage, setTeamMessage] = useState("");
  const [teamError, setTeamError] = useState("");
  const [teamErrorDetails, setTeamErrorDetails] = useState("");
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
  const showPasswordLabel = language === "es" ? "Mostrar contraseña" : "Show password";
  const hidePasswordLabel = language === "es" ? "Ocultar contraseña" : "Hide password";

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!onLogin) return;
    await onLogin({
      identifier: identifier.trim(),
      password,
    });
  };

  const updateTeamField = (field, value) => {
    setTeamForm((current) => ({ ...current, [field]: value }));
    setTeamError("");
    setTeamErrorDetails("");
    setTeamMessage("");
  };

  const handleTeamSubmit = async (event) => {
    event.preventDefault();
    const emailValue = teamForm.email.trim();
    if (!teamForm.fullName.trim() || !emailValue || !teamForm.teachingTopic.trim()) {
      setTeamError(t("login.teamApplicationRequired"));
      setTeamErrorDetails("");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue)) {
      setTeamError(t("login.teamApplicationInvalidEmail"));
      setTeamErrorDetails("");
      return;
    }

    setTeamSubmitting(true);
    setTeamError("");
    setTeamErrorDetails("");
    setTeamMessage("");

    try {
      const submittedApplication = await submitTeamApplication(teamForm);
      if (!submittedApplication?.id) {
        throw new Error("Team application was not confirmed by Supabase.");
      }
      setTeamMessage(t("login.teamApplicationSubmitted"));
      setTeamForm({
        fullName: "",
        email: "",
        teachingTopic: "",
        experience: "",
        portfolioUrl: "",
        message: "",
      });
    } catch (submitError) {
      console.error("Team application submission failed:", submitError);
      setTeamError(t("login.teamApplicationFailed"));
      setTeamErrorDetails(sanitizeErrorDetails(submitError));
    } finally {
      setTeamSubmitting(false);
    }
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
          <div className="password-field-row">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={t("auth.passwordPlaceholder")}
              autoComplete="current-password"
              required
            />
            <button
              type="button"
              className="secondary-btn password-toggle-btn"
              onClick={() => setShowPassword((current) => !current)}
              aria-label={showPassword ? hidePasswordLabel : showPasswordLabel}
            >
              {showPassword ? hidePasswordLabel : showPasswordLabel}
            </button>
          </div>
        </label>

        {info ? <small className="field-note">{info}</small> : null}
        {error ? <small className="field-note danger-text">{error}</small> : null}
        {errorDetails ? (
          <details className="field-note login-error-details">
            <summary>{language === "es" ? "Detalles técnicos" : "Technical details"}</summary>
            <pre>{errorDetails}</pre>
          </details>
        ) : null}
        <button type="button" className="text-link-btn" onClick={() => window.alert(forgotPasswordHelp)}>
          {forgotPasswordLabel}
        </button>

        <div className="form-actions">
          <button type="submit" className="primary-btn" disabled={loading}>
            {loading ? t("common.loading") : t("auth.signIn")}
          </button>
        </div>
      </form>

      <section className={`team-application-card ${teamFormOpen ? "is-open" : ""}`}>
        <button
          type="button"
          className="team-application-summary"
          onClick={() => setTeamFormOpen((current) => !current)}
          aria-expanded={teamFormOpen}
        >
          <span className="team-application-icon"><Icon name="users" /></span>
          <span className="team-application-copy">
            <strong>{t("login.joinTeachingTeam")}</strong>
            <small>{t("login.joinTeachingTeamText")}</small>
          </span>
          <span className="team-application-cta">
            {t("login.joinNutriproTeam")}
            <Icon name="chevron" size={16} />
          </span>
        </button>

        {teamFormOpen ? (
          <form className="team-application-form" onSubmit={(event) => void handleTeamSubmit(event)}>
            <div className="team-application-grid">
              <label>
                {t("login.teamFullName")}
                <input value={teamForm.fullName} onChange={(event) => updateTeamField("fullName", event.target.value)} required />
              </label>
              <label>
                {t("login.teamEmail")}
                <input type="email" value={teamForm.email} onChange={(event) => updateTeamField("email", event.target.value)} required />
              </label>
              <label>
                {t("login.teamTeachingTopic")}
                <input value={teamForm.teachingTopic} onChange={(event) => updateTeamField("teachingTopic", event.target.value)} required />
              </label>
              <label>
                {t("login.teamPortfolio")}
                <input value={teamForm.portfolioUrl} onChange={(event) => updateTeamField("portfolioUrl", event.target.value)} />
              </label>
            </div>
            <label>
              {t("login.teamExperience")}
              <textarea rows="3" value={teamForm.experience} onChange={(event) => updateTeamField("experience", event.target.value)} />
            </label>
            <label>
              {t("login.teamMessage")}
              <textarea rows="3" value={teamForm.message} onChange={(event) => updateTeamField("message", event.target.value)} />
            </label>
            {teamError ? <small className="field-note danger-text">{teamError}</small> : null}
            {teamErrorDetails ? (
              <details className="field-note login-error-details">
                <summary>{language === "es" ? "Detalles técnicos" : "Technical details"}</summary>
                <pre>{teamErrorDetails}</pre>
              </details>
            ) : null}
            {teamMessage ? <small className="field-note success-text">{teamMessage}</small> : null}
            <div className="form-actions team-application-actions">
              <button type="button" className="secondary-btn" onClick={() => setTeamFormOpen(false)} disabled={teamSubmitting}>
                {t("common.close")}
              </button>
              <button type="submit" className="primary-btn" disabled={teamSubmitting}>
                {teamSubmitting ? t("common.saving") : t("login.submitApplication")}
              </button>
            </div>
          </form>
        ) : null}
      </section>

      <footer className="login-footer">{t("login.footer")}</footer>
    </section>
    <aside className="login-visual hero-visual"><div className="visual-orbit one" /><div className="visual-orbit two" /><img className="hero-placeholder-image hero-image" src={HERO_IMAGE_SRC} alt="Woman standing on a soccer field with a soccer ball" /><div className="visual-card hero-overlay-card"><div className="leaf">N</div><p>{t("login.learnAtYourPace")}</p><strong>{t("login.practicalNutrition").split("\n").map((line, index) => <React.Fragment key={line}>{index ? <br /> : null}{line}</React.Fragment>)}</strong><div className="mini-progress"><span /></div></div></aside>
  </main>;
}
