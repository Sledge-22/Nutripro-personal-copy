import React, { useEffect, useState } from "react";
import { Icon, OverviewCard, Stat, Status, Welcome } from "../components/ui.jsx";
import { ToggleSwitch } from "../components/ToggleSwitch.jsx";
import { getSubmissionsForAdmin, reviewSubmission } from "../services/assignmentService.js";
import { uploadCourseImage, uploadModulePdf, uploadModuleVideo } from "../services/storageService.js";
import { useLanguage } from "../i18n/LanguageContext.jsx";
import { ROUTES } from "../routes/appRoutes.js";

function createId() {
  return Date.now() + Math.floor(Math.random() * 100000);
}

const COURSE_DRAFT_STORAGE_KEY = "nutripro-course-builder-draft-v2";
const MAX_VIDEO_SIZE_MB = 250;
const MAX_VIDEO_SIZE_BYTES = MAX_VIDEO_SIZE_MB * 1024 * 1024;
const PDF_ACCEPT = ".pdf,application/pdf";
const VIDEO_ACCEPT = ".mp4,.mov,.webm,video/mp4,video/quicktime,video/webm";
const NO_PDF_SELECTED = "No PDF selected";
const NO_VIDEO_SELECTED = "No video selected";

function formatFileSize(bytes) {
  const normalizedBytes = Number(bytes);
  if (!Number.isFinite(normalizedBytes) || normalizedBytes <= 0) return "";
  if (normalizedBytes >= 1024 * 1024) return `${(normalizedBytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(normalizedBytes / 1024))} KB`;
}

function clampModuleCount(value) {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed)) return null;
  if (parsed < 1 || parsed > 100) return null;
  return parsed;
}

function createGeneratedModules(count, language = "es") {
  return Array.from({ length: count }, (_, index) => ({
    ...createModuleDraft(index + 1),
    title: language === "es" ? `Módulo ${index + 1}` : `Module ${index + 1}`,
  }));
}

function createCollapsedModuleIds(modules = [], shouldCollapse = false) {
  if (!shouldCollapse) return [];
  return modules.slice(1).map((module) => module.id);
}

function createAssignmentDraft() {
  return {
    id: null,
    title: "",
    instructions: "",
    dueDate: "",
    due_date: "",
    submissionType: "file",
    submission_type: "file",
  };
}

