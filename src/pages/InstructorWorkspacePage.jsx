import React, { useEffect, useMemo, useState } from "react";
import { CommunityBoard } from "../components/CommunityBoard.jsx";
import { PrivateMessagesPage } from "../components/PrivateMessagesPage.jsx";
import { Icon, Status, Welcome } from "../components/ui.jsx";
import { useLanguage } from "../i18n/LanguageContext.jsx";
import {
  createInstructorCourse,
  getInstructorCourses,
  updateInstructorCourse,
} from "../services/courseService.js";
import { getNotifications } from "../services/notificationService.js";
import { uploadModuleImage, uploadModulePdf, uploadModuleVideo } from "../services/storageService.js";
import { ROUTES, getInstructorCourseRouteState } from "../routes/appRoutes.js";
import { buildUserFacingError, sanitizeErrorDetails } from "../utils/errorDisplay.js";

const PDF_ACCEPT = "application/pdf,.pdf";
const VIDEO_ACCEPT = "video/*";
const IMAGE_ACCEPT = "image/*";

function navigateTo(pathname) {
  window.history.pushState({}, "", pathname);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function createCourseDraft(course = {}) {
  return {
    title: course.title ?? "",
    description: course.description ?? "",
    imageUrl: course.imageUrl ?? course.image_url ?? "",
    status: course.status ?? "draft",
    classes: safeArray(course.classes),
    modules: safeArray(course.modules),
  };
}

function createClassDraft(index) {
  return {
    id: `class-draft-${Date.now()}-${index}`,
    title: `Class ${index}`,
    description: "",
    status: "published",
    sortOrder: index,
    sort_order: index,
  };
}

function createModuleDraft(classId, index) {
  return {
    id: `module-draft-${Date.now()}-${index}`,
    classId,
    class_id: classId,
    title: `Lesson ${index}`,
    description: "",
    lessonContent: "",
    lesson_content: "",
    embedUrl: "",
    embed_url: "",
    pdfUrl: "",
    pdf_url: "",
    videoUrl: "",
    video_url: "",
    imageUrl: "",
    image_url: "",
    requiresAssignment: false,
    requires_assignment: false,
    assignmentInstructions: "",
    assignment_instructions: "",
    status: "published",
    sortOrder: index,
    sort_order: index,
  };
}

function InstructorError({ error, language }) {
  if (!error) return null;
  const details = error.details || "";
  return (
    <div className="admin-error-card">
      <small className="field-note danger-text">{error.message || error}</small>
      {details ? (
        <details className="admin-error-details">
          <summary>{language === "es" ? "Detalles técnicos" : "Technical details"}</summary>
          <pre>{details}</pre>
        </details>
      ) : null}
    </div>
  );
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

function InstructorCourseCard({ course, t }) {
  const moduleCount = safeArray(course.modules).length;
  const classCount = safeArray(course.classes).filter((entry) => entry.id !== "general").length;
  return (
    <article className="np-course-card-v2">
      <div className="np-course-card-media">
        {course.imageUrl || course.image_url ? (
          <img src={course.imageUrl || course.image_url} alt={course.title} />
        ) : (
          <div className="np-course-card-placeholder"><Icon name="courses" /></div>
        )}
      </div>
      <div className="np-course-card-content">
        <div className="row-actions wrap-actions">
          <Status status={course.status || "draft"} />
          <span className="subtle-badge">{t("common.classes")}: {classCount}</span>
          <span className="subtle-badge">{t("common.lessons")}: {moduleCount}</span>
        </div>
        <h3>{course.title || t("instructor.untitledCourse")}</h3>
        <p>{course.description || t("instructor.noCourseDescription")}</p>
      </div>
      <div className="np-course-card-actions">
        <button type="button" className="np-course-card-button-v2" onClick={() => navigateTo(ROUTES.instructor.courseBuilder(course.id))}>
          {t("instructor.openBuilder")}
        </button>
      </div>
    </article>
  );
}

function InstructorDashboard({ courses, currentUser }) {
  const { t } = useLanguage();
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    let mounted = true;
    void getNotifications(currentUser)
      .then((nextNotifications) => {
        if (mounted) setNotifications(nextNotifications);
      })
      .catch((error) => console.error("Loading instructor dashboard notifications failed:", error));
    return () => {
      mounted = false;
    };
  }, [currentUser?.id]);

  const draftCourses = courses.filter((course) => course.status === "draft");
  const unreadMessages = notifications.filter(
    (notification) => !notification.readAt && ["new_private_message", "new_message_request"].includes(notification.type),
  );

  const cards = [
    {
      title: t("common.myCourses"),
      value: courses.length,
      text: courses.length ? t("instructor.manageCreatedCourses") : t("instructor.noAssignedCoursesYet"),
      icon: "courses",
      path: ROUTES.instructor.courses,
    },
    {
      title: t("instructor.draftCourses"),
      value: draftCourses.length,
      text: t("instructor.draftCoursesText"),
      icon: "dashboard",
      path: ROUTES.instructor.courses,
    },
    {
      title: t("common.assignmentReviews"),
      value: 0,
      text: t("instructor.assignmentReviewsPlaceholder"),
      icon: "certificate",
      path: ROUTES.instructor.assignmentReviews,
    },
    {
      title: t("common.messages"),
      value: unreadMessages.length,
      text: t("instructor.messagesPlaceholder"),
      icon: "community",
      path: ROUTES.instructor.messages,
    },
    {
      title: t("common.community"),
      value: "→",
      text: t("instructor.communityText"),
      icon: "community",
      path: ROUTES.instructor.community,
    },
  ];

  return (
    <>
      <Welcome title={t("instructor.dashboardTitle")} text={t("instructor.dashboardText")} />
      <section className="section-card dashboard-quick-actions">
        <div className="section-heading">
          <div>
            <span className="eyebrow">{t("common.teaching")}</span>
            <h2>{courses.length ? t("instructor.recentCourseActivity") : t("instructor.createFirstCourse")}</h2>
            <p>{t("instructor.manageCreatedCourses")}</p>
          </div>
          <button type="button" className="primary-btn" onClick={() => navigateTo(ROUTES.instructor.courseCreate)}>
            {t("instructor.createCourse")} <Icon name="plus" />
          </button>
        </div>
        <div className="dashboard-overview-grid compact-dashboard-grid">
          {cards.map((card) => (
            <button key={card.title} type="button" className="dashboard-summary-card" onClick={() => navigateTo(card.path)}>
              <span className="dashboard-summary-icon"><Icon name={card.icon} /></span>
              <small>{card.title}</small>
              <strong>{card.value}</strong>
              <p>{card.text}</p>
            </button>
          ))}
        </div>
      </section>
    </>
  );
}

