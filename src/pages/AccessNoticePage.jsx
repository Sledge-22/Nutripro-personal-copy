import React from "react";
import { Brand } from "../components/ui.jsx";
import { LanguageDropdown } from "../components/LanguageDropdown.jsx";
import { useLanguage } from "../i18n/LanguageContext.jsx";

export function AccessNoticePage({ title, message, onAction, actionLabel, onSignOut, role }) {
  const { t, translateRole } = useLanguage();

  return (
    <main className="login-page auth-page">
      <section className="login-panel auth-panel">
        <div className="login-topbar">
          <Brand />
          <LanguageDropdown />
        </div>

        <div className="login-copy">
          <span className="eyebrow">{role ? t("common.roleArea", { role: translateRole(role) }) : t("common.status")}</span>
          <h1>{title}</h1>
          <p>{message}</p>
        </div>

        <div className="form-actions">
          {onAction ? (
            <button type="button" className="primary-btn" onClick={onAction}>
              {actionLabel || t("auth.returnToDashboard")}
            </button>
          ) : null}
          <button type="button" className="secondary-btn" onClick={onSignOut}>
            {t("common.signOut")}
          </button>
        </div>
      </section>

      <aside className="login-visual auth-visual">
        <div className="visual-card auth-message-card">
          <div className="leaf">N</div>
          <p>{t("auth.accessNoticeTitle")}</p>
          <strong>{t("auth.accessNoticeBody")}</strong>
        </div>
      </aside>
    </main>
  );
}
