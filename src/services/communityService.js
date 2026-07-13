import { isSupabaseConfigured, supabase } from "../lib/supabaseClient.js";
import { createMockId, getMockCommunityPosts, getMockUsers, setMockCommunityPosts } from "./mockStore.js";
import { DEMO_STUDENT_EMAIL, DEMO_STUDENT_NAME } from "./userService.js";
import { uploadCommunityPdf } from "./storageService.js";

const MODERATOR_ROLES = new Set(["admin", "instructor", "support"]);

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

function normalizeRole(role) {
  const normalizedRole = `${role ?? ""}`.trim().toLowerCase();
  if (!normalizedRole) return "student";
  if (normalizedRole === "administrator") return "admin";
  return normalizedRole;
}

function normalizeAuthorInfo(row = {}, fallback = {}) {
  const name = row.name ?? row.author_name ?? row.author ?? fallback.name ?? fallback.author ?? "Student";
  const email = row.email ?? fallback.email ?? "";
  const role = normalizeRole(row.role ?? row.author_role ?? fallback.role ?? fallback.authorRole ?? "student");
  const country = row.country ?? fallback.country ?? "";
  const profilePictureUrl =
    row.profile_picture_url ?? row.profilePictureUrl ?? fallback.profilePictureUrl ?? fallback.profile_picture_url ?? "";

  return {
    author: name,
    authorEmail: email,
    authorRole: role,
    country,
    profilePictureUrl,
    profile_picture_url: profilePictureUrl,
    initials: row.initials ?? fallback.initials ?? initialsFromName(name),
  };
}

function normalizeTags(tags) {
  if (Array.isArray(tags)) return tags.map((tag) => `${tag ?? ""}`.trim()).filter(Boolean);
  if (typeof tags === "string") {
    return tags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
  }
  return [];
}

function normalizeComment(row, author = {}) {
  const authorInfo = normalizeAuthorInfo(row, author);

  return {
    id: row.id,
    postId: row.post_id ?? row.postId,
    parentCommentId: row.parent_comment_id ?? row.parentCommentId ?? null,
    studentId: row.student_id ?? row.studentId ?? row.user_id ?? row.userId ?? row.author_id ?? row.authorId ?? null,
    body: row.body ?? row.comment ?? "",
    time: formatCommunityDate(row.created_at ?? row.createdAt ?? row.time),
    createdAt: row.created_at ?? row.createdAt ?? "",
    upvoteCount: Number(row.upvote_count ?? row.upvoteCount ?? 0),
    downvoteCount: Number(row.downvote_count ?? row.downvoteCount ?? 0),
    voteScore: Number(row.vote_score ?? row.voteScore ?? 0),
    isHelpfulAnswer: Boolean(row.is_helpful_answer ?? row.isHelpfulAnswer),
    isRemoved: Boolean(row.is_removed ?? row.isRemoved),
    removedAt: row.removed_at ?? row.removedAt ?? null,
    removedBy: row.removed_by ?? row.removedBy ?? null,
    removalReason: row.removal_reason ?? row.removalReason ?? "",
    ...authorInfo,
  };
}

