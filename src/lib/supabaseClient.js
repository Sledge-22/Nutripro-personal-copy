import { createClient } from "@supabase/supabase-js";

const rawSupabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() || "";
const supabasePublishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() || import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() || "";

function isValidSupabaseUrl(value) {
  if (!value) return false;

  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

export const supabaseUrl = isValidSupabaseUrl(rawSupabaseUrl) ? rawSupabaseUrl : "";

if (rawSupabaseUrl && !supabaseUrl) {
  console.error(
    "Invalid VITE_SUPABASE_URL. It must be a full URL like https://your-project-ref.supabase.co",
    rawSupabaseUrl,
  );
}

export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabasePublishableKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
  : null;
