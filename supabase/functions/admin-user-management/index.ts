import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.53.0";
import { corsHeaders } from "../_shared/cors.ts";

const supabaseUrl = Deno.env.get("NUTRIPRO_SUPABASE_URL") ?? "";
const supabaseServiceRoleKey = Deno.env.get("NUTRIPRO_SERVICE_ROLE_KEY") ?? "";
const emailApiKey = Deno.env.get("NUTRIPRO_EMAIL_API_KEY") ?? "";
const fromEmail = Deno.env.get("NUTRIPRO_FROM_EMAIL") ?? "";
const appUrl = Deno.env.get("NUTRIPRO_APP_URL") ?? "";

type CreateUserPayload = {
  name: string;
  email: string;
  username?: string | null;
  role: "student" | "admin" | "instructor" | "support";
  status: "active" | "inactive" | "suspended";
  country?: string | null;
  bio?: string | null;
  profile_picture_url?: string | null;
  must_change_password?: boolean;
  temporaryPassword?: string | null;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function createTemporaryPassword(length = 14) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*";
  return Array.from({ length }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
}

function normalizeOptionalString(value: unknown) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

function normalizeRole(value: unknown): CreateUserPayload["role"] {
  const normalized = String(value ?? "student").trim().toLowerCase();
  if (normalized === "admin" || normalized === "student" || normalized === "instructor" || normalized === "support") {
    return normalized;
  }
  return "student";
}

function normalizeStatus(value: unknown): CreateUserPayload["status"] {
  const normalized = String(value ?? "active").trim().toLowerCase();
  if (normalized === "active" || normalized === "inactive" || normalized === "suspended") return normalized;
  return "active";
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeLanguage(value: unknown) {
  return String(value ?? "es").trim().toLowerCase() === "en" ? "en" : "es";
}

function getLoginUrl() {
  return appUrl ? appUrl.replace(/\/$/, "") : "https://your-app-url.example";
}

function getBearerToken(request: Request) {
  const authHeader = request.headers.get("Authorization") ?? "";
  return authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
}

function buildAccessEmail({
  name,
  email,
  temporaryPassword,
  language,
}: {
  name: string;
  email: string;
  temporaryPassword: string;
  language: "es" | "en";
}) {
  const loginUrl = getLoginUrl();

  if (language === "en") {
    return {
      subject: "Your Nutripro Access",
      text: `Hi ${name},

An account has been created for you in Nutripro.

You can log in with:
Username: ${email}
Temporary password: ${temporaryPassword}

For security, you will be required to change your password and choose your username the first time you log in.

Log in here:
${loginUrl}

Con Agus Ramon · sports nutrition`,
      html: `<p>Hi ${name},</p>
<p>An account has been created for you in Nutripro.</p>
<p>You can log in with:</p>
<p><strong>Username:</strong> ${email}<br /><strong>Temporary password:</strong> ${temporaryPassword}</p>
<p>For security, you will be required to change your password and choose your username the first time you log in.</p>
<p><a href="${loginUrl}">Log in here</a></p>
<p>Con Agus Ramon · sports nutrition</p>`,
    };
  }

  return {
    subject: "Tu acceso a Nutripro",
    text: `Hola ${name},

Se ha creado una cuenta para ti en Nutripro.

Puedes iniciar sesión con:
Usuario: ${email}
Contraseña temporal: ${temporaryPassword}

Por seguridad, deberás cambiar tu contraseña y elegir tu nombre de usuario la primera vez que ingreses.

Accede aquí:
${loginUrl}

Con Agus Ramon · nutrición deportiva`,
    html: `<p>Hola ${name},</p>
<p>Se ha creado una cuenta para ti en Nutripro.</p>
<p>Puedes iniciar sesión con:</p>
<p><strong>Usuario:</strong> ${email}<br /><strong>Contraseña temporal:</strong> ${temporaryPassword}</p>
<p>Por seguridad, deberás cambiar tu contraseña y elegir tu nombre de usuario la primera vez que ingreses.</p>
<p><a href="${loginUrl}">Accede aquí</a></p>
<p>Con Agus Ramon · nutrición deportiva</p>`,
  };
}

async function sendAccessEmail({
  to,
  name,
  temporaryPassword,
  language,
}: {
  to: string;
  name: string;
  temporaryPassword: string;
  language: "es" | "en";
}) {
  if (!emailApiKey || !fromEmail) {
    return { emailSent: false, simulationMode: true };
  }

  const email = buildAccessEmail({
    name,
    email: to,
    temporaryPassword,
    language,
  });

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${emailApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [to],
      subject: email.subject,
      html: email.html,
      text: email.text,
    }),
  });

  if (!response.ok) {
    const responseText = await response.text();
    throw new Error(`Sending the access email failed. ${responseText}`);
  }

  return { emailSent: true, simulationMode: false };
}

