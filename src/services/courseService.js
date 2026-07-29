import { isSupabaseConfigured, supabase } from "../lib/supabaseClient.js";
import { getClassesByCourse, syncClassesForCourse } from "./courseClassService.js";
import { setCourseStudentAssignments } from "./enrollmentService.js";
import { cloneMockValue, createMockId, getMockCourses, setMockCourses } from "./mockStore.js";
import { getModulesByCourse, saveModulesForCourse } from "./moduleService.js";

const OPTIONAL_COURSE_COLUMNS = ["image_url", "image_storage_path"];

function normalizeCourseStatus(status) {
  if (status === "draft" || status === "archived" || status === "published") return status;
  return "published";
}

function isStudentVisibleCourseStatus(status) {
  const normalizedStatus = `${status ?? ""}`.trim().toLowerCase();
  return !normalizedStatus || normalizedStatus === "published" || normalizedStatus === "active";
}

function normalizeEntityId(value) {
  const trimmedValue = `${value ?? ""}`.trim();
  if (!trimmedValue) return "";

  const numericValue = Number(trimmedValue);
  return Number.isNaN(numericValue) ? trimmedValue : numericValue;
}

function normalizeOwners(owners = []) {
  return Array.from(
    new Set((Array.isArray(owners) ? owners : []).map((ownerId) => normalizeEntityId(ownerId)).filter(Boolean)),
  );
}

