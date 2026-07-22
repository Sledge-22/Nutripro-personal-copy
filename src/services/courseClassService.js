import { isSupabaseConfigured, supabase } from "../lib/supabaseClient.js";

const COURSE_CLASS_SELECT_COLUMNS = [
  "id",
  "course_id",
  "title",
  "description",
  "sort_order",
  "status",
  "created_at",
  "updated_at",
].join(",");

function normalizeClassStatus(status) {
  if (status === "draft" || status === "published" || status === "archived") return status;
  return "draft";
}

function mapClassRow(row = {}) {
  return {
    id: row.id,
    courseId: row.course_id ?? row.courseId ?? "",
    course_id: row.course_id ?? row.courseId ?? "",
    title: row.title ?? "",
    description: row.description ?? "",
    sortOrder: row.sort_order ?? row.sortOrder ?? 0,
    sort_order: row.sort_order ?? row.sortOrder ?? 0,
    status: normalizeClassStatus(row.status),
    createdAt: row.created_at ?? row.createdAt ?? "",
    updatedAt: row.updated_at ?? row.updatedAt ?? "",
  };
}

function toClassRow(courseId, courseClass, index) {
  return {
    course_id: courseId,
    title: `${courseClass?.title ?? ""}`.trim() || "General",
    description: `${courseClass?.description ?? ""}`.trim(),
    sort_order: courseClass?.sortOrder ?? courseClass?.sort_order ?? index + 1,
    status: normalizeClassStatus(courseClass?.status),
  };
}

export async function getClassesByCourse(courseId) {
  if (!isSupabaseConfigured || !courseId) return [];

  const { data, error } = await supabase
    .from("course_classes")
    .select(COURSE_CLASS_SELECT_COLUMNS)
    .eq("course_id", courseId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Failed to load course classes from Supabase:", error);
    throw error;
  }

  return (data ?? []).map(mapClassRow);
}

export async function syncClassesForCourse(courseId, classes = []) {
  if (!isSupabaseConfigured || !courseId) {
    return {
      savedClasses: (classes ?? []).map((entry, index) => ({
        ...mapClassRow({
          ...entry,
          id: entry?.id ?? `class-${courseId}-${index + 1}`,
          course_id: courseId,
          sort_order: entry?.sortOrder ?? entry?.sort_order ?? index + 1,
        }),
        clientId: entry?.id ?? `class-${index + 1}`,
      })),
      removedClassIds: [],
    };
  }

  const { data: existingRows, error: existingError } = await supabase
    .from("course_classes")
    .select("id")
    .eq("course_id", courseId);

  if (existingError) {
    console.error("Failed to load existing course classes before sync:", existingError);
    throw existingError;
  }

  const existingIds = new Set((existingRows ?? []).map((row) => String(row.id)));
  const keptIds = new Set();
  const savedClasses = [];

  for (let index = 0; index < classes.length; index += 1) {
    const sourceClass = classes[index];
    const row = toClassRow(courseId, sourceClass, index);
    const existingId = sourceClass?.id && existingIds.has(String(sourceClass.id)) ? sourceClass.id : null;

    const { data, error } = existingId
      ? await supabase.from("course_classes").update(row).eq("id", existingId).select("*").single()
      : await supabase.from("course_classes").insert(row).select("*").single();

    if (error) {
      console.error("Saving course class failed:", error);
      throw error;
    }

    keptIds.add(String(data.id));
    savedClasses.push({
      ...mapClassRow(data),
      clientId: sourceClass?.id ?? null,
    });
  }

  const removedClassIds = (existingRows ?? [])
    .map((row) => row.id)
    .filter((id) => !keptIds.has(String(id)));

  return { savedClasses, removedClassIds };
}

export async function deleteCourseClassesByIds(classIds = []) {
  if (!isSupabaseConfigured || !Array.isArray(classIds) || !classIds.length) return;

  const { error } = await supabase.from("course_classes").delete().in("id", classIds);
  if (error) {
    console.error("Deleting removed course classes failed:", error);
    throw error;
  }
}

