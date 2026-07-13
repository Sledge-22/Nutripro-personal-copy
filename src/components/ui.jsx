import React from "react";
import { useLanguage } from "../i18n/LanguageContext.jsx";
import { LanguageDropdown } from "./LanguageDropdown.jsx";

const BRAND_LOGO_SRC = "/assets/nutripro-logo.png";

const icons = {
  dashboard: <path d="M4 13h6V4H4v9Zm0 7h6v-4H4v4Zm10 0h6v-9h-6v9Zm0-16v4h6V4h-6Z" />,
  users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
  courses: <><path d="m4 19.5 7-3.5 9 4.5V5.5L11 1 4 4.5v15Z" /><path d="M11 1v15M4 4.5l7 3.5 9-4" /></>,
  certificate: <><circle cx="12" cy="8" r="6" /><path d="M8.5 13 7 22l5-3 5 3-1.5-9" /></>,
  community: <><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v8Z" /><path d="M8 9h8M8 13h5" /></>,
  arrow: <><path d="M5 12h14M13 6l6 6-6 6" /></>,
  logout: <><path d="M10 17l5-5-5-5M15 12H3" /><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  play: <path d="m9 7 8 5-8 5V7Z" />,
  check: <path d="m5 12 4 4L19 6" />,
  chevron: <path d="m9 18 6-6-6-6" />,
};

export function Icon({ name, size = 20 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill={name === "dashboard" ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{icons[name]}</svg>;
}

function goHome() {
  window.history.pushState({}, "", "/");
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export function Brand() {
  const { t } = useLanguage();
  return (
    <button type="button" className="brand brand-link" aria-label="Go to homepage" onClick={goHome}>
      <img className="brand-logo" src={BRAND_LOGO_SRC} alt="Nutripro logo" />
      <div><strong>Nutripro</strong><small>{t("brand.tagline")}</small></div>
    </button>
  );
}

export function Status({ status }) {
  const { translateStatus } = useLanguage();
  const normalizedStatus = String(status ?? "").toLowerCase().replace(/\s+/g, "_");
  return <span className={`status ${normalizedStatus}`}><i />{translateStatus(status)}</span>;
}

export function Progress({ value }) {
  return <div className="progress" role="progressbar" aria-valuenow={value} aria-valuemin="0" aria-valuemax="100"><span style={{ width: `${value}%` }} /></div>;
}

export function Welcome({ title, text }) {
  const { t } = useLanguage();
  return <div className="welcome"><div><span className="eyebrow">{t("dashboard.atAGlance")}</span><h2>{title}</h2><p>{text}</p></div><div className="welcome-mark">N</div></div>;
}

export function Stat({ icon, label, value, note }) {
  return <article className="stat-card"><span className="stat-icon"><Icon name={icon} /></span><div><small>{label}</small><strong>{value}</strong><p>{note}</p></div></article>;
}

export function OverviewCard({ icon, title, text }) {
  return <article className="overview-card"><span><Icon name={icon} /></span><h3>{title}</h3><p>{text}</p></article>;
}

export function Header({ role, title, detailTitle, profile }) {
  const { t, translateRole } = useLanguage();
  const profileName = profile?.name || (role === "Admin" ? t("header.AlexMorgan") : t("header.MayaLaurent"));
  const initials = (profileName || "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || (role === "Admin" ? "AM" : "ML");

  return <header className="topbar"><div>{detailTitle ? <><button className="back-label">{t("header.coursesCourseDetail")}</button><h1>{detailTitle}</h1></> : <><span className="eyebrow">{role === "Admin" ? t("common.adminArea") : t("common.studentArea")}</span><h1>{title}</h1></>}</div><div className="topbar-actions"><LanguageDropdown /><div className="profile">{profile?.profilePictureUrl || profile?.profile_picture_url ? <img className="avatar avatar-image" src={profile.profilePictureUrl || profile.profile_picture_url} alt={profileName} /> : <div className="avatar">{initials}</div>}<div><strong>{profileName}</strong><small>{translateRole(role)}</small></div></div></div></header>;
}

export function Sidebar({ role, navItems, currentPath, onNavigate, onLogout }) {
  const { t, translateRole } = useLanguage();
  return <aside className="sidebar"><Brand /><div className="role-pill"><span className="role-dot" />{t("common.roleArea", { role: translateRole(role) })}</div><nav aria-label={`${translateRole(role)} navigation`}>{navItems.map((item) => <button key={item.path} className={`nav-item ${currentPath === item.path ? "active" : ""}`} onClick={() => onNavigate(item.path)}><Icon name={item.icon} />{item.label}</button>)}</nav><button className="logout" onClick={onLogout}><Icon name="logout" />{t("common.signOut")}</button></aside>;
}

export function CertificateModal({ certificate, onClose }) {
  const { t } = useLanguage();
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="certificate-modal modern-certificate-modal" onMouseDown={(event) => event.stopPropagation()}><button className="modal-close print-hidden" onClick={onClose}>×</button><div className="certificate-print-card"><img className="certificate-logo" src={BRAND_LOGO_SRC} alt={t("certificateModal.logoAlt")} /><span className="eyebrow">NUTRIPRO</span><h2>{t("student.certificateOfCompletion")}</h2><p>{t("certificateModal.certifiesThat")}</p><h3>{certificate.student}</h3><p>{t("certificateModal.successfullyCompleted")}</p><h4>{certificate.course}</h4><div className="certificate-meta"><span><strong>{t("admin.issueDate")}:</strong> {certificate.issueDate}</span><span><strong>{t("admin.certificateNumber")}:</strong> {certificate.number}</span></div><p className="certificate-footer">{t("certificateModal.footer")}</p></div><div className="form-actions compact certificate-print-actions print-hidden"><button type="button" className="secondary-btn" onClick={() => window.print()}>{t("certificateModal.print")}</button></div></div></div>;
}
