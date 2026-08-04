import { isSupabaseConfigured, supabase } from "../lib/supabaseClient.js";
import { ROUTES } from "../routes/appRoutes.js";
import { getVisibleAnnouncementsForProfile } from "./announcementService.js";

const LOCAL_NOTIFICATIONS_KEY = "nutripro-notifications";

function readLocalNotifications() {
  if (typeof window === "undefined") return {};

  try {
    return JSON.parse(window.localStorage.getItem(LOCAL_NOTIFICATIONS_KEY) || "{}");
  } catch {
    return {};
  }
}

function writeLocalNotifications(nextNotifications) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LOCAL_NOTIFICATIONS_KEY, JSON.stringify(nextNotifications));
}

function notificationRouteFor(type, roleKey) {
  const role = String(roleKey ?? "").toLowerCase();
  const messageRoute =
    role === "admin" ? ROUTES.admin.messages : role === "instructor" ? ROUTES.instructor.messages : ROUTES.student.messages;
  const dashboardRoute =
    role === "admin" ? ROUTES.admin.dashboard : role === "instructor" ? ROUTES.instructor.dashboard : ROUTES.student.dashboard;

  if (type === "new_private_message" || type === "new_message_request") {
    return messageRoute;
  }

  if (type === "assignment_submitted") return ROUTES.admin.assignmentReviews;
  if (type === "assignment_review_returned") return ROUTES.student.courses;
  if (type === "team_application_submitted") return ROUTES.admin.teamApplications;
  if (type === "team_application_reviewed") return ROUTES.student.messages;
  if (type === "new_course_assigned") return ROUTES.student.courses;
  if (type === "lesson_unlocked") return ROUTES.student.courses;
  if (type === "certificate_generated") return ROUTES.student.certificates;
  if (type === "announcement") return role === "admin" ? ROUTES.admin.announcements : dashboardRoute;

  return dashboardRoute;
}

function normalizeNotification(row = {}, roleKey = "") {
  const type = row.type ?? "new_private_message";
  return {
    id: String(row.id ?? `${type}-${Date.now()}`),
    type,
    title: row.title ?? "",
    titleKey: row.title_key ?? row.titleKey ?? `notifications.types.${type}.title`,
    description: row.description ?? row.body ?? "",
    descriptionKey: row.description_key ?? row.descriptionKey ?? `notifications.types.${type}.description`,
    createdAt: row.created_at ?? row.createdAt ?? new Date().toISOString(),
    readAt: row.read_at ?? row.readAt ?? (row.is_read ? new Date().toISOString() : ""),
    clearedAt: row.cleared_at ?? row.clearedAt ?? "",
    linkPath: row.link_path ?? row.linkPath ?? notificationRouteFor(type, roleKey),
    priority: row.priority ?? "normal",
    announcementId: row.announcement_id ?? row.announcementId ?? "",
    source: row.source ?? "database",
  };
}

function notificationFromAnnouncement(announcement = {}, profile = {}, localState = null) {
  const roleKey = profile.roleKey ?? profile.role ?? "";
  const id = `announcement-${announcement.id}`;
  return normalizeNotification(
    {
      id,
      type: "announcement",
      title: `${announcement.title ?? ""}`,
      description: `${announcement.body ?? ""}`,
      createdAt: announcement.publishedAt || announcement.published_at || announcement.createdAt || announcement.created_at,
      readAt: localState?.readAt || localState?.read_at || "",
      clearedAt: localState?.clearedAt || localState?.cleared_at || "",
      linkPath: notificationRouteFor("announcement", roleKey),
      priority: announcement.priority || "normal",
      announcementId: announcement.id,
      source: "announcement",
    },
    roleKey,
  );
}

function mergeNotifications(...groups) {
  const byId = new Map();
  groups.flat().filter(Boolean).forEach((notification) => {
    if (!byId.has(String(notification.id))) byId.set(String(notification.id), notification);
  });

  return [...byId.values()].sort((left, right) => {
    const leftTime = Date.parse(left.createdAt || "");
    const rightTime = Date.parse(right.createdAt || "");
    return (Number.isFinite(rightTime) ? rightTime : 0) - (Number.isFinite(leftTime) ? leftTime : 0);
  });
}

function createSeedNotifications(profile = {}) {
  const role = String(profile.roleKey ?? profile.role ?? "").toLowerCase();
  const now = Date.now();
  const adminSeed = [
    {
      id: "seed-admin-assignment-review",
      type: "assignment_submitted",
      createdAt: new Date(now - 1000 * 60 * 18).toISOString(),
    },
    {
      id: "seed-admin-team-application",
      type: "team_application_submitted",
      createdAt: new Date(now - 1000 * 60 * 60 * 2).toISOString(),
    },
    {
      id: "seed-admin-message",
      type: "new_private_message",
      createdAt: new Date(now - 1000 * 60 * 60 * 5).toISOString(),
      readAt: new Date(now - 1000 * 60 * 30).toISOString(),
    },
  ];

  const studentSeed = [
    {
      id: "seed-student-course-assigned",
      type: "new_course_assigned",
      createdAt: new Date(now - 1000 * 60 * 12).toISOString(),
    },
    {
      id: "seed-student-feedback",
      type: "assignment_review_returned",
      createdAt: new Date(now - 1000 * 60 * 55).toISOString(),
    },
    {
      id: "seed-student-certificate",
      type: "certificate_generated",
      createdAt: new Date(now - 1000 * 60 * 60 * 24).toISOString(),
      readAt: new Date(now - 1000 * 60 * 60 * 20).toISOString(),
    },
  ];

  if (role === "instructor") {
    return [
      {
        id: "seed-instructor-message",
        type: "new_private_message",
        createdAt: new Date(now - 1000 * 60 * 25).toISOString(),
      },
    ].map((notification) => normalizeNotification({ ...notification, source: "local" }, role));
  }

  return (role === "admin" ? adminSeed : studentSeed).map((notification) =>
    normalizeNotification({ ...notification, source: "local" }, role),
  );
}

