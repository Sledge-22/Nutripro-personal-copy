import { isSupabaseConfigured, supabase } from "../lib/supabaseClient.js";
import { normalizeCountrySelection } from "../data/countries.js";
import { createMockId, getMockUsers, setMockUsers } from "./mockStore.js";

export const DEMO_STUDENT_NAME = "Maya Laurent";
export const DEMO_STUDENT_EMAIL = "maya@nutripro.demo";

const DEMO_STUDENT_ROLE = "student";
const DEMO_STUDENT_STATUS = "active";
const DEMO_ADMIN_EMAIL = "admin@nutripro.demo";
const DEFAULT_ADMIN_USER_FUNCTION = "admin-user-management";
const DEFAULT_SEND_INVITATION_FUNCTION = "send-invitation-email";
const ADMIN_USER_FUNCTION =
  import.meta.env.VITE_SUPABASE_ADMIN_FUNCTION_NAME?.trim() || DEFAULT_ADMIN_USER_FUNCTION;
const SEND_INVITATION_FUNCTION =
  import.meta.env.VITE_SUPABASE_SEND_INVITATION_FUNCTION_NAME?.trim() || DEFAULT_SEND_INVITATION_FUNCTION;

const OPTIONAL_USER_COLUMNS = [
  "auth_user_id",
  "username",
  "profile_picture_url",
  "country",
  "country_code",
  "country_name",
  "country_flag",
  "bio",
  "must_change_password",
  "password_updated_at",
  "last_login_at",
  "invitation_sent_at",
  "invitation_status",
  "invitation_email_id",
  "updated_at",
];

const PROTECTED_DEMO_EMAILS = new Set([DEMO_ADMIN_EMAIL, DEMO_STUDENT_EMAIL]);

function normalizeOptionalString(value) {
  const normalizedValue = `${value ?? ""}`.trim();
  return normalizedValue || "";
}

function normalizeRoleValue(value, fallback = "student") {
  const normalizedValue = `${value ?? fallback}`.trim().toLowerCase();
  if (["admin", "student", "instructor", "support"].includes(normalizedValue)) return normalizedValue;
  return fallback;
}

function normalizeStatusValue(value, fallback = "active") {
  const normalizedValue = `${value ?? fallback}`.trim().toLowerCase();
  if (normalizedValue === "paused") return "suspended";
  if (["active", "inactive", "suspended"].includes(normalizedValue)) return normalizedValue;
  return fallback;
}

function toDisplayCase(value, fallback) {
  const normalizedValue = `${value ?? fallback}`.trim();
  if (!normalizedValue) return fallback;
  return normalizedValue.charAt(0).toUpperCase() + normalizedValue.slice(1).toLowerCase();
}

function toDisplayRole(role) {
  return toDisplayCase(normalizeRoleValue(role), "Student");
}

function toDisplayStatus(status) {
  return toDisplayCase(normalizeStatusValue(status), "Active");
}

function nowIso() {
  return new Date().toISOString();
}

function createTemporaryPassword(length = 14) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*";
  return Array.from({ length }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
}