function InstructorCourseManager({ courses, loading, error, reload, t, language }) {
  return (
    <div className="stack-layout">
      <section className="section-card">
        <div className="section-heading">
          <div>
            <span className="eyebrow">{t("instructor.instructorCourses")}</span>
            <h2>{t("common.myCourses")}</h2>
            <p>{t("instructor.manageCreatedCourses")}</p>
          </div>
          <div className="form-actions compact">
            <button type="button" className="secondary-btn" onClick={reload} disabled={loading}>{t("common.refresh")}</button>
            <button type="button" className="primary-btn" onClick={() => navigateTo(ROUTES.instructor.courseCreate)}>
              {t("instructor.createCourse")}
            </button>
          </div>
        </div>
        <InstructorError error={error} language={language} />
        {loading ? <small className="field-note">{t("common.loading")}</small> : null}
        {!loading && !courses.length ? (
          <div className="dashboard-empty-state compact">
            <span className="dashboard-summary-icon"><Icon name="courses" /></span>
            <div>
              <strong>{t("instructor.noAssignedCoursesYet")}</strong>
              <p>{t("instructor.createFirstCourse")}</p>
            </div>
          </div>
        ) : null}
      </section>
      <div className="np-course-card-grid-v2">
        {courses.map((course) => <InstructorCourseCard key={course.id} course={course} t={t} />)}
      </div>
    </div>
  );
}

