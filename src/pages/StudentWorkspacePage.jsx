import React, { useEffect, useState } from "react";
import { CertificateModal, Icon, Progress, Stat, Status, Welcome } from "../components/ui.jsx";
import { ROUTES } from "../routes/appRoutes.js";
import { getStudentSubmission, submitAssignment } from "../services/assignmentService.js";
import { getStudentCourseAccess } from "../services/courseService.js";
import { uploadAssignmentFile, uploadProfilePicture } from "../services/storageService.js";
import { useLanguage } from "../i18n/LanguageContext.jsx";

function goTo(pathname) {
  window.history.pushState({}, "", pathname);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

function getCourseModules(course) {
  return Array.isArray(course?.modules) ? course.modules : [];
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

function isDirectVideoSource(url) {
  const normalizedUrl = `${url ?? ""}`.trim().toLowerCase();
  if (!normalizedUrl) return false;
  return (
    normalizedUrl.includes("/storage/v1/object/public/") ||
    normalizedUrl.endsWith(".mp4") ||
    normalizedUrl.endsWith(".mov") ||
    normalizedUrl.endsWith(".webm") ||
    normalizedUrl.includes(".mp4?") ||
    normalizedUrl.includes(".mov?") ||
    normalizedUrl.includes(".webm?")
  );
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
  onCreatePost,
  onCreateComment,
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
  const isCourseDetailRoute = pathname.startsWith("/student/courses/");
  const routeCourseId = isCourseDetailRoute ? `${pathname.split("/").pop() ?? ""}`.trim() : "";

  const progressFor = (course) => {
    const modules = getCourseModules(course);
    return modules.length
      ? Math.round((modules.filter((module) => progressState[`module-${module.id}`]).length / modules.length) * 100)
      : 0;
  };

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
  }, [isCourseDetailRoute, ownedCourses, routeCourseId, studentId]);

  if (isCourseDetailRoute) {
    const selectedCourse = detailState.course ?? ownedCourses.find((entry) => String(entry?.id) === routeCourseId) ?? null;

    if (detailState.loading && !selectedCourse) {
      return <StudentCourseState eyebrow={t("student.courseDetail")} title={t("student.loadingCourse")} text={t("student.checkingEnrollment")} />;
    }

    return (
      <>
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
        <StudentCertificatesPage certificates={studentCertificates} onPreview={setPreviewCertificate} />
      </>
    );
  }

  if (pathname === ROUTES.student.community) {
    return <CommunityPage posts={posts} studentProfile={studentProfile} onCreatePost={onCreatePost} onCreateComment={onCreateComment} />;
  }

  if (pathname === ROUTES.student.courses) {
    return <OwnedCoursesPage courses={ownedCourses} progressFor={progressFor} />;
  }

  return <StudentDashboardPage courses={ownedCourses} certificates={studentCertificates} progressFor={progressFor} />;
}

