import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.53.0";
import { corsHeaders } from "../_shared/cors.ts";

const supabaseUrl = Deno.env.get("NUTRIPRO_SUPABASE_URL") ?? "";
const supabaseServiceRoleKey = Deno.env.get("NUTRIPRO_SERVICE_ROLE_KEY") ?? "";
const emailApiKey = Deno.env.get("NUTRIPRO_EMAIL_API_KEY") ?? "";
const fromEmail = Deno.env.get("NUTRIPRO_FROM_EMAIL") ?? "";
const appUrl = Deno.env.get("NUTRIPRO_APP_URL") ?? "";

type SupportedRole = "student" | "admin" | "instructor" | "support";
type SupportedStatus = "active" | "inactive" | "suspended";

type CreateUserPayload = {
  name: string;
  email: string;
  username: string;
  role: SupportedRole;
  status: SupportedStatus;
  country?: string | null;
  country_code?: string | null;
  country_name?: string | null;
  country_flag?: string | null;
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

function getRandomChar(chars: string) {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return chars[array[0] % chars.length];
}

function createTemporaryPassword(length = 16) {
  const uppercase = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lowercase = "abcdefghijkmnopqrstuvwxyz";
  const numbers = "23456789";
  const symbols = "!@#$%^&*?";
  const all = uppercase + lowercase + numbers + symbols;
  const password = [
    getRandomChar(uppercase),
    getRandomChar(lowercase),
    getRandomChar(numbers),
    getRandomChar(symbols),
    ...Array.from({ length: Math.max(10, length) - 4 }, () => getRandomChar(all)),
  ];

  for (let index = password.length - 1; index > 0; index -= 1) {
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    const swapIndex = array[0] % (index + 1);
    [password[index], password[swapIndex]] = [password[swapIndex], password[index]];
  }

  return password.join("");
}

function normalizeOptionalString(value: unknown) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

function normalizeRole(value: unknown): SupportedRole {
  const normalized = String(value ?? "student").trim().toLowerCase();
  if (normalized === "admin" || normalized === "student" || normalized === "instructor" || normalized === "support") {
    return normalized;
  }
  return "student";
}

function normalizeStatus(value: unknown): SupportedStatus {
  const normalized = String(value ?? "active").trim().toLowerCase();
  if (normalized === "active" || normalized === "inactive" || normalized === "suspended") return normalized;
  return "active";
}

function normalizeLanguage(value: unknown) {
  return String(value ?? "es").trim().toLowerCase() === "en" ? "en" : "es";
}

function nowIso() {
  return new Date().toISOString();
}

function localize(language: "es" | "en", english: string, spanish: string) {
  return language === "es" ? spanish : english;
}

function getLoginUrl() {
  return appUrl ? appUrl.replace(/\/$/, "") : "https://your-app-url.example/login";
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
      subject: "You have been invited to Nutripro",
      text: `Hi ${name},

You have been invited to Nutripro.

Sign in with:
Email: ${email}
Temporary password: ${temporaryPassword}

You will be asked to create a new password and accept the Privacy Policy and Data Use terms before entering the platform.

Log in here:
${loginUrl}`,
      html: `<p>Hi ${name},</p>
<p>You have been invited to Nutripro.</p>
<p><strong>Email:</strong> ${email}<br /><strong>Temporary password:</strong> ${temporaryPassword}</p>
<p>You will be asked to create a new password and accept the Privacy Policy and Data Use terms before entering the platform.</p>
<p><a href="${loginUrl}">Log in here</a></p>`,
    };
  }

  return {
    subject: "Has sido invitado a Nutripro",
    text: `Hola ${name},

Has sido invitado a Nutripro.

Inicia sesión con:
Correo: ${email}
Contraseña temporal: ${temporaryPassword}

Se te pedirá crear una nueva contraseña y aceptar la Política de privacidad y uso de datos antes de entrar a la plataforma.

Ingresa aquí:
${loginUrl}`,
    html: `<p>Hola ${name},</p>
<p>Has sido invitado a Nutripro.</p>
<p><strong>Correo:</strong> ${email}<br /><strong>Contraseña temporal:</strong> ${temporaryPassword}</p>
<p>Se te pedirá crear una nueva contraseña y aceptar la Política de privacidad y uso de datos antes de entrar a la plataforma.</p>
<p><a href="${loginUrl}">Ingresa aquí</a></p>`,
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

  if (profileError) throw profileError;

  if (
    !profile ||
    String(profile.role ?? "").toLowerCase() !== "admin" ||
    String(profile.status ?? "").toLowerCase() !== "active"
  ) {
    throw new Error("Only active admins can manage users.");
  }

  return authData.user;
}

