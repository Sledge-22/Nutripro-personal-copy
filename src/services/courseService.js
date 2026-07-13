import { isSupabaseConfigured, supabase } from "../lib/supabaseClient.js";
import { setCourseStudentAssignments } from "./enrollmentService.js";
import { cloneMockValue, createMockId, getMockCourses, setMockCourses } from "./mockStore.js";
import { getModulesByCourse, replaceModulesForCourse } from "./moduleService.js";

const OPTIONAL_COURSE_COLUMNS = ["image_url", "image_storage_path"];

function normalizeCourseStatus(status) {
  if (status === "draft" || status === "archived" || status === "published") return status;
  return "published";
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
    sortOrder: module.sortOrder ?? index + 1,
    title: module.title ?? "",
    description: module.description ?? "",
    requiresAssignment:
      module.requiresAssignment ??
      module.requires_assignment ??
      Boolean(module.assignment?.title),
    requires_assignment:
      module.requires_assignment ??
      module.requiresAssignment ??
      Boolean(module.assignment?.title),
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

function normalizeCourse(row, owners = [], modules = []) {
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
    modules: Array.isArray(modules) ? modules : [],
  };
}

async function fetchEnrollmentRows() {
  const { data, error } = await supabase.from("enrollments").select("*");
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
    .map((entry) => entry.student_id ?? entry.user_id ?? entry.owner_id)
    .filter(Boolean);
}

async function attachRelations(courses = []) {
  const enrollments = await fetchEnrollmentRows();
  const enriched = [];

  for (const course of courses) {
    const modules = await getModulesByCourse(course.id);
    enriched.push(normalizeCourse(course, ownersForCourse(course.id, enrollments), modules));
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
  };

  if (!isSupabaseConfigured) {
    const courses = getMockCourses();
    const created = { id: createMockId(courses), ...cloneMockValue(payload) };
    setMockCourses([...courses, created]);
    return created;
  }

  const { owners, modules, ...courseRow } = payload;
  console.log("Course modules right before create:", modules);
  const data = await runCourseMutationWithFallback(
    (nextPayload) => supabase.from("courses").insert(nextPayload).select("*").single(),
    courseRow,
  );
  console.log("Created course response:", data);

  let savedModules = [];
  try {
    savedModules = await replaceModulesForCourse(data.id, modules, { onProgress: options.onProgress });
  } catch (moduleError) {
    console.error("Module insert error:", moduleError);
    throw moduleError;
  }

  try {
    const enrollmentRows = await setCourseStudentAssignments(data.id, owners);
    console.log("Created course enrollment response:", enrollmentRows);
  } catch (enrollmentError) {
    console.error("Course enrollment sync failed after create:", enrollmentError);
    throw enrollmentError;
  }

  return normalizeCourse(data, owners, savedModules);
}

export async function updateCourse(courseId, updates, options = {}) {
  const status = normalizeCourseStatus(updates.status);
  const payload = {
    ...buildCourseRow(updates),
    status,
    owners: normalizeOwners(updates.owners),
    modules: normalizeModules(updates.modules),
  };

  if (!isSupabaseConfigured) {
    const nextCourses = persistMockCourse((courses) =>
      courses.map((course) => (String(course.id) === String(courseId) ? { ...course, ...cloneMockValue(payload) } : course)),
    );
    return nextCourses.find((course) => String(course.id) === String(courseId)) ?? null;
  }

  const { owners, modules, ...courseRow } = payload;
  console.log("Course modules right before update:", modules);
  const data = await runCourseMutationWithFallback(
    (nextPayload) =>
      supabase.from("courses").update(nextPayload).eq("id", courseId).select("*").single(),
    courseRow,
  );
  console.log("Updated course response:", data);

  let savedModules = [];
  try {
    savedModules = await replaceModulesForCourse(courseId, modules, { onProgress: options.onProgress });
  } catch (moduleError) {
    console.error("Module insert error:", moduleError);
    throw moduleError;
  }

  try {
    const enrollmentRows = await setCourseStudentAssignments(courseId, owners);
    console.log("Updated course enrollment response:", enrollmentRows);
  } catch (enrollmentError) {
    console.error("Course enrollment sync failed after update:", enrollmentError);
    throw enrollmentError;
  }

  return normalizeCourse(data, owners, savedModules);
}

