import { isSupabaseConfigured, supabase } from "../lib/supabaseClient.js";
import { getMockUsers, setMockUsers } from "./mockStore.js";

export const DEMO_STUDENT_NAME = "Maya Laurent";
export const DEMO_STUDENT_EMAIL = "maya@nutripro.demo";

const DEMO_STUDENT_ROLE = "student";
const DEMO_STUDENT_STATUS = "active";
const OPTIONAL_USER_COLUMNS = ["profile_picture_url", "country", "bio"];

function toDisplayCase(value, fallback) {
  const normalizedValue = `${value ?? fallback}`.trim();
  if (!normalizedValue) return fallback;
  return normalizedValue.charAt(0).toUpperCase() + normalizedValue.slice(1).toLowerCase();
}

function normalizeOptionalString(value) {
  const normalizedValue = `${value ?? ""}`.trim();
  return normalizedValue || "";
}

function normalizeUser(row) {
  return {
    id: row.id,
    name: row.name ?? row.full_name ?? row.display_name ?? "Unknown user",
    email: row.email ?? "",
    status: toDisplayCase(row.status, "Active"),
    role: toDisplayCase(row.role ?? row.user_role, "Student"),
    country: normalizeOptionalString(row.country),
    bio: normalizeOptionalString(row.bio),
    profilePictureUrl: row.profile_picture_url ?? row.profilePictureUrl ?? "",
    profile_picture_url: row.profile_picture_url ?? row.profilePictureUrl ?? "",
    createdAt: row.created_at ?? row.createdAt ?? "",
    created_at: row.created_at ?? row.createdAt ?? "",
  };
}

function normalizeUserUpdate(updates = {}) {
  const payload = {};

  if ("name" in updates) payload.name = normalizeOptionalString(updates.name) || null;
  if ("role" in updates) payload.role = `${updates.role ?? ""}`.trim().toLowerCase() || null;
  if ("status" in updates) payload.status = `${updates.status ?? ""}`.trim().toLowerCase() || null;
  if ("country" in updates) payload.country = normalizeOptionalString(updates.country) || null;
  if ("bio" in updates) payload.bio = normalizeOptionalString(updates.bio) || null;
  if ("profile_picture_url" in updates || "profilePictureUrl" in updates) {
    payload.profile_picture_url = normalizeOptionalString(updates.profile_picture_url ?? updates.profilePictureUrl) || null;
  }

  return payload;
}

function findDemoStudent(users = []) {
  return users.find((user) => user.email?.toLowerCase() === DEMO_STUDENT_EMAIL || user.name === DEMO_STUDENT_NAME) ?? null;
}

function updateMockUsers(userId, updater) {
  const users = getMockUsers().map((user) => (String(user.id) === String(userId) ? updater(user) : user));
  setMockUsers(users);
  return users.find((user) => String(user.id) === String(userId)) ?? null;
}

async function runUserMutationWithFallback(operation, payload, attempt = 0) {
  const { data, error } = await operation(payload);
  if (!error) return data;

  const columnName = OPTIONAL_USER_COLUMNS.find(
    (column) =>
      column in payload &&
      (error.message?.includes(`'${column}'`) ||
        error.message?.includes(`users.${column}`) ||
        error.details?.includes(column) ||
        error.hint?.includes(column)),
  );

  if (columnName && attempt < OPTIONAL_USER_COLUMNS.length) {
    const nextPayload = { ...payload };
    delete nextPayload[columnName];
    console.warn(`Retrying user mutation without optional column ${columnName}. Run the matching SQL later to enable it.`);
    return runUserMutationWithFallback(operation, nextPayload, attempt + 1);
  }

  throw error;
}

export async function getUsers() {
  if (!isSupabaseConfigured) return getMockUsers().map(normalizeUser);

  try {
    const { data, error } = await supabase.from("users").select("*").order("id", { ascending: true });
    if (error) throw error;
    return (data ?? []).map(normalizeUser);
  } catch (error) {
    console.error("Loading users from Supabase failed. Falling back to mock users:", error);
    return getMockUsers().map(normalizeUser);
  }
}

export async function getUserById(userId) {
  if (!userId) return null;

  if (!isSupabaseConfigured) {
    const user = getMockUsers().find((user) => String(user.id) === String(userId)) ?? null;
    return user ? normalizeUser(user) : null;
  }

  const { data, error } = await supabase.from("users").select("*").eq("id", userId).maybeSingle();
  if (error) {
    console.error("Loading the selected user failed:", error);
    throw error;
  }

  return data ? normalizeUser(data) : null;
}

export async function updateUserStatus(userId, status) {
  const nextStatus = `${status ?? ""}`.trim().toLowerCase();

  if (!isSupabaseConfigured) {
    return normalizeUser(updateMockUsers(userId, (user) => ({ ...user, status: toDisplayCase(nextStatus, "Active") })));
  }

  try {
    const data = await runUserMutationWithFallback(
      (payload) =>
        supabase
          .from("users")
          .update(payload)
          .eq("id", userId)
          .select("*")
          .single(),
      { status: nextStatus },
    );

    return normalizeUser(data);
  } catch (error) {
    console.error("Updating the user status in Supabase failed. Falling back to mock data:", error);
    return normalizeUser(updateMockUsers(userId, (user) => ({ ...user, status: toDisplayCase(nextStatus, "Active") })));
  }
}

export async function updateUser(userId, updates = {}) {
  const payload = normalizeUserUpdate(updates);

  if (!isSupabaseConfigured) {
    return normalizeUser(
      updateMockUsers(userId, (user) => ({
        ...user,
        ...payload,
        status: payload.status ? toDisplayCase(payload.status, user.status ?? "Active") : user.status,
        role: payload.role ? toDisplayCase(payload.role, user.role ?? "Student") : user.role,
      })),
    );
  }

  const data = await runUserMutationWithFallback(
    (nextPayload) =>
      supabase
        .from("users")
        .update(nextPayload)
        .eq("id", userId)
        .select("*")
        .single(),
    payload,
  );

  return normalizeUser(data);
}

export async function updateStudentProfile(studentId, updates = {}) {
  return updateUser(studentId, updates);
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
      country: "",
      bio: "",
      profile_picture_url: "",
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

  const dataRow = await runUserMutationWithFallback(
    (payload) => supabase.from("users").insert([payload]).select("*").single(),
    {
      name: DEMO_STUDENT_NAME,
      email: DEMO_STUDENT_EMAIL,
      role: DEMO_STUDENT_ROLE,
      status: DEMO_STUDENT_STATUS,
      country: null,
      bio: null,
      profile_picture_url: null,
    },
  );

  return normalizeUser(dataRow);
}

export async function deleteUser(userId) {
  if (!isSupabaseConfigured) {
    setMockUsers(getMockUsers().filter((user) => String(user.id) !== String(userId)));
    return true;
  }

  try {
    const { error } = await supabase.from("users").delete().eq("id", userId);
    if (error) throw error;
    return true;
  } catch (error) {
    console.error("Deleting the user in Supabase failed. Falling back to mock cleanup:", error);
    setMockUsers(getMockUsers().filter((user) => String(user.id) !== String(userId)));
    return true;
  }
}
