import { isSupabaseConfigured, supabase } from "../lib/supabaseClient.js";
import { createMockId, getMockCommunityPosts, setMockCommunityPosts } from "./mockStore.js";

function initialsFromName(name) {
  return (name || "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "NP";
}

function normalizeComment(row) {
  return {
    id: row.id,
    author: row.author_name ?? row.author ?? "Student",
    initials: row.initials ?? initialsFromName(row.author_name ?? row.author),
    body: row.body ?? row.comment ?? "",
    time: row.created_at ? new Date(row.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : row.time ?? "Recently",
  };
}

function normalizePost(row) {
  return {
    id: row.id,
    author: row.author_name ?? row.author ?? "Student",
    initials: row.initials ?? initialsFromName(row.author_name ?? row.author),
    time: row.created_at ? new Date(row.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : row.time ?? "Recently",
    title: row.title ?? "",
    body: row.body ?? "",
    comments: (row.community_comments ?? row.comments ?? []).map(normalizeComment),
  };
}

function createMockPost(post) {
  const posts = getMockCommunityPosts();
  const created = { id: createMockId(posts), ...post, comments: [] };
  setMockCommunityPosts([created, ...posts]);
  return created;
}

export async function getCommunityPosts() {
  if (!isSupabaseConfigured) return getMockCommunityPosts();

  try {
    const { data, error } = await supabase
      .from("community_posts")
      .select("*, community_comments(*)")
      .order("id", { ascending: false });

    if (error) throw error;
    return (data ?? []).map(normalizePost);
  } catch {
    try {
      const { data, error } = await supabase.from("community_posts").select("*").order("id", { ascending: false });
      if (error) throw error;
      return (data ?? []).map(normalizePost);
    } catch {
      return getMockCommunityPosts();
    }
  }
}

export async function createCommunityPost(post) {
  const payload = {
    author: post.author ?? "Maya Laurent",
    initials: post.initials ?? initialsFromName(post.author ?? "Maya Laurent"),
    title: post.title,
    body: post.body,
    time: "Just now",
  };

  if (!isSupabaseConfigured) {
    return createMockPost(payload);
  }

  try {
    const { data, error } = await supabase
      .from("community_posts")
      .insert({
        author_name: payload.author,
        title: payload.title,
        body: payload.body,
      })
      .select("*")
      .single();

    if (error) throw error;
    return normalizePost(data);
  } catch {
    return createMockPost(payload);
  }
}
