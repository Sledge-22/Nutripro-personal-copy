import { isSupabaseConfigured, supabase } from "../lib/supabaseClient.js";
import { getMockCourses, setMockCourses } from "./mockStore.js";

function mapModuleRow(module) {
  return {
    id: module.id,
    courseId: module.course_id ?? module.courseId,
    title: module.title ?? "",
    description: module.description ?? "",
    pdfLabel: module.pdf_label ?? module.pdfLabel ?? module.pdf_name ?? "No PDF selected",
    video: {
      id: module.video_id ?? module.id,
      title: module.video_title ?? module.video?.title ?? `${module.title ?? "Module"} video`,
      description: module.video_description ?? module.video?.description ?? "",
      duration: module.video_duration ?? module.video?.duration ?? "10 min",
      link: module.video_link ?? module.video?.link ?? "",
      uploadLabel: module.video_upload_label ?? module.video?.uploadLabel ?? module.video_name ?? "No video selected",
    },
  };
}

function toModuleRow(courseId, module) {
  return {
    course_id: courseId,
    title: module.title,
    description: module.description,
    pdf_label: module.pdfLabel,
    video_title: module.video?.title ?? "",
    video_description: module.video?.description ?? "",
    video_duration: module.video?.duration ?? "10 min",
    video_link: module.video?.link ?? "",
    video_upload_label: module.video?.uploadLabel ?? "No video selected",
  };
}

function updateMockModules(courseId, modules) {
  const nextCourses = getMockCourses().map((course) => course.id === courseId ? { ...course, modules } : course);
  setMockCourses(nextCourses);
  return modules;
}

export async function getModulesByCourse(courseId) {
  if (!isSupabaseConfigured) {
    const course = getMockCourses().find((entry) => entry.id === courseId);
    return course?.modules ?? [];
  }

  try {
    const { data, error } = await supabase.from("modules").select("*").eq("course_id", courseId).order("id", { ascending: true });
    if (error) throw error;
    return (data ?? []).map(mapModuleRow);
  } catch {
    const course = getMockCourses().find((entry) => entry.id === courseId);
    return course?.modules ?? [];
  }
}

export async function replaceModulesForCourse(courseId, modules) {
  if (!isSupabaseConfigured) {
    return updateMockModules(courseId, modules);
  }

  try {
    await supabase.from("modules").delete().eq("course_id", courseId);
    if (!modules.length) return [];

    const { data, error } = await supabase
      .from("modules")
      .insert(modules.map((module) => toModuleRow(courseId, module)))
      .select("*");

    if (error) throw error;
    return (data ?? []).map(mapModuleRow);
  } catch {
    return updateMockModules(courseId, modules);
  }
}
