import { isSupabaseConfigured, supabase } from "../lib/supabaseClient.js";
import { getMockUsers, setMockUsers } from "./mockStore.js";

export const DEMO_STUDENT_NAME = "Maya Laurent";
export const DEMO_STUDENT_EMAIL = "maya@nutripro.demo";

const DEMO_STUDENT_ROLE = "student";
const DEMO_STUDENT_STATUS = "active";

function toDisplayCase(value, fallback) {
  const normalizedValue = `${value ?? fallback}`.trim();
  if (!normalizedValue) return fallback;
  return normalizedValue.charAt(0).toUpperCase() + normalizedValue.slice(1).toLowerCase();
}

function normalizeUser(row) {
  return {
    id: row.id,
    name: row.name ?? row.full_name ?? row.display_name ?? "Unknown user",
    email: row.email ?? "",
    status: toDisplayCase(row.status, "Active"),
    role: toDisplayCase(row.role ?? row.user_role, "Student"),
  };
}

function findDemoStudent(users = []) {
  return users.find((user) => user.email?.toLowerCase() === DEMO_STUDENT_EMAIL || user.name === DEMO_STUDENT_NAME) ?? null;
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

export async function ensureDemoStudent() {
  if (!isSupabaseConfigured) {
    const mockUsers = getMockUsers();
    const existingUser = findDemoStudent(mockUsers);
    if (existingUser) return normalizeUser(existingUser);

    const nextUser = {
      id: Math.max(0, ...mockUsers.map((user) => user.id ?? 0)) + 1,
      name: DEMO_STUDENT_NAME,
      email: DEMO_STUDENT_EMAIL,
      role: DEMO_STUDENT_ROLE,
      status: DEMO_STUDENT_STATUS,
    };

    setMockUsers([...mockUsers, nextUser]);
    return normalizeUser(nextUser);
  }

  const { data, error } = await supabase.from("users").select("*").eq("email", DEMO_STUDENT_EMAIL).limit(1);
  if (error) {
    console.error("Failed to load Maya Laurent from Supabase users:", error);
    throw error;
  }

  const existingUser = findDemoStudent(data ?? []);
  if (existingUser) return normalizeUser(existingUser);

  console.error("Maya Laurent was missing in Supabase users. Creating the demo student now.");

  const { data: createdUser, error: createError } = await supabase
    .from("users")
    .insert([
      {
        name: DEMO_STUDENT_NAME,
        email: DEMO_STUDENT_EMAIL,
        role: DEMO_STUDENT_ROLE,
        status: DEMO_STUDENT_STATUS,
      },
    ])
    .select("*")
    .single();

  if (createError) {
    console.error("Failed to create Maya Laurent in Supabase users:", createError);
    throw createError;
  }

  return normalizeUser(createdUser);
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
