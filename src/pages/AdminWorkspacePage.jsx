import React, { useEffect, useState } from "react";
import { Icon, OverviewCard, Stat, Status, Welcome } from "../components/ui.jsx";
import {
  getSubmissionsForAdmin,
  reviewSubmission,
} from "../services/assignmentService.js";
import { uploadModulePdf, uploadModuleVideo } from "../services/storageService.js";

function createId() {
  return Date.now() + Math.floor(Math.random() * 100000);
}

function createAssignmentDraft() {
  return {
    id: null,
    title: "",
    instructions: "",
    submissionType: "text",
    submission_type: "text",
  };
}

function createModuleDraft(sortOrder = 1) {
  return {
    id: createId(),
    sortOrder,
    title: "",
    description: "",
    pdfUrl: "",
    pdf_url: "",
    pdfLabel: "No PDF selected",
    pdfName: "",
    pdf_file_name: "",
    pdfStoragePath: "",
    pdf_storage_path: "",
    pdfUploading: false,
    pdfError: "",
    videoUrl: "",
    video_url: "",
    videoName: "",
    video_file_name: "",
    videoStoragePath: "",
    video_storage_path: "",
    video: {
      id: createId(),
      title: "",
      description: "",
      duration: "10 min",
      link: "",
      url: "",
      uploadLabel: "No video selected",
      uploading: false,
      error: "",
    },
    assignment: null,
  };
}

function createCourseDraft(course = null) {
  if (!course) return { title: "", description: "", status: "published", modules: [createModuleDraft()] };

  return {
    title: course.title,
    description: course.description,
    status: course.status || "published",
    modules: course.modules.map((module, index) => ({
      id: module.id,
      sortOrder: module.sortOrder ?? index + 1,
      title: module.title,
      description: module.description,
      pdfUrl: module.pdf_url || module.pdfUrl || "",
      pdf_url: module.pdf_url || module.pdfUrl || "",
      pdfLabel: module.pdfLabel || "No PDF selected",
      pdfName: module.pdfName || module.pdf_file_name || module.pdfLabel || "",
      pdf_file_name: module.pdf_file_name || module.pdfName || module.pdfLabel || "",
      pdfStoragePath: module.pdf_storage_path || "",
      pdf_storage_path: module.pdf_storage_path || module.pdfStoragePath || "",
      pdfUploading: false,
      pdfError: "",
      videoUrl: module.video_url || module.videoUrl || module.video?.url || module.video?.link || "",
      video_url: module.video_url || module.videoUrl || module.video?.url || module.video?.link || "",
      videoName: module.videoName || module.video_file_name || module.video?.uploadLabel || "",
      video_file_name: module.video_file_name || module.videoName || module.video?.uploadLabel || "",
      videoStoragePath: module.video_storage_path || "",
      video_storage_path: module.video_storage_path || module.videoStoragePath || "",
      video: {
        id: module.video?.id || createId(),
        title: module.video?.title || "",
        description: module.video?.description || "",
        duration: module.video?.duration || "10 min",
        link: module.video?.link || "",
        url: module.video?.url || module.video_url || module.videoUrl || module.video?.link || "",
        uploadLabel: module.video?.uploadLabel || module.videoName || "No video selected",
        uploading: false,
        error: "",
      },
      assignment: module.assignment
        ? {
            id: module.assignment.id || null,
            title: module.assignment.title || "",
            instructions: module.assignment.instructions || "",
            submissionType: module.assignment.submissionType || module.assignment.submission_type || "text",
            submission_type: module.assignment.submission_type || module.assignment.submissionType || "text",
          }
        : null,
    })),
  };
}