function normalizeModules(modules = []) {
  return modules.map((module, index) => ({
    id: module.id ?? Date.now() + index,
    classId: module.class_id ?? module.classId ?? "",
    class_id: module.class_id ?? module.classId ?? "",
    sortOrder: module.sortOrder ?? index + 1,
    sort_order: module.sort_order ?? module.sortOrder ?? index + 1,
    createdAt: module.created_at ?? module.createdAt ?? "",
    created_at: module.created_at ?? module.createdAt ?? "",
    title: module.title ?? "",
    description: module.description ?? "",
    lessonContent: module.lesson_content ?? module.lessonContent ?? "",
    lesson_content: module.lesson_content ?? module.lessonContent ?? "",
    embedUrl:
      module.embed_url ??
      module.embedUrl ??
      module.video_external_url ??
      module.videoExternalUrl ??
      module.video_embed_url ??
      module.videoEmbedUrl ??
      "",
    embed_url:
      module.embed_url ??
      module.embedUrl ??
      module.video_external_url ??
      module.videoExternalUrl ??
      module.video_embed_url ??
      module.videoEmbedUrl ??
      "",
    assignmentInstructions:
      module.assignment_instructions ?? module.assignmentInstructions ?? module.assignment?.instructions ?? "",
    assignment_instructions:
      module.assignment_instructions ?? module.assignmentInstructions ?? module.assignment?.instructions ?? "",
    updatedAt: module.updated_at ?? module.updatedAt ?? "",
    updated_at: module.updated_at ?? module.updatedAt ?? "",
    status: module.status ?? "published",
    requiresAssignment:
      module.requiresAssignment ??
      module.requires_assignment ??
      Boolean(module.assignment?.title),
    requires_assignment:
      module.requires_assignment ??
      module.requiresAssignment ??
      Boolean(module.assignment?.title),
    imageUrl:
      module.image_url ??
      module.imageUrl ??
      "",
    image_url:
      module.image_url ??
      module.imageUrl ??
      "",
    imageName: module.imageName ?? module.image_file_name ?? "",
    image_file_name: module.image_file_name ?? module.imageName ?? "",
    image_storage_path: module.image_storage_path ?? module.imageStoragePath ?? "",
    pdfUrl:
      module.pdf_url ??
      module.pdfUrl ??
      module.pdf_public_url ??
      module.pdfPublicUrl ??
      module.pdf_file_url ??
      module.pdfFileUrl ??
      "",
    pdf_url:
      module.pdf_url ??
      module.pdfUrl ??
      module.pdf_public_url ??
      module.pdfPublicUrl ??
      module.pdf_file_url ??
      module.pdfFileUrl ??
      "",
    pdfLabel: module.pdfLabel ?? module.pdfName ?? module.pdf_file_name ?? module.pdf_external_url ?? module.pdfExternalUrl ?? module.external_pdf_url ?? module.externalPdfUrl ?? "No PDF selected",
    pdfName: module.pdfName ?? module.pdf_file_name ?? module.pdfLabel ?? module.pdf_external_url ?? module.pdfExternalUrl ?? module.external_pdf_url ?? module.externalPdfUrl ?? "No PDF selected",
    pdf_file_name: module.pdf_file_name ?? module.pdfName ?? module.pdfLabel ?? "",
    pdf_storage_path: module.pdf_storage_path ?? module.pdfStoragePath ?? "",
    pdfExternalUrl:
      module.pdf_external_url ??
      module.pdfExternalUrl ??
      module.external_pdf_url ??
      module.externalPdfUrl ??
      module.pdfLink ??
      module.pdf_link ??
      "",
    pdf_external_url:
      module.pdf_external_url ??
      module.pdfExternalUrl ??
      module.external_pdf_url ??
      module.externalPdfUrl ??
      module.pdfLink ??
      module.pdf_link ??
      "",
    pdfSource:
      module.pdf_source ??
      module.pdfSource ??
      ((module.pdf_external_url ?? module.pdfExternalUrl ?? module.external_pdf_url ?? module.externalPdfUrl ?? module.pdfLink ?? module.pdf_link) ? "external" : "upload"),
    pdf_source:
      module.pdf_source ??
      module.pdfSource ??
      ((module.pdf_external_url ?? module.pdfExternalUrl ?? module.external_pdf_url ?? module.externalPdfUrl ?? module.pdfLink ?? module.pdf_link) ? "external" : "upload"),
    videoUrl:
      module.video_url ??
      module.videoUrl ??
      module.video_public_url ??
      module.videoPublicUrl ??
      module.video_file_url ??
      module.videoFileUrl ??
      module.video?.url ??
      module.video?.link ??
      module.video_external_url ??
      module.videoExternalUrl ??
      module.external_video_url ??
      module.externalVideoUrl ??
      module.video_embed_url ??
      module.videoEmbedUrl ??
      module.videoLink ??
      module.video_link ??
      "",
    video_url:
      module.video_url ??
      module.videoUrl ??
      module.video_public_url ??
      module.videoPublicUrl ??
      module.video_file_url ??
      module.videoFileUrl ??
      module.video?.url ??
      module.video?.link ??
      module.video_external_url ??
      module.videoExternalUrl ??
      module.external_video_url ??
      module.externalVideoUrl ??
      module.video_embed_url ??
      module.videoEmbedUrl ??
      module.videoLink ??
      module.video_link ??
      "",
    videoName: module.videoName ?? module.video_file_name ?? module.video?.uploadLabel ?? module.video_external_url ?? module.videoExternalUrl ?? module.external_video_url ?? module.externalVideoUrl ?? module.video_embed_url ?? module.videoEmbedUrl ?? module.videoLink ?? module.video_link ?? "No video selected",
    video_file_name: module.video_file_name ?? module.videoName ?? module.video?.uploadLabel ?? "",
    video_storage_path: module.video_storage_path ?? module.videoStoragePath ?? "",
    videoExternalUrl:
      module.video_external_url ??
      module.videoExternalUrl ??
      module.external_video_url ??
      module.externalVideoUrl ??
      module.video_embed_url ??
      module.videoEmbedUrl ??
      module.videoLink ??
      module.video_link ??
      "",
    video_external_url:
      module.video_external_url ??
      module.videoExternalUrl ??
      module.external_video_url ??
      module.externalVideoUrl ??
      module.video_embed_url ??
      module.videoEmbedUrl ??
      module.videoLink ??
      module.video_link ??
      "",
    videoSource:
      module.video_source ??
      module.videoSource ??
      ((module.video_external_url ?? module.videoExternalUrl ?? module.external_video_url ?? module.externalVideoUrl ?? module.video_embed_url ?? module.videoEmbedUrl ?? module.videoLink ?? module.video_link) ? "external" : "upload"),
    video_source:
      module.video_source ??
      module.videoSource ??
      ((module.video_external_url ?? module.videoExternalUrl ?? module.external_video_url ?? module.externalVideoUrl ?? module.video_embed_url ?? module.videoEmbedUrl ?? module.videoLink ?? module.video_link) ? "external" : "upload"),
    video: {
      id: module.video?.id ?? Date.now() + index + 1000,
      title: module.video?.title ?? "",
      description: module.video?.description ?? "",
      duration: module.video?.duration ?? "10 min",
      link: module.video?.link ?? module.video_external_url ?? module.videoExternalUrl ?? module.external_video_url ?? module.externalVideoUrl ?? module.video_embed_url ?? module.videoEmbedUrl ?? module.videoLink ?? module.video_link ?? "",
      url: module.video?.url ?? module.video_url ?? module.videoUrl ?? module.video?.link ?? module.video_external_url ?? module.videoExternalUrl ?? module.external_video_url ?? module.externalVideoUrl ?? module.video_embed_url ?? module.videoEmbedUrl ?? module.videoLink ?? module.video_link ?? "",
      uploadLabel: module.video?.uploadLabel ?? module.videoName ?? module.video_file_name ?? module.video_external_url ?? module.videoExternalUrl ?? module.external_video_url ?? module.externalVideoUrl ?? module.video_embed_url ?? module.videoEmbedUrl ?? module.videoLink ?? module.video_link ?? "No video selected",
    },
    assignment: module.assignment
        ? {
          id: module.assignment.id ?? null,
          moduleId: module.assignment.moduleId ?? module.id ?? null,
          title: module.assignment.title ?? "",
          instructions: module.assignment.instructions ?? "",
          titleEn: module.assignment.title_en ?? module.assignment.titleEn ?? "",
          title_en: module.assignment.title_en ?? module.assignment.titleEn ?? "",
          titleEs: module.assignment.title_es ?? module.assignment.titleEs ?? "",
          title_es: module.assignment.title_es ?? module.assignment.titleEs ?? "",
          instructionsEn: module.assignment.instructions_en ?? module.assignment.instructionsEn ?? "",
          instructions_en: module.assignment.instructions_en ?? module.assignment.instructionsEn ?? "",
          instructionsEs: module.assignment.instructions_es ?? module.assignment.instructionsEs ?? "",
          instructions_es: module.assignment.instructions_es ?? module.assignment.instructionsEs ?? "",
          submissionType: "file",
          submission_type: "file",
        }
      : null,
  }));
}

