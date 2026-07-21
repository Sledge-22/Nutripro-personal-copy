import { isSupabaseConfigured, supabase } from "../lib/supabaseClient.js";
import { getMockCourses, setMockCourses } from "./mockStore.js";
import { deleteAssignmentsForModuleIds, getAssignmentsByModuleIds, syncAssignmentsForModules } from "./assignmentService.js";

const OPTIONAL_MODULE_COLUMNS = [
  "requires_assignment",
  "pdf_external_url",
  "video_external_url",
  "pdf_source",
  "video_source",
];
const MODULE_SELECT_COLUMNS = [
  "id",
  "course_id",
  "sort_order",
  "title",
  "description",
  "requires_assignment",
  "pdf_url",
  "video_url",
  "pdf_file_name",
  "video_file_name",
  "pdf_storage_path",
  "video_storage_path",
  "pdf_external_url",
  "video_external_url",
  "pdf_source",
  "video_source",
].join(",");

function fileNameFromUrl(url, fallback) {
  if (!url) return fallback;
  try {
    return decodeURIComponent(url.split("/").pop().split("?")[0]);
  } catch {
    return fallback;
  }
}

function mapModuleRow(module) {
  const pdfExternalUrl =
    module.pdf_external_url ??
    module.pdfExternalUrl ??
    module.external_pdf_url ??
    module.externalPdfUrl ??
    module.pdfLink ??
    module.pdf_link ??
    "";
  const videoExternalUrl =
    module.video_external_url ??
    module.videoExternalUrl ??
    module.external_video_url ??
    module.externalVideoUrl ??
    module.video_embed_url ??
    module.videoEmbedUrl ??
    module.videoLink ??
    module.video_link ??
    "";
  const pdfSource = module.pdf_source ?? module.pdfSource ?? (pdfExternalUrl ? "external" : "upload");
  const videoSource = module.video_source ?? module.videoSource ?? (videoExternalUrl ? "external" : "upload");
  const videoUrl =
    module.video_url ??
    module.videoUrl ??
    module.video_public_url ??
    module.videoPublicUrl ??
    module.video_file_url ??
    module.videoFileUrl ??
    module.video_link ??
    module.video?.url ??
    module.video?.link ??
    videoExternalUrl ??
    "";
  const pdfUrl =
    module.pdf_url ??
    module.pdfUrl ??
    module.pdf_public_url ??
    module.pdfPublicUrl ??
    module.pdf_file_url ??
    module.pdfFileUrl ??
    pdfExternalUrl ??
    "";
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
    pdfExternalUrl: pdfExternalUrl,
    pdf_external_url: pdfExternalUrl,
    pdfSource,
    pdf_source: pdfSource,
    videoUrl,
    video_url: videoUrl,
    videoName,
    video_file_name: videoName,
    video_storage_path: module.video_storage_path ?? "",
    videoExternalUrl: videoExternalUrl,
    video_external_url: videoExternalUrl,
    videoSource,
    video_source: videoSource,
    video: {
      id: module.video_id ?? module.id,
      title: module.video_title ?? module.video?.title ?? `${module.title ?? "Module"} video`,
      description: module.video_description ?? module.video?.description ?? "",
      duration: module.video_duration ?? module.video?.duration ?? "10 min",
      link:
        module.video_link ??
        module.videoLink ??
        module.video_external_url ??
        module.external_video_url ??
        module.video_embed_url ??
        module.video?.link ??
        "",
      url: videoUrl,
      uploadLabel: videoName,
    },
    assignment: module.assignment ?? null,
  };
}

function toModuleRow(courseId, module, index, allowOptionalColumns = true) {
  const pdfExternalUrl =
    module.pdf_external_url ??
    module.pdfExternalUrl ??
    module.external_pdf_url ??
    module.externalPdfUrl ??
    module.pdfLink ??
    module.pdf_link ??
    null;
  const videoExternalUrl =
    module.video_external_url ??
    module.videoExternalUrl ??
    module.external_video_url ??
    module.externalVideoUrl ??
    module.video_embed_url ??
    module.videoEmbedUrl ??
    module.videoLink ??
    module.video_link ??
    null;
  const pdfSource = module.pdf_source ?? module.pdfSource ?? (pdfExternalUrl ? "external" : "upload");
  const videoSource = module.video_source ?? module.videoSource ?? (videoExternalUrl ? "external" : "upload");
  const pdfUrl =
    module.pdf_url ??
    module.pdfUrl ??
    module.pdf_public_url ??
    module.pdfPublicUrl ??
    module.pdf_file_url ??
    module.pdfFileUrl ??
    pdfExternalUrl ??
    null;
  const videoUrl =
    module.video_url ??
    module.videoUrl ??
    module.video_public_url ??
    module.videoPublicUrl ??
    module.video_file_url ??
    module.videoFileUrl ??
    module.video?.url ??
    module.video?.link ??
    videoExternalUrl ??
    null;

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
    pdf_external_url: pdfExternalUrl,
    video_external_url: videoExternalUrl,
    pdf_source: pdfSource,
    video_source: videoSource,
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
    console.warn("Retrying module insert without optional module columns. Run the matching SQL later to enable them.");
    const fallbackRows = rows.map(
      ({
        requires_assignment,
        pdf_external_url,
        video_external_url,
        pdf_source,
        video_source,
        ...rest
      }) => rest,
    );
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
      .select(MODULE_SELECT_COLUMNS)
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

export async function replaceModulesForCourse(courseId, modules, options = {}) {
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

  const nextModules = [];
  for (let index = 0; index < modules.length; index += 1) {
    const sourceModule = modules[index];
    options.onProgress?.({
      current: index + 1,
      total: modules.length,
      module: sourceModule,
    });

    try {
      const row = toModuleRow(courseId, sourceModule, index + 1);
      console.log("Final module object sent to Supabase:", row);
      const data = await insertModuleRows([row]);
      const mappedModule = mapModuleRow((data ?? [])[0] ?? {});
      const [moduleWithAssignment] = await syncAssignmentsForModules([mappedModule], [sourceModule]);
      console.log("Created module response:", moduleWithAssignment ?? mappedModule);

      const sourcePdfUrl = sourceModule?.pdf_url || sourceModule?.pdfUrl;
      const sourceVideoUrl =
        sourceModule?.video_url ||
        sourceModule?.videoUrl ||
        sourceModule?.video?.url ||
        sourceModule?.video?.link;
      if (sourcePdfUrl && !(moduleWithAssignment?.pdf_url || mappedModule.pdf_url)) {
        console.error("Module save succeeded but pdf_url is missing:", moduleWithAssignment ?? mappedModule);
      }
      if (sourceVideoUrl && !(moduleWithAssignment?.video_url || mappedModule.video_url)) {
        console.error("Module save succeeded but video_url is missing:", moduleWithAssignment ?? mappedModule);
      }

      nextModules.push(moduleWithAssignment ?? mappedModule);
    } catch (error) {
      console.error("Failed to save module during sequential course sync:", error);
      const nextError = new Error(error?.message || `Saving module ${index + 1} failed.`);
      nextError.moduleIndex = index + 1;
      nextError.moduleTitle = sourceModule?.title || `Module ${index + 1}`;
      throw nextError;
    }
  }

  return nextModules;
}
