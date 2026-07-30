import { isSupabaseConfigured, supabase } from "../lib/supabaseClient.js";

const TEAM_APPLICATIONS_STORAGE_KEY = "nutripro-team-applications";

function createMockId() {
  return `team-app-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function readMockApplications() {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(TEAM_APPLICATIONS_STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function writeMockApplications(applications) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TEAM_APPLICATIONS_STORAGE_KEY, JSON.stringify(applications));
}

function normalizeApplication(row = {}) {
  return {
    id: row.id,
    fullName: row.full_name ?? row.fullName ?? "",
    full_name: row.full_name ?? row.fullName ?? "",
    email: row.email ?? "",
    teachingTopic: row.teaching_topic ?? row.teachingTopic ?? "",
    teaching_topic: row.teaching_topic ?? row.teachingTopic ?? "",
    experience: row.experience ?? "",
    portfolioUrl: row.portfolio_url ?? row.portfolioUrl ?? "",
    portfolio_url: row.portfolio_url ?? row.portfolioUrl ?? "",
    message: row.message ?? "",
    status: row.status ?? "pending",
    adminNotes: row.admin_notes ?? row.adminNotes ?? "",
    admin_notes: row.admin_notes ?? row.adminNotes ?? "",
    reviewedBy: row.reviewed_by ?? row.reviewedBy ?? "",
    reviewed_by: row.reviewed_by ?? row.reviewedBy ?? "",
    reviewedAt: row.reviewed_at ?? row.reviewedAt ?? "",
    reviewed_at: row.reviewed_at ?? row.reviewedAt ?? "",
    createdAt: row.created_at ?? row.createdAt ?? "",
    created_at: row.created_at ?? row.createdAt ?? "",
    updatedAt: row.updated_at ?? row.updatedAt ?? "",
    updated_at: row.updated_at ?? row.updatedAt ?? "",
  };
}

export async function submitTeamApplication(applicationData) {
  const now = new Date().toISOString();
  const payload = {
    full_name: String(applicationData.fullName ?? applicationData.full_name ?? "").trim(),
    email: String(applicationData.email ?? "").trim().toLowerCase(),
    teaching_topic: String(applicationData.teachingTopic ?? applicationData.teaching_topic ?? "").trim(),
    experience: String(applicationData.experience ?? "").trim(),
    portfolio_url: String(applicationData.portfolioUrl ?? applicationData.portfolio_url ?? "").trim(),
    message: String(applicationData.message ?? "").trim(),
    status: "pending",
  };

  if (!isSupabaseConfigured || !supabase) {
    const created = normalizeApplication({
      ...payload,
      id: createMockId(),
      created_at: now,
    });
    writeMockApplications([created, ...readMockApplications()]);
    return created;
  }

  const { error } = await supabase
    .from("team_applications")
    .insert(payload);

  if (error) {
    console.error("Submitting team application failed:", error);
    throw error;
  }

  return normalizeApplication({
    ...payload,
    id: "submitted",
    created_at: now,
  });
}

export async function getTeamApplications() {
  if (!isSupabaseConfigured || !supabase) {
    return readMockApplications().map(normalizeApplication);
  }

  const { data, error } = await supabase
    .from("team_applications")
    .select("*")
    .order("created_at", { ascending: false, nullsFirst: false });

  if (error) {
    console.error("Loading team applications failed:", error);
    throw error;
  }

  return (data ?? []).map(normalizeApplication);
}

export async function updateTeamApplication(applicationId, updates = {}) {
  const now = new Date().toISOString();
  const payload = {
    updated_at: now,
  };

  if (updates.status) payload.status = updates.status;
  if (Object.prototype.hasOwnProperty.call(updates, "adminNotes")) {
    payload.admin_notes = String(updates.adminNotes ?? "");
  }
  if (Object.prototype.hasOwnProperty.call(updates, "admin_notes")) {
    payload.admin_notes = String(updates.admin_notes ?? "");
  }
  if (updates.reviewedBy || updates.reviewed_by) {
    payload.reviewed_by = updates.reviewedBy ?? updates.reviewed_by;
    payload.reviewed_at = now;
  }
  if (["in_review", "approved", "rejected"].includes(updates.status)) {
    payload.reviewed_at = now;
  }

  if (!isSupabaseConfigured || !supabase) {
    const nextApplications = readMockApplications().map((application) =>
      String(application.id) === String(applicationId)
        ? normalizeApplication({ ...application, ...payload })
        : application,
    );
    writeMockApplications(nextApplications);
    return nextApplications.find((application) => String(application.id) === String(applicationId)) ?? null;
  }

  const { data, error } = await supabase
    .from("team_applications")
    .update(payload)
    .eq("id", applicationId)
    .select("*")
    .maybeSingle();

  if (error) {
    console.error("Updating team application failed:", error);
    throw error;
  }

  return data ? normalizeApplication(data) : null;
}
