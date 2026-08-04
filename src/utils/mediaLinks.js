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
    value.endsWith(".ogg") ||
    value.endsWith(".m4v") ||
    value.includes(".mp4?") ||
    value.includes(".mov?") ||
    value.includes(".webm?") ||
    value.includes(".ogg?") ||
    value.includes(".m4v?")
  );
}

export function toYouTubeEmbedUrl(url) {
  const value = `${url ?? ""}`.trim();
  if (!value) return "";

  if (/^[a-zA-Z0-9_-]{11}$/.test(value)) {
    return `https://www.youtube.com/embed/${value}`;
  }

  const match =
    value.match(/[?&]v=([^&]+)/i) ||
    value.match(/youtu\.be\/([^?&/]+)/i) ||
    value.match(/youtube\.com\/embed\/([^?&/]+)/i) ||
    value.match(/youtube\.com\/shorts\/([^?&/]+)/i);

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
  if (!value) return "";
  if (/^\d{6,}$/.test(value)) return value;
  if (!isVimeoUrl(value)) return "";

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

function firstFilledValue(...values) {
  return values.find((value) => `${value ?? ""}`.trim()) || "";
}

function isUrl(value) {
  const text = `${value ?? ""}`.trim();
  if (!text) return false;

  try {
    new URL(text);
    return true;
  } catch {
    return /^https?:\/\//i.test(text);
  }
}

function getVideoProvider(value) {
  const text = `${value ?? ""}`.trim();
  if (!text) return null;
  if (isDirectVideoUrl(text)) return "file";
  if (toVimeoEmbedUrl(text)) return "vimeo";
  if (toYouTubeEmbedUrl(text)) return "youtube";
  if (isGoogleDriveUrl(text)) return "external";
  if (isUrl(text)) return "external";
  return null;
}

export function normalizeVideoSource(module = {}) {
  const rawSource = firstFilledValue(
    module?.embed_url,
    module?.embedUrl,
    module?.video_embed_url,
    module?.videoEmbedUrl,
    module?.video_external_url,
    module?.videoExternalUrl,
    module?.external_video_url,
    module?.externalVideoUrl,
    module?.video_link,
    module?.videoLink,
    module?.video?.link,
    module?.video_url,
    module?.videoUrl,
    module?.video_file_url,
    module?.videoFileUrl,
    module?.video_public_url,
    module?.videoPublicUrl,
    module?.video?.url,
    module?.video_id,
    module?.videoId,
  );
  const src = `${rawSource ?? ""}`.trim();
  if (!src) {
    return { hasVideo: false, type: "unknown", src: "", provider: null, original: "" };
  }

  if (isDirectVideoUrl(src)) {
    return { hasVideo: true, type: "video", src, provider: "file", original: src };
  }

  const vimeoEmbed = toVimeoEmbedUrl(src);
  if (vimeoEmbed) {
    return { hasVideo: true, type: "iframe", src: vimeoEmbed, provider: "vimeo", original: src };
  }

  const youtubeEmbed = toYouTubeEmbedUrl(src);
  if (youtubeEmbed) {
    return { hasVideo: true, type: "iframe", src: youtubeEmbed, provider: "youtube", original: src };
  }

  if (isGoogleDriveUrl(src)) {
    return { hasVideo: true, type: "iframe", src: toGoogleDrivePreviewUrl(src), provider: "external", original: src };
  }

  if (isUrl(src)) {
    return { hasVideo: true, type: "external", src, provider: getVideoProvider(src), original: src };
  }

  return { hasVideo: true, type: "unknown", src, provider: null, original: src };
}

export function getEmbeddablePdfUrl(url) {
  const value = `${url ?? ""}`.trim();
  if (!value) return "";

  if (isGoogleDriveUrl(value)) return toGoogleDrivePreviewUrl(value);
  if (isDirectPdfUrl(value)) return value;
  return "";
}
