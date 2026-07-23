import { isSupabaseConfigured, supabase } from "../lib/supabaseClient.js";
import { getMockProgress, setMockProgress } from "./mockStore.js";

function mapRowsToProgress(rows) {
  return (rows ?? []).reduce((progress, row) => {
    const moduleId = row.module_id ?? row.moduleId;
    if (!moduleId) return progress;
    progress[`pdf-${moduleId}`] = Boolean(row.pdf_completed ?? row.pdf_viewed ?? row.pdfOpened ?? false);
    progress[`video-${moduleId}`] = Boolean(row.video_completed ?? row.video_viewed ?? row.videoOpened ?? false);
    progress[`module-${moduleId}`] = Boolean(row.module_completed ?? row.completed ?? false);
    return progress;
  }, {});
}

function groupProgressUpdates(updates) {
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
    if (type === "module") rows[moduleIdValue].module_completed = Boolean(value);
    return rows;
  }, {});
}

export async function getStudentProgress(studentId = 1) {
  if (!isSupabaseConfigured) return getMockProgress();

  try {
    const { data, error } = await supabase.from("student_progress").select("*").eq("student_id", studentId);
    if (error) throw error;
    return mapRowsToProgress(data);
  } catch {
    return getMockProgress();
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
    if (error) throw error;
    return merged;
  } catch {
    const nextProgress = { ...getMockProgress(), ...updates };
    setMockProgress(nextProgress);
    return nextProgress;
  }
}
