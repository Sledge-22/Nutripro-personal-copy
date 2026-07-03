import React from "react";
import { Brand, Icon } from "../components/ui.jsx";
import { LanguageDropdown } from "../components/LanguageDropdown.jsx";
import { useLanguage } from "../i18n/LanguageContext.jsx";
import heroPlaceholder from "../assets/home-hero-placeholder.svg";

export function LoginPage({ onChoose }) {
  const { t } = useLanguage();

  return <main className="login-page">
    <section className="login-panel">
      <div className="login-topbar">
        <Brand />
        <LanguageDropdown />
      </div>
      <div className="login-copy"><span className="eyebrow">{t("login.eyebrow")}</span><h1>{t("login.title").split("\n").map((line, index) => <React.Fragment key={line}>{index ? <br /> : null}{line}</React.Fragment>)}</h1><p>{t("login.description")}</p><strong className="login-slogan">{t("login.slogan")}</strong></div>
      <div className="role-options">
        <button onClick={() => onChoose("Admin")}><span className="role-icon admin"><Icon name="users" size={24} /></span><span><strong>{t("login.continueAsAdmin")}</strong><small>{t("login.adminDescription")}</small></span><Icon name="arrow" /></button>
        <button onClick={() => onChoose("Student")}><span className="role-icon student"><Icon name="courses" size={24} /></span><span><strong>{t("login.continueAsStudent")}</strong><small>{t("login.studentDescription")}</small></span><Icon name="arrow" /></button>
      </div>
      <p className="demo-note">{t("login.demoAccess")}</p>
      <footer className="login-footer">{t("login.footer")}</footer>
    </section>
    <aside className="login-visual"><div className="visual-orbit one" /><div className="visual-orbit two" /><img className="hero-placeholder-image" src={heroPlaceholder} alt="Nutripro hero placeholder" /><div className="visual-card"><div className="leaf">N</div><p>{t("login.learnAtYourPace")}</p><strong>{t("login.practicalNutrition").split("\n").map((line, index) => <React.Fragment key={line}>{index ? <br /> : null}{line}</React.Fragment>)}</strong><div className="mini-progress"><span /></div></div></aside>
  </main>;
}