function normalizeUser(row = {}) {
  const role = normalizeRoleValue(row.role ?? row.user_role ?? "student");
  const status = normalizeStatusValue(row.status ?? "active");
  const mustChangePassword = Boolean(row.must_change_password ?? row.mustChangePassword ?? false);
  const profilePictureUrl = row.profile_picture_url ?? row.profilePictureUrl ?? "";
  const authUserId = row.auth_user_id ?? row.authUserId ?? "";
  const privacyPolicyAccepted = Boolean(row.privacy_policy_accepted ?? row.privacyPolicyAccepted ?? false);
  const privacyPolicyAcceptedAt = row.privacy_policy_accepted_at ?? row.privacyPolicyAcceptedAt ?? "";
  const privacyPolicyVersion = row.privacy_policy_version ?? row.privacyPolicyVersion ?? "";
  const normalizedCountry = normalizeCountrySelection(
    row.country_code ?? row.countryCode ?? row.country_name ?? row.countryName ?? row.country,
  );

  return {
    id: row.id,
    authUserId,
    auth_user_id: authUserId,
    name: row.name ?? row.full_name ?? row.display_name ?? "Unknown user",
    email: row.email ?? "",
    username: row.username ?? "",
    role: toDisplayRole(role),
    roleKey: role,
    status: toDisplayStatus(status),
    statusKey: status,
    country: normalizedCountry.country || normalizeOptionalString(row.country),
    countryCode: normalizedCountry.countryCode || normalizeOptionalString(row.country_code ?? row.countryCode),
    country_code: normalizedCountry.countryCode || normalizeOptionalString(row.country_code ?? row.countryCode),
    countryName: normalizedCountry.countryName || normalizeOptionalString(row.country_name ?? row.countryName ?? row.country),
    country_name: normalizedCountry.countryName || normalizeOptionalString(row.country_name ?? row.countryName ?? row.country),
    countryFlag: normalizedCountry.countryFlag || normalizeOptionalString(row.country_flag ?? row.countryFlag),
    country_flag: normalizedCountry.countryFlag || normalizeOptionalString(row.country_flag ?? row.countryFlag),
    bio: normalizeOptionalString(row.bio),
    profilePictureUrl,
    profile_picture_url: profilePictureUrl,
    mustChangePassword,
    must_change_password: mustChangePassword,
    passwordUpdatedAt: row.password_updated_at ?? row.passwordUpdatedAt ?? "",
    password_updated_at: row.password_updated_at ?? row.passwordUpdatedAt ?? "",
    lastLoginAt: row.last_login_at ?? row.lastLoginAt ?? "",
    last_login_at: row.last_login_at ?? row.lastLoginAt ?? "",
    createdAt: row.created_at ?? row.createdAt ?? "",
    created_at: row.created_at ?? row.createdAt ?? "",
    updatedAt: row.updated_at ?? row.updatedAt ?? "",
    updated_at: row.updated_at ?? row.updatedAt ?? "",
    invitationSentAt: row.invitation_sent_at ?? row.invitationSentAt ?? "",
    invitation_sent_at: row.invitation_sent_at ?? row.invitationSentAt ?? "",
    invitationStatus: row.invitation_status ?? row.invitationStatus ?? "",
    invitation_status: row.invitation_status ?? row.invitationStatus ?? "",
    invitationEmailId: row.invitation_email_id ?? row.invitationEmailId ?? "",
    invitation_email_id: row.invitation_email_id ?? row.invitationEmailId ?? "",
    privacyPolicyAccepted,
    privacy_policy_accepted: privacyPolicyAccepted,
    privacyPolicyAcceptedAt,
    privacy_policy_accepted_at: privacyPolicyAcceptedAt,
    privacyPolicyVersion,
    privacy_policy_version: privacyPolicyVersion,
  };
}

function normalizeUserUpdate(updates = {}) {
  const payload = {};
  const hasCountryUpdate =
    "country" in updates ||
    "country_code" in updates ||
    "countryCode" in updates ||
    "country_name" in updates ||
    "countryName" in updates ||
    "country_flag" in updates ||
    "countryFlag" in updates;

  if ("name" in updates) payload.name = normalizeOptionalString(updates.name) || null;
  if ("email" in updates) payload.email = normalizeOptionalString(updates.email).toLowerCase() || null;
  if ("username" in updates) payload.username = normalizeOptionalString(updates.username).toLowerCase() || null;
  if ("role" in updates) payload.role = normalizeRoleValue(updates.role);
  if ("status" in updates) payload.status = normalizeStatusValue(updates.status);
  if (hasCountryUpdate) {
    const normalizedCountry = normalizeCountrySelection(
      updates.country_code ??
        updates.countryCode ??
        updates.country_name ??
        updates.countryName ??
        updates.country ??
        updates.country_flag ??
        updates.countryFlag,
    );
    payload.country = normalizedCountry.country || null;
    payload.country_code = normalizedCountry.countryCode || null;
    payload.country_name = normalizedCountry.countryName || null;
    payload.country_flag = normalizedCountry.countryFlag || null;
  }
  if ("bio" in updates) payload.bio = normalizeOptionalString(updates.bio) || null;
  if ("must_change_password" in updates || "mustChangePassword" in updates) {
    payload.must_change_password = Boolean(updates.must_change_password ?? updates.mustChangePassword);
  }
  if ("profile_picture_url" in updates || "profilePictureUrl" in updates) {
    payload.profile_picture_url = normalizeOptionalString(
      updates.profile_picture_url ?? updates.profilePictureUrl,
    ) || null;
  }

  payload.updated_at = nowIso();
  return payload;
}

