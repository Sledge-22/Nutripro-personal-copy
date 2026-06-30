import { configuredSupabaseUrl, isSupabaseConfigured, supabase } from "../lib/supabaseClient.js";

const PDF_BUCKET = "module-pdfs";
const VIDEO_BUCKET = "module-videos";

function createFallbackUploadResult(bucket, file, pathPrefix) {
  const fileName = typeof file === "string" ? file : file?.name || "upload-placeholder";
  return {
    bucket,
    path: `${pathPrefix}/${Date.now()}-${fileName}`,
    fileName,
    publicUrl: null,
    mock: true,
  };
}

function createSafeFileName(fileName) {
  return fileName.toLowerCase().replace(/[^a-z0-9.\-_]+/g, "-");
}

function buildPublicStorageUrl(bucket, path) {
  if (!configuredSupabaseUrl || !bucket || !path) return "";
  const encodedPath = path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  return `${configuredSupabaseUrl}/storage/v1/object/public/${bucket}/${encodedPath}`;
}

async function uploadToBucket(bucket, file, pathPrefix) {
  if (!isSupabaseConfigured) {
    return createFallbackUploadResult(bucket, file, pathPrefix);
  }

  if (!(file instanceof File || file?.name)) {
    throw new Error("A real file is required for upload.");
  }

  const fileName = file.name || "upload-placeholder";
  const path = `${pathPrefix}/${Date.now()}-${createSafeFileName(fileName)}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
  if (error) {
    console.error(`Supabase upload failed for bucket ${bucket}:`, error);
    throw error;
  }

  const publicUrlResponse = supabase.storage.from(bucket).getPublicUrl(path);
  const responseUrl = publicUrlResponse?.data?.publicUrl ?? "";
  const fallbackUrl = buildPublicStorageUrl(bucket, path);
  const publicUrl = responseUrl || fallbackUrl;

  console.log(`Supabase getPublicUrl response for ${bucket}:`, publicUrlResponse);
  console.log(`Supabase upload result for ${bucket}:`, { bucket, path, fileName, responseUrl, fallbackUrl, publicUrl });

  if (!publicUrl) {
    const urlError = new Error(
      `Failed to resolve public URL for ${bucket} upload. Make sure the ${bucket} storage bucket exists and is public.`,
    );
    console.error(urlError);
    throw urlError;
  }
  console.log(`Supabase upload public URL resolved for ${bucket}:`, publicUrl);
  return {
    bucket,
    path,
    fileName,
    publicUrl,
    mock: false,
  };
}

export async function uploadModulePdf(file, moduleId = "module") {
  return uploadToBucket(PDF_BUCKET, file, `modules/${moduleId}/pdfs`);
}

export async function uploadModuleVideo(file, moduleId = "module") {
  return uploadToBucket(VIDEO_BUCKET, file, `modules/${moduleId}/videos`);
}
