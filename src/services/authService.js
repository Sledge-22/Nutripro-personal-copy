import { isSupabaseConfigured, supabase } from "../lib/supabaseClient.js";
import {
  getUserProfileForAuthUser,
  markPasswordChanged,
  recordUserLogin,
  resolveLoginEmail,
} from "./userService.js";

function normalizeIdentifier(identifier) {
  return `${identifier ?? ""}`.trim();
}

export function isAuthConfigured() {
  return isSupabaseConfigured;
}

export async function getCurrentSession() {
  if (!isSupabaseConfigured || !supabase) {
    return { session: null };
  }

  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return { session: data.session ?? null };
}

export function subscribeToAuthChanges(listener) {
  if (!isSupabaseConfigured || !supabase) {
    return { unsubscribe: () => {} };
  }

  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    listener(session ?? null);
  });

  return {
    unsubscribe: () => data.subscription.unsubscribe(),
  };
}

export async function signInWithCredentials(identifier, password) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Supabase Auth is not configured.");
  }

  const normalizedIdentifier = normalizeIdentifier(identifier);
  const normalizedPassword = `${password ?? ""}`;

  if (!normalizedIdentifier || !normalizedPassword) {
    throw new Error("Email/username and password are required.");
  }

  const email = await resolveLoginEmail(normalizedIdentifier);
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: normalizedPassword,
  });

  if (error) throw error;

  const profile = await getUserProfileForAuthUser(data.user);
  if (profile?.id) {
    try {
      await recordUserLogin(profile.id);
    } catch (loginRecordError) {
      console.error("Recording the latest login timestamp failed:", loginRecordError);
    }
  }

  return {
    session: data.session ?? null,
    user: data.user ?? null,
    profile,
  };
}

export async function signOut() {
  if (!isSupabaseConfigured || !supabase) return;

  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function changePassword(userId, nextPassword) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Supabase Auth is not configured.");
  }

  const normalizedPassword = `${nextPassword ?? ""}`;
  if (normalizedPassword.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }

  const { data, error } = await supabase.auth.updateUser({ password: normalizedPassword });
  if (error) throw error;

  if (userId) {
    await markPasswordChanged(userId);
  }

  const profile = data.user ? await getUserProfileForAuthUser(data.user) : null;
  return {
    user: data.user ?? null,
    profile,
  };
}
