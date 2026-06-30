import { isSupabaseConfigured, supabase } from "../lib/supabaseClient.js";
import { getMockCourses } from "./mockStore.js";

function mapModuleRow(module) {
  return {
    id: module.id,
    courseId: module.course_id ?? module.courseId,
    title: module.title ?? "",
    description: module.description ?? "",
    pdfLabel: module.pdf_label ?? module.pdfLabel ?? "No PDF selected",
    video: {
      id: module.video_id ?? module.video?.id ?? module.id,
      title: module.video_title ?? module.video?.title ?? "",
      description: module.video_description ?? module.video?.description ?? "",
      duration: module.video_duration ?? module.video?.duration ?? "10 min",
      link: module.video_link ?? module.video?.link ?? "",
      uploadLabel: module.video_upload_label ?? module.video?.uploadLabel ?? "No video selected",
    },
  };
}

export async function getModulesByCourse(courseId) {
  if (!isSupabaseConfigured) {
    const course = getMockCourses().find((entry) => entry.id === courseId);
    return course?.modules ?? [];
  }

  try {
    // TODO(database): Align selected columns with the final Supabase modules table schema.
    const { data, error } = await supabase.from("modules").select("*").eq("course_id", courseId).order("id", { ascending: true });
    if (error) throw error;
    return (data ?? []).map(mapModuleRow);
  } catch {
    const course = getMockCourses().find((entry) => entry.id === courseId);
    return course?.modules ?? [];
  }
}