async function upsertPublicProfile(
  adminClient: ReturnType<typeof createClient>,
  authUserId: string,
  payload: CreateUserPayload,
) {
  const { data: existingProfile, error: existingProfileError } = await adminClient
    .from("users")
    .select("*")
    .eq("email", payload.email)
    .maybeSingle();

  if (existingProfileError) throw existingProfileError;

  if (existingProfile?.auth_user_id && existingProfile.auth_user_id !== authUserId) {
    throw new Error("This email is already linked to another auth account.");
  }

  const profilePayload = {
    auth_user_id: authUserId,
    name: payload.name,
    email: payload.email,
    username: payload.username,
    role: payload.role,
    status: payload.status,
    country: payload.country ?? null,
    country_code: payload.country_code ?? null,
    country_name: payload.country_name ?? null,
    country_flag: payload.country_flag ?? null,
    bio: payload.bio ?? null,
    profile_picture_url: payload.profile_picture_url ?? null,
    must_change_password: true,
    privacy_policy_accepted: false,
    privacy_policy_accepted_at: null,
    privacy_policy_version: null,
    privacy_consent_reminder_dismissed: false,
    privacy_consent_reminder_dismissed_at: null,
    password_updated_at: null,
    updated_at: nowIso(),
  };

  if (existingProfile) {
    const { data, error } = await adminClient
      .from("users")
      .update(profilePayload)
      .eq("id", existingProfile.id)
      .select("*")
      .single();

    if (error) throw error;
    return data;
  }

  const { data, error } = await adminClient
    .from("users")
    .insert({
      ...profilePayload,
      last_login_at: null,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

function mapCreateUserErrorMessage(error: unknown, language: "es" | "en") {
  const message = String(
    error instanceof Error ? error.message : error ?? "Creating the auth user failed.",
  ).toLowerCase();

  if (message.includes("already") && message.includes("email")) {
    return localize(
      language,
      "A user with this email already exists.",
      "Ya existe un usuario con este correo.",
    );
  }

  return localize(
    language,
    "Creating the auth user failed.",
    "No se pudo crear el usuario de autenticación.",
  );
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
        username: String(user.username ?? "").trim().toLowerCase(),
        role: normalizeRole(user.role),
        status: normalizeStatus(user.status),
        country: normalizeOptionalString(user.country),
        country_code: normalizeOptionalString(user.country_code),
        country_name: normalizeOptionalString(user.country_name),
        country_flag: normalizeOptionalString(user.country_flag),
        bio: normalizeOptionalString(user.bio),
        profile_picture_url: normalizeOptionalString(user.profile_picture_url),
        must_change_password: true,
        temporaryPassword: normalizeOptionalString(user.temporaryPassword),
      };

      if (!payload.name || !payload.email || !payload.username) {
        return jsonResponse(
          {
            error: localize(
              language,
              "Name, email, and username are required.",
              "Nombre, correo y nombre de usuario son obligatorios.",
            ),
          },
          400,
        );
      }

      const { data: duplicateUsername } = await adminClient
        .from("users")
        .select("id")
        .eq("username", payload.username)
        .limit(1)
        .maybeSingle();

      if (duplicateUsername) {
        return jsonResponse(
          {
            error: localize(
              language,
              "A user with this username already exists.",
              "Ya existe un usuario con este nombre de usuario.",
            ),
          },
          400,
        );
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
        return jsonResponse({ error: mapCreateUserErrorMessage(authUserError, language) }, 400);
      }

      try {
        const profileRow = await upsertPublicProfile(adminClient, authUserData.user.id, payload);
        return jsonResponse({
          ok: true,
          user: profileRow,
        });
      } catch (profileError) {
        await adminClient.auth.admin.deleteUser(authUserData.user.id);
        return jsonResponse(
          { error: profileError instanceof Error ? profileError.message : "Profile upsert failed." },
          400,
        );
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

      if (profileLookupError) return jsonResponse({ error: profileLookupError.message }, 400);
      if (!profileRow?.auth_user_id) {
        return jsonResponse({ error: "This user is not linked to a Supabase Auth account yet." }, 400);
      }

      const temporaryPassword = normalizeOptionalString(body?.temporaryPassword) || createTemporaryPassword();
      const { error: passwordError } = await adminClient.auth.admin.updateUserById(profileRow.auth_user_id, {
        password: temporaryPassword,
      });

      if (passwordError) return jsonResponse({ error: passwordError.message }, 400);

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

      if (profileError) return jsonResponse({ error: profileError.message }, 400);

      try {
        const emailResult = await sendAccessEmail({
          to: profileRow.email,
          name: profileRow.name ?? profileRow.email,
          temporaryPassword,
          language,
        });

        return jsonResponse({
          ok: true,
          user: updatedProfileRow,
          emailSent: emailResult.emailSent,
          simulationMode: emailResult.simulationMode,
          temporaryPassword: emailResult.simulationMode ? temporaryPassword : undefined,
        });
      } catch (emailError) {
        return jsonResponse({
          ok: true,
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
