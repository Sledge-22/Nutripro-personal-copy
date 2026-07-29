import { isSupabaseConfigured, supabase } from "../lib/supabaseClient.js";
import { requireConfirmedDelete } from "../utils/dataSafety.js";
import { getMockCourses, getMockProgress, setMockCourses } from "./mockStore.js";
import { getAssignmentsByModuleIds, syncAssignmentsForModules } from "./assignmentService.js";

const OPTIONAL_MODULE_COLUMNS = [
  "created_at",
  "pdf_file_name",
  "video_file_name",
  "pdf_storage_path",
  "video_storage_path",
  "pdf_external_url",
  "video_external_url",
  "pdf_source",
  "video_source",
  "image_file_name",
  "image_storage_path",
];
const REQUIRED_COURSE_BUILDER_COLUMNS = [
  "lesson_content",
  "pdf_url",
  "video_url",
  "embed_url",
  "image_url",
  "requires_assignment",
  "assignment_instructions",
  "status",
  "sort_order",
  "updated_at",
];
const MODULE_SELECT_COLUMNS = [
  "id",
  "course_id",
  "class_id",
  "created_at",
  "sort_order",
  "title",
  "description",
  "requires_assignment",
  "pdf_url",
  "video_url",
  "embed_url",
  "pdf_file_name",
  "video_file_name",
  "pdf_storage_path",
  "video_storage_path",
  "pdf_external_url",
  "video_external_url",
  "pdf_source",
  "video_source",
  "lesson_content",
  "assignment_instructions",
  "status",
  "updated_at",
  "image_url",
  "image_file_name",
  "image_storage_path",
];

function getMissingModuleColumn(error) {
  const details = `${error?.message ?? ""} ${error?.details ?? ""} ${error?.hint ?? ""}`;
  const quotedMatch = details.match(/['"]([a-z][a-z0-9_]*)['"]\s+column/i);
  if (quotedMatch?.[1]) return quotedMatch[1].toLowerCase();
  const qualifiedMatch = details.match(/modules\.([a-z][a-z0-9_]*)/i);
  return qualifiedMatch?.[1]?.toLowerCase() ?? "";
}

function isMissingModuleColumnError(error) {
  const details = `${error?.message ?? ""} ${error?.details ?? ""} ${error?.hint ?? ""}`.toLowerCase();
  return (
    error?.code === "42703" ||
    details.includes("schema cache") ||
    (details.includes("modules") && details.includes("column") && details.includes("does not exist"))
  );
}

function createModuleSchemaError(error) {
  if (!isMissingModuleColumnError(error)) return error;

  const missingColumn = getMissingModuleColumn(error) || "required Course Builder columns";
  const setupError = new Error(
    `Course Builder database setup required: public.modules is missing ${missingColumn}. Run supabase/sql/modules_course_builder_columns.sql.`,
  );
  setupError.code = error?.code ?? "MODULE_SCHEMA_SETUP_REQUIRED";
  setupError.details = [error?.message, error?.details, error?.hint].filter(Boolean).join(" ");
  return setupError;
}

async function fetchModuleRows(courseId, columns = MODULE_SELECT_COLUMNS) {
  const { data, error } = await supabase
    .from("modules")
    .select(columns.join(","))
    .eq("course_id", courseId)
    .order("class_id", { ascending: true, nullsFirst: true })
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true });

  if (!error) return data ?? [];

  const missingColumn = getMissingModuleColumn(error);
  if (missingColumn && OPTIONAL_MODULE_COLUMNS.includes(missingColumn) && columns.includes(missingColumn)) {
    console.warn("[CourseBuilder] Optional module column is unavailable; loading without it.", {
      column: missingColumn,
    });
    return fetchModuleRows(courseId, columns.filter((column) => column !== missingColumn));
  }

  throw createModuleSchemaError(error);
}

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
    module.embed_url ??
    module.embedUrl ??
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
    classId: module.class_id ?? module.classId ?? "",
    class_id: module.class_id ?? module.classId ?? "",
    sortOrder: module.sort_order ?? module.sortOrder ?? 0,
    createdAt: module.created_at ?? module.createdAt ?? "",
    created_at: module.created_at ?? module.createdAt ?? "",
    title: module.title ?? "",
    description: module.description ?? "",
    lessonContent: module.lesson_content ?? module.lessonContent ?? "",
    lesson_content: module.lesson_content ?? module.lessonContent ?? "",
    embedUrl: module.embed_url ?? module.embedUrl ?? videoExternalUrl,
    embed_url: module.embed_url ?? module.embedUrl ?? videoExternalUrl,
    assignmentInstructions:
      module.assignment_instructions ?? module.assignmentInstructions ?? module.assignment?.instructions ?? "",
    assignment_instructions:
      module.assignment_instructions ?? module.assignmentInstructions ?? module.assignment?.instructions ?? "",
    status: module.status ?? "published",
    updatedAt: module.updated_at ?? module.updatedAt ?? "",
    updated_at: module.updated_at ?? module.updatedAt ?? "",
    requiresAssignment,
    requires_assignment: requiresAssignment,
    imageUrl: module.image_url ?? module.imageUrl ?? "",
    image_url: module.image_url ?? module.imageUrl ?? "",
    imageName: module.image_file_name ?? module.imageName ?? "",
    image_file_name: module.image_file_name ?? module.imageName ?? "",
    imageStoragePath: module.image_storage_path ?? module.imageStoragePath ?? "",
    image_storage_path: module.image_storage_path ?? module.imageStoragePath ?? "",
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
    module.embed_url ??
    module.embedUrl ??
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
    class_id: module.class_id ?? module.classId ?? null,
    title: module.title ?? "",
    description: module.description ?? "",
    lesson_content: module.lesson_content ?? module.lessonContent ?? "",
    embed_url: videoExternalUrl,
    assignment_instructions:
      module.assignment_instructions ??
      module.assignmentInstructions ??
      module.assignment?.instructions ??
      null,
    status: module.status ?? "published",
    updated_at: new Date().toISOString(),
    sort_order: module.sortOrder ?? index,
    image_url: module.image_url ?? module.imageUrl ?? null,
    image_file_name: module.image_file_name ?? module.imageName ?? null,
    image_storage_path: module.image_storage_path ?? module.imageStoragePath ?? null,
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

