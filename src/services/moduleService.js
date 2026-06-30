import { isSupabaseConfigured, supabase } from "../lib/supabaseClient.js";
import { getMockCourses, setMockCourses } from "./mockStore.js";

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

  return {
    id: module.id,
    courseId: module.course_id ?? module.courseId,
    sortOrder: module.sort_order ?? module.sortOrder ?? 0,
    title: module.title ?? "",
    description: module.description ?? "",
    pdfUrl,
    pdf_url: pdfUrl,
    pdfLabel: pdfName,
    pdfName,
    videoUrl,
    video_url: videoUrl,
    videoName,
    video: {
      id: module.video_id ?? module.id,
      title: module.video_title ?? module.video?.title ?? `${module.title ?? "Module"} video`,
      description: module.video_description ?? module.video?.description ?? "",
      duration: module.video_duration ?? module.video?.duration ?? "10 min",
      link: module.video_link ?? module.video?.link ?? "",
      url: videoUrl,
      uploadLabel: videoName,
    },
  };
}

function toModuleRow(courseId, module, index) {
  return {
    course_id: courseId,
    title: module.title,
    description: module.description,
    sort_order: module.sortOrder ?? index,
    pdf_url: module.pdf_url || module.pdfUrl || null,
    video_url: module.video_url || module.videoUrl || module.video?.url || module.video?.link || null,
    pdf_label: module.pdfLabel || null,
    video_title: module.video?.title ?? "",
    video_description: module.video?.description ?? "",
    video_duration: module.video?.duration ?? "10 min",
    video_link: module.video?.link ?? "",
    video_upload_label: module.video?.uploadLabel ?? null,
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
    const { data, error } = await supabase.from("modules").select("*").eq("course_id", courseId).order("sort_order", { ascending: true }).order("id", { ascending: true });
    if (error) {
      console.error("Failed to load modules from Supabase:", error);
      throw error;
    }
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
      .insert(modules.map((module, index) => toModuleRow(courseId, module, index + 1)))
      .select("*");

    if (error) {
      console.error("Failed to replace modules in Supabase:", error);
      throw error;
    }
    const mapped = (data ?? []).map(mapModuleRow);
    console.log("Saved Supabase module response:", mapped);
    mapped.forEach((module, index) => {
      const source = modules[index];
      if (source?.pdfUrl && !module.pdf_url) console.error("Module save succeeded but pdf_url is missing:", module);
      if ((source?.videoUrl || source?.video?.url) && !module.video_url) console.error("Module save succeeded but video_url is missing:", module);
    });
    return mapped;
  } catch {
    return updateMockModules(courseId, modules);
  }
}