function normalizeClassStatus(status) {
  if (status === "draft" || status === "published" || status === "archived") return status;
  return "draft";
}

function buildGeneralClass(courseId, modules = []) {
  return {
    id: `general-${courseId || "course"}`,
    courseId: courseId,
    course_id: courseId,
    title: "General",
    description: "",
    sortOrder: 9999,
    sort_order: 9999,
    status: "published",
    modules,
    isFallback: true,
  };
}

function normalizeClasses(classes = [], courseId, modules = []) {
  const mappedClasses = (Array.isArray(classes) ? classes : []).map((entry, index) => ({
    id: entry.id,
    courseId: entry.course_id ?? entry.courseId ?? courseId,
    course_id: entry.course_id ?? entry.courseId ?? courseId,
    title: entry.title ?? "",
    description: entry.description ?? "",
    sortOrder: entry.sort_order ?? entry.sortOrder ?? index + 1,
    sort_order: entry.sort_order ?? entry.sortOrder ?? index + 1,
    status: normalizeClassStatus(entry.status),
  }));

  const modulesByClass = new Map();
  const unclassedModules = [];

  (modules ?? []).forEach((module) => {
    const classId = module.class_id ?? module.classId ?? "";
    if (!classId) {
      unclassedModules.push(module);
      return;
    }

    const list = modulesByClass.get(String(classId)) ?? [];
    list.push(module);
    modulesByClass.set(String(classId), list);
  });

  const normalized = mappedClasses.map((courseClass) => ({
    ...courseClass,
    modules: (modulesByClass.get(String(courseClass.id)) ?? []).sort(
      (left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0),
    ),
  }));

  if (unclassedModules.length) {
    normalized.push(buildGeneralClass(courseId, unclassedModules));
  }

  if (!normalized.length && modules.length) {
    return [buildGeneralClass(courseId, modules)];
  }

  return normalized.sort((left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0));
}

