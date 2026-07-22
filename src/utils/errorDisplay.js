export function extractErrorDetails(error) {
  if (!error) return "";
  if (typeof error === "string") return error.trim();

  const parts = [error.message, error.details, error.hint].filter(
    (value) => typeof value === "string" && value.trim(),
  );

  if (error.code) {
    parts.push(`Code: ${error.code}`);
  }

  if (parts.length) {
    return parts.join(" ");
  }

  try {
    return JSON.stringify(error);
  } catch {
    return "";
  }
}

export function sanitizeErrorDetails(error) {
  const details = typeof error === "string" ? error : extractErrorDetails(error);
  if (!details) return "";

  return details
    .replace(/(service[_ -]?role[_ -]?key\s*[:=]\s*)([^,\s]+)/gi, "$1[redacted]")
    .replace(/(anon[_ -]?key\s*[:=]\s*)([^,\s]+)/gi, "$1[redacted]")
    .replace(/(publishable[_ -]?key\s*[:=]\s*)([^,\s]+)/gi, "$1[redacted]")
    .replace(/(api[_ -]?key\s*[:=]\s*)([^,\s]+)/gi, "$1[redacted]")
    .replace(/(token\s*[:=]\s*)([^,\s]+)/gi, "$1[redacted]")
    .replace(/(secret\s*[:=]\s*)([^,\s]+)/gi, "$1[redacted]")
    .replace(/(password\s*[:=]\s*)([^,\s]+)/gi, "$1[redacted]");
}

export function buildUserFacingError(error, fallbackMessage, options = {}) {
  const rawDetails = extractErrorDetails(error);
  const normalized = rawDetails.toLowerCase();

  if (
    options.setupMessage &&
    (normalized.includes("does not exist") || normalized.includes("42703") || normalized.includes("schema cache"))
  ) {
    return options.setupMessage;
  }

  if (
    options.edgeFunctionMessage &&
    (normalized.includes("edge function") ||
      normalized.includes("non-2xx") ||
      normalized.includes("supabase function") ||
      normalized.includes("function"))
  ) {
    return options.edgeFunctionMessage;
  }

  if (
    options.permissionMessage &&
    (normalized.includes("permission denied") ||
      normalized.includes("row-level security") ||
      normalized.includes("violates row-level security") ||
      normalized.includes("not allowed"))
  ) {
    return options.permissionMessage;
  }

  return fallbackMessage;
}

export function buildAdminErrorState(error, fallbackMessage, options = {}) {
  return {
    message: buildUserFacingError(error, fallbackMessage, options),
    details: extractErrorDetails(error),
  };
}
