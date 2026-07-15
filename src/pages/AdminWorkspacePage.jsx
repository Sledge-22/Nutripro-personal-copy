import React, { useEffect, useState } from "react";
import CountryFlag from "../components/CountryFlag.jsx";
import { Icon, OverviewCard, Stat, Status, Welcome } from "../components/ui.jsx";
import { CommunityBoard } from "../components/CommunityBoard.jsx";
import { ToggleSwitch } from "../components/ToggleSwitch.jsx";
import { getSubmissionsForAdmin, reviewSubmission } from "../services/assignmentService.js";
import { deleteCourseDraft, getCourseDrafts, markCourseDraftPublished, saveCourseDraft } from "../services/courseDraftService.js";
import { uploadCourseImage, uploadModulePdf, uploadModuleVideo } from "../services/storageService.js";
import { normalizeCountrySelection } from "../data/countries.js";
import { getProfileCountryOptions } from "../data/profileCountries.js";
import { useLanguage } from "../i18n/LanguageContext.jsx";
import { ROUTES } from "../routes/appRoutes.js";
import {
  getEmbeddablePdfUrl,
  getEmbeddableVideoUrl,
  isGoogleDriveUrl,
  isVimeoUrl,
} from "../utils/mediaLinks.js";

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

function firstFilledValue(...values) {
  return values.find((value) => `${value ?? ""}`.trim()) || "";
}

function getModulePdfViewerSource(module) {
  const uploadedPdfSource =
    module?.pdf_storage_path || module?.pdfStoragePath
      ? firstFilledValue(
        module?.pdf_url,
        module?.pdfUrl,
        module?.pdf_public_url,
        module?.pdfPublicUrl,
        module?.pdf_file_url,
        module?.pdfFileUrl,
      )
      : "";
  const externalPdfSource =
    firstFilledValue(
    module?.pdf_external_url,
    module?.pdfExternalUrl,
    module?.external_pdf_url,
    module?.externalPdfUrl,
    module?.pdfLink,
    module?.pdf_link,
    ((module?.pdf_source === "external" || module?.pdfSource === "external")
      ? firstFilledValue(module?.pdf_url, module?.pdfUrl)
      : ""),
    );
  if (uploadedPdfSource) {
    return {
      uploadedUrl: uploadedPdfSource,
      viewerUrl: "",
      externalUrl: uploadedPdfSource,
      isEmbeddable: false,
      isGoogleDrive: false,
      usesExternal: false,
    };
  }

  const viewerUrl = getEmbeddablePdfUrl(externalPdfSource);
  return {
    uploadedUrl: "",
    viewerUrl,
    externalUrl: externalPdfSource,
    isEmbeddable: Boolean(viewerUrl),
    isGoogleDrive: isGoogleDriveUrl(externalPdfSource),
    usesExternal: Boolean(externalPdfSource),
  };
}

function getModuleVideoViewerSource(module) {
  const uploadedVideoSource =
    module?.video_storage_path || module?.videoStoragePath
      ? firstFilledValue(
        module?.video_url,
        module?.videoUrl,
        module?.video_public_url,
        module?.videoPublicUrl,
        module?.video_file_url,
        module?.videoFileUrl,
        module?.video?.url,
      )
      : "";
  const externalVideoSource =
    firstFilledValue(
    module?.video_external_url,
    module?.videoExternalUrl,
    module?.external_video_url,
    module?.externalVideoUrl,
    module?.video_embed_url,
    module?.videoEmbedUrl,
    module?.videoLink,
    module?.video_link,
    module?.video?.link,
    ((module?.video_source === "external" || module?.videoSource === "external")
      ? firstFilledValue(module?.video_url, module?.videoUrl, module?.video?.link)
      : ""),
    );
  if (uploadedVideoSource) {
    return {
      uploadedUrl: uploadedVideoSource,
      viewerUrl: "",
      externalUrl: uploadedVideoSource,
      isEmbeddable: false,
      isGoogleDrive: false,
      usesExternal: false,
    };
  }

  const viewerUrl = getEmbeddableVideoUrl(externalVideoSource);
  return {
    uploadedUrl: "",
    viewerUrl,
    externalUrl: externalVideoSource,
    isEmbeddable: Boolean(viewerUrl),
    isGoogleDrive: isGoogleDriveUrl(externalVideoSource),
    usesExternal: Boolean(externalVideoSource),
  };
}

function clampModuleCount(value) {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed)) return null;
  if (parsed < 1 || parsed > 100) return null;
  return parsed;
}

function getDefaultModuleTitle(index, language = "es") {
  return language === "es" ? `MÃ³dulo ${index + 1}` : `Module ${index + 1}`;
}

function getModuleDisplayTitle(module, index, language = "es") {
  return module?.title?.trim() || getDefaultModuleTitle(index, language);
}

function createBulkSelectionEntry({
  file,
  position,
  module,
  moduleIndex,
  language,
  tooLarge = false,
  kind = "pdf",
}) {
  return {
    id: `${kind}-${Date.now()}-${position}-${file?.name || "file"}`,
    fileName: file?.name || "",
    fileSize: file?.size ?? 0,
    fileType: file?.type || "",
    originalOrder: position + 1,
    assignedModuleId: module?.id || null,
    assignedModuleIndex: Number.isInteger(moduleIndex) ? moduleIndex : null,
    assignedModuleTitle:
      Number.isInteger(moduleIndex)
        ? getModuleDisplayTitle(module, moduleIndex, language)
        : "",
    uploadStatus: tooLarge ? "too_large" : module ? "assigned" : "unassigned",
    tooLarge,
  };
}

function createGeneratedModules(count, language = "es") {
  return Array.from({ length: count }, (_, index) => ({
    ...createModuleDraft(index + 1),
    title: getDefaultModuleTitle(index, language),
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
    titleEn: "",
    title_en: "",
    titleEs: "",
    title_es: "",
    instructionsEn: "",
    instructions_en: "",
    instructionsEs: "",
    instructions_es: "",
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
    pdfExternalUrl: "",
    pdf_external_url: "",
    pdfSource: "upload",
    pdf_source: "upload",
    pdfLabel: "No PDF selected",
    pdfName: "",
    pdf_file_name: "",
    pdfStoragePath: "",
    pdf_storage_path: "",
    pdfFile: null,
    pdfPendingName: "",
    pdfPendingSize: null,
    pdfPendingType: "",
    pdfUploading: false,
    pdfError: "",
    videoUrl: "",
    video_url: "",
    videoExternalUrl: "",
    video_external_url: "",
    videoSource: "upload",
    video_source: "upload",
    videoName: "",
    video_file_name: "",
    videoStoragePath: "",
    video_storage_path: "",
    videoFile: null,
    videoPendingName: "",
    videoPendingSize: null,
    videoPendingType: "",
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
  const restoredPdfExternalUrl = module.pdf_external_url || module.pdfExternalUrl || "";
  const restoredVideoUrl = module.video_url || module.videoUrl || module.video?.url || "";
  const restoredVideoExternalUrl = module.video_external_url || module.videoExternalUrl || "";
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
    pdfExternalUrl: restoredPdfExternalUrl,
    pdf_external_url: restoredPdfExternalUrl,
    pdfSource: module.pdf_source || module.pdfSource || (restoredPdfExternalUrl ? "external" : "upload"),
    pdf_source: module.pdf_source || module.pdfSource || (restoredPdfExternalUrl ? "external" : "upload"),
    pdfLabel: restoredPdfUrl ? module.pdfLabel || module.pdfName || module.pdf_file_name || legacyPdfName || NO_PDF_SELECTED : NO_PDF_SELECTED,
    pdfName: restoredPdfUrl ? module.pdfName || module.pdf_file_name || module.pdfLabel || legacyPdfName || "" : "",
    pdf_file_name: restoredPdfUrl ? module.pdf_file_name || module.pdfName || module.pdfLabel || legacyPdfName || "" : "",
    pdfStoragePath: module.pdfStoragePath || module.pdf_storage_path || "",
    pdf_storage_path: module.pdf_storage_path || module.pdfStoragePath || "",
    pdfFile: null,
    pdfPendingName,
    pdfPendingSize: module.pdfPendingSize ?? null,
    pdfPendingType: module.pdfPendingType || "",
    pdfUploading: false,
    pdfError: "",
    videoUrl: restoredVideoUrl || module.video?.link || "",
    video_url: restoredVideoUrl || module.video?.link || "",
    videoExternalUrl: restoredVideoExternalUrl,
    video_external_url: restoredVideoExternalUrl,
    videoSource: module.video_source || module.videoSource || (restoredVideoExternalUrl ? "external" : "upload"),
    video_source: module.video_source || module.videoSource || (restoredVideoExternalUrl ? "external" : "upload"),
    videoName: restoredVideoUrl ? module.videoName || module.video_file_name || module.video?.uploadLabel || legacyVideoName || "" : "",
    video_file_name: restoredVideoUrl ? module.video_file_name || module.videoName || module.video?.uploadLabel || legacyVideoName || "" : "",
    videoStoragePath: module.videoStoragePath || module.video_storage_path || "",
    video_storage_path: module.video_storage_path || module.videoStoragePath || "",
    videoFile: null,
    videoPendingName,
    videoPendingSize: module.videoPendingSize ?? null,
    videoPendingType: module.videoPendingType || "",
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
    bulkPdfSelections: Array.isArray(draft.bulkPdfSelections) ? draft.bulkPdfSelections : [],
    bulkVideoSelections: Array.isArray(draft.bulkVideoSelections) ? draft.bulkVideoSelections : [],
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
      pdfPendingType: module.pdfPendingType || "",
      videoFile: null,
      videoPendingType: module.videoPendingType || "",
      video: {
        ...module.video,
        uploading: false,
        error: "",
      },
    })),
  };
}

function getModuleHasVideo(module) {
  const uploadedVideo = firstFilledValue(
    module.video_url,
    module.videoUrl,
    module.video_public_url,
    module.videoPublicUrl,
    module.video_file_url,
    module.videoFileUrl,
    module.video?.url,
  );
  const externalVideo = firstFilledValue(
    module.video_external_url,
    module.videoExternalUrl,
    module.external_video_url,
    module.externalVideoUrl,
    module.video_embed_url,
    module.videoEmbedUrl,
    module.videoLink,
    module.video_link,
    module.video?.link,
  );

  return Boolean(uploadedVideo || externalVideo || module.videoFile);
}

