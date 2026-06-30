import { isSupabaseConfigured, supabase } from "../lib/supabaseClient.js";
import { getMockProgress, setMockProgress } from "./mockStore.js";

export async function getStudentProgress(studentId = 1) {
  if (!isSupabaseConfigured) return getMockProgress();

  try {
    // TODO(database): Align selected columns with the final Supabase student progress table schema.
    const { data, error } = await supabase.from("student_progress").select("*").eq("student_id", studentId);
    if (error) throw error;

    return (data ?? []).reduce((accumulator, item) => {
      accumulator[item.progress_key] = item.completed;
      return accumulator;
    }, {});
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
    const rows = Object.entries(updates).map(([progress_key, completed]) => ({
      student_id: studentId,
      progress_key,
      completed,
    }));

    // TODO(database): Upsert student progress against the final Supabase student progress table schema.
    const { error } = await supabase.from("student_progress").upsert(rows, {
      onConflict: "student_id,progress_key",
    });
    if (error) throw error;
    return getStudentProgress(studentId);
  } catch {
    const nextProgress = { ...getMockProgress(), ...updates };
    setMockProgress(nextProgress);
    return nextProgress;
  }
}
