import { isSupabaseConfigured, supabase } from "../lib/supabaseClient.js";

const ANNOUNCEMENTS_STORAGE_KEY = "nutripro-announcements";

function nowIso() {
  return new Date().toISOString();
}

function createMockId() {
  return `announcement-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function readMockAnnouncements() {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(ANNOUNCEMENTS_STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function writeMockAnnouncements(announcements) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ANNOUNCEMENTS_STORAGE_KEY, JSON.stringify(announcements));
}

function normalizeAudienceType(value) {
  const normalized = `${value ?? "all_students"}`.trim().toLowerCase();
  if (["all_users", "all_students", "admins", "course", "class"].includes(normalized)) return normalized;
  return "all_students";
}

function normalizePriority(value) {
  const normalized = `${value ?? "normal"}`.trim().toLowerCase();
  if (["normal", "important", "urgent"].includes(normalized)) return normalized;
  return "normal";
}

function normalizeStatus(value) {
  const normalized = `${value ?? "published"}`.trim().toLowerCase();
  if (["draft", "published", "archived"].includes(normalized)) return normalized;
  return "published";
}

export function normalizeAnnouncement(row = {}) {
  return {
    id: row.id ?? "",
    title: row.title ?? "",
    body: row.body ?? row.message ?? "",
    audienceType: normalizeAudienceType(row.audience_type ?? row.audienceType),
    audience_type: normalizeAudienceType(row.audience_type ?? row.audienceType),
    courseId: row.course_id ?? row.courseId ?? "",
    course_id: row.course_id ?? row.courseId ?? "",
    classId: row.class_id ?? row.classId ?? "",
    class_id: row.class_id ?? row.classId ?? "",
    priority: normalizePriority(row.priority),
    status: normalizeStatus(row.status),
    createdBy: row.created_by ?? row.createdBy ?? "",
    created_by: row.created_by ?? row.createdBy ?? "",
    publishedAt: row.published_at ?? row.publishedAt ?? row.created_at ?? row.createdAt ?? "",
    published_at: row.published_at ?? row.publishedAt ?? row.created_at ?? row.createdAt ?? "",
    expiresAt: row.expires_at ?? row.expiresAt ?? "",
    expires_at: row.expires_at ?? row.expiresAt ?? "",
    createdAt: row.created_at ?? row.createdAt ?? "",
    created_at: row.created_at ?? row.createdAt ?? "",
    updatedAt: row.updated_at ?? row.updatedAt ?? "",
    updated_at: row.updated_at ?? row.updatedAt ?? "",
  };
}

function buildAnnouncementPayload(announcement = {}, currentUser = null) {
  const audienceType = normalizeAudienceType(announcement.audienceType ?? announcement.audience_type);
  return {
    title: `${announcement.title ?? ""}`.trim(),
    body: `${announcement.body ?? announcement.message ?? ""}`.trim(),
    audience_type: audienceType,
    course_id: audienceType === "course" || audienceType === "class" ? announcement.courseId || announcement.course_id || null : null,
    class_id: audienceType === "class" ? announcement.classId || announcement.class_id || null : null,
    priority: normalizePriority(announcement.priority),
    status: normalizeStatus(announcement.status),
    expires_at: announcement.expiresAt || announcement.expires_at || null,
    created_by: currentUser?.id ?? null,
    published_at: normalizeStatus(announcement.status) === "published" ? nowIso() : null,
    updated_at: nowIso(),
  };
}

function validateAnnouncementPayload(payload) {
  if (!payload.title) throw new Error("Announcement title is required.");
  if (!payload.body) throw new Error("Announcement message is required.");
  if (payload.audience_type === "course" && !payload.course_id) throw new Error("Select a course for this announcement.");
  if (payload.audience_type === "class" && !payload.class_id) throw new Error("Select a class for this announcement.");
}

export async function getAnnouncements() {
  if (!isSupabaseConfigured || !supabase) {
    return readMockAnnouncements().map(normalizeAnnouncement);
  }

  const { data, error } = await supabase
    .from("announcements")
    .select("*")
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false, nullsFirst: false });

  if (error) {
    console.error("Loading announcements failed:", error);
    throw error;
  }

  return (data ?? []).map(normalizeAnnouncement);
}

export async function createAnnouncement(announcement = {}, currentUser = null) {
  const payload = buildAnnouncementPayload(announcement, currentUser);
  validateAnnouncementPayload(payload);

  if (!isSupabaseConfigured || !supabase) {
    const created = normalizeAnnouncement({
      ...payload,
      id: createMockId(),
      created_at: nowIso(),
      published_at: payload.published_at || nowIso(),
    });
    writeMockAnnouncements([created, ...readMockAnnouncements()]);
    return created;
  }

  const { data, error } = await supabase
    .from("announcements")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    console.error("Creating announcement failed:", error);
    throw error;
  }

  return normalizeAnnouncement(data);
}

export async function updateAnnouncement(announcementId, updates = {}, currentUser = null) {
  if (!announcementId) throw new Error("Announcement id is required.");
  const payload = buildAnnouncementPayload(updates, currentUser);
  validateAnnouncementPayload(payload);

  if (!isSupabaseConfigured || !supabase) {
    const nextAnnouncements = readMockAnnouncements().map((announcement) =>
      String(announcement.id) === String(announcementId)
        ? normalizeAnnouncement({ ...announcement, ...payload })
        : announcement,
    );
    writeMockAnnouncements(nextAnnouncements);
    return nextAnnouncements.find((announcement) => String(announcement.id) === String(announcementId)) ?? null;
  }

  const { data, error } = await supabase
    .from("announcements")
    .update(payload)
    .eq("id", announcementId)
    .select("*")
    .single();

  if (error) {
    console.error("Updating announcement failed:", error);
    throw error;
  }

  return normalizeAnnouncement(data);
}

export async function archiveAnnouncement(announcementId) {
  if (!announcementId) throw new Error("Announcement id is required.");

  if (!isSupabaseConfigured || !supabase) {
    const nextAnnouncements = readMockAnnouncements().map((announcement) =>
      String(announcement.id) === String(announcementId)
        ? normalizeAnnouncement({ ...announcement, status: "archived", updated_at: nowIso() })
        : announcement,
    );
    writeMockAnnouncements(nextAnnouncements);
    return nextAnnouncements.find((announcement) => String(announcement.id) === String(announcementId)) ?? null;
  }

  const { data, error } = await supabase
    .from("announcements")
    .update({ status: "archived", updated_at: nowIso() })
    .eq("id", announcementId)
    .select("*")
    .single();

  if (error) {
    console.error("Archiving announcement failed:", error);
    throw error;
  }

  return normalizeAnnouncement(data);
}

function isPublishedAndCurrent(announcement) {
  if (announcement.status !== "published") return false;
  if (!announcement.expiresAt && !announcement.expires_at) return true;
  const expiresAt = Date.parse(announcement.expiresAt || announcement.expires_at);
  return !Number.isFinite(expiresAt) || expiresAt > Date.now();
}

function getCourseIdsFromProfile(profile = {}) {
  const ids = new Set();
  if (Array.isArray(profile.enrollments)) {
    profile.enrollments.forEach((enrollment) => {
      if (enrollment?.course_id || enrollment?.courseId) ids.add(String(enrollment.course_id ?? enrollment.courseId));
    });
  }
  if (Array.isArray(profile.courseIds)) {
    profile.courseIds.forEach((courseId) => ids.add(String(courseId)));
  }
  return ids;
}

async function getEnrolledCourseIds(profile = {}) {
  const ids = getCourseIdsFromProfile(profile);
  if (!isSupabaseConfigured || !supabase || !profile.id) return ids;

  const { data, error } = await supabase
    .from("enrollments")
    .select("course_id,status")
    .eq("student_id", profile.id);

  if (error) {
    console.info("Loading enrollments for announcements failed; using profile fallback:", error);
    return ids;
  }

  (data ?? []).forEach((enrollment) => {
    const status = `${enrollment.status ?? "active"}`.toLowerCase();
    if (status === "active" || !status) ids.add(String(enrollment.course_id));
  });
  return ids;
}

async function getClassCourseMap(classIds = []) {
  const uniqueClassIds = [...new Set(classIds.filter(Boolean).map(String))];
  if (!isSupabaseConfigured || !supabase || !uniqueClassIds.length) return new Map();

  const { data, error } = await supabase
    .from("course_classes")
    .select("id,course_id")
    .in("id", uniqueClassIds);

  if (error) {
    console.info("Loading class course map for announcements failed:", error);
    return new Map();
  }

  return new Map((data ?? []).map((row) => [String(row.id), String(row.course_id)]));
}

export async function getVisibleAnnouncementsForProfile(profile = {}) {
  let announcements = [];
  try {
    announcements = await getAnnouncements();
  } catch (error) {
    console.info("Announcements are unavailable; continuing without announcement notifications:", error);
    return [];
  }

  const role = `${profile.roleKey ?? profile.role ?? ""}`.trim().toLowerCase();
  const activeAnnouncements = announcements.filter(isPublishedAndCurrent);
  if (role === "admin") return activeAnnouncements;

  const enrolledCourseIds = await getEnrolledCourseIds(profile);
  const classIds = activeAnnouncements
    .filter((announcement) => announcement.audienceType === "class")
    .map((announcement) => announcement.classId || announcement.class_id);
  const classCourseMap = await getClassCourseMap(classIds);

  return activeAnnouncements.filter((announcement) => {
    if (announcement.audienceType === "all_users") return true;
    if (announcement.audienceType === "all_students") return role === "student";
    if (announcement.audienceType === "admins") return false;
    if (announcement.audienceType === "course") {
      return role === "student" && enrolledCourseIds.has(String(announcement.courseId || announcement.course_id));
    }
    if (announcement.audienceType === "class") {
      const courseId = announcement.courseId || announcement.course_id || classCourseMap.get(String(announcement.classId || announcement.class_id));
      return role === "student" && courseId && enrolledCourseIds.has(String(courseId));
    }
    return false;
  });
}