function normalizePost(row, author = {}, comments = [], votes = []) {
  const authorInfo = normalizeAuthorInfo(row, author);
  const normalizedComments = comments.map((comment) => normalizeComment(comment, comment.author ?? {}));
  const postVotes = votes.filter((vote) => String(vote.post_id ?? vote.postId ?? "") === String(row.id));
  const latestVoteByUser = new Map();

  postVotes.forEach((vote) => {
    const userId = String(vote.user_id ?? vote.userId ?? "");
    if (!userId) return;

    const currentVote = latestVoteByUser.get(userId);
    const currentTime = new Date(currentVote?.created_at ?? currentVote?.createdAt ?? 0).getTime();
    const nextTime = new Date(vote.created_at ?? vote.createdAt ?? 0).getTime();

    if (!currentVote || nextTime >= currentTime) {
      latestVoteByUser.set(userId, vote);
    }
  });

  const effectiveVotes = Array.from(latestVoteByUser.values());
  const upvoterIds = effectiveVotes
    .filter((vote) => `${vote.vote_type ?? vote.voteType ?? ""}`.toLowerCase() === "upvote")
    .map((vote) => String(vote.user_id ?? vote.userId))
    .filter(Boolean);
  const downvoterIds = effectiveVotes
    .filter((vote) => `${vote.vote_type ?? vote.voteType ?? ""}`.toLowerCase() === "downvote")
    .map((vote) => String(vote.user_id ?? vote.userId))
    .filter(Boolean);
  const upvoteCount = upvoterIds.length;
  const downvoteCount = downvoterIds.length;
  const voteScore = upvoteCount - downvoteCount;

  return {
    id: row.id,
    studentId: row.student_id ?? row.studentId ?? row.user_id ?? row.userId ?? row.author_id ?? row.authorId ?? null,
    title: row.title ?? "",
    body: row.body ?? "",
    category: `${row.category ?? "discussion"}`.trim().toLowerCase() || "discussion",
    courseId: row.course_id ?? row.courseId ?? null,
    courseTitle: row.course_title ?? row.courseTitle ?? "",
    tags: normalizeTags(row.tags),
    time: formatCommunityDate(row.created_at ?? row.createdAt ?? row.time),
    createdAt: row.created_at ?? row.createdAt ?? "",
    pdfFileName: row.pdf_file_name ?? row.pdfFileName ?? "",
    pdfStoragePath: row.pdf_storage_path ?? row.pdfStoragePath ?? "",
    pdfPublicUrl: row.pdf_public_url ?? row.pdfPublicUrl ?? "",
    pdfFileSize: row.pdf_file_size ?? row.pdfFileSize ?? null,
    pdfUploadedAt: row.pdf_uploaded_at ?? row.pdfUploadedAt ?? null,
    upvoteCount,
    downvoteCount,
    voteScore,
    upvote_count: upvoteCount,
    downvote_count: downvoteCount,
    vote_score: voteScore,
    upvoterIds,
    downvoterIds,
    commentCount: Number(row.comment_count ?? row.commentCount ?? normalizedComments.length),
    comments: normalizedComments,
    isPinned: Boolean(row.is_pinned ?? row.isPinned),
    isResolved: Boolean(row.is_resolved ?? row.isResolved),
    isLocked: Boolean(row.is_locked ?? row.isLocked),
    isRemoved: Boolean(row.is_removed ?? row.isRemoved),
    isAnnouncement: `${row.category ?? ""}`.trim().toLowerCase() === "announcement",
    removedAt: row.removed_at ?? row.removedAt ?? null,
    removedBy: row.removed_by ?? row.removedBy ?? null,
    removalReason: row.removal_reason ?? row.removalReason ?? "",
    resolvedAt: row.resolved_at ?? row.resolvedAt ?? null,
    ...authorInfo,
  };
}

function createMockPost(post) {
  const posts = getMockCommunityPosts();
  const created = { id: createMockId(posts), ...post, comments: post.comments ?? [] };
  setMockCommunityPosts([created, ...posts]);
  return created;
}

function updateMockPosts(updater) {
  const nextPosts = updater(getMockCommunityPosts());
  setMockCommunityPosts(nextPosts);
  return nextPosts;
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
    role: normalizeRole(fallbackUser?.roleKey ?? fallbackUser?.role ?? "student"),
    profilePictureUrl: fallbackUser?.profilePictureUrl ?? fallbackUser?.profile_picture_url ?? "",
    initials: initialsFromName(fallbackUser?.name ?? DEMO_STUDENT_NAME),
  };
}

function createCreatedTimestamp() {
  return new Date().toISOString();
}