function normalizeCourse(row, owners = [], modules = [], classes = []) {
  const normalizedModules = Array.isArray(modules) ? modules : [];
  const normalizedClasses = normalizeClasses(classes, row.id, normalizedModules);
  return {
    id: row.id,
    title: row.title ?? "",
    description: row.description ?? "",
    status: normalizeCourseStatus(row.status),
    imageUrl: row.image_url ?? row.imageUrl ?? "",
    image_url: row.image_url ?? row.imageUrl ?? "",
    imageStoragePath: row.image_storage_path ?? row.imageStoragePath ?? "",
    image_storage_path: row.image_storage_path ?? row.imageStoragePath ?? "",
    owners,
    classes: normalizedClasses,
    modules: normalizedModules,
  };
}

async function fetchEnrollmentRows() {
  const { data, error } = await supabase.from("enrollments").select("id, course_id, student_id, status");
  if (error) throw error;
  return data ?? [];
}

function ownersForCourse(courseId, enrollments) {
  return enrollments
    .filter((entry) => {
      const entryCourseId = entry.course_id ?? entry.courseId;
      const entryStatus = `${entry.status ?? "active"}`.trim().toLowerCase();
      return String(entryCourseId) === String(courseId) && entryStatus !== "inactive";
    })
    .map((entry) => entry.student_id ?? entry.studentId)
    .filter(Boolean);
}

async function attachRelations(courses = []) {
  let enrollments = [];
  try {
    enrollments = await fetchEnrollmentRows();
  } catch (error) {
    console.error("Loading course enrollment relations failed; base courses will still be shown:", error);
  }

  const enriched = [];

  for (const course of courses) {
    const [modulesResult, classesResult] = await Promise.allSettled([
      getModulesByCourse(course.id),
      getClassesByCourse(course.id),
    ]);

    if (modulesResult.status === "rejected") {
      console.error(`Loading modules for course ${course.id} failed; showing the persisted course without modules:`, modulesResult.reason);
    }
    if (classesResult.status === "rejected") {
      console.error(`Loading classes for course ${course.id} failed; showing the persisted course without classes:`, classesResult.reason);
    }

    const modules = modulesResult.status === "fulfilled" ? modulesResult.value : [];
    const classes = classesResult.status === "fulfilled" ? classesResult.value : [];
    enriched.push(normalizeCourse(course, ownersForCourse(course.id, enrollments), modules, classes));
  }

  return enriched;
}

function persistMockCourse(updater) {
  const nextCourses = updater(getMockCourses());
  setMockCourses(nextCourses);
  return nextCourses;
}

function buildCourseRow(course) {
  return {
    title: course.title?.trim() ?? "",
    description: course.description?.trim() ?? "",
    status: normalizeCourseStatus(course.status),
    image_url: course.image_url ?? course.imageUrl ?? null,
    image_storage_path: course.image_storage_path ?? course.imageStoragePath ?? null,
  };
}

function normalizeCourseClassesInput(course, modules = []) {
  if (Array.isArray(course?.classes) && course.classes.length) {
    return course.classes.map((entry, index) => ({
      id: entry.id ?? null,
      title: `${entry.title ?? ""}`.trim() || "General",
      description: `${entry.description ?? ""}`.trim(),
      sortOrder: entry.sortOrder ?? entry.sort_order ?? index + 1,
      sort_order: entry.sortOrder ?? entry.sort_order ?? index + 1,
      status: normalizeClassStatus(entry.status),
    }));
  }

  if (modules.length) {
    return [
      {
        id: null,
        title: "General",
        description: "",
        sortOrder: 1,
        sort_order: 1,
        status: "published",
      },
    ];
  }

  return [];
}

