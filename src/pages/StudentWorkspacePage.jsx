import React, { useEffect, useState } from "react";
import { CertificateModal, Icon, Progress, Stat, Status, Welcome } from "../components/ui.jsx";
import { ROUTES } from "../routes/appRoutes.js";
import { getStudentSubmission, submitAssignment } from "../services/assignmentService.js";
import { getStudentCourseAccess } from "../services/courseService.js";
import { uploadAssignmentFile } from "../services/storageService.js";

function goTo(pathname) {
  window.history.pushState({}, "", pathname);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

function getCourseModules(course) {
  return Array.isArray(course?.modules) ? course.modules : [];
}

function formatSubmissionType(submissionType) {
  const value = submissionType || "text";
  if (value === "text_and_file") return "Text and file";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function StudentWorkspacePage({
  pathname,
  studentId,
  courses,
  certificates,
  posts,
  progressState,
  onCreatePost,
  onUpdateProgress,
}) {
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
      return (
        <section className="section-card">
          <span className="eyebrow">COURSE DETAIL</span>
          <h2>Loading course...</h2>
          <p>Checking Maya Laurent&apos;s enrollment and the selected course record.</p>
        </section>
      );
    }

    return (
      <>
        {detailState.reason === "missing-id" ? (
          <section className="section-card">
            <span className="eyebrow">COURSE DETAIL</span>
            <h2>Course id missing.</h2>
            <p>The selected course link does not include a valid course id.</p>
          </section>
        ) : detailState.reason === "missing-enrollment" ? (
          <section className="section-card">
            <span className="eyebrow">COURSE DETAIL</span>
            <h2>Course not assigned.</h2>
            <p>Maya Laurent is not enrolled in this exact course id.</p>
          </section>
        ) : detailState.reason === "not-published" ? (
          <section className="section-card">
            <span className="eyebrow">COURSE DETAIL</span>
            <h2>Course not published.</h2>
            <p>This course is currently hidden from the student workspace.</p>
          </section>
        ) : detailState.reason === "missing-student" ? (
          <section className="section-card">
            <span className="eyebrow">COURSE DETAIL</span>
            <h2>Student account missing.</h2>
            <p>The Maya Laurent demo student could not be resolved.</p>
          </section>
        ) : detailState.reason === "load-error" && !selectedCourse ? (
          <section className="section-card">
            <span className="eyebrow">COURSE DETAIL</span>
            <h2>Course detail failed to load.</h2>
            <p>The selected course could not be loaded right now.</p>
          </section>
        ) : selectedCourse ? (
          <StudentModuleDetail
            course={selectedCourse}
            studentId={studentId}
            completed={progressState}
            onUpdateProgress={onUpdateProgress}
            progress={progressFor(selectedCourse)}
          />
        ) : (
          <section className="section-card">
            <span className="eyebrow">COURSE DETAIL</span>
            <h2>Course detail failed to load.</h2>
            <p>The selected course record could not be resolved.</p>
          </section>
        )}
      </>
    );
  }

  if (pathname === "/student/certificates") {
    return (
      <>
        {previewCertificate && (
          <CertificateModal certificate={previewCertificate} onClose={() => setPreviewCertificate(null)} />
        )}
        <StudentCertificatesPage certificates={studentCertificates} onPreview={setPreviewCertificate} />
      </>
    );
  }

  if (pathname === "/student/community") {
    return <CommunityPage posts={posts} onCreatePost={onCreatePost} />;
  }

  if (pathname === "/student/courses") {
    return <OwnedCoursesPage courses={ownedCourses} progressFor={progressFor} />;
  }

  return <StudentDashboardPage courses={ownedCourses} certificates={studentCertificates} progressFor={progressFor} />;
}