function getLocalNotifications(profile = {}) {
  const profileId = profile.id ?? String(profile.roleKey ?? profile.role ?? "guest").toLowerCase() ?? "guest";
  const allNotifications = readLocalNotifications();
  const savedNotifications = allNotifications[profileId];

  if (Array.isArray(savedNotifications)) {
    return savedNotifications.map((notification) => normalizeNotification(notification, profile.roleKey ?? profile.role));
  }

  const seedNotifications = createSeedNotifications(profile);
  allNotifications[profileId] = seedNotifications;
  writeLocalNotifications(allNotifications);
  return seedNotifications;
}

function saveLocalNotifications(profile = {}, nextNotifications = []) {
  const profileId = profile.id ?? String(profile.roleKey ?? profile.role ?? "guest").toLowerCase() ?? "guest";
  const allNotifications = readLocalNotifications();
  allNotifications[profileId] = nextNotifications;
  writeLocalNotifications(allNotifications);
}

export async function getNotifications(profile = {}) {
  const roleKey = profile.roleKey ?? profile.role ?? "";
  const localNotifications = getLocalNotifications(profile);
  let announcementNotifications = [];

  try {
    const localStateById = new Map(localNotifications.map((notification) => [String(notification.id), notification]));
    const visibleAnnouncements = await getVisibleAnnouncementsForProfile(profile);
    announcementNotifications = visibleAnnouncements
      .map((announcement) =>
        notificationFromAnnouncement(announcement, profile, localStateById.get(`announcement-${announcement.id}`)),
      )
      .filter((notification) => !notification.clearedAt);
  } catch (error) {
    console.info("Loading announcement notifications failed:", error);
  }

  if (!isSupabaseConfigured || !supabase || !profile.id) {
    return mergeNotifications(announcementNotifications, localNotifications.filter((notification) => !notification.clearedAt));
  }

  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .or(`user_id.eq.${profile.id},recipient_id.eq.${profile.id}`)
    .order("created_at", { ascending: false })
    .limit(25);

  if (error) {
    console.info("Loading notifications from Supabase failed; using local fallback:", error);
    return mergeNotifications(announcementNotifications, localNotifications.filter((notification) => !notification.clearedAt));
  }

  const databaseNotifications = Array.isArray(data)
    ? data.map((notification) => normalizeNotification(notification, roleKey))
    : [];

  return mergeNotifications(
    announcementNotifications,
    databaseNotifications.length ? databaseNotifications : [],
    localNotifications.filter((notification) => !notification.clearedAt),
  );
}

export async function markNotificationRead(profile = {}, notificationId, currentNotifications = []) {
  const sourceNotifications = currentNotifications.length ? currentNotifications : getLocalNotifications(profile);
  const notifications = sourceNotifications.map((notification) =>
    String(notification.id) === String(notificationId)
      ? { ...notification, readAt: notification.readAt || new Date().toISOString() }
      : notification,
  );
  saveLocalNotifications(profile, notifications);

  if (
    isSupabaseConfigured &&
    supabase &&
    notificationId &&
    !String(notificationId).startsWith("seed-") &&
    !String(notificationId).startsWith("announcement-")
  ) {
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", notificationId);

    if (error) console.info("Marking notification as read in Supabase failed:", error);
  }

  return notifications;
}

export async function markAllNotificationsRead(profile = {}, currentNotifications = []) {
  const readAt = new Date().toISOString();
  const notifications = currentNotifications.map((notification) => ({
    ...notification,
    readAt: notification.readAt || readAt,
  }));
  saveLocalNotifications(profile, notifications);

  const databaseIds = notifications
    .filter((notification) => !String(notification.id).startsWith("seed-") && !String(notification.id).startsWith("announcement-"))
    .map((notification) => notification.id);

  if (isSupabaseConfigured && supabase && databaseIds.length) {
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: readAt })
      .in("id", databaseIds);

    if (error) console.info("Marking all notifications as read in Supabase failed:", error);
  }

  return notifications;
}

export async function clearReadNotifications(profile = {}, currentNotifications = []) {
  const clearAt = new Date().toISOString();
  const remainingNotifications = currentNotifications.filter((notification) => !notification.readAt);
  const clearedAnnouncementMarkers = currentNotifications
    .filter((notification) => notification.readAt && notification.source === "announcement")
    .map((notification) => ({ ...notification, clearedAt: clearAt }));
  saveLocalNotifications(profile, [...remainingNotifications, ...clearedAnnouncementMarkers]);

  const readDatabaseIds = currentNotifications
    .filter(
      (notification) =>
        notification.readAt &&
        !String(notification.id).startsWith("seed-") &&
        !String(notification.id).startsWith("announcement-"),
    )
    .map((notification) => notification.id);

  if (isSupabaseConfigured && supabase && readDatabaseIds.length) {
    const { error } = await supabase
      .from("notifications")
      .delete()
      .in("id", readDatabaseIds);

    if (error) console.info("Clearing read notifications in Supabase failed:", error);
  }

  return remainingNotifications;
}
