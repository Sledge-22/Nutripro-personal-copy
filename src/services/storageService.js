import { isSupabaseConfigured, supabase } from "../lib/supabaseClient.js";

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

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  if (!data?.publicUrl) {
    const urlError = new Error(`Failed to resolve public URL for ${bucket} upload.`);
    console.error(urlError);
    throw urlError;
  }
  console.log(`Supabase upload public URL resolved for ${bucket}:`, data.publicUrl);
  return {
    bucket,
    path,
    fileName,
    publicUrl: data.publicUrl,
    mock: false,
  };
}

export async function uploadModulePdf(file, moduleId = "module") {
  return uploadToBucket(PDF_BUCKET, file, `modules/${moduleId}/pdfs`);
}

export async function uploadModuleVideo(file, moduleId = "module") {
  return uploadToBucket(VIDEO_BUCKET, file, `modules/${moduleId}/videos`);
}