function createCourseDraft(course = null) {
  if (!course) {
    return {
      title: "",
      description: "",
      status: "published",
      selectedStudentIds: [],
      imageUrl: "",
      image_url: "",
      imageStoragePath: "",
      image_storage_path: "",
      imageLabel: "",
      imageUploading: false,
      imageError: "",
      bulkPdfSelections: [],
      bulkVideoSelections: [],
      modules: [createModuleDraft()],
    };
  }

  return {
    title: course.title,
    description: course.description,
    status: course.status || "published",
    selectedStudentIds: Array.isArray(course.owners) ? course.owners.map((studentId) => `${studentId}`) : [],
    imageUrl: course.image_url || course.imageUrl || "",
    image_url: course.image_url || course.imageUrl || "",
    imageStoragePath: course.image_storage_path || course.imageStoragePath || "",
    image_storage_path: course.image_storage_path || course.imageStoragePath || "",
    imageLabel: course.imageLabel || course.image_file_name || course.imageName || "",
    imageUploading: false,
    imageError: "",
    bulkPdfSelections: [],
    bulkVideoSelections: [],
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
      pdfExternalUrl: module.pdf_external_url || module.pdfExternalUrl || "",
      pdf_external_url: module.pdf_external_url || module.pdfExternalUrl || "",
      pdfSource: module.pdf_source || module.pdfSource || ((module.pdf_external_url || module.pdfExternalUrl) ? "external" : "upload"),
      pdf_source: module.pdf_source || module.pdfSource || ((module.pdf_external_url || module.pdfExternalUrl) ? "external" : "upload"),
      pdfLabel: module.pdfLabel || module.pdf_file_name || module.pdfName || NO_PDF_SELECTED,
      pdfName: module.pdfName || module.pdf_file_name || module.pdfLabel || "",
      pdf_file_name: module.pdf_file_name || module.pdfName || module.pdfLabel || "",
      pdfStoragePath: module.pdf_storage_path || module.pdfStoragePath || "",
      pdf_storage_path: module.pdf_storage_path || module.pdfStoragePath || "",
      pdfFile: null,
      pdfPendingName: "",
      pdfPendingSize: null,
      pdfPendingType: "",
      pdfUploading: false,
      pdfError: "",
      videoUrl: module.video_url || module.videoUrl || module.video?.url || module.video?.link || "",
      video_url: module.video_url || module.videoUrl || module.video?.url || module.video?.link || "",
      videoExternalUrl: module.video_external_url || module.videoExternalUrl || "",
      video_external_url: module.video_external_url || module.videoExternalUrl || "",
      videoSource: module.video_source || module.videoSource || ((module.video_external_url || module.videoExternalUrl) ? "external" : "upload"),
      video_source: module.video_source || module.videoSource || ((module.video_external_url || module.videoExternalUrl) ? "external" : "upload"),
      videoName: module.videoName || module.video_file_name || module.video?.uploadLabel || "",
      video_file_name: module.video_file_name || module.videoName || module.video?.uploadLabel || "",
      videoStoragePath: module.video_storage_path || module.videoStoragePath || "",
      video_storage_path: module.video_storage_path || module.videoStoragePath || "",
      videoFile: null,
      videoPendingName: "",
      videoPendingSize: null,
      videoPendingType: "",
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
            titleEn: module.assignment.title_en || module.assignment.titleEn || "",
            title_en: module.assignment.title_en || module.assignment.titleEn || "",
            titleEs: module.assignment.title_es || module.assignment.titleEs || "",
            title_es: module.assignment.title_es || module.assignment.titleEs || "",
            instructionsEn: module.assignment.instructions_en || module.assignment.instructionsEn || "",
            instructions_en: module.assignment.instructions_en || module.assignment.instructionsEn || "",
            instructionsEs: module.assignment.instructions_es || module.assignment.instructionsEs || "",
            instructions_es: module.assignment.instructions_es || module.assignment.instructionsEs || "",
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
    owners: Array.from(new Set((Array.isArray(form.selectedStudentIds) ? form.selectedStudentIds : []).map((studentId) => `${studentId}`))),
    modules: form.modules
      .filter((module) => module.title.trim())
      .map((module, index) => {
        const pdfExternalUrl = firstFilledValue(
          module.pdf_external_url,
          module.pdfExternalUrl,
          module.external_pdf_url,
          module.externalPdfUrl,
          module.pdfLink,
          module.pdf_link,
        );
        const videoExternalUrl = firstFilledValue(
          module.video_external_url,
          module.videoExternalUrl,
          module.external_video_url,
          module.externalVideoUrl,
          module.video_embed_url,
          module.videoEmbedUrl,
          module.videoLink,
          module.video_link,
          module.video?.link,
        );
        const pdfSource = pdfExternalUrl ? "external" : (module.pdf_source || module.pdfSource || "upload");
        const videoSource = videoExternalUrl ? "external" : (module.video_source || module.videoSource || "upload");
        const pdfUrl = firstFilledValue(
          module.pdf_url,
          module.pdfUrl,
          module.pdf_public_url,
          module.pdfPublicUrl,
          module.pdf_file_url,
          module.pdfFileUrl,
          pdfSource === "external" ? pdfExternalUrl : "",
        );
        const videoUrl = firstFilledValue(
          module.video_url,
          module.videoUrl,
          module.video_public_url,
          module.videoPublicUrl,
          module.video_file_url,
          module.videoFileUrl,
          module.video?.url,
          videoSource === "external" ? videoExternalUrl : "",
        );

        return {
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
          pdfExternalUrl,
          pdf_external_url: pdfExternalUrl || null,
          pdfSource,
          pdf_source: pdfExternalUrl ? "external" : pdfSource,
          pdfUrl,
          pdf_url: pdfUrl || null,
          pdfLabel: module.pdfLabel || module.pdf_file_name || module.pdfName || "No PDF selected",
          pdfName: module.pdfName || module.pdf_file_name || module.pdfLabel || "",
          pdf_file_name: module.pdf_file_name || module.pdfName || module.pdfLabel || "",
          pdf_storage_path: module.pdfStoragePath || module.pdf_storage_path || "",
          videoExternalUrl,
          video_external_url: videoExternalUrl || null,
          videoSource,
          video_source: videoExternalUrl ? "external" : videoSource,
          videoUrl,
          video_url: videoUrl || null,
          videoName: module.videoName || module.video_file_name || module.video.uploadLabel || "",
          video_file_name: module.video_file_name || module.videoName || module.video.uploadLabel || "",
          video_storage_path: module.videoStoragePath || module.video_storage_path || "",
          video: {
            id: module.video.id || createId(),
            title: module.video.title.trim() || `${module.title.trim() || "Module"} video`,
            description: module.video.description.trim() || `${module.title.trim() || "Module"} video overview`,
            duration: module.video.duration || "10 min",
            link: videoExternalUrl,
            url: videoUrl || videoExternalUrl,
            uploadLabel: module.video.uploadLabel || "No video selected",
          },
          assignment:
            (module.requiresAssignment ?? module.requires_assignment) && module.assignment?.title?.trim()
            ? {
                id: module.assignment.id || null,
                title: module.assignment.title.trim(),
                instructions: module.assignment.instructions.trim(),
                titleEn: `${module.assignment.titleEn || module.assignment.title_en || ""}`.trim(),
                title_en: `${module.assignment.titleEn || module.assignment.title_en || ""}`.trim(),
                titleEs: `${module.assignment.titleEs || module.assignment.title_es || ""}`.trim(),
                title_es: `${module.assignment.titleEs || module.assignment.title_es || ""}`.trim(),
                instructionsEn: `${module.assignment.instructionsEn || module.assignment.instructions_en || ""}`.trim(),
                instructions_en: `${module.assignment.instructionsEn || module.assignment.instructions_en || ""}`.trim(),
                instructionsEs: `${module.assignment.instructionsEs || module.assignment.instructions_es || ""}`.trim(),
                instructions_es: `${module.assignment.instructionsEs || module.assignment.instructions_es || ""}`.trim(),
                submissionType: "file",
                submission_type: "file",
              }
            : null,
        };
      }),
  };
}

