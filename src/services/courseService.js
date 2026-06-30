import { isSupabaseConfigured, supabase } from "../lib/supabaseClient.js";
import { cloneMockValue, createMockId, getMockCourses, setMockCourses } from "./mockStore.js";

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

async function attachModulesToCourses(courses = []) {
  const modules = await import("./moduleService.js");
  const result = [];
  for (const course of courses) {
    const courseModules = await modules.getModulesByCourse(course.id);
    result.push({ ...course, modules: courseModules });
  }
  return result;
}

export async function getCourses() {
  if (!isSupabaseConfigured) return getMockCourses();

  try {
    // TODO(database): Align selected columns with the final Supabase courses table schema.
    const { data, error } = await supabase.from("courses").select("*").order("id", { ascending: true });
    if (error) throw error;
    return attachModulesToCourses(data ?? []);
  } catch {
    return getMockCourses();
  }
}

export async function createCourse(course) {
  const payload = {
    ...course,
    owners: Array.isArray(course.owners) ? course.owners : [1],
    modules: normalizeModules(course.modules),
  };

  if (!isSupabaseConfigured) {
    const courses = getMockCourses();
    const created = { ...cloneMockValue(payload), id: payload.id ?? createMockId(courses) };
    setMockCourses([...courses, created]);
    return created;
  }

  try {
    const { modules, ...courseRow } = payload;
    // TODO(database): Persist courses and module ownership against the final Supabase schema.
    const { data, error } = await supabase.from("courses").insert(courseRow).select().single();
    if (error) throw error;
    return { ...data, modules };
  } catch {
    const courses = getMockCourses();
    const created = { ...cloneMockValue(payload), id: payload.id ?? createMockId(courses) };
    setMockCourses([...courses, created]);
    return created;
  }
}

export async function updateCourse(courseId, updates) {
  const payload = {
    ...updates,
    modules: updates.modules ? normalizeModules(updates.modules) : undefined,
  };

  if (!isSupabaseConfigured) {
    const courses = getMockCourses().map((course) => course.id === courseId ? { ...course, ...cloneMockValue(payload) } : course);
    setMockCourses(courses);
    return courses.find((course) => course.id === courseId) ?? null;
  }

  try {
    const { modules, ...courseRow } = payload;
    // TODO(database): Update course fields against the final Supabase courses table schema.
    const { data, error } = await supabase.from("courses").update(courseRow).eq("id", courseId).select().single();
    if (error) throw error;
    return { ...data, modules: modules ?? [] };
  } catch {
    const courses = getMockCourses().map((course) => course.id === courseId ? { ...course, ...cloneMockValue(payload) } : course);
    setMockCourses(courses);
    return courses.find((course) => course.id === courseId) ?? null;
  }
}

export async function deleteCourse(courseId) {
  if (!isSupabaseConfigured) {
    const courses = getMockCourses().filter((course) => course.id !== courseId);
    setMockCourses(courses);
    return true;
  }

  try {
    // TODO(database): Delete courses against the final Supabase courses table schema.
    const { error } = await supabase.from("courses").delete().eq("id", courseId);
    if (error) throw error;
    return true;
  } catch {
    const courses = getMockCourses().filter((course) => course.id !== courseId);
    setMockCourses(courses);
    return true;
  }
}

export async function getStudentCourses(studentId) {
  const courses = await getCourses();
  return courses.filter((course) => Array.isArray(course.owners) && course.owners.includes(studentId));
}
