import { isSupabaseConfigured, supabase } from "../lib/supabaseClient.js";
import { getMockProgress, setMockProgress } from "./mockStore.js";

function mapRowsToProgress(rows) {
  return (rows ?? []).reduce((progress, row) => {
    const moduleId = row.module_id ?? row.moduleId;
    if (!moduleId) return progress;
    progress[`pdf-${moduleId}`] = Boolean(row.pdf_completed ?? row.pdf_viewed ?? row.pdfOpened ?? false);
    progress[`video-${moduleId}`] = Boolean(row.video_completed ?? row.video_viewed ?? row.videoOpened ?? false);
    progress[`module-${moduleId}`] = Boolean(row.module_completed) ||
      Boolean(row.completed) ||
      `${row.status ?? ""}`.trim().toLowerCase() === "completed" ||
      Boolean(row.completed_at ?? row.completedAt) ||
      Number(row.progress_percent ?? row.progressPercent ?? 0) >= 100;
    return progress;
  }, {});
}

function groupProgressUpdates(updates, { includeCompletionMetadata = true } = {}) {
  const now = new Date().toISOString();
  return Object.entries(updates).reduce((rows, [key, value]) => {
    const separatorIndex = key.indexOf("-");
    const type = separatorIndex >= 0 ? key.slice(0, separatorIndex) : "";
    const moduleIdValue = separatorIndex >= 0 ? key.slice(separatorIndex + 1) : "";
    const numericModuleId = Number(moduleIdValue);
    const moduleId = Number.isNaN(numericModuleId) ? moduleIdValue : numericModuleId;
    if (!moduleIdValue || !["pdf", "video", "module"].includes(type)) return rows;

    if (!rows[moduleIdValue]) {
      rows[moduleIdValue] = {
        module_id: moduleId,
      };
    }

    if (type === "pdf") rows[moduleIdValue].pdf_completed = Boolean(value);
    if (type === "video") rows[moduleIdValue].video_completed = Boolean(value);
    if (type === "module") {
      rows[moduleIdValue].module_completed = Boolean(value);

      if (includeCompletionMetadata && value) {
        rows[moduleIdValue].completed = true;
        rows[moduleIdValue].status = "completed";
        rows[moduleIdValue].completed_at = now;
        rows[moduleIdValue].progress_percent = 100;
        rows[moduleIdValue].updated_at = now;
      }
    }
    return rows;
  }, {});
}

function isMissingOptionalProgressColumn(error) {
  const details = [error?.message, error?.details, error?.hint, error?.code]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return (
    details.includes("42703") &&
    (details.includes("completed_at") ||
      details.includes("progress_percent") ||
      details.includes("updated_at") ||
      details.includes("status") ||
      details.includes("completed"))
  );
}

export async function getStudentProgress(studentId = 1) {
  if (!isSupabaseConfigured) return getMockProgress();

  try {
    const { data, error } = await supabase.from("student_progress").select("*").eq("student_id", studentId);
    if (error) throw error;
    return mapRowsToProgress(data);
  } catch (error) {
    console.error("[StudentCourses] Failed to load progress from public.student_progress:", error);
    throw error;
  }
}

export async function updateStudentProgress(studentId = 1, updates = {}) {
  if (!isSupabaseConfigured) {
    const nextProgress = { ...getMockProgress(), ...updates };
    setMockProgress(nextProgress);
    return nextProgress;
  }

  try {
    const current = await getStudentProgress(studentId);
    const merged = { ...current, ...updates };
    const grouped = Object.values(groupProgressUpdates(merged)).map((row) => ({
      student_id: studentId,
      ...row,
    }));

    const { error } = await supabase.from("student_progress").upsert(grouped, {
      onConflict: "student_id,module_id",
    });
    if (error) {
      if (!isMissingOptionalProgressColumn(error)) throw error;

      console.warn("[StudentProgress] Retrying progress update without optional completion metadata:", error);
      const legacyGrouped = Object.values(groupProgressUpdates(merged, { includeCompletionMetadata: false })).map((row) => ({
        student_id: studentId,
        ...row,
      }));
      const { error: legacyError } = await supabase.from("student_progress").upsert(legacyGrouped, {
        onConflict: "student_id,module_id",
      });
      if (legacyError) throw legacyError;
    }
    return merged;
  } catch (error) {
    console.error("[StudentProgress] Failed to save progress to public.student_progress:", error);
    throw error;
  }
}
