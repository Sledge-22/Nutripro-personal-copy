export function isGoogleDriveUrl(url) {
  const value = `${url ?? ""}`.trim();
  if (!value) return false;

  try {
    const parsed = new URL(value);
    return parsed.hostname === "drive.google.com" || parsed.hostname === "docs.google.com";
  } catch {
    return value.includes("drive.google.com") || value.includes("docs.google.com");
  }
}

export function extractGoogleDriveFileId(url) {
  const value = `${url ?? ""}`.trim();
  if (!value || !isGoogleDriveUrl(value)) return null;

  const patterns = [
    /\/file\/d\/([^/]+)/i,
    /[?&]id=([^&]+)/i,
    /\/d\/([^/]+)/i,
  ];

  for (const pattern of patterns) {
    const match = value.match(pattern);
    if (match?.[1]) return match[1];
  }

  return null;
}

export function toGoogleDrivePreviewUrl(url) {
  const fileId = extractGoogleDriveFileId(url);
  if (!fileId) return `${url ?? ""}`.trim();
  return `https://drive.google.com/file/d/${fileId}/preview`;
}

export function isDirectPdfUrl(url) {
  const value = `${url ?? ""}`.trim().toLowerCase();
  return value.endsWith(".pdf") || value.includes(".pdf?");
}

export function isDirectVideoUrl(url) {
  const value = `${url ?? ""}`.trim().toLowerCase();
  if (!value) return false;
  return (
    value.includes("/storage/v1/object/public/") ||
    value.endsWith(".mp4") ||
    value.endsWith(".mov") ||
    value.endsWith(".webm") ||
    value.endsWith(".m4v") ||
    value.includes(".mp4?") ||
    value.includes(".mov?") ||
    value.includes(".webm?") ||
    value.includes(".m4v?")
  );
}

export function toEmbeddablePdfUrl(url) {
  const value = `${url ?? ""}`.trim();
  if (!value) return "";
  if (isGoogleDriveUrl(value)) return toGoogleDrivePreviewUrl(value);
  if (isDirectPdfUrl(value)) return value;
  return "";
}

export function toEmbeddableVideoUrl(url) {
  const value = `${url ?? ""}`.trim();
  if (!value) return "";

  const youtubeMatch =
    value.match(/[?&]v=([^&]+)/i) ||
    value.match(/youtu\.be\/([^?&/]+)/i) ||
    value.match(/youtube\.com\/embed\/([^?&/]+)/i);
  if (youtubeMatch?.[1]) {
    return `https://www.youtube.com/embed/${youtubeMatch[1]}`;
  }

  const vimeoMatch =
    value.match(/vimeo\.com\/(\d+)/i) ||
    value.match(/player\.vimeo\.com\/video\/(\d+)/i);
  if (vimeoMatch?.[1]) {
    return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
  }

  if (isGoogleDriveUrl(value)) {
    return toGoogleDrivePreviewUrl(value);
  }

  return "";
}