function compareModuleOrder(left, right) {
  const leftOrder = Number(left?.sort_order ?? left?.sortOrder ?? 0);
  const rightOrder = Number(right?.sort_order ?? right?.sortOrder ?? 0);
  if (leftOrder !== rightOrder) return leftOrder - rightOrder;

  const leftCreatedAt = Date.parse(left?.created_at ?? left?.createdAt ?? "");
  const rightCreatedAt = Date.parse(right?.created_at ?? right?.createdAt ?? "");
  if (Number.isFinite(leftCreatedAt) && Number.isFinite(rightCreatedAt) && leftCreatedAt !== rightCreatedAt) {
    return leftCreatedAt - rightCreatedAt;
  }

  return String(left?.id ?? "").localeCompare(String(right?.id ?? ""), undefined, { numeric: true });
}

async function saveModuleRow(courseId, moduleId, row, allowOptionalColumns = true) {
  const query = moduleId
    ? supabase
        .from("modules")
        .update(row)
        .eq("id", moduleId)
        .eq("course_id", courseId)
        .select("*")
        .single()
    : supabase.from("modules").insert([row]).select("*").single();
  const { data, error } = await query;

  if (!error) return data;

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
    console.warn("Retrying module save without optional module columns. Run the matching SQL later to enable them.");
    const fallbackRow = Object.fromEntries(
      Object.entries(row).filter(([column]) => !OPTIONAL_MODULE_COLUMNS.includes(column)),
    );
    return saveModuleRow(courseId, moduleId, fallbackRow, false);
  }

  throw createModuleSchemaError(error);
}

