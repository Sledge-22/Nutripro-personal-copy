import { isSupabaseConfigured, supabase } from "../lib/supabaseClient.js";
import { getMockCourses, setMockCourses } from "./mockStore.js";
import { deleteAssignmentsForModuleIds, getAssignmentsByModuleIds, syncAssignmentsForModules } from "./assignmentService.js";

const OPTIONAL_MODULE_COLUMNS = ["requires_assignment"];

function fileNameFromUrl(url, fallback) {
  if (!url) return fallback;
  try {
    return decodeURIComponent(url.split("/").pop().split("?")[0]);
  } catch {
    return fallback;
  }
}

function mapModuleRow(module) {
  const videoUrl = module.video_url ?? module.videoUrl ?? module.video_link ?? module.video?.url ?? module.video?.link ?? "";
  const pdfUrl = module.pdf_url ?? module.pdfUrl ?? "";
  const pdfName = module.pdf_file_name ?? module.pdfName ?? module.pdf_label ?? fileNameFromUrl(pdfUrl, "No PDF selected");
  const videoName = module.video_file_name ?? module.videoName ?? module.video_upload_label ?? fileNameFromUrl(videoUrl, "No video selected");
  const requiresAssignment =
    module.requires_assignment ??
    module.requiresAssignment ??
    Boolean(module.assignment?.title);

  return {
    id: module.id,
    courseId: module.course_id ?? module.courseId,
    sortOrder: module.sort_order ?? module.sortOrder ?? 0,
    title: module.title ?? "",
    description: module.description ?? "",
    requiresAssignment,
    requires_assignment: requiresAssignment,
    pdfUrl,
    pdf_url: pdfUrl,
    pdfLabel: pdfName,
    pdfName,
    pdf_file_name: pdfName,
    pdf_storage_path: module.pdf_storage_path ?? "",
    videoUrl,
    video_url: videoUrl,
    videoName,
    video_file_name: videoName,
    video_storage_path: module.video_storage_path ?? "",
    video: {
      id: module.video_id ?? module.id,
      title: module.video_title ?? module.video?.title ?? `${module.title ?? "Module"} video`,
      description: module.video_description ?? module.video?.description ?? "",
      duration: module.video_duration ?? module.video?.duration ?? "10 min",
      link: module.video_link ?? module.video?.link ?? "",
      url: videoUrl,
      uploadLabel: videoName,
    },
    assignment: module.assignment ?? null,
  };
}

function toModuleRow(courseId, module, index, allowOptionalColumns = true) {
  const pdfUrl = module.pdf_url ?? module.pdfUrl ?? null;
  const videoUrl = module.video_url ?? module.videoUrl ?? module.video?.url ?? module.video?.link ?? null;

  const row = {
    course_id: courseId,
    title: module.title ?? "",
    description: module.description ?? "",
    sort_order: module.sortOrder ?? index,
    pdf_url: pdfUrl,
    video_url: videoUrl,
    pdf_file_name: module.pdf_file_name ?? module.pdfName ?? module.pdfLabel ?? null,
    video_file_name: module.video_file_name ?? module.videoName ?? module.video?.uploadLabel ?? null,
    pdf_storage_path: module.pdf_storage_path ?? module.pdfStoragePath ?? null,
    video_storage_path: module.video_storage_path ?? module.videoStoragePath ?? null,
  };

  if (allowOptionalColumns) {
    row.requires_assignment = module.requires_assignment ?? module.requiresAssignment ?? Boolean(module.assignment?.title);
  }

  return row;
}

function updateMockModules(courseId, modules) {
  const nextCourses = getMockCourses().map((course) => (course.id === courseId ? { ...course, modules } : course));
  setMockCourses(nextCourses);
  return modules;
}

async function insertModuleRows(rows, allowOptionalColumns = true) {
  const { data, error } = await supabase.from("modules").insert(rows).select("*");

  if (!error) return data ?? [];

  const shouldRetryWithoutOptionalColumns =
    allowOptionalColumns &&
    OPTIONAL_MODULE_COLUMNS.some(
      (column) =>
        error.message?.includes(`'${column}'`) ||
        error.message?.includes(`modules.${column}`) ||
        error.details?.includes(column) ||
        error.hint?.includes(column),
    );

  if (shouldRetryWithoutOptionalColumns) {
    console.warn("Retrying module insert without requires_assignment. Run the matching SQL later to enable it.");
    const fallbackRows = rows.map(({ requires_assignment, ...rest }) => rest);
    return insertModuleRows(fallbackRows, false);
  }

  throw error;
}

export async function getModulesByCourse(courseId) {
  if (!isSupabaseConfigured) {
    const course = getMockCourses().find((entry) => String(entry.id) === String(courseId));
    return course?.modules ?? [];
  }

  try {
    const selectedCourseId = Number.isNaN(Number(courseId)) ? courseId : Number(courseId);
    const { data, error } = await supabase
      .from("modules")
      .select("*")
      .eq("course_id", selectedCourseId)
      .order("sort_order", { ascending: true })
      .order("id", { ascending: true });

    if (error) {
      console.error("Failed module fetch from Supabase:", error);
      throw error;
    }

    if (!Array.isArray(data) || !data.length) {
      return [];
    }

    console.log("Fetched Supabase module rows:", data);
    const assignmentMap = await getAssignmentsByModuleIds(data.map((module) => module.id));
    return data.map((module) => ({
      ...mapModuleRow(module),
      assignment: assignmentMap.get(String(module.id)) ?? null,
    }));
  } catch (error) {
    console.error("Failed module fetch from Supabase:", error);
    throw error;
  }
}

export async function replaceModulesForCourse(courseId, modules) {
  if (!isSupabaseConfigured) {
    return updateMockModules(courseId, modules);
  }

  const { data: existingModules, error: existingModuleError } = await supabase
    .from("modules")
    .select("id")
    .eq("course_id", courseId);

  if (existingModuleError) {
    console.error("Failed to load existing modules before replacement:", existingModuleError);
    throw existingModuleError;
  }

  const existingModuleIds = (existingModules ?? []).map((module) => module.id).filter(Boolean);
  if (existingModuleIds.length) {
    await deleteAssignmentsForModuleIds(existingModuleIds);
  }

  const { error: deleteError } = await supabase.from("modules").delete().eq("course_id", courseId);
  if (deleteError) {
    console.error("Failed to clear existing modules in Supabase:", deleteError);
    throw deleteError;
  }

  if (!modules.length) return [];

  const rows = modules.map((module, index) => toModuleRow(courseId, module, index + 1));
  console.log("Final module object sent to Supabase:", rows);

  const data = await insertModuleRows(rows);
  const mapped = (data ?? []).map(mapModuleRow);
  const modulesWithAssignments = await syncAssignmentsForModules(mapped, modules);
  console.log("Created module response:", mapped);

  modulesWithAssignments.forEach((module, index) => {
    const source = modules[index];
    const sourcePdfUrl = source?.pdf_url || source?.pdfUrl;
    const sourceVideoUrl = source?.video_url || source?.videoUrl || source?.video?.url || source?.video?.link;
    if (sourcePdfUrl && !module.pdf_url) console.error("Module save succeeded but pdf_url is missing:", module);
    if (sourceVideoUrl && !module.video_url) console.error("Module save succeeded but video_url is missing:", module);
  });

  return modulesWithAssignments;
}