function formatDisplayDate(value, language = "es") {
  if (!value) return "â€”";

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

function createReviewDraft(submission = null) {
  return {
    status: submission?.status || "submitted",
    grade: submission?.grade ?? "",
    adminFeedback: submission?.adminFeedback || submission?.admin_feedback || "",
  };
}

function normalizeRoleKey(value) {
  const normalizedValue = `${value ?? ""}`.trim().toLowerCase();
  if (normalizedValue === "student" || normalizedValue === "estudiante") return "student";
  if (normalizedValue === "admin" || normalizedValue === "administrador") return "admin";
  return normalizedValue;
}

function getAssignedCourseIdsForStudent(courses = [], studentId) {
  if (!studentId) return [];

  return courses
    .filter((course) => Array.isArray(course?.owners) && course.owners.some((ownerId) => String(ownerId) === String(studentId)))
    .map((course) => course.id);
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
  posts,
  currentUser,
  siteAccessMode = "demo",
  siteAccessModeStorage = "local",
  showAuthTestTools = true,
  onUpdateSiteAccessMode,
  onUpdateUserStatus,
  onUpdateUser,
  onCreateUser,
  onResetUserPassword,
  onSendUserInvitation,
  onDeleteUser,
  onSetStudentCourseAssignments,
  onSaveCourse,
  onDeleteCourse,
  onGenerateCertificate,
  onCreatePost,
  onCreateComment,
  onUpdatePost,
  onDeletePost,
  onUpdateComment,
}) {
  if (pathname === "/admin/users") {
    return (
      <UsersAdminPanel
        users={users}
        currentUser={currentUser}
        showAuthTestTools={showAuthTestTools}
        onUpdateUserStatus={onUpdateUserStatus}
        onUpdateUser={onUpdateUser}
        onCreateUser={onCreateUser}
        onResetUserPassword={onResetUserPassword}
        onSendUserInvitation={onSendUserInvitation}
        onDeleteUser={onDeleteUser}
        courses={courses}
        onSetStudentCourseAssignments={onSetStudentCourseAssignments}
      />
    );
  }

  if (pathname === "/admin/post-courses") {
    return (
      <PostCoursesPage
        users={users}
        courses={courses}
        onSaveCourse={onSaveCourse}
        onDeleteCourse={onDeleteCourse}
      />
    );
  }

  if (pathname === "/admin/community") {
    return (
      <CommunityBoard
        posts={posts}
        currentUser={currentUser}
        courses={courses}
        onCreatePost={onCreatePost}
        onCreateComment={onCreateComment}
        onUpdatePost={onUpdatePost}
        onDeletePost={onDeletePost}
        onUpdateComment={onUpdateComment}
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

  if (pathname === "/admin/settings") {
    return <AdminSettingsPage siteAccessMode={siteAccessMode} siteAccessModeStorage={siteAccessModeStorage} onUpdateSiteAccessMode={onUpdateSiteAccessMode} />;
  }

  return <AdminDashboardPage users={users} courses={courses} certificates={certificates} currentUser={currentUser} />;
}
function AdminDashboardPage({ users, courses, certificates, currentUser }) {
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

function AdminSettingsPage({ siteAccessMode = "demo", siteAccessModeStorage = "local", onUpdateSiteAccessMode }) {
  const { language } = useLanguage();
  const [settingsMessage, setSettingsMessage] = useState("");
  const [settingsError, setSettingsError] = useState("");
  const [updatingMode, setUpdatingMode] = useState(false);
  const pageTitle = language === "es" ? "Configuración" : "Settings";
  const pageText = language === "es"
    ? "Administra los controles generales del sitio y las preferencias administrativas."
    : "Manage site-wide controls and administrative preferences.";
  const modeHeading = language === "es" ? "Modo de acceso del sitio" : "Site Access Mode";
  const modeDescription = language === "es"
    ? "Controla si Nutripro se abre en modo demo o en modo de inicio de sesión de producción."
    : "Control whether Nutripro opens in demo mode or production login mode.";
  const demoModeLabel = language === "es" ? "Modo demo" : "Demo Mode";
  const productionModeLabel = language === "es" ? "Modo inicio de sesión" : "Login Mode";
  const helperText = language === "es"
    ? "Este control es para pruebas y preparación del lanzamiento. Puede eliminarse más adelante cuando el inicio de sesión de producción esté finalizado."
    : "This control is for testing and launch preparation. It can be removed later once production login is finalized.";
  const warningText = language === "es"
    ? "El inicio de sesión de producción solo debe activarse después de probar las cuentas, contraseñas e invitaciones."
    : "Production Login should only be enabled after user accounts, passwords, and invitation flow are tested.";
  const successText = language === "es" ? "Modo de acceso del sitio actualizado." : "Site access mode updated.";
  const localSuccessText = language === "es" ? "Modo de acceso del sitio actualizado para este navegador." : "Site access mode updated for this browser.";
  const failurePrefix = language === "es" ? "No se pudo actualizar el modo de acceso del sitio:" : "Unable to update site access mode:";
  const comingSoon = language === "es" ? "Próximamente" : "Coming soon";
  const comingSoonText = language === "es" ? "Próximamente en esta sección." : "Coming soon in this section.";
  const demoAdminHelper = language === "es"
    ? "Los cambios del admin demo se guardan localmente para pruebas. La configuración de producción requiere un inicio de sesión real de administrador."
    : "Demo admin changes are stored locally for testing. Production site settings require a real admin login.";

  const handleModeChange = async (nextMode) => {
    if (!onUpdateSiteAccessMode || nextMode === siteAccessMode) return;
    setUpdatingMode(true);
    setSettingsMessage("");
    setSettingsError("");
    try {
      const result = await onUpdateSiteAccessMode(nextMode);
      setSettingsMessage(result?.storage === "local" ? localSuccessText : successText);
    } catch (error) {
      console.error("Updating the admin-controlled site access mode failed:", error);
      setSettingsError(`${failurePrefix} ${error?.message || "Unknown error"}`);
    } finally {
      setUpdatingMode(false);
    }
  };

  return (
    <>
      <section className="section-card">
        <div className="section-heading">
          <div>
            <span className="eyebrow">{language === "es" ? "ADMINISTRACIÓN" : "ADMINISTRATION"}</span>
            <h2>{pageTitle}</h2>
            <p>{pageText}</p>
          </div>
        </div>
      </section>
      <section className="section-card">
        <div className="section-heading">
          <div>
            <span className="eyebrow">{language === "es" ? "CONFIGURACIÓN DEL SITIO" : "SITE SETTINGS"}</span>
            <h2>{modeHeading}</h2>
            <p>{modeDescription}</p>
          </div>
        </div>
        <div className="auth-mode-toggle" role="tablist" aria-label={modeHeading}>
          <button type="button" className={`auth-mode-option ${siteAccessMode === "demo" ? "active" : ""}`} onClick={() => void handleModeChange("demo")} disabled={updatingMode}>
            {demoModeLabel}
          </button>
          <button type="button" className={`auth-mode-option ${siteAccessMode === "production" ? "active" : ""}`} onClick={() => void handleModeChange("production")} disabled={updatingMode}>
            {productionModeLabel}
          </button>
        </div>
        <small className="field-note">{helperText}</small>
        {siteAccessModeStorage === "local" ? <small className="field-note">{demoAdminHelper}</small> : null}
        {siteAccessMode === "production" ? <small className="field-note warning-badge">{warningText}</small> : null}
        {settingsMessage ? <small className="field-note">{settingsMessage}</small> : null}
        {settingsError ? <small className="field-note danger-text">{settingsError}</small> : null}
      </section>
      <section className="section-card">
        <div className="section-heading">
          <div>
            <span className="eyebrow">{comingSoon.toUpperCase()}</span>
            <h2>{language === "es" ? "Más controles administrativos" : "More admin controls"}</h2>
          </div>
        </div>
        <div className="overview-grid">
          <OverviewCard icon="community" title={`${language === "es" ? "Correo e invitaciones" : "Email & Invitations"} · ${comingSoon}`} text={comingSoonText} />
          <OverviewCard icon="courses" title={`${language === "es" ? "Marca" : "Branding"} · ${comingSoon}`} text={comingSoonText} />
          <OverviewCard icon="certificate" title={`${language === "es" ? "Certificados" : "Certificates"} · ${comingSoon}`} text={comingSoonText} />
          <OverviewCard icon="users" title={`${language === "es" ? "Moderación de comunidad" : "Community Moderation"} · ${comingSoon}`} text={comingSoonText} />
        </div>
      </section>
    </>
  );
}

function UsersAdminPage({ users, onUpdateUserStatus, onUpdateUser, onDeleteUser }) {
  const { t, language } = useLanguage();
  const countryOptions = getProfileCountryOptions();
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
      country: user.countryCode || user.country_code || normalizeCountrySelection(user.country, language).countryCode || "",
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
                    {isEditing ? (
                      <select value={draft.country} onChange={(event) => setDraft((current) => ({ ...current, country: event.target.value }))}>
                        <option value="">{t("common.selectCountry")}</option>
                        {countryOptions.map((option) => (
                          <option key={option.code} value={option.code}>
                            {option.flag} {option.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      user.country ? (
                        <span className="subtle-badge profile-country-badge country-badge">
                          <CountryFlag
                            code={user.country_code || user.countryCode}
                            name={user.country}
                            fallbackFlag={user.country_flag || user.countryFlag}
                            className="profile-country-flag"
                          />
                          <span>{user.country}</span>
                        </span>
                      ) : "â€”"
                    )}
                  </td>
                  <td>{user.created_at || user.createdAt ? formatDisplayDate(user.created_at || user.createdAt, language) : "â€”"}</td>
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

function UsersAdminPanel({
  users,
  courses,
  currentUser,
  showAuthTestTools,
  onUpdateUserStatus,
  onUpdateUser,
  onCreateUser,
  onResetUserPassword,
  onSendUserInvitation,
  onDeleteUser,
  onSetStudentCourseAssignments,
}) {
  const { t, language, translateRole } = useLanguage();
  const countryOptions = getProfileCountryOptions();
  const safeCourses = Array.isArray(courses) ? courses : [];
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
  const [invitingUserId, setInvitingUserId] = useState(null);
  const [deletingUserId, setDeletingUserId] = useState(null);
  const [statusUpdatingUserId, setStatusUpdatingUserId] = useState(null);
  const [pendingDeleteUser, setPendingDeleteUser] = useState(null);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [assignmentDraftCourseIds, setAssignmentDraftCourseIds] = useState([]);
  const [savingAssignments, setSavingAssignments] = useState(false);
  const [testInviteDraft, setTestInviteDraft] = useState({
    email: "",
    name: "",
    role: "student",
    temporaryPassword: "",
  });

  const getErrorMessage = (issue) => {
    if (!issue) return "Unknown error";
    if (typeof issue === "string") return issue;
    if (issue.message) return issue.message;
    if (issue.details) return issue.details;
    if (issue.hint) return issue.hint;
    try {
      return JSON.stringify(issue);
    } catch {
      return "Unknown error";
    }
  };

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

  const studentUsers = users.filter((user) => normalizeRoleKey(user.roleKey ?? user.role) === "student");

  useEffect(() => {
    if (!studentUsers.length) {
      if (selectedStudentId) setSelectedStudentId("");
      return;
    }

    const selectedStillExists = studentUsers.some((user) => String(user.id) === String(selectedStudentId));
    if (!selectedStillExists) {
      setSelectedStudentId(studentUsers[0].id);
    }
  }, [selectedStudentId, studentUsers]);

  useEffect(() => {
    if (!selectedStudentId) {
      setAssignmentDraftCourseIds([]);
      return;
    }

    setAssignmentDraftCourseIds(getAssignedCourseIdsForStudent(safeCourses, selectedStudentId));
  }, [safeCourses, selectedStudentId]);

  const selectedStudent =
    studentUsers.find((user) => String(user.id) === String(selectedStudentId)) ?? null;
  const assignedCourseIds = getAssignedCourseIdsForStudent(safeCourses, selectedStudentId);
  const assignedCourses = safeCourses.filter((course) =>
    assignedCourseIds.some((courseId) => String(courseId) === String(course.id)),
  );
  const availableCourses = safeCourses.filter(
    (course) => !assignedCourseIds.some((courseId) => String(courseId) === String(course.id)),
  );

  const toggleCourseAssignment = (courseId, shouldAssign) => {
    setAssignmentDraftCourseIds((current) => {
      const nextSet = new Set(current.map((entry) => String(entry)));
      if (shouldAssign) nextSet.add(String(courseId));
      else nextSet.delete(String(courseId));

      return safeCourses
        .map((course) => course.id)
        .filter((id) => nextSet.has(String(id)));
    });
  };

  const startEditing = (user) => {
    setEditingUserId(user.id);
    setDraft({
      name: user.name || "",
      email: user.email || "",
      username: user.username || "",
      role: user.roleKey || user.role?.toLowerCase() || "student",
      status: user.statusKey || user.status?.toLowerCase() || "active",
      country: user.countryCode || user.country_code || normalizeCountrySelection(user.country, language).countryCode || "",
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

  const sendInvitation = async (user, options = {}) => {
    if (!user?.email) {
      setError(t("auth.emailRequiredToSendInvitation"));
      return;
    }

    setInvitingUserId(user.id || "test");
    setMessage("");
    setError("");

    try {
      await onSendUserInvitation(user, {
        language,
        invitedBy: currentUser?.name || "",
        temporaryPassword: options.temporaryPassword || "",
        inviteUrl: `${window.location.origin}/`,
        demoMode: true,
      });
      setMessage(t("auth.invitationSentSuccessfully"));
    } catch (inviteError) {
      console.error("Sending invitation failed:", inviteError);
      const failureMessage = `${t("auth.unableToSendInvitation")} ${getErrorMessage(inviteError)}`.trim();
      setError(failureMessage);
    } finally {
      setInvitingUserId(null);
    }
  };

  const sendTestInvitation = async () => {
    await sendInvitation(
      {
        id: "test-invitation",
        name: testInviteDraft.name,
        email: testInviteDraft.email,
        roleKey: testInviteDraft.role,
      },
      { temporaryPassword: testInviteDraft.temporaryPassword },
    );
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

  const saveAssignments = async () => {
    if (!selectedStudentId) return;

    setSavingAssignments(true);
    setMessage("");
    setError("");

    try {
      const previousAssignments = assignedCourseIds.map(String);
      const nextAssignments = assignmentDraftCourseIds.map((entry) => String(entry));
      const addedAssignments = nextAssignments.filter((courseId) => !previousAssignments.includes(courseId));
      const removedAssignments = previousAssignments.filter((courseId) => !nextAssignments.includes(courseId));

      const result = await onSetStudentCourseAssignments(selectedStudentId, assignmentDraftCourseIds);
      if (!result?.ok) {
        throw new Error(result?.error || t("admin.savingAssignmentsFailed"));
      }

      if (addedAssignments.length && !removedAssignments.length) {
        setMessage(t("admin.courseAssignedSuccessfully"));
      } else if (removedAssignments.length && !addedAssignments.length) {
        setMessage(t("admin.accessRemovedSuccessfully"));
      } else {
        setMessage(t("admin.assignmentsSavedSuccessfully"));
      }
    } catch (assignmentError) {
      console.error("Saving the course assignments failed:", assignmentError);
      setError(assignmentError.message || t("admin.savingAssignmentsFailed"));
    } finally {
      setSavingAssignments(false);
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
            <select value={createDraftState.country} onChange={(event) => setCreateDraftState((current) => ({ ...current, country: event.target.value }))}>
              <option value="">{t("common.selectCountry")}</option>
              {countryOptions.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.flag} {option.name}
                </option>
              ))}
            </select>
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
              <button type="button" className="secondary-btn" onClick={() => void copyTemporaryPassword()}>
                {t("auth.copyPassword")}
              </button>
            </div>
          </div>
        ) : null}

        {showAuthTestTools ? (
          <div className="credential-card">
            <strong>{t("auth.productionOnboardingTools")}</strong>
            <p>{t("auth.productionToolsHelp")}</p>
            <div className="community-form-grid">
              <label>
                {t("auth.email")}
                <input
                  type="email"
                  value={testInviteDraft.email}
                  onChange={(event) => setTestInviteDraft((current) => ({ ...current, email: event.target.value }))}
                  placeholder="student@example.com"
                />
              </label>
              <label>
                {t("auth.name")}
                <input
                  value={testInviteDraft.name}
                  onChange={(event) => setTestInviteDraft((current) => ({ ...current, name: event.target.value }))}
                />
              </label>
              <label>
                {t("auth.role")}
                <select
                  value={testInviteDraft.role}
                  onChange={(event) => setTestInviteDraft((current) => ({ ...current, role: event.target.value }))}
                >
                  <option value="student">{translateRole("student")}</option>
                  <option value="instructor">{translateRole("instructor")}</option>
                  <option value="support">{translateRole("support")}</option>
                  <option value="admin">{translateRole("admin")}</option>
                </select>
              </label>
              <label>
                {t("auth.temporaryPassword")}
                <input
                  value={testInviteDraft.temporaryPassword}
                  onChange={(event) => setTestInviteDraft((current) => ({ ...current, temporaryPassword: event.target.value }))}
                />
              </label>
            </div>
            <div className="form-actions compact">
              <button type="button" className="secondary-btn" onClick={() => window.open(ROUTES.auth.setupPreview, "_blank", "noopener,noreferrer")}>
                {t("auth.previewFirstTimeSetup")}
              </button>
              <button
                type="button"
                className="primary-btn"
                disabled={!testInviteDraft.email || invitingUserId === "test-invitation"}
                onClick={() => void sendTestInvitation()}
                title={!testInviteDraft.email ? t("auth.emailRequiredToSendInvitation") : ""}
              >
                {invitingUserId === "test-invitation" ? t("auth.sendingInvitation") : t("auth.sendTestInvitation")}
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
                <th>{t("admin.assignedCoursesCount")}</th>
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
                        user.username || "â€”"
                      )}
                    </td>
                    <td>
                      <span className="subtle-badge">
                        {
                          safeCourses.filter(
                            (course) =>
                              Array.isArray(course?.owners) &&
                              course.owners.some((ownerId) => String(ownerId) === String(user.id)),
                          ).length
                        }
                      </span>
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
                        <select value={draft.country} onChange={(event) => setDraft((current) => ({ ...current, country: event.target.value }))}>
                          <option value="">{t("common.selectCountry")}</option>
                          {countryOptions.map((option) => (
                            <option key={option.code} value={option.code}>
                              {option.flag} {option.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        user.country ? (
                          <span className="subtle-badge profile-country-badge country-badge">
                            <CountryFlag
                              code={user.country_code || user.countryCode}
                              name={user.country}
                              fallbackFlag={user.country_flag || user.countryFlag}
                              className="profile-country-flag"
                            />
                            <span>{user.country}</span>
                          </span>
                        ) : "â€”"
                      )}
                    </td>
                    <td>
                      <span className={`subtle-badge ${user.mustChangePassword ? "warning-badge" : ""}`}>
                        {user.mustChangePassword ? t("common.yes") : t("common.no")}
                      </span>
                    </td>
                    <td>{user.last_login_at || user.lastLoginAt ? formatDisplayDate(user.last_login_at || user.lastLoginAt, language) : "â€”"}</td>
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
                            <button
                              onClick={() => void sendInvitation(user)}
                              disabled={!user.email || invitingUserId === user.id}
                              title={!user.email ? t("auth.emailRequiredToSendInvitation") : ""}
                            >
                              {invitingUserId === user.id ? t("auth.sendingInvitation") : t("auth.sendInvitation")}
                            </button>
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

      <section className="section-card">
        <div className="section-heading">
          <div>
            <span className="eyebrow">{t("admin.assignCourses")}</span>
            <h2>{t("admin.assignCoursesTitle")}</h2>
            <p>{t("admin.assignCoursesHelp")}</p>
          </div>
          {selectedStudent ? (
            <span className="count-badge">
              {t("admin.assignedCoursesCountLabel", { count: assignedCourses.length })}
            </span>
          ) : null}
        </div>

        {!studentUsers.length ? (
          <p className="empty-copy">{t("admin.noStudentsAvailable")}</p>
        ) : (
          <div className="assignment-manager-grid">
            <div className="assignment-manager-column">
              <label>
                {t("admin.selectStudent")}
                <select value={selectedStudentId} onChange={(event) => setSelectedStudentId(event.target.value)}>
                  {studentUsers.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.name} Â· {student.email}
                    </option>
                  ))}
                </select>
              </label>

              {selectedStudent ? (
                <div className="assignment-student-card">
                  <strong>{selectedStudent.name}</strong>
                  <p>{selectedStudent.email}</p>
                  <div className="assignment-summary-grid">
                    <span className="subtle-badge">
                      {selectedStudent.username || t("admin.noUsername")}
                    </span>
                    <span className="subtle-badge">
                      {t("admin.assignedCoursesCountLabel", { count: assignedCourses.length })}
                    </span>
                  </div>
                  {!assignedCourses.length ? (
                    <p className="empty-copy">{t("admin.studentHasNoAssignedCourses")}</p>
                  ) : null}
                </div>
              ) : null}

              <div className="assignment-summary-grid">
                <article className="assignment-summary-card">
                  <span className="eyebrow">{t("admin.assignedCourses")}</span>
                  <strong>{assignedCourses.length}</strong>
                  <p>
                    {assignedCourses.length
                      ? assignedCourses.map((course) => course.title).join(" Â· ")
                      : t("admin.studentHasNoAssignedCourses")}
                  </p>
                </article>
                <article className="assignment-summary-card">
                  <span className="eyebrow">{t("admin.availableCourses")}</span>
                  <strong>{availableCourses.length}</strong>
                  <p>{t("student.onlyEnrolledStudentsCanViewCourse")}</p>
                </article>
              </div>
            </div>

            <div className="assignment-manager-column">
              <div className="assignment-course-list">
                {safeCourses.map((course) => {
                  const isAssigned = assignmentDraftCourseIds.some((courseId) => String(courseId) === String(course.id));
                  const enrolledStudentsCount = Array.isArray(course?.owners) ? course.owners.length : 0;

                  return (
                    <article className="assignment-course-card" key={course.id}>
                      <div>
                        <strong>{course.title}</strong>
                        <p>{course.description}</p>
                        <div className="assignment-course-meta">
                          <Status status={course.status || "published"} />
                          <span className="subtle-badge">
                            {t("admin.enrolledStudentsCount", { count: enrolledStudentsCount })}
                          </span>
                        </div>
                      </div>
                      <ToggleSwitch
                        checked={isAssigned}
                        onChange={(checked) => toggleCourseAssignment(course.id, checked)}
                        label={isAssigned ? t("admin.activeAccess") : t("admin.noAccess")}
                      />
                    </article>
                  );
                })}
              </div>

              <div className="form-actions">
                <button
                  type="button"
                  className="primary-btn"
                  disabled={!selectedStudentId || savingAssignments}
                  onClick={() => void saveAssignments()}
                >
                  {savingAssignments ? t("common.saving") : t("admin.saveAssignments")}
                </button>
              </div>
            </div>
          </div>
        )}
      </section>

      {pendingDeleteUser ? (
        <div className="modal-backdrop" onMouseDown={() => setPendingDeleteUser(null)}>
          <div className="certificate-modal confirm-modal" onMouseDown={(event) => event.stopPropagation()}>
            <button className="modal-close" type="button" onClick={() => setPendingDeleteUser(null)}>Ã—</button>
            <span className="eyebrow">{t("common.deleteUser")}</span>
            <h2>{t("common.confirmDeleteUserTitle")}</h2>
            <p>{t("common.confirmDeleteUserBody")}</p>
            <p><strong>{pendingDeleteUser.name}</strong> Â· {pendingDeleteUser.email}</p>
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

function CourseStudentAssignmentSelector({
  students,
  selectedStudentIds,
  searchTerm,
  onSearchChange,
  onToggleStudent,
  onSelectAll,
  onClearAll,
  isOpen,
  onToggleOpen,
  t,
}) {
  const selectedSet = new Set((selectedStudentIds || []).map((studentId) => String(studentId)));
  const filteredStudents = (students || []).filter((student) => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return true;

    return [student.name, student.email, student.username]
      .filter(Boolean)
      .some((value) => `${value}`.toLowerCase().includes(query));
  });

  const selectedCountLabel = t("admin.studentsSelectedCount", { count: selectedSet.size });

  return (
    <section className="module-generator-card assignment-dropdown-card">
      <div className="assignment-dropdown-header">
        <div>
          <span className="eyebrow">{t("admin.assignStudents")}</span>
          <h4>{t("admin.assignStudents")}</h4>
          <p>{t("admin.assignStudentsHelp")}</p>
        </div>
        <span className="count-badge">{selectedCountLabel}</span>
      </div>

      <button type="button" className="assignment-dropdown-trigger" onClick={onToggleOpen}>
        <span>{selectedCountLabel}</span>
        <span>{isOpen ? t("common.collapse") : t("common.expand")}</span>
      </button>

      {isOpen ? (
        <div className="assignment-dropdown-panel">
          <label>
            {t("admin.searchStudents")}
            <input
              value={searchTerm}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder={t("admin.searchStudents")}
            />
          </label>

          <div className="row-actions">
            <button type="button" className="secondary-btn" onClick={onSelectAll}>
              {t("admin.selectAllStudents")}
            </button>
            <button type="button" className="secondary-btn" onClick={onClearAll}>
              {t("admin.clearStudentSelection")}
            </button>
          </div>

          <div className="assignment-student-picker-list">
            {filteredStudents.length ? (
              filteredStudents.map((student) => {
                const isChecked = selectedSet.has(String(student.id));
                return (
                  <button
                    key={student.id}
                    type="button"
                    className={`assignment-student-option ${isChecked ? "is-selected" : ""}`.trim()}
                    onClick={() => onToggleStudent(student.id)}
                  >
                    <span className="assignment-student-option-check" aria-hidden="true">
                      {isChecked ? "âœ“" : ""}
                    </span>
                    <span className="assignment-student-option-copy">
                      <strong>{student.name}</strong>
                      <small>{student.email}</small>
                      {student.username ? <small>@{student.username}</small> : null}
                    </span>
                  </button>
                );
              })
            ) : (
              <p className="empty-copy">{t("admin.noStudentsAvailable")}</p>
            )}
          </div>

          {!selectedSet.size ? (
            <small className="field-note">{t("admin.courseHasNoAssignedStudents")}</small>
          ) : null}
        </div>
      ) : null}
    </section>
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
  const pdfPreview = getModulePdfViewerSource(module);
  const videoPreview = getModuleVideoViewerSource(module);

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
          <span className="eyebrow">{t("admin.pdfResource")}</span>
          <h5>{module.pdf_url || module.pdfUrl ? module.pdfLabel : module.pdfPendingName || module.pdfLabel}</h5>
        </div>

        <label className="upload-field">
          {t("common.uploadPdf")}
          <input id={`module-pdf-${module.id}`} type="file" accept={PDF_ACCEPT} onChange={(event) => void uploadPdf(module.id, event.target.files?.[0])} />
        </label>

        {module.pdfUploading && <small className="field-note">{t("common.uploadingPdf")}</small>}
        {module.pdfError && <small className="field-note danger-text">{module.pdfError}</small>}
        <label>
          {t("admin.externalPdfLink")}
          <input
            id={`module-pdf-external-${module.id}`}
            value={module.pdfExternalUrl || module.pdf_external_url || ""}
            onChange={(event) =>
              updateModule(module.id, (currentModule) => ({
                ...currentModule,
                pdfExternalUrl: event.target.value,
                pdf_external_url: event.target.value,
                pdfUrl:
                  currentModule.pdfStoragePath || currentModule.pdf_storage_path
                    ? currentModule.pdf_url || currentModule.pdfUrl || ""
                    : event.target.value,
                pdf_url:
                  currentModule.pdfStoragePath || currentModule.pdf_storage_path
                    ? currentModule.pdf_url || currentModule.pdfUrl || ""
                    : event.target.value,
                pdfSource: event.target.value ? "external" : currentModule.pdfSource,
                pdf_source: event.target.value ? "external" : currentModule.pdf_source,
              }))
            }
            placeholder="https://drive.google.com/..."
          />
        </label>
        <small className="field-note">{t("admin.externalPdfHelper")}</small>
        <small className="field-note">{t("admin.googleDrivePermissionHelper")}</small>
        {module.pdfPendingName && !module.pdf_url && !module.pdfUrl ? (
          <small className="field-note">
            {t("common.selectedFile", {
              name: `${module.pdfPendingName}${module.pdfPendingSize ? ` (${formatFileSize(module.pdfPendingSize)})` : ""}`,
            })}
          </small>
        ) : null}

        {pdfPreview.uploadedUrl ? (
          <a href={pdfPreview.uploadedUrl} target="_blank" rel="noreferrer">{t("common.openPdf")}</a>
        ) : module.pdfPendingName ? (
          <small className="field-note">{t("common.noPdfUploadedYet")}</small>
        ) : (
          <small className="field-note">{t("common.noPdfUploadedYet")}</small>
        )}

        {pdfPreview.usesExternal ? (
          <div className="resource-preview-card">
            {pdfPreview.isEmbeddable ? (
              <>
                <small className="field-note">{t("common.previewAvailable")}</small>
                <div className="resource-viewer-shell compact">
                  <iframe
                    className="resource-viewer-frame resource-preview-frame"
                    title={t("common.pdfPreviewTitle")}
                    src={pdfPreview.viewerUrl}
                    width="100%"
                    height="220"
                    loading="lazy"
                    allow="autoplay"
                  />
                </div>
              </>
            ) : null}
            <small className="field-note">{t("common.previewFallbackOpensNewTab")}</small>
            <div className="row-actions resource-viewer-actions">
              <a href={pdfPreview.externalUrl} target="_blank" rel="noreferrer">{t("common.openPdfInNewTab")}</a>
            </div>
          </div>
        ) : null}

        <div className="row-actions">
          <button type="button" onClick={() => document.getElementById(`module-pdf-${module.id}`)?.click()}>
            {t("common.replacePdf")}
          </button>
          <button
            type="button"
            onClick={() => {
              document.getElementById(`module-pdf-external-${module.id}`)?.focus();
              updateModule(module.id, (currentModule) => ({
                ...currentModule,
                pdfSource: "external",
                pdf_source: "external",
              }));
            }}
          >
            {t("common.useExternalLink")}
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
                pdfPendingType: "",
                pdfExternalUrl: "",
                pdf_external_url: "",
                pdfSource: "upload",
                pdf_source: "upload",
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
          <span className="eyebrow">{t("admin.videoResource")}</span>
          <h5>{module.video_url || module.videoUrl ? module.video.uploadLabel : module.videoPendingName || firstFilledValue(module.video_external_url, module.videoExternalUrl, module.video.link) || t("common.noVideoSelected")}</h5>
        </div>

        <label className="upload-field">
          {t("common.uploadVideo")}
          <input id={`module-video-${module.id}`} type="file" accept={VIDEO_ACCEPT} onChange={(event) => void uploadVideo(module.id, event.target.files?.[0])} />
        </label>

        {module.video.uploading && <small className="field-note">{t("common.uploadingVideo")}</small>}
        {module.video.error && <small className="field-note danger-text">{module.video.error}</small>}
        {module.video.error === t("admin.videoTooLargeUseExternal") || module.video.error === t("admin.videoTooLargeDirectUpload") ? (
          <div className="row-actions">
            <button
              type="button"
              onClick={() => {
                document.getElementById(`module-video-external-${module.id}`)?.focus();
                updateModule(module.id, (currentModule) => ({
                  ...currentModule,
                  videoSource: "external",
                  video_source: "external",
                }));
              }}
            >
              {t("common.useExternalLink")}
            </button>
          </div>
        ) : null}
        {module.videoPendingName && !module.video_url && !module.videoUrl ? (
          <small className="field-note">
            {t("common.selectedFile", {
              name: `${module.videoPendingName}${module.videoPendingSize ? ` (${formatFileSize(module.videoPendingSize)})` : ""}`,
            })}
          </small>
        ) : null}

        {videoPreview.uploadedUrl ? (
          <>
            <a href={videoPreview.uploadedUrl} target="_blank" rel="noreferrer">{t("common.openVideo")}</a>
            <div className="video-player-shell">
              <video controls width="100%" src={videoPreview.uploadedUrl} />
            </div>
          </>
        ) : videoPreview.externalUrl ? (
          <a href={videoPreview.externalUrl} target="_blank" rel="noreferrer">{t("common.openVideo")}</a>
        ) : module.videoPendingName ? (
          <small className="field-note">{t("common.noVideoUploadedYet")}</small>
        ) : (
          <small className="field-note">{t("common.noVideoUploadedYet")}</small>
        )}

        <label>
          {t("admin.externalVideoLink")}
          <input
            id={`module-video-external-${module.id}`}
            value={firstFilledValue(module.video_external_url, module.videoExternalUrl, module.video.link)}
            onChange={(event) =>
              updateModule(module.id, (currentModule) => ({
                ...currentModule,
                videoUrl:
                  currentModule.videoStoragePath || currentModule.video_storage_path
                    ? currentModule.video_url || currentModule.videoUrl || ""
                    : event.target.value,
                video_url:
                  currentModule.videoStoragePath || currentModule.video_storage_path
                    ? currentModule.video_url || currentModule.videoUrl || ""
                    : event.target.value,
                videoExternalUrl: event.target.value,
                video_external_url: event.target.value,
                videoSource: event.target.value ? "external" : currentModule.videoSource,
                video_source: event.target.value ? "external" : currentModule.video_source,
                videoFile: event.target.value ? null : currentModule.videoFile,
                videoPendingName: event.target.value ? "" : currentModule.videoPendingName,
                videoPendingSize: event.target.value ? null : currentModule.videoPendingSize,
                videoPendingType: event.target.value ? "" : currentModule.videoPendingType,
                video: {
                  ...currentModule.video,
                  link: event.target.value,
                  url:
                    currentModule.videoStoragePath || currentModule.video_storage_path
                      ? currentModule.video?.url || currentModule.video_url || currentModule.videoUrl || ""
                      : event.target.value,
                  error: event.target.value ? "" : currentModule.video.error,
                },
              }))
            }
            placeholder="https://example.com/video"
          />
        </label>
        <small className="field-note">{t("admin.externalVideoHelper")}</small>
        <small className="field-note">{t("admin.googleDrivePermissionHelper")}</small>
        {isVimeoUrl(firstFilledValue(module.video_external_url, module.videoExternalUrl, module.video.link)) ? (
          <>
            <small className="field-note">{t("admin.vimeoRecommended")}</small>
            <small className="field-note">{t("admin.vimeoDomainRestriction")}</small>
          </>
        ) : null}

        {videoPreview.usesExternal ? (
          <div className="resource-preview-card">
            {videoPreview.isEmbeddable ? (
              <>
                <small className="field-note">{t("common.previewAvailable")}</small>
                <div className="resource-viewer-shell compact">
                  <iframe
                    className="resource-viewer-frame resource-preview-frame"
                    title={isVimeoUrl(videoPreview.externalUrl) ? t("common.vimeoVideoPlayerTitle") : t("common.videoPreviewTitle")}
                    src={videoPreview.viewerUrl}
                    width="100%"
                    height="220"
                    loading="lazy"
                    allow="autoplay; fullscreen"
                    allowFullScreen
                  />
                </div>
              </>
            ) : null}
            <small className="field-note">{t("common.previewFallbackOpensNewTab")}</small>
            <div className="row-actions resource-viewer-actions">
              <a href={videoPreview.externalUrl} target="_blank" rel="noreferrer">{t("common.openVideoInNewTab")}</a>
            </div>
          </div>
        ) : null}

        <div className="row-actions">
          <button type="button" onClick={() => document.getElementById(`module-video-${module.id}`)?.click()}>
            {t("common.replaceVideo")}
          </button>
          <button
            type="button"
            onClick={() => {
              document.getElementById(`module-video-external-${module.id}`)?.focus();
              updateModule(module.id, (currentModule) => ({
                ...currentModule,
                videoSource: "external",
                video_source: "external",
              }));
            }}
          >
            {t("common.useExternalLink")}
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
                videoPendingType: "",
                videoExternalUrl: "",
                video_external_url: "",
                videoSource: "upload",
                video_source: "upload",
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
          {videoPreview.externalUrl ? `Video link: ${videoPreview.externalUrl}` : t("common.noVideoLinkAdded")}
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
              {t("admin.assignmentTitleSpanish")}
              <input
                value={module.assignment.titleEs || module.assignment.title_es || ""}
                onChange={(event) =>
                  updateAssignment(module.id, (assignment) => ({
                    ...assignment,
                    titleEs: event.target.value,
                    title_es: event.target.value,
                    title:
                      assignment.titleEn ||
                      assignment.title_en ||
                      event.target.value,
                  }))
                }
                placeholder={t("admin.weeklyHomework")}
              />
            </label>

            <label>
              {t("admin.assignmentInstructionsSpanish")}
              <textarea
                rows="4"
                value={module.assignment.instructionsEs || module.assignment.instructions_es || ""}
                onChange={(event) =>
                  updateAssignment(module.id, (assignment) => ({
                    ...assignment,
                    instructionsEs: event.target.value,
                    instructions_es: event.target.value,
                    instructions:
                      assignment.instructionsEn ||
                      assignment.instructions_en ||
                      event.target.value,
                  }))
                }
                placeholder={t("admin.tellStudentsWhatToSubmit")}
              />
            </label>

            <label>
              {t("admin.assignmentTitleEnglish")}
              <input
                value={module.assignment.titleEn || module.assignment.title_en || ""}
                onChange={(event) =>
                  updateAssignment(module.id, (assignment) => ({
                    ...assignment,
                    titleEn: event.target.value,
                    title_en: event.target.value,
                    title: event.target.value || assignment.titleEs || assignment.title_es,
                  }))
                }
                placeholder={t("admin.weeklyHomework")}
              />
            </label>

            <label>
              {t("admin.assignmentInstructionsEnglish")}
              <textarea
                rows="4"
                value={module.assignment.instructionsEn || module.assignment.instructions_en || ""}
                onChange={(event) =>
                  updateAssignment(module.id, (assignment) => ({
                    ...assignment,
                    instructionsEn: event.target.value,
                    instructions_en: event.target.value,
                    instructions: event.target.value || assignment.instructionsEs || assignment.instructions_es,
                  }))
                }
                placeholder={t("admin.tellStudentsWhatToSubmit")}
              />
            </label>

            <small className="field-note">{t("admin.assignmentTranslationHelper")}</small>

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

function PostCoursesPage({ users, courses, onSaveCourse, onDeleteCourse }) {
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
  const [isPublishing, setIsPublishing] = useState(false);
  const [draftReady, setDraftReady] = useState(false);
  const [collapsedModuleIds, setCollapsedModuleIds] = useState([]);
  const [bulkPdfFiles, setBulkPdfFiles] = useState([]);
  const [bulkVideoFiles, setBulkVideoFiles] = useState([]);
  const [bulkPdfLinksText, setBulkPdfLinksText] = useState("");
  const [bulkVideoLinksText, setBulkVideoLinksText] = useState("");
  const [savedDrafts, setSavedDrafts] = useState([]);
  const [draftsLoading, setDraftsLoading] = useState(false);
  const [draftsMessage, setDraftsMessage] = useState("");
  const [draftsError, setDraftsError] = useState("");
  const [activeSavedDraftId, setActiveSavedDraftId] = useState("");
  const [pendingLocalRestore, setPendingLocalRestore] = useState(null);
  const [pendingDeleteDraftId, setPendingDeleteDraftId] = useState("");
  const [studentAssignmentOpen, setStudentAssignmentOpen] = useState(true);
  const [studentSearch, setStudentSearch] = useState("");

  const studentOptions = (Array.isArray(users) ? users : []).filter(
    (user) => normalizeRoleKey(user.roleKey ?? user.role) === "student",
  );

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

  const toggleAssignedStudent = (studentId) => {
    const normalizedStudentId = `${studentId}`;
    setForm((current) => {
      const currentIds = new Set((current.selectedStudentIds || []).map((value) => `${value}`));
      if (currentIds.has(normalizedStudentId)) currentIds.delete(normalizedStudentId);
      else currentIds.add(normalizedStudentId);

      return {
        ...current,
        selectedStudentIds: Array.from(currentIds),
      };
    });
  };

  const selectAllStudents = () => {
    setForm((current) => ({
      ...current,
      selectedStudentIds: studentOptions.map((student) => `${student.id}`),
    }));
  };

  const clearAssignedStudents = () => {
    setForm((current) => ({
      ...current,
      selectedStudentIds: [],
    }));
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

  const updateBulkSelectionStatus = (kind, moduleId, status) => {
    const field = kind === "pdf" ? "bulkPdfSelections" : "bulkVideoSelections";
    setForm((current) => ({
      ...current,
      [field]: (current[field] || []).map((entry) =>
        entry.assignedModuleId === moduleId ? { ...entry, uploadStatus: status } : entry,
      ),
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
    setBulkPdfFiles([]);
    setBulkVideoFiles([]);
    setBulkPdfLinksText("");
    setBulkVideoLinksText("");
    setActiveSavedDraftId("");
    setDraftMessage("");
    setDraftWarning("");
    setSaveMessage("");
    setSaveError("");
    setBulkGeneratorError("");
    setStudentAssignmentOpen(true);
    setStudentSearch("");
    setCollapsedModuleIds(createCollapsedModuleIds(course.modules || [], (course.modules || []).length > 12));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const reset = () => {
    setForm(createCourseDraft());
    setEditingId(null);
    setBulkPdfFiles([]);
    setBulkVideoFiles([]);
    setBulkPdfLinksText("");
    setBulkVideoLinksText("");
    setActiveSavedDraftId("");
    setBulkModuleCount("1");
    setBulkGeneratorError("");
    setGeneratorDialog(null);
    setCollapsedModuleIds([]);
    setSaveError("");
    setPublishProgress("");
    setStudentAssignmentOpen(true);
    setStudentSearch("");
  };

  const loadSavedDrafts = async () => {
    setDraftsLoading(true);
    setDraftsError("");
    try {
      const drafts = await getCourseDrafts();
      setSavedDrafts(drafts);
    } catch (error) {
      console.error("Loading course drafts failed:", error);
      setDraftsError(t("admin.loadingDraftsFailed"));
    } finally {
      setDraftsLoading(false);
    }
  };

  useEffect(() => {
    void loadSavedDrafts();
  }, []);

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
      setPendingLocalRestore({
        form: restoredForm,
        editingId: parsedDraft.editingId ?? null,
      });
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
      Boolean((form.bulkPdfSelections || []).length) ||
      Boolean((form.bulkVideoSelections || []).length) ||
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

  const restorePendingLocalDraft = () => {
    if (!pendingLocalRestore) return;

    const restoredForm = pendingLocalRestore.form;
    const hasPendingReselection = restoredForm.modules.some(
      (module) => module.pdfPendingName || module.videoPendingName,
    ) || Boolean((restoredForm.bulkPdfSelections || []).length || (restoredForm.bulkVideoSelections || []).length);

    setForm(restoredForm);
    setBulkPdfFiles([]);
    setBulkVideoFiles([]);
    setBulkPdfLinksText("");
    setBulkVideoLinksText("");
    setEditingId(pendingLocalRestore.editingId ?? null);
    setBulkModuleCount(String((restoredForm.modules || []).length || 1));
    setCollapsedModuleIds(createCollapsedModuleIds(restoredForm.modules || [], (restoredForm.modules || []).length > 12));
    setDraftMessage(t("admin.restoredDraft"));
    setDraftWarning(hasPendingReselection ? t("admin.reselectFilesAfterRestore") : "");
    setPendingLocalRestore(null);
  };

  const discardPendingLocalDraft = () => {
    try {
      window.localStorage.removeItem(COURSE_DRAFT_STORAGE_KEY);
    } catch (error) {
      console.error("Discarding the pending local draft failed:", error);
    }
    setPendingLocalRestore(null);
  };

  const handleManualSaveDraft = async () => {
    setDraftsMessage("");
    setDraftsError("");

    try {
      const savedDraft = await saveCourseDraft({
        id: activeSavedDraftId || undefined,
        title: form.title.trim(),
        description: form.description.trim(),
        draftData: createSerializableCourseDraft(form),
      });

      setActiveSavedDraftId(savedDraft.id);
      setDraftsMessage(t("admin.draftSavedSuccessfully"));
      await loadSavedDrafts();
    } catch (error) {
      console.error("Manual draft save failed:", error);
      setDraftsError(t("admin.savingDraftFailed"));
    }
  };

  const loadSavedDraftIntoBuilder = (draft) => {
    const restoredForm = restoreCourseDraft(draft.draftData || draft.draft_data || {});
    const hasPendingReselection = restoredForm.modules.some(
      (module) => module.pdfPendingName || module.videoPendingName,
    ) || Boolean((restoredForm.bulkPdfSelections || []).length || (restoredForm.bulkVideoSelections || []).length);

    setForm(restoredForm);
    setBulkPdfFiles([]);
    setBulkVideoFiles([]);
    setBulkPdfLinksText("");
    setBulkVideoLinksText("");
    setEditingId(null);
    setActiveSavedDraftId(draft.id);
    setBulkModuleCount(String((restoredForm.modules || []).length || 1));
    setCollapsedModuleIds(createCollapsedModuleIds(restoredForm.modules || [], (restoredForm.modules || []).length > 12));
    setDraftMessage(t("admin.restoredDraft"));
    setDraftWarning(hasPendingReselection ? t("admin.reselectFilesAfterRestore") : "");
    setDraftsMessage("");
    setDraftsError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDeleteSavedDraft = async (draftId) => {
    setDraftsMessage("");
    setDraftsError("");

    try {
      await deleteCourseDraft(draftId);
      if (activeSavedDraftId === draftId) {
        setActiveSavedDraftId("");
      }
      setPendingDeleteDraftId("");
      setDraftsMessage(t("admin.draftDeletedSuccessfully"));
      await loadSavedDrafts();
    } catch (error) {
      console.error("Deleting saved draft failed:", error);
      setDraftsError(t("admin.deletingDraftFailed"));
    }
  };

  const assignBulkPdfLinks = () => {
    const links = bulkPdfLinksText
      .split(/\r?\n/)
      .map((value) => value.trim())
      .filter(Boolean);

    setForm((current) => ({
      ...current,
      modules: current.modules.map((module, index) => {
        const link = links[index];
        if (!link) return module;
        return {
          ...module,
          pdfExternalUrl: link,
          pdf_external_url: link,
          pdfSource: "external",
          pdf_source: "external",
          pdfUrl: module.pdfStoragePath || module.pdf_storage_path ? module.pdf_url || module.pdfUrl || "" : link,
          pdf_url: module.pdfStoragePath || module.pdf_storage_path ? module.pdf_url || module.pdfUrl || "" : link,
          pdfLabel: module.pdf_url || module.pdfUrl ? module.pdfLabel : link,
        };
      }),
    }));
  };

  const assignBulkVideoLinks = () => {
    const links = bulkVideoLinksText
      .split(/\r?\n/)
      .map((value) => value.trim())
      .filter(Boolean);

    setForm((current) => ({
      ...current,
      modules: current.modules.map((module, index) => {
        const link = links[index];
        if (!link) return module;
        return {
          ...module,
          videoExternalUrl: link,
          video_external_url: link,
          videoSource: "external",
          video_source: "external",
          videoUrl: module.videoStoragePath || module.video_storage_path ? module.video_url || module.videoUrl || "" : link,
          video_url: module.videoStoragePath || module.video_storage_path ? module.video_url || module.videoUrl || "" : link,
          video: {
            ...module.video,
            link,
            url: module.videoStoragePath || module.video_storage_path ? module.video_url || module.videoUrl || "" : link,
          },
        };
      }),
    }));
  };

  const handleBulkPdfSelection = (files) => {
    const nextFiles = Array.from(files || []);
    setBulkPdfFiles(nextFiles);
    setForm((current) => ({
      ...current,
      bulkPdfSelections: nextFiles.map((file, index) =>
        createBulkSelectionEntry({
          file,
          position: index,
          module: current.modules[index] || null,
          moduleIndex: current.modules[index] ? index : null,
          language,
          kind: "pdf",
        }),
      ),
    }));
  };

  const handleBulkVideoSelection = (files) => {
    const nextFiles = Array.from(files || []);
    setBulkVideoFiles(nextFiles);
    setForm((current) => ({
      ...current,
      bulkVideoSelections: nextFiles.map((file, index) =>
        createBulkSelectionEntry({
          file,
          position: index,
          module: current.modules[index] || null,
          moduleIndex: current.modules[index] ? index : null,
          language,
          kind: "video",
          tooLarge: (file?.size ?? 0) > MAX_VIDEO_SIZE_BYTES,
        }),
      ),
    }));
  };

  const assignBulkPdfFiles = () => {
    setForm((current) => {
      const nextModules = current.modules.map((module, index) => {
        const file = bulkPdfFiles[index];
        if (!file) return module;

        return {
          ...module,
          pdfFile: file,
          pdfPendingName: file.name,
          pdfPendingSize: file.size ?? null,
          pdfPendingType: file.type || "",
          pdfLabel: file.name,
          pdfName: file.name,
          pdf_file_name: file.name,
          pdfSource: "upload",
          pdf_source: "upload",
          pdfUrl: "",
          pdf_url: "",
          pdfStoragePath: "",
          pdf_storage_path: "",
          pdfUploading: false,
          pdfError: "",
        };
      });

      return {
        ...current,
        modules: nextModules,
        bulkPdfSelections: bulkPdfFiles.map((file, index) =>
          createBulkSelectionEntry({
            file,
            position: index,
            module: nextModules[index] || null,
            moduleIndex: nextModules[index] ? index : null,
            language,
            kind: "pdf",
          }),
        ),
      };
    });
  };

  const assignBulkVideoFiles = () => {
    setForm((current) => {
      const nextModules = current.modules.map((module, index) => {
        const file = bulkVideoFiles[index];
        if (!file) return module;
        if ((file.size ?? 0) > MAX_VIDEO_SIZE_BYTES) {
          return {
            ...module,
            video: {
              ...module.video,
              error: t("common.fileTooLarge"),
            },
          };
        }

        return {
          ...module,
          videoFile: file,
          videoPendingName: file.name,
          videoPendingSize: file.size ?? null,
          videoPendingType: file.type || "",
          videoSource: "upload",
          video_source: "upload",
          videoUrl: "",
          video_url: "",
          videoName: file.name,
          video_file_name: file.name,
          videoStoragePath: "",
          video_storage_path: "",
          video: {
            ...module.video,
            uploadLabel: file.name,
            url: "",
            link: "",
            uploading: false,
            error: "",
          },
        };
      });

      return {
        ...current,
        modules: nextModules,
        bulkVideoSelections: bulkVideoFiles.map((file, index) =>
          createBulkSelectionEntry({
            file,
            position: index,
            module: nextModules[index] || null,
            moduleIndex: nextModules[index] ? index : null,
            language,
            kind: "video",
            tooLarge: (file?.size ?? 0) > MAX_VIDEO_SIZE_BYTES,
          }),
        ),
      };
    });
  };

  const previewCourse = buildCoursePayload(form, editingId, courses.find((course) => course.id === editingId));
  const previewAssignedStudents = studentOptions.filter((student) =>
    (previewCourse.owners || []).some((studentId) => String(student.id) === String(studentId)),
  );

  const applyGeneratedModules = (count) => {
    const nextModules = createGeneratedModules(count, language);
    const shouldCollapse = count > 12;

    window.requestAnimationFrame(() => {
      setBulkPdfFiles([]);
      setBulkVideoFiles([]);
      setForm((current) => ({
        ...current,
        bulkPdfSelections: [],
        bulkVideoSelections: [],
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

  const uploadPendingModuleFiles = async () => {
    const nextForm = {
      ...form,
      modules: (form.modules || []).map((module) => ({
        ...module,
        video: {
          ...module.video,
        },
      })),
    };

    for (let index = 0; index < nextForm.modules.length; index += 1) {
      const module = nextForm.modules[index];
      const moduleTitle = getModuleDisplayTitle(module, index, language);

      if (module.pdfFile && !(module.pdf_url || module.pdfUrl)) {
        setPublishProgress(t("admin.uploadingModuleProgress", { current: index + 1, total: nextForm.modules.length }));
        updateModule(module.id, (currentModule) => ({
          ...currentModule,
          pdfUploading: true,
          pdfError: "",
        }));

        try {
          const uploadedPdf = await uploadModulePdf(module.pdfFile, module.id);
          if (!uploadedPdf.publicUrl) {
            throw new Error(t("admin.uploadedMissingPublicUrlPdf"));
          }

          Object.assign(module, {
            pdfUrl: uploadedPdf.publicUrl,
            pdf_url: uploadedPdf.publicUrl,
            pdfLabel: uploadedPdf.fileName,
            pdfName: uploadedPdf.fileName,
            pdf_file_name: uploadedPdf.fileName,
            pdfStoragePath: uploadedPdf.storagePath,
            pdf_storage_path: uploadedPdf.storagePath,
            pdfSource: "upload",
            pdf_source: "upload",
            pdfFile: null,
            pdfPendingName: "",
            pdfPendingSize: null,
            pdfPendingType: "",
            pdfUploading: false,
            pdfError: "",
          });

          updateBulkSelectionStatus("pdf", module.id, "uploaded");
          updateModule(module.id, () => ({ ...module }));
        } catch (error) {
          console.error("Sequential PDF upload failed:", error);
          updateBulkSelectionStatus("pdf", module.id, "failed");
          updateModule(module.id, (currentModule) => ({
            ...currentModule,
            pdfUploading: false,
            pdfError:
              error?.message ||
              t("admin.pdfUploadFailedInModule", {
                number: index + 1,
                moduleTitle,
              }),
          }));
          throw error;
        }
      }

      if (module.videoFile && !getModuleHasVideo(module)) {
        setPublishProgress(t("admin.uploadingModuleProgress", { current: index + 1, total: nextForm.modules.length }));
        updateModule(module.id, (currentModule) => ({
          ...currentModule,
          video: {
            ...currentModule.video,
            uploading: true,
            error: "",
          },
        }));

        try {
          const uploadedVideo = await uploadModuleVideo(module.videoFile, module.id);
          if (!uploadedVideo.publicUrl) {
            throw new Error(t("admin.uploadedMissingPublicUrlVideo"));
          }

          Object.assign(module, {
            videoUrl: uploadedVideo.publicUrl,
            video_url: uploadedVideo.publicUrl,
            videoName: uploadedVideo.fileName,
            video_file_name: uploadedVideo.fileName,
            videoStoragePath: uploadedVideo.storagePath,
            video_storage_path: uploadedVideo.storagePath,
            videoSource: "upload",
            video_source: "upload",
            videoFile: null,
            videoPendingName: "",
            videoPendingSize: null,
            videoPendingType: "",
            video: {
              ...module.video,
              uploadLabel: uploadedVideo.fileName,
              url: uploadedVideo.publicUrl,
              uploading: false,
              error: "",
            },
          });

          updateBulkSelectionStatus("video", module.id, "uploaded");
          updateModule(module.id, () => ({ ...module }));
        } catch (error) {
          console.error("Sequential video upload failed:", error);
          updateBulkSelectionStatus("video", module.id, "failed");
          updateModule(module.id, (currentModule) => ({
            ...currentModule,
            video: {
              ...currentModule.video,
              uploading: false,
              error:
                error?.message ||
                t("admin.videoUploadFailedInModule", {
                  number: index + 1,
                  moduleTitle,
                }),
            },
          }));
          throw error;
        }
      }
    }

    return nextForm;
  };

  const submit = async (event) => {
    event.preventDefault();
    setSaveError("");
    setSaveMessage("");
    setDraftMessage("");
    setDraftWarning("");

    if (isBusy) return;

    const invalidModule = form.modules.find((module) => {
      const hasPdf = Boolean(module.pdf_url || module.pdfUrl || module.pdfFile);
      const hasVideo = getModuleHasVideo(module);
      const needsPdfReselect = Boolean(module.pdfPendingName && !module.pdfFile && !(module.pdf_url || module.pdfUrl));
      const needsVideoReselect = Boolean(
        module.videoPendingName &&
        !module.videoFile &&
        !getModuleHasVideo(module),
      );
      return !hasPdf || !hasVideo || needsPdfReselect || needsVideoReselect || module.pdfUploading || module.video?.uploading;
    });

    if (invalidModule) {
      const needsReselect = Boolean(
        (invalidModule.pdfPendingName && !invalidModule.pdfFile && !(invalidModule.pdf_url || invalidModule.pdfUrl)) ||
        (
          invalidModule.videoPendingName &&
          !invalidModule.videoFile &&
          !getModuleHasVideo(invalidModule)
        ),
      );
      setSaveError(
        needsReselect
          ? t("admin.reselectFilesAfterRestore")
          : t("admin.completeModuleFilesBeforePublishing", {
              moduleTitle: invalidModule.title || t("common.module"),
            }),
      );
      return;
    }

    setIsPublishing(true);

    try {
      const preparedForm = await uploadPendingModuleFiles();
      const existingCourse = courses.find((course) => course.id === editingId);
      const payload = buildCoursePayload(preparedForm, editingId, existingCourse);
      console.log("Module payload right before saving:", payload.modules);

      const result = await onSaveCourse(payload, editingId, {
        onProgress: ({ current, total }) => {
          setPublishProgress(t("admin.uploadingModuleProgress", { current, total }));
        },
      });

      if (result?.ok === false) {
        setSaveError(result.error || t("admin.savingCourseFailed"));
        return;
      }

      try {
        window.localStorage.removeItem(COURSE_DRAFT_STORAGE_KEY);
      } catch (error) {
        console.error("Clearing the unpublished course draft after publish failed:", error);
      }

      if (activeSavedDraftId) {
        await markCourseDraftPublished(activeSavedDraftId);
        setActiveSavedDraftId("");
        await loadSavedDrafts();
      }

      setSaveMessage(editingId ? t("admin.courseUpdatedSuccessfully") : t("admin.coursePublishedSuccessfully"));
      reset();
    } catch (error) {
      console.error("Course save failed:", error);
      setSaveError(error?.message || t("admin.savingCourseFailed"));
    } finally {
      setIsPublishing(false);
      setPublishProgress("");
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
      pdfPendingType: selectedFile.type || "",
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
        pdfSource: "upload",
        pdf_source: "upload",
        pdfFile: null,
        pdfPendingName: "",
        pdfPendingSize: null,
        pdfPendingType: "",
      }));
      updateBulkSelectionStatus("pdf", moduleId, "uploaded");
    } catch (error) {
      console.error("PDF upload failed:", error);
      updateBulkSelectionStatus("pdf", moduleId, "failed");
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
        videoPendingType: selectedFile.type || "",
        video: {
          ...module.video,
          uploading: false,
          error: t("admin.videoTooLargeUseExternal"),
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
      videoPendingType: selectedFile.type || "",
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
        videoSource: "upload",
        video_source: "upload",
        videoFile: null,
        videoPendingName: "",
        videoPendingSize: null,
        videoPendingType: "",
        video: {
          ...module.video,
          uploading: false,
          error: "",
          uploadLabel: uploaded.fileName,
          url: uploaded.publicUrl,
          link: module.video.link,
        },
      }));
      updateBulkSelectionStatus("video", moduleId, "uploaded");
    } catch (error) {
      console.error("Video upload failed:", error);
      updateBulkSelectionStatus("video", moduleId, "failed");
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
          <button type="button" className="secondary-btn" onClick={() => void handleManualSaveDraft()} disabled={isBusy}>
            {t("admin.saveDraft")}
          </button>
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

        <CourseStudentAssignmentSelector
          students={studentOptions}
          selectedStudentIds={form.selectedStudentIds || []}
          searchTerm={studentSearch}
          onSearchChange={setStudentSearch}
          onToggleStudent={toggleAssignedStudent}
          onSelectAll={selectAllStudents}
          onClearAll={clearAssignedStudents}
          isOpen={studentAssignmentOpen}
          onToggleOpen={() => setStudentAssignmentOpen((current) => !current)}
          t={t}
        />

        {saveError && <small className="field-note danger-text">{saveError}</small>}
        {saveMessage && <small className="field-note">{saveMessage}</small>}
        {draftMessage && <small className="field-note">{draftMessage}</small>}
        {draftWarning && <small className="field-note danger-text">{draftWarning}</small>}
        {publishProgress && <small className="field-note">{publishProgress}</small>}
        {isBusy ? <small className="field-note warning-badge">{t("admin.doNotCloseWhileUploading")}</small> : null}
        {draftsMessage && <small className="field-note">{draftsMessage}</small>}
        {draftsError && <small className="field-note danger-text">{draftsError}</small>}

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
              <button type="button" className="primary-btn" disabled={isBusy} onClick={generateModules}>
                {t("admin.generateModulesButton")}
              </button>
            </div>
            {bulkGeneratorError ? <small className="field-note danger-text">{bulkGeneratorError}</small> : null}
          </div>

          <div className="bulk-upload-grid">
            <section className="module-generator-card bulk-upload-card">
              <div>
                <span className="eyebrow">{t("admin.bulkPdfUpload")}</span>
                <h4>{t("admin.bulkPdfUpload")}</h4>
                <p>{t("admin.bulkPdfUploadDescription")}</p>
                <small className="field-note">{t("admin.filesAssignedInOrder")}</small>
                <small className="field-note">{t("admin.bulkPdfUploadExample")}</small>
              </div>

              <label>
                {t("admin.bulkPdfUpload")}
                <input type="file" multiple accept={PDF_ACCEPT} onChange={(event) => handleBulkPdfSelection(event.target.files)} />
              </label>

              {form.bulkPdfSelections?.length ? (
                <div className="bulk-upload-list">
                  {form.bulkPdfSelections.map((entry) => (
                    <article key={entry.id} className="bulk-upload-item">
                      <div>
                        <strong>{entry.fileName}</strong>
                        <span>{`${entry.originalOrder} â†’ ${entry.assignedModuleTitle || "â€”"}`}</span>
                      </div>
                      <div className="bulk-upload-meta">
                        <span className={`subtle-badge ${entry.uploadStatus === "uploaded" ? "" : entry.tooLarge ? "warning-badge" : ""}`}>
                          {entry.tooLarge
                            ? t("common.fileTooLarge")
                            : t("common.fileAssigned")}
                        </span>
                        {entry.tooLarge ? <small className="field-note danger-text">{t("common.replaceFileManually")}</small> : null}
                      </div>
                    </article>
                  ))}
                </div>
              ) : null}

              {form.bulkPdfSelections?.length > form.modules.length ? (
                <small className="field-note danger-text">{t("admin.morePdfsThanModules")}</small>
              ) : null}
              {form.bulkPdfSelections?.length > 0 && form.bulkPdfSelections?.length < form.modules.length ? (
                <small className="field-note warning-badge">{t("admin.someModulesMissingPdf")}</small>
              ) : null}

              <div className="row-actions">
                <button type="button" className="primary-btn" disabled={!form.bulkPdfSelections?.length || isBusy} onClick={assignBulkPdfFiles}>
                  {t("admin.assignPdfsToModules")}
                </button>
              </div>

              <label>
                {t("admin.externalPdfLink")}
                <textarea
                  rows="4"
                  value={bulkPdfLinksText}
                  onChange={(event) => setBulkPdfLinksText(event.target.value)}
                  placeholder={"https://drive.google.com/...\nhttps://example.com/file.pdf"}
                />
              </label>
              <small className="field-note">{t("admin.pasteOneLinkPerLine")}</small>
              <div className="row-actions">
                <button type="button" className="secondary-btn" disabled={!bulkPdfLinksText.trim() || isBusy} onClick={assignBulkPdfLinks}>
                  {t("common.useExternalLink")}
                </button>
              </div>
            </section>

            <section className="module-generator-card bulk-upload-card">
              <div>
                <span className="eyebrow">{t("admin.bulkVideoUpload")}</span>
                <h4>{t("admin.bulkVideoUpload")}</h4>
                <p>{t("admin.bulkVideoUploadDescription")}</p>
                <small className="field-note">{t("admin.filesAssignedInOrder")}</small>
                <small className="field-note">{t("admin.bulkVideoUploadExample")}</small>
              </div>

              <label>
                {t("admin.bulkVideoUpload")}
                <input type="file" multiple accept={VIDEO_ACCEPT} onChange={(event) => handleBulkVideoSelection(event.target.files)} />
              </label>

              {form.bulkVideoSelections?.length ? (
                <div className="bulk-upload-list">
                  {form.bulkVideoSelections.map((entry) => (
                    <article key={entry.id} className="bulk-upload-item">
                      <div>
                        <strong>{entry.fileName}</strong>
                        <span>{`${entry.originalOrder} â†’ ${entry.assignedModuleTitle || "â€”"}`}</span>
                      </div>
                      <div className="bulk-upload-meta">
                        <span className={`subtle-badge ${entry.uploadStatus === "uploaded" ? "" : entry.tooLarge ? "warning-badge" : ""}`}>
                          {entry.tooLarge
                            ? t("common.fileTooLarge")
                            : t("common.fileAssigned")}
                        </span>
                        {entry.tooLarge ? <small className="field-note danger-text">{t("common.replaceFileManually")}</small> : null}
                      </div>
                    </article>
                  ))}
                </div>
              ) : null}

              {form.bulkVideoSelections?.length > form.modules.length ? (
                <small className="field-note danger-text">{t("admin.moreVideosThanModules")}</small>
              ) : null}
              {form.bulkVideoSelections?.length > 0 && form.bulkVideoSelections?.length < form.modules.length ? (
                <small className="field-note warning-badge">{t("admin.someModulesMissingVideo")}</small>
              ) : null}

              <div className="row-actions">
                <button type="button" className="primary-btn" disabled={!form.bulkVideoSelections?.length || isBusy} onClick={assignBulkVideoFiles}>
                  {t("admin.assignVideosToModules")}
                </button>
              </div>

              <label>
                {t("admin.externalVideoLink")}
                <textarea
                  rows="4"
                  value={bulkVideoLinksText}
                  onChange={(event) => setBulkVideoLinksText(event.target.value)}
                  placeholder={"https://drive.google.com/...\nhttps://youtube.com/watch?v=..."}
                />
              </label>
              <small className="field-note">{t("admin.pasteOneLinkPerLine")}</small>
              <div className="row-actions">
                <button type="button" className="secondary-btn" disabled={!bulkVideoLinksText.trim() || isBusy} onClick={assignBulkVideoLinks}>
                  {t("common.useExternalLink")}
                </button>
              </div>
            </section>
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
          <button type="button" className="secondary-btn" onClick={() => void handleManualSaveDraft()} disabled={isBusy}>
            {t("admin.saveDraft")}
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
              <span className="subtle-badge">{t("admin.studentsSelectedCount", { count: previewAssignedStudents.length })}</span>
            </div>
            {previewAssignedStudents.length ? (
              <div className="assigned-students-preview">
                {previewAssignedStudents.map((student) => (
                  <span key={student.id} className="subtle-badge">
                    {student.name}
                  </span>
                ))}
              </div>
            ) : (
              <p className="empty-copy">{t("admin.courseHasNoAssignedStudents")}</p>
            )}
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
                  <span className="subtle-badge">
                    {t("admin.studentsSelectedCount", { count: Array.isArray(course.owners) ? course.owners.length : 0 })}
                  </span>
                  {Array.isArray(course.owners) && course.owners.length ? (
                    <div className="assigned-students-preview">
                      {studentOptions
                        .filter((student) => course.owners.some((studentId) => String(student.id) === String(studentId)))
                        .slice(0, 6)
                        .map((student) => (
                          <span key={student.id} className="subtle-badge">
                            {student.name}
                          </span>
                        ))}
                    </div>
                  ) : (
                    <small className="field-note">{t("admin.courseHasNoAssignedStudents")}</small>
                  )}
                </div>
                <div className="row-actions">
                  <button onClick={() => editCourse(course)}>{t("common.edit")}</button>
                  <button className="danger-text" onClick={() => void onDeleteCourse(course.id)}>{t("common.delete")}</button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="section-card posted-list">
          <div className="section-heading">
            <div>
              <span className="eyebrow">{t("admin.drafts")}</span>
              <h2>{t("admin.drafts")}</h2>
            </div>
            <span className="count-badge">{savedDrafts.length} {t("admin.drafts").toLowerCase()}</span>
          </div>

          {draftsLoading ? <small className="field-note">{t("common.loading")}</small> : null}

          <div className="course-admin-list">
            {savedDrafts.length ? savedDrafts.map((draft) => (
              <article key={draft.id}>
                <div className="course-symbol"><Icon name="courses" /></div>
                <div className="course-info">
                  <div className="row-actions">
                    <h3>{draft.title || t("admin.newCourse")}</h3>
                    <Status status={draft.status || "draft"} />
                  </div>
                  <p>{draft.description || t("admin.buildCourseStructure")}</p>
                  <span>{draft.modulesCount} {t("common.modules").toLowerCase()}</span>
                  <span>{t("admin.lastUpdated")}: {formatDisplayDate(draft.updatedAt, language)}</span>
                </div>
                <div className="row-actions">
                  <button type="button" onClick={() => loadSavedDraftIntoBuilder(draft)}>{t("admin.continueEditing")}</button>
                  <button type="button" className="danger-text" onClick={() => setPendingDeleteDraftId(draft.id)}>{t("admin.deleteDraft")}</button>
                </div>
              </article>
            )) : <p className="empty-copy">{t("admin.noSavedDrafts")}</p>}
          </div>
        </section>
      </div>

      {pendingLocalRestore ? (
        <div className="modal-backdrop" onMouseDown={discardPendingLocalDraft}>
          <div className="certificate-modal confirm-modal" onMouseDown={(event) => event.stopPropagation()}>
            <button className="modal-close" type="button" onClick={discardPendingLocalDraft}>Ã—</button>
            <span className="eyebrow">{t("admin.drafts")}</span>
            <h2>{t("admin.localDraftFound")}</h2>
            <div className="form-actions compact confirm-modal-actions">
              <button type="button" className="secondary-btn" onClick={restorePendingLocalDraft}>
                {t("admin.restoreDraft")}
              </button>
              <button type="button" className="secondary-btn" onClick={discardPendingLocalDraft}>
                {t("common.discard")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {pendingDeleteDraftId ? (
        <div className="modal-backdrop" onMouseDown={() => setPendingDeleteDraftId("")}>
          <div className="certificate-modal confirm-modal" onMouseDown={(event) => event.stopPropagation()}>
            <button className="modal-close" type="button" onClick={() => setPendingDeleteDraftId("")}>Ã—</button>
            <span className="eyebrow">{t("admin.drafts")}</span>
            <h2>{t("admin.confirmDeleteDraft")}</h2>
            <div className="form-actions compact confirm-modal-actions">
              <button type="button" className="secondary-btn" onClick={() => setPendingDeleteDraftId("")}>
                {t("common.cancel")}
              </button>
              <button type="button" className="primary-btn" onClick={() => void handleDeleteSavedDraft(pendingDeleteDraftId)}>
                {t("admin.deleteDraft")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {generatorDialog ? (
        <div className="modal-backdrop" onMouseDown={() => setGeneratorDialog(null)}>
          <div className="certificate-modal confirm-modal" onMouseDown={(event) => event.stopPropagation()}>
            <button className="modal-close" type="button" onClick={() => setGeneratorDialog(null)}>Ã—</button>
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

      const reviewedSubmission = await reviewSubmission(
        selectedSubmission.id,
        reviewForm.status,
        reviewForm.adminFeedback,
        gradeValue,
      );
      const certificateOutcome = reviewedSubmission?.certificateOutcome;
      setReviewMessage(
        certificateOutcome?.generated
          ? t("admin.assignmentGradedCertificateGenerated")
          : t("admin.assignmentGradedCertificatePending"),
      );
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
                      <div>{submission.studentEmail || "â€”"}</div>
                    </td>
                    <td>{submission.courseTitle || "â€”"}</td>
                    <td>{submission.moduleTitle || "â€”"}</td>
                    <td>{submission.assignmentTitle || "â€”"}</td>
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
            <p>{selectedSubmission ? `${selectedSubmission.studentName || t("common.student")} Â· ${selectedSubmission.courseTitle || t("common.course")}` : t("admin.selectFromList")}</p>
          </div>
        </div>

        {selectedSubmission ? (
          <div className="review-panel-content">
            <div className="review-meta-grid">
              <div>
                <small>{t("common.student")}</small>
                <strong>{selectedSubmission.studentName || t("common.student")}</strong>
                <p>{selectedSubmission.studentEmail || "â€”"}</p>
              </div>
              <div>
                <small>{t("common.course")}</small>
                <strong>{selectedSubmission.courseTitle || "â€”"}</strong>
                <p>{selectedSubmission.moduleTitle || "â€”"}</p>
              </div>
              <div>
                <small>{t("common.assignment")}</small>
                <strong>{selectedSubmission.assignmentTitle || "â€”"}</strong>
                <p>{selectedSubmission.status ? t(`status.${selectedSubmission.status}`) : "â€”"}</p>
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