function buildCoursePayload(form, editingId, existingCourse) {
  return {
    id: editingId || createId(),
    title: form.title.trim(),
    description: form.description.trim(),
    status: form.status || "published",
    owners: existingCourse?.owners?.length ? existingCourse.owners : [1],
    modules: form.modules
      .filter((module) => module.title.trim())
      .map((module, index) => ({
        id: module.id,
        sortOrder: index + 1,
        title: module.title.trim(),
        description: module.description.trim(),
        pdfUrl: module.pdf_url || module.pdfUrl || "",
        pdf_url: module.pdf_url || module.pdfUrl || "",
        pdfLabel: module.pdfLabel,
        pdfName: module.pdfName || module.pdfLabel,
        pdf_file_name: module.pdf_file_name || module.pdfName || module.pdfLabel,
        pdf_storage_path: module.pdfStoragePath || "",
        videoUrl: module.video_url || module.videoUrl || module.video.url || module.video.link.trim(),
        video_url: module.video_url || module.videoUrl || module.video.url || module.video.link.trim(),
        videoName: module.videoName || module.video.uploadLabel,
        video_file_name: module.video_file_name || module.videoName || module.video.uploadLabel,
        video_storage_path: module.videoStoragePath || "",
        video: {
          id: module.video.id || createId(),
          title: module.video.title.trim() || `${module.title.trim() || "Module"} video`,
          description: module.video.description.trim() || `${module.title.trim() || "Module"} video overview`,
          duration: module.video.duration || "10 min",
          link: module.video.link.trim(),
          url: module.video.url || module.video_url || module.videoUrl || module.video.link.trim(),
          uploadLabel: module.video.uploadLabel,
        },
        assignment: module.assignment?.title?.trim()
          ? {
              id: module.assignment.id || null,
              title: module.assignment.title.trim(),
              instructions: module.assignment.instructions.trim(),
              submissionType: module.assignment.submissionType || module.assignment.submission_type || "text",
              submission_type: module.assignment.submission_type || module.assignment.submissionType || "text",
            }
          : null,
      })),
  };
}

function slug(value) {
  return (value || "module").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "module";
}

