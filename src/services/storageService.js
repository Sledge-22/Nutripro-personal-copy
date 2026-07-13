import { isSupabaseConfigured, supabase, supabaseUrl } from "../lib/supabaseClient.js";

const PDF_BUCKET = "module-pdfs";
const VIDEO_BUCKET = "module-videos";
const ASSIGNMENT_BUCKET = "assignment-submissions";
const PROFILE_PICTURE_BUCKET = "profile-pictures";
const COURSE_IMAGE_BUCKET = "course-images";
const COMMUNITY_PDF_BUCKET = "community-pdfs";

const sanitizeFileName = (name) => {
  const parts = name.split(".");
  const extension = parts.length > 1 ? parts.pop().toLowerCase() : "";
  const baseName = parts.join(".") || "file";

  const safeBaseName = baseName
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return extension ? `${safeBaseName}.${extension}` : safeBaseName;
};

function buildPublicUrl(bucket, path) {
  if (!supabaseUrl || !bucket || !path) return "";
  const encodedPath = path
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");

  return `${supabaseUrl}/storage/v1/object/public/${bucket}/${encodedPath}`;
}

export function getStoragePublicUrl(bucket, path) {
  return buildPublicUrl(bucket, path);
}

async function uploadToBucket(bucket, file, pathPrefix, options = {}) {
  if (!isSupabaseConfigured) {
    const fileName = file?.name || "upload-placeholder";
    const safeName = sanitizeFileName(fileName);
    const storagePath = `${pathPrefix}/mock-${Date.now()}-${safeName}`;
    const publicUrl =
      typeof URL !== "undefined" && typeof URL.createObjectURL === "function" ? URL.createObjectURL(file) : "";

    return {
      bucket,
      storagePath,
      fileName,
      publicUrl,
      fileType: file?.type || "",
      fileSize: typeof file?.size === "number" ? file.size : null,
      mock: true,
    };
  }

  if (!(file instanceof File || file?.name)) {
    throw new Error("A real file is required for upload.");
  }

  const fileName = file.name || "upload-placeholder";
  const safeName = sanitizeFileName(fileName);
  const storagePath = `${pathPrefix}/${Date.now()}-${safeName}`;
  console.log(`[Storage] uploading to bucket ${bucket}`, storagePath);
  const { data, error } = await supabase.storage.from(bucket).upload(storagePath, file, {
    upsert: true,
    contentType: options.contentType,
  });
  console.log(`[Storage] upload result for ${bucket}`, data, error);
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
    fileType: file?.type || "",
    fileSize: typeof file?.size === "number" ? file.size : null,
    mock: false,
  };
}

export async function uploadModulePdf(file, moduleId = "module") {
  return uploadToBucket(PDF_BUCKET, file, "pdfs");
}

export async function uploadModuleVideo(file, moduleId = "module") {
  return uploadToBucket(VIDEO_BUCKET, file, "videos");
}

export async function uploadAssignmentFile(file) {
  return uploadToBucket(ASSIGNMENT_BUCKET, file, "submissions");
}

export async function uploadProfilePicture(file) {
  return uploadToBucket(PROFILE_PICTURE_BUCKET, file, "profiles");
}

export async function uploadCourseImage(file) {
  return uploadToBucket(COURSE_IMAGE_BUCKET, file, "courses");
}

export async function uploadCommunityPdf(file, postId = "post") {
  if (!postId) {
    throw new Error("Post ID was missing before PDF upload.");
  }
  console.log("[Community PDF] starting upload");
  console.log("[Community PDF] selected file:", {
    name: file?.name,
    type: file?.type,
    size: file?.size,
  });
  console.log("[Community PDF] bucket:", COMMUNITY_PDF_BUCKET);
  console.log("[Community PDF] post id:", postId);
  return uploadToBucket(COMMUNITY_PDF_BUCKET, file, `community-posts/${postId}`, { contentType: "application/pdf" });
}