function findDemoStudent(users = []) {
  return (
    users.find((user) => user.email?.toLowerCase() === DEMO_STUDENT_EMAIL) ??
    users.find((user) => user.name === DEMO_STUDENT_NAME) ??
    null
  );
}

function isProtectedDemoEmail(email) {
  return PROTECTED_DEMO_EMAILS.has(`${email ?? ""}`.trim().toLowerCase());
}

function updateMockUsers(userId, updater) {
  const users = getMockUsers().map((user) => (String(user.id) === String(userId) ? updater(user) : user));
  setMockUsers(users);
  return users.find((user) => String(user.id) === String(userId)) ?? null;
}

async function runUserMutationWithOptionalColumnRetry(operation, payload, attempt = 0) {
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
    console.warn(`Retrying user mutation without optional column ${columnName}. Run the auth setup SQL to enable it.`);
    return runUserMutationWithOptionalColumnRetry(operation, nextPayload, attempt + 1);
  }

  throw error;
}

function buildMockUser(payload, existingId = null) {
  const users = getMockUsers();
  const id = existingId ?? createMockId(users);
  const normalizedCountry = normalizeCountrySelection(
    payload.country_code ?? payload.countryCode ?? payload.country_name ?? payload.countryName ?? payload.country,
  );
  return {
    id,
    auth_user_id: payload.auth_user_id ?? "",
    name: payload.name ?? "New user",
    email: payload.email ?? "",
    username: payload.username ?? "",
    role: toDisplayRole(payload.role),
    status: toDisplayStatus(payload.status),
    country: normalizedCountry.country || payload.country || "",
    country_code: normalizedCountry.countryCode || payload.country_code || "",
    country_name: normalizedCountry.countryName || payload.country_name || payload.country || "",
    country_flag: normalizedCountry.countryFlag || payload.country_flag || "",
    bio: payload.bio ?? "",
    profile_picture_url: payload.profile_picture_url ?? "",
    must_change_password: Boolean(payload.must_change_password),
    password_updated_at: payload.password_updated_at ?? "",
    last_login_at: payload.last_login_at ?? "",
    created_at: payload.created_at ?? nowIso(),
    updated_at: payload.updated_at ?? nowIso(),
  };
}

async function invokeAdminUserFunction(body) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Supabase is not configured.");
  }

  const { data, error } = await supabase.functions.invoke(ADMIN_USER_FUNCTION, {
    body,
  });

  if (error) {
    console.error("Admin user function invocation failed:", error);
    const nextError = new Error("Production auth function call failed.");
    nextError.code = "PRODUCTION_AUTH_FUNCTION_ERROR";
    nextError.cause = error;
    throw nextError;
  }

  if (data?.error) {
    console.error("Admin user function returned an application error:", data.error);
    const nextError = new Error("Production auth function call failed.");
    nextError.code = "PRODUCTION_AUTH_FUNCTION_ERROR";
    nextError.cause = data.error;
    throw nextError;
  }

  return data ?? {};
}

async function invokeInvitationFunction(body) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Supabase is not configured.");
  }

  const { data, error } = await supabase.functions.invoke(SEND_INVITATION_FUNCTION, {
    body,
  });

  if (error) {
    console.error("Invitation function invocation failed:", error);
    const nextError = new Error(
      error.message ||
      error.details ||
      error.hint ||
      "Invitation function call failed.",
    );
    nextError.code = "INVITATION_FUNCTION_ERROR";
    nextError.cause = error;
    throw nextError;
  }

  if (!data?.ok) {
    const nextError = new Error(data?.error || "Invitation function call failed.");
    nextError.code = "INVITATION_FUNCTION_ERROR";
    throw nextError;
  }

  return data;
}

export async function resolveLoginEmail(identifier) {
  const normalizedIdentifier = normalizeOptionalString(identifier).toLowerCase();
  if (!normalizedIdentifier) {
    throw new Error("Email or username is required.");
  }

  if (normalizedIdentifier.includes("@")) return normalizedIdentifier;

  if (!isSupabaseConfigured || !supabase) {
    const user = getMockUsers().find((entry) => entry.username?.toLowerCase() === normalizedIdentifier);
    if (!user?.email) throw new Error("No user found with that username.");
    if (normalizeStatusValue(user.status, "active") !== "active") {
      throw new Error("Your account is not active. Please contact an administrator.");
    }
    return user.email.toLowerCase();
  }

  const { data, error } = await supabase
    .from("users")
    .select("email, username, role, status")
    .ilike("username", normalizedIdentifier)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Resolving the login email by username failed:", error);
    throw error;
  }

  if (!data?.email) {
    throw new Error("No account found for that username.");
  }

  if (data.status && normalizeStatusValue(data.status, "active") !== "active") {
    throw new Error("Your account is not active. Please contact an administrator.");
  }

  return `${data.email}`.trim().toLowerCase();
}