async function runCourseMutationWithFallback(operation, payload, attempt = 0) {
  const { data, error } = await operation(payload);
  if (!error) return data;

  const columnName = OPTIONAL_COURSE_COLUMNS.find(
    (column) =>
      column in payload &&
      (error.message?.includes(`'${column}'`) ||
        error.message?.includes(`courses.${column}`) ||
        error.details?.includes(column) ||
        error.hint?.includes(column)),
  );

  if (columnName && attempt < OPTIONAL_COURSE_COLUMNS.length) {
    const nextPayload = { ...payload };
    delete nextPayload[columnName];
    console.warn(`Retrying course mutation without optional column ${columnName}. Run the matching SQL later to enable it.`);
    return runCourseMutationWithFallback(operation, nextPayload, attempt + 1);
  }

  throw error;
}

export async function getCourses() {
  if (!isSupabaseConfigured) return getMockCourses();

  const { data, error } = await supabase.from("courses").select("*").order("id", { ascending: true });
  if (error) {
    console.error("Failed to load courses from Supabase:", error);
    throw error;
  }
  return attachRelations(data ?? []);
}

export async function createCourse(course, options = {}) {
  const status = normalizeCourseStatus(course.status);
  const payload = {
    ...buildCourseRow(course),
    status,
    owners: normalizeOwners(course.owners),
    modules: normalizeModules(course.modules),
    classes: normalizeCourseClassesInput(course, normalizeModules(course.modules)),
  };

  if (!isSupabaseConfigured) {
    const courses = getMockCourses();
    const created = { id: createMockId(courses), ...cloneMockValue(payload) };
    setMockCourses([...courses, created]);
    return created;
  }

  const { owners, modules, classes, ...courseRow } = payload;
  console.log("Course classes right before create:", classes);
  console.log("Course modules right before create:", modules);
  const data = await runCourseMutationWithFallback(
    (nextPayload) => supabase.from("courses").insert(nextPayload).select("*").single(),
    courseRow,
  );
  console.log("Created course response:", data);

  const { savedClasses } = classes.length
    ? await syncClassesForCourse(data.id, classes)
    : { savedClasses: [] };
  const classIdMap = new Map(savedClasses.map((courseClass) => [String(courseClass.clientId ?? ""), courseClass.id]));
  const firstSavedClassId = savedClasses[0]?.id ?? null;
  const nextModules = modules.map((module) => ({
    ...module,
    classId: classIdMap.get(String(module.class_id ?? module.classId ?? "")) ?? module.class_id ?? module.classId ?? firstSavedClassId,
    class_id: classIdMap.get(String(module.class_id ?? module.classId ?? "")) ?? module.class_id ?? module.classId ?? firstSavedClassId,
  }));

  let savedModules = [];
  if (nextModules.length) {
    try {
      savedModules = await saveModulesForCourse(data.id, nextModules, { onProgress: options.onProgress });
    } catch (moduleError) {
      console.error("Module insert error:", moduleError);
      throw moduleError;
    }
  }

  if (owners.length) {
    try {
      const enrollmentRows = await setCourseStudentAssignments(data.id, owners);
      console.log("Created course enrollment response:", enrollmentRows);
    } catch (enrollmentError) {
      console.error("Course enrollment sync failed after create:", enrollmentError);
      throw enrollmentError;
    }
  }

  return normalizeCourse(data, owners, savedModules, savedClasses);
}

