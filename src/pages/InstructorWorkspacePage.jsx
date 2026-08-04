import React from "react";
import { CommunityBoard } from "../components/CommunityBoard.jsx";
import { PrivateMessagesPage } from "../components/PrivateMessagesPage.jsx";
import { Icon, Welcome } from "../components/ui.jsx";
import { useLanguage } from "../i18n/LanguageContext.jsx";
import { ROUTES } from "../routes/appRoutes.js";

function navigateTo(pathname) {
  window.history.pushState({}, "", pathname);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

function InstructorPlaceholderPage({ title, text, icon = "courses" }) {
  return (
    <section className="section-card">
      <div className="section-heading">
        <div>
          <span className="eyebrow">{title}</span>
          <h2>{title}</h2>
          <p>{text}</p>
        </div>
        <span className="dashboard-summary-icon"><Icon name={icon} /></span>
      </div>
    </section>
  );
}

function InstructorDashboard() {
  const { t } = useLanguage();
  const cards = [
    {
      title: t("common.myCourses"),
      text: t("instructor.assignedCoursesPlaceholder"),
      icon: "courses",
      path: ROUTES.instructor.courses,
    },
    {
      title: t("common.assignmentReviews"),
      text: t("instructor.assignmentReviewsPlaceholder"),
      icon: "certificate",
      path: ROUTES.instructor.assignmentReviews,
    },
    {
      title: t("common.messages"),
      text: t("instructor.messagesPlaceholder"),
      icon: "community",
      path: ROUTES.instructor.messages,
    },
    {
      title: t("common.studentProgress"),
      text: t("instructor.studentProgressPlaceholder"),
      icon: "dashboard",
      path: ROUTES.instructor.studentProgress,
    },
  ];

  return (
    <>
      <Welcome title={t("instructor.dashboardTitle")} text={t("instructor.dashboardText")} />
      <section className="section-card dashboard-quick-actions">
        <div className="section-heading">
          <div>
            <span className="eyebrow">{t("common.teaching")}</span>
            <h2>{t("instructor.safeModeTitle")}</h2>
            <p>{t("instructor.safeModeText")}</p>
          </div>
        </div>
        <div className="overview-grid">
          {cards.map((card) => (
            <button key={card.path} type="button" className="overview-card dashboard-action-card" onClick={() => navigateTo(card.path)}>
              <span><Icon name={card.icon} /></span>
              <h3>{card.title}</h3>
              <p>{card.text}</p>
            </button>
          ))}
        </div>
      </section>
    </>
  );
}

export function InstructorWorkspacePage({
  pathname,
  currentUser,
  posts,
  onCreatePost,
  onCreateComment,
  onUpdatePost,
  onUpdateComment,
}) {
  const { t } = useLanguage();

  if (pathname === ROUTES.instructor.messages) {
    return <PrivateMessagesPage currentUser={currentUser} />;
  }

  if (pathname === ROUTES.instructor.community) {
    return (
      <CommunityBoard
        posts={posts}
        currentUser={currentUser}
        courses={[]}
        onCreatePost={onCreatePost}
        onCreateComment={onCreateComment}
        onUpdatePost={onUpdatePost}
        onUpdateComment={onUpdateComment}
      />
    );
  }

  if (pathname === ROUTES.instructor.courses) {
    return <InstructorPlaceholderPage title={t("common.myCourses")} text={t("instructor.assignedCoursesPlaceholder")} icon="courses" />;
  }

  if (pathname === ROUTES.instructor.assignmentReviews) {
    return <InstructorPlaceholderPage title={t("common.assignmentReviews")} text={t("instructor.assignmentReviewsPlaceholder")} icon="certificate" />;
  }

  if (pathname === ROUTES.instructor.studentProgress) {
    return <InstructorPlaceholderPage title={t("common.studentProgress")} text={t("instructor.studentProgressPlaceholder")} icon="dashboard" />;
  }

  if (pathname === ROUTES.instructor.profile) {
    return <InstructorPlaceholderPage title={t("common.profile")} text={t("instructor.profilePlaceholder")} icon="users" />;
  }

  if (pathname === ROUTES.instructor.settings) {
    return <InstructorPlaceholderPage title={t("common.settings")} text={t("instructor.settingsPlaceholder")} icon="dashboard" />;
  }

  return <InstructorDashboard />;
}