export async function getUsers() {
  if (!isSupabaseConfigured || !supabase) return getMockUsers().map(normalizeUser);

  const { data, error } = await supabase.from("users").select("*").order("created_at", { ascending: false });
  if (error) {
    console.error("Loading users from Supabase failed:", error);
    throw error;
  }

  return (data ?? []).map(normalizeUser);
}

export async function getUserById(userId) {
  if (!userId) return null;

  if (!isSupabaseConfigured || !supabase) {
    const user = getMockUsers().find((entry) => String(entry.id) === String(userId)) ?? null;
    return user ? normalizeUser(user) : null;
  }

  const { data, error } = await supabase.from("users").select("*").eq("id", userId).maybeSingle();
  if (error) {
    console.error("Loading the selected user failed:", error);
    throw error;
  }

  return data ? normalizeUser(data) : null;
}

export async function getUserByUsername(username) {
  const normalizedUsername = normalizeOptionalString(username).toLowerCase();
  if (!normalizedUsername) return null;

  if (!isSupabaseConfigured || !supabase) {
    const user = getMockUsers().find((entry) => entry.username?.toLowerCase() === normalizedUsername) ?? null;
    return user ? normalizeUser(user) : null;
  }

  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("username", normalizedUsername)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Loading the selected username failed:", error);
    throw error;
  }

  return data ? normalizeUser(data) : null;
}

export async function isUsernameAvailable(username, excludeUserId = null) {
  const normalizedUsername = normalizeOptionalString(username).toLowerCase();
  if (!normalizedUsername) return false;

  const existingUser = await getUserByUsername(normalizedUsername);
  if (!existingUser) return true;
  if (excludeUserId && String(existingUser.id) === String(excludeUserId)) return true;
  return false;
}

export async function getUserProfileForAuthUser(authUser) {
  if (!authUser?.id) return null;

  if (!isSupabaseConfigured || !supabase) {
    const existingUser =
      getMockUsers().find((entry) => entry.email?.toLowerCase() === authUser.email?.toLowerCase()) ?? null;
    return existingUser ? normalizeUser(existingUser) : null;
  }

  const { data: profileById, error: byIdError } = await supabase
    .from("users")
    .select("*")
    .eq("auth_user_id", authUser.id)
    .maybeSingle();

  if (byIdError) {
    console.error("Loading the signed-in profile by auth id failed:", byIdError);
    throw byIdError;
  }

  if (profileById) return normalizeUser(profileById);

  const authEmail = normalizeOptionalString(authUser.email).toLowerCase();
  if (!authEmail) {
    throw new Error("The signed-in auth user does not have an email address.");
  }

  const { data: profileByEmail, error: byEmailError } = await supabase
    .from("users")
    .select("*")
    .eq("email", authEmail)
    .limit(1)
    .maybeSingle();

  if (byEmailError) {
    console.error("Loading the signed-in profile by email failed:", byEmailError);
    throw byEmailError;
  }

  if (profileByEmail && profileByEmail.auth_user_id && String(profileByEmail.auth_user_id) !== String(authUser.id)) {
    throw new Error("This email is already linked to a different authenticated account.");
  }

  if (!profileByEmail) {
    throw new Error("No public.users profile was found for this authenticated account.");
  }

  if (!profileByEmail.auth_user_id) {
    const linkedProfile = await runUserMutationWithOptionalColumnRetry(
      (payload) =>
        supabase.from("users").update(payload).eq("id", profileByEmail.id).select("*").single(),
      {
        auth_user_id: authUser.id,
        updated_at: nowIso(),
      },
    );

    return normalizeUser(linkedProfile);
  }

  return normalizeUser(profileByEmail);
}

