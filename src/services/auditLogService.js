import { isSupabaseConfigured, supabase } from "../lib/supabaseClient.js";

const AUDIT_LOG_STORAGE_KEY = "nutripro-admin-audit-logs";

function isValidUuid(value) {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function normalizeOptionalString(value) {
  const normalized = `${value ?? ""}`.trim();
  return normalized || "";
}

function sanitizeAuditDetails(details) {
  if (!details || typeof details !== "object" || Array.isArray(details)) return {};

  return Object.entries(details).reduce((safeDetails, [key, value]) => {
    const normalizedKey = `${key ?? ""}`.trim().toLowerCase();
    if (
      normalizedKey.includes("password") ||
      normalizedKey.includes("token") ||
      normalizedKey.includes("secret") ||
      normalizedKey.includes("service_key") ||
      normalizedKey.includes("apikey") ||
      normalizedKey.includes("api_key")
    ) {
      return safeDetails;
    }

    safeDetails[key] =
      value && typeof value === "object" && !Array.isArray(value)
        ? sanitizeAuditDetails(value)
        : value;
    return safeDetails;
  }, {});
}

function readLocalAuditLogs() {
  if (typeof window === "undefined") return [];

  try {
    const rawValue = window.localStorage.getItem(AUDIT_LOG_STORAGE_KEY);
    const parsed = rawValue ? JSON.parse(rawValue) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn("Reading local admin audit logs failed:", error);
    return [];
  }
}

function mergeAuditLogs(primaryLogs = [], secondaryLogs = []) {
  const merged = [...primaryLogs, ...secondaryLogs];
  const seenKeys = new Set();

  return merged
    .filter((entry) => {
      const dedupeKey = `${entry?.id ?? ""}-${entry?.createdAt ?? entry?.created_at ?? ""}-${entry?.action ?? ""}`;
      if (seenKeys.has(dedupeKey)) return false;
      seenKeys.add(dedupeKey);
      return true;
    })
    .sort((left, right) => new Date(right?.createdAt ?? right?.created_at ?? 0).getTime() - new Date(left?.createdAt ?? left?.created_at ?? 0).getTime());
}

function writeLocalAuditLogs(logs) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(AUDIT_LOG_STORAGE_KEY, JSON.stringify(logs));
  } catch (error) {
    console.warn("Writing local admin audit logs failed:", error);
  }
}

function normalizeAuditLog(row = {}) {
  return {
    id: row.id ?? "",
    adminUserId: row.admin_user_id ?? row.adminUserId ?? "",
    adminEmail: row.admin_email ?? row.adminEmail ?? "",
    action: row.action ?? "",
    targetType: row.target_type ?? row.targetType ?? "",
    targetId: row.target_id ?? row.targetId ?? "",
    targetEmail: row.target_email ?? row.targetEmail ?? "",
    details: row.details && typeof row.details === "object" ? row.details : {},
    createdAt: row.created_at ?? row.createdAt ?? "",
  };
}

export async function recordAdminAuditLog({
  adminUser,
  action,
  targetType,
  targetId = "",
  targetEmail = "",
  details = {},
} = {}) {
  const normalizedAction = normalizeOptionalString(action);
  const normalizedTargetType = normalizeOptionalString(targetType);

  if (!normalizedAction || !normalizedTargetType) return null;

  const payload = {
    admin_user_id: isValidUuid(adminUser?.id) ? adminUser.id : null,
    admin_email: normalizeOptionalString(adminUser?.email).toLowerCase() || null,
    action: normalizedAction,
    target_type: normalizedTargetType,
    target_id: normalizeOptionalString(targetId) || null,
    target_email: normalizeOptionalString(targetEmail).toLowerCase() || null,
    details: sanitizeAuditDetails(details),
  };

  if (!isSupabaseConfigured || !supabase) {
    const nextLogs = [
      normalizeAuditLog({
        id: `local-${Date.now()}`,
        ...payload,
        created_at: new Date().toISOString(),
      }),
      ...readLocalAuditLogs(),
    ].slice(0, 100);
    writeLocalAuditLogs(nextLogs);
    return nextLogs[0];
  }

  try {
    const { data, error } = await supabase
      .from("admin_audit_logs")
      .insert([payload])
      .select("*")
      .single();

    if (error) throw error;
    return normalizeAuditLog(data);
  } catch (error) {
    console.warn("Recording admin audit log failed:", error);
    const fallbackLog = normalizeAuditLog({
      id: `local-${Date.now()}`,
      ...payload,
      created_at: new Date().toISOString(),
    });
    writeLocalAuditLogs([fallbackLog, ...readLocalAuditLogs()].slice(0, 100));
    return fallbackLog;
  }
}

export async function getAdminAuditLogs({ limit = 50, action = "", adminEmail = "", targetEmail = "" } = {}) {
  const normalizedLimit = Number.isFinite(Number(limit)) ? Math.max(1, Math.min(100, Number(limit))) : 50;

  if (!isSupabaseConfigured || !supabase) {
    return readLocalAuditLogs()
      .filter((entry) => !action || entry.action === action)
      .filter((entry) => !adminEmail || entry.adminEmail === adminEmail)
      .filter((entry) => !targetEmail || entry.targetEmail === targetEmail)
      .slice(0, normalizedLimit)
      .map(normalizeAuditLog);
  }

  let query = supabase
    .from("admin_audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(normalizedLimit);

  if (action) query = query.eq("action", action);
  if (adminEmail) query = query.eq("admin_email", adminEmail.toLowerCase());
  if (targetEmail) query = query.eq("target_email", targetEmail.toLowerCase());

  const { data, error } = await query;
  if (error) {
    console.warn("Loading admin audit logs failed:", error);
    throw error;
  }

  const supabaseLogs = Array.isArray(data) ? data.map(normalizeAuditLog) : [];
  const localLogs = readLocalAuditLogs()
    .filter((entry) => !action || entry.action === action)
    .filter((entry) => !adminEmail || entry.adminEmail === adminEmail)
    .filter((entry) => !targetEmail || entry.targetEmail === targetEmail);

  return mergeAuditLogs(supabaseLogs, localLogs).slice(0, normalizedLimit);
}
