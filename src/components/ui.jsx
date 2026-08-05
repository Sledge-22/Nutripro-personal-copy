import React, { useEffect, useRef, useState } from "react";
import { useLanguage } from "../i18n/LanguageContext.jsx";
import { LanguageDropdown } from "./LanguageDropdown.jsx";
import {
  clearReadNotifications,
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../services/notificationService.js";

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
  lock: <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
  chevron: <path d="m9 18 6-6-6-6" />,
  menu: <><path d="M4 7h16" /><path d="M4 12h16" /><path d="M4 17h16" /></>,
  close: <><path d="M6 6l12 12" /><path d="M18 6 6 18" /></>,
  bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
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

function isNavGroup(item) {
  return Array.isArray(item?.children);
}

function isNavItemActive(item, currentPath) {
  if (isNavGroup(item)) {
    return item.children.some((child) => child.path === currentPath);
  }

  return item.path === currentPath;
}

function notificationIconFor(type) {
  if (type === "assignment_submitted" || type === "assignment_review_returned") return "certificate";
  if (type === "team_application_submitted" || type === "team_application_reviewed") return "users";
  if (type === "new_course_assigned" || type === "lesson_unlocked") return "courses";
  if (type === "certificate_generated") return "certificate";
  if (type === "announcement") return "bell";
  return "community";
}

function formatNotificationTime(value, language) {
  if (!value) return "";

  try {
    return new Intl.DateTimeFormat(language === "en" ? "en-US" : "es-ES", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return "";
  }
}

export function AnnouncementAlertList({ notifications = [], onNavigate }) {
  const { t, language } = useLanguage();
  const announcementAlerts = notifications
    .filter((notification) => notification.type === "announcement" && !notification.readAt && ["important", "urgent"].includes(notification.priority))
    .slice(0, 3);

  if (!announcementAlerts.length) return null;

  return (
    <div className="announcement-alert-list">
      {announcementAlerts.map((notification) => (
        <button
          key={notification.id}
          type="button"
          className={`announcement-alert-card ${notification.priority}`}
          onClick={() => notification.linkPath && onNavigate?.(notification.linkPath)}
        >
          <span className="announcement-alert-icon"><Icon name="bell" /></span>
          <span>
            <small>{notification.priority === "urgent" ? t("admin.priorityUrgent") : t("admin.priorityImportant")}</small>
            <strong>{notification.title || t("notifications.types.announcement.title")}</strong>
            <em>{notification.description || t("notifications.types.announcement.description")}</em>
            <span>{formatNotificationTime(notification.createdAt, language)}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

function NotificationCenter({ profile, role, onNavigate }) {
  const { t, language } = useLanguage();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef(null);
  const unreadCount = notifications.filter((notification) => !notification.readAt).length;
  const unreadLabel = unreadCount > 9 ? "9+" : String(unreadCount);

  useEffect(() => {
    let mounted = true;

    async function loadNotifications() {
      if (!profile) {
        setNotifications([]);
        return;
      }

      setLoading(true);
      try {
        const nextNotifications = await getNotifications(profile);
        if (mounted) setNotifications(nextNotifications);
      } catch (error) {
        console.error("Loading notifications failed:", error);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void loadNotifications();

    return () => {
      mounted = false;
    };
  }, [profile?.id, profile?.roleKey, profile?.role]);

  useEffect(() => {
    if (!open) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") setOpen(false);
    };

    const handlePointerDown = (event) => {
      if (!panelRef.current?.contains(event.target)) setOpen(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("mousedown", handlePointerDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("mousedown", handlePointerDown);
    };
  }, [open]);

  const handleOpenNotification = async (notification) => {
    const nextNotifications = await markNotificationRead(profile, notification.id, notifications);
    setNotifications(nextNotifications);
    setOpen(false);
    if (notification.linkPath) onNavigate?.(notification.linkPath);
  };

  const handleMarkOneRead = async (event, notification) => {
    event.stopPropagation();
    const nextNotifications = await markNotificationRead(profile, notification.id, notifications);
    setNotifications(nextNotifications);
  };

  const handleMarkAllRead = async () => {
    const nextNotifications = await markAllNotificationsRead(profile, notifications);
    setNotifications(nextNotifications);
  };

  const handleClearRead = async () => {
    const nextNotifications = await clearReadNotifications(profile, notifications);
    setNotifications(nextNotifications);
  };

  return (
    <div className="notification-center" ref={panelRef}>
      <button
        type="button"
        className="notification-bell"
        aria-label={t("notifications.open")}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <Icon name="bell" size={19} />
        {unreadCount > 0 ? <span className="notification-badge">{unreadLabel}</span> : null}
      </button>

      {open ? (
        <div className="notification-panel" role="dialog" aria-label={t("notifications.title")}>
          <div className="notification-panel-header">
            <div>
              <h3>{t("notifications.title")}</h3>
            </div>
            <span className="notification-count">{t("notifications.unreadCount", { count: unreadCount })}</span>
          </div>

          <div className="notification-actions">
            <button type="button" className="notification-action-btn" onClick={handleMarkAllRead} disabled={!unreadCount}>
              {t("notifications.markAllRead")}
            </button>
            <button type="button" className="notification-action-btn" onClick={handleClearRead} disabled={!notifications.some((notification) => notification.readAt)}>
              {t("notifications.clearRead")}
            </button>
          </div>

          <div className="notification-list">
            {loading ? <p className="field-note">{t("common.loading")}</p> : null}
            {!loading && !notifications.length ? <p className="notification-empty-state">{t("notifications.empty")}</p> : null}
            {notifications.map((notification) => {
              const title = notification.title || t(notification.titleKey);
              const description = notification.description || t(notification.descriptionKey);
              const unread = !notification.readAt;

              return (
                <article
                  key={notification.id}
                  role="button"
                  tabIndex={0}
                  className={`notification-item ${unread ? "unread" : "read"}`}
                  onClick={() => void handleOpenNotification(notification)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") void handleOpenNotification(notification);
                  }}
                >
                  <span className="notification-type-icon"><Icon name={notificationIconFor(notification.type)} size={18} /></span>
                  <span className="notification-copy">
                    <strong>{title}</strong>
                    <small>{description}</small>
                    <em>{formatNotificationTime(notification.createdAt, language)}</em>
                  </span>
                  {unread ? (
                    <span
                      role="button"
                      tabIndex={0}
                      className="notification-read-action"
                      onClick={(event) => void handleMarkOneRead(event, notification)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") void handleMarkOneRead(event, notification);
                      }}
                    >
                      {t("notifications.markRead")}
                    </span>
                  ) : null}
                </article>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function Header({ role, title, detailTitle, profile, navItems = [], currentPath = "", onNavigate, onLogout }) {
  const { t, translateRole } = useLanguage();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileClosedGroups, setMobileClosedGroups] = useState({});
  const mobileMenuRef = useRef(null);
  const activeMobileGroupId = navItems.find((item) => isNavGroup(item) && isNavItemActive(item, currentPath))?.id ?? "";
  const profileName =
    profile?.name ||
    (role === "Admin" ? t("header.AlexMorgan") : role === "Instructor" ? "Instructor" : t("header.MayaLaurent"));
  const initials = (profileName || "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || (role === "Admin" ? "AM" : role === "Instructor" ? "IN" : "ML");

  useEffect(() => {
    if (!mobileMenuOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") setMobileMenuOpen(false);
    };

    const handlePointerDown = (event) => {
      if (!mobileMenuRef.current?.contains(event.target)) {
        setMobileMenuOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("mousedown", handlePointerDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("mousedown", handlePointerDown);
    };
  }, [mobileMenuOpen]);

  const handleMobileNavigate = (path) => {
    setMobileMenuOpen(false);
    onNavigate?.(path);
  };

  const handleMobileLogout = () => {
    setMobileMenuOpen(false);
    onLogout?.();
  };

  const toggleMobileGroup = (groupId) => {
    if (groupId === activeMobileGroupId) return;
    setMobileClosedGroups((current) => ({ ...current, [groupId]: !current[groupId] }));
  };

  return (
    <header className="topbar">
      <div className="topbar-heading">
        <div className="topbar-brand-mobile">
          <Brand />
        </div>
        <div>
          {detailTitle ? (
            <>
              <button className="back-label">{t("header.coursesCourseDetail")}</button>
              <h1>{detailTitle}</h1>
            </>
          ) : (
            <>
              <span className="eyebrow">
                {role === "Admin" ? t("common.adminArea") : role === "Instructor" ? t("common.instructorArea") : t("common.studentArea")}
              </span>
              <h1>{title}</h1>
            </>
          )}
        </div>
      </div>

      <div className="topbar-actions">
        <LanguageDropdown />
        <NotificationCenter profile={profile} role={role} onNavigate={onNavigate} />
        <div className="profile">
          {profile?.profilePictureUrl || profile?.profile_picture_url ? <img className="avatar avatar-image" src={profile.profilePictureUrl || profile.profile_picture_url} alt={profileName} /> : <div className="avatar">{initials}</div>}
          <div><strong>{profileName}</strong><small>{translateRole(role)}</small></div>
        </div>
      </div>

      <div className="mobile-nav-wrap" ref={mobileMenuRef}>
        <button
          type="button"
          className="mobile-menu-toggle"
          aria-label={mobileMenuOpen ? t("header.closeNavigationMenu") : t("header.openNavigationMenu")}
          aria-expanded={mobileMenuOpen}
          onClick={() => setMobileMenuOpen((current) => !current)}
        >
          <Icon name={mobileMenuOpen ? "close" : "menu"} size={20} />
        </button>

        {mobileMenuOpen ? (
          <div className="mobile-nav-panel" role="navigation" aria-label={`${translateRole(role)} navigation`}>
            <div className="mobile-nav-head">
              <div className="profile">
                {profile?.profilePictureUrl || profile?.profile_picture_url ? <img className="avatar avatar-image" src={profile.profilePictureUrl || profile.profile_picture_url} alt={profileName} /> : <div className="avatar">{initials}</div>}
                <div><strong>{profileName}</strong><small>{translateRole(role)}</small></div>
              </div>
              <div className="mobile-nav-actions">
                <LanguageDropdown />
                <NotificationCenter profile={profile} role={role} onNavigate={onNavigate} />
              </div>
            </div>

            <nav className="mobile-nav-list" aria-label={`${translateRole(role)} navigation`}>
              {navItems.map((item) => (
                isNavGroup(item) ? (
                  (() => {
                    const groupActive = isNavItemActive(item, currentPath);
                    const groupOpen = groupActive || !mobileClosedGroups[item.id];
                    const panelId = `mobile-nav-group-${item.id}`;

                    return (
                      <div key={item.id} className={`mobile-nav-group ${groupActive ? "active" : ""}`}>
                        <button
                          type="button"
                          className="mobile-nav-group-label"
                          aria-expanded={groupOpen}
                          aria-controls={panelId}
                          onClick={() => toggleMobileGroup(item.id)}
                        >
                          <Icon name={item.icon} />
                          <span>{item.label}</span>
                          <span className={`nav-group-chevron ${groupOpen ? "open" : ""}`}><Icon name="chevron" size={16} /></span>
                        </button>
                        {groupOpen ? (
                          <div id={panelId} className="mobile-nav-group-children">
                            {item.children.map((child) => (
                              <button
                                key={child.path}
                                className={`nav-item nav-child-item ${currentPath === child.path ? "active" : ""}`}
                                aria-current={currentPath === child.path ? "page" : undefined}
                                onClick={() => handleMobileNavigate(child.path)}
                              >
                                <Icon name={child.icon} />
                                {child.label}
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    );
                  })()
                ) : (
                  <button
                    key={item.path}
                    className={`nav-item ${currentPath === item.path ? "active" : ""}`}
                    aria-current={currentPath === item.path ? "page" : undefined}
                    onClick={() => handleMobileNavigate(item.path)}
                  >
                    <Icon name={item.icon} />
                    {item.label}
                  </button>
                )
              ))}
            </nav>

            <button className="logout mobile-logout" onClick={handleMobileLogout}>
              <Icon name="logout" />
              {t("common.signOut")}
            </button>
          </div>
        ) : null}
      </div>
    </header>
  );
}

export function Sidebar({ role, navItems, currentPath, onNavigate, onLogout }) {
  const { t, translateRole } = useLanguage();
  const activeGroupId = navItems.find((item) => isNavGroup(item) && isNavItemActive(item, currentPath))?.id ?? "";
  const [closedGroups, setClosedGroups] = useState({});

  const toggleGroup = (groupId) => {
    if (groupId === activeGroupId) return;
    setClosedGroups((current) => ({ ...current, [groupId]: !current[groupId] }));
  };

  return (
    <aside className="sidebar">
      <Brand />
      <div className="role-pill"><span className="role-dot" />{t("common.roleArea", { role: translateRole(role) })}</div>
      <nav aria-label={`${translateRole(role)} navigation`}>
        {navItems.map((item) => {
          if (!isNavGroup(item)) {
            return (
              <button key={item.path} className={`nav-item ${currentPath === item.path ? "active" : ""}`} onClick={() => onNavigate(item.path)}>
                <Icon name={item.icon} />{item.label}
              </button>
            );
          }

          const groupActive = isNavItemActive(item, currentPath);
          const groupOpen = groupActive || !closedGroups[item.id];
          const panelId = `sidebar-group-${item.id}`;

          return (
            <div key={item.id} className={`nav-group ${groupActive ? "active" : ""}`}>
              <button
                type="button"
                className={`nav-group-toggle ${groupActive ? "active" : ""}`}
                aria-expanded={groupOpen}
                aria-controls={panelId}
                onClick={() => toggleGroup(item.id)}
              >
                <Icon name={item.icon} />
                <span>{item.label}</span>
                <span className={`nav-group-chevron ${groupOpen ? "open" : ""}`}><Icon name="chevron" size={16} /></span>
              </button>
              {groupOpen ? (
                <div id={panelId} className="nav-group-children">
                  {item.children.map((child) => (
                    <button
                      key={child.path}
                      className={`nav-item nav-child-item ${currentPath === child.path ? "active" : ""}`}
                      onClick={() => onNavigate(child.path)}
                    >
                      <Icon name={child.icon} />{child.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </nav>
      <button className="logout" onClick={onLogout}><Icon name="logout" />{t("common.signOut")}</button>
    </aside>
  );
}

export function CertificateModal({ certificate, onClose }) {
  const { t } = useLanguage();
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="certificate-modal modern-certificate-modal" onMouseDown={(event) => event.stopPropagation()}><button className="modal-close print-hidden" onClick={onClose}>×</button><div className="certificate-print-card"><img className="certificate-logo" src={BRAND_LOGO_SRC} alt={t("certificateModal.logoAlt")} /><span className="eyebrow">NUTRIPRO</span><h2>{t("student.certificateOfCompletion")}</h2><p>{t("certificateModal.certifiesThat")}</p><h3>{certificate.student}</h3><p>{t("certificateModal.successfullyCompleted")}</p><h4>{certificate.course}</h4><div className="certificate-meta"><span><strong>{t("admin.issueDate")}:</strong> {certificate.issueDate}</span><span><strong>{t("admin.certificateNumber")}:</strong> {certificate.number}</span></div><p className="certificate-footer">{t("certificateModal.footer")}</p></div><div className="form-actions compact certificate-print-actions print-hidden"><button type="button" className="secondary-btn" onClick={() => window.print()}>{t("certificateModal.print")}</button></div></div></div>;
}
