import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.53.0";
import { corsHeaders } from "../_shared/cors.ts";

const supabaseUrl = Deno.env.get("NUTRIPRO_SUPABASE_URL") ?? "";
const supabaseServiceRoleKey = Deno.env.get("NUTRIPRO_SERVICE_ROLE_KEY") ?? "";
const resendApiKey = Deno.env.get("RESEND_API_KEY") ?? "";
const fromEmail = Deno.env.get("NUTRIPRO_FROM_EMAIL") ?? "Nutripro <onboarding@example.com>";
const appUrl = Deno.env.get("NUTRIPRO_APP_URL") ?? "";

const OPTIONAL_USER_COLUMNS = [
  "invitation_sent_at",
  "invitation_status",
  "invitation_email_id",
];

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function normalizeOptionalString(value: unknown) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

function normalizeRole(value: unknown) {
  const normalized = String(value ?? "student").trim().toLowerCase();
  if (["student", "admin", "instructor", "support"].includes(normalized)) return normalized;
  return "student";
}

function normalizeLanguage(value: unknown) {
  return String(value ?? "es").trim().toLowerCase() === "en" ? "en" : "es";
}

function nowIso() {
  return new Date().toISOString();
}

function getLoginUrl(inviteUrl: string | null) {
  const candidate = inviteUrl ?? appUrl;
  return candidate ? candidate.replace(/\/$/, "") : "https://nutripro-lms.vercel.app";
}

function getBearerToken(request: Request) {
  const authHeader = request.headers.get("Authorization") ?? "";
  return authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
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
    .select("id, role, status, name")
    .eq("auth_user_id", authData.user.id)
    .maybeSingle();

  if (profileError) throw profileError;

  if (!profile || String(profile.role ?? "").toLowerCase() !== "admin" || String(profile.status ?? "").toLowerCase() !== "active") {
    throw new Error("Only active admins can send invitations.");
  }

  return profile;
}

function getRoleLabel(role: string, language: "es" | "en") {
  const labels = {
    en: { student: "student", admin: "admin", instructor: "instructor", support: "support user" },
    es: { student: "estudiante", admin: "administrador", instructor: "instructor", support: "usuario de soporte" },
  };

  return labels[language][role as keyof typeof labels.en] ?? role;
}

function buildInvitationEmail({
  name,
  role,
  temporaryPassword,
  inviteUrl,
  invitedBy,
  language,
}: {
  name: string | null;
  role: string;
  temporaryPassword: string | null;
  inviteUrl: string;
  invitedBy: string | null;
  language: "es" | "en";
}) {
  const displayName = name || (language === "es" ? "estudiante" : "there");
  const roleLabel = getRoleLabel(role, language);

  if (language === "en") {
    return {
      subject: "You’re invited to Nutripro",
      html: `
        <div style="background:#16120f;padding:32px;font-family:Arial,sans-serif;color:#f4efe2;">
          <div style="max-width:560px;margin:0 auto;background:#201a16;border:1px solid rgba(255,255,255,0.12);border-radius:24px;padding:32px;">
            <div style="font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:#4fcad6;margin-bottom:12px;">Nutripro</div>
            <h1 style="margin:0 0 16px;font-size:28px;color:#f4efe2;">You’re invited to Nutripro</h1>
            <p style="margin:0 0 16px;line-height:1.6;">Hi ${displayName},</p>
            <p style="margin:0 0 16px;line-height:1.6;">You have been invited to join Nutripro as a ${roleLabel}.</p>
            <p style="margin:0 0 24px;line-height:1.6;">Click the button below to access your account:</p>
            <p style="margin:0 0 24px;"><a href="${inviteUrl}" style="display:inline-block;padding:14px 22px;border-radius:999px;background:#4fcad6;color:#06292b;text-decoration:none;font-weight:700;">Open Nutripro</a></p>
            ${temporaryPassword ? `<p style="margin:0 0 16px;line-height:1.6;"><strong>Temporary password:</strong><br />${temporaryPassword}</p>` : ""}
            <p style="margin:0 0 16px;line-height:1.6;">If you were given a temporary password, use it for your first login and update your password during setup.</p>
            ${invitedBy ? `<p style="margin:0 0 16px;line-height:1.6;">Invited by: ${invitedBy}</p>` : ""}
            <p style="margin:0;line-height:1.6;color:rgba(244,239,226,0.75);">If you were not expecting this invitation, you can ignore this email.</p>
          </div>
        </div>`,
    };
  }

  return {
    subject: "Invitación a Nutripro",
    html: `
      <div style="background:#16120f;padding:32px;font-family:Arial,sans-serif;color:#f4efe2;">
        <div style="max-width:560px;margin:0 auto;background:#201a16;border:1px solid rgba(255,255,255,0.12);border-radius:24px;padding:32px;">
          <div style="font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:#4fcad6;margin-bottom:12px;">Nutripro</div>
          <h1 style="margin:0 0 16px;font-size:28px;color:#f4efe2;">Invitación a Nutripro</h1>
          <p style="margin:0 0 16px;line-height:1.6;">Hola ${displayName},</p>
          <p style="margin:0 0 16px;line-height:1.6;">Has sido invitado a unirte a Nutripro como ${roleLabel}.</p>
          <p style="margin:0 0 24px;line-height:1.6;">Haz clic en el botón para acceder a tu cuenta:</p>
          <p style="margin:0 0 24px;"><a href="${inviteUrl}" style="display:inline-block;padding:14px 22px;border-radius:999px;background:#4fcad6;color:#06292b;text-decoration:none;font-weight:700;">Abrir Nutripro</a></p>
          ${temporaryPassword ? `<p style="margin:0 0 16px;line-height:1.6;"><strong>Contraseña temporal:</strong><br />${temporaryPassword}</p>` : ""}
          <p style="margin:0 0 16px;line-height:1.6;">Si recibiste una contraseña temporal, úsala para tu primer inicio de sesión y actualiza tu contraseña durante la configuración.</p>
          ${invitedBy ? `<p style="margin:0 0 16px;line-height:1.6;">Invitado por: ${invitedBy}</p>` : ""}
          <p style="margin:0;line-height:1.6;color:rgba(244,239,226,0.75);">Si no esperabas esta invitación, puedes ignorar este correo.</p>
        </div>
      </div>`,
  };
}