function StudentDashboardPage({ courses, certificates, progressFor }) {
  const average = courses.length
    ? Math.round(courses.reduce((sum, course) => sum + progressFor(course), 0) / courses.length)
    : 0;

  return (
    <>
      <Welcome title="Welcome back, Maya." text="Keep learning and watch your progress grow." />
      <div className="stats-grid student-stats">
        <Stat icon="courses" label="Owned courses" value={courses.length} note="In your learning area" />
        <Stat icon="dashboard" label="Average progress" value={`${average}%`} note="Across owned courses" />
        <Stat icon="certificate" label="Certificates" value={certificates.length} note="Issued to you" />
      </div>
      <section className="section-card">
        <div className="section-heading">
          <div>
            <span className="eyebrow">CONTINUE LEARNING</span>
            <h2>Your courses</h2>
          </div>
        </div>
        <div className="mini-course-grid">
          {courses.map((course, index) => (
            <article key={course.id}>
              <div className="course-index">{String(index + 1).padStart(2, "0")}</div>
              <h3>{course.title}</h3>
              <Progress value={progressFor(course)} />
              <span>{progressFor(course)}% complete</span>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}

function OwnedCoursesPage({ courses, progressFor }) {
  return (
    <>
      <div className="page-intro">
        <div>
          <span className="eyebrow">MY LEARNING</span>
          <h2>Courses you own</h2>
          <p>Only courses assigned to your student account appear here.</p>
        </div>
      </div>
      <div className="owned-grid">
        {courses.map((course, index) => {
          const progress = progressFor(course);
          const modules = getCourseModules(course);

          return (
            <article className="owned-card" key={course.id}>
              <div className={`course-cover cover-${index + 1}`}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <Icon name="courses" size={34} />
              </div>
              <div className="owned-body">
                <span className="eyebrow">{modules.length} MODULES</span>
                <h3>{course.title}</h3>
                <p>{course.description}</p>
                <div className="progress-label">
                  <span>Course progress</span>
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
                  Continue course <Icon name="arrow" />
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
  const modules = getCourseModules(course);
  const [activeModuleId, setActiveModuleId] = useState(modules[0]?.id || null);
  const [viewError, setViewError] = useState("");
  const [assignmentState, setAssignmentState] = useState({
    loading: false,
    error: "",
    submission: null,
    textResponse: "",
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
  const activeAssignment = activeModule?.assignment ?? null;

  useEffect(() => {
    let cancelled = false;

    const loadSubmission = async () => {
      if (!activeAssignment?.id || !studentId) {
        if (!cancelled) {
          setAssignmentState({
            loading: false,
            error: "",
            submission: null,
            textResponse: "",
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
          textResponse: "",
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
            textResponse: submission?.textResponse || "",
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
            textResponse: "",
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
          ‹ Back to courses
        </button>

        <section className="section-card">
          <span className="eyebrow">COURSE DETAIL</span>
          <h2>This course is not currently available.</h2>
          <p>The course is currently hidden from the student workspace.</p>
        </section>
      </>
    );
  }

  const pdfSource = activeModule?.pdf_url || activeModule?.pdfUrl || "";
  const videoSource = activeModule?.video_url || activeModule?.videoUrl || "";
  const pdfLabel = activeModule?.pdfLabel || activeModule?.pdfName || "No PDF selected";
  const videoLabel =
    activeModule?.videoName || activeModule?.video?.uploadLabel || activeModule?.video?.link || "No video selected";
  const assignmentType = activeAssignment?.submissionType || activeAssignment?.submission_type || "text";
  const assignmentStatus = assignmentState.submission?.status || "";
  const hasSubmission = Boolean(assignmentState.submission);
  const assignmentHasGrade =
    assignmentState.submission?.grade !== null && assignmentState.submission?.grade !== undefined;
  const assignmentApprovedForCompletion =
    assignmentStatus === "approved" ||
    (assignmentHasGrade && assignmentStatus !== "needs_revision" && assignmentStatus !== "rejected");
  const hasPdfRequirement = Boolean(
    pdfSource || (activeModule?.pdfLabel && activeModule.pdfLabel !== "No PDF selected") || activeModule?.pdfName,
  );
  const hasVideoRequirement = Boolean(
    videoSource ||
      (activeModule?.video?.uploadLabel && activeModule.video.uploadLabel !== "No video selected") ||
      activeModule?.videoName,
  );
  const hasAssignmentRequirement = Boolean(activeAssignment?.id);
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

    const submissionType = activeAssignment.submissionType || activeAssignment.submission_type || "text";
    const needsText = submissionType === "text" || submissionType === "text_and_file";
    const needsFile = submissionType === "file" || submissionType === "text_and_file";
    const textResponse = assignmentState.textResponse.trim();
    const existingSubmission = assignmentState.submission;

    if (needsText && !textResponse) {
      setAssignmentState((current) => ({
        ...current,
        submitError: "A text response is required for this assignment.",
        submitMessage: "",
      }));
      return;
    }

    if (needsFile && !assignmentState.selectedFile && !existingSubmission?.fileUrl) {
      setAssignmentState((current) => ({
        ...current,
        submitError: "A file upload is required for this assignment.",
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
      let filePublicUrl = existingSubmission?.filePublicUrl || existingSubmission?.fileUrl || "";
      let fileName = existingSubmission?.fileName || "";
      let fileStoragePath = existingSubmission?.fileStoragePath || "";
      let fileType = existingSubmission?.fileType || "";
      let fileSize = existingSubmission?.fileSize ?? null;

      if (assignmentState.selectedFile) {
        const uploaded = await uploadAssignmentFile(assignmentState.selectedFile);
        filePublicUrl = uploaded.publicUrl || "";
        fileName = uploaded.fileName || assignmentState.selectedFile.name;
        fileStoragePath = uploaded.storagePath || "";
        fileType = uploaded.fileType || assignmentState.selectedFile.type || "";
        fileSize = uploaded.fileSize ?? assignmentState.selectedFile.size ?? null;
      }

      const savedSubmission = await submitAssignment(activeAssignment.id, studentId, {
        textResponse,
        filePublicUrl,
        fileName,
        fileStoragePath,
        fileType,
        fileSize,
      });

      const submitMessage = !existingSubmission
        ? "Assignment submitted."
        : existingSubmission.status === "needs_revision" || existingSubmission.status === "rejected"
          ? "Assignment resubmitted."
          : "Assignment updated.";

      setAssignmentState({
        loading: false,
        error: "",
        submission: savedSubmission,
        textResponse: savedSubmission?.textResponse || textResponse,
        selectedFile: null,
        selectedFileName: savedSubmission?.fileName || fileName,
        submitMessage,
        submitError: "",
        uploading: false,
      });
    } catch (error) {
      console.error("Submitting the assignment failed:", error);
      setAssignmentState((current) => ({
        ...current,
        uploading: false,
        submitError: error.message || "Submitting the assignment failed.",
        submitMessage: "",
      }));
    }
  };

  if (!modules.length) {
    return (
      <>
        <button className="back-button" onClick={() => goTo(ROUTES.student.courses)}>
          ‹ Back to courses
        </button>

        <div className="detail-hero">
          <div>
            <span className="eyebrow">OWNED COURSE</span>
            <h2>{course.title}</h2>
            <p>{course.description}</p>
          </div>
          <div className="hero-progress">
            <strong>{progress}%</strong>
            <span>Course progress</span>
            <Progress value={progress} />
          </div>
        </div>

        <section className="section-card">
          <span className="eyebrow">COURSE MODULES</span>
          <h2>No modules available for this course yet</h2>
          <p>The course has been created, but no modules are available to view yet.</p>
        </section>
      </>
    );
  }

  const canEditAssignment =
    !hasSubmission ||
    assignmentStatus === "submitted" ||
    assignmentStatus === "needs_revision" ||
    assignmentStatus === "rejected";
  const assignmentButtonLabel = assignmentState.uploading
    ? "Submitting..."
    : !hasSubmission
      ? "Submit assignment"
      : assignmentStatus === "approved"
        ? "Assignment approved"
        : assignmentStatus === "needs_revision" || assignmentStatus === "rejected"
          ? "Resubmit assignment"
          : "Update submission";

  return (
    <>
      <button className="back-button" onClick={() => goTo(ROUTES.student.courses)}>
        ‹ Back to courses
      </button>

      <div className="detail-hero">
        <div>
          <span className="eyebrow">OWNED COURSE</span>
          <h2>{course.title}</h2>
          <p>{course.description}</p>
        </div>
        <div className="hero-progress">
          <strong>{progress}%</strong>
          <span>Course progress</span>
          <Progress value={progress} />
        </div>
      </div>

      <div className="course-detail-layout">
        <aside className="module-list">
          <div className="module-title">
            <span className="eyebrow">COURSE MODULES</span>
            <h3>{modules.length} modules</h3>
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
          <div className="video-stage">
            <div className="play-large">
              <Icon name="courses" size={28} />
            </div>
            <span>Module assets</span>
          </div>

          <span className="eyebrow">CURRENT MODULE</span>
          <h2>{activeModule?.title || "Select a module"}</h2>
          <p>{activeModule?.description || "This module description will appear here for students."}</p>

          {viewError && <small className="field-note danger-text">{viewError}</small>}

          <div className="module-assets">
            <div className="lesson-meta">
              <span className="subtle-badge">PDF</span>
              <span>{pdfLabel}</span>
            </div>

            {pdfSource ? (
              <div className="row-actions">
                <a href={pdfSource} target="_blank" rel="noreferrer" onClick={() => markSeen(`pdf-${activeModule.id}`)}>
                  Open PDF
                </a>
              </div>
            ) : activeModule?.pdfLabel && activeModule.pdfLabel !== "No PDF selected" ? (
              <small className="field-note danger-text">File name exists, but file URL is missing.</small>
            ) : activeModule?.pdfName ? (
              <small className="field-note danger-text">File name exists, but file URL is missing.</small>
            ) : (
              <small className="field-note">No PDF uploaded yet.</small>
            )}

            <div className="lesson-meta">
              <span className="subtle-badge">Video</span>
              <span>{videoLabel}</span>
            </div>

            {videoSource ? (
              <div className="video-player-shell">
                <video
                  controls
                  width="100%"
                  src={videoSource}
                  onPlay={() => markSeen(`video-${activeModule.id}`)}
                  onError={() => {
                    console.error("Video playback failed for module:", activeModule?.id, videoSource);
                    setViewError("The uploaded video could not be viewed.");
                  }}
                />
              </div>
            ) : activeModule?.video?.uploadLabel && activeModule.video.uploadLabel !== "No video selected" ? (
              <small className="field-note danger-text">File name exists, but file URL is missing.</small>
            ) : activeModule?.videoName ? (
              <small className="field-note danger-text">File name exists, but file URL is missing.</small>
            ) : (
              <small className="field-note">No video uploaded yet.</small>
            )}
          </div>

          {activeAssignment ? (
            <section className="section-card assignment-card">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">MODULE ASSIGNMENT</span>
                  <h2>{activeAssignment.title}</h2>
                  <p>{activeAssignment.instructions}</p>
                </div>
              </div>

              <div className="assignment-chip-row">
                <span className="subtle-badge">Submission type: {formatSubmissionType(assignmentType)}</span>
                {activeAssignment.dueDate || activeAssignment.due_date ? (
                  <span className="subtle-badge">Due: {activeAssignment.dueDate || activeAssignment.due_date}</span>
                ) : null}
                {assignmentState.submission?.status ? <Status status={assignmentState.submission.status} /> : null}
              </div>

              {assignmentState.loading && <small className="field-note">Loading your submission...</small>}
              {assignmentState.error && <small className="field-note danger-text">{assignmentState.error}</small>}
              {assignmentState.submitMessage && <small className="field-note">{assignmentState.submitMessage}</small>}
              {assignmentState.submitError && (
                <small className="field-note danger-text">{assignmentState.submitError}</small>
              )}

              {(assignmentType === "text" || assignmentType === "text_and_file") && (
                <label>
                  Text response
                  <textarea
                    rows="5"
                    value={assignmentState.textResponse}
                    disabled={!canEditAssignment || assignmentState.loading || assignmentState.uploading}
                    onChange={(event) =>
                      setAssignmentState((current) => ({
                        ...current,
                        textResponse: event.target.value,
                        submitError: "",
                        submitMessage: "",
                      }))
                    }
                    placeholder="Write your assignment response here."
                  />
                </label>
              )}

              {(assignmentType === "file" || assignmentType === "text_and_file") && (
                <label>
                  Upload file
                  <input
                    type="file"
                    disabled={!canEditAssignment || assignmentState.loading || assignmentState.uploading}
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
              )}

              {assignmentState.selectedFileName ? (
                <small className="field-note">Selected file: {assignmentState.selectedFileName}</small>
              ) : null}

              {assignmentState.submission?.fileUrl ? (
                <a className="assignment-link" href={assignmentState.submission.fileUrl} target="_blank" rel="noreferrer">
                  Open submitted file
                </a>
              ) : null}

              <div className="assignment-meta">
                <p>
                  <strong>Grade:</strong>{" "}
                  {assignmentState.submission?.grade === null || assignmentState.submission?.grade === undefined
                    ? "Not graded yet."
                    : `${assignmentState.submission.grade}/100`}
                </p>
                <p>
                  <strong>Feedback:</strong>{" "}
                  {assignmentState.submission?.adminFeedback ||
                    assignmentState.submission?.admin_feedback ||
                    "No feedback yet."}
                </p>
              </div>

              {assignmentStatus === "needs_revision" ? (
                <small className="field-note">This assignment needs revision. You can update and resubmit it.</small>
              ) : assignmentStatus === "approved" ? (
                <small className="field-note">This assignment has been approved. Editing is disabled.</small>
              ) : assignmentStatus === "rejected" ? (
                <small className="field-note">This assignment was rejected. Update your work and resubmit it.</small>
              ) : assignmentStatus === "submitted" ? (
                <small className="field-note">Your submission is saved. You can update it until it is reviewed.</small>
              ) : null}

              <div className="form-actions compact">
                <button
                  type="button"
                  className="primary-btn"
                  disabled={!canEditAssignment || assignmentState.uploading || assignmentState.loading}
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
              {!hasPdfRequirement ? "No PDF required" : pdfSeen ? "PDF viewed" : "PDF pending"}
            </span>
            <span className={videoRequirementMet ? "subtle-badge" : "count-badge"}>
              {!hasVideoRequirement ? "No video required" : videoSeen ? "Video viewed" : "Video pending"}
            </span>
            {hasAssignmentRequirement ? (
              <span className={assignmentRequirementMet ? "subtle-badge" : "count-badge"}>
                {assignmentStatus === "approved"
                  ? "Assignment approved"
                  : assignmentStatus === "needs_revision"
                    ? "Assignment needs revision"
                    : assignmentStatus === "rejected"
                      ? "Assignment rejected"
                      : assignmentApprovedForCompletion
                        ? "Assignment reviewed"
                        : hasSubmission
                          ? "Assignment pending review"
                          : "Assignment pending"}
              </span>
            ) : (
              <span className="subtle-badge">No assignment required</span>
            )}
          </div>

          {!canComplete ? (
            <small className="field-note danger-text">
              Complete the PDF, video, and assignment requirements before marking this module complete.
            </small>
          ) : null}

          <button
            className={moduleDone ? "complete-btn done" : "complete-btn"}
            onClick={toggleModule}
            disabled={!activeModule || !canComplete}
          >
            <Icon name="check" />
            {moduleDone ? "Module marked complete" : "Mark module complete"}
          </button>
        </section>
      </div>
    </>
  );
}

function StudentCertificatesPage({ certificates, onPreview }) {
  return (
    <>
      <div className="page-intro">
        <div>
          <span className="eyebrow">MY ACHIEVEMENTS</span>
          <h2>Your certificates</h2>
          <p>Certificates generated for your completed courses.</p>
        </div>
      </div>
      <div className="certificate-grid">
        {certificates.map((certificate) => (
          <article key={certificate.id}>
            <div className="cert-ribbon">
              <Icon name="certificate" size={30} />
            </div>
            <span className="eyebrow">CERTIFICATE OF COMPLETION</span>
            <h3>{certificate.course}</h3>
            <dl>
              <div>
                <dt>Certificate number</dt>
                <dd>{certificate.number}</dd>
              </div>
              <div>
                <dt>Issue date</dt>
                <dd>{certificate.issueDate}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>
                  <Status status={certificate.status} />
                </dd>
              </div>
            </dl>
            <button className="secondary-btn" onClick={() => onPreview(certificate)}>
              Preview certificate
            </button>
          </article>
        ))}
      </div>
    </>
  );
}

function CommunityPage({ posts, onCreatePost }) {
  const [form, setForm] = useState({ title: "", body: "" });

  const submit = (event) => {
    event.preventDefault();
    void onCreatePost({ author: "Maya Laurent", initials: "ML", title: form.title, body: form.body });
    setForm({ title: "", body: "" });
  };

  return (
    <div className="community-layout">
      <section>
        <div className="page-intro">
          <div>
            <span className="eyebrow">STUDENT COMMUNITY</span>
            <h2>Recent discussions</h2>
            <p>Share ideas with other Nutripro students.</p>
          </div>
        </div>
        <div className="post-list">
          {posts.map((post) => (
            <article key={post.id}>
              <div className="post-avatar">{post.initials}</div>
              <div>
                <div className="post-meta">
                  <strong>{post.author}</strong>
                  <span>{post.time}</span>
                </div>
                <h3>{post.title}</h3>
                <p>{post.body}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <form className="section-card post-form" onSubmit={submit}>
        <span className="eyebrow">NEW DISCUSSION</span>
        <h2>Create a post</h2>

        <label>
          Post title
          <input
            required
            value={form.title}
            onChange={(event) => setForm({ ...form, title: event.target.value })}
            placeholder="What would you like to discuss?"
          />
        </label>

        <label>
          Your post
          <textarea
            required
            rows="6"
            value={form.body}
            onChange={(event) => setForm({ ...form, body: event.target.value })}
            placeholder="Share a thought or question..."
          />
        </label>

        <button className="primary-btn" type="submit">
          <Icon name="plus" />
          Publish post
        </button>
      </form>
    </div>
  );
}