export async function updateUserStatus(userId, status) {
  const nextStatus = normalizeStatusValue(status);
  const existingUser = await getUserById(userId);

  if (existingUser && isProtectedDemoEmail(existingUser.email) && nextStatus !== "active") {
    const protectedError = new Error("Protected demo users cannot be deactivated.");
    protectedError.code = "PROTECTED_DEMO_USER";
    throw protectedError;
  }

  if (!isSupabaseConfigured || !supabase) {
    return normalizeUser(
      updateMockUsers(userId, (user) => ({
        ...user,
        status: toDisplayStatus(nextStatus),
        updated_at: nowIso(),
      })),
    );
  }

  const data = await runUserMutationWithOptionalColumnRetry(
    (payload) =>
      supabase.from("users").update(payload).eq("id", userId).select("*").single(),
    {
      status: nextStatus,
      updated_at: nowIso(),
    },
  );

  return normalizeUser(data);
}

export async function updateUser(userId, updates = {}) {
  const payload = normalizeUserUpdate(updates);
  const existingUser = await getUserById(userId);
  const nextStatus = "status" in payload ? normalizeStatusValue(payload.status) : null;

  if (existingUser && isProtectedDemoEmail(existingUser.email) && nextStatus && nextStatus !== "active") {
    const protectedError = new Error("Protected demo users cannot be deactivated.");
    protectedError.code = "PROTECTED_DEMO_USER";
    throw protectedError;
  }

  if (!isSupabaseConfigured || !supabase) {
    return normalizeUser(
      updateMockUsers(userId, (user) => {
        const nextRole = "role" in payload ? payload.role : normalizeRoleValue(user.role, "student");
        const nextStatus = "status" in payload ? payload.status : normalizeStatusValue(user.status, "active");
        return {
          ...user,
          ...payload,
          role: toDisplayRole(nextRole),
          status: toDisplayStatus(nextStatus),
          updated_at: nowIso(),
        };
      }),
    );
  }

  const data = await runUserMutationWithOptionalColumnRetry(
    (nextPayload) =>
      supabase.from("users").update(nextPayload).eq("id", userId).select("*").single(),
    payload,
  );

  return normalizeUser(data);
}

export async function updateStudentProfile(studentId, updates = {}) {
  return updateUser(studentId, updates);
}

export async function recordUserLogin(userId) {
  if (!userId) return null;

  if (!isSupabaseConfigured || !supabase) {
    return normalizeUser(
      updateMockUsers(userId, (user) => ({
        ...user,
        last_login_at: nowIso(),
        updated_at: nowIso(),
      })),
    );
  }

  const data = await runUserMutationWithOptionalColumnRetry(
    (payload) =>
      supabase.from("users").update(payload).eq("id", userId).select("*").single(),
    {
      last_login_at: nowIso(),
      updated_at: nowIso(),
    },
  );

  return normalizeUser(data);
}

export async function markPasswordChanged(userId) {
  if (!userId) return null;

  if (!isSupabaseConfigured || !supabase) {
    return normalizeUser(
      updateMockUsers(userId, (user) => ({
        ...user,
        must_change_password: false,
        password_updated_at: nowIso(),
        updated_at: nowIso(),
      })),
    );
  }

  const data = await runUserMutationWithOptionalColumnRetry(
    (payload) =>
      supabase.from("users").update(payload).eq("id", userId).select("*").single(),
    {
      must_change_password: false,
      password_updated_at: nowIso(),
      updated_at: nowIso(),
    },
  );

  return normalizeUser(data);
}

export async function recordPrivacyPolicyConsent(userId, version = "2026-07-draft") {
  if (!userId) return null;

  const timestamp = nowIso();

  if (!isSupabaseConfigured || !supabase) {
    return normalizeUser(
      updateMockUsers(userId, (user) => ({
        ...user,
        privacy_policy_accepted: true,
        privacy_policy_accepted_at: timestamp,
        privacy_policy_version: version,
        updated_at: timestamp,
      })),
    );
  }

  const data = await runUserMutationWithOptionalColumnRetry(
    (payload) =>
      supabase.from("users").update(payload).eq("id", userId).select("*").single(),
    {
      privacy_policy_accepted: true,
      privacy_policy_accepted_at: timestamp,
      privacy_policy_version: version,
      updated_at: timestamp,
    },
  );

  return normalizeUser(data);
}

