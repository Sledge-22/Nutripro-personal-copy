import { isSupabaseConfigured, supabase } from "../lib/supabaseClient.js";

const LOCAL_MANUAL_DRAFTS_KEY = "nutripro-course-builder-manual-drafts-v1";

function normalizeDraftId(value) {
  const trimmed = `${value ?? ""}`.trim();
  if (!trimmed) return "";
  return trimmed;
}

function readLocalDrafts() {
  try {
    const raw = window.localStorage.getItem(LOCAL_MANUAL_DRAFTS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("Reading local course drafts failed:", error);
    return [];
  }
}

function writeLocalDrafts(drafts) {
  try {
    window.localStorage.setItem(LOCAL_MANUAL_DRAFTS_KEY, JSON.stringify(drafts));
  } catch (error) {
    console.error("Writing local course drafts failed:", error);
  }
}

function mapDraftRow(row) {
  return {
    id: row.id,
    title: row.title ?? row.draft_data?.title ?? "",
    description: row.description ?? row.draft_data?.description ?? "",
    status: row.status ?? "draft",
    draftData: row.draft_data ?? row.draftData ?? {},
    draft_data: row.draft_data ?? row.draftData ?? {},
    createdAt: row.created_at ?? row.createdAt ?? null,
    updatedAt: row.updated_at ?? row.updatedAt ?? null,
    modulesCount: Array.isArray(row.draft_data?.modules) ? row.draft_data.modules.length : 0,
    source: row.source ?? "local",
  };
}

async function tryLoadSupabaseDrafts() {
  const { data, error } = await supabase
    .from("course_drafts")
    .select("id,title,description,status,draft_data,created_at,updated_at")
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map((row) => mapDraftRow({ ...row, source: "supabase" }));
}

function saveLocalDraft(draftInput) {
  const drafts = readLocalDrafts();
  const id = normalizeDraftId(draftInput.id) || crypto.randomUUID();
  const timestamp = new Date().toISOString();
  const nextDraft = {
    id,
    title: draftInput.title ?? draftInput.draftData?.title ?? "",
    description: draftInput.description ?? draftInput.draftData?.description ?? "",
    status: "draft",
    draft_data: draftInput.draftData ?? {},
    created_at: drafts.find((entry) => entry.id === id)?.created_at ?? timestamp,
    updated_at: timestamp,
    source: "local",
  };

  const nextDrafts = [nextDraft, ...drafts.filter((entry) => entry.id !== id)];
  writeLocalDrafts(nextDrafts);
  return mapDraftRow(nextDraft);
}

export async function getCourseDrafts() {
  const localDrafts = readLocalDrafts().map((row) => mapDraftRow(row));

  if (!isSupabaseConfigured) {
    return localDrafts.sort((a, b) => `${b.updatedAt ?? ""}`.localeCompare(`${a.updatedAt ?? ""}`));
  }

  try {
    const supabaseDrafts = await tryLoadSupabaseDrafts();
    const merged = [...supabaseDrafts];

    for (const localDraft of localDrafts) {
      if (!merged.some((draft) => draft.id === localDraft.id)) {
        merged.push(localDraft);
      }
    }

    return merged.sort((a, b) => `${b.updatedAt ?? ""}`.localeCompare(`${a.updatedAt ?? ""}`));
  } catch (error) {
    console.warn("Supabase course drafts are not available yet. Falling back to local drafts only.", error);
    return localDrafts.sort((a, b) => `${b.updatedAt ?? ""}`.localeCompare(`${a.updatedAt ?? ""}`));
  }
}

export async function saveCourseDraft(draftInput) {
  const localDraft = saveLocalDraft(draftInput);

  if (!isSupabaseConfigured) {
    return localDraft;
  }

  try {
    const payload = {
      id: normalizeDraftId(draftInput.id) || localDraft.id,
      title: draftInput.title ?? draftInput.draftData?.title ?? "",
      description: draftInput.description ?? draftInput.draftData?.description ?? "",
      status: "draft",
      draft_data: draftInput.draftData ?? {},
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("course_drafts")
      .upsert(payload, { onConflict: "id" })
      .select("id,title,description,status,draft_data,created_at,updated_at")
      .single();

    if (error) throw error;
    return mapDraftRow({ ...data, source: "supabase" });
  } catch (error) {
    console.warn("Saving the course draft to Supabase failed. Local draft was kept.", error);
    return localDraft;
  }
}

export async function deleteCourseDraft(draftId) {
  const normalizedId = normalizeDraftId(draftId);
  if (!normalizedId) return true;

  writeLocalDrafts(readLocalDrafts().filter((draft) => draft.id !== normalizedId));

  if (!isSupabaseConfigured) return true;

  try {
    const { error } = await supabase.from("course_drafts").delete().eq("id", normalizedId);
    if (error) throw error;
  } catch (error) {
    console.warn("Deleting the Supabase course draft failed. Local copy was removed.", error);
  }

  return true;
}

export async function markCourseDraftPublished(draftId) {
  const normalizedId = normalizeDraftId(draftId);
  if (!normalizedId) return true;

  writeLocalDrafts(readLocalDrafts().filter((draft) => draft.id !== normalizedId));

  if (!isSupabaseConfigured) return true;

  try {
    const { error } = await supabase.from("course_drafts").delete().eq("id", normalizedId);
    if (error) throw error;
  } catch (error) {
    console.warn("Clearing the published Supabase course draft failed.", error);
  }

  return true;
}