function InstructorCourseForm({ currentUser, reloadCourses }) {
  const { t, language } = useLanguage();
  const [draft, setDraft] = useState(createCourseDraft());
  const [saving, setSaving] = useState(false);
  const [uploadingKey, setUploadingKey] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState(null);

  const updateDraft = (field, value) => setDraft((current) => ({ ...current, [field]: value }));

  const saveCourse = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError(null);

    try {
      const savedCourse = await createInstructorCourse(draft, currentUser?.id, { syncContent: false });
      setMessage(t("instructor.courseCreated"));
      await reloadCourses();
      navigateTo(ROUTES.instructor.courseBuilder(savedCourse.id));
    } catch (caughtError) {
      console.error("Creating instructor course failed:", caughtError);
      setError({
        message: buildUserFacingError(caughtError, t("instructor.courseCreateFailed"), {
          setupMessage: t("instructor.courseOwnershipSetupRequired"),
        }),
        details: sanitizeErrorDetails(caughtError),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="section-card">
      <div className="section-heading">
        <div>
          <span className="eyebrow">{t("instructor.createCourse")}</span>
          <h2>{t("instructor.createCourse")}</h2>
          <p>{t("instructor.newCourseHelp")}</p>
        </div>
      </div>
      <form className="community-form-grid" onSubmit={saveCourse}>
        <label>
          {t("common.courseTitle")}
          <input value={draft.title} onChange={(event) => updateDraft("title", event.target.value)} required />
        </label>
        <label>
          {t("common.status")}
          <select value={draft.status} onChange={(event) => updateDraft("status", event.target.value)}>
            <option value="draft">{t("status.draft")}</option>
            <option value="published">{t("status.published")}</option>
          </select>
        </label>
        <label className="wide-field">
          {t("common.courseImageUrl")}
          <input value={draft.imageUrl} onChange={(event) => updateDraft("imageUrl", event.target.value)} placeholder="https://..." />
        </label>
        <label className="wide-field">
          {t("common.description")}
          <textarea rows="4" value={draft.description} onChange={(event) => updateDraft("description", event.target.value)} required />
        </label>
        <div className="form-actions">
          <button type="button" className="secondary-btn" onClick={() => navigateTo(ROUTES.instructor.courses)}>
            {t("common.cancel")}
          </button>
          <button type="submit" className="primary-btn" disabled={saving}>
            {saving ? t("common.saving") : t("instructor.createCourse")}
          </button>
        </div>
      </form>
      {message ? <small className="field-note success-text">{message}</small> : null}
      <InstructorError error={error} language={language} />
    </section>
  );
}

function InstructorCourseBuilder({ course, currentUser, reloadCourses }) {
  const { t, language } = useLanguage();
  const [draft, setDraft] = useState(() => createCourseDraft(course));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(null);

  useEffect(() => {
    setDraft(createCourseDraft(course));
  }, [course?.id]);

  if (!course) {
    return <InstructorPlaceholderPage title={t("instructor.courseNotFound")} text={t("instructor.courseNotFoundText")} icon="courses" />;
  }

  const updateCourseField = (field, value) => setDraft((current) => ({ ...current, [field]: value }));
  const updateClass = (classId, field, value) => {
    setDraft((current) => ({
      ...current,
      classes: safeArray(current.classes).map((entry) => String(entry.id) === String(classId) ? { ...entry, [field]: value } : entry),
    }));
  };
  const updateModule = (moduleId, field, value) => {
    setDraft((current) => ({
      ...current,
      modules: safeArray(current.modules).map((entry) =>
        String(entry.id) === String(moduleId)
          ? {
              ...entry,
              [field]: value,
              ...(field === "lessonContent" ? { lesson_content: value } : {}),
              ...(field === "embedUrl" ? { embed_url: value } : {}),
              ...(field === "pdfUrl" ? { pdf_url: value } : {}),
              ...(field === "videoUrl" ? { video_url: value } : {}),
              ...(field === "imageUrl" ? { image_url: value } : {}),
              ...(field === "requiresAssignment" ? { requires_assignment: value } : {}),
              ...(field === "assignmentInstructions" ? { assignment_instructions: value } : {}),
            }
          : entry,
      ),
    }));
  };

  const addClass = () => {
    setDraft((current) => ({
      ...current,
      classes: [...safeArray(current.classes), createClassDraft(safeArray(current.classes).length + 1)],
    }));
  };

  const addLesson = (classId) => {
    setDraft((current) => {
      const classModules = safeArray(current.modules).filter((module) => String(module.class_id || module.classId) === String(classId));
      return {
        ...current,
        modules: [...safeArray(current.modules), createModuleDraft(classId, classModules.length + 1)],
      };
    });
  };

  const uploadLessonResource = async (moduleId, file, type) => {
    if (!file || !moduleId) return;
    const nextUploadingKey = `${moduleId}:${type}`;
    setUploadingKey(nextUploadingKey);
    setError(null);
    try {
      const uploaded =
        type === "pdf"
          ? await uploadModulePdf(file, moduleId)
          : type === "video"
            ? await uploadModuleVideo(file, moduleId)
            : await uploadModuleImage(file, moduleId);
      const publicUrl = uploaded?.publicUrl || uploaded?.url || "";
      if (!publicUrl) {
        throw new Error(language === "es" ? "La subida no devolvió una URL pública." : "Upload did not return a public URL.");
      }
      if (type === "pdf") updateModule(moduleId, "pdfUrl", publicUrl);
      if (type === "video") updateModule(moduleId, "videoUrl", publicUrl);
      if (type === "image") updateModule(moduleId, "imageUrl", publicUrl);
      setMessage(language === "es" ? "Recurso subido. Guarda el curso para conservar el cambio." : "Resource uploaded. Save the course to keep the change.");
    } catch (caughtError) {
      console.error("Uploading instructor lesson resource failed:", caughtError);
      setError({
        message: buildUserFacingError(caughtError, language === "es" ? "No se pudo subir el recurso." : "Resource could not be uploaded."),
        details: sanitizeErrorDetails(caughtError),
      });
    } finally {
      setUploadingKey("");
    }
  };

  const archiveCourse = async () => {
    const confirmed = window.confirm(language === "es" ? "¿Archivar este curso?" : "Archive this course?");
    if (!confirmed) return;
    setDraft((current) => ({ ...current, status: "archived" }));
    await saveBuilder(null, { status: "archived" });
  };

  const saveBuilder = async (event, override = {}) => {
    event?.preventDefault?.();
    setSaving(true);
    setMessage("");
    setError(null);

    const payload = { ...draft, ...override };

    try {
      await updateInstructorCourse(course.id, payload, currentUser?.id, { syncContent: true });
      setMessage(t("instructor.courseSaved"));
      await reloadCourses();
    } catch (caughtError) {
      console.error("Saving instructor course failed:", caughtError);
      setError({
        message: buildUserFacingError(caughtError, t("instructor.courseSaveFailed")),
        details: sanitizeErrorDetails(caughtError),
      });
    } finally {
      setSaving(false);
    }
  };

  const classes = safeArray(draft.classes).filter((entry) => entry.id !== "general");

  return (
    <section className="section-card">
      <form className="stack-layout" onSubmit={saveBuilder}>
        <div className="section-heading">
          <div>
            <span className="eyebrow">{t("instructor.courseBuilder")}</span>
            <h2>{draft.title || t("instructor.untitledCourse")}</h2>
            <p>{t("instructor.manageCreatedCourses")}</p>
          </div>
          <div className="form-actions compact">
            <button type="button" className="secondary-btn" onClick={() => navigateTo(ROUTES.instructor.courses)}>
              {t("common.cancel")}
            </button>
            <button type="button" className="secondary-btn danger-text" onClick={() => void archiveCourse()} disabled={saving}>
              {t("instructor.archiveCourse")}
            </button>
            <button type="submit" className="primary-btn" disabled={saving}>
              {saving ? t("common.saving") : t("common.save")}
            </button>
          </div>
        </div>

        <div className="community-form-grid">
          <label>
            {t("common.courseTitle")}
            <input value={draft.title} onChange={(event) => updateCourseField("title", event.target.value)} required />
          </label>
          <label>
            {t("common.status")}
            <select value={draft.status} onChange={(event) => updateCourseField("status", event.target.value)}>
              <option value="draft">{t("status.draft")}</option>
              <option value="published">{t("status.published")}</option>
              <option value="archived">{t("status.archived")}</option>
            </select>
          </label>
          <label className="wide-field">
            {t("common.courseImageUrl")}
            <input value={draft.imageUrl} onChange={(event) => updateCourseField("imageUrl", event.target.value)} placeholder="https://..." />
          </label>
          <label className="wide-field">
            {t("common.description")}
            <textarea rows="3" value={draft.description} onChange={(event) => updateCourseField("description", event.target.value)} required />
          </label>
        </div>

        <div className="section-heading">
          <div>
            <span className="eyebrow">{t("common.classes")}</span>
            <h3>{t("instructor.classesAndLessons")}</h3>
            <p>{t("instructor.classesAndLessonsHelp")}</p>
          </div>
          <button type="button" className="secondary-btn" onClick={addClass}>
            {t("instructor.addClass")}
          </button>
        </div>

        {!classes.length ? <small className="field-note">{t("instructor.noClassesYet")}</small> : null}
        {classes.map((courseClass) => {
          const classModules = safeArray(draft.modules).filter((module) => String(module.class_id || module.classId) === String(courseClass.id));
          return (
            <article key={courseClass.id} className="class-card">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">{t("common.class")}</span>
                  <input value={courseClass.title} onChange={(event) => updateClass(courseClass.id, "title", event.target.value)} />
                </div>
                <div className="form-actions compact">
                  <Status status={courseClass.status || "published"} />
                  <button type="button" className="secondary-btn" onClick={() => addLesson(courseClass.id)}>
                    {t("instructor.addLesson")}
                  </button>
                </div>
              </div>
              <label>
                {t("common.description")}
                <textarea rows="2" value={courseClass.description || ""} onChange={(event) => updateClass(courseClass.id, "description", event.target.value)} />
              </label>

              <div className="module-stack">
                {!classModules.length ? <small className="field-note">{t("instructor.noLessonsYet")}</small> : null}
                {classModules.map((module) => (
                  <article key={module.id} className="module-card">
                    <div className="community-form-grid">
                      <label>
                        {t("common.lessonTitle")}
                        <input value={module.title || ""} onChange={(event) => updateModule(module.id, "title", event.target.value)} />
                      </label>
                      <label>
                        {t("common.status")}
                        <select value={module.status || "published"} onChange={(event) => updateModule(module.id, "status", event.target.value)}>
                          <option value="draft">{t("status.draft")}</option>
                          <option value="published">{t("status.published")}</option>
                          <option value="archived">{t("status.archived")}</option>
                        </select>
                      </label>
                      <label className="wide-field">
                        {t("common.description")}
                        <textarea rows="2" value={module.description || ""} onChange={(event) => updateModule(module.id, "description", event.target.value)} />
                      </label>
                      <label className="wide-field">
                        {t("instructor.lessonContent")}
                        <textarea rows="4" value={module.lessonContent || module.lesson_content || ""} onChange={(event) => updateModule(module.id, "lessonContent", event.target.value)} />
                      </label>
                      <label>
                        {t("common.pdfUrl")}
                        <input value={module.pdfUrl || module.pdf_url || ""} onChange={(event) => updateModule(module.id, "pdfUrl", event.target.value)} />
                        <span className="upload-control compact-upload">
                          {t("common.uploadPdf")}
                          <input type="file" accept={PDF_ACCEPT} onChange={(event) => void uploadLessonResource(module.id, event.target.files?.[0], "pdf")} />
                        </span>
                        {uploadingKey === `${module.id}:pdf` ? <small className="field-note">{t("common.uploadingPdf")}</small> : null}
                      </label>
                      <label>
                        {t("common.videoUrl")}
                        <input value={module.videoUrl || module.video_url || ""} onChange={(event) => updateModule(module.id, "videoUrl", event.target.value)} />
                        <span className="upload-control compact-upload">
                          {t("common.uploadVideo")}
                          <input type="file" accept={VIDEO_ACCEPT} onChange={(event) => void uploadLessonResource(module.id, event.target.files?.[0], "video")} />
                        </span>
                        {uploadingKey === `${module.id}:video` ? <small className="field-note">{t("common.uploadingVideo")}</small> : null}
                      </label>
                      <label>
                        {t("common.embedUrl")}
                        <input value={module.embedUrl || module.embed_url || ""} onChange={(event) => updateModule(module.id, "embedUrl", event.target.value)} />
                      </label>
                      <label>
                        {t("common.imageUrl")}
                        <input value={module.imageUrl || module.image_url || ""} onChange={(event) => updateModule(module.id, "imageUrl", event.target.value)} />
                        <span className="upload-control compact-upload">
                          {t("common.uploadImage")}
                          <input type="file" accept={IMAGE_ACCEPT} onChange={(event) => void uploadLessonResource(module.id, event.target.files?.[0], "image")} />
                        </span>
                      </label>
                      <label className="toggle-row">
                        <input type="checkbox" checked={Boolean(module.requiresAssignment || module.requires_assignment)} onChange={(event) => updateModule(module.id, "requiresAssignment", event.target.checked)} />
                        {t("common.requiresAssignment")}
                      </label>
                      {module.requiresAssignment || module.requires_assignment ? (
                        <label className="wide-field">
                          {t("common.assignmentInstructions")}
                          <textarea rows="3" value={module.assignmentInstructions || module.assignment_instructions || ""} onChange={(event) => updateModule(module.id, "assignmentInstructions", event.target.value)} />
                        </label>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            </article>
          );
        })}
      </form>
      {message ? <small className="field-note success-text">{message}</small> : null}
      <InstructorError error={error} language={language} />
    </section>
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
  const { t, language } = useLanguage();
  const [courses, setCourses] = useState([]);
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [coursesError, setCoursesError] = useState(null);
  const routeState = getInstructorCourseRouteState(pathname);

  const reloadCourses = async () => {
    if (!currentUser?.id) return [];
    setLoadingCourses(true);
    setCoursesError(null);
    try {
      const nextCourses = await getInstructorCourses(currentUser.id);
      setCourses(nextCourses);
      return nextCourses;
    } catch (caughtError) {
      console.error("Loading instructor courses failed:", caughtError);
      setCoursesError({
        message: buildUserFacingError(caughtError, t("instructor.coursesLoadFailed"), {
          setupMessage: t("instructor.courseOwnershipSetupRequired"),
        }),
        details: sanitizeErrorDetails(caughtError),
      });
      return [];
    } finally {
      setLoadingCourses(false);
    }
  };

  useEffect(() => {
    void reloadCourses();
  }, [currentUser?.id]);

  const selectedCourse = useMemo(
    () => courses.find((course) => String(course.id) === String(routeState.courseId)) ?? null,
    [courses, routeState.courseId],
  );

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

  if (routeState.view === "create") {
    return <InstructorCourseForm currentUser={currentUser} reloadCourses={reloadCourses} />;
  }

  if (routeState.view === "builder") {
    return <InstructorCourseBuilder course={selectedCourse} currentUser={currentUser} reloadCourses={reloadCourses} />;
  }

  if (pathname === ROUTES.instructor.courses) {
    return <InstructorCourseManager courses={courses} loading={loadingCourses} error={coursesError} reload={() => void reloadCourses()} t={t} language={language} />;
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

  return <InstructorDashboard courses={courses} currentUser={currentUser} />;
}