function StudentDashboardPage({ courses, certificates, progressFor }) {
  const { t } = useLanguage();
  const average = courses.length
    ? Math.round(courses.reduce((sum, course) => sum + progressFor(course), 0) / courses.length)
    : 0;

  return (
    <>
      <Welcome title={t("dashboard.studentWelcomeTitle")} text={t("dashboard.studentWelcomeText")} />
      <div className="stats-grid student-stats">
        <Stat icon="courses" label={t("dashboard.ownedCourses")} value={courses.length} note={t("dashboard.inYourLearningArea")} />
        <Stat icon="dashboard" label={t("dashboard.averageProgress")} value={`${average}%`} note={t("dashboard.acrossOwnedCourses")} />
        <Stat icon="certificate" label={t("common.certificates")} value={certificates.length} note={t("dashboard.issuedToYou")} />
      </div>
      <section className="section-card">
        <div className="section-heading">
          <div>
            <span className="eyebrow">{t("dashboard.continueLearning")}</span>
            <h2>{t("dashboard.yourCourses")}</h2>
          </div>
        </div>
        <div className="mini-course-grid">
          {courses.map((course, index) => (
            <article key={course.id}>
              <div className="course-index">{String(index + 1).padStart(2, "0")}</div>
              <h3>{course.title}</h3>
              <Progress value={progressFor(course)} />
              <span>{t("dashboard.completePercent", { value: progressFor(course) })}</span>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}

function StudentProfilePage({ profile, onUpdateProfile }) {
  const { t } = useLanguage();
  const [form, setForm] = useState({
    name: profile?.name || "",
    email: profile?.email || "",
    country: profile?.country || "",
    bio: profile?.bio || "",
    profilePictureUrl: profile?.profilePictureUrl || profile?.profile_picture_url || "",
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    setForm({
      name: profile?.name || "",
      email: profile?.email || "",
      country: profile?.country || "",
      bio: profile?.bio || "",
      profilePictureUrl: profile?.profilePictureUrl || profile?.profile_picture_url || "",
    });
  }, [profile]);

  const saveProfile = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const result = await onUpdateProfile({
        name: form.name,
        country: form.country,
        bio: form.bio,
        profile_picture_url: form.profilePictureUrl,
      });

      if (!result?.ok) throw new Error(result?.error || t("student.savingProfileFailed"));
      setMessage(t("student.profileSaved"));
    } catch (saveError) {
      console.error("Saving student profile failed:", saveError);
      setError(saveError.message || t("student.savingProfileFailed"));
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
      setError(uploadError.message || t("student.profilePictureUploadFailed"));
    } finally {
      setUploading(false);
    }
  };

  const avatarLabel = initialsFromName(form.name || profile?.name || "Maya Laurent");

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
            <p>{form.email || profile?.email || "maya@nutripro.demo"}</p>
            {form.country ? <span className="subtle-badge">{form.country}</span> : null}
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
            <input value={form.country} onChange={(event) => setForm((current) => ({ ...current, country: event.target.value }))} placeholder={t("student.countryPlaceholder")} />
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
      </section>
    </div>
  );
}

function OwnedCoursesPage({ courses, progressFor }) {
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
      <div className="owned-grid">
        {courses.map((course, index) => {
          const progress = progressFor(course);
          const modules = getCourseModules(course);

          return (
            <article className="owned-card" key={course.id}>
              <CourseCover course={course} index={index} />
              <div className="owned-body">
                <span className="eyebrow">{t("dashboard.modulesCount", { count: modules.length })}</span>
                <h3>{course.title}</h3>
                <p>{course.description}</p>
                <div className="progress-label">
                  <span>{t("common.courseProgress")}</span>
                  <strong>{progress}%</strong>
                </div>
                <Progress value={progress} />
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

function StudentModuleDetail({ course, studentId, completed, onUpdateProgress, progress }) {
  const { t, language, translateSubmissionType } = useLanguage();
  const modules = getCourseModules(course);
  const [activeModuleId, setActiveModuleId] = useState(modules[0]?.id || null);
  const [viewError, setViewError] = useState("");
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

  console.log("selected course id on detail page:", course?.id);

  useEffect(() => {
    setActiveModuleId(modules[0]?.id || null);
    setViewError("");
  }, [course?.id, modules]);

  const activeModule = modules.find((module) => module.id === activeModuleId) || modules[0] || null;
  const assignmentRequired =
    activeModule?.requiresAssignment ?? activeModule?.requires_assignment ?? Boolean(activeModule?.assignment?.id);
  const activeAssignment = assignmentRequired ? activeModule?.assignment ?? null : null;

  useEffect(() => {
    let cancelled = false;

    const loadSubmission = async () => {
      if (!activeAssignment?.id || !studentId) {
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
            error: error.message || "Loading the assignment submission failed.",
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
  }, [activeAssignment?.id, studentId]);

  if (course?.status && course.status !== "published") {
    return (
      <>
        <button className="back-button" onClick={() => goTo(ROUTES.student.courses)}>
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

  const pdfSource = activeModule?.pdf_url || activeModule?.pdfUrl || "";
  const videoSource = activeModule?.video_url || activeModule?.videoUrl || "";
  const hasDirectVideoSource = isDirectVideoSource(videoSource);
  const pdfLabel = activeModule?.pdfLabel || activeModule?.pdfName || t("common.noPdfSelected");
  const videoLabel =
    activeModule?.videoName || activeModule?.video?.uploadLabel || activeModule?.video?.link || t("common.noVideoSelected");
  const assignmentType = "file";
  const assignmentStatus = assignmentState.submission?.status || "";
  const hasSubmission = Boolean(assignmentState.submission);
  const assignmentHasGrade =
    assignmentState.submission?.grade !== null && assignmentState.submission?.grade !== undefined;
  const assignmentApprovedForCompletion = assignmentStatus === "approved" || assignmentHasGrade;
  const hasPdfRequirement = Boolean(
    pdfSource || (activeModule?.pdfLabel && activeModule.pdfLabel !== t("common.noPdfSelected")) || activeModule?.pdfName,
  );
  const hasVideoRequirement = Boolean(
    videoSource ||
      (activeModule?.video?.uploadLabel && activeModule.video.uploadLabel !== t("common.noVideoSelected")) ||
      activeModule?.videoName,
  );
  const hasAssignmentRequirement = Boolean(assignmentRequired && activeAssignment?.id);
  const pdfSeen = activeModule ? completed[`pdf-${activeModule.id}`] : false;
  const videoSeen = activeModule ? completed[`video-${activeModule.id}`] : false;
  const moduleDone = activeModule ? completed[`module-${activeModule.id}`] : false;
  const pdfRequirementMet = !hasPdfRequirement || pdfSeen;
  const videoRequirementMet = !hasVideoRequirement || videoSeen;
  const assignmentRequirementMet = !hasAssignmentRequirement || (hasSubmission && assignmentApprovedForCompletion);
  const canComplete = pdfRequirementMet && videoRequirementMet && assignmentRequirementMet;

  const markSeen = (key) => {
    void onUpdateProgress({ [key]: true });
  };

  const toggleModule = () => {
    if (!activeModule || !canComplete) return;
    void onUpdateProgress({ [`module-${activeModule.id}`]: !completed[`module-${activeModule.id}`] });
  };

  const handleAssignmentSubmit = async () => {
    if (!activeAssignment?.id || !studentId) return;

    if (hasSubmission) {
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
    } catch (error) {
      console.error("Submitting the assignment failed:", error);
      setAssignmentState((current) => ({
        ...current,
        uploading: false,
        submitError: error.message || t("errors.submittingAssignmentFailed"),
        submitMessage: "",
      }));
    }
  };

  if (!modules.length) {
    return (
      <>
        <button className="back-button" onClick={() => goTo(ROUTES.student.courses)}>
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

  const isAssignmentLocked = hasSubmission;
  const assignmentButtonLabel = assignmentState.uploading
    ? t("common.submitting")
    : !hasSubmission
      ? t("common.submitAssignment")
      : assignmentStatus === "approved" ? t("common.assignmentApprovedButton") : t("common.assignmentAlreadySubmitted");

  return (
    <>
      <button className="back-button" onClick={() => goTo(ROUTES.student.courses)}>
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

      <div className="course-detail-layout">
        <aside className="module-list">
          <div className="module-title">
            <span className="eyebrow">{t("common.courseModules")}</span>
            <h3>{t("dashboard.modulesCount", { count: modules.length }).toLowerCase()}</h3>
          </div>

          {modules.map((module, index) => (
            <div className="module" key={module.id}>
              <button
                className={activeModule?.id === module.id ? "active" : ""}
                onClick={() => {
                  setActiveModuleId(module.id);
                  setViewError("");
                }}
              >
                <span className={`lesson-icon ${completed[`module-${module.id}`] ? "done" : ""}`}>
                  {completed[`module-${module.id}`] ? <Icon name="check" size={14} /> : <span>{index + 1}</span>}
                </span>
                <span>
                  <strong>{module.title}</strong>
                  <small>{module.description}</small>
                </span>
                <Icon name="chevron" size={16} />
              </button>
            </div>
          ))}
        </aside>

        <section className="lesson-content">
          <span className="eyebrow">{t("common.currentModule")}</span>
          <h2>{activeModule?.title || t("common.selectModule")}</h2>
          <p>{activeModule?.description || t("student.currentModuleDescriptionFallback")}</p>

          {viewError && <small className="field-note danger-text">{viewError}</small>}

          <div className="module-assets">
            <div className="lesson-meta">
              <span className="subtle-badge">PDF</span>
              <span>{pdfLabel}</span>
            </div>

            {pdfSource ? (
              <div className="row-actions">
                <a href={pdfSource} target="_blank" rel="noreferrer" onClick={() => markSeen(`pdf-${activeModule.id}`)}>
                  {t("common.openPdf")}
                </a>
              </div>
            ) : activeModule?.pdfLabel && activeModule.pdfLabel !== t("common.noPdfSelected") ? (
              <small className="field-note danger-text">{t("common.fileNameExistsButUrlMissing")}</small>
            ) : activeModule?.pdfName ? (
              <small className="field-note danger-text">{t("common.fileNameExistsButUrlMissing")}</small>
            ) : (
              <small className="field-note">{t("common.noPdfUploadedYet")}</small>
            )}

            <div className="lesson-meta">
              <span className="subtle-badge">Video</span>
              <span>{videoLabel}</span>
            </div>

            {videoSource && hasDirectVideoSource ? (
              <div className="video-player-shell">
                <video
                  controls
                  width="100%"
                  src={videoSource}
                  onPlay={() => markSeen(`video-${activeModule.id}`)}
                  onError={() => {
                    console.error("Video playback failed for module:", activeModule?.id, videoSource);
                    setViewError(t("errors.videoPlaybackFailed"));
                  }}
                />
              </div>
            ) : videoSource ? (
              <div className="row-actions">
                <a href={videoSource} target="_blank" rel="noreferrer" onClick={() => markSeen(`video-${activeModule.id}`)}>
                  {t("common.openVideo")}
                </a>
              </div>
            ) : activeModule?.video?.uploadLabel && activeModule.video.uploadLabel !== t("common.noVideoSelected") ? (
              <small className="field-note danger-text">{t("common.fileNameExistsButUrlMissing")}</small>
            ) : activeModule?.videoName ? (
              <small className="field-note danger-text">{t("common.fileNameExistsButUrlMissing")}</small>
            ) : (
              <small className="field-note">{t("common.noVideoUploadedYet")}</small>
            )}
          </div>

          {activeAssignment ? (
            <section className="section-card assignment-card">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">{t("common.moduleAssignment")}</span>
                  <h2>{activeAssignment.title}</h2>
                  <p>{activeAssignment.instructions}</p>
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

              <label>
                {t("common.uploadFile")}
                <input
                  type="file"
                  disabled={isAssignmentLocked || assignmentState.loading || assignmentState.uploading}
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

              {assignmentState.submission ? <small className="field-note">{t("common.assignmentLockedAfterSubmit")}</small> : null}

              <div className="form-actions compact">
                <button
                  type="button"
                  className="primary-btn"
                  disabled={isAssignmentLocked || assignmentState.uploading || assignmentState.loading}
                  onClick={() => void handleAssignmentSubmit()}
                >
                  <Icon name="check" />
                  {assignmentButtonLabel}
                </button>
              </div>
            </section>
          ) : null}

          <div className="progress-steps">
            <span className={pdfRequirementMet ? "subtle-badge" : "count-badge"}>
              {!hasPdfRequirement ? t("common.noPdfRequired") : pdfSeen ? t("common.pdfViewed") : t("common.pdfPending")}
            </span>
            <span className={videoRequirementMet ? "subtle-badge" : "count-badge"}>
              {!hasVideoRequirement ? t("common.noVideoRequired") : videoSeen ? t("common.videoViewed") : t("common.videoPending")}
            </span>
            {hasAssignmentRequirement ? (
              <span className={assignmentRequirementMet ? "subtle-badge" : "count-badge"}>
                {assignmentStatus === "approved"
                  ? t("common.assignmentApproved")
                  : assignmentStatus === "needs_revision"
                    ? t("common.assignmentNeedsRevision")
                    : assignmentStatus === "rejected"
                      ? t("common.assignmentRejected")
                      : assignmentApprovedForCompletion
                        ? t("common.assignmentReviewed")
                        : hasSubmission
                          ? t("common.assignmentPendingReview")
                          : t("common.assignmentPending")}
              </span>
            ) : (
              <span className="subtle-badge">{t("common.noAssignmentRequired")}</span>
            )}
          </div>

          {!canComplete ? (
            <small className="field-note danger-text">
              {t("common.completeRequirements")}
            </small>
          ) : null}

          <button
            className={moduleDone ? "complete-btn done" : "complete-btn"}
            onClick={toggleModule}
            disabled={!activeModule || !canComplete}
          >
            <Icon name="check" />
            {moduleDone ? t("common.moduleMarkedComplete") : t("common.markModuleComplete")}
          </button>
        </section>
      </div>
    </>
  );
}

function StudentCertificatesPage({ certificates, onPreview }) {
  const { t } = useLanguage();
  return (
    <>
      <div className="page-intro">
        <div>
          <span className="eyebrow">{t("student.myAchievements")}</span>
          <h2>{t("student.yourCertificates")}</h2>
          <p>{t("student.certificatesGeneratedForCompletedCourses")}</p>
        </div>
      </div>
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
              {t("common.previewCertificate")}
            </button>
          </article>
        ))}
      </div>
    </>
  );
}

function CommunityPage({ posts, studentProfile, onCreatePost, onCreateComment }) {
  const { t } = useLanguage();
  const [form, setForm] = useState({ title: "", body: "" });
  const [commentDrafts, setCommentDrafts] = useState({});

  const submit = (event) => {
    event.preventDefault();
    void onCreatePost({
      studentId: studentProfile?.id,
      studentProfile,
      author: studentProfile?.name || "Maya Laurent",
      title: form.title,
      body: form.body,
    });
    setForm({ title: "", body: "" });
  };

  const submitComment = (postId) => {
    const body = `${commentDrafts[postId] ?? ""}`.trim();
    if (!body) return;

    void onCreateComment(postId, {
      studentId: studentProfile?.id,
      studentProfile,
      author: studentProfile?.name || "Maya Laurent",
      body,
    });

    setCommentDrafts((current) => ({
      ...current,
      [postId]: "",
    }));
  };

  return (
    <div className="community-layout">
      <section>
        <div className="page-intro">
          <div>
            <span className="eyebrow">{t("student.studentCommunity")}</span>
            <h2>{t("student.recentDiscussions")}</h2>
            <p>{t("student.shareIdeas")}</p>
          </div>
        </div>
        <div className="post-list">
          {posts.map((post) => (
            <article key={post.id}>
              {post.profilePictureUrl || post.profile_picture_url ? (
                <img className="post-avatar avatar-image" src={post.profilePictureUrl || post.profile_picture_url} alt={post.author} />
              ) : (
                <div className="post-avatar">{post.initials}</div>
              )}
              <div>
                <div className="post-meta">
                  <strong>{post.author}</strong>
                  {post.country ? <span>{post.country}</span> : null}
                  <span>{post.time}</span>
                </div>
                <h3>{post.title}</h3>
                <p>{post.body}</p>

                <div className="community-comments">
                  {(post.comments ?? []).map((comment) => (
                    <div className="community-comment" key={comment.id}>
                      <div className="post-meta">
                        <strong>{comment.author}</strong>
                        {comment.country ? <span>{comment.country}</span> : null}
                        <span>{comment.time}</span>
                      </div>
                      <p>{comment.body}</p>
                    </div>
                  ))}
                </div>

                <div className="community-comment-form">
                  <textarea
                    rows="3"
                    value={commentDrafts[post.id] ?? ""}
                    onChange={(event) =>
                      setCommentDrafts((current) => ({
                        ...current,
                        [post.id]: event.target.value,
                      }))
                    }
                    placeholder={t("student.writeComment")}
                  />
                  <button className="secondary-btn" type="button" onClick={() => submitComment(post.id)}>
                    {t("student.publishComment")}
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <form className="section-card post-form" onSubmit={submit}>
        <span className="eyebrow">{t("student.newDiscussion")}</span>
        <h2>{t("student.createPost")}</h2>

        <label>
          {t("student.postTitle")}
          <input
            required
            value={form.title}
            onChange={(event) => setForm({ ...form, title: event.target.value })}
            placeholder={t("student.whatDiscuss")}
          />
        </label>

        <label>
          {t("student.yourPost")}
          <textarea
            required
            rows="6"
            value={form.body}
            onChange={(event) => setForm({ ...form, body: event.target.value })}
            placeholder={t("student.shareThought")}
          />
        </label>

        <button className="primary-btn" type="submit">
          <Icon name="plus" />
          {t("student.publishPost")}
        </button>
      </form>
    </div>
  );
}