export async function finalizeUserOnboarding(userId, username) {
  if (!userId) {
    throw new Error("A valid user id is required.");
  }

  const normalizedUsername = normalizeOptionalString(username).toLowerCase();
  if (!normalizedUsername) {
    throw new Error("Username is required.");
  }

  const usernameAvailable = await isUsernameAvailable(normalizedUsername, userId);
  if (!usernameAvailable) {
    throw new Error("Username is not available.");
  }

  if (!isSupabaseConfigured || !supabase) {
    return normalizeUser(
      updateMockUsers(userId, (user) => ({
        ...user,
        username: normalizedUsername,
        must_change_password: false,
        password_updated_at: nowIso(),
        updated_at: nowIso(),
      })),
    );
  }

  const data = await runUserMutationWithOptionalColumnRetry(
    (payload) =>
      supabase.from("users").update(payload).eq("id", userId).select("*").single(),
    {
      username: normalizedUsername,
      must_change_password: false,
      password_updated_at: nowIso(),
      updated_at: nowIso(),
    },
  );

  return normalizeUser(data);
}

async function createUserProfileOnly(payload = {}) {
  const normalizedCountry = normalizeCountrySelection(
    payload.country_code ?? payload.countryCode ?? payload.country_name ?? payload.countryName ?? payload.country,
  );
  const normalizedPayload = {
    name: normalizeOptionalString(payload.name),
    email: normalizeOptionalString(payload.email).toLowerCase(),
    username: normalizeOptionalString(payload.username).toLowerCase(),
    role: normalizeRoleValue(payload.role),
    status: normalizeStatusValue(payload.status),
    country: normalizedCountry.country || null,
    country_code: normalizedCountry.countryCode || null,
    country_name: normalizedCountry.countryName || null,
    country_flag: normalizedCountry.countryFlag || null,
    bio: normalizeOptionalString(payload.bio) || null,
    profile_picture_url: normalizeOptionalString(payload.profile_picture_url ?? payload.profilePictureUrl) || null,
    must_change_password: false,
  };

  if (!normalizedPayload.name || !normalizedPayload.email || !normalizedPayload.username) {
    throw new Error("Name, email, and username are required.");
  }

  if (!isSupabaseConfigured || !supabase) {
    const nextUser = buildMockUser(
      {
        ...normalizedPayload,
        created_at: nowIso(),
        updated_at: nowIso(),
      },
      null,
    );

    setMockUsers([nextUser, ...getMockUsers()]);
    return {
      user: normalizeUser(nextUser),
      temporaryPassword: createTemporaryPassword(),
      emailSent: false,
    };
  }

  const data = await runUserMutationWithOptionalColumnRetry(
    (nextPayload) => supabase.from("users").insert([nextPayload]).select("*").single(),
    {
      ...normalizedPayload,
      updated_at: nowIso(),
    },
  );

  return {
    user: normalizeUser(data),
    temporaryPassword: createTemporaryPassword(),
    emailSent: false,
  };
}

export async function createAdminUser(payload = {}, options = {}) {
  const productionAuthEnabled = Boolean(options.productionAuthEnabled);
  const productionOnboardingTest = Boolean(options.productionOnboardingTest);
  const normalizedPayload = {
    name: normalizeOptionalString(payload.name),
    email: normalizeOptionalString(payload.email).toLowerCase(),
    username: normalizeOptionalString(payload.username).toLowerCase(),
    role: normalizeRoleValue(payload.role),
    status: normalizeStatusValue(payload.status),
    ...normalizeCountrySelection(
      payload.country_code ?? payload.countryCode ?? payload.country_name ?? payload.countryName ?? payload.country,
      payload.language || "es",
    ),
    bio: normalizeOptionalString(payload.bio) || null,
    profile_picture_url: normalizeOptionalString(payload.profile_picture_url ?? payload.profilePictureUrl) || null,
    must_change_password: true,
    temporaryPassword: normalizeOptionalString(payload.temporaryPassword) || null,
    language: normalizeOptionalString(payload.language) || "es",
  };

  if (productionAuthEnabled) {
    if (!normalizedPayload.name || !normalizedPayload.email) {
      throw new Error("Name and email are required.");
    }

    const response = await invokeAdminUserFunction({
      action: "create-user",
      user: {
        ...normalizedPayload,
        username: null,
      },
      language: normalizedPayload.language,
    });

    return {
      user: normalizeUser(response.user ?? {}),
      emailSent: Boolean(response.emailSent),
      simulationMode: Boolean(response.simulationMode),
      temporaryPassword: response.temporaryPassword ?? "",
    };
  }

  if (productionOnboardingTest) {
    const temporaryPassword = normalizeOptionalString(payload.temporaryPassword) || createTemporaryPassword();
    const simulationPayload = {
      name: normalizedPayload.name,
      email: normalizedPayload.email,
      username: null,
      role: normalizedPayload.role,
      status: normalizedPayload.status,
      country: normalizedPayload.country,
      country_code: normalizedPayload.countryCode,
      country_name: normalizedPayload.countryName,
      country_flag: normalizedPayload.countryFlag,
      bio: normalizedPayload.bio,
      profile_picture_url: normalizedPayload.profile_picture_url,
      must_change_password: true,
      password_updated_at: null,
    };

    if (!simulationPayload.name || !simulationPayload.email) {
      throw new Error("Name and email are required.");
    }

    if (!isSupabaseConfigured || !supabase) {
      const nextUser = buildMockUser(
        {
          ...simulationPayload,
          created_at: nowIso(),
          updated_at: nowIso(),
        },
        null,
      );

      setMockUsers([nextUser, ...getMockUsers()]);
      return {
        user: normalizeUser(nextUser),
        temporaryPassword,
        emailSent: false,
        simulationMode: true,
      };
    }

    const data = await runUserMutationWithOptionalColumnRetry(
      (nextPayload) => supabase.from("users").insert([nextPayload]).select("*").single(),
      {
        ...simulationPayload,
        updated_at: nowIso(),
      },
    );

    return {
      user: normalizeUser(data),
      temporaryPassword,
      emailSent: false,
      simulationMode: true,
    };
  }

  return createUserProfileOnly(normalizedPayload);
}

