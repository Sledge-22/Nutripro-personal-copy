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
    pdf_file_name: pdfName,
    pdf_storage_path: module.pdf_storage_path ?? "",
    videoUrl,
    video_url: videoUrl,
    videoName,
    video_file_name: videoName,
    video_storage_path: module.video_storage_path ?? "",
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
  const pdfUrl = module.pdf_url ?? module.pdfUrl ?? null;
  const videoUrl = module.video_url ?? module.videoUrl ?? module.video?.url ?? module.video?.link ?? null;

  return {
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
    const selectedCourseId = Number.isNaN(Number(courseId)) ? courseId : Number(courseId);
    const { data, error } = await supabase
      .from("modules")
      .select("*")
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
    return data.map(mapModuleRow);
  } catch (error) {
    console.error("Failed module fetch from Supabase:", error);
    throw error;
  }
}

export async function replaceModulesForCourse(courseId, modules) {
  if (!isSupabaseConfigured) {
    return updateMockModules(courseId, modules);
  }

  const { error: deleteError } = await supabase.from("modules").delete().eq("course_id", courseId);
  if (deleteError) {
    console.error("Failed to clear existing modules in Supabase:", deleteError);
    throw deleteError;
  }

  if (!modules.length) return [];

  const rows = modules.map((module, index) => toModuleRow(courseId, module, index + 1));
  console.log("Final module object sent to Supabase:", rows);
  const { data, error } = await supabase
    .from("modules")
    .insert(rows)
    .select("*");

  if (error) {
    console.error("Failed to insert modules in Supabase:", error);
    throw error;
  }

  const mapped = (data ?? []).map(mapModuleRow);
  console.log("Created module response:", mapped);
  mapped.forEach((module, index) => {
    const source = modules[index];
    const sourcePdfUrl = source?.pdf_url || source?.pdfUrl;
    const sourceVideoUrl = source?.video_url || source?.videoUrl || source?.video?.url || source?.video?.link;
    if (sourcePdfUrl && !module.pdf_url) console.error("Module save succeeded but pdf_url is missing:", module);
    if (sourceVideoUrl && !module.video_url) console.error("Module save succeeded but video_url is missing:", module);
  });
  return mapped;
}
