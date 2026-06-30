import { isSupabaseConfigured, supabase } from "../lib/supabaseClient.js";
import { getMockUsers, setMockUsers } from "./mockStore.js";

function normalizeUser(row) {
  return {
    id: row.id,
    name: row.name ?? row.full_name ?? row.display_name ?? "Unknown user",
    email: row.email ?? "",
    status: row.status ?? "Active",
    role: row.role ?? row.user_role ?? "Student",
  };
}

function updateMockUsers(userId, updater) {
  const users = getMockUsers().map((user) => user.id === userId ? updater(user) : user);
  setMockUsers(users);
  return users.find((user) => user.id === userId) ?? null;
}

export async function getUsers() {
  if (!isSupabaseConfigured) return getMockUsers();

  try {
    const { data, error } = await supabase.from("users").select("*").order("id", { ascending: true });
    if (error) throw error;
    return (data ?? []).map(normalizeUser);
  } catch {
    return getMockUsers();
  }
}

export async function updateUserStatus(userId, status) {
  if (!isSupabaseConfigured) {
    return updateMockUsers(userId, (user) => ({ ...user, status }));
  }

  try {
    const { data, error } = await supabase
      .from("users")
      .update({ status })
      .eq("id", userId)
      .select("*")
      .single();

    if (error) throw error;
    return normalizeUser(data);
  } catch {
    return updateMockUsers(userId, (user) => ({ ...user, status }));
  }
}

export async function deleteUser(userId) {
  if (!isSupabaseConfigured) {
    setMockUsers(getMockUsers().filter((user) => user.id !== userId));
    return true;
  }

  try {
    const { error } = await supabase.from("users").delete().eq("id", userId);
    if (error) throw error;
    return true;
  } catch {
    setMockUsers(getMockUsers().filter((user) => user.id !== userId));
    return true;
  }
}
