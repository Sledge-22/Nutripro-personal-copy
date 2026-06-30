import { isSupabaseConfigured, supabase } from "../lib/supabaseClient.js";
import { createMockId, getMockCommunityPosts, setMockCommunityPosts } from "./mockStore.js";

export async function getCommunityPosts() {
  if (!isSupabaseConfigured) return getMockCommunityPosts();

  try {
    // TODO(database): Align selected columns with the final Supabase community posts table schema.
    const { data, error } = await supabase.from("community_posts").select("*").order("id", { ascending: false });
    if (error) throw error;
    return data ?? [];
  } catch {
    return getMockCommunityPosts();
  }
}

export async function createCommunityPost(post) {
  const payload = {
    time: "Just now",
    ...post,
  };

  if (!isSupabaseConfigured) {
    const posts = getMockCommunityPosts();
    const created = { id: createMockId(posts), ...payload };
    setMockCommunityPosts([created, ...posts]);
    return created;
  }

  try {
    // TODO(database): Persist community posts against the final Supabase community posts table schema.
    const { data, error } = await supabase.from("community_posts").insert(payload).select().single();
    if (error) throw error;
    return data;
  } catch {
    const posts = getMockCommunityPosts();
    const created = { id: createMockId(posts), ...payload };
    setMockCommunityPosts([created, ...posts]);
    return created;
  }
}
