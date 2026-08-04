import { isSupabaseConfigured, supabase } from "../lib/supabaseClient.js";

const STORAGE_KEY = "nutripro-student-lesson-notes";

function normalizeId(value) {
  return `${value ?? ""}`.trim();
}

function noteKey(studentId, moduleId) {
  return `${normalizeId(studentId)}:${normalizeId(moduleId)}`;
}

function normalizeNote(row = {}, studentId = "", moduleId = "") {
  const source = row || {};
  return {
    id: source.id ?? noteKey(studentId, moduleId),
    studentId: source.student_id ?? source.studentId ?? studentId,
    student_id: source.student_id ?? source.studentId ?? studentId,
    moduleId: source.module_id ?? source.moduleId ?? moduleId,
    module_id: source.module_id ?? source.moduleId ?? moduleId,
    note: source.note ?? "",
    createdAt: source.created_at ?? source.createdAt ?? "",
    created_at: source.created_at ?? source.createdAt ?? "",
    updatedAt: source.updated_at ?? source.updatedAt ?? "",
    updated_at: source.updated_at ?? source.updatedAt ?? "",
  };
}

function readLocalNotes() {
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function writeLocalNotes(notes) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
}

export async function getStudentLessonNote(studentId, moduleId) {
  const normalizedStudentId = normalizeId(studentId);
  const normalizedModuleId = normalizeId(moduleId);
  if (!normalizedStudentId || !normalizedModuleId) return null;

  if (!isSupabaseConfigured || !supabase) {
    return normalizeNote(readLocalNotes()[noteKey(normalizedStudentId, normalizedModuleId)] ?? null, normalizedStudentId, normalizedModuleId);
  }

  const { data, error } = await supabase
    .from("student_lesson_notes")
    .select("id,student_id,module_id,note,created_at,updated_at")
    .eq("student_id", normalizedStudentId)
    .eq("module_id", normalizedModuleId)
    .maybeSingle();

  if (error) {
    console.error("Loading student lesson note failed:", error);
    throw error;
  }

  return data ? normalizeNote(data, normalizedStudentId, normalizedModuleId) : null;
}

export async function saveStudentLessonNote(studentId, moduleId, note) {
  const normalizedStudentId = normalizeId(studentId);
  const normalizedModuleId = normalizeId(moduleId);
  const cleanNote = `${note ?? ""}`;
  if (!normalizedStudentId || !normalizedModuleId) {
    throw new Error("A valid student and lesson are required to save notes.");
  }

  const now = new Date().toISOString();

  if (!isSupabaseConfigured || !supabase) {
    const notes = readLocalNotes();
    const key = noteKey(normalizedStudentId, normalizedModuleId);
    const existing = notes[key] ?? {};
    const nextNote = normalizeNote(
      {
        ...existing,
        id: existing.id ?? key,
        student_id: normalizedStudentId,
        module_id: normalizedModuleId,
        note: cleanNote,
        created_at: existing.created_at ?? now,
        updated_at: now,
      },
      normalizedStudentId,
      normalizedModuleId,
    );
    notes[key] = nextNote;
    writeLocalNotes(notes);
    return nextNote;
  }

  const { data, error } = await supabase
    .from("student_lesson_notes")
    .upsert(
      {
        student_id: normalizedStudentId,
        module_id: normalizedModuleId,
        note: cleanNote,
        updated_at: now,
      },
      { onConflict: "student_id,module_id" },
    )
    .select("id,student_id,module_id,note,created_at,updated_at")
    .single();

  if (error) {
    console.error("Saving student lesson note failed:", error);
    throw error;
  }

  return normalizeNote(data, normalizedStudentId, normalizedModuleId);
}