export async function getModulesByCourse(courseId) {
  if (!isSupabaseConfigured) {
    const course = getMockCourses().find((entry) => String(entry.id) === String(courseId));
    return course?.modules ?? [];
  }

  try {
    const selectedCourseId = Number.isNaN(Number(courseId)) ? courseId : Number(courseId);
    const data = await fetchModuleRows(selectedCourseId);

    if (!Array.isArray(data) || !data.length) {
      return [];
    }

    console.log("Fetched Supabase module rows:", data);
    const orderedData = [...data].sort(compareModuleOrder);
    const assignmentMap = await getAssignmentsByModuleIds(orderedData.map((module) => module.id));
    return orderedData.map((module) => ({
      ...mapModuleRow(module),
      assignment: assignmentMap.get(String(module.id)) ?? null,
    }));
  } catch (error) {
    console.error("Failed module fetch from Supabase:", error);
    throw error;
  }
}

export async function saveModulesForCourse(courseId, modules, options = {}) {
  if (!isSupabaseConfigured) {
    return updateMockModules(courseId, modules);
  }

  const { data: existingModules, error: existingModuleError } = await supabase
    .from("modules")
    .select("id")
    .eq("course_id", courseId);

  if (existingModuleError) {
    console.error("Failed to load existing modules before save:", existingModuleError);
    throw existingModuleError;
  }

  const existingModuleIds = new Set((existingModules ?? []).map((module) => String(module.id)));
  const submittedExistingIds = new Set(
    modules
      .map((module) => module?.id)
      .filter((id) => id && existingModuleIds.has(String(id)))
      .map(String),
  );
  const preservedIds = [...existingModuleIds].filter((id) => !submittedExistingIds.has(id));
  if (preservedIds.length) {
    console.warn("[DataSafety] Preserved modules omitted from the current save.", {
      courseId,
      moduleIds: preservedIds,
    });
  }

  if (!modules.length) return getModulesByCourse(courseId);

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
      const existingId =
        sourceModule?.id && existingModuleIds.has(String(sourceModule.id))
          ? sourceModule.id
          : null;
      console.log("Final module object sent to Supabase:", row);
      const data = await saveModuleRow(courseId, existingId, row);
      const mappedModule = mapModuleRow(data ?? {});
      const [moduleWithAssignment] = await syncAssignmentsForModules([mappedModule], [sourceModule]);
      console.log("Saved module response:", moduleWithAssignment ?? mappedModule);

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

  // Supabase remains the source of truth. This includes existing rows omitted
  // from a partial editor save, which are intentionally never deleted.
  return getModulesByCourse(courseId);
}

// Backward-compatible name. Despite the legacy name this is non-destructive.
export const replaceModulesForCourse = saveModulesForCourse;

export async function updateModuleSortOrders(moduleUpdates = []) {
  const normalizedUpdates = (Array.isArray(moduleUpdates) ? moduleUpdates : [])
    .map((module) => ({
      id: module?.id,
      classId: module?.class_id ?? module?.classId ?? "",
      sortOrder: Number(module?.sort_order ?? module?.sortOrder),
    }))
    .filter((module) => module.id && Number.isInteger(module.sortOrder) && module.sortOrder >= 0);

  if (!normalizedUpdates.length) return [];

  const classIds = new Set(normalizedUpdates.map((module) => String(module.classId)));
  if (classIds.size > 1) {
    throw new Error("Lessons can only be reordered within the same class.");
  }

  if (!isSupabaseConfigured) {
    const orderById = new Map(normalizedUpdates.map((module) => [String(module.id), module.sortOrder]));
    const nextCourses = getMockCourses().map((course) => ({
      ...course,
      modules: (course.modules ?? []).map((module) =>
        orderById.has(String(module.id))
          ? { ...module, sortOrder: orderById.get(String(module.id)), sort_order: orderById.get(String(module.id)) }
          : module,
      ),
    }));
    setMockCourses(nextCourses);
    return normalizedUpdates;
  }

  const savedRows = [];
  for (const module of normalizedUpdates) {
    const { data, error } = await supabase
      .from("modules")
      .update({ sort_order: module.sortOrder })
      .eq("id", module.id)
      .select("id, class_id, sort_order")
      .maybeSingle();

    if (error) {
      console.error("Saving lesson sort_order failed:", error);
      throw error;
    }
    if (data) savedRows.push(data);
  }

  return savedRows;
}

