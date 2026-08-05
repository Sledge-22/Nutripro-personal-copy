import React, { useEffect, useMemo, useState } from "react";
import { AnnouncementAlertList, CertificateModal, Icon, Progress, Status, Welcome } from "../components/ui.jsx";
import { CommunityBoard } from "../components/CommunityBoard.jsx";
import { PrivateMessagesPage } from "../components/PrivateMessagesPage.jsx";
import CountryFlag from "../components/CountryFlag.jsx";
import CountrySelect from "../components/CountrySelect.jsx";
import { ROUTES } from "../routes/appRoutes.js";
import { getStudentSubmission, submitAssignment } from "../services/assignmentService.js";
import { changePassword } from "../services/authService.js";
import { getStudentCourseAccess } from "../services/courseService.js";
import { getNotifications } from "../services/notificationService.js";
import { getStudentLessonNote, saveStudentLessonNote } from "../services/studentLessonNoteService.js";
import { uploadAssignmentFile, uploadProfilePicture } from "../services/storageService.js";
import { normalizeCountrySelection } from "../data/countries.js";
import { getProfileCountryOptions } from "../data/profileCountries.js";
import { useLanguage } from "../i18n/LanguageContext.jsx";
import { buildUserFacingError, extractErrorDetails } from "../utils/errorDisplay.js";
import {
  getEmbeddablePdfUrl,
  isDirectPdfUrl,
  isGoogleDriveUrl,
  normalizeVideoSource,
} from "../utils/mediaLinks.js";
import { getLessonCompletionState, getLessonRequirements, getSequentialLessonStates } from "../utils/sequentialLessonProgress.js";

