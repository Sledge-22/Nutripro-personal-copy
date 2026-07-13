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

export function toYouTubeEmbedUrl(url) {
  const value = `${url ?? ""}`.trim();
  if (!value) return "";

  const match =
    value.match(/[?&]v=([^&]+)/i) ||
    value.match(/youtu\.be\/([^?&/]+)/i) ||
    value.match(/youtube\.com\/embed\/([^?&/]+)/i);

  return match?.[1] ? `https://www.youtube.com/embed/${match[1]}` : "";
}

export function isVimeoUrl(url) {
  const value = `${url ?? ""}`.trim();
  if (!value) return false;

  try {
    const parsed = new URL(value);
    return parsed.hostname === "vimeo.com" || parsed.hostname === "www.vimeo.com" || parsed.hostname === "player.vimeo.com";
  } catch {
    return value.includes("vimeo.com") || value.includes("player.vimeo.com");
  }
}

export function extractVimeoVideoId(url) {
  const value = `${url ?? ""}`.trim();
  if (!value || !isVimeoUrl(value)) return "";

  const patterns = [
    /player\.vimeo\.com\/video\/(\d+)/i,
    /vimeo\.com\/showcase\/\d+\/video\/(\d+)/i,
    /vimeo\.com\/(\d+)/i,
  ];

  for (const pattern of patterns) {
    const match = value.match(pattern);
    if (match?.[1]) return match[1];
  }

  return "";
}

export function toVimeoEmbedUrl(url) {
  const value = `${url ?? ""}`.trim();
  if (!value) return "";

  const videoId = extractVimeoVideoId(value);
  if (!videoId) return "";

  try {
    const parsed = new URL(value);
    const isPlayerUrl = parsed.hostname === "player.vimeo.com" && parsed.pathname.includes(`/video/${videoId}`);
    const suffix = isPlayerUrl ? `${parsed.search}${parsed.hash}` : "";
    return `https://player.vimeo.com/video/${videoId}${suffix}`;
  } catch {
    return `https://player.vimeo.com/video/${videoId}`;
  }
}

export function getEmbeddableVideoUrl(url) {
  const value = `${url ?? ""}`.trim();
  if (!value) return "";

  return (
    toYouTubeEmbedUrl(value) ||
    toVimeoEmbedUrl(value) ||
    (isGoogleDriveUrl(value) ? toGoogleDrivePreviewUrl(value) : "")
  );
}

export function getEmbeddablePdfUrl(url) {
  const value = `${url ?? ""}`.trim();
  if (!value) return "";

  if (isGoogleDriveUrl(value)) return toGoogleDrivePreviewUrl(value);
  if (isDirectPdfUrl(value)) return value;
  return "";
}