function buildPostPayload(post) {
  const authorProfile = resolveDemoProfile(post.studentProfile);
  const normalizedCategory = `${post.category ?? "discussion"}`.trim().toLowerCase() || "discussion";

  return {
    student_id: post.studentId ?? authorProfile.id ?? null,
    author_id: post.studentId ?? authorProfile.id ?? null,
    author_name: post.author ?? authorProfile.name ?? DEMO_STUDENT_NAME,
    author_role: normalizeRole(post.authorRole ?? authorProfile.role ?? "student"),
    title: `${post.title ?? ""}`.trim(),
    body: `${post.body ?? ""}`.trim(),
    category: normalizedCategory,
    course_id: post.courseId || null,
    tags: normalizeTags(post.tags),
    upvote_count: 0,
    downvote_count: 0,
    vote_score: 0,
    comment_count: 0,
    is_pinned: Boolean(post.isPinned),
    is_resolved: Boolean(post.isResolved),
    is_locked: Boolean(post.isLocked),
    is_removed: false,
  };
}

function buildCommentPayload(postId, comment) {
  const authorProfile = resolveDemoProfile(comment.studentProfile);
  return {
    post_id: postId,
    parent_comment_id: comment.parentCommentId ?? null,
    student_id: comment.studentId ?? authorProfile.id ?? null,
    author_id: comment.studentId ?? authorProfile.id ?? null,
    author_name: comment.author ?? authorProfile.name ?? DEMO_STUDENT_NAME,
    author_role: normalizeRole(comment.authorRole ?? authorProfile.role ?? "student"),
    body: `${comment.body ?? ""}`.trim(),
    upvote_count: 0,
    downvote_count: 0,
    vote_score: 0,
    is_helpful_answer: false,
    is_removed: false,
  };
}

export async function getCommunityPosts() {
  if (!isSupabaseConfigured) {
    return getMockCommunityPosts().map((post) => normalizePost(post, post, post.comments ?? [], []));
  }

  try {
    const [postsResult, commentsResult, votesResult] = await Promise.all([
      supabase.from("community_posts").select("*").order("is_pinned", { ascending: false }).order("created_at", { ascending: false }).order("id", { ascending: false }),
      supabase.from("community_comments").select("*").order("created_at", { ascending: true }).order("id", { ascending: true }),
      supabase.from("community_votes").select("*"),
    ]);

    if (postsResult.error) throw postsResult.error;
    if (commentsResult.error) throw commentsResult.error;

    const votes = votesResult.error ? [] : (votesResult.data ?? []);
    if (votesResult.error) {
      console.error("Loading community votes from Supabase failed:", votesResult.error);
    }

    const posts = postsResult.data ?? [];
    const comments = commentsResult.data ?? [];
    const userIds = [
      ...posts.map((post) => post.student_id ?? post.user_id ?? post.author_id),
      ...comments.map((comment) => comment.student_id ?? comment.user_id ?? comment.author_id),
    ];
    const userMap = await loadSupabaseUsers(userIds);

    return posts.map((post) => {
      const postComments = comments.filter((comment) => String(comment.post_id ?? comment.postId) === String(post.id));

      return normalizePost(
        post,
        userMap.get(String(post.student_id ?? post.user_id ?? post.author_id)) ?? post,
        postComments.map((comment) => ({
          ...comment,
          author: userMap.get(String(comment.student_id ?? comment.user_id ?? comment.author_id)) ?? comment,
        })),
        votes,
      );
    });
  } catch (error) {
    console.error("Loading community posts from Supabase failed. Falling back to mock community posts:", error);
    return getMockCommunityPosts().map((post) => normalizePost(post, post, post.comments ?? [], []));
  }
}

