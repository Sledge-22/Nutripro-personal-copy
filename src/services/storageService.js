import { isSupabaseConfigured, supabase, supabaseUrl } from "../lib/supabaseClient.js";

const PDF_BUCKET = "module-pdfs";
const VIDEO_BUCKET = "module-videos";

function createFallbackUploadResult(bucket, file, pathPrefix) {
  const fileName = typeof file === "string" ? file : file?.name || "upload-placeholder";
  const storagePath = `${pathPrefix}/${Date.now()}-${fileName}`;
  return {
    bucket,
    storagePath,
    fileName,
    publicUrl: null,
    mock: true,
  };
}

function buildPublicUrl(bucket, path) {
  if (!supabaseUrl || !bucket || !path) return "";
  const encodedPath = path
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");

  return `${supabaseUrl}/storage/v1/object/public/${bucket}/${encodedPath}`;
}

async function uploadToBucket(bucket, file, pathPrefix) {
  if (!isSupabaseConfigured) {
    return createFallbackUploadResult(bucket, file, pathPrefix);
  }

  if (!(file instanceof File || file?.name)) {
    throw new Error("A real file is required for upload.");
  }

  const fileName = file.name || "upload-placeholder";
  const storagePath = `${pathPrefix}/${Date.now()}-${fileName}`;
  const { error } = await supabase.storage.from(bucket).upload(storagePath, file, { upsert: true });
  if (error) {
    console.error(`Supabase upload failed for bucket ${bucket}:`, error);
    throw error;
  }

  const publicUrl = buildPublicUrl(bucket, storagePath);

  console.log(`Supabase upload result for ${bucket}:`, {
    bucket,
    fileName,
    storagePath,
    publicUrl,
  });

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
    storagePath,
    fileName,
    publicUrl,
    mock: false,
  };
}

export async function uploadModulePdf(file, moduleId = "module") {
  return uploadToBucket(PDF_BUCKET, file, "pdfs");
}

export async function uploadModuleVideo(file, moduleId = "module") {
  return uploadToBucket(VIDEO_BUCKET, file, "videos");
}