export async function updateCourse(courseId, updates, options = {}) {
  const status = normalizeCourseStatus(updates.status);
  const payload = {
    ...buildCourseRow(updates),
    status,
    owners: normalizeOwners(updates.owners),
    modules: normalizeModules(updates.modules),
    classes: normalizeCourseClassesInput(updates, normalizeModules(updates.modules)),
  };

  if (!isSupabaseConfigured) {
    const nextCourses = persistMockCourse((courses) =>
      courses.map((course) => (String(course.id) === String(courseId) ? { ...course, ...cloneMockValue(payload) } : course)),
    );
    return nextCourses.find((course) => String(course.id) === String(courseId)) ?? null;
  }

  const { owners, modules, classes, ...courseRow } = payload;
  const syncContent = options.syncContent === true;
  const syncEnrollments = options.syncEnrollments === true;

  // Do not delete modules/classes during course save. Existing course content
  // must persist across deployments and edits.
  // Modules should only be deleted by explicit Admin action.
  const data = await runCourseMutationWithFallback(
    (nextPayload) =>
      supabase.from("courses").update(nextPayload).eq("id", courseId).select("*").single(),
    courseRow,
  );
  console.log("Updated course response:", data);

  let savedClasses = await getClassesByCourse(courseId);
  let savedModules = await getModulesByCourse(courseId);
  if (syncContent) {
    console.log("Course classes right before non-destructive content sync:", classes);
    console.log("Course modules right before non-destructive content sync:", modules);
    const classResult = await syncClassesForCourse(courseId, classes);
    savedClasses = classResult.savedClasses;
    const classIdMap = new Map(savedClasses.map((courseClass) => [String(courseClass.clientId ?? ""), courseClass.id]));
    const firstSavedClassId = savedClasses[0]?.id ?? null;
    const nextModules = modules.map((module) => ({
      ...module,
      classId: classIdMap.get(String(module.class_id ?? module.classId ?? "")) ?? module.class_id ?? module.classId ?? firstSavedClassId,
      class_id: classIdMap.get(String(module.class_id ?? module.classId ?? "")) ?? module.class_id ?? module.classId ?? firstSavedClassId,
    }));

    try {
      savedModules = await saveModulesForCourse(courseId, nextModules, { onProgress: options.onProgress });
      savedClasses = await getClassesByCourse(courseId);
    } catch (moduleError) {
      console.error("Module save error:", moduleError);
      throw moduleError;
    }
  }

  let persistedOwners = owners;
  if (syncEnrollments) {
    try {
      const enrollmentRows = await setCourseStudentAssignments(courseId, owners);
      console.log("Updated course enrollment response:", enrollmentRows);
    } catch (enrollmentError) {
      console.error("Course enrollment sync failed after update:", enrollmentError);
      throw enrollmentError;
    }
  } else {
    const enrollments = await fetchEnrollmentRows();
    persistedOwners = ownersForCourse(courseId, enrollments);
  }

  return normalizeCourse(data, persistedOwners, savedModules, savedClasses);
}

export async function deleteCourse(courseId) {
  if (!isSupabaseConfigured) {
    setMockCourses(
      getMockCourses().map((course) =>
        String(course.id) === String(courseId) ? { ...course, status: "archived" } : course,
      ),
    );
    return true;
  }

  // Course removal is intentionally a soft archive. Child classes, modules,
  // assignments, submissions, progress, certificates, and enrollments persist.
  const { error } = await supabase
    .from("courses")
    .update({ status: "archived" })
    .eq("id", courseId);
  if (error) {
    console.error("Failed to archive course in Supabase:", error);
    throw error;
  }

  return true;
}

export async function getStudentCourses(studentId) {
  if (!studentId) {
    console.error("Student course access failed because the active student user is missing.");
    return [];
  }

  if (!isSupabaseConfigured) {
    return getMockCourses().filter(
      (course) =>
        normalizeCourseStatus(course.status) === "published" &&
        Array.isArray(course.owners) &&
        course.owners.some((ownerId) => String(ownerId) === String(studentId)),
    );
  }

  const { data: enrollmentRows, error } = await supabase
    .from("enrollments")
    .select("id,course_id,student_id,status")
    .eq("student_id", studentId);
  if (error) {
    console.error("[StudentCourses] Failed to load enrollments from public.enrollments:", error);
    throw error;
  }

  const activeEnrollmentRows = (enrollmentRows ?? []).filter((row) => {
    const status = `${row.status ?? ""}`.trim().toLowerCase();
    return !status || status === "active";
  });
  console.log("[StudentCourses] enrollments count", activeEnrollmentRows.length);

  const courseIds = Array.from(
    new Set(activeEnrollmentRows.map((row) => row.course_id ?? row.courseId).filter(Boolean)),
  );
  console.log("[StudentCourses] course ids", courseIds);
  if (!courseIds.length) {
    return [];
  }

  const { data: courseRows, error: courseError } = await supabase
    .from("courses")
    .select("*")
    .in("id", courseIds)
    .order("id", { ascending: true });

  if (courseError) {
    console.error("[StudentCourses] Failed to load assigned rows from public.courses:", courseError);
    throw courseError;
  }

  console.log("[StudentCourses] courses count", courseRows?.length ?? 0);

  const returnedCourseIds = new Set((courseRows ?? []).map((course) => String(course.id)));
  const missingCourseIds = courseIds.filter((courseId) => !returnedCourseIds.has(String(courseId)));
  if (missingCourseIds.length) {
    console.error(
      "[StudentCourses] Assigned course rows were not returned from public.courses (missing row or RLS restriction):",
      missingCourseIds,
    );
  }

  const visibleCourses = (courseRows ?? []).filter((course) => isStudentVisibleCourseStatus(course.status));
  const hiddenCourses = (courseRows ?? [])
    .filter((course) => !isStudentVisibleCourseStatus(course.status))
    .map((course) => ({ courseId: course.id, status: course.status ?? null }));
  if (hiddenCourses.length) {
    console.warn("[StudentCourses] Assigned courses hidden by status:", hiddenCourses);
  }

  return visibleCourses.map((course) => normalizeCourse(course, [studentId], [], []));
}

