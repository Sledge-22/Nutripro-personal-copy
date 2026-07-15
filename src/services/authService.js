import { isSupabaseConfigured, supabase } from "../lib/supabaseClient.js";
import {
  markPasswordChanged,
  finalizeUserOnboarding,
  getUserProfileForAuthUser,
  recordUserLogin,
  resolveLoginEmail,
  isUsernameAvailable,
} from "./userService.js";

function normalizeIdentifier(identifier) {
  return `${identifier ?? ""}`.trim();
}

export function validatePasswordStrength(password) {
  const value = `${password ?? ""}`;
  return (
    value.length >= 10 &&
    /[A-Z]/.test(value) &&
    /[a-z]/.test(value) &&
    /\d/.test(value) &&
    /[^A-Za-z0-9]/.test(value)
  );
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
  if (!validatePasswordStrength(normalizedPassword)) {
    throw new Error("Password must include at least 10 characters, uppercase and lowercase letters, a number, and a symbol.");
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

export async function completeFirstTimeSetup(userId, username, nextPassword, currentUsername = "") {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Supabase Auth is not configured.");
  }

  const normalizedUsername = `${username ?? ""}`.trim().toLowerCase();
  const normalizedCurrentUsername = `${currentUsername ?? ""}`.trim().toLowerCase();
  const normalizedPassword = `${nextPassword ?? ""}`;

  if (!validatePasswordStrength(normalizedPassword)) {
    throw new Error("Password must include at least 10 characters, uppercase and lowercase letters, a number, and a symbol.");
  }

  const nextUsername = normalizedUsername || normalizedCurrentUsername;
  if (normalizedUsername) {
    const available = await isUsernameAvailable(normalizedUsername, userId);
    if (!available) {
      throw new Error("Username is not available.");
    }
  }

  const { data, error } = await supabase.auth.updateUser({ password: normalizedPassword });
  if (error) throw error;

  let profile = null;
  if (userId) {
    profile = nextUsername
      ? await finalizeUserOnboarding(userId, nextUsername)
      : await markPasswordChanged(userId);
  } else if (data.user) {
    profile = await getUserProfileForAuthUser(data.user);
  }

  return {
    user: data.user ?? null,
    profile,
  };
}