export async function createCommunityPost(post) {
  const authorProfile = resolveDemoProfile(post.studentProfile);
  const payload = buildPostPayload(post);
  const pdfFile = post.pdfFile ?? null;

  if (!isSupabaseConfigured) {
    const createdId = createMockId(getMockCommunityPosts());
    let pdfMetadata = {};

    if (pdfFile) {
      const uploadResult = await uploadCommunityPdf(pdfFile, createdId);
      pdfMetadata = {
        pdf_file_name: uploadResult.fileName,
        pdf_storage_path: uploadResult.storagePath,
        pdf_public_url: uploadResult.publicUrl,
        pdf_file_size: uploadResult.fileSize,
        pdf_uploaded_at: createCreatedTimestamp(),
      };
    }

    return {
      post: createMockPost(
        normalizePost(
          {
            id: createdId,
            ...payload,
            ...pdfMetadata,
            created_at: createCreatedTimestamp(),
          },
          authorProfile,
          [],
          [],
        ),
      ),
      pdfUploadFailed: false,
    };
  }

  try {
    const { data, error } = await supabase.from("community_posts").insert(payload).select("*").single();
    if (error) throw error;
    let normalizedPost = normalizePost(data, authorProfile, [], []);
    let pdfUploadFailed = false;

    if (pdfFile) {
      try {
        const uploadResult = await uploadCommunityPdf(pdfFile, data.id);
        const pdfPayload = {
          pdf_file_name: uploadResult.fileName,
          pdf_storage_path: uploadResult.storagePath,
          pdf_public_url: uploadResult.publicUrl,
          pdf_file_size: uploadResult.fileSize,
          pdf_uploaded_at: createCreatedTimestamp(),
        };
        const { data: updatedPost, error: updateError } = await supabase
          .from("community_posts")
          .update(pdfPayload)
          .eq("id", data.id)
          .select("*")
          .single();
        if (updateError) throw updateError;
        normalizedPost = normalizePost(updatedPost, authorProfile, [], []);
      } catch (pdfError) {
        console.error("Uploading the community PDF failed after post creation:", pdfError);
        pdfUploadFailed = true;
      }
    }

    return { post: normalizedPost, pdfUploadFailed };
  } catch (error) {
    console.error("Creating community post in Supabase failed. Falling back to mock post:", error);
    const createdId = createMockId(getMockCommunityPosts());
    let pdfMetadata = {};
    let pdfUploadFailed = false;

    if (pdfFile) {
      try {
        const uploadResult = await uploadCommunityPdf(pdfFile, createdId);
        pdfMetadata = {
          pdf_file_name: uploadResult.fileName,
          pdf_storage_path: uploadResult.storagePath,
          pdf_public_url: uploadResult.publicUrl,
          pdf_file_size: uploadResult.fileSize,
          pdf_uploaded_at: createCreatedTimestamp(),
        };
      } catch (pdfError) {
        console.error("Uploading the community PDF in mock fallback failed:", pdfError);
        pdfUploadFailed = true;
      }
    }

    return {
      post: createMockPost(
        normalizePost(
          {
            id: createdId,
            ...payload,
            ...pdfMetadata,
            created_at: createCreatedTimestamp(),
          },
          authorProfile,
          [],
          [],
        ),
      ),
      pdfUploadFailed,
    };
  }
}

export async function createCommunityComment(postId, comment) {
  const authorProfile = resolveDemoProfile(comment.studentProfile);
  const payload = buildCommentPayload(postId, comment);

  if (!isSupabaseConfigured) {
    const createdComment = normalizeComment(
      {
        id: Date.now(),
        ...payload,
        created_at: createCreatedTimestamp(),
      },
      authorProfile,
    );

    updateMockPosts((posts) =>
      posts.map((post) =>
        String(post.id) === String(postId)
          ? {
            ...post,
            commentCount: Number(post.commentCount ?? post.comment_count ?? 0) + 1,
            comment_count: Number(post.comment_count ?? post.commentCount ?? 0) + 1,
            comments: [...(post.comments ?? []), createdComment],
          }
          : post,
      ),
    );

    return createdComment;
  }

  const { data, error } = await supabase.from("community_comments").insert(payload).select("*").single();
  if (error) throw error;
  return normalizeComment(data, authorProfile);
}