async function upsertPublicProfile(adminClient: ReturnType<typeof createClient>, authUserId: string, payload: CreateUserPayload) {
  const { data: existingProfile, error: existingProfileError } = await adminClient
    .from("users")
    .select("*")
    .eq("email", payload.email)
    .maybeSingle();

  if (existingProfileError) {
    throw existingProfileError;
  }

  if (existingProfile?.auth_user_id && existingProfile.auth_user_id !== authUserId) {
    throw new Error("This email is already linked to another auth account.");
  }

  if (existingProfile) {
    const { data, error } = await adminClient
      .from("users")
      .update({
        auth_user_id: authUserId,
        name: payload.name,
        email: payload.email,
        username: payload.username ?? null,
        role: payload.role,
        status: payload.status,
        country: payload.country,
        bio: payload.bio,
        profile_picture_url: payload.profile_picture_url,
        must_change_password: true,
        password_updated_at: null,
        updated_at: nowIso(),
      })
      .eq("id", existingProfile.id)
      .select("*")
      .single();

    if (error) throw error;
    return data;
  }

  const { data, error } = await adminClient
    .from("users")
    .insert({
      auth_user_id: authUserId,
      name: payload.name,
      email: payload.email,
      username: payload.username ?? null,
      role: payload.role,
      status: payload.status,
      country: payload.country,
      bio: payload.bio,
      profile_picture_url: payload.profile_picture_url,
      must_change_password: true,
      password_updated_at: null,
      last_login_at: null,
      updated_at: nowIso(),
    })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

async function requireActiveAdmin(request: Request, adminClient: ReturnType<typeof createClient>) {
  const token = getBearerToken(request);
  if (!token) {
    throw new Error("Missing Authorization header.");
  }

  const { data: authData, error: authError } = await adminClient.auth.getUser(token);
  if (authError || !authData.user) {
    throw new Error("The caller is not authenticated.");
  }

  const { data: profile, error: profileError } = await adminClient
    .from("users")
    .select("id, role, status")
    .eq("auth_user_id", authData.user.id)
    .maybeSingle();

  if (profileError) {
    throw profileError;
  }

  if (
    !profile ||
    String(profile.role ?? "").toLowerCase() !== "admin" ||
    String(profile.status ?? "").toLowerCase() !== "active"
  ) {
    throw new Error("Only active admins can manage users.");
  }

  return authData.user;
}

serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return jsonResponse({ error: "Missing Supabase function environment variables." }, 500);
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    await requireActiveAdmin(request, adminClient);

    const body = await request.json();
    const action = String(body?.action ?? "").trim();
    const language = normalizeLanguage(body?.language);

    if (action === "create-user") {
      const user = body?.user ?? {};
      const payload: CreateUserPayload = {
        name: String(user.name ?? "").trim(),
        email: String(user.email ?? "").trim().toLowerCase(),
        username: normalizeOptionalString(user.username)?.toLowerCase() ?? null,
        role: normalizeRole(user.role),
        status: normalizeStatus(user.status),
        country: normalizeOptionalString(user.country),
        bio: normalizeOptionalString(user.bio),
        profile_picture_url: normalizeOptionalString(user.profile_picture_url),
        must_change_password: true,
        temporaryPassword: normalizeOptionalString(user.temporaryPassword),
      };

      if (!payload.name || !payload.email) {
        return jsonResponse({ error: "Name and email are required." }, 400);
      }

      const temporaryPassword = payload.temporaryPassword || createTemporaryPassword();
      const { data: authUserData, error: authUserError } = await adminClient.auth.admin.createUser({
        email: payload.email,
        password: temporaryPassword,
        email_confirm: true,
        user_metadata: {
          name: payload.name,
          username: payload.username,
          role: payload.role,
        },
      });

      if (authUserError || !authUserData.user) {
        return jsonResponse({ error: authUserError?.message ?? "Creating the auth user failed." }, 400);
      }

      let profileRow: unknown;

      try {
        profileRow = await upsertPublicProfile(adminClient, authUserData.user.id, payload);
      } catch (profileError) {
        await adminClient.auth.admin.deleteUser(authUserData.user.id);
        return jsonResponse({ error: profileError instanceof Error ? profileError.message : "Profile upsert failed." }, 400);
      }

      try {
        const emailResult = await sendAccessEmail({
          to: payload.email,
          name: payload.name,
          temporaryPassword,
          language,
        });
        return jsonResponse({
          user: profileRow,
          emailSent: emailResult.emailSent,
          simulationMode: emailResult.simulationMode,
          temporaryPassword: emailResult.simulationMode ? temporaryPassword : undefined,
        });
      } catch (emailError) {
        return jsonResponse({
          user: profileRow,
          emailSent: false,
          simulationMode: true,
          temporaryPassword,
          warning: emailError instanceof Error ? emailError.message : "Access email could not be sent.",
        });
      }
    }

    if (action === "reset-user-password") {
      const userId = String(body?.userId ?? "").trim();
      if (!userId) return jsonResponse({ error: "A valid user id is required." }, 400);

      const { data: profileRow, error: profileLookupError } = await adminClient
        .from("users")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      if (profileLookupError) {
        return jsonResponse({ error: profileLookupError.message }, 400);
      }

      if (!profileRow?.auth_user_id) {
        return jsonResponse({ error: "This user is not linked to a Supabase Auth account yet." }, 400);
      }

      const temporaryPassword = normalizeOptionalString(body?.temporaryPassword) || createTemporaryPassword();
      const { error: passwordError } = await adminClient.auth.admin.updateUserById(profileRow.auth_user_id, {
        password: temporaryPassword,
      });

      if (passwordError) {
        return jsonResponse({ error: passwordError.message }, 400);
      }

      const { data: updatedProfileRow, error: profileError } = await adminClient
        .from("users")
        .update({
          must_change_password: true,
          password_updated_at: null,
          updated_at: nowIso(),
        })
        .eq("id", userId)
        .select("*")
        .single();

      if (profileError) {
        return jsonResponse({ error: profileError.message }, 400);
      }

      try {
        const emailResult = await sendAccessEmail({
          to: profileRow.email,
          name: profileRow.name ?? profileRow.email,
          temporaryPassword,
          language,
        });

        return jsonResponse({
          user: updatedProfileRow,
          emailSent: emailResult.emailSent,
          simulationMode: emailResult.simulationMode,
          temporaryPassword: emailResult.simulationMode ? temporaryPassword : undefined,
        });
      } catch (emailError) {
        return jsonResponse({
          user: updatedProfileRow,
          emailSent: false,
          simulationMode: true,
          temporaryPassword,
          warning: emailError instanceof Error ? emailError.message : "Access email could not be sent.",
        });
      }
    }

    return jsonResponse({ error: "Unsupported action." }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected function failure.";
    return jsonResponse({ error: message }, 500);
  }
});
