import { isSupabaseConfigured, supabase } from "../lib/supabaseClient.js";

const SITE_ACCESS_MODE_KEY = "site_access_mode";
const DEFAULT_SITE_ACCESS_MODE = "demo";

function normalizeSiteAccessMode(value) {
  return `${value ?? ""}`.trim().toLowerCase() === "production" ? "production" : "demo";
}

export async function getSiteAccessMode() {
  if (!isSupabaseConfigured || !supabase) return DEFAULT_SITE_ACCESS_MODE;

  const { data, error } = await supabase
    .from("site_settings")
    .select("value")
    .eq("key", SITE_ACCESS_MODE_KEY)
    .maybeSingle();

  if (error) {
    console.error("Loading the site access mode failed:", error);
    return DEFAULT_SITE_ACCESS_MODE;
  }

  return normalizeSiteAccessMode(data?.value);
}

export async function updateSiteAccessMode(nextMode, updatedBy = null) {
  const normalizedMode = normalizeSiteAccessMode(nextMode);

  if (!isSupabaseConfigured || !supabase) {
    return normalizedMode;
  }

  const payload = {
    key: SITE_ACCESS_MODE_KEY,
    value: normalizedMode,
    updated_at: new Date().toISOString(),
    updated_by: updatedBy || null,
  };

  const { error } = await supabase.from("site_settings").upsert(payload, { onConflict: "key" });
  if (error) {
    console.error("Updating the site access mode failed:", error);
    throw error;
  }

  return normalizedMode;
}

