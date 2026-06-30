import { isSupabaseConfigured, supabase } from "../lib/supabaseClient.js";
import { getMockUsers, setMockUsers } from "./mockStore.js";

export async function getUsers() {
  if (!isSupabaseConfigured) return getMockUsers();

  try {
    // TODO(database): Align selected columns with the final Supabase users table schema.
    const { data, error } = await supabase.from("users").select("*").order("id", { ascending: true });
    if (error) throw error;
    return data ?? [];
  } catch {
    return getMockUsers();
  }
}

export async function updateUserStatus(userId, status) {
  if (!isSupabaseConfigured) {
    const users = getMockUsers().map((user) => user.id === userId ? { ...user, status } : user);
    setMockUsers(users);
    return users.find((user) => user.id === userId) ?? null;
  }

  try {
    // TODO(database): Update user status against the final Supabase users table schema.
    const { data, error } = await supabase.from("users").update({ status }).eq("id", userId).select().single();
    if (error) throw error;
    return data;
  } catch {
    const users = getMockUsers().map((user) => user.id === userId ? { ...user, status } : user);
    setMockUsers(users);
    return users.find((user) => user.id === userId) ?? null;
  }
}

export async function deleteUser(userId) {
  if (!isSupabaseConfigured) {
    const users = getMockUsers().filter((user) => user.id !== userId);
    setMockUsers(users);
    return true;
  }

  try {
    // TODO(database): Delete users against the final Supabase users table schema.
    const { error } = await supabase.from("users").delete().eq("id", userId);
    if (error) throw error;
    return true;
  } catch {
    const users = getMockUsers().filter((user) => user.id !== userId);
    setMockUsers(users);
    return true;
  }
}