async function sendResendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) {
  if (!resendApiKey) {
    throw new Error("RESEND_API_KEY is missing.");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [to],
      subject,
      html,
    }),
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.message || payload?.error || `Resend request failed with status ${response.status}.`);
  }

  return payload;
}

async function updateInvitationStatus(
  adminClient: ReturnType<typeof createClient>,
  userId: string | null,
  payload: Record<string, unknown>,
  attempt = 0,
): Promise<void> {
  if (!userId) return;

  const { error } = await adminClient.from("users").update(payload).eq("id", userId);
  if (!error) return;

  const removableColumn = OPTIONAL_USER_COLUMNS.find(
    (column) =>
      column in payload &&
      (error.message?.includes(`'${column}'`) ||
        error.message?.includes(`users.${column}`) ||
        error.details?.includes(column) ||
        error.hint?.includes(column)),
  );

  if (removableColumn && attempt < OPTIONAL_USER_COLUMNS.length) {
    const nextPayload = { ...payload };
    delete nextPayload[removableColumn];
    await updateInvitationStatus(adminClient, userId, nextPayload, attempt + 1);
    return;
  }

  console.warn("Updating invitation tracking fields failed:", error);
}

serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ ok: false, error: "Method not allowed." }, 405);
  }

  try {
    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return jsonResponse({ ok: false, error: "Missing Supabase function environment variables." }, 500);
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const body = await request.json();
    const demoMode = Boolean(body?.demoMode);
    const adminProfile = demoMode
      ? { name: normalizeOptionalString(body?.invitedBy) ?? "Demo Admin" }
      : await requireActiveAdmin(request, adminClient);
    const to = normalizeOptionalString(body?.to)?.toLowerCase();
    const role = normalizeRole(body?.role);
    const inviteUrl = getLoginUrl(normalizeOptionalString(body?.inviteUrl));
    const name = normalizeOptionalString(body?.name);
    const temporaryPassword = normalizeOptionalString(body?.temporaryPassword);
    const invitedBy = normalizeOptionalString(body?.invitedBy) ?? normalizeOptionalString(adminProfile?.name);
    const language = normalizeLanguage(body?.language);
    const userId = normalizeOptionalString(body?.userId);

    if (!to || !role || !inviteUrl) {
      return jsonResponse({ ok: false, error: "to, role, and inviteUrl are required." }, 400);
    }

    const email = buildInvitationEmail({
      name,
      role,
      temporaryPassword,
      inviteUrl,
      invitedBy,
      language,
    });

    const resendResult = await sendResendEmail({
      to,
      subject: email.subject,
      html: email.html,
    });

    await updateInvitationStatus(adminClient, userId, {
      invitation_sent_at: nowIso(),
      invitation_status: "sent",
      invitation_email_id: resendResult?.id ?? null,
      updated_at: nowIso(),
    });

    return jsonResponse({ ok: true, id: resendResult?.id ?? null });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to send the invitation email.";
    return jsonResponse({ ok: false, error: message }, 500);
  }
});