function createModuleDraft(sortOrder = 1) {
  return {
    id: createId(),
    sortOrder,
    title: "",
    description: "",
    requiresAssignment: false,
    requires_assignment: false,
    pdfUrl: "",
    pdf_url: "",
    pdfLabel: "No PDF selected",
    pdfName: "",
    pdf_file_name: "",
    pdfStoragePath: "",
    pdf_storage_path: "",
    pdfFile: null,
    pdfPendingName: "",
    pdfPendingSize: null,
    pdfUploading: false,
    pdfError: "",
    videoUrl: "",
    video_url: "",
    videoName: "",
    video_file_name: "",
    videoStoragePath: "",
    video_storage_path: "",
    videoFile: null,
    videoPendingName: "",
    videoPendingSize: null,
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

function restoreModuleDraft(module = {}, index = 0) {
  const baseModule = createModuleDraft(index + 1);
  const restoredPdfUrl = module.pdf_url || module.pdfUrl || "";
  const restoredVideoUrl = module.video_url || module.videoUrl || module.video?.url || "";
  const legacyPdfName = module.pdfPendingName || module.pdfName || module.pdf_file_name || module.pdfLabel || "";
  const legacyVideoName =
    module.videoPendingName ||
    module.videoName ||
    module.video_file_name ||
    module.video?.uploadLabel ||
    "";
  const pdfPendingName = restoredPdfUrl ? module.pdfPendingName || "" : legacyPdfName && legacyPdfName !== NO_PDF_SELECTED ? legacyPdfName : "";
  const videoPendingName =
    restoredVideoUrl || module.video?.link
      ? module.videoPendingName || ""
      : legacyVideoName && legacyVideoName !== NO_VIDEO_SELECTED
        ? legacyVideoName
        : "";

  return {
    ...baseModule,
    ...module,
    id: module.id || baseModule.id,
    sortOrder: module.sortOrder ?? module.sort_order ?? index + 1,
    pdfUrl: restoredPdfUrl,
    pdf_url: restoredPdfUrl,
    pdfLabel: restoredPdfUrl ? module.pdfLabel || module.pdfName || module.pdf_file_name || legacyPdfName || NO_PDF_SELECTED : NO_PDF_SELECTED,
    pdfName: restoredPdfUrl ? module.pdfName || module.pdf_file_name || module.pdfLabel || legacyPdfName || "" : "",
    pdf_file_name: restoredPdfUrl ? module.pdf_file_name || module.pdfName || module.pdfLabel || legacyPdfName || "" : "",
    pdfStoragePath: module.pdfStoragePath || module.pdf_storage_path || "",
    pdf_storage_path: module.pdf_storage_path || module.pdfStoragePath || "",
    pdfFile: null,
    pdfPendingName,
    pdfPendingSize: module.pdfPendingSize ?? null,
    pdfUploading: false,
    pdfError: "",
    videoUrl: restoredVideoUrl || module.video?.link || "",
    video_url: restoredVideoUrl || module.video?.link || "",
    videoName: restoredVideoUrl ? module.videoName || module.video_file_name || module.video?.uploadLabel || legacyVideoName || "" : "",
    video_file_name: restoredVideoUrl ? module.video_file_name || module.videoName || module.video?.uploadLabel || legacyVideoName || "" : "",
    videoStoragePath: module.videoStoragePath || module.video_storage_path || "",
    video_storage_path: module.video_storage_path || module.videoStoragePath || "",
    videoFile: null,
    videoPendingName,
    videoPendingSize: module.videoPendingSize ?? null,
    video: {
      ...baseModule.video,
      ...(module.video || {}),
      uploadLabel:
        restoredVideoUrl || module.video?.link
          ? module.video?.uploadLabel || module.videoName || module.video_file_name || legacyVideoName || NO_VIDEO_SELECTED
          : NO_VIDEO_SELECTED,
      uploading: false,
      error: "",
    },
    assignment: module.assignment
      ? {
          ...createAssignmentDraft(),
          ...module.assignment,
          submissionType: "file",
          submission_type: "file",
        }
      : null,
  };
}

function restoreCourseDraft(draft = {}) {
  const modules = Array.isArray(draft.modules) && draft.modules.length
    ? draft.modules.map((module, index) => restoreModuleDraft(module, index))
    : [createModuleDraft()];

  return {
    ...createCourseDraft(),
    ...draft,
    imageUploading: false,
    imageError: "",
    modules,
  };
}

function createSerializableCourseDraft(form) {
  return {
    ...form,
    imageUploading: false,
    imageError: "",
    modules: (form.modules || []).map((module) => ({
      ...module,
      pdfFile: null,
      pdfUploading: false,
      pdfError: "",
      videoFile: null,
      video: {
        ...module.video,
        uploading: false,
        error: "",
      },
    })),
  };
}

function createCourseDraft(course = null) {
  if (!course) {
    return {
      title: "",
      description: "",
      status: "published",
      imageUrl: "",
      image_url: "",
      imageStoragePath: "",
      image_storage_path: "",
      imageLabel: "",
      imageUploading: false,
      imageError: "",
      modules: [createModuleDraft()],
    };
  }

  return {
    title: course.title,
    description: course.description,
    status: course.status || "published",
    imageUrl: course.image_url || course.imageUrl || "",
    image_url: course.image_url || course.imageUrl || "",
    imageStoragePath: course.image_storage_path || course.imageStoragePath || "",
    image_storage_path: course.image_storage_path || course.imageStoragePath || "",
    imageLabel: course.imageLabel || course.image_file_name || course.imageName || "",
    imageUploading: false,
    imageError: "",
    modules: (course.modules || []).map((module, index) => ({
      id: module.id || createId(),
      sortOrder: module.sortOrder ?? index + 1,
      title: module.title || "",
      description: module.description || "",
      requiresAssignment:
        module.requiresAssignment ??
        module.requires_assignment ??
        Boolean(module.assignment?.title),
      requires_assignment:
        module.requires_assignment ??
        module.requiresAssignment ??
        Boolean(module.assignment?.title),
      pdfUrl: module.pdf_url || module.pdfUrl || "",
      pdf_url: module.pdf_url || module.pdfUrl || "",
      pdfLabel: module.pdfLabel || module.pdf_file_name || module.pdfName || NO_PDF_SELECTED,
      pdfName: module.pdfName || module.pdf_file_name || module.pdfLabel || "",
      pdf_file_name: module.pdf_file_name || module.pdfName || module.pdfLabel || "",
      pdfStoragePath: module.pdf_storage_path || module.pdfStoragePath || "",
      pdf_storage_path: module.pdf_storage_path || module.pdfStoragePath || "",
      pdfFile: null,
      pdfPendingName: "",
      pdfPendingSize: null,
      pdfUploading: false,
      pdfError: "",
      videoUrl: module.video_url || module.videoUrl || module.video?.url || module.video?.link || "",
      video_url: module.video_url || module.videoUrl || module.video?.url || module.video?.link || "",
      videoName: module.videoName || module.video_file_name || module.video?.uploadLabel || "",
      video_file_name: module.video_file_name || module.videoName || module.video?.uploadLabel || "",
      videoStoragePath: module.video_storage_path || module.videoStoragePath || "",
      video_storage_path: module.video_storage_path || module.videoStoragePath || "",
      videoFile: null,
      videoPendingName: "",
      videoPendingSize: null,
      video: {
        id: module.video?.id || createId(),
        title: module.video?.title || "",
        description: module.video?.description || "",
        duration: module.video?.duration || "10 min",
        link: module.video?.link || "",
        url: module.video?.url || module.video_url || module.videoUrl || module.video?.link || "",
        uploadLabel: module.video?.uploadLabel || module.video_file_name || module.videoName || NO_VIDEO_SELECTED,
        uploading: false,
        error: "",
      },
      assignment: module.assignment
        ? {
            id: module.assignment.id || null,
            title: module.assignment.title || "",
            instructions: module.assignment.instructions || "",
            dueDate: module.assignment.dueDate || module.assignment.due_date || "",
            due_date: module.assignment.due_date || module.assignment.dueDate || "",
            submissionType: "file",
            submission_type: "file",
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
    imageUrl: form.image_url || form.imageUrl || "",
    image_url: form.image_url || form.imageUrl || "",
    imageStoragePath: form.image_storage_path || form.imageStoragePath || "",
    image_storage_path: form.image_storage_path || form.imageStoragePath || "",
    owners: existingCourse?.owners?.length ? existingCourse.owners : [1],
    modules: form.modules
      .filter((module) => module.title.trim())
      .map((module, index) => ({
        id: module.id,
        sortOrder: index + 1,
        title: module.title.trim(),
        description: module.description.trim(),
        requiresAssignment:
          module.requiresAssignment ??
          module.requires_assignment ??
          Boolean(module.assignment?.title),
        requires_assignment:
          module.requires_assignment ??
          module.requiresAssignment ??
          Boolean(module.assignment?.title),
        pdfUrl: module.pdf_url || module.pdfUrl || "",
        pdf_url: module.pdf_url || module.pdfUrl || "",
        pdfLabel: module.pdfLabel || module.pdf_file_name || module.pdfName || "No PDF selected",
        pdfName: module.pdfName || module.pdf_file_name || module.pdfLabel || "",
        pdf_file_name: module.pdf_file_name || module.pdfName || module.pdfLabel || "",
        pdf_storage_path: module.pdfStoragePath || module.pdf_storage_path || "",
        videoUrl: module.video_url || module.videoUrl || module.video.url || module.video.link.trim(),
        video_url: module.video_url || module.videoUrl || module.video.url || module.video.link.trim(),
        videoName: module.videoName || module.video_file_name || module.video.uploadLabel || "",
        video_file_name: module.video_file_name || module.videoName || module.video.uploadLabel || "",
        video_storage_path: module.videoStoragePath || module.video_storage_path || "",
        video: {
          id: module.video.id || createId(),
          title: module.video.title.trim() || `${module.title.trim() || "Module"} video`,
          description: module.video.description.trim() || `${module.title.trim() || "Module"} video overview`,
          duration: module.video.duration || "10 min",
          link: module.video.link.trim(),
          url: module.video.url || module.video_url || module.videoUrl || module.video.link.trim(),
          uploadLabel: module.video.uploadLabel || "No video selected",
        },
        assignment:
          (module.requiresAssignment ?? module.requires_assignment) && module.assignment?.title?.trim()
          ? {
              id: module.assignment.id || null,
              title: module.assignment.title.trim(),
              instructions: module.assignment.instructions.trim(),
              dueDate: module.assignment.dueDate || module.assignment.due_date || "",
              due_date: module.assignment.due_date || module.assignment.dueDate || "",
              submissionType: "file",
              submission_type: "file",
            }
          : null,
      })),
  };
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

function isVisibleToStudents(status) {
  return (status || "published") === "published";
}

function createReviewDraft(submission = null) {
  return {
    status: submission?.status || "submitted",
    grade: submission?.grade ?? "",
    adminFeedback: submission?.adminFeedback || submission?.admin_feedback || "",
  };
}

function createUserDraft() {
  return {
    name: "",
    email: "",
    username: "",
    role: "student",
    status: "active",
    country: "",
    bio: "",
    profile_picture_url: "",
  };
}

export function AdminWorkspacePage({
  pathname,
  users,
  courses,
  certificates,
  showAuthTestTools = true,
  onUpdateUserStatus,
  onUpdateUser,
  onCreateUser,
  onResetUserPassword,
  onDeleteUser,
  onSaveCourse,
  onDeleteCourse,
  onUpdateCourseVisibility,
  onGenerateCertificate,
}) {
  if (pathname === "/admin/users") {
    return (
      <UsersAdminPanel
        users={users}
        showAuthTestTools={showAuthTestTools}
        onUpdateUserStatus={onUpdateUserStatus}
        onUpdateUser={onUpdateUser}
        onCreateUser={onCreateUser}
        onResetUserPassword={onResetUserPassword}
        onDeleteUser={onDeleteUser}
      />
    );
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

  if (pathname === "/admin/assignment-reviews") {
    return <AssignmentReviewsPage />;
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
  const { t } = useLanguage();
  const students = users.filter((user) => user.role === "Student");

  return (
    <>
      <Welcome title={t("dashboard.adminWelcomeTitle")} text={t("dashboard.adminWelcomeText")} />
      <div className="stats-grid">
        <Stat
          icon="users"
          label={t("dashboard.totalUsers")}
          value={users.length}
          note={t("dashboard.activeStudents", { count: students.filter((user) => user.status === "Active").length })}
        />
        <Stat icon="courses" label={t("dashboard.postedCourses")} value={courses.length} note={t("dashboard.readyForStudents")} />
        <Stat icon="certificate" label={t("dashboard.generatedCertificates")} value={certificates.length} note={t("dashboard.generatedInTotal")} />
      </div>
      <section className="section-card">
        <div className="section-heading">
          <div>
            <span className="eyebrow">{t("dashboard.adminOverview")}</span>
            <h2>{t("dashboard.yourAdminAreas")}</h2>
          </div>
        </div>
        <div className="overview-grid">
          <OverviewCard icon="users" title={t("common.usersAdmin")} text={t("dashboard.usersAdminText")} />
          <OverviewCard icon="courses" title={t("common.postCourses")} text={t("dashboard.postCoursesText")} />
          <OverviewCard icon="certificate" title={t("common.assignmentReviews")} text={t("dashboard.assignmentReviewsText")} />
          <OverviewCard icon="certificate" title={t("common.certificatesGenerator")} text={t("dashboard.certificatesGeneratorText")} />
        </div>
      </section>
    </>
  );
}

function UsersAdminPage({ users, onUpdateUserStatus, onUpdateUser, onDeleteUser }) {
  const { t, language } = useLanguage();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editingUserId, setEditingUserId] = useState(null);
  const [draft, setDraft] = useState({ name: "", role: "student", status: "active", country: "" });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      !search ||
      user.name?.toLowerCase().includes(search.toLowerCase()) ||
      user.email?.toLowerCase().includes(search.toLowerCase());
    const matchesRole = roleFilter === "all" || user.role?.toLowerCase() === roleFilter;
    const matchesStatus = statusFilter === "all" || user.status?.toLowerCase() === statusFilter;
    return matchesSearch && matchesRole && matchesStatus;
  });

  const startEditing = (user) => {
    setEditingUserId(user.id);
    setDraft({
      name: user.name || "",
      role: user.role?.toLowerCase() || "student",
      status: user.status?.toLowerCase() || "active",
      country: user.country || "",
    });
    setMessage("");
    setError("");
  };

  const saveUser = async () => {
    if (!editingUserId) return;
    setMessage("");
    setError("");

    try {
      await onUpdateUser(editingUserId, draft);
      setEditingUserId(null);
      setMessage(t("admin.userSaved"));
    } catch (saveError) {
      console.error("Saving the admin user edit failed:", saveError);
      setError(saveError.message || t("admin.savingUserFailed"));
    }
  };

  return (
    <section className="section-card">
      <div className="section-heading">
        <div>
          <span className="eyebrow">{t("admin.userManagement")}</span>
          <h2>{t("admin.allUsers")}</h2>
          <p>{t("admin.manageAccess")}</p>
        </div>
        <span className="count-badge">{t("admin.usersCount", { count: filteredUsers.length })}</span>
      </div>

      <div className="filters-row">
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("admin.searchUsers")} />
        <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
          <option value="all">{t("admin.allRoles")}</option>
          <option value="admin">{t("roles.Admin")}</option>
          <option value="student">{t("roles.Student")}</option>
        </select>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
          <option value="all">{t("admin.allStatuses")}</option>
          <option value="active">{t("status.active")}</option>
          <option value="inactive">{t("status.inactive")}</option>
          <option value="suspended">{t("status.suspended")}</option>
        </select>
      </div>

      {message ? <small className="field-note">{message}</small> : null}
      {error ? <small className="field-note danger-text">{error}</small> : null}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>{t("admin.name")}</th>
              <th>{t("admin.email")}</th>
              <th>{t("admin.role")}</th>
              <th>{t("common.status")}</th>
              <th>{t("common.country")}</th>
              <th>{t("admin.createdAt")}</th>
              <th>{t("admin.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((user) => {
              const isEditing = editingUserId === user.id;
              return (
                <tr key={user.id}>
                  <td>{isEditing ? <input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} /> : <strong>{user.name}</strong>}</td>
                  <td>{user.email}</td>
                  <td>
                    {isEditing ? (
                      <select value={draft.role} onChange={(event) => setDraft((current) => ({ ...current, role: event.target.value }))}>
                        <option value="admin">{t("roles.Admin")}</option>
                        <option value="student">{t("roles.Student")}</option>
                      </select>
                    ) : (
                      <span className="subtle-badge">{user.role}</span>
                    )}
                  </td>
                  <td>
                    {isEditing ? (
                      <select value={draft.status} onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value }))}>
                        <option value="active">{t("status.active")}</option>
                        <option value="inactive">{t("status.inactive")}</option>
                        <option value="suspended">{t("status.suspended")}</option>
                      </select>
                    ) : (
                      <Status status={user.status} />
                    )}
                  </td>
                  <td>
                    {isEditing ? <input value={draft.country} onChange={(event) => setDraft((current) => ({ ...current, country: event.target.value }))} placeholder={t("common.country")} /> : user.country || "—"}
                  </td>
                  <td>{user.created_at || user.createdAt ? formatDisplayDate(user.created_at || user.createdAt, language) : "—"}</td>
                  <td>
                    <div className="table-actions">
                      {isEditing ? (
                        <>
                          <button onClick={() => void saveUser()}>{t("common.save")}</button>
                          <button onClick={() => setEditingUserId(null)}>{t("common.cancel")}</button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => startEditing(user)}>{t("common.edit")}</button>
                          <button onClick={() => void onUpdateUserStatus(user.id, "Active")}>{t("admin.activate")}</button>
                          <button onClick={() => void onUpdateUserStatus(user.id, "Inactive")}>{t("admin.deactivate")}</button>
                          <button onClick={() => void onUpdateUserStatus(user.id, "suspended")}>{t("auth.suspendUser")}</button>
                          <button className="danger-text" onClick={() => void onDeleteUser(user.id)}>{t("common.delete")}</button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function UsersAdminPanel({ users, showAuthTestTools, onUpdateUserStatus, onUpdateUser, onCreateUser, onResetUserPassword, onDeleteUser }) {
  const { t, language, translateRole } = useLanguage();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editingUserId, setEditingUserId] = useState(null);
  const [draft, setDraft] = useState(createUserDraft());
  const [createDraftState, setCreateDraftState] = useState(createUserDraft());
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [passwordOwner, setPasswordOwner] = useState("");
  const [isSimulationMode, setIsSimulationMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resettingUserId, setResettingUserId] = useState(null);
  const [deletingUserId, setDeletingUserId] = useState(null);
  const [statusUpdatingUserId, setStatusUpdatingUserId] = useState(null);
  const [pendingDeleteUser, setPendingDeleteUser] = useState(null);

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      !search ||
      user.name?.toLowerCase().includes(search.toLowerCase()) ||
      user.email?.toLowerCase().includes(search.toLowerCase()) ||
      user.username?.toLowerCase().includes(search.toLowerCase());
    const matchesRole = roleFilter === "all" || (user.roleKey ?? user.role?.toLowerCase()) === roleFilter;
    const matchesStatus = statusFilter === "all" || (user.statusKey ?? user.status?.toLowerCase()) === statusFilter;
    return matchesSearch && matchesRole && matchesStatus;
  });

  const startEditing = (user) => {
    setEditingUserId(user.id);
    setDraft({
      name: user.name || "",
      email: user.email || "",
      username: user.username || "",
      role: user.roleKey || user.role?.toLowerCase() || "student",
      status: user.statusKey || user.status?.toLowerCase() || "active",
      country: user.country || "",
      bio: user.bio || "",
      profile_picture_url: user.profile_picture_url || user.profilePictureUrl || "",
    });
    setMessage("");
    setError("");
  };

  const saveUser = async () => {
    if (!editingUserId) return;
    setSaving(true);
    setMessage("");
    setError("");

    try {
      await onUpdateUser(editingUserId, draft);
      setEditingUserId(null);
      setMessage(t("admin.userSaved"));
    } catch (saveError) {
      console.error("Saving the admin user edit failed:", saveError);
      setError(saveError.message || t("admin.savingUserFailed"));
    } finally {
      setSaving(false);
    }
  };

  const createUser = async (mode = "demo") => {
    setSaving(true);
    setMessage("");
    setError("");
    setTemporaryPassword("");
    setPasswordOwner("");
    setIsSimulationMode(false);

    try {
      const result = await onCreateUser(
        {
          ...createDraftState,
          language,
        },
        { productionOnboardingTest: mode === "production" },
      );
      setCreateDraftState(createUserDraft());
      setMessage(
        mode === "production"
          ? result?.emailSent
            ? t("auth.temporaryPasswordEmailSent")
            : t("auth.emailSimulationMode")
          : t("auth.userCreatedSuccessfully"),
      );
      setTemporaryPassword(result?.temporaryPassword || "");
      setPasswordOwner(result?.user?.email || result?.user?.name || "");
      setIsSimulationMode(Boolean(result?.simulationMode));
    } catch (createError) {
      console.error("Creating the admin-managed user failed:", createError);
      const details = `${createError?.message ?? ""}`.toLowerCase();
      const isFunctionIssue =
        mode === "production" &&
        (createError?.code === "PRODUCTION_AUTH_FUNCTION_ERROR" ||
          details.includes("function") ||
          details.includes("non-2xx") ||
          details.includes("edge function") ||
          details.includes("not authenticated") ||
          details.includes("authorization") ||
          details.includes("supabase function"));
      setError(isFunctionIssue ? t("auth.productionFunctionNotConfigured") : createError.message || t("auth.userCreateFailed"));
    } finally {
      setSaving(false);
    }
  };

  const resetPassword = async (user, mode = "demo") => {
    setResettingUserId(user.id);
    setMessage("");
    setError("");
    setTemporaryPassword("");
    setPasswordOwner("");
    setIsSimulationMode(false);

    try {
      const customTemporaryPassword =
        window.prompt(t("auth.optionalResetPasswordPrompt"), "")?.trim() || "";
      const result = await onResetUserPassword(user.id, customTemporaryPassword, {
        productionOnboardingTest: mode === "production",
        language,
      });
      setMessage(
        mode === "production"
          ? result?.emailSent
            ? t("auth.accessEmailSent")
            : t("auth.emailSimulationMode")
          : t("auth.passwordResetSuccess"),
      );
      setTemporaryPassword(result?.temporaryPassword || "");
      setPasswordOwner(user.email || user.name || "");
      setIsSimulationMode(Boolean(result?.simulationMode));
    } catch (resetError) {
      console.error("Resetting the admin-managed password failed:", resetError);
      const details = `${resetError?.message ?? ""}`.toLowerCase();
      const isFunctionIssue =
        mode === "production" &&
        (resetError?.code === "PRODUCTION_AUTH_FUNCTION_ERROR" ||
          details.includes("function") ||
          details.includes("non-2xx") ||
          details.includes("edge function") ||
          details.includes("not authenticated") ||
          details.includes("authorization") ||
          details.includes("supabase function"));
      setError(isFunctionIssue ? t("auth.productionFunctionNotConfigured") : resetError.message || t("auth.passwordResetFailed"));
    } finally {
      setResettingUserId(null);
    }
  };

  const copyTemporaryPassword = async () => {
    if (!temporaryPassword) return;
    await navigator.clipboard.writeText(temporaryPassword);
    setMessage(t("auth.passwordCopied"));
  };

  const requestDeleteUser = (user) => {
    setMessage("");
    setError("");
    setPendingDeleteUser(user);
  };

  const confirmDeleteUser = async () => {
    if (!pendingDeleteUser) return;

    setDeletingUserId(pendingDeleteUser.id);
    setMessage("");
    setError("");

    try {
      const result = await onDeleteUser(pendingDeleteUser.id);
      setMessage(result?.softDeleted ? t("common.userDeactivatedSuccessfully") : t("common.userDeletedSuccessfully"));
      setPendingDeleteUser(null);
    } catch (deleteError) {
      console.error("Deleting the admin-managed user failed:", deleteError);
      setError(
        deleteError?.code === "PROTECTED_DEMO_USER"
          ? t("common.protectedDemoUsers")
          : deleteError?.message || t("common.userDeleteFailed"),
      );
    } finally {
      setDeletingUserId(null);
    }
  };

  const applyStatusChange = async (user, nextStatus) => {
    setStatusUpdatingUserId(user.id);
    setMessage("");
    setError("");

    try {
      await onUpdateUserStatus(user.id, nextStatus);
      setMessage(
        nextStatus === "inactive"
          ? t("common.userDeactivatedSuccessfully")
          : nextStatus === "active"
            ? t("admin.activate")
            : t("auth.suspendUser"),
      );
    } catch (statusError) {
      console.error("Updating the admin-managed user status failed:", statusError);
      setError(
        statusError?.code === "PROTECTED_DEMO_USER"
          ? t("common.protectedDemoUsers")
          : statusError?.message || t("common.userDeleteFailed"),
      );
    } finally {
      setStatusUpdatingUserId(null);
    }
  };

  return (
    <div className="stack-layout">
      <section className="section-card">
        <div className="section-heading">
          <div>
            <span className="eyebrow">{t("admin.userManagement")}</span>
            <h2>{t("auth.newUser")}</h2>
            <p>{t("admin.manageAccess")}</p>
          </div>
          <span className="count-badge">{t("admin.usersCount", { count: filteredUsers.length })}</span>
        </div>

        <form className="admin-user-form-grid" onSubmit={(event) => event.preventDefault()}>
          <label>
            {t("auth.name")}
            <input value={createDraftState.name} onChange={(event) => setCreateDraftState((current) => ({ ...current, name: event.target.value }))} required />
          </label>
          <label>
            {t("auth.email")}
            <input type="email" value={createDraftState.email} onChange={(event) => setCreateDraftState((current) => ({ ...current, email: event.target.value }))} required />
          </label>
          <label>
            {t("auth.username")}
            <input value={createDraftState.username} onChange={(event) => setCreateDraftState((current) => ({ ...current, username: event.target.value }))} />
          </label>
          <label>
            {t("auth.role")}
            <select value={createDraftState.role} onChange={(event) => setCreateDraftState((current) => ({ ...current, role: event.target.value }))}>
              <option value="student">{translateRole("student")}</option>
              <option value="admin">{translateRole("admin")}</option>
              <option value="instructor">{translateRole("instructor")}</option>
              <option value="support">{translateRole("support")}</option>
            </select>
          </label>
          <label>
            {t("auth.status")}
            <select value={createDraftState.status} onChange={(event) => setCreateDraftState((current) => ({ ...current, status: event.target.value }))}>
              <option value="active">{t("status.active")}</option>
              <option value="inactive">{t("status.inactive")}</option>
              <option value="suspended">{t("status.suspended")}</option>
            </select>
          </label>
          <label>
            {t("auth.country")}
            <input value={createDraftState.country} onChange={(event) => setCreateDraftState((current) => ({ ...current, country: event.target.value }))} />
          </label>
          <label className="wide-field">
            {t("auth.bio")}
            <textarea rows="3" value={createDraftState.bio} onChange={(event) => setCreateDraftState((current) => ({ ...current, bio: event.target.value }))} />
          </label>
          <label className="wide-field">
            {t("common.profilePicture")}
            <input value={createDraftState.profile_picture_url} onChange={(event) => setCreateDraftState((current) => ({ ...current, profile_picture_url: event.target.value }))} placeholder="https://..." />
          </label>

          <div className="form-actions">
            <button type="button" className="primary-btn" disabled={saving} onClick={() => void createUser("demo")}>
              {saving ? t("common.saving") : t("auth.saveUser")}
            </button>
            {showAuthTestTools ? (
              <button type="button" className="secondary-btn" disabled={saving} onClick={() => void createUser("production")}>
                {t("auth.createProductionUser")}
              </button>
            ) : null}
          </div>
        </form>

        {message ? <small className="field-note">{message}</small> : null}
        {error ? <small className="field-note danger-text">{error}</small> : null}

        {temporaryPassword ? (
          <div className="credential-card">
            <strong>{isSimulationMode ? t("auth.emailSimulationMode") : t("auth.temporaryCredentials")}</strong>
            <p>{passwordOwner}</p>
            <code>{temporaryPassword}</code>
            {isSimulationMode ? <small className="field-note">{t("auth.testingOnlyTemporaryPassword")}</small> : null}
            <div className="form-actions compact">
              <button type="button" onClick={() => void copyTemporaryPassword()}>
                {t("auth.copyPassword")}
              </button>
            </div>
          </div>
        ) : null}

        {showAuthTestTools ? (
          <div className="credential-card">
            <strong>{t("auth.productionOnboardingTools")}</strong>
            <p>{t("auth.productionToolsHelp")}</p>
            <div className="form-actions compact">
              <button type="button" onClick={() => window.open(ROUTES.auth.setupPreview, "_blank", "noopener,noreferrer")}>
                {t("auth.previewFirstTimeSetup")}
              </button>
            </div>
          </div>
        ) : null}
      </section>

      <section className="section-card">
        <div className="filters-row user-filters-row">
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("admin.searchUsers")} />
          <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
            <option value="all">{t("admin.allRoles")}</option>
            <option value="admin">{translateRole("admin")}</option>
            <option value="student">{translateRole("student")}</option>
            <option value="instructor">{translateRole("instructor")}</option>
            <option value="support">{translateRole("support")}</option>
          </select>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="all">{t("admin.allStatuses")}</option>
            <option value="active">{t("status.active")}</option>
            <option value="inactive">{t("status.inactive")}</option>
            <option value="suspended">{t("status.suspended")}</option>
          </select>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t("auth.name")}</th>
                <th>{t("auth.email")}</th>
                <th>{t("auth.username")}</th>
                <th>{t("auth.role")}</th>
                <th>{t("auth.status")}</th>
                <th>{t("auth.country")}</th>
                <th>{t("auth.mustChangePassword")}</th>
                <th>{t("auth.lastLoginAt")}</th>
                <th>{t("admin.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => {
                const isEditing = editingUserId === user.id;
                return (
                  <tr key={user.id}>
                    <td>
                      {isEditing ? (
                        <input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} />
                      ) : (
                        <strong>{user.name}</strong>
                      )}
                    </td>
                    <td>{user.email}</td>
                    <td>
                      {isEditing ? (
                        <input value={draft.username} onChange={(event) => setDraft((current) => ({ ...current, username: event.target.value }))} />
                      ) : (
                        user.username || "—"
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <select value={draft.role} onChange={(event) => setDraft((current) => ({ ...current, role: event.target.value }))}>
                          <option value="admin">{translateRole("admin")}</option>
                          <option value="student">{translateRole("student")}</option>
                          <option value="instructor">{translateRole("instructor")}</option>
                          <option value="support">{translateRole("support")}</option>
                        </select>
                      ) : (
                        <span className="subtle-badge">{translateRole(user.roleKey || user.role)}</span>
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <select value={draft.status} onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value }))}>
                          <option value="active">{t("status.active")}</option>
                          <option value="inactive">{t("status.inactive")}</option>
                          <option value="suspended">{t("status.suspended")}</option>
                        </select>
                      ) : (
                        <Status status={user.statusKey || user.status} />
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <input value={draft.country} onChange={(event) => setDraft((current) => ({ ...current, country: event.target.value }))} placeholder={t("common.country")} />
                      ) : (
                        user.country || "—"
                      )}
                    </td>
                    <td>
                      <span className={`subtle-badge ${user.mustChangePassword ? "warning-badge" : ""}`}>
                        {user.mustChangePassword ? t("common.yes") : t("common.no")}
                      </span>
                    </td>
                    <td>{user.last_login_at || user.lastLoginAt ? formatDisplayDate(user.last_login_at || user.lastLoginAt, language) : "—"}</td>
                    <td>
                      <div className="table-actions">
                        {isEditing ? (
                          <>
                            <button onClick={() => void saveUser()} disabled={saving}>{t("common.save")}</button>
                            <button onClick={() => setEditingUserId(null)}>{t("common.cancel")}</button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => startEditing(user)}>{t("common.edit")}</button>
                            <button onClick={() => void resetPassword(user)} disabled={resettingUserId === user.id}>{t("auth.resetPassword")}</button>
                            {showAuthTestTools ? (
                              <button onClick={() => void resetPassword(user, "production")} disabled={resettingUserId === user.id}>
                                {t("auth.sendNewTemporaryPassword")}
                              </button>
                            ) : null}
                            <button onClick={() => void applyStatusChange(user, "active")} disabled={statusUpdatingUserId === user.id}>{t("admin.activate")}</button>
                            <button onClick={() => void applyStatusChange(user, "inactive")} disabled={statusUpdatingUserId === user.id}>{t("admin.deactivate")}</button>
                            <button onClick={() => void applyStatusChange(user, "suspended")} disabled={statusUpdatingUserId === user.id}>{t("auth.suspendUser")}</button>
                            <button className="danger-text" onClick={() => requestDeleteUser(user)}>
                              {t("common.delete")}
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {pendingDeleteUser ? (
        <div className="modal-backdrop" onMouseDown={() => setPendingDeleteUser(null)}>
          <div className="certificate-modal confirm-modal" onMouseDown={(event) => event.stopPropagation()}>
            <button className="modal-close" type="button" onClick={() => setPendingDeleteUser(null)}>×</button>
            <span className="eyebrow">{t("common.deleteUser")}</span>
            <h2>{t("common.confirmDeleteUserTitle")}</h2>
            <p>{t("common.confirmDeleteUserBody")}</p>
            <p><strong>{pendingDeleteUser.name}</strong> · {pendingDeleteUser.email}</p>
            <div className="form-actions compact confirm-modal-actions">
              <button type="button" className="secondary-btn" onClick={() => setPendingDeleteUser(null)}>
                {t("common.cancel")}
              </button>
              <button
                type="button"
                className="primary-btn"
                disabled={deletingUserId === pendingDeleteUser.id}
                onClick={() => void confirmDeleteUser()}
              >
                {deletingUserId === pendingDeleteUser.id ? t("common.saving") : t("common.deleteUser")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ModuleEditor({
  module,
  index,
  t,
  collapsed,
  toggleCollapsed,
  updateModule,
  updateAssignment,
  deleteModule,
  enableAssignment,
  disableAssignment,
  uploadPdf,
  uploadVideo,
}) {
  return (
    <article className="module-editor-card" key={module.id}>
      <div className="module-editor-head">
        <div>
          <span className="count-badge">{t("admin.moduleNumber", { number: index + 1 })}</span>
          <h4>{module.title.trim() || t("admin.newModule")}</h4>
        </div>
        <div className="module-editor-actions">
          <button type="button" className="text-button compact-toggle" onClick={() => toggleCollapsed(module.id)}>
            {collapsed ? t("common.expand") : t("common.collapse")}
          </button>
          <button type="button" className="danger-text mini-action" onClick={() => deleteModule(module.id)}>
            {t("admin.deleteModule")}
          </button>
        </div>
      </div>

      {collapsed ? (
        <div className="module-editor-summary">
          <span>{module.description?.trim() || t("admin.whatCoveredInModule")}</span>
          <div className="row-actions">
            <span className="subtle-badge">{module.pdf_url || module.pdfUrl ? "PDF" : t("common.noPdfSelected")}</span>
            <span className="subtle-badge">
              {module.video_url || module.videoUrl || module.video?.link?.trim() ? "Video" : t("common.noVideoSelected")}
            </span>
            <span className="subtle-badge">
              {module.requiresAssignment || module.requires_assignment ? t("common.requiresAssignment") : t("common.noAssignmentRequired")}
            </span>
          </div>
        </div>
      ) : (
        <>
      <div className="module-editor-grid">
        <label>
          {t("admin.moduleTitle")}
          <input
            required
            value={module.title}
            onChange={(event) =>
              updateModule(module.id, (currentModule) => ({
                ...currentModule,
                title: event.target.value,
              }))
            }
            placeholder={t("admin.moduleTitle")}
          />
        </label>

        <label>
          {t("admin.moduleDescription")}
          <textarea
            rows="3"
            value={module.description}
            onChange={(event) =>
              updateModule(module.id, (currentModule) => ({
                ...currentModule,
                description: event.target.value,
              }))
            }
            placeholder={t("admin.whatCoveredInModule")}
          />
        </label>
      </div>

      <section className="nested-builder single-video-builder">
        <div className="nested-header">
          <span className="eyebrow">PDF</span>
          <h5>{module.pdf_url || module.pdfUrl ? module.pdfLabel : module.pdfPendingName || module.pdfLabel}</h5>
        </div>

        <label className="upload-field">
          {t("common.uploadPdf")}
          <input id={`module-pdf-${module.id}`} type="file" accept={PDF_ACCEPT} onChange={(event) => void uploadPdf(module.id, event.target.files?.[0])} />
        </label>

        {module.pdfUploading && <small className="field-note">{t("common.uploadingPdf")}</small>}
        {module.pdfError && <small className="field-note danger-text">{module.pdfError}</small>}
        {module.pdfPendingName && !module.pdf_url && !module.pdfUrl ? (
          <small className="field-note">
            {t("common.selectedFile", {
              name: `${module.pdfPendingName}${module.pdfPendingSize ? ` (${formatFileSize(module.pdfPendingSize)})` : ""}`,
            })}
          </small>
        ) : null}

        {module.pdf_url || module.pdfUrl ? (
          <a href={module.pdf_url || module.pdfUrl} target="_blank" rel="noreferrer">{t("common.openPdf")}</a>
        ) : module.pdfPendingName ? (
          <small className="field-note">{t("common.noPdfUploadedYet")}</small>
        ) : (
          <small className="field-note">{t("common.noPdfUploadedYet")}</small>
        )}

        <div className="row-actions">
          <button type="button" onClick={() => document.getElementById(`module-pdf-${module.id}`)?.click()}>
            {t("common.replacePdf")}
          </button>
          {module.pdfFile && module.pdfError ? (
            <button type="button" onClick={() => void uploadPdf(module.id)}>
              {t("common.retryUpload")}
            </button>
          ) : null}
          <button
            type="button"
            className="danger-text"
            onClick={() =>
              updateModule(module.id, (currentModule) => ({
                ...currentModule,
                pdfUrl: "",
                pdf_url: "",
                pdfLabel: NO_PDF_SELECTED,
                pdfName: "",
                pdf_file_name: "",
                pdfStoragePath: "",
                pdf_storage_path: "",
                pdfFile: null,
                pdfPendingName: "",
                pdfPendingSize: null,
                pdfError: "",
              }))
            }
          >
            {t("common.removePdf")}
          </button>
        </div>
      </section>

      <section className="nested-builder single-video-builder">
        <div className="nested-header">
          <span className="eyebrow">VIDEO</span>
          <h5>{module.video_url || module.videoUrl ? module.video.uploadLabel : module.videoPendingName || module.video.link || t("common.noVideoSelected")}</h5>
        </div>

        <label className="upload-field">
          {t("common.uploadVideo")}
          <input id={`module-video-${module.id}`} type="file" accept={VIDEO_ACCEPT} onChange={(event) => void uploadVideo(module.id, event.target.files?.[0])} />
        </label>

        {module.video.uploading && <small className="field-note">{t("common.uploadingVideo")}</small>}
        {module.video.error && <small className="field-note danger-text">{module.video.error}</small>}
        {module.videoPendingName && !module.video_url && !module.videoUrl ? (
          <small className="field-note">
            {t("common.selectedFile", {
              name: `${module.videoPendingName}${module.videoPendingSize ? ` (${formatFileSize(module.videoPendingSize)})` : ""}`,
            })}
          </small>
        ) : null}

        {module.video_url || module.videoUrl ? (
          <>
            <a href={module.video_url || module.videoUrl} target="_blank" rel="noreferrer">{t("common.openVideo")}</a>
            <div className="video-player-shell">
              <video controls width="100%" src={module.video_url || module.videoUrl} />
            </div>
          </>
        ) : module.video.link ? (
          <a href={module.video.link} target="_blank" rel="noreferrer">{t("common.openVideo")}</a>
        ) : module.videoPendingName ? (
          <small className="field-note">{t("common.noVideoUploadedYet")}</small>
        ) : (
          <small className="field-note">{t("common.noVideoUploadedYet")}</small>
        )}

        <label>
          {t("common.optionalVideoLink")}
          <input
            value={module.video.link}
            onChange={(event) =>
              updateModule(module.id, (currentModule) => ({
                ...currentModule,
                videoUrl: event.target.value,
                video_url: event.target.value,
                videoFile: event.target.value ? null : currentModule.videoFile,
                videoPendingName: event.target.value ? "" : currentModule.videoPendingName,
                videoPendingSize: event.target.value ? null : currentModule.videoPendingSize,
                video: {
                  ...currentModule.video,
                  link: event.target.value,
                  url: event.target.value,
                  error: event.target.value ? "" : currentModule.video.error,
                },
              }))
            }
            placeholder="https://example.com/video"
          />
        </label>
        <small className="field-note">{t("admin.externalVideoRecommendation")}</small>

        <div className="row-actions">
          <button type="button" onClick={() => document.getElementById(`module-video-${module.id}`)?.click()}>
            {t("common.replaceVideo")}
          </button>
          {module.videoFile && module.video.error ? (
            <button type="button" onClick={() => void uploadVideo(module.id)}>
              {t("common.retryUpload")}
            </button>
          ) : null}
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
                videoFile: null,
                videoPendingName: "",
                videoPendingSize: null,
                video: {
                  ...currentModule.video,
                  link: "",
                  url: "",
                  uploadLabel: NO_VIDEO_SELECTED,
                  error: "",
                },
              }))
            }
          >
            {t("common.removeVideo")}
          </button>
        </div>

        <small className="field-note">
          {module.video.link ? `Video link: ${module.video.link}` : t("common.noVideoLinkAdded")}
        </small>
      </section>

      <section className="nested-builder single-video-builder">
        <div className="nested-header">
          <span className="eyebrow">{t("admin.assignment")}</span>
          <h5>
            {module.requiresAssignment || module.requires_assignment
              ? module.assignment?.title?.trim() || t("admin.noAssignmentAdded")
              : t("common.noAssignmentRequired")}
          </h5>
        </div>

        <ToggleSwitch
          checked={Boolean(module.requiresAssignment || module.requires_assignment)}
          label={t("common.requiresAssignment")}
          onChange={(checked) =>
            updateModule(module.id, (currentModule) => ({
              ...currentModule,
              requiresAssignment: checked,
              requires_assignment: checked,
              assignment: checked
                ? {
                    ...(currentModule.assignment ?? createAssignmentDraft()),
                    submissionType: "file",
                    submission_type: "file",
                  }
                : null,
            }))
          }
        />

        {module.requiresAssignment || module.requires_assignment ? (
          <>
            <label>
              {t("admin.assignmentTitle")}
              <input
                value={module.assignment.title}
                onChange={(event) =>
                  updateAssignment(module.id, (assignment) => ({
                    ...assignment,
                    title: event.target.value,
                  }))
                }
                placeholder={t("admin.weeklyHomework")}
              />
            </label>

            <label>
              {t("common.instructions")}
              <textarea
                rows="4"
                value={module.assignment.instructions}
                onChange={(event) =>
                  updateAssignment(module.id, (assignment) => ({
                    ...assignment,
                    instructions: event.target.value,
                  }))
                }
                placeholder={t("admin.tellStudentsWhatToSubmit")}
              />
            </label>

            <label>
              {t("common.dueDate")}
              <input
                type="date"
                value={module.assignment.dueDate || module.assignment.due_date || ""}
                onChange={(event) =>
                  updateAssignment(module.id, (assignment) => ({
                    ...assignment,
                    dueDate: event.target.value,
                    due_date: event.target.value,
                  }))
                }
              />
            </label>

            <div className="assignment-mode-card">
              <span className="subtle-badge">{t("admin.fileUploadOnly")}</span>
              <p className="field-note">{t("admin.assignmentFileOnlyHelp")}</p>
            </div>

            <div className="row-actions">
              <button
                type="button"
                className="danger-text"
                onClick={() =>
                  updateModule(module.id, (currentModule) => ({
                    ...currentModule,
                    requiresAssignment: false,
                    requires_assignment: false,
                    assignment: null,
                  }))
                }
              >
                {t("common.doesNotRequireAssignment")}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="empty-copy">{t("common.noAssignmentRequired")}</p>
          </>
        )}
      </section>
        </>
      )}
    </article>
  );
}

function PostCoursesPage({ courses, onSaveCourse, onDeleteCourse, onUpdateCourseVisibility }) {
  const { t, language, translateSubmissionType } = useLanguage();
  const [form, setForm] = useState(createCourseDraft());
  const [editingId, setEditingId] = useState(null);
  const [bulkModuleCount, setBulkModuleCount] = useState("1");
  const [bulkGeneratorError, setBulkGeneratorError] = useState("");
  const [generatorDialog, setGeneratorDialog] = useState(null);
  const [saveError, setSaveError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [draftMessage, setDraftMessage] = useState("");
  const [draftWarning, setDraftWarning] = useState("");
  const [publishProgress, setPublishProgress] = useState("");
  const [visibilityMessage, setVisibilityMessage] = useState("");
  const [visibilityError, setVisibilityError] = useState("");
  const [statusUpdatingId, setStatusUpdatingId] = useState(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [draftReady, setDraftReady] = useState(false);
  const [collapsedModuleIds, setCollapsedModuleIds] = useState([]);

  const isUploadingNow =
    Boolean(form.imageUploading) ||
    (form.modules || []).some((module) => module.pdfUploading || module.video?.uploading);
  const isBusy = isUploadingNow || isPublishing;

  const hasExistingModuleContent = (form.modules || []).some((module) =>
    Boolean(
      module.title?.trim() ||
      module.description?.trim() ||
      module.pdf_url ||
      module.pdfPendingName ||
      module.video_url ||
      module.video?.link?.trim() ||
      module.videoPendingName ||
      module.requiresAssignment ||
      module.requires_assignment ||
      module.assignment?.title?.trim() ||
      module.assignment?.instructions?.trim(),
    ),
  );

  const updateCourseField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const updateModule = (moduleId, updater) => {
    setForm((current) => ({
      ...current,
      modules: current.modules.map((module) => (module.id === moduleId ? updater(module) : module)),
    }));
  };

  const updateAssignment = (moduleId, updater) => {
    updateModule(moduleId, (module) => ({
      ...module,
      assignment: updater(module.assignment ?? createAssignmentDraft()),
    }));
  };

  const addModule = () => {
    setForm((current) => ({
      ...current,
      modules: [...current.modules, createModuleDraft(current.modules.length + 1)],
    }));
    setCollapsedModuleIds((current) => current.filter(Boolean));
  };

  const deleteModule = (moduleId) => {
    setForm((current) => ({
      ...current,
      modules: current.modules.filter((module) => module.id !== moduleId).map((module, index) => ({ ...module, sortOrder: index + 1 })),
    }));
    setCollapsedModuleIds((current) => current.filter((id) => id !== moduleId));
  };

  const toggleCollapsed = (moduleId) => {
    setCollapsedModuleIds((current) => (current.includes(moduleId) ? current.filter((id) => id !== moduleId) : [...current, moduleId]));
  };

  const collapseAllModules = () => {
    setCollapsedModuleIds((form.modules || []).map((module) => module.id));
  };

  const expandAllModules = () => {
    setCollapsedModuleIds([]);
  };

  const enableAssignment = (moduleId) => {
    updateModule(moduleId, (module) => ({ ...module, assignment: module.assignment ?? createAssignmentDraft() }));
  };

  const disableAssignment = (moduleId) => {
    updateModule(moduleId, (module) => ({ ...module, assignment: null }));
  };

  const editCourse = (course) => {
    setEditingId(course.id);
    setForm(createCourseDraft(course));
    setDraftMessage("");
    setDraftWarning("");
    setSaveMessage("");
    setSaveError("");
    setBulkGeneratorError("");
    setCollapsedModuleIds(createCollapsedModuleIds(course.modules || [], (course.modules || []).length > 12));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const reset = () => {
    setForm(createCourseDraft());
    setEditingId(null);
    setBulkModuleCount("1");
    setBulkGeneratorError("");
    setGeneratorDialog(null);
    setCollapsedModuleIds([]);
    setSaveError("");
    setPublishProgress("");
  };

  useEffect(() => {
    try {
      const rawDraft = window.localStorage.getItem(COURSE_DRAFT_STORAGE_KEY);
      if (!rawDraft) {
        setDraftReady(true);
        return;
      }

      const parsedDraft = JSON.parse(rawDraft);
      if (!parsedDraft?.form) {
        setDraftReady(true);
        return;
      }

      const restoredForm = restoreCourseDraft(parsedDraft.form);
      const hasPendingReselection = restoredForm.modules.some(
        (module) => module.pdfPendingName || module.videoPendingName,
      );

      setForm(restoredForm);
      setEditingId(parsedDraft.editingId ?? null);
      setBulkModuleCount(String((restoredForm.modules || []).length || 1));
      setCollapsedModuleIds(createCollapsedModuleIds(restoredForm.modules || [], (restoredForm.modules || []).length > 12));
      setDraftMessage(t("admin.restoredDraft"));
      if (hasPendingReselection) {
        setDraftWarning(t("admin.reselectFilesAfterRestore"));
      }
    } catch (error) {
      console.error("Restoring the unpublished course draft failed:", error);
    } finally {
      setDraftReady(true);
    }
  }, []);

  useEffect(() => {
    if (!draftReady) return;

    const hasContent =
      Boolean(form.title.trim()) ||
      Boolean(form.description.trim()) ||
      Boolean(form.image_url || form.imageUrl || form.imageLabel) ||
      (form.modules || []).some((module) =>
        Boolean(
          module.title?.trim() ||
          module.description?.trim() ||
          module.pdf_url ||
          module.pdfPendingName ||
          module.video_url ||
          module.video?.link?.trim() ||
          module.videoPendingName ||
          module.requiresAssignment ||
          module.requires_assignment ||
          module.assignment?.title?.trim() ||
          module.assignment?.instructions?.trim(),
        ),
      );

    if (!hasContent) return;

    try {
      window.localStorage.setItem(
        COURSE_DRAFT_STORAGE_KEY,
        JSON.stringify({
          editingId,
          form: createSerializableCourseDraft(form),
          updatedAt: new Date().toISOString(),
        }),
      );
    } catch (error) {
      console.error("Saving the unpublished course draft failed:", error);
    }
  }, [draftReady, editingId, form]);

  useEffect(() => {
    if (!isBusy) return undefined;

    const handleBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isBusy]);

  const discardDraft = () => {
    try {
      window.localStorage.removeItem(COURSE_DRAFT_STORAGE_KEY);
    } catch (error) {
      console.error("Discarding the unpublished course draft failed:", error);
    }

    setDraftMessage("");
    setDraftWarning("");
    reset();
  };

  const previewCourse = buildCoursePayload(form, editingId, courses.find((course) => course.id === editingId));

  const applyGeneratedModules = (count) => {
    const nextModules = createGeneratedModules(count, language);
    const shouldCollapse = count > 12;

    window.requestAnimationFrame(() => {
      setForm((current) => ({
        ...current,
        modules: nextModules,
      }));
      setBulkModuleCount(String(count));
      setBulkGeneratorError("");
      setCollapsedModuleIds(createCollapsedModuleIds(nextModules, shouldCollapse));
    });
  };

  const continueBulkGeneration = (count) => {
    setGeneratorDialog(null);
    applyGeneratedModules(count);
  };

  const generateModules = () => {
    const normalizedCount = clampModuleCount(bulkModuleCount);

    if (!normalizedCount) {
      setBulkGeneratorError(t("admin.bulkModuleCountValidation"));
      return;
    }

    setBulkGeneratorError("");

    if (normalizedCount > 30) {
      setGeneratorDialog({ type: "large-course", count: normalizedCount });
      return;
    }

    if (hasExistingModuleContent) {
      setGeneratorDialog({ type: "replace-modules", count: normalizedCount });
      return;
    }

    continueBulkGeneration(normalizedCount);
  };

  const handleGeneratorContinue = () => {
    if (!generatorDialog) return;

    if (generatorDialog.type === "large-course") {
      if (hasExistingModuleContent) {
        setGeneratorDialog({ type: "replace-modules", count: generatorDialog.count });
        return;
      }

      continueBulkGeneration(generatorDialog.count);
      return;
    }

    continueBulkGeneration(generatorDialog.count);
  };

  const submit = (event) => {
    event.preventDefault();
    setSaveError("");
    setSaveMessage("");
    setVisibilityMessage("");
    setVisibilityError("");
    setDraftMessage("");
    setDraftWarning("");

    if (isBusy) return;

    const invalidModule = form.modules.find((module) => {
      const hasPdf = Boolean(module.pdf_url || module.pdfUrl);
      const hasVideo = Boolean(module.video_url || module.videoUrl || module.video?.link?.trim());
      return !hasPdf || !hasVideo || module.pdfPendingName || module.videoPendingName || module.pdfUploading || module.video?.uploading;
    });

    if (invalidModule) {
      setSaveError(
        invalidModule.pdfPendingName || invalidModule.videoPendingName
          ? t("admin.reselectFilesAfterRestore")
          : t("admin.completeModuleFilesBeforePublishing", {
              moduleTitle: invalidModule.title || t("common.module"),
            }),
      );
      return;
    }

    const existingCourse = courses.find((course) => course.id === editingId);
    const payload = buildCoursePayload(form, editingId, existingCourse);
    console.log("Module payload right before saving:", payload.modules);

    setIsPublishing(true);

    void Promise.resolve(
      onSaveCourse(payload, editingId, {
        onProgress: ({ current, total }) => {
          setPublishProgress(t("admin.uploadingModuleProgress", { current, total }));
        },
      }),
    )
      .then((result) => {
        if (result?.ok === false) {
          setSaveError(result.error || t("admin.savingCourseFailed"));
          return;
        }

        try {
          window.localStorage.removeItem(COURSE_DRAFT_STORAGE_KEY);
        } catch (error) {
          console.error("Clearing the unpublished course draft after publish failed:", error);
        }

        setSaveMessage(editingId ? t("admin.courseUpdatedSuccessfully") : t("admin.coursePublishedSuccessfully"));
        reset();
      })
      .catch((error) => {
        console.error("Course save failed:", error);
        setSaveError(error?.message || t("admin.savingCourseFailed"));
      })
      .finally(() => {
        setIsPublishing(false);
        setPublishProgress("");
      });
  };

  const changeCourseVisibility = async (course, visibleToStudents) => {
    setVisibilityMessage("");
    setVisibilityError("");
    setStatusUpdatingId(course.id);

    try {
      const result = await onUpdateCourseVisibility(course.id, visibleToStudents);
      if (result?.ok === false) {
        setVisibilityError(result.error || t("admin.updatingCourseVisibilityFailed"));
        return;
      }

      setVisibilityMessage(result?.message || t("admin.courseVisibilityUpdated"));
    } catch (error) {
      console.error("Course visibility update failed:", error);
      setVisibilityError(t("admin.updatingCourseVisibilityFailed"));
    } finally {
      setStatusUpdatingId(null);
    }
  };

  const uploadImage = async (file) => {
    if (!file) return;

    setForm((current) => ({
      ...current,
      imageUploading: true,
      imageError: "",
      imageLabel: file.name,
    }));

    try {
      const uploaded = await uploadCourseImage(file);
      setForm((current) => ({
        ...current,
        imageUploading: false,
        imageError: "",
        imageLabel: uploaded.fileName,
        imageUrl: uploaded.publicUrl,
        image_url: uploaded.publicUrl,
        imageStoragePath: uploaded.storagePath,
        image_storage_path: uploaded.storagePath,
      }));
    } catch (error) {
      console.error("Course image upload failed:", error);
      setForm((current) => ({
        ...current,
        imageUploading: false,
        imageError: error.message || t("admin.courseImageUploadFailed"),
      }));
    }
  };

  const uploadPdf = async (moduleId, file) => {
    const selectedFile = file ?? form.modules.find((module) => module.id === moduleId)?.pdfFile;
    if (!selectedFile) return;

    const moduleIndex = form.modules.findIndex((module) => module.id === moduleId);
    const moduleTitle = form.modules[moduleIndex]?.title || t("common.module");

    updateModule(moduleId, (module) => ({
      ...module,
      pdfUploading: true,
      pdfError: "",
      pdfFile: selectedFile,
      pdfPendingName: selectedFile.name,
      pdfPendingSize: selectedFile.size ?? null,
    }));

    try {
      const uploaded = await uploadModulePdf(selectedFile, moduleId);
      console.log("PDF upload result publicUrl:", uploaded.publicUrl);

      if (!uploaded.publicUrl) {
        const error = new Error(t("admin.uploadedMissingPublicUrlPdf"));
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
        pdfFile: null,
        pdfPendingName: "",
        pdfPendingSize: null,
      }));
    } catch (error) {
      console.error("PDF upload failed:", error);
      updateModule(moduleId, (module) => ({
        ...module,
        pdfUploading: false,
        pdfLabel: NO_PDF_SELECTED,
        pdfName: "",
        pdf_file_name: "",
        pdfStoragePath: "",
        pdf_storage_path: "",
        pdfUrl: "",
        pdf_url: "",
        pdfError:
          error.message ||
          t("admin.pdfUploadFailedInModule", {
            number: moduleIndex + 1,
            moduleTitle,
          }),
      }));
    }
  };

  const uploadVideo = async (moduleId, file) => {
    const selectedFile = file ?? form.modules.find((module) => module.id === moduleId)?.videoFile;
    if (!selectedFile) return;

    const moduleIndex = form.modules.findIndex((module) => module.id === moduleId);
    const moduleTitle = form.modules[moduleIndex]?.title || t("common.module");

    if ((selectedFile.size ?? 0) > MAX_VIDEO_SIZE_BYTES) {
      updateModule(moduleId, (module) => ({
        ...module,
        videoUrl: "",
        video_url: "",
        videoName: "",
        video_file_name: "",
        videoStoragePath: "",
        video_storage_path: "",
        videoFile: null,
        videoPendingName: selectedFile.name,
        videoPendingSize: selectedFile.size ?? null,
        video: {
          ...module.video,
          uploading: false,
          error: t("admin.videoTooLargeDirectUpload"),
          uploadLabel: NO_VIDEO_SELECTED,
        },
      }));
      return;
    }

    updateModule(moduleId, (module) => ({
      ...module,
      videoFile: selectedFile,
      videoPendingName: selectedFile.name,
      videoPendingSize: selectedFile.size ?? null,
      video: {
        ...module.video,
        uploading: true,
        error: "",
        uploadLabel: selectedFile.name,
      },
    }));

    try {
      const uploaded = await uploadModuleVideo(selectedFile, moduleId);
      console.log("Video upload result publicUrl:", uploaded.publicUrl);

      if (!uploaded.publicUrl) {
        const error = new Error(t("admin.uploadedMissingPublicUrlVideo"));
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
        videoFile: null,
        videoPendingName: "",
        videoPendingSize: null,
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
        videoUrl: "",
        video_url: "",
        videoName: "",
        video_file_name: "",
        videoStoragePath: "",
        video_storage_path: "",
        video: {
          ...module.video,
          uploading: false,
          error:
            error.message ||
            t("admin.videoUploadFailedInModule", {
              number: moduleIndex + 1,
              moduleTitle,
            }),
          uploadLabel: NO_VIDEO_SELECTED,
        },
      }));
    }
  };

  return (
    <div className="split-layout">
      <form className="section-card course-form" onSubmit={submit}>
        <div className="section-heading">
          <div>
            <span className="eyebrow">{editingId ? t("admin.editCourse") : t("admin.newCourse")}</span>
            <h2>{editingId ? t("admin.updateCourse") : t("admin.createAndPost")}</h2>
            <p>{t("admin.buildCourseStructure")}</p>
          </div>
        </div>

        <label>
          {t("admin.courseTitle")}
          <input required value={form.title} onChange={(event) => updateCourseField("title", event.target.value)} placeholder={t("admin.nutritionEssentials")} />
        </label>

        <label>
          {t("admin.courseDescription")}
          <textarea required rows="4" value={form.description} onChange={(event) => updateCourseField("description", event.target.value)} placeholder={t("admin.whatWillStudentsLearn")} />
        </label>

        <label>
          {t("common.courseImage")}
          <input type="file" accept="image/*" onChange={(event) => void uploadImage(event.target.files?.[0])} />
        </label>

        {form.imageUploading ? <small className="field-note">{t("common.uploading")}</small> : null}
        {form.imageError ? <small className="field-note danger-text">{form.imageError}</small> : null}
        {form.image_url || form.imageUrl ? (
          <div className="image-preview-shell">
            <img className="course-image-preview" src={form.image_url || form.imageUrl} alt={form.title || "Course image"} />
          </div>
        ) : null}

        <ToggleSwitch
          checked={isVisibleToStudents(form.status)}
          label={isVisibleToStudents(form.status) ? t("common.visibleToStudents") : t("common.hiddenFromStudents")}
          onChange={(checked) => updateCourseField("status", checked ? "published" : "draft")}
        />

        {saveError && <small className="field-note danger-text">{saveError}</small>}
        {saveMessage && <small className="field-note">{saveMessage}</small>}
        {draftMessage && <small className="field-note">{draftMessage}</small>}
        {draftWarning && <small className="field-note danger-text">{draftWarning}</small>}
        {publishProgress && <small className="field-note">{publishProgress}</small>}
        {isBusy ? <small className="field-note warning-badge">{t("admin.doNotCloseWhileUploading")}</small> : null}

        <div className="builder-stack">
          <div className="builder-header">
            <div>
              <span className="eyebrow">{t("admin.modules")}</span>
              <h3>{t("admin.moduleFiles")}</h3>
            </div>
            <div className="row-actions builder-actions">
              {(form.modules || []).length > 1 ? (
                <>
                  <button type="button" onClick={expandAllModules}>
                    {t("common.expandAll")}
                  </button>
                  <button type="button" onClick={collapseAllModules}>
                    {t("common.collapseAll")}
                  </button>
                </>
              ) : null}
              <button type="button" className="secondary-btn" onClick={addModule}>
                <Icon name="plus" />
                {t("admin.addModule")}
              </button>
            </div>
          </div>

          <div className="module-generator-card">
            <div>
              <span className="eyebrow">{t("admin.bulkModuleGenerator")}</span>
              <h4>{t("admin.generateModulesTitle")}</h4>
              <p>{t("admin.generateModulesHelp")}</p>
            </div>
            <div className="module-generator-form">
              <label>
                {t("admin.numberOfModules")}
                <input
                  type="number"
                  min="1"
                  max="100"
                  inputMode="numeric"
                  value={bulkModuleCount}
                  onChange={(event) => {
                    setBulkModuleCount(event.target.value);
                    if (bulkGeneratorError) setBulkGeneratorError("");
                  }}
                />
              </label>
              <button type="button" className="secondary-btn" disabled={isBusy} onClick={generateModules}>
                {t("admin.generateModulesButton")}
              </button>
            </div>
            {bulkGeneratorError ? <small className="field-note danger-text">{bulkGeneratorError}</small> : null}
          </div>

          {form.modules.map((module, index) => (
            <ModuleEditor
              key={module.id}
              module={module}
              index={index}
              t={t}
              collapsed={collapsedModuleIds.includes(module.id)}
              toggleCollapsed={toggleCollapsed}
              updateModule={updateModule}
              updateAssignment={updateAssignment}
              deleteModule={deleteModule}
              enableAssignment={enableAssignment}
              disableAssignment={disableAssignment}
              uploadPdf={uploadPdf}
              uploadVideo={uploadVideo}
            />
          ))}
        </div>

        <div className="form-actions">
          <button className="primary-btn" type="submit" disabled={isBusy}>
            <Icon name={editingId ? "check" : "plus"} />
            {isPublishing ? t("common.saving") : editingId ? t("admin.saveChanges") : t("admin.postCourse")}
          </button>
          {editingId ? (
            <button type="button" className="secondary-btn" onClick={reset} disabled={isBusy}>
              {t("admin.cancelEdit")}
            </button>
          ) : null}
          <button type="button" className="secondary-btn" onClick={discardDraft} disabled={isBusy}>
            {t("admin.discardDraft")}
          </button>
        </div>
      </form>

      <div className="right-rail">
        <section className="section-card preview-card">
          <div className="section-heading">
            <div>
              <span className="eyebrow">{t("admin.coursePreview")}</span>
              <h2>{t("admin.previewBeforePosting")}</h2>
              <p>{t("admin.buildCourseStructure")}</p>
            </div>
          </div>
          <div className="preview-shell">
            {previewCourse.image_url || previewCourse.imageUrl ? (
              <div className="image-preview-shell">
                <img className="course-image-preview" src={previewCourse.image_url || previewCourse.imageUrl} alt={previewCourse.title || "Course image"} />
              </div>
            ) : null}
            <h3>{previewCourse.title || t("admin.courseTitle")}</h3>
            <p>{previewCourse.description || t("admin.courseDescription")}</p>
            <div className="row-actions">
              <Status status={previewCourse.status || "published"} />
              <span className="subtle-badge">
                {isVisibleToStudents(previewCourse.status) ? t("common.visibleToStudents") : t("common.hiddenFromStudents")}
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
                        <strong>{module.video.uploadLabel !== "No video selected" ? module.video.uploadLabel : module.video_url || module.videoUrl || module.video.link || t("common.noVideoSelected")}</strong>
                      </div>
                      <div className="preview-item">
                        <span className="subtle-badge">{t("common.assignment")}</span>
                        <strong>
                          {module.requiresAssignment || module.requires_assignment
                            ? module.assignment?.title || t("admin.noAssignmentAdded")
                            : t("common.noAssignmentRequired")}
                        </strong>
                        {(module.requiresAssignment || module.requires_assignment) && (module.assignment?.dueDate || module.assignment?.due_date) ? (
                          <small>{t("common.due")} {formatDisplayDate(module.assignment?.dueDate || module.assignment?.due_date, language)}</small>
                        ) : null}
                      </div>
                    </div>
                  </article>
                ))
              ) : (
                <p className="empty-copy">{t("admin.moduleFiles")}</p>
              )}
            </div>
          </div>
        </section>

        <section className="section-card posted-list">
          <div className="section-heading">
            <div>
              <span className="eyebrow">{t("admin.postedCourses")}</span>
              <h2>{t("dashboard.postedCourses")}</h2>
            </div>
            <span className="count-badge">{courses.length} {t("common.courses").toLowerCase()}</span>
          </div>

          {visibilityMessage && <small className="field-note">{visibilityMessage}</small>}
          {visibilityError && <small className="field-note danger-text">{visibilityError}</small>}

          <div className="course-admin-list">
            {courses.map((course) => (
              <article key={course.id}>
                <div className="course-symbol"><Icon name="courses" /></div>
                <div className="course-info">
                  {course.image_url || course.imageUrl ? (
                    <div className="admin-course-thumb-wrap">
                      <img className="admin-course-thumb" src={course.image_url || course.imageUrl} alt={course.title} />
                    </div>
                  ) : null}
                  <div className="row-actions">
                    <h3>{course.title}</h3>
                    <Status status={course.status || "published"} />
                  </div>
                  <p>{course.description}</p>
                  <span>{(course.modules ?? []).length} {t("common.modules").toLowerCase()}</span>
                  <span>{(course.modules ?? []).filter((module) => module.pdf_url || module.pdfUrl || module.pdfLabel !== "No PDF selected").length} PDFs</span>
                  <span>{(course.modules ?? []).filter((module) => module.video_url || module.videoUrl || module.video?.url || module.video?.link).length} videos</span>
                  <span>{(course.modules ?? []).filter((module) => module.assignment?.title?.trim()).length} {t("common.assignments") || "assignments"}</span>
                  <ToggleSwitch
                    checked={isVisibleToStudents(course.status)}
                    disabled={statusUpdatingId === course.id}
                    label={isVisibleToStudents(course.status) ? t("common.visibleToStudents") : t("common.hiddenFromStudents")}
                    onChange={(checked) => void changeCourseVisibility(course, checked)}
                  />
                </div>
                <div className="row-actions">
                  <button onClick={() => editCourse(course)}>{t("common.edit")}</button>
                  <button className="danger-text" onClick={() => void onDeleteCourse(course.id)}>{t("common.delete")}</button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>

      {generatorDialog ? (
        <div className="modal-backdrop" onMouseDown={() => setGeneratorDialog(null)}>
          <div className="certificate-modal confirm-modal" onMouseDown={(event) => event.stopPropagation()}>
            <button className="modal-close" type="button" onClick={() => setGeneratorDialog(null)}>×</button>
            <span className="eyebrow">
              {generatorDialog.type === "large-course" ? t("admin.largeCourseWarningTitle") : t("admin.replaceModulesTitle")}
            </span>
            <h2>
              {generatorDialog.type === "large-course"
                ? t("admin.largeCourseWarningTitle")
                : t("admin.replaceModulesTitle")}
            </h2>
            <p>
              {generatorDialog.type === "large-course"
                ? t("admin.largeCourseWarningBody")
                : t("admin.replaceModulesBody")}
            </p>
            <div className="form-actions compact confirm-modal-actions">
              <button type="button" className="secondary-btn" onClick={() => setGeneratorDialog(null)}>
                {t("common.cancel")}
              </button>
              <button type="button" className="primary-btn" onClick={handleGeneratorContinue}>
                {generatorDialog.type === "large-course" ? t("common.continue") : t("admin.replaceModulesButton")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function AssignmentReviewsPage() {
  const { t, language, translateSubmissionType } = useLanguage();
  const [submissions, setSubmissions] = useState([]);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);
  const [submissionsError, setSubmissionsError] = useState("");
  const [reviewForms, setReviewForms] = useState({});
  const [selectedSubmissionId, setSelectedSubmissionId] = useState(null);
  const [reviewSavingId, setReviewSavingId] = useState(null);
  const [reviewMessage, setReviewMessage] = useState("");
  const [reviewError, setReviewError] = useState("");

  const loadSubmissions = async (keepSelectedId = selectedSubmissionId) => {
    setSubmissionsLoading(true);
    setSubmissionsError("");

    try {
      const rows = await getSubmissionsForAdmin();
      setSubmissions(rows);
      setReviewForms((current) => ({
        ...Object.fromEntries(rows.map((submission) => [submission.id, current[submission.id] ?? createReviewDraft(submission)])),
      }));
      setSelectedSubmissionId(rows.some((submission) => submission.id === keepSelectedId) ? keepSelectedId : rows[0]?.id ?? null);
    } catch (error) {
      console.error("Loading assignment submissions failed:", error);
      setSubmissionsError(error.message || t("common.loadingSubmissions"));
    } finally {
      setSubmissionsLoading(false);
    }
  };

  useEffect(() => {
    void loadSubmissions();
  }, []);

  const selectedSubmission = submissions.find((submission) => submission.id === selectedSubmissionId) ?? null;
  const reviewForm = selectedSubmission ? reviewForms[selectedSubmission.id] ?? createReviewDraft(selectedSubmission) : createReviewDraft();

  const updateReviewForm = (field, value) => {
    if (!selectedSubmission) return;

    setReviewForms((current) => ({
      ...current,
      [selectedSubmission.id]: {
        ...(current[selectedSubmission.id] ?? createReviewDraft(selectedSubmission)),
        [field]: value,
      },
    }));
  };

  const saveReview = async () => {
    if (!selectedSubmission) return;

    setReviewMessage("");
    setReviewError("");
    setReviewSavingId(selectedSubmission.id);

    try {
      const gradeValue = reviewForm.grade === "" ? null : Number(reviewForm.grade);
      if (gradeValue !== null && (Number.isNaN(gradeValue) || gradeValue < 0 || gradeValue > 100)) {
        throw new Error(t("validation.gradeRange"));
      }

      await reviewSubmission(selectedSubmission.id, reviewForm.status, reviewForm.adminFeedback, gradeValue);
      setReviewMessage(t("admin.assignmentReviewSaved"));
      await loadSubmissions(selectedSubmission.id);
    } catch (error) {
      console.error("Saving assignment review failed:", error);
      setReviewError(error.message || t("admin.savingReviewFailed"));
    } finally {
      setReviewSavingId(null);
    }
  };

  return (
    <div className="split-layout review-center-layout">
      <section className="section-card">
        <div className="section-heading">
          <div>
            <span className="eyebrow">{t("common.assignmentReviews")}</span>
            <h2>{t("admin.allStudentSubmissions")}</h2>
            <p>{t("admin.reviewHomeworkOpenFiles")}</p>
          </div>
          <span className="count-badge">{submissions.length} submissions</span>
        </div>

        {submissionsLoading && <small className="field-note">{t("common.loadingSubmissions")}</small>}
        {submissionsError && <small className="field-note danger-text">{submissionsError}</small>}
        {reviewMessage && <small className="field-note">{reviewMessage}</small>}
        {reviewError && <small className="field-note danger-text">{reviewError}</small>}

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t("common.student")}</th>
                <th>{t("common.course")}</th>
                <th>{t("common.module")}</th>
                <th>{t("common.assignment")}</th>
                <th>{t("common.status")}</th>
                <th>{t("common.grade")}</th>
                <th>{t("common.submittedDate")}</th>
                <th>{t("common.review")}</th>
              </tr>
            </thead>
            <tbody>
              {!submissionsLoading && !submissions.length ? (
                <tr>
                  <td colSpan="8">{t("common.noAssignmentSubmissionsYet")}</td>
                </tr>
              ) : (
                submissions.map((submission) => (
                  <tr key={submission.id}>
                    <td>
                      <strong>{submission.studentName || t("common.student")}</strong>
                      <div>{submission.studentEmail || "—"}</div>
                    </td>
                    <td>{submission.courseTitle || "—"}</td>
                    <td>{submission.moduleTitle || "—"}</td>
                    <td>{submission.assignmentTitle || "—"}</td>
                    <td><Status status={submission.status || "submitted"} /></td>
                    <td>{submission.grade === null || submission.grade === undefined ? t("common.notGradedYet") : `${submission.grade}/100`}</td>
                    <td>{formatDisplayDate(submission.submittedAt || submission.submitted_at, language)}</td>
                    <td>
                      <button onClick={() => { setSelectedSubmissionId(submission.id); setReviewMessage(""); setReviewError(""); }}>
                        {t("admin.reviewButton")}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="section-card review-detail-card">
        <div className="section-heading">
          <div>
            <span className="eyebrow">{t("common.reviewPanel")}</span>
            <h2>{selectedSubmission ? selectedSubmission.assignmentTitle || t("common.assignment") : t("common.selectSubmission")}</h2>
            <p>{selectedSubmission ? `${selectedSubmission.studentName || t("common.student")} · ${selectedSubmission.courseTitle || t("common.course")}` : t("admin.selectFromList")}</p>
          </div>
        </div>

        {selectedSubmission ? (
          <div className="review-panel-content">
            <div className="review-meta-grid">
              <div>
                <small>{t("common.student")}</small>
                <strong>{selectedSubmission.studentName || t("common.student")}</strong>
                <p>{selectedSubmission.studentEmail || "—"}</p>
              </div>
              <div>
                <small>{t("common.course")}</small>
                <strong>{selectedSubmission.courseTitle || "—"}</strong>
                <p>{selectedSubmission.moduleTitle || "—"}</p>
              </div>
              <div>
                <small>{t("common.assignment")}</small>
                <strong>{selectedSubmission.assignmentTitle || "—"}</strong>
                <p>{t("common.due")} {formatDisplayDate(selectedSubmission.assignment?.dueDate || selectedSubmission.assignment?.due_date, language)}</p>
              </div>
              <div>
                <small>{t("common.submittedDate")}</small>
                <strong>{formatDisplayDate(selectedSubmission.submittedAt || selectedSubmission.submitted_at, language)}</strong>
                <p>{translateSubmissionType(selectedSubmission.assignment?.submissionType || selectedSubmission.assignment?.submission_type)}</p>
              </div>
            </div>

            <div className="response-block">
              <strong>{t("common.assignmentInstructions")}</strong>
              <p>{selectedSubmission.assignmentInstructions || t("common.noInstructionsAdded")}</p>
            </div>

            {selectedSubmission.textResponse ? (
              <div className="response-block">
                <strong>{t("common.oldTextResponse")}</strong>
                <p>{selectedSubmission.textResponse}</p>
              </div>
            ) : null}

            {selectedSubmission.filePublicUrl || selectedSubmission.fileUrl ? (
              <a href={selectedSubmission.filePublicUrl || selectedSubmission.fileUrl} target="_blank" rel="noreferrer">{t("common.openAttachment")}</a>
            ) : (
              <small className="field-note">{t("common.noFileAttachmentSubmitted")}</small>
            )}

            <label>
              {t("common.currentStatus")}
              <select value={reviewForm.status} onChange={(event) => updateReviewForm("status", event.target.value)}>
                <option value="submitted">{t("status.submitted")}</option>
                <option value="approved">{t("status.approved")}</option>
                <option value="needs_revision">{t("status.needs_revision")}</option>
                <option value="rejected">{t("status.rejected")}</option>
              </select>
            </label>

            <label>
              {t("common.gradeOutOf100")}
              <input type="number" min="0" max="100" value={reviewForm.grade} onChange={(event) => updateReviewForm("grade", event.target.value)} placeholder="0 - 100" />
            </label>

            <label>
              {t("common.feedback")}
              <textarea rows="6" value={reviewForm.adminFeedback} onChange={(event) => updateReviewForm("adminFeedback", event.target.value)} placeholder={t("admin.feedbackPlaceholder")} />
            </label>

            <div className="form-actions compact">
              <button type="button" className="primary-btn" disabled={reviewSavingId === selectedSubmission.id} onClick={() => void saveReview()}>
                <Icon name="check" />
                {reviewSavingId === selectedSubmission.id ? t("common.saving") : t("common.saveReview")}
              </button>
            </div>
          </div>
        ) : (
          <p className="empty-copy">{t("common.selectSubmissionToOpenReview")}</p>
        )}
      </section>
    </div>
  );
}

function CertificatesGeneratorPage({ users, courses, certificates, onGenerateCertificate }) {
  const { t, language } = useLanguage();
  const students = users.filter((user) => user.role === "Student");
  const [studentId, setStudentId] = useState(students[0]?.id || "");
  const [courseId, setCourseId] = useState(courses[0]?.id || "");
  const selectedStudent = students.find((user) => String(user.id) === String(studentId)) ?? students[0] ?? null;
  const selectedCourse = courses.find((entry) => String(entry.id) === String(courseId)) ?? courses[0] ?? null;

  const generate = (event) => {
    event.preventDefault();
    const student = students.find((user) => String(user.id) === String(studentId));
    const course = courses.find((entry) => String(entry.id) === String(courseId));
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
        <span className="eyebrow">{t("common.certificatesGenerator")}</span>
        <h2>{t("admin.generateCertificate")}</h2>
        <p>{t("admin.selectStudentCompletedCourse")}</p>

        <label>
          {t("common.student")}
          <select value={studentId} onChange={(event) => setStudentId(event.target.value)}>
            {students.map((student) => (
              <option key={student.id} value={student.id}>
                {student.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          {t("common.course")}
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
          {t("admin.generateCertificate")}
        </button>
      </form>

      <section className="section-card certificate-template-card">
        <span className="eyebrow">{t("admin.certificateTemplate")}</span>
        <div className="certificate-template-preview">
          <span className="eyebrow">NUTRIPRO</span>
          <h2>{t("student.certificateOfCompletion")}</h2>
          <p>{t("certificateModal.certifiesThat")}</p>
          <h3>{selectedStudent?.name || "Maya Laurent"}</h3>
          <p>{t("certificateModal.successfullyCompleted")}</p>
          <h4>{selectedCourse?.title || t("common.course")}</h4>
          <div className="certificate-template-meta">
            <span>{t("admin.issueDate")}: {formatDisplayDate(new Date().toISOString(), language)}</span>
            <span>{t("admin.certificateNumber")}: NP-{new Date().getFullYear()}-DEMO</span>
          </div>
        </div>
      </section>

      <section className="section-card">
        <div className="section-heading">
          <div>
            <span className="eyebrow">{t("admin.generated")}</span>
            <h2>{t("admin.certificateList")}</h2>
          </div>
          <span className="count-badge">{t("admin.totalCount", { count: certificates.length })}</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t("common.student")}</th>
                <th>{t("common.course")}</th>
                <th>{t("admin.certificateNumber")}</th>
                <th>{t("admin.issueDate")}</th>
                <th>{t("common.status")}</th>
              </tr>
            </thead>
            <tbody>
              {certificates.map((certificate) => (
                <tr key={certificate.id}>
                  <td><strong>{certificate.student}</strong></td>
                  <td>{certificate.course}</td>
                  <td><code>{certificate.number}</code></td>
                  <td>{certificate.issueDate}</td>
                  <td><Status status={certificate.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
