import { isSupabaseConfigured, supabase } from "../lib/supabaseClient.js";
import { cloneMockValue, createMockId, getMockCourses, setMockCourses } from "./mockStore.js";
import { getModulesByCourse, replaceModulesForCourse } from "./moduleService.js";
import { ensureDemoStudent } from "./userService.js";

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

function ownersForStatus(status, owners = [], demoStudentId = 1) {
  if (normalizeCourseStatus(status) !== "published") return [];
  return Array.from(new Set([...(Array.isArray(owners) ? owners : []), demoStudentId]));
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
    pdfUrl: module.pdf_url ?? module.pdfUrl ?? "",
    pdf_url: module.pdf_url ?? module.pdfUrl ?? "",
    pdfLabel: module.pdfLabel ?? module.pdfName ?? module.pdf_file_name ?? "No PDF selected",
    pdfName: module.pdfName ?? module.pdf_file_name ?? module.pdfLabel ?? "No PDF selected",
    pdf_file_name: module.pdf_file_name ?? module.pdfName ?? module.pdfLabel ?? "",
    pdf_storage_path: module.pdf_storage_path ?? module.pdfStoragePath ?? "",
    videoUrl: module.video_url ?? module.videoUrl ?? module.video?.url ?? module.video?.link ?? "",
    video_url: module.video_url ?? module.videoUrl ?? module.video?.url ?? module.video?.link ?? "",
    videoName: module.videoName ?? module.video_file_name ?? module.video?.uploadLabel ?? "No video selected",
    video_file_name: module.video_file_name ?? module.videoName ?? module.video?.uploadLabel ?? "",
    video_storage_path: module.video_storage_path ?? module.videoStoragePath ?? "",
    video: {
      id: module.video?.id ?? Date.now() + index + 1000,
      title: module.video?.title ?? "",
      description: module.video?.description ?? "",
      duration: module.video?.duration ?? "10 min",
      link: module.video?.link ?? "",
      url: module.video?.url ?? module.video_url ?? module.videoUrl ?? module.video?.link ?? "",
      uploadLabel: module.video?.uploadLabel ?? module.videoName ?? module.video_file_name ?? "No video selected",
    },
    assignment: module.assignment
      ? {
          id: module.assignment.id ?? null,
          moduleId: module.assignment.moduleId ?? module.id ?? null,
          title: module.assignment.title ?? "",
          instructions: module.assignment.instructions ?? "",
          dueDate: module.assignment.dueDate ?? module.assignment.due_date ?? "",
          due_date: module.assignment.due_date ?? module.assignment.dueDate ?? "",
          submissionType: module.assignment.submissionType ?? module.assignment.submission_type ?? "text",
          submission_type: module.assignment.submission_type ?? module.assignment.submissionType ?? "text",
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
    .filter((entry) => (entry.course_id ?? entry.courseId) === courseId)
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

async function syncEnrollments(courseId, owners = []) {
  if (!isSupabaseConfigured) return;

  const { error: deleteError } = await supabase.from("enrollments").delete().eq("course_id", courseId);
  if (deleteError) {
    console.error("Failed to clear enrollments in Supabase:", deleteError);
    throw deleteError;
  }
  if (!owners.length) return;

  const rows = owners.map((studentId) => ({
    course_id: courseId,
    student_id: studentId,
  }));

  const { data, error } = await supabase.from("enrollments").insert(rows).select("*");
  if (error) {
    console.error("Failed to insert enrollments in Supabase:", error);
    throw error;
  }
  console.log("Created enrollment response:", data);
}

async function resolveDemoStudentId() {
  const demoStudent = await ensureDemoStudent();
  if (!demoStudent?.id) {
    const missingStudentError = new Error("Maya Laurent demo student is missing.");
    console.error("Student course access failed because the Maya Laurent demo student user is missing.", missingStudentError);
    throw missingStudentError;
  }
  return demoStudent.id;
}

async function syncVisibilityEnrollment(courseId, status) {
  if (!isSupabaseConfigured) return;

  const normalizedStatus = normalizeCourseStatus(status);
  const demoStudentId = await resolveDemoStudentId();

  if (normalizedStatus === "published") {
    const { data: existingRows, error: existingError } = await supabase
      .from("enrollments")
      .select("*")
      .eq("course_id", courseId)
      .eq("student_id", demoStudentId);

    if (existingError) {
      console.error("Failed to check demo student enrollment in Supabase:", existingError);
      throw existingError;
    }

    if (!(existingRows ?? []).length) {
      const { data, error } = await supabase
        .from("enrollments")
        .insert([{ course_id: courseId, student_id: demoStudentId }])
        .select("*");

      if (error) {
        console.error("Failed to auto-enroll demo student in Supabase:", error);
        throw error;
      }

      console.log("Created demo student enrollment response:", data);
    }

    return;
  }

  const { error } = await supabase
    .from("enrollments")
    .delete()
    .eq("course_id", courseId)
    .eq("student_id", demoStudentId);

  if (error) {
    console.error("Failed to remove demo student enrollment in Supabase:", error);
    throw error;
  }
}

async function syncPublishedCoursesForDemoStudent(studentId) {
  if (!isSupabaseConfigured || !studentId) return;

  const demoStudentId = (await ensureDemoStudent())?.id ?? null;
  if (!demoStudentId || String(demoStudentId) !== String(studentId)) return;

  const { data: publishedCourses, error: publishedCoursesError } = await supabase
    .from("courses")
    .select("id")
    .eq("status", "published");

  if (publishedCoursesError) {
    console.error("Failed to load published courses for Maya Laurent enrollment sync:", publishedCoursesError);
    throw publishedCoursesError;
  }

  const publishedCourseIds = (publishedCourses ?? []).map((course) => course.id).filter(Boolean);
  if (!publishedCourseIds.length) return;

  const { data: existingEnrollments, error: enrollmentError } = await supabase
    .from("enrollments")
    .select("course_id")
    .eq("student_id", studentId)
    .in("course_id", publishedCourseIds);

  if (enrollmentError) {
    console.error("Failed to load Maya Laurent enrollments for published-course sync:", enrollmentError);
    throw enrollmentError;
  }

  const enrolledCourseIds = new Set((existingEnrollments ?? []).map((row) => row.course_id ?? row.courseId).filter(Boolean));
  const missingCourseIds = publishedCourseIds.filter((courseId) => !enrolledCourseIds.has(courseId));
  if (!missingCourseIds.length) return;

  const { data, error } = await supabase
    .from("enrollments")
    .insert(missingCourseIds.map((courseId) => ({ course_id: courseId, student_id: studentId })))
    .select("*");

  if (error) {
    console.error("Failed to backfill Maya Laurent enrollments for published courses:", error);
    throw error;
  }

  console.log("Backfilled Maya Laurent enrollment rows for published courses:", data);
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

export async function createCourse(course) {
  const status = normalizeCourseStatus(course.status);
  const demoStudentId = (await ensureDemoStudent())?.id ?? 1;
  const payload = {
    ...buildCourseRow(course),
    status,
    owners: ownersForStatus(status, course.owners, demoStudentId),
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
    savedModules = await replaceModulesForCourse(data.id, modules);
  } catch (moduleError) {
    console.error("Module insert error:", moduleError);
    await supabase.from("courses").delete().eq("id", data.id);
    throw moduleError;
  }

  try {
    await syncEnrollments(data.id, owners);
  } catch (enrollmentError) {
    console.error("Enrollment sync failed after course create:", enrollmentError);
  }

  return normalizeCourse(data, owners, savedModules);
}

export async function updateCourse(courseId, updates) {
  const status = normalizeCourseStatus(updates.status);
  const demoStudentId = (await ensureDemoStudent())?.id ?? 1;
  const payload = {
    ...buildCourseRow(updates),
    status,
    owners: ownersForStatus(status, updates.owners, demoStudentId),
    modules: normalizeModules(updates.modules),
  };

  if (!isSupabaseConfigured) {
    const nextCourses = persistMockCourse((courses) =>
      courses.map((course) => (course.id === courseId ? { ...course, ...cloneMockValue(payload) } : course)),
    );
    return nextCourses.find((course) => course.id === courseId) ?? null;
  }

  const { owners, modules, ...courseRow } = payload;
  console.log("Course modules right before update:", modules);
  const data = await runCourseMutationWithFallback(
    (nextPayload) =>
      supabase.from("courses").update(nextPayload).eq("id", courseId).select("*").single(),
    courseRow,
  );
  console.log("Updated course response:", data);

  const savedModules = await replaceModulesForCourse(courseId, modules);

  try {
    await syncEnrollments(courseId, owners);
  } catch (enrollmentError) {
    console.error("Enrollment sync failed after course update:", enrollmentError);
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
        course.owners.includes(studentId),
    );
  }

  await syncPublishedCoursesForDemoStudent(studentId);

  const { data: enrollmentRows, error } = await supabase.from("enrollments").select("*").eq("student_id", studentId);
  if (error) {
    console.error("Failed to load student enrollments from Supabase:", error);
    throw error;
  }

  const courseIds = (enrollmentRows ?? []).map((row) => row.course_id ?? row.courseId).filter(Boolean);
  if (!courseIds.length) {
    console.error(`Student course access failed because Maya Laurent has no enrollment rows. student_id=${studentId}`);
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

    const mockEnrollmentExists = Array.isArray(mockCourse.owners) && mockCourse.owners.includes(studentId);
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
    .limit(1);

  if (enrollmentError) {
    console.error("Failed to load the exact student enrollment from Supabase:", enrollmentError);
    throw enrollmentError;
  }

  console.log("Enrollment result:", enrollmentRows ?? []);

  if (!(enrollmentRows ?? []).length) {
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
      enrollment: enrollmentRows?.[0] ?? null,
      courseStatus: courseRow.status ?? null,
    };
  }

  return {
    reason: null,
    course: normalizedCourse,
    enrollment: enrollmentRows?.[0] ?? null,
    courseStatus: courseRow.status ?? "published",
  };
}

export async function updateCourseStatus(courseId, status) {
  const nextStatus = normalizeCourseStatus(status);

  if (!isSupabaseConfigured) {
    const demoStudentId = (await ensureDemoStudent())?.id ?? 1;
    const nextCourses = getMockCourses().map((course) =>
      course.id === courseId
        ? {
            ...course,
            status: nextStatus,
            owners: ownersForStatus(nextStatus, course.owners, demoStudentId),
          }
        : course,
    );

    setMockCourses(nextCourses);
    return nextCourses.find((course) => course.id === courseId) ?? null;
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

  await syncVisibilityEnrollment(courseId, nextStatus);

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