export async function toggleCommunityPostVote(postId, userId, voteType = "upvote") {
  const normalizedVoteType = `${voteType ?? ""}`.trim().toLowerCase();
  if (!userId) throw new Error("A user id is required to vote.");
  if (!["upvote", "downvote"].includes(normalizedVoteType)) throw new Error("A valid vote type is required.");

  if (!isSupabaseConfigured) {
    let updatedPost = null;
    updateMockPosts((posts) =>
      posts.map((post) => {
        if (String(post.id) !== String(postId)) return post;
        const currentUpIds = Array.isArray(post.upvoterIds) ? post.upvoterIds.map(String) : [];
        const currentDownIds = Array.isArray(post.downvoterIds) ? post.downvoterIds.map(String) : [];
        const hasUpvote = currentUpIds.includes(String(userId));
        const hasDownvote = currentDownIds.includes(String(userId));
        let nextUpIds = currentUpIds;
        let nextDownIds = currentDownIds;

        if (normalizedVoteType === "upvote") {
          if (hasUpvote) nextUpIds = currentUpIds.filter((id) => id !== String(userId));
          else {
            nextUpIds = [...currentUpIds, String(userId)];
            nextDownIds = currentDownIds.filter((id) => id !== String(userId));
          }
        } else if (hasDownvote) {
          nextDownIds = currentDownIds.filter((id) => id !== String(userId));
        } else {
          nextDownIds = [...currentDownIds, String(userId)];
          nextUpIds = currentUpIds.filter((id) => id !== String(userId));
        }

        updatedPost = {
          ...post,
          upvoterIds: nextUpIds,
          downvoterIds: nextDownIds,
          upvoteCount: nextUpIds.length,
          upvote_count: nextUpIds.length,
          downvoteCount: nextDownIds.length,
          downvote_count: nextDownIds.length,
          voteScore: nextUpIds.length - nextDownIds.length,
          vote_score: nextUpIds.length - nextDownIds.length,
        };
        return updatedPost;
      }),
    );
    return updatedPost;
  }

  const { data: existingVote, error: existingVoteError } = await supabase
    .from("community_votes")
    .select("id, vote_type")
    .eq("post_id", postId)
    .eq("user_id", userId)
    .maybeSingle();

  if (existingVoteError) throw existingVoteError;

  if (existingVote?.id && `${existingVote.vote_type ?? ""}`.toLowerCase() === normalizedVoteType) {
    const { error } = await supabase.from("community_votes").delete().eq("id", existingVote.id);
    if (error) throw error;
  } else if (existingVote?.id) {
    const { error } = await supabase
      .from("community_votes")
      .update({ vote_type: normalizedVoteType })
      .eq("id", existingVote.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("community_votes").insert({
      user_id: userId,
      post_id: postId,
      vote_type: normalizedVoteType,
    });
    if (error) throw error;
  }

  return true;
}

export async function toggleCommunityPostUpvote(postId, userId) {
  return toggleCommunityPostVote(postId, userId, "upvote");
}

export async function updateCommunityPost(postId, updates) {
  const payload = {
    ...updates,
    updated_at: createCreatedTimestamp(),
  };

  if (!isSupabaseConfigured) {
    let updatedPost = null;
    updateMockPosts((posts) =>
      posts.map((post) => {
        if (String(post.id) !== String(postId)) return post;
        updatedPost = {
          ...post,
          ...updates,
        };
        return updatedPost;
      }),
    );
    return updatedPost;
  }

  const { data, error } = await supabase.from("community_posts").update(payload).eq("id", postId).select("*").single();
  if (error) throw error;
  return data;
}

export async function updateCommunityComment(commentId, updates) {
  const payload = {
    ...updates,
    updated_at: createCreatedTimestamp(),
  };

  if (!isSupabaseConfigured) {
    let updatedComment = null;
    updateMockPosts((posts) =>
      posts.map((post) => ({
        ...post,
        comments: (post.comments ?? []).map((comment) => {
          if (String(comment.id) !== String(commentId)) return comment;
          updatedComment = {
            ...comment,
            ...updates,
          };
          return updatedComment;
        }),
      })),
    );
    return updatedComment;
  }

  const { data, error } = await supabase.from("community_comments").update(payload).eq("id", commentId).select("*").single();
  if (error) throw error;
  return data;
}

export function isModeratorRole(role) {
  return MODERATOR_ROLES.has(normalizeRole(role));
}