function goTo(pathname) {
  window.history.pushState({}, "", pathname);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

function compareLessonOrder(left, right) {
  const leftOrder = Number(left?.sort_order ?? left?.sortOrder ?? 0);
  const rightOrder = Number(right?.sort_order ?? right?.sortOrder ?? 0);
  if (leftOrder !== rightOrder) return leftOrder - rightOrder;

  const leftCreatedAt = Date.parse(left?.created_at ?? left?.createdAt ?? "");
  const rightCreatedAt = Date.parse(right?.created_at ?? right?.createdAt ?? "");
  if (Number.isFinite(leftCreatedAt) && Number.isFinite(rightCreatedAt) && leftCreatedAt !== rightCreatedAt) {
    return leftCreatedAt - rightCreatedAt;
  }

  return String(left?.id ?? "").localeCompare(String(right?.id ?? ""), undefined, { numeric: true });
}

function getCourseModules(course) {
  const archivedClassIds = new Set(
    (Array.isArray(course?.classes) ? course.classes : [])
      .filter((courseClass) => courseClass?.status === "archived")
      .map((courseClass) => String(courseClass.id)),
  );
  return (Array.isArray(course?.modules) ? course.modules : [])
    .filter(
      (module) => {
        const moduleStatus = `${module?.status ?? ""}`.trim().toLowerCase();
        return (
          (!moduleStatus || moduleStatus === "published") &&
          !archivedClassIds.has(String(module?.class_id ?? module?.classId ?? ""))
        );
      },
    )
    .sort(compareLessonOrder);
}

function getCourseClasses(course) {
  const classes = (Array.isArray(course?.classes) ? course.classes : []).filter(
    (courseClass) => courseClass?.status !== "archived",
  );
  const modules = getCourseModules(course);

  if (classes.length) {
    return [...classes]
      .sort(
        (left, right) =>
          Number(left?.sort_order ?? left?.sortOrder ?? 0) -
          Number(right?.sort_order ?? right?.sortOrder ?? 0),
      )
      .map((courseClass) => ({
        ...courseClass,
        modules: modules
          .filter(
            (module) =>
              String(module?.class_id ?? module?.classId ?? "") === String(courseClass.id),
          )
          .sort(compareLessonOrder),
      }));
  }
  if (!modules.length) return [];

  return [
    {
      id: `general-${course?.id || "course"}`,
      title: "General",
      description: "",
      sortOrder: 1,
      modules,
      isFallback: true,
    },
  ];
}

function firstFilledValue(...values) {
  return values.find((value) => `${value ?? ""}`.trim()) || "";
}

function getLocalizedAssignmentCopy(assignment, language = "es") {
  if (!assignment) return { title: "", instructions: "" };

  const spanishTitle = firstFilledValue(assignment.titleEs, assignment.title_es);
  const englishTitle = firstFilledValue(assignment.titleEn, assignment.title_en);
  const spanishInstructions = firstFilledValue(assignment.instructionsEs, assignment.instructions_es);
  const englishInstructions = firstFilledValue(assignment.instructionsEn, assignment.instructions_en);

  return {
    title:
      language === "es"
        ? firstFilledValue(spanishTitle, englishTitle, assignment.title)
        : firstFilledValue(englishTitle, spanishTitle, assignment.title),
    instructions:
      language === "es"
        ? firstFilledValue(spanishInstructions, englishInstructions, assignment.instructions)
        : firstFilledValue(englishInstructions, spanishInstructions, assignment.instructions),
  };
}

function getUploadedPdfSource(module) {
  if (module?.pdf_source === "external" || module?.pdfSource === "external") return "";

  return firstFilledValue(
    module?.pdf_url,
    module?.pdfUrl,
    module?.pdf_public_url,
    module?.pdfPublicUrl,
    module?.pdf_file_url,
    module?.pdfFileUrl,
  );
}

function getExternalPdfSource(module) {
  return firstFilledValue(
    module?.pdf_external_url,
    module?.pdfExternalUrl,
    module?.external_pdf_url,
    module?.externalPdfUrl,
    module?.pdfLink,
    module?.pdf_link,
    (module?.pdf_source === "external" || module?.pdfSource === "external")
      ? firstFilledValue(module?.pdf_url, module?.pdfUrl)
      : "",
  );
}

function getUploadedVideoSource(module) {
  if (module?.video_source === "external" || module?.videoSource === "external") return "";

  return firstFilledValue(
    module?.video_url,
    module?.videoUrl,
    module?.video_public_url,
    module?.videoPublicUrl,
    module?.video_file_url,
    module?.videoFileUrl,
    module?.video?.url,
  );
}

function getExternalVideoSource(module) {
  return firstFilledValue(
    module?.embed_url,
    module?.embedUrl,
    module?.video_external_url,
    module?.videoExternalUrl,
    module?.external_video_url,
    module?.externalVideoUrl,
    module?.video_embed_url,
    module?.videoEmbedUrl,
    module?.videoLink,
    module?.video_link,
    module?.video?.link,
    (module?.video_source === "external" || module?.videoSource === "external")
      ? firstFilledValue(module?.video_url, module?.videoUrl, module?.video?.link)
      : "",
  );
}

function getCompletionBlockerMessage({ t, pdfRequired, videoRequired, assignmentRequired, assignmentSubmitted }) {
  if (assignmentRequired && assignmentSubmitted) {
    return t("common.assignmentApprovalRequiredBeforeComplete");
  }

  if (pdfRequired && videoRequired && assignmentRequired) {
    return t("common.completeExistingRequirementsBeforeComplete");
  }

  if (pdfRequired && videoRequired) {
    return t("common.completePdfVideoBeforeComplete");
  }

  if (pdfRequired && assignmentRequired) {
    return t("common.completePdfAssignmentBeforeComplete");
  }

  if (videoRequired && assignmentRequired) {
    return t("common.completeVideoAssignmentBeforeComplete");
  }

  if (pdfRequired) {
    return t("common.openPdfBeforeComplete");
  }

  if (videoRequired) {
    return t("common.watchVideoBeforeComplete");
  }

  if (assignmentRequired) {
    return t("common.submitAssignmentBeforeComplete");
  }

  return "";
}

function getNextModule(currentModuleId, orderedModules = []) {
  const safeModules = Array.isArray(orderedModules) ? orderedModules : [];
  const currentIndex = safeModules.findIndex((module) => String(module?.id) === String(currentModuleId));
  if (currentIndex < 0) return { currentIndex, nextModule: null };

  const nextModule = safeModules[currentIndex + 1] ?? null;
  return {
    currentIndex,
    nextModule: nextModule && String(nextModule.id) !== String(currentModuleId) ? nextModule : null,
  };
}

function buildProgressSaveErrorMessage(error, fallbackMessage, setupMessage = "") {
  const details = extractErrorDetails(error);
  const normalizedDetails = details.toLowerCase();
  const setupRequired =
    normalizedDetails.includes("pgrst204") ||
    normalizedDetails.includes("schema cache") ||
    normalizedDetails.includes("could not find") ||
    normalizedDetails.includes("does not exist");

  const message = setupRequired && setupMessage ? `${fallbackMessage} ${setupMessage}` : fallbackMessage;
  return details ? `${message} ${details}` : message;
}

function StudentCourseState({ eyebrow, title, text }) {
  return (
    <section className="section-card">
      <span className="eyebrow">{eyebrow}</span>
      <h2>{title}</h2>
      <p>{text}</p>
    </section>
  );
}

function formatDisplayDate(value, language = "es") {
  if (!value) return "—";

  try {
    return new Date(value).toLocaleDateString(language === "es" ? "es-ES" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return value;
  }
}

function formatSavedTime(value, language = "es") {
  if (!value) return "";

  try {
    return new Date(value).toLocaleString(language === "es" ? "es-ES" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
}

function initialsFromName(name) {
  return (name || "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "ML";
}

function CourseCover({ course, index }) {
  if (course?.image_url || course?.imageUrl) {
    return <div className={`course-cover cover-${index + 1}`}><img className="course-cover-image" src={course.image_url || course.imageUrl} alt={course.title} /></div>;
  }

  return (
    <div className={`course-cover cover-${index + 1}`}>
      <span>{String(index + 1).padStart(2, "0")}</span>
      <Icon name="courses" size={34} />
    </div>
  );
}

export function StudentWorkspacePage({
  pathname,
  studentId,
  studentProfile,
  courses,
  certificates,
  posts,
  progressState,
  studentCoursesError = "",
  studentCourseDetailsWarning = "",
  previewMode = false,
  previewReturnPath = ROUTES.admin.postCourses,
  onCreatePost,
  onCreateComment,
  onUpdatePost,
  onUpdateComment,
  onUpdateProfile,
  onUpdateProgress,
}) {
  const { t } = useLanguage();
  const ownedCourses = Array.isArray(courses) ? courses : [];
  const studentCertificates = certificates.filter((certificate) => certificate.studentId === studentId);
  const [previewCertificate, setPreviewCertificate] = useState(null);
  const [detailState, setDetailState] = useState({
    loading: false,
    reason: null,
    course: null,
    enrollment: null,
    courseStatus: null,
  });
  const isPreviewCourseRoute = previewMode && pathname.startsWith("/admin/student-preview/");
  const isCourseDetailRoute = pathname.startsWith("/student/courses/") || isPreviewCourseRoute;
  const routeCourseId = isCourseDetailRoute ? `${pathname.split("/").pop() ?? ""}`.trim() : "";

  const progressFor = (course) => {
    const summary = getSequentialLessonStates({
      classes: getCourseClasses(course),
      modules: getCourseModules(course),
      progress: progressState,
    });
    return summary.totalCount
      ? Math.round((summary.completedCount / summary.totalCount) * 100)
      : 0;
  };

  const lessonSummaryFor = (course) =>
    getSequentialLessonStates({
      classes: getCourseClasses(course),
      modules: getCourseModules(course),
      progress: progressState,
    });

  useEffect(() => {
    if (!isCourseDetailRoute) return undefined;

    console.log(
      "studentCourses list with ids:",
      ownedCourses.map((course) => ({ id: course?.id, title: course?.title, status: course?.status })),
    );
    console.log("selected course id on detail page:", routeCourseId || "(missing)");

    let cancelled = false;

    const loadCourseDetail = async () => {
      if (!routeCourseId) {
        if (!cancelled) {
          setDetailState({
            loading: false,
            reason: "missing-id",
            course: null,
            enrollment: null,
            courseStatus: null,
          });
        }
        return;
      }

      const localCourse = ownedCourses.find((entry) => String(entry?.id) === routeCourseId) ?? null;

      if (previewMode) {
        if (!cancelled) {
          setDetailState({
            loading: false,
            reason: localCourse ? null : "load-error",
            course: localCourse,
            enrollment: localCourse ? { course_id: localCourse.id, preview: true } : null,
            courseStatus: localCourse?.status ?? null,
          });
        }
        return;
      }

      if (!cancelled) {
        setDetailState({
          loading: true,
          reason: null,
          course: localCourse,
          enrollment: null,
          courseStatus: localCourse?.status ?? null,
        });
      }

      try {
        const result = await getStudentCourseAccess(studentId, routeCourseId);

        if (!cancelled) {
          setDetailState({
            loading: false,
            reason: result.reason,
            course: result.course ?? localCourse,
            enrollment: result.enrollment ?? null,
            courseStatus: result.courseStatus ?? result.course?.status ?? localCourse?.status ?? null,
          });
        }
      } catch (error) {
        console.error("Failed to load the selected student course detail:", error);

        if (!cancelled) {
          setDetailState({
            loading: false,
            reason: "load-error",
            course: localCourse,
            enrollment: null,
            courseStatus: localCourse?.status ?? null,
          });
        }
      }
    };

    void loadCourseDetail();

    return () => {
      cancelled = true;
    };
  }, [isCourseDetailRoute, ownedCourses, previewMode, routeCourseId, studentId]);

  if (isCourseDetailRoute) {
    const selectedCourse = detailState.course ?? ownedCourses.find((entry) => String(entry?.id) === routeCourseId) ?? null;

    if (detailState.loading && !selectedCourse) {
      return <StudentCourseState eyebrow={t("student.courseDetail")} title={t("student.loadingCourse")} text={t("student.checkingEnrollment")} />;
    }

    return (
      <>
        {previewMode ? <StudentPreviewBanner returnPath={previewReturnPath} /> : null}
        {detailState.reason === "missing-id" ? (
          <StudentCourseState eyebrow={t("student.courseDetail")} title={t("student.courseIdMissing")} text={t("student.courseLinkMissingId")} />
        ) : detailState.reason === "missing-enrollment" ? (
          <StudentCourseState eyebrow={t("student.courseDetail")} title={t("student.courseNotAssigned")} text={t("student.notEnrolledExactCourse")} />
        ) : detailState.reason === "not-published" ? (
          <StudentCourseState eyebrow={t("student.courseDetail")} title={t("student.courseNotPublished")} text={t("student.hiddenFromWorkspace")} />
        ) : detailState.reason === "missing-student" ? (
          <StudentCourseState eyebrow={t("student.courseDetail")} title={t("student.studentAccountMissing")} text={t("student.demoStudentMissing")} />
        ) : detailState.reason === "load-error" && !selectedCourse ? (
          <StudentCourseState eyebrow={t("student.courseDetail")} title={t("student.courseDetailFailed")} text={t("student.selectedCourseCouldNotLoad")} />
        ) : selectedCourse ? (
          <StudentModuleDetail
            course={selectedCourse}
            studentId={studentId}
            completed={progressState}
            onUpdateProgress={onUpdateProgress}
            progress={progressFor(selectedCourse)}
            previewMode={previewMode}
            previewReturnPath={previewReturnPath}
          />
        ) : (
          <StudentCourseState eyebrow={t("student.courseDetail")} title={t("student.courseDetailFailed")} text={t("student.selectedCourseRecordMissing")} />
        )}
      </>
    );
  }

  if (pathname === ROUTES.student.profile) {
    return <StudentProfilePage profile={studentProfile} onUpdateProfile={onUpdateProfile} />;
  }

  if (pathname === ROUTES.student.certificates) {
    return (
      <>
        {previewCertificate && <CertificateModal certificate={previewCertificate} onClose={() => setPreviewCertificate(null)} />}
        <StudentCertificatesPage
          certificates={studentCertificates}
          courses={ownedCourses}
          studentId={studentId}
          onPreview={setPreviewCertificate}
        />
      </>
    );
  }

  if (pathname === ROUTES.student.community) {
    return (
      <CommunityBoard
        posts={posts}
        currentUser={studentProfile}
        courses={ownedCourses}
        onCreatePost={onCreatePost}
        onCreateComment={onCreateComment}
        onUpdatePost={onUpdatePost}
        onUpdateComment={onUpdateComment}
      />
    );
  }

  if (pathname === ROUTES.student.messages) {
    return <PrivateMessagesPage currentUser={studentProfile} />;
  }

  if (pathname === ROUTES.student.courses) {
    return <OwnedCoursesPage courses={ownedCourses} progressFor={progressFor} lessonSummaryFor={lessonSummaryFor} studentCoursesError={studentCoursesError} studentCourseDetailsWarning={studentCourseDetailsWarning} />;
  }

  return <StudentDashboardPage courses={ownedCourses} certificates={studentCertificates} progressFor={progressFor} lessonSummaryFor={lessonSummaryFor} studentProfile={studentProfile} studentId={studentId} studentCoursesError={studentCoursesError} studentCourseDetailsWarning={studentCourseDetailsWarning} />;
}

function StudentPreviewBanner({ returnPath }) {
  const { t } = useLanguage();

  return (
    <section className="preview-mode-banner" aria-label={t("admin.previewModeViewingAsStudent")}>
      <div>
        <span className="eyebrow">{t("admin.previewMode")}</span>
        <strong>{t("admin.previewModeViewingAsStudent")}</strong>
        <p>{t("admin.previewModeSafeDescription")}</p>
      </div>
      <button type="button" className="secondary-btn" onClick={() => goTo(returnPath || ROUTES.admin.postCourses)}>
        {t("admin.exitPreview")}
      </button>
    </section>
  );
}

function StudentDashboardPage({ courses, certificates, progressFor, lessonSummaryFor, studentProfile, studentId, studentCoursesError = "", studentCourseDetailsWarning = "" }) {
  const { t } = useLanguage();
  const [dashboardData, setDashboardData] = useState({
    submissions: [],
    notifications: [],
  });
  const average = courses.length
    ? Math.round(courses.reduce((sum, course) => sum + progressFor(course), 0) / courses.length)
    : 0;
  const courseSummaries = courses.map((course) => ({
    course,
    progress: progressFor(course),
    summary: lessonSummaryFor(course),
  }));
  const nextLearningItem = courseSummaries.find((entry) => entry.summary.nextLesson) ?? courseSummaries[0] ?? null;
  const assignmentModules = courses.flatMap((course) =>
    getCourseModules(course)
      .filter((module) => module?.assignment?.id || module?.requiresAssignment || module?.requires_assignment)
      .map((module) => ({ course, module, assignment: module.assignment })),
  );
  const submittedAssignmentIds = new Set(
    dashboardData.submissions
      .filter((submission) => submission?.assignmentId || submission?.assignment_id)
      .map((submission) => String(submission.assignmentId ?? submission.assignment_id)),
  );
  const pendingAssignments = assignmentModules.filter((entry) =>
    entry.assignment?.id ? !submittedAssignmentIds.has(String(entry.assignment.id)) : true,
  );
  const unreadNotifications = dashboardData.notifications.filter((notification) => !notification.readAt);
  const unreadMessages = unreadNotifications.filter((notification) =>
    ["new_private_message", "new_message_request"].includes(notification.type),
  );

  useEffect(() => {
    let mounted = true;

    async function loadStudentDashboardData() {
      const assignments = assignmentModules.filter((entry) => entry.assignment?.id);
      const [submissionsResult, notificationsResult] = await Promise.allSettled([
        Promise.all(assignments.map((entry) => getStudentSubmission(entry.assignment.id, studentId))),
        getNotifications(studentProfile),
      ]);

      if (!mounted) return;

      if (submissionsResult.status === "rejected") console.error("Loading student dashboard submissions failed:", submissionsResult.reason);
      if (notificationsResult.status === "rejected") console.error("Loading student dashboard notifications failed:", notificationsResult.reason);

      setDashboardData({
        submissions: submissionsResult.status === "fulfilled" ? submissionsResult.value.filter(Boolean) : [],
        notifications: notificationsResult.status === "fulfilled" ? notificationsResult.value : [],
      });
    }

    void loadStudentDashboardData();

    return () => {
      mounted = false;
    };
  }, [courses, studentId, studentProfile?.id]);

  const summaryCards = [
    {
      icon: "certificate",
      title: t("dashboard.pendingAssignments"),
      value: pendingAssignments.length,
      text: t("dashboard.pendingAssignmentsText"),
      path: ROUTES.student.courses,
      visible: pendingAssignments.length > 0,
    },
    {
      icon: "community",
      title: t("dashboard.unreadMessages"),
      value: unreadMessages.length,
      text: t("dashboard.unreadMessagesText"),
      path: ROUTES.student.messages,
      visible: unreadMessages.length > 0,
    },
    {
      icon: "dashboard",
      title: t("dashboard.overallProgress"),
      value: `${average}%`,
      text: t("dashboard.overallProgressText"),
      path: ROUTES.student.courses,
      visible: courses.length > 0,
    },
  ].filter((card) => card.visible);

  return (
    <>
      <Welcome title={t("dashboard.studentWelcomeTitle")} text={t("dashboard.studentWelcomeText")} />
      <AnnouncementAlertList notifications={dashboardData.notifications} onNavigate={goTo} />
      {studentCoursesError ? <small className="field-note danger-text">{studentCoursesError}</small> : null}
      {!studentCoursesError && studentCourseDetailsWarning ? <small className="field-note">{studentCourseDetailsWarning}</small> : null}
      <section className="section-card dashboard-primary-action">
        <div className="section-heading">
          <div>
            <span className="eyebrow">{t("dashboard.continueLearning")}</span>
            <h2>{nextLearningItem?.summary?.nextLesson?.title || t("dashboard.noNextLesson")}</h2>
            <p>{nextLearningItem?.course?.title || t("dashboard.noUrgentStudentText")}</p>
          </div>
          {nextLearningItem?.course?.id ? (
            <button type="button" className="primary-btn" onClick={() => goTo(ROUTES.student.courseDetail(nextLearningItem.course.id))}>
              {t("dashboard.continueCourse")} <Icon name="arrow" />
            </button>
          ) : null}
        </div>
        {nextLearningItem ? (
          <div className="dashboard-next-lesson-card">
            <div className="course-index">01</div>
            <div>
              <strong>{nextLearningItem.course.title}</strong>
              <span>
                {nextLearningItem.summary.courseComplete
                  ? t("common.courseComplete")
                  : nextLearningItem.summary.nextLesson
                    ? t("common.nextLessonLabel", { title: nextLearningItem.summary.nextLesson.title })
                    : t("common.noCourseYet")}
              </span>
            </div>
            <Progress value={nextLearningItem.progress} />
          </div>
        ) : (
          <div className="dashboard-empty-state compact">
            <span className="dashboard-summary-icon"><Icon name="check" /></span>
            <div>
              <strong>{t("dashboard.allCaughtUp")}</strong>
              <p>{t("dashboard.noUrgentStudentText")}</p>
            </div>
          </div>
        )}
      </section>
      {summaryCards.length ? (
        <div className="dashboard-overview-grid compact-dashboard-grid">
          {summaryCards.map((card) => (
            <button key={card.title} type="button" className="dashboard-summary-card" onClick={() => goTo(card.path)}>
              <span className="dashboard-summary-icon"><Icon name={card.icon} /></span>
              <span>
                <small>{card.title}</small>
                <strong>{card.value}</strong>
                <em>{card.text}</em>
              </span>
            </button>
          ))}
        </div>
      ) : (
        <section className="section-card dashboard-empty-state">
          <span className="dashboard-summary-icon"><Icon name="check" /></span>
          <div>
            <span className="eyebrow">{t("dashboard.allCaughtUp")}</span>
            <h2>{t("dashboard.noUrgentItems")}</h2>
            <p>{t("dashboard.noUrgentStudentText")}</p>
          </div>
        </section>
      )}
      {pendingAssignments.length ? (
        <section className="section-card dashboard-feed-card">
          <span className="eyebrow">{t("dashboard.upcomingAssignments")}</span>
          <h2>{t("dashboard.pendingAssignments")}</h2>
          <div className="dashboard-feed-list">
            {pendingAssignments.slice(0, 3).map((entry) => (
              <article key={`${entry.course.id}-${entry.module.id}`}>
                <strong>{entry.assignment?.title || entry.module.title || t("common.assignment")}</strong>
                <span>{entry.course.title}</span>
                <small>{entry.module.title}</small>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}

function StudentProfilePage({ profile, onUpdateProfile }) {
  const { t, language } = useLanguage();
  const countryOptions = getProfileCountryOptions();
  const translatedSelectCountry = t("common.selectCountry");
  const selectCountryLabel =
    translatedSelectCountry && translatedSelectCountry !== "common.selectCountry"
      ? translatedSelectCountry
      : language === "es"
        ? "Selecciona tu país"
        : "Select your country";
  const initialCountry = normalizeCountrySelection(
    profile?.countryCode ?? profile?.country_code ?? profile?.countryName ?? profile?.country_name ?? profile?.country,
    language,
  );
  const [form, setForm] = useState({
    name: profile?.name || "",
    email: profile?.email || "",
    countryCode: initialCountry.countryCode || "",
    bio: profile?.bio || "",
    profilePictureUrl: profile?.profilePictureUrl || profile?.profile_picture_url || "",
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ nextPassword: "", confirmPassword: "" });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const passwordStrengthText = t("auth.passwordStrengthRequirement") !== "auth.passwordStrengthRequirement"
    ? t("auth.passwordStrengthRequirement")
    : language === "es"
      ? "La contraseña debe incluir al menos 10 caracteres, letras mayúsculas y minúsculas, un número y un símbolo."
      : "Password must include at least 10 characters, uppercase and lowercase letters, a number, and a symbol.";

  useEffect(() => {
    const nextCountry = normalizeCountrySelection(
      profile?.countryCode ?? profile?.country_code ?? profile?.countryName ?? profile?.country_name ?? profile?.country,
      language,
    );
    setForm({
      name: profile?.name || "",
      email: profile?.email || "",
      countryCode: nextCountry.countryCode || "",
      bio: profile?.bio || "",
      profilePictureUrl: profile?.profilePictureUrl || profile?.profile_picture_url || "",
    });
  }, [profile, language]);

  const saveProfile = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const selectedCountry = normalizeCountrySelection(form.countryCode, language);
      const result = await onUpdateProfile({
        name: form.name,
        country: selectedCountry.country,
        country_code: selectedCountry.countryCode,
        country_name: selectedCountry.countryName,
        country_flag: selectedCountry.countryFlag,
        bio: form.bio,
        profile_picture_url: form.profilePictureUrl,
      });

      if (!result?.ok) throw new Error(result?.error || t("student.savingProfileFailed"));
      setMessage(result?.message || t("student.profileSaved"));
    } catch (saveError) {
      console.error("Saving student profile failed:", saveError);
      setError(buildUserFacingError(saveError, t("student.savingProfileFailed")));
    } finally {
      setSaving(false);
    }
  };

  const handlePictureChange = async (file) => {
    if (!file) return;

    setUploading(true);
    setMessage("");
    setError("");

    try {
      const uploaded = await uploadProfilePicture(file);
      setForm((current) => ({
        ...current,
        profilePictureUrl: uploaded.publicUrl || current.profilePictureUrl,
      }));
      setMessage(t("student.profilePictureReady"));
    } catch (uploadError) {
      console.error("Uploading the student profile picture failed:", uploadError);
      setError(buildUserFacingError(uploadError, t("student.profilePictureUploadFailed")));
    } finally {
      setUploading(false);
    }
  };

  const handlePasswordChange = async (event) => {
    event.preventDefault();
    setPasswordMessage("");
    setPasswordError("");

    const { nextPassword, confirmPassword } = passwordForm;
    if (
      nextPassword.length < 10 ||
      !/[A-Z]/.test(nextPassword) ||
      !/[a-z]/.test(nextPassword) ||
      !/\d/.test(nextPassword) ||
      !/[^A-Za-z0-9]/.test(nextPassword)
    ) {
      setPasswordError(passwordStrengthText);
      return;
    }

    if (nextPassword !== confirmPassword) {
      setPasswordError(t("auth.passwordsDoNotMatch"));
      return;
    }

    setPasswordSaving(true);
    try {
      await changePassword(profile?.id, nextPassword);
      setPasswordForm({ nextPassword: "", confirmPassword: "" });
      setPasswordMessage(t("auth.passwordUpdated"));
    } catch (changeError) {
      console.error("Changing the profile password failed:", changeError);
      setPasswordError(buildUserFacingError(changeError, t("auth.passwordChangeFailed")));
    } finally {
      setPasswordSaving(false);
    }
  };

  const avatarLabel = initialsFromName(form.name || profile?.name || "Maya Laurent");
  const selectedCountry = normalizeCountrySelection(form.countryCode, language);

  return (
    <div className="profile-layout">
      <section className="section-card profile-card">
        <div className="profile-hero">
          {form.profilePictureUrl ? (
            <img className="profile-hero-image" src={form.profilePictureUrl} alt={form.name || profile?.name || "Maya Laurent"} />
          ) : (
            <div className="profile-hero-avatar">{avatarLabel}</div>
          )}
          <div>
            <span className="eyebrow">{t("common.myProfile")}</span>
            <h2>{form.name || profile?.name || "Maya Laurent"}</h2>
            <p>{form.email || profile?.email || ""}</p>
            {selectedCountry.country ? (
              <span className="subtle-badge profile-country-badge country-badge">
                <CountryFlag
                  code={selectedCountry.countryCode}
                  name={selectedCountry.country}
                  fallbackFlag={selectedCountry.countryFlag}
                  className="profile-country-flag"
                />
                <span>{selectedCountry.country}</span>
              </span>
            ) : null}
          </div>
        </div>

        <form onSubmit={saveProfile}>
          <label>
            {t("admin.name")}
            <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
          </label>

          <label>
            {t("admin.email")}
            <input value={form.email} disabled />
          </label>

          <label>
            {t("common.country")}
            <CountrySelect
              value={form.countryCode}
              options={countryOptions}
              placeholder={selectCountryLabel}
              ariaLabel={t("common.country")}
              menuClassName="profile-country-menu"
              onChange={(countryCode) => setForm((current) => ({ ...current, countryCode }))}
            />
          </label>

          <label>
            {t("common.bio")}
            <textarea rows="5" value={form.bio} onChange={(event) => setForm((current) => ({ ...current, bio: event.target.value }))} placeholder={t("student.bioPlaceholder")} />
          </label>

          <label>
            {t("common.changePicture")}
            <input type="file" accept="image/*" onChange={(event) => void handlePictureChange(event.target.files?.[0])} />
          </label>

          {uploading ? <small className="field-note">{t("student.uploadingProfilePicture")}</small> : null}
          {message ? <small className="field-note">{message}</small> : null}
          {error ? <small className="field-note danger-text">{error}</small> : null}

          <div className="form-actions">
            <button className="primary-btn" type="submit" disabled={saving || uploading}>
              <Icon name="check" />
              {saving ? t("common.saving") : t("common.saveChanges")}
            </button>
          </div>
        </form>

        <form onSubmit={handlePasswordChange} className="profile-password-form">
          <div className="profile-password-header">
            <span className="eyebrow">{t("auth.changePassword")}</span>
            <h3>{t("auth.changePassword")}</h3>
          </div>

          <>
            <label>
              {t("auth.newPassword")}
              <input
                type="password"
                value={passwordForm.nextPassword}
                onChange={(event) => setPasswordForm((current) => ({ ...current, nextPassword: event.target.value }))}
                autoComplete="new-password"
              />
            </label>

            <label>
              {t("auth.confirmPassword")}
              <input
                type="password"
                value={passwordForm.confirmPassword}
                onChange={(event) => setPasswordForm((current) => ({ ...current, confirmPassword: event.target.value }))}
                autoComplete="new-password"
              />
            </label>

            <small className="field-note">{passwordStrengthText}</small>
          </>

          {passwordMessage ? <small className="field-note">{passwordMessage}</small> : null}
          {passwordError ? <small className="field-note danger-text">{passwordError}</small> : null}

          <div className="form-actions">
            <button className="secondary-btn" type="submit" disabled={passwordSaving}>
              {passwordSaving ? t("common.saving") : t("auth.changePassword")}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function OwnedCoursesPage({ courses, progressFor, lessonSummaryFor, studentCoursesError = "", studentCourseDetailsWarning = "" }) {
  const { t } = useLanguage();

  return (
    <>
      <div className="page-intro">
        <div>
          <span className="eyebrow">{t("dashboard.myLearning")}</span>
          <h2>{t("dashboard.coursesYouOwn")}</h2>
          <p>{t("dashboard.assignedOnly")}</p>
        </div>
      </div>
      {studentCoursesError ? <small className="field-note danger-text">{studentCoursesError}</small> : null}
      {!studentCoursesError && studentCourseDetailsWarning ? <small className="field-note">{studentCourseDetailsWarning}</small> : null}
      {!studentCoursesError && !courses.length ? (
        <div className="empty-state-card">
          <p>{t("student.noAssignedCourses")}</p>
        </div>
      ) : null}
      <div className="owned-grid">
        {courses.map((course, index) => {
          const progress = progressFor(course);
          const modules = getCourseModules(course);
          const classes = getCourseClasses(course);
          const summary = lessonSummaryFor(course);

          return (
            <article className="owned-card" key={course.id}>
              <CourseCover course={course} index={index} />
              <div className="owned-body">
                <span className="eyebrow">{`${classes.length} ${t("common.classes").toLowerCase()} · ${modules.length} ${t("common.modules").toLowerCase()}`}</span>
                <h3>{course.title}</h3>
                <p>{course.description}</p>
                <div className="progress-label">
                  <span>{t("common.courseProgress")}</span>
                  <strong>{progress}%</strong>
                </div>
                <Progress value={progress} />
                <div className="course-lesson-summary">
                  <strong>{t("common.lessonsCompletedCount", { completed: summary.completedCount, total: summary.totalCount })}</strong>
                  <span>
                    {summary.courseComplete
                      ? t("common.courseComplete")
                      : summary.nextLesson
                        ? t("common.nextLessonLabel", { title: summary.nextLesson.title })
                        : t("common.noCourseYet")}
                  </span>
                </div>
                <button
                  className="primary-btn"
                  onClick={() => {
                    console.log("clicked course id:", course.id);
                    goTo(ROUTES.student.courseDetail(course.id));
                  }}
                >
                  {t("dashboard.continueCourse")} <Icon name="arrow" />
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}

function StudentModuleDetail({ course, studentId, completed, onUpdateProgress, progress, previewMode = false, previewReturnPath = ROUTES.student.courses }) {
  const { t, language, translateSubmissionType } = useLanguage();
  const modules = useMemo(() => getCourseModules(course), [course]);
  const courseClasses = useMemo(() => getCourseClasses(course), [course]);
  const moduleIdsKey = useMemo(() => modules.map((module) => String(module.id)).join("|"), [modules]);
  const [activeModuleId, setActiveModuleId] = useState(modules[0]?.id || null);
  const [viewError, setViewError] = useState("");
  const [blockedLessonId, setBlockedLessonId] = useState("");
  const [courseSubmissions, setCourseSubmissions] = useState(new Map());
  const [courseSubmissionsLoaded, setCourseSubmissionsLoaded] = useState(false);
  const [assignmentState, setAssignmentState] = useState({
    loading: false,
    error: "",
    submission: null,
    selectedFile: null,
    selectedFileName: "",
    submitMessage: "",
    submitError: "",
    uploading: false,
  });
  const [noteState, setNoteState] = useState({
    loading: false,
    saving: false,
    note: "",
    savedNote: "",
    lastSavedAt: "",
    message: "",
    error: "",
  });
  const [localProgressOverrides, setLocalProgressOverrides] = useState({});

  console.log("selected course id on detail page:", course?.id);

  useEffect(() => {
    const requestedLessonId = new URLSearchParams(window.location.search).get("lesson");
    const requestedModule = modules.find((module) => String(module.id) === String(requestedLessonId));
    setActiveModuleId(requestedModule?.id ?? modules[0]?.id ?? null);
    setViewError("");
    setBlockedLessonId("");
    setLocalProgressOverrides({});
  }, [course?.id, moduleIdsKey]);

  const activeModule = modules.find((module) => String(module.id) === String(activeModuleId)) || modules[0] || null;
  const activeModuleCourseId =
    activeModule?.course_id ||
    activeModule?.courseId ||
    activeModule?.course?.id ||
    course?.id ||
    "";
  const effectiveCompleted = useMemo(
    () => ({
      ...(completed ?? {}),
      ...localProgressOverrides,
    }),
    [completed, localProgressOverrides],
  );
  const lessonRequirements = getLessonRequirements(activeModule);
  const assignmentRequired = lessonRequirements.requiresAssignmentSubmission;
  const activeAssignment = assignmentRequired ? activeModule?.assignment ?? null : null;
  const localizedAssignment = getLocalizedAssignmentCopy(activeAssignment, language);
  const sequentialState = getSequentialLessonStates({
    classes: courseClasses,
    modules,
    progress: effectiveCompleted,
    submissions: courseSubmissionsLoaded ? courseSubmissions : null,
  });
  const activeLessonState = activeModule
    ? sequentialState.lessonStates.get(String(activeModule.id))
    : null;
  const { nextModule } = getNextModule(activeModule?.id, sequentialState.orderedLessons);
  const nextLessonState = nextModule ? sequentialState.lessonStates.get(String(nextModule.id)) : null;

  useEffect(() => {
    let cancelled = false;
    const assignments = modules
      .map((module) => module?.assignment)
      .filter((assignment) => assignment?.id);

    setCourseSubmissionsLoaded(false);

    const loadCourseSubmissions = async () => {
      try {
        const rows = previewMode || !studentId
          ? assignments.map((assignment) => [String(assignment.id), null])
          : await Promise.all(
              assignments.map(async (assignment) => [
                String(assignment.id),
                await getStudentSubmission(assignment.id, studentId),
              ]),
            );
        if (!cancelled) {
          setCourseSubmissions(new Map(rows));
          setCourseSubmissionsLoaded(true);
        }
      } catch (error) {
        console.error("Failed to load submissions for sequential lesson access:", error);
        if (!cancelled) {
          setCourseSubmissions(new Map());
          setCourseSubmissionsLoaded(true);
        }
      }
    };

    void loadCourseSubmissions();

    return () => {
      cancelled = true;
    };
  }, [course?.id, previewMode, studentId]);

  useEffect(() => {
    if (!courseSubmissionsLoaded) return;

    const requestedLessonId = new URLSearchParams(window.location.search).get("lesson");
    if (!requestedLessonId) return;

    const requestedState = sequentialState.lessonStates.get(String(requestedLessonId));
    if (!requestedState || requestedState.isLocked) {
      console.warn("Blocked direct access to locked lesson:", {
        courseId: course?.id,
        lessonId: requestedLessonId,
        reason: requestedState?.lockReason ?? "missing-lesson",
      });
      setBlockedLessonId(String(requestedLessonId));
      setActiveModuleId(sequentialState.nextLesson?.id ?? modules[0]?.id ?? null);
      return;
    }

    setBlockedLessonId("");
    setActiveModuleId(requestedState.lesson.id);
  }, [course?.id, courseSubmissionsLoaded]);

  const selectLesson = (module) => {
    const lessonState = sequentialState.lessonStates.get(String(module?.id));
    if (!lessonState?.isUnlocked) {
      setViewError(
        lessonState?.lockReason === "previous-class"
          ? t("common.lessonLockedPreviousClass")
          : t("common.lessonLockedPreviousLesson"),
      );
      return;
    }

    setBlockedLessonId("");
    setActiveModuleId(module.id);
    setViewError("");
    window.history.replaceState(
      {},
      "",
      `${previewMode ? ROUTES.admin.studentPreview(course.id) : ROUTES.student.courseDetail(course.id)}?lesson=${encodeURIComponent(module.id)}`,
    );
  };

  const handleNextLesson = () => {
    const { currentIndex, nextModule: resolvedNextModule } = getNextModule(
      activeModule?.id,
      sequentialState.orderedLessons,
    );
    const resolvedNextState = resolvedNextModule
      ? sequentialState.lessonStates.get(String(resolvedNextModule.id))
      : null;

    console.log("[NextLesson]", {
      currentModuleId: activeModule?.id,
      currentIndex,
      nextModuleId: resolvedNextModule?.id,
      nextModuleTitle: resolvedNextModule?.title,
      orderedModuleIds: sequentialState.orderedLessons.map((module) => module.id),
    });

    if (!resolvedNextModule || String(resolvedNextModule.id) === String(activeModule?.id)) return;

    if (!moduleDone || !resolvedNextState?.isUnlocked) {
      setViewError(t("common.completeThisLessonToUnlockNext"));
      return;
    }

    selectLesson(resolvedNextModule);
  };

  useEffect(() => {
    let cancelled = false;

    const loadSubmission = async () => {
      if (!activeAssignment?.id || !studentId || previewMode) {
        if (!cancelled) {
          setAssignmentState({
            loading: false,
            error: "",
            submission: null,
            selectedFile: null,
            selectedFileName: "",
            submitMessage: "",
            submitError: "",
            uploading: false,
          });
        }
        return;
      }

      if (!cancelled) {
        setAssignmentState({
          loading: true,
          error: "",
          submission: null,
          selectedFile: null,
          selectedFileName: "",
          submitMessage: "",
          submitError: "",
          uploading: false,
        });
      }

      try {
        const submission = await getStudentSubmission(activeAssignment.id, studentId);

        if (!cancelled) {
          setCourseSubmissions((current) => {
            const next = new Map(current);
            next.set(String(activeAssignment.id), submission);
            return next;
          });
          setAssignmentState({
            loading: false,
            error: "",
            submission,
            selectedFile: null,
            selectedFileName: submission?.fileName || "",
            submitMessage: "",
            submitError: "",
            uploading: false,
          });
        }
      } catch (error) {
        console.error("Failed to load the student assignment submission:", error);

        if (!cancelled) {
          setAssignmentState({
            loading: false,
            error: buildUserFacingError(error, t("common.loadingSubmissions")),
            submission: null,
            selectedFile: null,
            selectedFileName: "",
            submitMessage: "",
            submitError: "",
            uploading: false,
          });
        }
      }
    };

    void loadSubmission();

    return () => {
      cancelled = true;
    };
  }, [activeAssignment?.id, previewMode, studentId]);

  useEffect(() => {
    let cancelled = false;

    const loadNote = async () => {
      if (!activeModule?.id || !studentId || previewMode) {
        if (!cancelled) {
          setNoteState({
            loading: false,
            saving: false,
            note: "",
            savedNote: "",
            lastSavedAt: "",
            message: "",
            error: "",
          });
        }
        return;
      }

      if (!cancelled) {
        setNoteState((current) => ({
          ...current,
          loading: true,
          saving: false,
          message: "",
          error: "",
        }));
      }

      try {
        const savedNote = await getStudentLessonNote(studentId, activeModule.id);

        if (!cancelled) {
          setNoteState({
            loading: false,
            saving: false,
            note: savedNote?.note ?? "",
            savedNote: savedNote?.note ?? "",
            lastSavedAt: savedNote?.updatedAt ?? savedNote?.updated_at ?? "",
            message: "",
            error: "",
          });
        }
      } catch (error) {
        console.error("Loading private lesson note failed:", error);

        if (!cancelled) {
          setNoteState((current) => ({
            ...current,
            loading: false,
            saving: false,
            message: "",
            error: buildUserFacingError(error, t("notes.loadFailed"), {
              setupMessage: t("notes.setupRequired"),
              permissionMessage: t("notes.permissionDenied"),
            }),
          }));
        }
      }
    };

    void loadNote();

    return () => {
      cancelled = true;
    };
  }, [activeModule?.id, previewMode, studentId, t]);

  if (!previewMode && course?.status && course.status !== "published") {
    return (
      <>
        <button className="back-button" onClick={() => goTo(previewMode ? previewReturnPath : ROUTES.student.courses)}>
          ← {t("common.backToCourses")}
        </button>

        <section className="section-card">
          <span className="eyebrow">{t("student.courseDetail")}</span>
          <h2>{t("student.hiddenFromWorkspace")}</h2>
          <p>{t("student.hiddenFromWorkspace")}</p>
        </section>
      </>
    );
  }

  const uploadedPdfSource = getUploadedPdfSource(activeModule);
  const externalPdfSource = getExternalPdfSource(activeModule);
  const pdfSource = uploadedPdfSource || externalPdfSource || "";
  const normalizedVideoSource = normalizeVideoSource(activeModule);
  const videoSource = normalizedVideoSource.src || "";
  const embeddedPdfSource = !uploadedPdfSource ? getEmbeddablePdfUrl(externalPdfSource) : "";
  const hasDirectExternalPdf = !uploadedPdfSource && isDirectPdfUrl(externalPdfSource);
  const isGoogleDrivePdf = isGoogleDriveUrl(externalPdfSource);
  const pdfLabel =
    activeModule?.pdfLabel ||
    activeModule?.pdfName ||
    externalPdfSource ||
    t("common.noPdfSelected");
  const videoProviderLabel =
    normalizedVideoSource.provider === "vimeo"
      ? t("common.vimeoVideo")
      : normalizedVideoSource.provider === "youtube"
        ? t("common.youtubeVideo")
        : normalizedVideoSource.provider === "file"
          ? t("common.uploadedVideo")
          : t("common.videoLesson");
  const videoLabel =
    videoProviderLabel ||
    activeModule?.videoName ||
    activeModule?.video?.uploadLabel ||
    t("common.noVideoSelected");
  const assignmentType = "file";
  const assignmentStatus = assignmentState.submission?.status || "";
  const hasSubmission = Boolean(assignmentState.submission);
  const assignmentHasGrade =
    assignmentState.submission?.grade !== null && assignmentState.submission?.grade !== undefined;
  const assignmentApprovedForCompletion = assignmentStatus === "approved" || assignmentHasGrade;
  const hasPdfRequirement = lessonRequirements.requiresPdfView;
  const hasVideoRequirement = lessonRequirements.requiresVideoView;
  const hasAssignmentRequirement = lessonRequirements.requiresAssignmentSubmission;
  const activeSubmissionMap = new Map(courseSubmissions);
  if (activeAssignment?.id) {
    activeSubmissionMap.set(String(activeAssignment.id), assignmentState.submission);
  }
  const activeCompletionState = getLessonCompletionState({
    lesson: activeModule,
    progress: effectiveCompleted,
    submissions: courseSubmissionsLoaded ? activeSubmissionMap : null,
  });
  const moduleDone = activeCompletionState.moduleComplete;
  const pdfAvailable = Boolean(pdfSource);
  const videoAvailable = Boolean(normalizedVideoSource.hasVideo);
  const pdfRequirementMet = activeCompletionState.pdfComplete;
  const videoRequirementMet = activeCompletionState.videoComplete;
  const assignmentRequirementMet = activeCompletionState.assignmentComplete;
  const canComplete = pdfRequirementMet && videoRequirementMet && assignmentRequirementMet;
  const showPdfSection = Boolean(
    hasPdfRequirement ||
      (activeModule?.pdfLabel && activeModule.pdfLabel !== t("common.noPdfSelected")) ||
      activeModule?.pdfName,
  );
  const showVideoSection = Boolean(
    hasVideoRequirement ||
      (activeModule?.video?.uploadLabel && activeModule.video.uploadLabel !== t("common.noVideoSelected")) ||
      activeModule?.videoName,
  );
  const completionBlockerMessage = getCompletionBlockerMessage({
    t,
    pdfRequired: hasPdfRequirement && !pdfRequirementMet,
    videoRequired: hasVideoRequirement && !videoRequirementMet,
    assignmentRequired: hasAssignmentRequirement && !assignmentRequirementMet,
    assignmentSubmitted: hasSubmission,
  });

  const markSeen = async (key) => {
    setViewError("");
    setLocalProgressOverrides((current) => ({ ...current, [key]: true }));
    const result = await onUpdateProgress(
      { [key]: true },
      {
        courseId: activeModuleCourseId,
        moduleCourseIds: activeModule?.id && activeModuleCourseId
          ? { [String(activeModule.id)]: activeModuleCourseId }
          : {},
      },
    );

    if (result?.ok === false) {
      console.error("[StudentProgress] Saving lesson resource progress failed:", result.error);
      setLocalProgressOverrides((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
      setViewError(
        buildProgressSaveErrorMessage(
          result.error,
          key.startsWith("video-")
            ? t("errors.videoProgressSaveFailed")
            : t("errors.progressSaveFailed"),
          t("errors.studentProgressSetupRequired"),
        ),
      );
      return false;
    }

    return true;
  };

  const toggleModule = async () => {
    if (!activeModule || !activeLessonState?.isUnlocked || !canComplete || moduleDone) return;
    setViewError("");
    const progressKey = `module-${activeModule.id}`;
    setLocalProgressOverrides((current) => ({ ...current, [progressKey]: true }));
    const result = await onUpdateProgress(
      { [progressKey]: true },
      {
        courseId: activeModuleCourseId,
        moduleCourseIds: activeModuleCourseId ? { [String(activeModule.id)]: activeModuleCourseId } : {},
      },
    );

    if (result?.ok === false) {
      console.error("[StudentProgress] Saving module completion failed:", result.error);
      setLocalProgressOverrides((current) => {
        const next = { ...current };
        delete next[progressKey];
        return next;
      });
      setViewError(
        buildProgressSaveErrorMessage(
          result.error,
          t("errors.progressSaveFailed"),
          t("errors.studentProgressSetupRequired"),
        ),
      );
    }
  };

  const handleSaveNote = async () => {
    if (previewMode) {
      setNoteState((current) => ({
        ...current,
        message: "",
        error: t("notes.previewDisabled"),
      }));
      return;
    }

    if (!activeModule?.id || !studentId) return;

    setNoteState((current) => ({
      ...current,
      saving: true,
      message: "",
      error: "",
    }));

    try {
      const savedNote = await saveStudentLessonNote(studentId, activeModule.id, noteState.note);
      setNoteState({
        loading: false,
        saving: false,
        note: savedNote?.note ?? "",
        savedNote: savedNote?.note ?? "",
        lastSavedAt: savedNote?.updatedAt ?? savedNote?.updated_at ?? new Date().toISOString(),
        message: t("notes.saved"),
        error: "",
      });
    } catch (error) {
      console.error("Saving private lesson note failed:", error);
      setNoteState((current) => ({
        ...current,
        saving: false,
        message: "",
        error: buildUserFacingError(error, t("notes.saveFailed"), {
          setupMessage: t("notes.setupRequired"),
          permissionMessage: t("notes.permissionDenied"),
        }),
      }));
    }
  };

  const handleAssignmentSubmit = async () => {
    if (previewMode) {
      setAssignmentState((current) => ({
        ...current,
        submitError: t("admin.previewModeNoSubmissions"),
        submitMessage: "",
      }));
      return;
    }

    if (!activeAssignment?.id || !studentId) return;

    if (assignmentStatus === "approved") {
      setAssignmentState((current) => ({
        ...current,
        submitError: t("common.resubmissionNotAllowed"),
        submitMessage: "",
      }));
      return;
    }

    if (!assignmentState.selectedFile) {
      setAssignmentState((current) => ({
        ...current,
        submitError: t("validation.assignmentFileRequired"),
        submitMessage: "",
      }));
      return;
    }

    setAssignmentState((current) => ({
      ...current,
      uploading: true,
      submitError: "",
      submitMessage: "",
    }));

    try {
      let filePublicUrl = "";
      let fileName = "";
      let fileStoragePath = "";
      let fileType = "";
      let fileSize = null;

      if (assignmentState.selectedFile) {
        const uploaded = await uploadAssignmentFile(assignmentState.selectedFile);
        filePublicUrl = uploaded.publicUrl || "";
        fileName = uploaded.fileName || assignmentState.selectedFile.name;
        fileStoragePath = uploaded.storagePath || "";
        fileType = uploaded.fileType || assignmentState.selectedFile.type || "";
        fileSize = uploaded.fileSize ?? assignmentState.selectedFile.size ?? null;
      }

      const savedSubmission = await submitAssignment(activeAssignment.id, studentId, {
        filePublicUrl,
        fileName,
        fileStoragePath,
        fileType,
        fileSize,
      });

      setAssignmentState({
        loading: false,
        error: "",
        submission: savedSubmission,
        selectedFile: null,
        selectedFileName: savedSubmission?.fileName || fileName,
        submitMessage: t("common.assignmentSubmittedSuccess"),
        submitError: "",
        uploading: false,
      });
      setCourseSubmissions((current) => {
        const next = new Map(current);
        next.set(String(activeAssignment.id), savedSubmission);
        return next;
      });
    } catch (error) {
      console.error("Submitting the assignment failed:", error);
      setAssignmentState((current) => ({
        ...current,
        uploading: false,
        submitError: buildUserFacingError(error, t("errors.submittingAssignmentFailed")),
        submitMessage: "",
      }));
    }
  };

  if (!modules.length) {
    return (
      <>
        <button className="back-button" onClick={() => goTo(previewMode ? previewReturnPath : ROUTES.student.courses)}>
          ← {t("common.backToCourses")}
        </button>

        <div className="detail-hero">
          <div>
            <span className="eyebrow">{t("student.ownedCourse")}</span>
            <h2>{course.title}</h2>
            <p>{course.description}</p>
          </div>
          <div className="hero-progress">
            <strong>{progress}%</strong>
            <span>{t("common.courseProgress")}</span>
            <Progress value={progress} />
          </div>
        </div>

        <section className="section-card">
          <span className="eyebrow">{t("common.courseModules")}</span>
          <h2>{t("student.noModulesAvailable")}</h2>
          <p>{t("student.noModulesYetDescription")}</p>
        </section>
      </>
    );
  }

  const isAssignmentLocked = assignmentStatus === "approved";
  const noteDirty = noteState.note !== noteState.savedNote;
  const assignmentButtonLabel = assignmentState.uploading
    ? t("common.submitting")
    : !hasSubmission
      ? t("common.submitAssignment")
      : assignmentStatus === "changes_requested" || assignmentStatus === "needs_revision"
        ? t("common.resubmitAssignment")
        : assignmentStatus === "rejected"
          ? t("common.resubmitAssignment")
          : assignmentStatus === "approved"
            ? t("common.assignmentApprovedButton")
            : t("common.updateSubmission");

  if (blockedLessonId) {
    const blockedState = sequentialState.lessonStates.get(String(blockedLessonId));
    const blockedReason =
      blockedState?.lockReason === "previous-class"
        ? t("common.lessonLockedPreviousClass")
        : t("common.lessonLockedPreviousLesson");

    return (
      <>
        <button
          className="back-button"
          onClick={() => {
            setBlockedLessonId("");
            setActiveModuleId(sequentialState.nextLesson?.id ?? modules[0]?.id ?? null);
            window.history.replaceState({}, "", previewMode ? ROUTES.admin.studentPreview(course.id) : ROUTES.student.courseDetail(course.id));
          }}
        >
          ← {t("common.backToCourse")}
        </button>
        <section className="section-card lesson-access-denied">
          <span className="lesson-lock-icon"><Icon name="lock" size={24} /></span>
          <span className="eyebrow">{t("common.lessonLocked")}</span>
          <h2>{blockedState?.lesson?.title || t("common.lessonLocked")}</h2>
          <p>{blockedReason}</p>
          <button
            type="button"
            className="secondary-btn"
            onClick={() => {
              setBlockedLessonId("");
              setActiveModuleId(sequentialState.nextLesson?.id ?? modules[0]?.id ?? null);
              window.history.replaceState({}, "", previewMode ? ROUTES.admin.studentPreview(course.id) : ROUTES.student.courseDetail(course.id));
            }}
          >
            {t("common.backToCourse")}
          </button>
        </section>
      </>
    );
  }

  return (
    <>
      <button className="back-button" onClick={() => goTo(previewMode ? previewReturnPath : ROUTES.student.courses)}>
        ← {t("common.backToCourses")}
      </button>

      <div className="detail-hero">
        <div>
          <span className="eyebrow">{t("student.ownedCourse")}</span>
          <h2>{course.title}</h2>
          <p>{course.description}</p>
        </div>
        <div className="hero-progress">
          <strong>{progress}%</strong>
          <span>{t("common.courseProgress")}</span>
          <span>{t("common.lessonsCompletedCount", { completed: sequentialState.completedCount, total: sequentialState.totalCount })}</span>
          <Progress value={progress} />
        </div>
      </div>

      <div className="course-detail-layout">
        <aside className="module-list">
          <div className="module-title">
            <span className="eyebrow">{t("common.courseModules")}</span>
            <h3>{`${courseClasses.length} ${t("common.classes").toLowerCase()} · ${modules.length} ${t("common.modules").toLowerCase()}`}</h3>
          </div>

          {courseClasses.map((courseClass) => (
            <div key={courseClass.id} className="module-class-group">
              <div className="module-title">
                <span className="eyebrow">{t("common.class")}</span>
                <h4>{courseClass.title}</h4>
                {courseClass.description ? <p>{courseClass.description}</p> : null}
              </div>
              {(courseClass.modules || []).map((module) => {
                const lessonState = sequentialState.lessonStates.get(String(module.id));
                const isLocked = Boolean(lessonState?.isLocked);
                const lockReason =
                  lessonState?.lockReason === "previous-class"
                    ? t("common.lessonLockedPreviousClass")
                    : t("common.lessonLockedPreviousLesson");

                return (
                  <div className={`module ${isLocked ? "is-locked" : ""}`} key={module.id}>
                    <button
                      className={[
                        activeModule?.id === module.id ? "active" : "",
                        lessonState?.isComplete ? "is-complete" : "",
                      ].filter(Boolean).join(" ")}
                      disabled={isLocked}
                      aria-disabled={isLocked}
                      title={isLocked ? lockReason : undefined}
                      onClick={() => selectLesson(module)}
                    >
                      <span className={`lesson-icon ${lessonState?.isComplete ? "done" : isLocked ? "locked" : ""}`}>
                        {lessonState?.isComplete
                          ? <Icon name="check" size={14} />
                          : isLocked
                            ? <Icon name="lock" size={13} />
                            : <span>{(lessonState?.index ?? 0) + 1}</span>}
                      </span>
                      <span>
                        <strong>{module.title}</strong>
                        <small>
                          {isLocked
                            ? lockReason
                            : lessonState?.isComplete
                              ? t("common.lessonCompleted")
                              : lessonState?.isUnlocked
                                ? t("common.lessonUnlocked")
                                : module.description}
                        </small>
                      </span>
                      {isLocked ? <Icon name="lock" size={15} /> : <Icon name="chevron" size={16} />}
                    </button>
                  </div>
                );
              })}
            </div>
          ))}
        </aside>

        <section className="lesson-content">
          <span className="eyebrow">{t("common.currentModule")}</span>
          <h2>{activeModule?.title || t("common.selectModule")}</h2>
          <p>{activeModule?.description || t("student.currentModuleDescriptionFallback")}</p>
          {activeModule?.lesson_content || activeModule?.lessonContent ? (
            <div className="section-card lesson-text-card">
              <span className="eyebrow">{t("admin.lessonContent")}</span>
              <p>{activeModule.lesson_content || activeModule.lessonContent}</p>
            </div>
          ) : null}

          {viewError && <small className="field-note danger-text">{viewError}</small>}

          <section className="section-card lesson-notes-card">
            <div className="section-heading">
              <div>
                <span className="eyebrow">{t("notes.eyebrow")}</span>
                <h2>{t("notes.title")}</h2>
                <p>{t("notes.description")}</p>
              </div>
            </div>

            {noteState.loading ? <small className="field-note">{t("notes.loading")}</small> : null}
            {noteState.message ? <small className="field-note">{noteState.message}</small> : null}
            {noteState.error ? <small className="field-note danger-text">{noteState.error}</small> : null}

            <label>
              {t("notes.label")}
              <textarea
                className="lesson-notes-textarea"
                rows={7}
                value={noteState.note}
                disabled={previewMode || noteState.loading || noteState.saving || !activeModule?.id}
                placeholder={t("notes.placeholder")}
                onChange={(event) =>
                  setNoteState((current) => ({
                    ...current,
                    note: event.target.value,
                    message: "",
                    error: "",
                  }))
                }
              />
            </label>

            <div className="lesson-notes-footer">
              <div>
                {noteState.lastSavedAt ? (
                  <small className="field-note">{t("notes.lastSaved", { time: formatSavedTime(noteState.lastSavedAt, language) })}</small>
                ) : (
                  <small className="field-note">{t("notes.notSavedYet")}</small>
                )}
                {noteDirty ? <small className="field-note">{t("notes.unsavedChanges")}</small> : null}
                {previewMode ? <small className="field-note">{t("notes.previewDisabled")}</small> : null}
              </div>
              <button
                type="button"
                className="secondary-btn"
                onClick={() => void handleSaveNote()}
                disabled={previewMode || noteState.loading || noteState.saving || !activeModule?.id || !noteDirty}
              >
                {noteState.saving ? t("notes.saving") : t("notes.save")}
              </button>
            </div>
          </section>

          <div className="module-assets">
            <div className="lesson-meta">
              <span className="subtle-badge">{t("common.image")}</span>
              <span>{activeModule?.image_file_name || activeModule?.imageName || t("common.noImageUploadedYet")}</span>
            </div>

            {activeModule?.image_url || activeModule?.imageUrl ? (
              <div className="resource-viewer-stack">
                <div className="image-preview-shell">
                  <img
                    className="course-image-preview"
                    src={activeModule.image_url || activeModule.imageUrl}
                    alt={activeModule?.title || t("common.image")}
                  />
                </div>
                <div className="row-actions resource-viewer-actions">
                  <a href={activeModule.image_url || activeModule.imageUrl} target="_blank" rel="noreferrer">
                    {t("common.openImage")}
                  </a>
                </div>
              </div>
            ) : activeModule?.image_file_name || activeModule?.imageName ? (
              <small className="field-note danger-text">{t("common.fileNameExistsButUrlMissing")}</small>
            ) : (
              <small className="field-note">{t("common.noImageUploadedYet")}</small>
            )}

            {showPdfSection ? (
              <>
                <div className="lesson-meta">
                  <span className="subtle-badge">PDF</span>
                  <span>{pdfLabel}</span>
                </div>

                {uploadedPdfSource ? (
                  <div className="resource-viewer-stack">
                    <div className="row-actions resource-viewer-actions">
                      <a href={uploadedPdfSource} target="_blank" rel="noreferrer" onClick={() => markSeen(`pdf-${activeModule.id}`)}>
                        {t("common.openPdf")}
                      </a>
                    </div>
                  </div>
                ) : embeddedPdfSource ? (
                  <div className="resource-viewer-stack">
                    <div className="lesson-meta">
                      <span className="subtle-badge">{t("common.viewPdfOnPage")}</span>
                      <span>{isGoogleDrivePdf ? "Google Drive" : "PDF"}</span>
                    </div>
                    <div className="resource-viewer-shell">
                      <iframe
                        className="resource-viewer-frame pdf-viewer-frame"
                        title={t("common.pdfPreviewTitle")}
                        src={embeddedPdfSource}
                        width="100%"
                        height="650"
                        loading="lazy"
                        allow="autoplay"
                        onLoad={() => markSeen(`pdf-${activeModule.id}`)}
                      />
                    </div>
                    <small className="field-note">{t("common.previewFallbackOpensNewTab")}</small>
                    <div className="row-actions resource-viewer-actions">
                      <a href={externalPdfSource} target="_blank" rel="noreferrer" onClick={() => markSeen(`pdf-${activeModule.id}`)}>
                        {t("common.openPdfInNewTab")}
                      </a>
                    </div>
                  </div>
                ) : externalPdfSource ? (
                  <div className="resource-viewer-stack">
                    {hasDirectExternalPdf ? (
                      <small className="field-note">{t("common.previewAvailable")}</small>
                    ) : null}
                    <div className="row-actions resource-viewer-actions">
                      <a href={externalPdfSource} target="_blank" rel="noreferrer" onClick={() => markSeen(`pdf-${activeModule.id}`)}>
                        {t("common.openPdfInNewTab")}
                      </a>
                    </div>
                  </div>
                ) : activeModule?.pdfLabel && activeModule.pdfLabel !== t("common.noPdfSelected") ? (
                  <small className="field-note danger-text">{t("common.fileNameExistsButUrlMissing")}</small>
                ) : activeModule?.pdfName ? (
                  <small className="field-note danger-text">{t("common.fileNameExistsButUrlMissing")}</small>
                ) : null}
              </>
            ) : null}

            {showVideoSection ? (
              <>
                <div className="lesson-meta">
                  <span className="subtle-badge">Video</span>
                  <span>{videoLabel}</span>
                </div>

                {normalizedVideoSource.type === "video" ? (
                  <div className="resource-viewer-stack">
                    <div className="video-player-shell">
                      <video
                        controls
                        width="100%"
                        src={normalizedVideoSource.src}
                        onPlay={() => markSeen(`video-${activeModule.id}`)}
                        onEnded={() => markSeen(`video-${activeModule.id}`)}
                        onError={() => {
                          console.error("Video playback failed for module:", activeModule?.id, normalizedVideoSource.src);
                          setViewError(t("errors.videoPlaybackFailed"));
                        }}
                      />
                    </div>
                  </div>
                ) : normalizedVideoSource.type === "iframe" ? (
                  <div className="resource-viewer-stack">
                    <div className="lesson-meta">
                      <span className="subtle-badge">{t("common.viewVideoOnPage")}</span>
                      <span>{videoProviderLabel}</span>
                    </div>
                    <div className="resource-viewer-shell">
                      <iframe
                        className="resource-viewer-frame video-viewer-frame"
                        title={activeModule?.title || t("common.videoPreviewTitle")}
                        src={normalizedVideoSource.src}
                        width="100%"
                        height="480"
                        loading="lazy"
                        allow="autoplay; fullscreen; picture-in-picture"
                        allowFullScreen
                        onLoad={() => markSeen(`video-${activeModule.id}`)}
                      />
                    </div>
                    <small className="field-note">{t("common.previewFallbackOpensNewTab")}</small>
                    <div className="row-actions resource-viewer-actions">
                      <a
                        href={
                          /^https?:\/\//i.test(normalizedVideoSource.original || "")
                            ? normalizedVideoSource.original
                            : normalizedVideoSource.src
                        }
                        target="_blank"
                        rel="noreferrer"
                        onClick={() => markSeen(`video-${activeModule.id}`)}
                      >
                        {t("common.openVideoInNewTab")}
                      </a>
                      {!videoRequirementMet ? (
                        <button type="button" className="secondary-btn" onClick={() => markSeen(`video-${activeModule.id}`)}>
                          {t("common.markVideoViewed")}
                        </button>
                      ) : null}
                    </div>
                  </div>
                ) : normalizedVideoSource.type === "external" ? (
                  <div className="resource-viewer-stack">
                    <small className="field-note">{t("common.videoPreviewCouldNotBeLoaded")}</small>
                    <div className="row-actions resource-viewer-actions">
                      <a href={normalizedVideoSource.src} target="_blank" rel="noreferrer" onClick={() => markSeen(`video-${activeModule.id}`)}>
                        {t("common.openVideoInNewTab")}
                      </a>
                      {!videoRequirementMet ? (
                        <button type="button" className="secondary-btn" onClick={() => markSeen(`video-${activeModule.id}`)}>
                          {t("common.markVideoViewed")}
                        </button>
                      ) : null}
                    </div>
                  </div>
                ) : normalizedVideoSource.type === "unknown" && normalizedVideoSource.hasVideo ? (
                  <div className="resource-viewer-stack">
                    <small className="field-note">{t("common.videoPreviewCouldNotBeLoaded")}</small>
                    {!videoRequirementMet ? (
                      <button type="button" className="secondary-btn" onClick={() => markSeen(`video-${activeModule.id}`)}>
                        {t("common.markVideoViewed")}
                      </button>
                    ) : null}
                  </div>
                ) : activeModule?.video?.uploadLabel && activeModule.video.uploadLabel !== t("common.noVideoSelected") ? (
                  <small className="field-note danger-text">{t("common.fileNameExistsButUrlMissing")}</small>
                ) : activeModule?.videoName ? (
                  <small className="field-note danger-text">{t("common.fileNameExistsButUrlMissing")}</small>
                ) : null}
              </>
            ) : null}
          </div>

          {activeAssignment ? (
            <section className="section-card assignment-card">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">{t("common.moduleAssignment")}</span>
                  <h2>{localizedAssignment.title}</h2>
                  <p>{localizedAssignment.instructions}</p>
                </div>
              </div>

              <div className="assignment-chip-row">
                <span className="subtle-badge">{t("student.assignmentType", { type: translateSubmissionType(assignmentType) })}</span>
                {assignmentState.submission?.status ? <Status status={assignmentState.submission.status} /> : null}
              </div>

              {assignmentState.loading && <small className="field-note">{t("common.loadingYourSubmission")}</small>}
              {assignmentState.error && <small className="field-note danger-text">{assignmentState.error}</small>}
              {assignmentState.submitMessage && <small className="field-note">{assignmentState.submitMessage}</small>}
              {assignmentState.submitError && (
                <small className="field-note danger-text">{assignmentState.submitError}</small>
              )}
              {previewMode ? <small className="field-note">{t("admin.previewModeNoSubmissions")}</small> : null}

              <label>
                {t("common.uploadFile")}
                <input
                  type="file"
                  disabled={previewMode || isAssignmentLocked || assignmentState.loading || assignmentState.uploading}
                  onChange={(event) =>
                    setAssignmentState((current) => ({
                      ...current,
                      selectedFile: event.target.files?.[0] ?? null,
                      selectedFileName: event.target.files?.[0]?.name || current.selectedFileName,
                      submitError: "",
                      submitMessage: "",
                    }))
                  }
                />
              </label>

              {assignmentState.selectedFileName ? (
                <small className="field-note">{t("common.selectedFile", { name: assignmentState.selectedFileName })}</small>
              ) : null}

              {assignmentState.submission?.filePublicUrl || assignmentState.submission?.fileUrl ? (
                <a className="assignment-link" href={assignmentState.submission.filePublicUrl || assignmentState.submission.fileUrl} target="_blank" rel="noreferrer">
                  {t("common.openSubmittedFile")}
                </a>
              ) : null}

              <div className="assignment-meta">
                <p>
                  <strong>{t("common.grade")}:</strong>{" "}
                  {assignmentState.submission?.grade === null || assignmentState.submission?.grade === undefined
                    ? `${t("common.notGradedYet")}.`
                    : `${assignmentState.submission.grade}/100`}
                </p>
                <p>
                  <strong>{t("common.feedback")}:</strong>{" "}
                  {assignmentState.submission?.adminFeedback ||
                    assignmentState.submission?.admin_feedback ||
                    t("common.noFeedbackYet")}
                </p>
                <p>
                  <strong>{t("common.status")}:</strong>{" "}
                  {assignmentState.submission?.status ? t(`status.${assignmentState.submission.status}`) : t("common.assignmentPending")}
                </p>
              </div>

              {assignmentState.submission ? (
                <small className="field-note">
                  {assignmentStatus === "approved"
                    ? t("common.assignmentApprovedHelp")
                    : assignmentStatus === "changes_requested" || assignmentStatus === "needs_revision"
                      ? t("common.assignmentNeedsRevisionHelp")
                      : assignmentStatus === "rejected"
                        ? t("common.assignmentRejectedHelp")
                        : t("common.assignmentSubmittedHelp")}
                </small>
              ) : null}

              <div className="form-actions compact">
                <button
                  type="button"
                  className="primary-btn"
                  disabled={previewMode || isAssignmentLocked || assignmentState.uploading || assignmentState.loading}
                  onClick={() => void handleAssignmentSubmit()}
                >
                  <Icon name="check" />
                  {assignmentButtonLabel}
                </button>
              </div>
            </section>
          ) : null}

          <div className="progress-steps">
            {hasPdfRequirement ? (
              <span className={pdfRequirementMet ? "subtle-badge" : "count-badge"}>
                {pdfRequirementMet ? t("common.pdfViewed") : t("common.pdfPending")}
              </span>
            ) : null}
            {hasVideoRequirement ? (
              <span className={videoRequirementMet ? "subtle-badge" : "count-badge"}>
                {videoRequirementMet ? t("common.videoViewed") : t("common.videoPending")}
              </span>
            ) : null}
            {hasAssignmentRequirement ? (
              <span className={assignmentRequirementMet ? "subtle-badge" : "count-badge"}>
                {assignmentStatus === "approved"
                  ? t("common.assignmentApproved")
                  : assignmentStatus === "changes_requested" || assignmentStatus === "needs_revision"
                    ? t("common.assignmentNeedsRevision")
                    : assignmentStatus === "rejected"
                      ? t("common.assignmentRejected")
                      : assignmentApprovedForCompletion
                        ? t("common.assignmentReviewed")
                        : hasSubmission
                          ? t("common.assignmentPendingReview")
                          : t("common.assignmentPending")}
              </span>
            ) : null}
            {!hasPdfRequirement && !hasVideoRequirement && !hasAssignmentRequirement ? (
              <span className="subtle-badge">{t("common.noCompletionRequirements")}</span>
            ) : null}
          </div>

          {!canComplete && completionBlockerMessage ? (
            <small className="field-note danger-text">
              {completionBlockerMessage}
            </small>
          ) : null}

          <button
            className={moduleDone ? "complete-btn done" : "complete-btn"}
            onClick={toggleModule}
            disabled={!activeModule || !activeLessonState?.isUnlocked || !canComplete || moduleDone}
          >
            <Icon name="check" />
            {moduleDone ? t("common.moduleMarkedComplete") : t("common.markModuleComplete")}
          </button>
          {nextModule && moduleDone && nextLessonState?.isUnlocked ? (
            <button
              type="button"
              className="secondary-btn next-lesson-button"
              onClick={handleNextLesson}
            >
              {t("common.nextLesson")} <Icon name="arrow" size={16} />
            </button>
          ) : nextModule && !nextLessonState?.isUnlocked ? (
            <small className="field-note">{t("common.completeThisLessonToUnlockNext")}</small>
          ) : sequentialState.courseComplete ? (
            <p className="course-complete-message">{t("common.courseComplete")}</p>
          ) : null}
        </section>
      </div>
    </>
  );
}

function StudentCertificatesPage({ certificates, courses, studentId, onPreview }) {
  const { t } = useLanguage();
  const [waitingForGrading, setWaitingForGrading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const checkWaitingAssignments = async () => {
      if (!studentId || !courses?.length) {
        if (!cancelled) setWaitingForGrading(false);
        return;
      }

      const assignments = courses.flatMap((course) =>
        (course.modules ?? [])
          .map((module) => module.assignment)
          .filter((assignment) => assignment?.id),
      );

      if (!assignments.length) {
        if (!cancelled) setWaitingForGrading(false);
        return;
      }

      try {
        const submissions = await Promise.all(
          assignments.map((assignment) => getStudentSubmission(assignment.id, studentId)),
        );
        const hasWaitingSubmission = submissions.some((submission) => {
          const status = `${submission?.status ?? ""}`.trim().toLowerCase();
          return submission && status === "submitted";
        });
        if (!cancelled) setWaitingForGrading(hasWaitingSubmission);
      } catch (error) {
        console.error("Checking certificate waiting-for-grading state failed:", error);
        if (!cancelled) setWaitingForGrading(false);
      }
    };

    void checkWaitingAssignments();
    return () => {
      cancelled = true;
    };
  }, [courses, studentId]);

  return (
    <>
      <div className="page-intro">
        <div>
          <span className="eyebrow">{t("student.myAchievements")}</span>
          <h2>{t("student.yourCertificates")}</h2>
          <p>{t("student.certificatesGeneratedForCompletedCourses")}</p>
        </div>
      </div>
      {!certificates.length ? (
        <section className="section-card">
          <span className="eyebrow">{waitingForGrading ? t("student.waitingForAssignmentGrading") : t("student.certificateAvailable")}</span>
          <h3>{waitingForGrading ? t("student.waitingForAssignmentGrading") : t("student.unlockCertificateTitle")}</h3>
          <p>{waitingForGrading ? t("student.assignmentWaitingForGradingHelp") : t("student.unlockCertificateHelp")}</p>
        </section>
      ) : null}
      <div className="certificate-grid">
        {certificates.map((certificate) => (
          <article key={certificate.id}>
            <div className="cert-ribbon">
              <Icon name="certificate" size={30} />
            </div>
            <span className="eyebrow">{t("student.certificateOfCompletion")}</span>
            <h3>{certificate.course}</h3>
            <dl>
              <div>
                <dt>{t("admin.certificateNumber")}</dt>
                <dd>{certificate.number}</dd>
              </div>
              <div>
                <dt>{t("admin.issueDate")}</dt>
                <dd>{certificate.issueDate}</dd>
              </div>
              <div>
                <dt>{t("common.status")}</dt>
                <dd>
                  <Status status={certificate.status} />
                </dd>
              </div>
            </dl>
            <button className="secondary-btn" onClick={() => onPreview(certificate)}>
              {t("student.viewCertificate")}
            </button>
          </article>
        ))}
      </div>
    </>
  );
}
