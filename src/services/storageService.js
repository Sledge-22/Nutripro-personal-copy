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

async function uploadToBucket(bucket, file, pathPrefix) {
  if (!isSupabaseConfigured) {
    return createFallbackUploadResult(bucket, file, pathPrefix);
  }

  try {
    const fileName = file?.name || "upload-placeholder";
    const path = `${pathPrefix}/${Date.now()}-${fileName}`;

    // TODO(database): Use real uploaded files from the UI once PDF and video uploads are connected.
    const { error } = await supabase.storage.from(bucket).upload(path, file, {
      upsert: true,
    });
    if (error) throw error;

    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return {
      bucket,
      path,
      fileName,
      publicUrl: data.publicUrl,
      mock: false,
    };
  } catch {
    return createFallbackUploadResult(bucket, file, pathPrefix);
  }
}

export async function uploadModulePdf(file, moduleId = "module") {
  return uploadToBucket(PDF_BUCKET, file, `modules/${moduleId}/pdfs`);
}

export async function uploadModuleVideo(file, moduleId = "module") {
  return uploadToBucket(VIDEO_BUCKET, file, `modules/${moduleId}/videos`);
}
