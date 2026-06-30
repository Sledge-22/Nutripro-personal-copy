import { isSupabaseConfigured, supabase } from "../lib/supabaseClient.js";
import { cloneMockValue, createMockId, getMockCourses, setMockCourses } from "./mockStore.js";
import { getModulesByCourse, replaceModulesForCourse } from "./moduleService.js";

function normalizeModules(modules = []) {
  return modules.map((module, index) => ({
    id: module.id ?? Date.now() + index,
    title: module.title ?? "",
    description: module.description ?? "",
    pdfLabel: module.pdfLabel ?? "No PDF selected",
    video: {
      id: module.video?.id ?? Date.now() + index + 1000,
      title: module.video?.title ?? "",
      description: module.video?.description ?? "",
      duration: module.video?.duration ?? "10 min",
      link: module.video?.link ?? "",
      uploadLabel: module.video?.uploadLabel ?? "No video selected",
    },
  }));
}

function normalizeCourse(row, owners = [], modules = []) {
  return {
    id: row.id,
    title: row.title ?? "",
    description: row.description ?? "",
    owners,
    modules,
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

  await supabase.from("enrollments").delete().eq("course_id", courseId);
  if (!owners.length) return;

  const rows = owners.map((studentId) => ({
    course_id: courseId,
    student_id: studentId,
  }));

  await supabase.from("enrollments").insert(rows);
}

function persistMockCourse(updater) {
  const nextCourses = updater(getMockCourses());
  setMockCourses(nextCourses);
  return nextCourses;
}

export async function getCourses() {
  if (!isSupabaseConfigured) return getMockCourses();

  try {
    const { data, error } = await supabase.from("courses").select("*").order("id", { ascending: true });
    if (error) throw error;
    return attachRelations(data ?? []);
  } catch {
    return getMockCourses();
  }
}

export async function createCourse(course) {
  const payload = {
    title: course.title?.trim() ?? "",
    description: course.description?.trim() ?? "",
    owners: Array.isArray(course.owners) && course.owners.length ? course.owners : [1],
    modules: normalizeModules(course.modules),
  };

  if (!isSupabaseConfigured) {
    const courses = getMockCourses();
    const created = { id: createMockId(courses), ...cloneMockValue(payload) };
    setMockCourses([...courses, created]);
    return created;
  }

  try {
    const { owners, modules, ...courseRow } = payload;
    const { data, error } = await supabase.from("courses").insert(courseRow).select("*").single();
    if (error) throw error;

    const savedModules = await replaceModulesForCourse(data.id, modules);
    await syncEnrollments(data.id, owners);

    return normalizeCourse(data, owners, savedModules);
  } catch {
    const courses = getMockCourses();
    const created = { id: createMockId(courses), ...cloneMockValue(payload) };
    setMockCourses([...courses, created]);
    return created;
  }
}

export async function updateCourse(courseId, updates) {
  const payload = {
    title: updates.title?.trim() ?? "",
    description: updates.description?.trim() ?? "",
    owners: Array.isArray(updates.owners) && updates.owners.length ? updates.owners : [1],
    modules: normalizeModules(updates.modules),
  };

  if (!isSupabaseConfigured) {
    const nextCourses = persistMockCourse((courses) => courses.map((course) => course.id === courseId ? { ...course, ...cloneMockValue(payload) } : course));
    return nextCourses.find((course) => course.id === courseId) ?? null;
  }

  try {
    const { owners, modules, ...courseRow } = payload;
    const { data, error } = await supabase.from("courses").update(courseRow).eq("id", courseId).select("*").single();
    if (error) throw error;

    const savedModules = await replaceModulesForCourse(courseId, modules);
    await syncEnrollments(courseId, owners);

    return normalizeCourse(data, owners, savedModules);
  } catch {
    const nextCourses = persistMockCourse((courses) => courses.map((course) => course.id === courseId ? { ...course, ...cloneMockValue(payload) } : course));
    return nextCourses.find((course) => course.id === courseId) ?? null;
  }
}

export async function deleteCourse(courseId) {
  if (!isSupabaseConfigured) {
    setMockCourses(getMockCourses().filter((course) => course.id !== courseId));
    return true;
  }

  try {
    await supabase.from("enrollments").delete().eq("course_id", courseId);
    await supabase.from("modules").delete().eq("course_id", courseId);
    const { error } = await supabase.from("courses").delete().eq("id", courseId);
    if (error) throw error;
    return true;
  } catch {
    setMockCourses(getMockCourses().filter((course) => course.id !== courseId));
    return true;
  }
}

export async function getStudentCourses(studentId) {
  if (!isSupabaseConfigured) {
    return getMockCourses().filter((course) => Array.isArray(course.owners) && course.owners.includes(studentId));
  }

  try {
    const { data: enrollmentRows, error } = await supabase.from("enrollments").select("*").eq("student_id", studentId);
    if (error) throw error;

    const courseIds = (enrollmentRows ?? []).map((row) => row.course_id ?? row.courseId).filter(Boolean);
    if (!courseIds.length) return [];

    const { data: courseRows, error: courseError } = await supabase.from("courses").select("*").in("id", courseIds).order("id", { ascending: true });
    if (courseError) throw courseError;

    const enrollments = enrollmentRows ?? [];
    const result = [];
    for (const course of courseRows ?? []) {
      const modules = await getModulesByCourse(course.id);
      result.push(normalizeCourse(course, ownersForCourse(course.id, enrollments), modules));
    }
    return result;
  } catch {
    return getMockCourses().filter((course) => Array.isArray(course.owners) && course.owners.includes(studentId));
  }
}
