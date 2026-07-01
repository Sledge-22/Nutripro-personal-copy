import { isSupabaseConfigured, supabase } from "../lib/supabaseClient.js";
import { cloneMockValue, createMockId, getMockCourses, setMockCourses } from "./mockStore.js";
import { getModulesByCourse, replaceModulesForCourse } from "./moduleService.js";

const DEMO_STUDENT_ID = 1;

function normalizeCourseStatus(status) {
  if (status === "draft" || status === "archived" || status === "published") return status;
  return "published";
}

function ownersForStatus(status, owners = []) {
  if (normalizeCourseStatus(status) !== "published") return [];
  return Array.from(new Set([...(Array.isArray(owners) ? owners : []), DEMO_STUDENT_ID]));
}

function normalizeModules(modules = []) {
  return modules.map((module, index) => ({
    id: module.id ?? Date.now() + index,
    sortOrder: module.sortOrder ?? index + 1,
    title: module.title ?? "",
    description: module.description ?? "",
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
  }));
}

function normalizeCourse(row, owners = [], modules = []) {
  return {
    id: row.id,
    title: row.title ?? "",
    description: row.description ?? "",
    status: normalizeCourseStatus(row.status),
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

async function syncVisibilityEnrollment(courseId, status) {
  if (!isSupabaseConfigured) return;

  const normalizedStatus = normalizeCourseStatus(status);

  if (normalizedStatus === "published") {
    const { data: existingRows, error: existingError } = await supabase
      .from("enrollments")
      .select("*")
      .eq("course_id", courseId)
      .eq("student_id", DEMO_STUDENT_ID);

    if (existingError) {
      console.error("Failed to check demo student enrollment in Supabase:", existingError);
      throw existingError;
    }

    if (!(existingRows ?? []).length) {
      const { data, error } = await supabase
        .from("enrollments")
        .insert([{ course_id: courseId, student_id: DEMO_STUDENT_ID }])
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
    .eq("student_id", DEMO_STUDENT_ID);

  if (error) {
    console.error("Failed to remove demo student enrollment in Supabase:", error);
    throw error;
  }
}

function persistMockCourse(updater) {
  const nextCourses = updater(getMockCourses());
  setMockCourses(nextCourses);
  return nextCourses;
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
  const payload = {
    title: course.title?.trim() ?? "",
    description: course.description?.trim() ?? "",
    status,
    owners: ownersForStatus(status, course.owners),
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
  const { data, error } = await supabase.from("courses").insert(courseRow).select("*").single();
  if (error) {
    console.error("Course insert error:", error);
    throw error;
  }
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
  const payload = {
    title: updates.title?.trim() ?? "",
    description: updates.description?.trim() ?? "",
    status,
    owners: ownersForStatus(status, updates.owners),
    modules: normalizeModules(updates.modules),
  };

  if (!isSupabaseConfigured) {
    const nextCourses = persistMockCourse((courses) => courses.map((course) => course.id === courseId ? { ...course, ...cloneMockValue(payload) } : course));
    return nextCourses.find((course) => course.id === courseId) ?? null;
  }

  const { owners, modules, ...courseRow } = payload;
  console.log("Course modules right before update:", modules);
  const { data, error } = await supabase.from("courses").update(courseRow).eq("id", courseId).select("*").single();
  if (error) {
    console.error("Course update error:", error);
    throw error;
  }
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
  if (!isSupabaseConfigured) {
    return getMockCourses().filter(
      (course) =>
        normalizeCourseStatus(course.status) === "published" &&
        Array.isArray(course.owners) &&
        course.owners.includes(studentId),
    );
  }

  const { data: enrollmentRows, error } = await supabase.from("enrollments").select("*").eq("student_id", studentId);
  if (error) {
    console.error("Failed to load student enrollments from Supabase:", error);
    throw error;
  }

  const courseIds = (enrollmentRows ?? []).map((row) => row.course_id ?? row.courseId).filter(Boolean);
  if (!courseIds.length) return [];

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

  const allEnrollments = await fetchEnrollmentRows();
  const result = [];
  for (const course of courseRows ?? []) {
    const modules = await getModulesByCourse(course.id);
    result.push(normalizeCourse(course, ownersForCourse(course.id, allEnrollments), modules));
  }
  return result;
}

export async function updateCourseStatus(courseId, status) {
  const nextStatus = normalizeCourseStatus(status);

  if (!isSupabaseConfigured) {
    const nextCourses = getMockCourses().map((course) =>
      course.id === courseId
        ? {
            ...course,
            status: nextStatus,
            owners: ownersForStatus(nextStatus, course.owners),
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