export async function deleteCourse(courseId) {
  if (!isSupabaseConfigured) {
    setMockCourses(getMockCourses().filter((course) => course.id !== courseId));
    return true;
  }

  const { error: enrollmentDeleteError } = await supabase.from("enrollments").delete().eq("course_id", courseId);
  if (enrollmentDeleteError) {
    console.error("Failed to delete enrollments in Supabase:", enrollmentDeleteError);
    throw enrollmentDeleteError;
  }

  const { error: moduleDeleteError } = await supabase.from("modules").delete().eq("course_id", courseId);
  if (moduleDeleteError) {
    console.error("Failed to delete modules in Supabase:", moduleDeleteError);
    throw moduleDeleteError;
  }

  const { error } = await supabase.from("courses").delete().eq("id", courseId);
  if (error) {
    console.error("Failed to delete course in Supabase:", error);
    throw error;
  }

  return true;
}

export async function getStudentCourses(studentId) {
  if (!studentId) {
    console.error("Student course access failed because the Maya Laurent demo student user is missing.");
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

  const { data: enrollmentRows, error } = await supabase.from("enrollments").select("*").eq("student_id", studentId);
  if (error) {
    console.error("Failed to load student enrollments from Supabase:", error);
    throw error;
  }

  const activeEnrollmentRows = (enrollmentRows ?? []).filter(
    (row) => `${row.status ?? "active"}`.trim().toLowerCase() !== "inactive",
  );

  const courseIds = Array.from(
    new Set(activeEnrollmentRows.map((row) => row.course_id ?? row.courseId).filter(Boolean)),
  );
  if (!courseIds.length) {
    return [];
  }

  const { data: courseRows, error: courseError } = await supabase
    .from("courses")
    .select("*")
    .in("id", courseIds)
    .eq("status", "published")
    .order("id", { ascending: true });

  if (courseError) {
    console.error("Failed to load student courses from Supabase:", courseError);
    throw courseError;
  }

  const publishedCourseIds = new Set((courseRows ?? []).map((course) => course.id));
  const unavailableCourseIds = courseIds.filter((courseId) => !publishedCourseIds.has(courseId));
  if (unavailableCourseIds.length) {
    console.error("Student course access failed because these enrolled courses are not published:", unavailableCourseIds);
  }

  const allEnrollments = await fetchEnrollmentRows();
  const result = [];
  for (const course of courseRows ?? []) {
    const modules = await getModulesByCourse(course.id);
    result.push(normalizeCourse(course, ownersForCourse(course.id, allEnrollments), modules));
  }
  return result;
}

export async function getStudentCourseAccess(studentId, courseId) {
  const normalizedCourseId = normalizeEntityId(courseId);
  console.log("Maya student id:", studentId);

  if (!studentId) {
    console.error("Student course access failed because the Maya Laurent demo student user is missing.");
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

  const activeEnrollmentRows = (enrollmentRows ?? []).filter(
    (row) => `${row.status ?? "active"}`.trim().toLowerCase() !== "inactive",
  );

  if (!activeEnrollmentRows.length) {
    console.error("Student course access failed because the course is not assigned to Maya Laurent:", normalizedCourseId);
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

  const modules = await getModulesByCourse(courseRow.id);
  const normalizedCourse = normalizeCourse(courseRow, [studentId], modules);

  if (normalizeCourseStatus(courseRow.status) !== "published") {
    console.error("Student course access failed because the selected course is not published:", courseRow.status);
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
  const enrollments = await fetchEnrollmentRows();
  return normalizeCourse(data, ownersForCourse(courseId, enrollments), modules);
}

export async function publishCourse(courseId) {
  return updateCourseStatus(courseId, "published");
}

export async function unpublishCourse(courseId) {
  return updateCourseStatus(courseId, "draft");
}
