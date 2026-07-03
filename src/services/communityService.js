import { isSupabaseConfigured, supabase } from "../lib/supabaseClient.js";
import { createMockId, getMockCommunityPosts, getMockUsers, setMockCommunityPosts } from "./mockStore.js";
import { DEMO_STUDENT_EMAIL, DEMO_STUDENT_NAME } from "./userService.js";

function initialsFromName(name) {
  return (name || "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "NP";
}

function formatCommunityDate(value) {
  if (!value) return "Recently";

  try {
    return new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return value;
  }
}

function normalizeAuthorInfo(row = {}, fallback = {}) {
  const name = row.name ?? row.author_name ?? row.author ?? fallback.name ?? "Student";
  const email = row.email ?? fallback.email ?? "";
  const country = row.country ?? fallback.country ?? "";
  const profilePictureUrl =
    row.profile_picture_url ?? row.profilePictureUrl ?? fallback.profilePictureUrl ?? fallback.profile_picture_url ?? "";

  return {
    author: name,
    authorEmail: email,
    country,
    profilePictureUrl,
    profile_picture_url: profilePictureUrl,
    initials: row.initials ?? fallback.initials ?? initialsFromName(name),
  };
}

function normalizeComment(row, author = {}) {
  const authorInfo = normalizeAuthorInfo(row, author);

  return {
    id: row.id,
    postId: row.post_id ?? row.postId,
    studentId: row.student_id ?? row.studentId ?? row.user_id ?? row.userId ?? null,
    body: row.body ?? row.comment ?? "",
    time: formatCommunityDate(row.created_at ?? row.createdAt ?? row.time),
    createdAt: row.created_at ?? row.createdAt ?? "",
    ...authorInfo,
  };
}

function normalizePost(row, author = {}, comments = []) {
  const authorInfo = normalizeAuthorInfo(row, author);

  return {
    id: row.id,
    studentId: row.student_id ?? row.studentId ?? row.user_id ?? row.userId ?? null,
    title: row.title ?? "",
    body: row.body ?? "",
    time: formatCommunityDate(row.created_at ?? row.createdAt ?? row.time),
    createdAt: row.created_at ?? row.createdAt ?? "",
    comments: comments.map((comment) => normalizeComment(comment, comment.author ?? {})),
    ...authorInfo,
  };
}

function createMockPost(post) {
  const posts = getMockCommunityPosts();
  const created = { id: createMockId(posts), ...post, comments: post.comments ?? [] };
  setMockCommunityPosts([created, ...posts]);
  return created;
}

function updateMockPost(postId, updater) {
  const nextPosts = getMockCommunityPosts().map((post) => (String(post.id) === String(postId) ? updater(post) : post));
  setMockCommunityPosts(nextPosts);
  return nextPosts.find((post) => String(post.id) === String(postId)) ?? null;
}

function findMockStudent(studentId) {
  return getMockUsers().find((user) => String(user.id) === String(studentId)) ?? null;
}

async function loadSupabaseUsers(userIds = []) {
  const normalizedIds = Array.from(new Set(userIds.filter(Boolean)));
  if (!normalizedIds.length) return new Map();

  const { data, error } = await supabase.from("users").select("*").in("id", normalizedIds);
  if (error) {
    console.error("Loading community users from Supabase failed:", error);
    throw error;
  }

  return new Map((data ?? []).map((user) => [String(user.id), user]));
}

function resolveDemoProfile(studentProfile) {
  if (studentProfile) return studentProfile;

  const fallbackUser =
    getMockUsers().find((user) => user.email?.toLowerCase() === DEMO_STUDENT_EMAIL) ??
    getMockUsers().find((user) => user.name === DEMO_STUDENT_NAME) ??
    null;

  return {
    id: fallbackUser?.id ?? 1,
    name: fallbackUser?.name ?? DEMO_STUDENT_NAME,
    email: fallbackUser?.email ?? DEMO_STUDENT_EMAIL,
    country: fallbackUser?.country ?? "",
    profilePictureUrl: fallbackUser?.profilePictureUrl ?? fallbackUser?.profile_picture_url ?? "",
    initials: initialsFromName(fallbackUser?.name ?? DEMO_STUDENT_NAME),
  };
}

export async function getCommunityPosts() {
  if (!isSupabaseConfigured) return getMockCommunityPosts();

  try {
    const [{ data: posts, error: postsError }, { data: comments, error: commentsError }] = await Promise.all([
      supabase.from("community_posts").select("*").order("created_at", { ascending: false }).order("id", { ascending: false }),
      supabase.from("community_comments").select("*").order("created_at", { ascending: true }).order("id", { ascending: true }),
    ]);

    if (postsError) throw postsError;
    if (commentsError) throw commentsError;

    const userIds = [
      ...(posts ?? []).map((post) => post.student_id ?? post.user_id),
      ...(comments ?? []).map((comment) => comment.student_id ?? comment.user_id),
    ];
    const userMap = await loadSupabaseUsers(userIds);

    return (posts ?? []).map((post) => {
      const postComments = (comments ?? []).filter(
        (comment) => String(comment.post_id ?? comment.postId) === String(post.id),
      );

      return normalizePost(
        post,
        userMap.get(String(post.student_id ?? post.user_id)) ?? post,
        postComments.map((comment) => ({
          ...comment,
          author: userMap.get(String(comment.student_id ?? comment.user_id)) ?? comment,
        })),
      );
    });
  } catch (error) {
    console.error("Loading community posts from Supabase failed. Falling back to mock community posts:", error);
    return getMockCommunityPosts();
  }
}

export async function createCommunityPost(post) {
  const authorProfile = resolveDemoProfile(post.studentProfile);
  const payload = {
    student_id: post.studentId ?? authorProfile.id ?? null,
    author_name: post.author ?? authorProfile.name ?? DEMO_STUDENT_NAME,
    title: `${post.title ?? ""}`.trim(),
    body: `${post.body ?? ""}`.trim(),
  };

  if (!isSupabaseConfigured) {
    return createMockPost(
      normalizePost(
        {
          id: createMockId(getMockCommunityPosts()),
          ...payload,
          created_at: new Date().toISOString(),
        },
        authorProfile,
        [],
      ),
    );
  }

  try {
    const { data, error } = await supabase.from("community_posts").insert(payload).select("*").single();
    if (error) throw error;
    return normalizePost(data, authorProfile, []);
  } catch (error) {
    console.error("Creating community post in Supabase failed. Falling back to mock post:", error);
    return createMockPost(
      normalizePost(
        {
          id: createMockId(getMockCommunityPosts()),
          ...payload,
          created_at: new Date().toISOString(),
        },
        authorProfile,
        [],
      ),
    );
  }
}

export async function createCommunityComment(postId, comment) {
  const authorProfile = resolveDemoProfile(comment.studentProfile);
  const payload = {
    post_id: postId,
    student_id: comment.studentId ?? authorProfile.id ?? null,
    author_name: comment.author ?? authorProfile.name ?? DEMO_STUDENT_NAME,
    body: `${comment.body ?? ""}`.trim(),
  };

  if (!isSupabaseConfigured) {
    const createdComment = normalizeComment(
      {
        id: Date.now(),
        ...payload,
        created_at: new Date().toISOString(),
      },
      authorProfile,
    );

    updateMockPost(postId, (post) => ({
      ...post,
      comments: [...(post.comments ?? []), createdComment],
    }));

    return createdComment;
  }

  try {
    const { data, error } = await supabase.from("community_comments").insert(payload).select("*").single();
    if (error) throw error;
    return normalizeComment(data, authorProfile);
  } catch (error) {
    console.error("Creating community comment in Supabase failed. Falling back to mock comment:", error);
    const createdComment = normalizeComment(
      {
        id: Date.now(),
        ...payload,
        created_at: new Date().toISOString(),
      },
      authorProfile,
    );

    updateMockPost(postId, (post) => ({
      ...post,
      comments: [...(post.comments ?? []), createdComment],
    }));

    return createdComment;
  }
}
