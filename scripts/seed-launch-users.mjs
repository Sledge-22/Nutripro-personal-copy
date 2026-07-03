import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL?.trim() || "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";
const adminPassword = process.env.NUTRIPRO_ADMIN_TEMP_PASSWORD?.trim() || "";
const studentPassword = process.env.NUTRIPRO_STUDENT_TEMP_PASSWORD?.trim() || "";

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
}

if (!adminPassword || !studentPassword) {
  throw new Error("NUTRIPRO_ADMIN_TEMP_PASSWORD and NUTRIPRO_STUDENT_TEMP_PASSWORD are required.");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

const launchUsers = [
  {
    name: "Alex Morgan",
    email: "admin@nutripro.demo",
    username: "admin",
    role: "admin",
    status: "active",
    temporaryPassword: adminPassword,
  },
  {
    name: "Maya Laurent",
    email: "maya@nutripro.demo",
    username: "maya",
    role: "student",
    status: "active",
    temporaryPassword: studentPassword,
  },
];

async function findAuthUserByEmail(email) {
  let page = 1;
  const perPage = 200;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    const users = data.users ?? [];
    const match = users.find((user) => user.email?.toLowerCase() === email.toLowerCase()) ?? null;
    if (match) return match;
    if (users.length < perPage) return null;
    page += 1;
  }
}

async function ensureAuthUser(user) {
  const existingAuthUser = await findAuthUserByEmail(user.email);

  if (existingAuthUser) {
    const { data, error } = await supabase.auth.admin.updateUserById(existingAuthUser.id, {
      email: user.email,
      password: user.temporaryPassword,
      email_confirm: true,
      user_metadata: {
        name: user.name,
        username: user.username,
        role: user.role,
      },
    });

    if (error) throw error;
    return data.user;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email: user.email,
    password: user.temporaryPassword,
    email_confirm: true,
    user_metadata: {
      name: user.name,
      username: user.username,
      role: user.role,
    },
  });

  if (error || !data.user) {
    throw error ?? new Error(`Failed to create auth user for ${user.email}.`);
  }

  return data.user;
}

async function upsertPublicUser(authUser, user) {
  const { data: existingRow, error: existingRowError } = await supabase
    .from("users")
    .select("*")
    .eq("email", user.email)
    .maybeSingle();

  if (existingRowError) throw existingRowError;

  if (existingRow) {
    const { error } = await supabase
      .from("users")
      .update({
        auth_user_id: authUser.id,
        name: user.name,
        email: user.email,
        username: user.username,
        role: user.role,
        status: user.status,
        must_change_password: true,
        password_updated_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingRow.id);

    if (error) throw error;
    return existingRow.id;
  }

  const { data, error } = await supabase
    .from("users")
    .insert({
      auth_user_id: authUser.id,
      name: user.name,
      email: user.email,
      username: user.username,
      role: user.role,
      status: user.status,
      must_change_password: true,
      password_updated_at: null,
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) throw error;
  return data.id;
}

for (const user of launchUsers) {
  const authUser = await ensureAuthUser(user);
  await upsertPublicUser(authUser, user);
  console.log(`Prepared launch user: ${user.email}`);
}

console.log("Launch users are ready. They will be forced to change their password after first login.");