export async function resetAdminUserPassword(userId, temporaryPassword = "", options = {}) {
  if (!userId) {
    throw new Error("A valid user id is required to reset the password.");
  }

  const productionAuthEnabled = Boolean(options.productionAuthEnabled);
  const productionOnboardingTest = Boolean(options.productionOnboardingTest);

  if (productionAuthEnabled) {
    const response = await invokeAdminUserFunction({
      action: "reset-user-password",
      userId,
      temporaryPassword: normalizeOptionalString(temporaryPassword) || null,
      language: normalizeOptionalString(options.language) || "es",
    });

    return {
      user: normalizeUser(response.user ?? {}),
      emailSent: Boolean(response.emailSent),
      simulationMode: Boolean(response.simulationMode),
      temporaryPassword: response.temporaryPassword ?? "",
    };
  }

  if (productionOnboardingTest) {
    if (!isSupabaseConfigured || !supabase) {
      const user = updateMockUsers(userId, (entry) => ({
        ...entry,
        username: "",
        must_change_password: true,
        password_updated_at: null,
        updated_at: nowIso(),
      }));

      return {
        user: normalizeUser(user ?? {}),
        temporaryPassword: normalizeOptionalString(temporaryPassword) || createTemporaryPassword(),
        emailSent: false,
        simulationMode: true,
      };
    }

    const data = await runUserMutationWithOptionalColumnRetry(
      (payload) =>
        supabase.from("users").update(payload).eq("id", userId).select("*").single(),
      {
        username: null,
        must_change_password: true,
        password_updated_at: null,
        updated_at: nowIso(),
      },
    );

    return {
      user: normalizeUser(data ?? {}),
      temporaryPassword: normalizeOptionalString(temporaryPassword) || createTemporaryPassword(),
      emailSent: false,
      simulationMode: true,
    };
  }

  if (!isSupabaseConfigured || !supabase) {
    const user = updateMockUsers(userId, (entry) => ({
      ...entry,
      must_change_password: true,
      updated_at: nowIso(),
    }));

    return {
      user: normalizeUser(user ?? {}),
      temporaryPassword: createTemporaryPassword(),
      emailSent: false,
    };
  }

  const data = await runUserMutationWithOptionalColumnRetry(
    (payload) =>
      supabase.from("users").update(payload).eq("id", userId).select("*").single(),
    {
      must_change_password: true,
      password_updated_at: null,
      updated_at: nowIso(),
    },
  );

  return {
    user: normalizeUser(data ?? {}),
    temporaryPassword: normalizeOptionalString(temporaryPassword) || createTemporaryPassword(),
    emailSent: false,
  };
}