function formatCourseStatus(status) {
  const value = (status || "published").toLowerCase();
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function isVisibleToStudents(status) {
  return (status || "published") === "published";
}

function formatSubmissionType(submissionType) {
  const value = submissionType || "text";
  if (value === "text_and_file") return "Text and file";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function createReviewDraft(submission = null) {
  return {
    status: submission?.status || "submitted",
    grade: submission?.grade ?? "",
    adminFeedback: submission?.adminFeedback || submission?.admin_feedback || "",
  };
}

export function AdminWorkspacePage({
  pathname,
  users,
  courses,
  certificates,
  onUpdateUserStatus,
  onDeleteUser,
  onSaveCourse,
  onDeleteCourse,
  onUpdateCourseVisibility,
  onGenerateCertificate,
}) {
  if (pathname === "/admin/users") {
    return <UsersAdminPage users={users} onUpdateUserStatus={onUpdateUserStatus} onDeleteUser={onDeleteUser} />;
  }

  if (pathname === "/admin/post-courses") {
    return (
      <PostCoursesPage
        courses={courses}
        onSaveCourse={onSaveCourse}
        onDeleteCourse={onDeleteCourse}
        onUpdateCourseVisibility={onUpdateCourseVisibility}
      />
    );
  }

  if (pathname === "/admin/certificates") {
    return (
      <CertificatesGeneratorPage
        users={users}
        courses={courses}
        certificates={certificates}
        onGenerateCertificate={onGenerateCertificate}
      />
    );
  }

  return <AdminDashboardPage users={users} courses={courses} certificates={certificates} />;
}

function AdminDashboardPage({ users, courses, certificates }) {
  const students = users.filter((user) => user.role === "Student");

  return (
    <>
      <Welcome title="Good morning, Alex." text="Here is a clear view of your Nutripro workspace." />
      <div className="stats-grid">
        <Stat
          icon="users"
          label="Total users"
          value={users.length}
          note={`${students.filter((user) => user.status === "Active").length} active students`}
        />
        <Stat icon="courses" label="Posted courses" value={courses.length} note="Ready for students" />
        <Stat icon="certificate" label="Certificates" value={certificates.length} note="Generated in total" />
      </div>
      <section className="section-card">
        <div className="section-heading">
          <div>
            <span className="eyebrow">ADMIN OVERVIEW</span>
            <h2>Your three admin areas</h2>
          </div>
        </div>
        <div className="overview-grid">
          <OverviewCard icon="users" title="Users Admin" text="Activate, deactivate, pause, or delete users." />
          <OverviewCard icon="courses" title="Post Courses" text="Create, edit, and manage posted courses." />
          <OverviewCard
            icon="certificate"
            title="Certificates Generator"
            text="Generate course certificates for students."
          />
        </div>
      </section>
    </>
  );
}

function UsersAdminPage({ users, onUpdateUserStatus, onDeleteUser }) {
  return (
    <section className="section-card">
      <div className="section-heading">
        <div>
          <span className="eyebrow">USER MANAGEMENT</span>
          <h2>All users</h2>
          <p>Manage access for Nutripro admins and students.</p>
        </div>
        <span className="count-badge">{users.length} users</span>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>
                  <strong>{user.name}</strong>
                </td>
                <td>{user.email}</td>
                <td>
                  <span className="subtle-badge">{user.role}</span>
                </td>
                <td>
                  <Status status={user.status} />
                </td>
                <td>
                  <div className="table-actions">
                    <button onClick={() => void onUpdateUserStatus(user.id, "Active")}>Activate</button>
                    <button onClick={() => void onUpdateUserStatus(user.id, "Inactive")}>Deactivate</button>
                    <button onClick={() => void onUpdateUserStatus(user.id, "Paused")}>Pause</button>
                    <button className="danger-text" onClick={() => void onDeleteUser(user.id)}>
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function PostCoursesPage({ courses, onSaveCourse, onDeleteCourse, onUpdateCourseVisibility }) {
  const [form, setForm] = useState(createCourseDraft());
  const [editingId, setEditingId] = useState(null);
  const [saveError, setSaveError] = useState("");
  const [visibilityMessage, setVisibilityMessage] = useState("");
  const [visibilityError, setVisibilityError] = useState("");
  const [statusUpdatingId, setStatusUpdatingId] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);
  const [submissionsError, setSubmissionsError] = useState("");
  const [reviewForms, setReviewForms] = useState({});
  const [expandedSubmissionId, setExpandedSubmissionId] = useState(null);
  const [reviewSavingId, setReviewSavingId] = useState(null);
  const [reviewMessage, setReviewMessage] = useState("");
  const [reviewError, setReviewError] = useState("");

  const loadSubmissions = async () => {
    setSubmissionsLoading(true);
    setSubmissionsError("");

    try {
      const rows = await getSubmissionsForAdmin();
      setSubmissions(rows);
      setReviewForms(
        Object.fromEntries(rows.map((submission) => [submission.id, createReviewDraft(submission)])),
      );
    } catch (error) {
      console.error("Loading assignment submissions failed:", error);
      setSubmissionsError(error.message || "Loading submissions failed.");
    } finally {
      setSubmissionsLoading(false);
    }
  };

  useEffect(() => {
    void loadSubmissions();
  }, []);

  const reset = () => {
    setForm(createCourseDraft());
    setEditingId(null);
  };

  const updateCourseField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const updateAssignment = (moduleId, updater) => {
    updateModule(moduleId, (module) => ({
      ...module,
      assignment: updater(module.assignment ?? createAssignmentDraft()),
    }));
  };

  const updateModule = (moduleId, updater) => {
    setForm((current) => ({
      ...current,
      modules: current.modules.map((module) => (module.id === moduleId ? updater(module) : module)),
    }));
  };

  const addModule = () => {
    setForm((current) => ({
      ...current,
      modules: [...current.modules, createModuleDraft(current.modules.length + 1)],
    }));
  };

  const deleteModule = (moduleId) => {
    setForm((current) => ({
      ...current,
      modules: current.modules
        .filter((module) => module.id !== moduleId)
        .map((module, index) => ({ ...module, sortOrder: index + 1 })),
    }));
  };

  const enableAssignment = (moduleId) => {
    updateModule(moduleId, (module) => ({
      ...module,
      assignment: module.assignment ?? createAssignmentDraft(),
    }));
  };

  const disableAssignment = (moduleId) => {
    updateModule(moduleId, (module) => ({
      ...module,
      assignment: null,
    }));
  };

  const editCourse = (course) => {
    setEditingId(course.id);
    setForm(createCourseDraft(course));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const previewCourse = buildCoursePayload(form, editingId, courses.find((course) => course.id === editingId));

  const submit = (event) => {
    event.preventDefault();
    setSaveError("");
    setVisibilityMessage("");
    setVisibilityError("");
    const existingCourse = courses.find((course) => course.id === editingId);
    const payload = buildCoursePayload(form, editingId, existingCourse);
    console.log("Module payload right before saving:", payload.modules);

    void Promise.resolve(onSaveCourse(payload, editingId))
      .then((result) => {
        if (result?.ok === false) {
          setSaveError(result.error || "Saving the course failed.");
          return;
        }

        void loadSubmissions();
        reset();
      })
      .catch((error) => {
        console.error("Course save failed:", error);
        setSaveError("Saving the course failed.");
      });
  };

  const changeCourseVisibility = async (course, visibleToStudents) => {
    setVisibilityMessage("");
    setVisibilityError("");
    setStatusUpdatingId(course.id);

    try {
      const result = await onUpdateCourseVisibility(course.id, visibleToStudents);
      if (result?.ok === false) {
        setVisibilityError(result.error || "Updating course visibility failed.");
        return;
      }

      setVisibilityMessage(result?.message || "Course visibility updated.");
    } catch (error) {
      console.error("Course visibility update failed:", error);
      setVisibilityError("Updating course visibility failed.");
    } finally {
      setStatusUpdatingId(null);
    }
  };

  const uploadPdf = async (moduleId, file) => {
    if (!file) return;

    updateModule(moduleId, (module) => ({
      ...module,
      pdfUploading: true,
      pdfError: "",
      pdfLabel: file.name,
      pdfName: file.name,
    }));

    try {
      const uploaded = await uploadModulePdf(file, moduleId);
      console.log("PDF upload result publicUrl:", uploaded.publicUrl);

      if (!uploaded.publicUrl) {
        const error = new Error("PDF upload succeeded but public URL is missing.");
        console.error(error);
        throw error;
      }

      updateModule(moduleId, (module) => ({
        ...module,
        pdfUploading: false,
        pdfError: "",
        pdfLabel: uploaded.fileName,
        pdfName: uploaded.fileName,
        pdf_file_name: uploaded.fileName,
        pdfStoragePath: uploaded.storagePath,
        pdf_storage_path: uploaded.storagePath,
        pdfUrl: uploaded.publicUrl,
        pdf_url: uploaded.publicUrl,
      }));
    } catch (error) {
      console.error("PDF upload failed:", error);
      updateModule(moduleId, (module) => ({
        ...module,
        pdfUploading: false,
        pdfError: error.message || "PDF upload failed.",
      }));
    }
  };

  const uploadVideo = async (moduleId, file) => {
    if (!file) return;

    updateModule(moduleId, (module) => ({
      ...module,
      videoName: file.name,
      video: {
        ...module.video,
        uploading: true,
        error: "",
        uploadLabel: file.name,
      },
    }));

    try {
      const uploaded = await uploadModuleVideo(file, moduleId);
      console.log("Video upload result publicUrl:", uploaded.publicUrl);

      if (!uploaded.publicUrl) {
        const error = new Error("Video upload succeeded but public URL is missing.");
        console.error(error);
        throw error;
      }

      updateModule(moduleId, (module) => ({
        ...module,
        videoUrl: uploaded.publicUrl,
        video_url: uploaded.publicUrl,
        videoName: uploaded.fileName,
        video_file_name: uploaded.fileName,
        videoStoragePath: uploaded.storagePath,
        video_storage_path: uploaded.storagePath,
        video: {
          ...module.video,
          uploading: false,
          error: "",
          uploadLabel: uploaded.fileName,
          url: uploaded.publicUrl,
          link: module.video.link,
        },
      }));
    } catch (error) {
      console.error("Video upload failed:", error);
      updateModule(moduleId, (module) => ({
        ...module,
        video: {
          ...module.video,
          uploading: false,
          error: error.message || "Video upload failed.",
        },
      }));
    }
  };

  const updateReviewForm = (submissionId, field, value) => {
    setReviewForms((current) => ({
      ...current,
      [submissionId]: {
        ...(current[submissionId] ?? createReviewDraft()),
        [field]: value,
      },
    }));
  };

  const saveSubmissionReview = async (submissionId) => {
    const formValues = reviewForms[submissionId] ?? createReviewDraft();
    setReviewMessage("");
    setReviewError("");
    setReviewSavingId(submissionId);

    try {
      const gradeValue = formValues.grade === "" ? null : Number(formValues.grade);
      if (gradeValue !== null && (Number.isNaN(gradeValue) || gradeValue < 0 || gradeValue > 100)) {
        throw new Error("Grade must be between 0 and 100.");
      }

      await reviewSubmission(submissionId, formValues.status, formValues.adminFeedback, gradeValue);
      setReviewMessage("Submission review saved.");
      await loadSubmissions();
    } catch (error) {
      console.error("Saving assignment review failed:", error);
      setReviewError(error.message || "Saving the review failed.");
    } finally {
      setReviewSavingId(null);
    }
  };

  return (
    <div className="split-layout">
      <form className="section-card course-form" onSubmit={submit}>
        <div className="section-heading">
          <div>
            <span className="eyebrow">{editingId ? "EDIT COURSE" : "NEW COURSE"}</span>
            <h2>{editingId ? "Update course" : "Create and post"}</h2>
            <p>Build the course structure as Course → Module → PDF → Video.</p>
          </div>
        </div>

        <label>
          Course title
          <input
            required
            value={form.title}
            onChange={(event) => updateCourseField("title", event.target.value)}
            placeholder="e.g. Nutrition Essentials"
          />
        </label>

        <label>
          Course description
          <textarea
            required
            rows="4"
            value={form.description}
            onChange={(event) => updateCourseField("description", event.target.value)}
            placeholder="What will students learn?"
          />
        </label>

        <label>
          <input
            type="checkbox"
            checked={isVisibleToStudents(form.status)}
            onChange={(event) => updateCourseField("status", event.target.checked ? "published" : "draft")}
          />{" "}
          Visible to students
        </label>

        {saveError && <small className="field-note danger-text">{saveError}</small>}

        <div className="builder-stack">
          <div className="builder-header">
            <div>
              <span className="eyebrow">MODULES</span>
              <h3>Module files</h3>
            </div>
            <button type="button" className="secondary-btn" onClick={addModule}>
              <Icon name="plus" />
              Add module
            </button>
          </div>

          {form.modules.map((module, index) => (
            <article className="module-editor-card" key={module.id}>
              <div className="module-editor-head">
                <div>
                  <span className="count-badge">Module {index + 1}</span>
                  <h4>{module.title.trim() || "New module"}</h4>
                </div>
                <button type="button" className="danger-text mini-action" onClick={() => deleteModule(module.id)}>
                  Delete module
                </button>
              </div>

              <div className="module-editor-grid">
                <label>
                  Module title
                  <input
                    required
                    value={module.title}
                    onChange={(event) =>
                      updateModule(module.id, (currentModule) => ({
                        ...currentModule,
                        title: event.target.value,
                      }))
                    }
                    placeholder="Module title"
                  />
                </label>

                <label>
                  Module description
                  <textarea
                    rows="3"
                    value={module.description}
                    onChange={(event) =>
                      updateModule(module.id, (currentModule) => ({
                        ...currentModule,
                        description: event.target.value,
                      }))
                    }
                    placeholder="What is covered in this module?"
                  />
                </label>
              </div>

              <section className="nested-builder single-video-builder">
                <div className="nested-header">
                  <span className="eyebrow">PDF</span>
                  <h5>{module.pdfLabel}</h5>
                </div>

                <label className="upload-field">
                  Upload PDF
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={(event) => void uploadPdf(module.id, event.target.files?.[0])}
                  />
                </label>

                {module.pdfUploading && <small className="field-note">Uploading PDF...</small>}
                {module.pdfError && <small className="field-note danger-text">{module.pdfError}</small>}

                {module.pdf_url || module.pdfUrl ? (
                  <a href={module.pdf_url || module.pdfUrl} target="_blank" rel="noreferrer">
                    Open PDF
                  </a>
                ) : module.pdfLabel !== "No PDF selected" ? (
                  <small className="field-note danger-text">File name exists, but file URL is missing.</small>
                ) : (
                  <small className="field-note">No PDF uploaded yet.</small>
                )}

                <div className="row-actions">
                  <button
                    type="button"
                    onClick={() =>
                      updateModule(module.id, (currentModule) => ({
                        ...currentModule,
                        pdfLabel: `${slug(currentModule.title)}.pdf`,
                      }))
                    }
                  >
                    Replace PDF
                  </button>
                  <button
                    type="button"
                    className="danger-text"
                    onClick={() =>
                      updateModule(module.id, (currentModule) => ({
                        ...currentModule,
                        pdfUrl: "",
                        pdf_url: "",
                        pdfLabel: "No PDF selected",
                        pdfName: "",
                        pdf_file_name: "",
                        pdfStoragePath: "",
                        pdf_storage_path: "",
                        pdfError: "",
                      }))
                    }
                  >
                    Remove PDF
                  </button>
                </div>
              </section>

              <section className="nested-builder single-video-builder">
                <div className="nested-header">
                  <span className="eyebrow">VIDEO</span>
                  <h5>
                    {module.video.uploadLabel !== "No video selected"
                      ? module.video.uploadLabel
                      : module.video.link || "No video selected"}
                  </h5>
                </div>

                <label className="upload-field">
                  Upload video
                  <input
                    type="file"
                    accept="video/*"
                    onChange={(event) => void uploadVideo(module.id, event.target.files?.[0])}
                  />
                </label>

                {module.video.uploading && <small className="field-note">Uploading video...</small>}
                {module.video.error && <small className="field-note danger-text">{module.video.error}</small>}

                {module.video_url || module.videoUrl ? (
                  <>
                    <a href={module.video_url || module.videoUrl} target="_blank" rel="noreferrer">
                      Open Video
                    </a>
                    <div className="video-player-shell">
                      <video controls width="100%" src={module.video_url || module.videoUrl} />
                    </div>
                  </>
                ) : module.video.uploadLabel !== "No video selected" || module.videoName ? (
                  <small className="field-note danger-text">File name exists, but file URL is missing.</small>
                ) : (
                  <small className="field-note">No video uploaded yet.</small>
                )}

                <label>
                  Optional video embed/link field
                  <input
                    value={module.video.link}
                    onChange={(event) =>
                      updateModule(module.id, (currentModule) => ({
                        ...currentModule,
                        videoUrl: event.target.value,
                        video_url: event.target.value,
                        video: {
                          ...currentModule.video,
                          link: event.target.value,
                          url: event.target.value,
                        },
                      }))
                    }
                    placeholder="https://example.com/video"
                  />
                </label>

                <div className="row-actions">
                  <button
                    type="button"
                    onClick={() =>
                      updateModule(module.id, (currentModule) => ({
                        ...currentModule,
                        video: {
                          ...currentModule.video,
                          uploadLabel: `${slug(currentModule.title)}-updated.mp4`,
                        },
                      }))
                    }
                  >
                    Replace video
                  </button>
                  <button
                    type="button"
                    className="danger-text"
                    onClick={() =>
                      updateModule(module.id, (currentModule) => ({
                        ...currentModule,
                        videoUrl: "",
                        video_url: "",
                        videoName: "",
                        video_file_name: "",
                        videoStoragePath: "",
                        video_storage_path: "",
                        video: {
                          ...currentModule.video,
                          link: "",
                          url: "",
                          uploadLabel: "No video selected",
                          error: "",
                        },
                      }))
                    }
                  >
                    Remove video
                  </button>
                </div>

                <small className="field-note">
                  {module.video.link ? `Video link: ${module.video.link}` : "No video link added."}
                </small>
              </section>

              <section className="nested-builder single-video-builder">
                <div className="nested-header">
                  <span className="eyebrow">ASSIGNMENT</span>
                  <h5>{module.assignment?.title?.trim() || "No assignment added"}</h5>
                </div>

                {module.assignment ? (
                  <>
                    <label>
                      Assignment title
                      <input
                        value={module.assignment.title}
                        onChange={(event) =>
                          updateAssignment(module.id, (assignment) => ({
                            ...assignment,
                            title: event.target.value,
                          }))
                        }
                        placeholder="e.g. Weekly meal-planning homework"
                      />
                    </label>

                    <label>
                      Instructions
                      <textarea
                        rows="4"
                        value={module.assignment.instructions}
                        onChange={(event) =>
                          updateAssignment(module.id, (assignment) => ({
                            ...assignment,
                            instructions: event.target.value,
                          }))
                        }
                        placeholder="Tell students what to submit after reviewing the module PDF and video."
                      />
                    </label>

                    <label>
                      Submission type
                      <select
                        value={module.assignment.submissionType || module.assignment.submission_type || "text"}
                        onChange={(event) =>
                          updateAssignment(module.id, (assignment) => ({
                            ...assignment,
                            submissionType: event.target.value,
                            submission_type: event.target.value,
                          }))
                        }
                      >
                        <option value="text">Text</option>
                        <option value="file">File</option>
                        <option value="text_and_file">Text and file</option>
                      </select>
                    </label>

                    <div className="row-actions">
                      <button type="button" className="danger-text" onClick={() => disableAssignment(module.id)}>
                        Remove assignment
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="empty-copy">This module does not include homework yet.</p>
                    <button type="button" className="secondary-btn" onClick={() => enableAssignment(module.id)}>
                      <Icon name="plus" />
                      Add assignment
                    </button>
                  </>
                )}
              </section>
            </article>
          ))}
        </div>

        <div className="form-actions">
          <button className="primary-btn" type="submit">
            <Icon name={editingId ? "check" : "plus"} />
            {editingId ? "Save changes" : "Post Course"}
          </button>
          {editingId && (
            <button type="button" className="secondary-btn" onClick={reset}>
              Cancel
            </button>
          )}
        </div>
      </form>

      <div className="right-rail">
        <section className="section-card preview-card">
          <div className="section-heading">
            <div>
              <span className="eyebrow">COURSE PREVIEW</span>
              <h2>Preview before posting</h2>
              <p>Course → Module → PDF → Video</p>
            </div>
          </div>
          <div className="preview-shell">
            <h3>{previewCourse.title || "Course title"}</h3>
            <p>{previewCourse.description || "Course description will appear here."}</p>
            <div className="row-actions">
              <Status status={formatCourseStatus(previewCourse.status)} />
              <span className="subtle-badge">
                {isVisibleToStudents(previewCourse.status)
                  ? "Assigned to the demo student after posting"
                  : "Hidden from the student workspace"}
              </span>
            </div>
            <div className="preview-tree">
              {previewCourse.modules.length ? (
                previewCourse.modules.map((module) => (
                  <article className="preview-module" key={module.id}>
                    <h4>{module.title}</h4>
                    <p>{module.description}</p>
                    <div className="preview-items">
                      <div className="preview-item">
                        <span className="subtle-badge">PDF</span>
                        <strong>{module.pdfLabel}</strong>
                      </div>
                      <div className="preview-item">
                        <span className="subtle-badge">Video</span>
                        <strong>
                          {module.video.uploadLabel !== "No video selected"
                            ? module.video.uploadLabel
                            : module.video_url || module.videoUrl || module.video.link || "No video selected"}
                        </strong>
                      </div>
                      <div className="preview-item">
                        <span className="subtle-badge">Homework</span>
                        <strong>{module.assignment?.title || "No assignment"}</strong>
                      </div>
                    </div>
                  </article>
                ))
              ) : (
                <p className="empty-copy">Add at least one module to preview the course structure.</p>
              )}
            </div>
          </div>
        </section>

        <section className="section-card posted-list">
          <div className="section-heading">
            <div>
              <span className="eyebrow">COURSE LIBRARY</span>
              <h2>Posted courses</h2>
            </div>
            <span className="count-badge">{courses.length} courses</span>
          </div>

          {visibilityMessage && <small className="field-note">{visibilityMessage}</small>}
          {visibilityError && <small className="field-note danger-text">{visibilityError}</small>}

          <div className="course-admin-list">
            {courses.map((course) => (
              <article key={course.id}>
                <div className="course-symbol">
                  <Icon name="courses" />
                </div>
                <div className="course-info">
                  <div className="row-actions">
                    <h3>{course.title}</h3>
                    <Status status={formatCourseStatus(course.status || "published")} />
                  </div>
                  <p>{course.description}</p>
                  <span>{(course.modules ?? []).length} modules</span>
                  <span>
                    {
                      (course.modules ?? []).filter(
                        (module) => module.pdf_url || module.pdfUrl || module.pdfLabel !== "No PDF selected",
                      ).length
                    }{" "}
                    PDFs
                  </span>
                  <span>
                    {
                      (course.modules ?? []).filter(
                        (module) => module.video_url || module.videoUrl || module.video?.url || module.video?.link,
                      ).length
                    }{" "}
                    videos
                  </span>
                  <span>
                    {
                      (course.modules ?? []).filter((module) => module.assignment?.title?.trim()).length
                    }{" "}
                    assignments
                  </span>
                  <label>
                    <input
                      type="checkbox"
                      checked={isVisibleToStudents(course.status)}
                      disabled={statusUpdatingId === course.id}
                      onChange={(event) => void changeCourseVisibility(course, event.target.checked)}
                    />{" "}
                    Visible to students
                  </label>
                </div>
                <div className="row-actions">
                  <button onClick={() => editCourse(course)}>Edit</button>
                  <button className="danger-text" onClick={() => void onDeleteCourse(course.id)}>
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="section-card posted-list">
          <div className="section-heading">
            <div>
              <span className="eyebrow">ASSIGNMENT REVIEW</span>
              <h2>Student submissions</h2>
              <p>Review homework, leave feedback, and grade each submission out of 100.</p>
            </div>
            <span className="count-badge">{submissions.length} submissions</span>
          </div>

          {submissionsLoading && <small className="field-note">Loading submissions...</small>}
          {submissionsError && <small className="field-note danger-text">{submissionsError}</small>}
          {reviewMessage && <small className="field-note">{reviewMessage}</small>}
          {reviewError && <small className="field-note danger-text">{reviewError}</small>}

          <div className="submission-list">
            {!submissionsLoading && !submissions.length ? (
              <p className="empty-copy">No assignment submissions yet.</p>
            ) : (
              submissions.map((submission) => {
                const reviewForm = reviewForms[submission.id] ?? createReviewDraft(submission);

                return (
                  <article key={submission.id} className="submission-item">
                    <div className="submission-summary">
                      <div>
                        <span className="eyebrow">SUBMISSION</span>
                        <h3>{submission.assignmentTitle || "Module assignment"}</h3>
                        <p>
                          {submission.studentName || "Student"} · {submission.courseTitle || "Course"} ·{" "}
                          {submission.moduleTitle || "Module"}
                        </p>
                      </div>
                      <div className="submission-statuses">
                        <Status status={submission.status || "submitted"} />
                        <span className="subtle-badge">
                          {submission.grade === null || submission.grade === undefined
                            ? "Not graded yet"
                            : `Grade: ${submission.grade}/100`}
                        </span>
                      </div>
                    </div>

                    <div className="assignment-response">
                      <p>
                        <strong>Submission type:</strong>{" "}
                        {formatSubmissionType(submission.assignment?.submissionType || submission.assignment?.submission_type)}
                      </p>

                      {submission.textResponse ? (
                        <div className="response-block">
                          <strong>Student response</strong>
                          <p>{submission.textResponse}</p>
                        </div>
                      ) : (
                        <small className="field-note">No text response submitted.</small>
                      )}

                      {submission.fileUrl ? (
                        <a href={submission.fileUrl} target="_blank" rel="noreferrer">
                          Open submitted file
                        </a>
                      ) : (
                        <small className="field-note">No file submitted.</small>
                      )}
                    </div>

                    <button
                      type="button"
                      className="secondary-btn"
                      onClick={() =>
                        setExpandedSubmissionId((current) => (current === submission.id ? null : submission.id))
                      }
                    >
                      {expandedSubmissionId === submission.id ? "Hide review" : "Review submission"}
                    </button>

                    {expandedSubmissionId === submission.id && (
                      <div className="review-panel">
                        <label>
                          Review status
                          <select
                            value={reviewForm.status}
                            onChange={(event) => updateReviewForm(submission.id, "status", event.target.value)}
                          >
                            <option value="submitted">Submitted</option>
                            <option value="approved">Approved</option>
                            <option value="needs_revision">Needs revision</option>
                            <option value="rejected">Rejected</option>
                          </select>
                        </label>

                        <label>
                          Grade out of 100
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={reviewForm.grade}
                            onChange={(event) => updateReviewForm(submission.id, "grade", event.target.value)}
                            placeholder="0 - 100"
                          />
                        </label>

                        <label>
                          Feedback
                          <textarea
                            rows="4"
                            value={reviewForm.adminFeedback}
                            onChange={(event) => updateReviewForm(submission.id, "adminFeedback", event.target.value)}
                            placeholder="Share clear feedback for the student."
                          />
                        </label>

                        <div className="form-actions compact">
                          <button
                            type="button"
                            className="primary-btn"
                            disabled={reviewSavingId === submission.id}
                            onClick={() => void saveSubmissionReview(submission.id)}
                          >
                            <Icon name="check" />
                            {reviewSavingId === submission.id ? "Saving..." : "Save review"}
                          </button>
                        </div>
                      </div>
                    )}
                  </article>
                );
              })
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function CertificatesGeneratorPage({ users, courses, certificates, onGenerateCertificate }) {
  const students = users.filter((user) => user.role === "Student");
  const [studentId, setStudentId] = useState(students[0]?.id || "");
  const [courseId, setCourseId] = useState(courses[0]?.id || "");

  const generate = (event) => {
    event.preventDefault();
    const student = students.find((user) => user.id === Number(studentId));
    const course = courses.find((entry) => entry.id === Number(courseId));
    if (!student || !course) return;

    void onGenerateCertificate({
      studentId: student.id,
      student: student.name,
      courseId: course.id,
      course: course.title,
    });
  };

  return (
    <div className="cert-layout">
      <form className="section-card generator-card" onSubmit={generate}>
        <span className="eyebrow">CERTIFICATE GENERATOR</span>
        <h2>Generate a certificate</h2>
        <p>Select a student and completed course.</p>

        <label>
          Student
          <select value={studentId} onChange={(event) => setStudentId(event.target.value)}>
            {students.map((student) => (
              <option key={student.id} value={student.id}>
                {student.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          Course
          <select value={courseId} onChange={(event) => setCourseId(event.target.value)}>
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.title}
              </option>
            ))}
          </select>
        </label>

        <button className="primary-btn" type="submit">
          <Icon name="certificate" />
          Generate certificate
        </button>
      </form>

      <section className="section-card">
        <div className="section-heading">
          <div>
            <span className="eyebrow">GENERATED</span>
            <h2>Certificate list</h2>
          </div>
          <span className="count-badge">{certificates.length} total</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Student</th>
                <th>Course</th>
                <th>Certificate number</th>
                <th>Issue date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {certificates.map((certificate) => (
                <tr key={certificate.id}>
                  <td>
                    <strong>{certificate.student}</strong>
                  </td>
                  <td>{certificate.course}</td>
                  <td>
                    <code>{certificate.number}</code>
                  </td>
                  <td>{certificate.issueDate}</td>
                  <td>
                    <Status status={certificate.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