export async function getModuleDeletionSafety(moduleId) {
  if (!moduleId) {
    throw new Error("A lesson id is required.");
  }

  if (!isSupabaseConfigured) {
    const module = getMockCourses()
      .flatMap((course) => (Array.isArray(course?.modules) ? course.modules : []))
      .find((entry) => String(entry?.id) === String(moduleId));
    const mockProgress = getMockProgress();
    const hasProgress = Boolean(
      mockProgress?.[`module-${moduleId}`] ||
      mockProgress?.[`pdf-${moduleId}`] ||
      mockProgress?.[`video-${moduleId}`],
    );
    return {
      canDelete: !module?.assignment && !hasProgress,
      hasAssignment: Boolean(module?.assignment),
      hasProgress,
    };
  }

  const [assignmentResult, progressResult] = await Promise.all([
    supabase.from("module_assignments").select("id").eq("module_id", moduleId).limit(1),
    supabase.from("student_progress").select("module_id").eq("module_id", moduleId).limit(1),
  ]);

  if (assignmentResult.error) {
    console.error("Checking lesson assignments before delete failed:", assignmentResult.error);
    throw assignmentResult.error;
  }
  if (progressResult.error) {
    console.error("Checking lesson progress before delete failed:", progressResult.error);
    throw progressResult.error;
  }

  const hasAssignment = Boolean(assignmentResult.data?.length);
  const hasProgress = Boolean(progressResult.data?.length);
  return {
    canDelete: !hasAssignment && !hasProgress,
    hasAssignment,
    hasProgress,
  };
}

export async function archiveModuleById(moduleId) {
  if (!moduleId) {
    throw new Error("A lesson id is required.");
  }

  const updatedAt = new Date().toISOString();
  if (!isSupabaseConfigured) {
    let archivedModule = null;
    setMockCourses(
      getMockCourses().map((course) => ({
        ...course,
        modules: (Array.isArray(course?.modules) ? course.modules : []).map((module) => {
          if (String(module?.id) !== String(moduleId)) return module;
          archivedModule = { ...module, status: "archived", updatedAt, updated_at: updatedAt };
          return archivedModule;
        }),
      })),
    );
    return archivedModule;
  }

  const { data, error } = await supabase
    .from("modules")
    .update({ status: "archived", updated_at: updatedAt })
    .eq("id", moduleId)
    .select("id, class_id, status, sort_order, updated_at")
    .maybeSingle();

  if (error) {
    console.error("Archiving the selected lesson failed:", error);
    throw error;
  }
  if (!data) {
    throw new Error("The selected lesson was not archived.");
  }

  return data;
}

export async function deleteModuleById(moduleId, { confirmed = false } = {}) {
  const [confirmedModuleId] = requireConfirmedDelete({
    table: "modules",
    ids: [moduleId],
    confirmed,
    reason: "Explicit Admin lesson deletion",
  });
  const safety = await getModuleDeletionSafety(confirmedModuleId);
  if (!safety.canDelete) {
    const activityError = new Error("This lesson has related student activity. Archive it instead of deleting.");
    activityError.code = "MODULE_HAS_RELATED_ACTIVITY";
    throw activityError;
  }

  if (!isSupabaseConfigured) {
    setMockCourses(
      getMockCourses().map((course) => ({
        ...course,
        modules: (Array.isArray(course?.modules) ? course.modules : []).filter(
          (module) => String(module?.id) !== String(confirmedModuleId),
        ),
      })),
    );
    return { id: confirmedModuleId };
  }

  const { data, error } = await supabase
    .from("modules")
    .delete()
    .eq("id", confirmedModuleId)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("Deleting the selected lesson failed:", error);
    throw error;
  }
  if (!data) {
    throw new Error("The selected lesson was not deleted.");
  }

  return data;
}
