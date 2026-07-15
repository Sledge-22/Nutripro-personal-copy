import { isSupabaseConfigured, supabase } from "../lib/supabaseClient.js";

const SITE_ACCESS_MODE_KEY = "site_access_mode";
const DEFAULT_SITE_ACCESS_MODE = "demo";
const SITE_ACCESS_MODE_STORAGE_KEY = "nutripro_site_access_mode";

function isValidUuid(value) {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function normalizeSiteAccessMode(value) {
  return `${value ?? ""}`.trim().toLowerCase() === "production" ? "production" : "demo";
}

function readLocalSiteAccessMode() {
  if (typeof window === "undefined") return DEFAULT_SITE_ACCESS_MODE;

  try {
    return normalizeSiteAccessMode(window.localStorage.getItem(SITE_ACCESS_MODE_STORAGE_KEY));
  } catch (error) {
    console.error("Reading the local site access mode failed:", error);
    return DEFAULT_SITE_ACCESS_MODE;
  }
}

function persistLocalSiteAccessMode(mode) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(SITE_ACCESS_MODE_STORAGE_KEY, normalizeSiteAccessMode(mode));
  } catch (error) {
    console.error("Saving the local site access mode failed:", error);
  }
}

export async function getSiteAccessMode() {
  if (!isSupabaseConfigured || !supabase) return readLocalSiteAccessMode();

  const { data, error } = await supabase
    .from("site_settings")
    .select("value")
    .eq("key", SITE_ACCESS_MODE_KEY)
    .maybeSingle();

  if (error) {
    console.error("Loading the site access mode failed:", error);
    return readLocalSiteAccessMode();
  }

  return normalizeSiteAccessMode(data?.value ?? readLocalSiteAccessMode());
}

export async function updateSiteAccessMode(nextMode, updatedBy = null, options = {}) {
  const normalizedMode = normalizeSiteAccessMode(nextMode);
  const localOnly = Boolean(options.localOnly);

  if (localOnly || !isSupabaseConfigured || !supabase) {
    persistLocalSiteAccessMode(normalizedMode);
    return { mode: normalizedMode, storage: "local" };
  }

  const payload = {
    key: SITE_ACCESS_MODE_KEY,
    value: normalizedMode,
    updated_at: new Date().toISOString(),
    ...(isValidUuid(updatedBy) ? { updated_by: updatedBy } : {}),
  };

  const { error } = await supabase.from("site_settings").upsert(payload, { onConflict: "key" });
  if (error) {
    console.error("Updating the site access mode failed:", error);
    throw error;
  }

  persistLocalSiteAccessMode(normalizedMode);
  return { mode: normalizedMode, storage: "supabase" };
}