export async function hydrateStudentCourseDetails(courses = [], studentId) {
  const hydratedCourses = [];

  for (const course of Array.isArray(courses) ? courses : []) {
    const [classesResult, modulesResult] = await Promise.allSettled([
      getClassesByCourse(course.id),
      getModulesByCourse(course.id),
    ]);

    if (classesResult.status === "rejected") {
      console.error(
        `[StudentCourses] Failed to load course_classes for course ${course.id}:`,
        classesResult.reason,
      );
    }
    if (modulesResult.status === "rejected") {
      console.error(
        `[StudentCourses] Failed to load modules for course ${course.id}:`,
        modulesResult.reason,
      );
    }

    const classes = classesResult.status === "fulfilled" ? classesResult.value : [];
    const modules = modulesResult.status === "fulfilled" ? modulesResult.value : [];
    hydratedCourses.push({
      ...normalizeCourse(course, [studentId], modules, classes),
      detailsLoadFailed:
        classesResult.status === "rejected" ||
        modulesResult.status === "rejected",
    });
  }

  return hydratedCourses;
}

export async function getStudentCourseAccess(studentId, courseId) {
  const normalizedCourseId = normalizeEntityId(courseId);
  console.log("Maya student id:", studentId);

  if (!studentId) {
    console.error("Student course access failed because the active student user is missing.");
    return { reason: "missing-student", course: null, enrollment: null, courseStatus: null };
  }

  if (!normalizedCourseId) {
    console.error("Student course access failed because the selected course id is missing.");
    return { reason: "missing-id", course: null, enrollment: null, courseStatus: null };
  }

  if (!isSupabaseConfigured) {
    const mockCourse = getMockCourses().find((course) => String(course.id) === String(normalizedCourseId)) ?? null;

    if (!mockCourse) {
      console.error("Student course access failed because the course is not assigned in mock data:", normalizedCourseId);
      return { reason: "missing-enrollment", course: null, enrollment: null, courseStatus: null };
    }

    const mockEnrollmentExists =
      Array.isArray(mockCourse.owners) &&
      mockCourse.owners.some((ownerId) => String(ownerId) === String(studentId));
    console.log("Enrollment result:", mockEnrollmentExists ? [{ course_id: mockCourse.id, student_id: studentId }] : []);
    console.log("Course status:", mockCourse.status ?? "published");

    if (!mockEnrollmentExists) {
      console.error("Student course access failed because the course is not assigned to Maya Laurent in mock data.");
      return { reason: "missing-enrollment", course: null, enrollment: null, courseStatus: mockCourse.status ?? null };
    }

    if (normalizeCourseStatus(mockCourse.status) !== "published") {
      console.error("Student course access failed because the course is not published in mock data:", mockCourse.status);
      return {
        reason: "not-published",
        course: mockCourse,
        enrollment: { course_id: mockCourse.id, student_id: studentId },
        courseStatus: mockCourse.status ?? null,
      };
    }

    return {
      reason: null,
      course: mockCourse,
      enrollment: { course_id: mockCourse.id, student_id: studentId },
      courseStatus: mockCourse.status ?? "published",
    };
  }

  const { data: enrollmentRows, error: enrollmentError } = await supabase
    .from("enrollments")
    .select("*")
    .eq("student_id", studentId)
    .eq("course_id", normalizedCourseId)
    .limit(5);

  if (enrollmentError) {
    console.error("Failed to load the exact student enrollment from Supabase:", enrollmentError);
    throw enrollmentError;
  }

  console.log("Enrollment result:", enrollmentRows ?? []);

  const activeEnrollmentRows = (enrollmentRows ?? []).filter((row) => {
    const status = `${row.status ?? ""}`.trim().toLowerCase();
    return !status || status === "active";
  });

  if (!activeEnrollmentRows.length) {
    console.error("Student course access failed because the course is not assigned to the active student:", {
      studentId,
      courseId: normalizedCourseId,
    });
    return { reason: "missing-enrollment", course: null, enrollment: null, courseStatus: null };
  }

  const { data: courseRow, error: courseError } = await supabase
    .from("courses")
    .select("*")
    .eq("id", normalizedCourseId)
    .limit(1)
    .maybeSingle();

  if (courseError) {
    console.error("Failed to load the selected course from Supabase:", courseError);
    throw courseError;
  }

  const courseStatus = courseRow?.status ?? null;
  console.log("Course status:", courseStatus);

  if (!courseRow) {
    console.error("Student course access failed because the selected course record could not be found:", normalizedCourseId);
    return { reason: "missing-enrollment", course: null, enrollment: enrollmentRows?.[0] ?? null, courseStatus: null };
  }

  const [classesResult, modulesResult] = await Promise.allSettled([
    getClassesByCourse(courseRow.id),
    getModulesByCourse(courseRow.id),
  ]);
  if (classesResult.status === "rejected") {
    console.error(
      `[StudentCourses] Failed to load course_classes for selected course ${courseRow.id}:`,
      classesResult.reason,
    );
  }
  if (modulesResult.status === "rejected") {
    console.error(
      `[StudentCourses] Failed to load modules for selected course ${courseRow.id}:`,
      modulesResult.reason,
    );
  }
  const normalizedCourse = {
    ...normalizeCourse(
      courseRow,
      [studentId],
      modulesResult.status === "fulfilled" ? modulesResult.value : [],
      classesResult.status === "fulfilled" ? classesResult.value : [],
    ),
    detailsLoadFailed:
      classesResult.status === "rejected" ||
      modulesResult.status === "rejected",
  };

  if (!isStudentVisibleCourseStatus(courseRow.status)) {
    console.error("Student course access failed because the selected course is not student-visible:", {
      courseId: courseRow.id,
      status: courseRow.status ?? null,
    });
    return {
      reason: "not-published",
      course: normalizedCourse,
      enrollment: activeEnrollmentRows?.[0] ?? null,
      courseStatus: courseRow.status ?? null,
    };
  }

  return {
    reason: null,
    course: normalizedCourse,
    enrollment: activeEnrollmentRows?.[0] ?? null,
    courseStatus: courseRow.status ?? "published",
  };
}

export async function updateCourseStatus(courseId, status) {
  const nextStatus = normalizeCourseStatus(status);

  if (!isSupabaseConfigured) {
    const nextCourses = getMockCourses().map((course) =>
      String(course.id) === String(courseId)
        ? {
            ...course,
            status: nextStatus,
          }
        : course,
    );

    setMockCourses(nextCourses);
    return nextCourses.find((course) => String(course.id) === String(courseId)) ?? null;
  }

  const { data, error } = await supabase
    .from("courses")
    .update({ status: nextStatus })
    .eq("id", courseId)
    .select("*")
    .single();

  if (error) {
    console.error("Failed to update course status in Supabase:", error);
    throw error;
  }

  console.log("Updated course status response:", data);

  const modules = await getModulesByCourse(courseId);
  const classes = await getClassesByCourse(courseId);
  const enrollments = await fetchEnrollmentRows();
  return normalizeCourse(data, ownersForCourse(courseId, enrollments), modules, classes);
}

export async function publishCourse(courseId) {
  return updateCourseStatus(courseId, "published");
}

export async function unpublishCourse(courseId) {
  return updateCourseStatus(courseId, "draft");
}