export async function sendUserInvitation(user = {}, options = {}) {
  const email = normalizeOptionalString(user.email)?.toLowerCase();
  if (!email) {
    throw new Error("Email required to send invitation.");
  }

  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Supabase is not configured.");
  }

  const language = normalizeOptionalString(options.language) || "es";
  const inviteUrl =
    normalizeOptionalString(options.inviteUrl) ||
    (typeof window !== "undefined" ? `${window.location.origin}/` : "https://nutripro-lms.vercel.app/");

  let response;
  try {
    response = await invokeInvitationFunction({
      userId: user.id ?? null,
      to: email,
      name: normalizeOptionalString(user.name),
      role: normalizeRoleValue(user.roleKey ?? user.role),
      temporaryPassword: normalizeOptionalString(options.temporaryPassword),
      inviteUrl,
      invitedBy: normalizeOptionalString(options.invitedBy),
      language,
      demoMode: Boolean(options.demoMode),
    });
  } catch (error) {
    if (user?.id) {
      try {
        await runUserMutationWithOptionalColumnRetry(
          (payload) =>
            supabase.from("users").update(payload).eq("id", user.id).select("*").single(),
          {
            invitation_status: "failed",
            updated_at: nowIso(),
          },
        );
      } catch (trackingError) {
        console.warn("Saving failed invitation status in public.users failed:", trackingError);
      }
    }
    throw error;
  }

  const invitationPayload = {
    invitation_sent_at: nowIso(),
    invitation_status: "sent",
    invitation_email_id: response?.id ?? null,
    updated_at: nowIso(),
  };

  let updatedUser = normalizeUser(user);
  try {
    const data = await runUserMutationWithOptionalColumnRetry(
      (payload) =>
        supabase.from("users").update(payload).eq("id", user.id).select("*").single(),
      invitationPayload,
    );
    updatedUser = normalizeUser(data);
  } catch (trackingError) {
    console.warn("Updating invitation tracking in public.users failed:", trackingError);
  }

  return {
    ok: true,
    id: response?.id ?? "",
    user: updatedUser,
  };
}

export async function ensureDemoStudent() {
  if (!isSupabaseConfigured || !supabase) {
    const mockUsers = getMockUsers();
    const existingUser = findDemoStudent(mockUsers);
    if (existingUser) return normalizeUser(existingUser);

    const nextUser = buildMockUser({
      name: DEMO_STUDENT_NAME,
      email: DEMO_STUDENT_EMAIL,
      username: "maya",
      role: DEMO_STUDENT_ROLE,
      status: DEMO_STUDENT_STATUS,
      country: "",
      bio: "",
      profile_picture_url: "",
      must_change_password: false,
    });

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

  const dataRow = await runUserMutationWithOptionalColumnRetry(
    (payload) => supabase.from("users").insert([payload]).select("*").single(),
    {
      name: DEMO_STUDENT_NAME,
      email: DEMO_STUDENT_EMAIL,
      username: "maya",
      role: DEMO_STUDENT_ROLE,
      status: DEMO_STUDENT_STATUS,
      country: null,
      bio: null,
      profile_picture_url: null,
      must_change_password: false,
      updated_at: nowIso(),
    },
  );

  return normalizeUser(dataRow);
}

export async function deactivateUser(userId) {
  if (!userId) {
    throw new Error("A valid user id is required.");
  }

  const existingUser = await getUserById(userId);
  if (!existingUser) {
    return {
      ok: true,
      softDeleted: true,
      user: null,
    };
  }

  if (isProtectedDemoEmail(existingUser.email)) {
    const protectedError = new Error("Protected demo users cannot be deleted.");
    protectedError.code = "PROTECTED_DEMO_USER";
    throw protectedError;
  }

  // Soft delete for launch safety. This keeps related history like submissions,
  // posts, enrollments, and progress intact while removing the user from active use.
  if (!isSupabaseConfigured || !supabase) {
    const user = updateMockUsers(userId, (entry) => ({
      ...entry,
      status: toDisplayStatus("inactive"),
      updated_at: nowIso(),
    }));

    return {
      ok: true,
      softDeleted: true,
      user: user ? normalizeUser(user) : null,
    };
  }

  const data = await runUserMutationWithOptionalColumnRetry(
    (payload) =>
      supabase.from("users").update(payload).eq("id", userId).select("*").single(),
    {
      status: "inactive",
      updated_at: nowIso(),
    },
  );

  return {
    ok: true,
    softDeleted: true,
    user: normalizeUser(data),
  };
}

export async function deleteUser(userId) {
  return deactivateUser(userId);
}
