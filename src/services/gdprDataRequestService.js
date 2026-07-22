import { isSupabaseConfigured, supabase } from "../lib/supabaseClient.js";
import { getAdminAuditLogs } from "./auditLogService.js";
import { getStudentCertificates } from "./certificateService.js";
import { getCommunityPosts } from "./communityService.js";
import { getEnrollmentsByStudent } from "./enrollmentService.js";
import { getMockAssignmentSubmissions, getMockUsers } from "./mockStore.js";
import { getStudentProgress } from "./progressService.js";
import { getUsers } from "./userService.js";

const GDPR_REQUESTS_STORAGE_KEY = "nutripro-gdpr-data-requests";

function nowIso() {
  return new Date().toISOString();
}

function readLocalRequests() {
  if (typeof window === "undefined") return [];
  try {
    const rawValue = window.localStorage.getItem(GDPR_REQUESTS_STORAGE_KEY);
    const parsed = rawValue ? JSON.parse(rawValue) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn("Reading local GDPR data requests failed:", error);
    return [];
  }
}

function writeLocalRequests(requests) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(GDPR_REQUESTS_STORAGE_KEY, JSON.stringify(requests));
  } catch (error) {
    console.warn("Writing local GDPR data requests failed:", error);
  }
}

function createLocalId() {
  return `local-gdpr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeRequest(row = {}) {
  return {
    id: row.id ?? createLocalId(),
    userId: row.user_id ?? row.userId ?? "",
    userEmail: row.user_email ?? row.userEmail ?? "",
    requestType: row.request_type ?? row.requestType ?? "access_export",
    status: row.status ?? "open",
    requestedAt: row.requested_at ?? row.requestedAt ?? row.created_at ?? row.createdAt ?? "",
    completedAt: row.completed_at ?? row.completedAt ?? "",
    completedBy: row.completed_by ?? row.completedBy ?? "",
    notes: row.notes ?? "",
    createdAt: row.created_at ?? row.createdAt ?? "",
    updatedAt: row.updated_at ?? row.updatedAt ?? "",
  };
}

function sanitizeValue(value) {
  if (Array.isArray(value)) return value.map(sanitizeValue);
  if (!value || typeof value !== "object") return value;

  return Object.entries(value).reduce((safeObject, [key, entryValue]) => {
    const normalizedKey = `${key ?? ""}`.trim().toLowerCase();
    if (
      normalizedKey.includes("password") ||
      normalizedKey.includes("temporary_password") ||
      normalizedKey.includes("temp_password") ||
      normalizedKey.includes("token") ||
      normalizedKey.includes("reset_token") ||
      normalizedKey.includes("invite_token") ||
      normalizedKey.includes("access_token") ||
      normalizedKey.includes("refresh_token") ||
      normalizedKey.includes("service_role") ||
      normalizedKey.includes("service_key") ||
      normalizedKey.includes("secret") ||
      normalizedKey.includes("api_key") ||
      normalizedKey.includes("apikey") ||
      normalizedKey.includes("authorization") ||
      normalizedKey.includes("auth_user")
    ) {
      return safeObject;
    }

    safeObject[key] = sanitizeValue(entryValue);
    return safeObject;
  }, {});
}

function filterRequests(requests, filters = {}) {
  const status = `${filters.status ?? ""}`.trim().toLowerCase();
  const requestType = `${filters.requestType ?? ""}`.trim().toLowerCase();
  const userEmailSearch = `${filters.userEmailSearch ?? ""}`.trim().toLowerCase();

  return requests
    .filter((request) => !status || `${request.status ?? ""}`.trim().toLowerCase() === status)
    .filter((request) => !requestType || `${request.requestType ?? ""}`.trim().toLowerCase() === requestType)
    .filter((request) => !userEmailSearch || `${request.userEmail ?? ""}`.toLowerCase().includes(userEmailSearch))
    .sort((left, right) => new Date(right.requestedAt || right.createdAt || 0).getTime() - new Date(left.requestedAt || left.createdAt || 0).getTime());
}

export async function getGdprDataRequests(filters = {}) {
  if (!isSupabaseConfigured || !supabase) {
    return filterRequests(readLocalRequests().map(normalizeRequest), filters);
  }

  let query = supabase
    .from("gdpr_data_requests")
    .select("*")
    .order("requested_at", { ascending: false });

  if (filters.status) query = query.eq("status", filters.status);
  if (filters.requestType) query = query.eq("request_type", filters.requestType);
  if (filters.userEmailSearch) query = query.ilike("user_email", `%${filters.userEmailSearch}%`);

  const { data, error } = await query;
  if (error) {
    console.error("Loading GDPR data requests failed:", error);
    throw error;
  }

  return (data ?? []).map(normalizeRequest);
}

export async function createGdprDataRequest(payload = {}) {
  const insertPayload = {
    user_id: payload.userId || null,
    user_email: `${payload.userEmail ?? ""}`.trim().toLowerCase(),
    request_type: `${payload.requestType ?? "access_export"}`.trim().toLowerCase(),
    status: `${payload.status ?? "open"}`.trim().toLowerCase() || "open",
    notes: `${payload.notes ?? ""}`.trim() || null,
    requested_at: nowIso(),
    created_at: nowIso(),
    updated_at: nowIso(),
  };

  if (!isSupabaseConfigured || !supabase) {
    const created = normalizeRequest({
      id: createLocalId(),
      ...insertPayload,
    });
    writeLocalRequests([created, ...readLocalRequests()]);
    return created;
  }

  const { data, error } = await supabase
    .from("gdpr_data_requests")
    .insert([insertPayload])
    .select("*")
    .single();

  if (error) {
    console.error("Creating GDPR data request failed:", error);
    throw error;
  }

  return normalizeRequest(data);
}

export async function updateGdprDataRequest(requestId, updates = {}, completedBy = "") {
  if (!requestId) throw new Error("A valid GDPR request id is required.");

  const normalizedStatus = `${updates.status ?? ""}`.trim().toLowerCase();
  const nextPayload = {
    ...(normalizedStatus ? { status: normalizedStatus } : {}),
    ...("notes" in updates ? { notes: `${updates.notes ?? ""}`.trim() || null } : {}),
    updated_at: nowIso(),
  };

  if (normalizedStatus === "completed" || normalizedStatus === "rejected") {
    nextPayload.completed_at = nowIso();
    nextPayload.completed_by = completedBy || null;
  }

  if (normalizedStatus === "open" || normalizedStatus === "in_progress") {
    nextPayload.completed_at = null;
    nextPayload.completed_by = null;
  }

  if (!isSupabaseConfigured || !supabase) {
    const nextRequests = readLocalRequests().map((request) =>
      String(request.id) === String(requestId)
        ? normalizeRequest({ ...request, ...nextPayload })
        : normalizeRequest(request),
    );
    writeLocalRequests(nextRequests);
    return nextRequests.find((request) => String(request.id) === String(requestId)) ?? null;
  }

  const { data, error } = await supabase
    .from("gdpr_data_requests")
    .update(nextPayload)
    .eq("id", requestId)
    .select("*")
    .single();

  if (error) {
    console.error("Updating GDPR data request failed:", error);
    throw error;
  }

  return normalizeRequest(data);
}

async function getAssignmentSubmissionsMetadata(userId) {
  if (!userId) return [];

  if (!isSupabaseConfigured || !supabase) {
    return getMockAssignmentSubmissions()
      .filter((submission) => String(submission.student_id ?? submission.studentId ?? "") === String(userId))
      .map((submission) =>
        sanitizeValue({
          id: submission.id,
          assignment_id: submission.assignment_id ?? submission.assignmentId ?? "",
          student_id: submission.student_id ?? submission.studentId ?? "",
          status: submission.status ?? "",
          grade: submission.grade ?? null,
          admin_feedback: submission.admin_feedback ?? submission.adminFeedback ?? "",
          file_name: submission.file_name ?? submission.fileName ?? "",
          file_storage_path: submission.file_storage_path ?? submission.storage_path ?? "",
          file_public_url: submission.file_public_url ?? submission.file_url ?? "",
          file_type: submission.file_type ?? "",
          file_size: submission.file_size ?? null,
          submitted_at: submission.submitted_at ?? submission.created_at ?? "",
          reviewed_at: submission.reviewed_at ?? "",
          graded_at: submission.graded_at ?? "",
        }),
      );
  }

  const { data, error } = await supabase
    .from("assignment_submissions")
    .select("id,assignment_id,student_id,status,grade,admin_feedback,file_name,file_storage_path,file_public_url,file_type,file_size,submitted_at,reviewed_at,graded_at")
    .eq("student_id", userId)
    .order("submitted_at", { ascending: false });

  if (error) {
    console.error("Loading assignment submission metadata for GDPR export failed:", error);
    throw error;
  }

  return sanitizeValue(data ?? []);
}

async function getCommunityExportData(userId) {
  const posts = await getCommunityPosts();
  const communityPosts = posts
    .filter((post) => String(post.studentId ?? "") === String(userId))
    .map((post) =>
      sanitizeValue({
        id: post.id,
        title: post.title,
        body: post.body,
        category: post.category,
        tags: post.tags,
        created_at: post.createdAt ?? post.time ?? "",
        pdf_file_name: post.pdfFileName ?? "",
        pdf_storage_path: post.pdfStoragePath ?? "",
        pdf_public_url: post.pdfPublicUrl ?? "",
      }),
    );

  const communityComments = posts
    .flatMap((post) => Array.isArray(post.comments) ? post.comments : [])
    .filter((comment) => String(comment.studentId ?? "") === String(userId))
    .map((comment) =>
      sanitizeValue({
        id: comment.id,
        post_id: comment.postId ?? "",
        body: comment.body,
        created_at: comment.createdAt ?? comment.time ?? "",
      }),
    );

  return { communityPosts, communityComments };
}

export async function exportUserDataBundle(userEmail) {
  const normalizedEmail = `${userEmail ?? ""}`.trim().toLowerCase();
  if (!normalizedEmail) throw new Error("A user email is required for export.");

  const profile =
    (await getUsers()).find((user) => `${user?.email ?? ""}`.trim().toLowerCase() === normalizedEmail) ?? null;
  const userId = profile?.id ?? null;
  const enrollments = userId ? await getEnrollmentsByStudent(userId) : [];
  const progress = userId ? await getStudentProgress(userId) : {};
  const assignmentSubmissions = userId ? await getAssignmentSubmissionsMetadata(userId) : [];
  const certificates = userId ? await getStudentCertificates(userId) : [];
  const { communityPosts, communityComments } = userId
    ? await getCommunityExportData(userId)
    : { communityPosts: [], communityComments: [] };
  const auditLogsAsTarget = await getAdminAuditLogs({ targetEmail: normalizedEmail, limit: 250 }).catch((error) => {
    console.warn("Loading audit logs for the GDPR export failed:", error);
    return [];
  });

  const sanitizedProfile = sanitizeValue(profile ? {
    id: profile.id,
    name: profile.name,
    email: profile.email,
    username: profile.username,
    role: profile.roleKey ?? profile.role,
    status: profile.statusKey ?? profile.status,
    country: profile.country,
    country_code: profile.countryCode ?? profile.country_code,
    country_name: profile.countryName ?? profile.country_name,
    country_flag: profile.countryFlag ?? profile.country_flag,
    bio: profile.bio,
    created_at: profile.createdAt ?? profile.created_at,
    updated_at: profile.updatedAt ?? profile.updated_at,
  } : {});

  const privacyConsent = sanitizeValue(profile ? {
    privacy_policy_accepted: Boolean(profile.privacyPolicyAccepted ?? profile.privacy_policy_accepted),
    privacy_policy_accepted_at: profile.privacyPolicyAcceptedAt ?? profile.privacy_policy_accepted_at ?? "",
    privacy_policy_version: profile.privacyPolicyVersion ?? profile.privacy_policy_version ?? "",
    privacy_consent_reminder_dismissed: Boolean(
      profile.privacyConsentReminderDismissed ?? profile.privacy_consent_reminder_dismissed,
    ),
    privacy_consent_reminder_dismissed_at:
      profile.privacyConsentReminderDismissedAt ?? profile.privacy_consent_reminder_dismissed_at ?? "",
  } : {});

  return sanitizeValue({
    exported_at: nowIso(),
    user_email: normalizedEmail,
    profile: sanitizedProfile,
    privacy_consent: privacyConsent,
    enrollments,
    progress,
    assignment_submissions: assignmentSubmissions,
    certificates,
    community_posts: communityPosts,
    community_comments: communityComments,
    audit_logs_as_target: auditLogsAsTarget,
  });
}
