import { isSupabaseConfigured, supabase } from "../lib/supabaseClient.js";
import { normalizeCountrySelection } from "../data/countries.js";
import { createMockId, getMockCommunityPosts, getMockUsers, setMockCommunityPosts } from "./mockStore.js";
import { DEMO_STUDENT_EMAIL, DEMO_STUDENT_NAME } from "./userService.js";
import { uploadCommunityPdf } from "./storageService.js";
import { getStoragePublicUrl } from "./storageService.js";

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
  const normalizedCountry = normalizeCountrySelection(
    row.author_country_code ??
      row.authorCountryCode ??
      row.country_code ??
      row.countryCode ??
      row.author_country_name ??
      row.authorCountryName ??
      row.country_name ??
      row.countryName ??
      row.author_country_flag ??
      row.authorCountryFlag ??
      row.country_flag ??
      row.countryFlag ??
      row.country ??
      fallback.country_code ??
      fallback.countryCode ??
      fallback.country_name ??
      fallback.countryName ??
      fallback.country_flag ??
      fallback.countryFlag ??
      fallback.country,
  );
  const profilePictureUrl =
    row.profile_picture_url ?? row.profilePictureUrl ?? fallback.profilePictureUrl ?? fallback.profile_picture_url ?? "";

  return {
    author: name,
    authorEmail: email,
    authorRole: role,
    country: normalizedCountry.country,
    authorCountryCode: normalizedCountry.countryCode,
    author_country_code: normalizedCountry.countryCode,
    countryCode: normalizedCountry.countryCode,
    country_code: normalizedCountry.countryCode,
    authorCountryName: normalizedCountry.countryName,
    author_country_name: normalizedCountry.countryName,
    countryName: normalizedCountry.countryName,
    country_name: normalizedCountry.countryName,
    authorCountryFlag: normalizedCountry.countryFlag,
    author_country_flag: normalizedCountry.countryFlag,
    countryFlag: normalizedCountry.countryFlag,
    country_flag: normalizedCountry.countryFlag,
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
  const pdfStoragePath =
    row.pdf_storage_path ??
    row.pdfStoragePath ??
    row.attachment_storage_path ??
    row.attachmentStoragePath ??
    "";
  const pdfPublicUrl =
    row.pdf_public_url ??
    row.pdfPublicUrl ??
    row.pdf_url ??
    row.pdfUrl ??
    row.attachment_public_url ??
    row.attachmentPublicUrl ??
    row.attachment_url ??
    row.attachmentUrl ??
    (pdfStoragePath ? getStoragePublicUrl("community-pdfs", pdfStoragePath) : "");
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
    pdfFileName: row.pdf_file_name ?? row.pdfFileName ?? row.attachment_file_name ?? row.attachmentFileName ?? "",
    pdfStoragePath,
    pdfPublicUrl,
    pdfFileSize: row.pdf_file_size ?? row.pdfFileSize ?? row.attachment_file_size ?? row.attachmentFileSize ?? null,
    pdfUploadedAt: row.pdf_uploaded_at ?? row.pdfUploadedAt ?? row.attachment_uploaded_at ?? row.attachmentUploadedAt ?? null,
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
    countryCode: fallbackUser?.countryCode ?? fallbackUser?.country_code ?? "",
    countryFlag: fallbackUser?.countryFlag ?? fallbackUser?.country_flag ?? "",
    role: normalizeRole(fallbackUser?.roleKey ?? fallbackUser?.role ?? "student"),
    profilePictureUrl: fallbackUser?.profilePictureUrl ?? fallbackUser?.profile_picture_url ?? "",
    initials: initialsFromName(fallbackUser?.name ?? DEMO_STUDENT_NAME),
  };
}

function createCreatedTimestamp() {
  return new Date().toISOString();
}

function getErrorMessage(error, fallback = "Unknown error") {
  if (!error) return fallback;
  if (typeof error === "string") return error.trim() || fallback;
  if (error instanceof Error && typeof error.message === "string" && error.message.trim()) return error.message.trim();
  if (typeof error.message === "string" && error.message.trim()) return error.message.trim();
  if (typeof error.error_description === "string" && error.error_description.trim()) {
    return error.error_description.trim();
  }
  if (typeof error.details === "string" && error.details.trim()) return error.details.trim();
  if (typeof error.hint === "string" && error.hint.trim()) return error.hint.trim();
  if (error.code) return `Code: ${error.code}`;
  if (error.statusCode) return `Status ${error.statusCode}`;
  if (error.status) return `Status ${error.status}`;
  try {
    const serialized = JSON.stringify(error, Object.getOwnPropertyNames(error));
    return serialized && serialized !== "{}" ? serialized : fallback;
  } catch {
    try {
      return String(error);
    } catch {
      return fallback;
    }
  }
}

function createCommunityPdfDebug(overrides = {}) {
  return {
    step: "",
    bucketName: "community-pdfs",
    storagePath: "",
    postId: "",
    fileName: "",
    fileType: "",
    fileSize: null,
    uploadData: null,
    uploadErrorMessage: "",
    updateErrorMessage: "",
    ...overrides,
  };
}

function buildPostPayload(post) {
  const authorProfile = resolveDemoProfile(post.studentProfile);
  const normalizedCategory = `${post.category ?? "discussion"}`.trim().toLowerCase() || "discussion";
  const normalizedCountry = normalizeCountrySelection(
    authorProfile.countryCode ??
      authorProfile.country_code ??
      authorProfile.countryName ??
      authorProfile.country_name ??
      authorProfile.countryFlag ??
      authorProfile.country_flag ??
      authorProfile.country,
  );

  return {
    student_id: post.studentId ?? authorProfile.id ?? null,
    author_id: post.studentId ?? authorProfile.id ?? null,
    author_name: post.author ?? authorProfile.name ?? DEMO_STUDENT_NAME,
    author_role: normalizeRole(post.authorRole ?? authorProfile.role ?? "student"),
    author_country_code: normalizedCountry.countryCode || null,
    author_country_name: normalizedCountry.countryName || null,
    author_country_flag: normalizedCountry.countryFlag || null,
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
  let communityPdfDebug = createCommunityPdfDebug({
    step: pdfFile ? "ready-to-validate" : "text-only-post",
    fileName: pdfFile?.name ?? "",
    fileType: pdfFile?.type ?? "",
    fileSize: typeof pdfFile?.size === "number" ? pdfFile.size : null,
  });

  console.log("[Community PDF] selected file", pdfFile);
  if (pdfFile) {
    console.log("[Community PDF] validating file", pdfFile.name, pdfFile.type, pdfFile.size);
  }

  if (!isSupabaseConfigured) {
    const createdId = createMockId(getMockCommunityPosts());
    let pdfMetadata = {};

    if (pdfFile) {
      console.log("[Community PDF] created post id", createdId);
      const uploadResult = await uploadCommunityPdf(pdfFile, createdId);
      console.log("[Community PDF] upload result", uploadResult, null);
      pdfMetadata = {
        pdf_file_name: uploadResult.fileName,
        pdf_storage_path: uploadResult.storagePath,
        pdf_public_url: uploadResult.publicUrl,
        pdf_file_size: uploadResult.fileSize,
        pdf_uploaded_at: createCreatedTimestamp(),
      };
      console.log("[Community PDF] updating post with pdf metadata", pdfMetadata);
    }

    const finalPost = createMockPost(
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
      );
    console.log("[Community PDF] final post", finalPost);
    return {
      post: finalPost,
      pdfUploadFailed: false,
      communityPdfDebug,
    };
  }

  if (!supabase) {
    throw new Error("Supabase client is not initialized.");
  }

  try {
    console.log("[Community PDF] creating post");
    const { data, error } = await supabase.from("community_posts").insert(payload).select("*").single();
    console.log("[Community PDF] created post result", data, error);
    if (error) throw error;
    console.log("[Community PDF] created post:", data);
    if (!data?.id) {
      return {
        post: normalizePost(data ?? payload, authorProfile, [], []),
        pdfUploadFailed: true,
        missingPostId: true,
        uploadErrorMessage: "Post was created, but the PDF could not upload because the post ID was missing.",
        communityPdfDebug: {
          ...communityPdfDebug,
          step: "missing-post-id",
        },
      };
    }
    let normalizedPost = normalizePost(data, authorProfile, [], []);
    let pdfUploadFailed = false;
    let updateFailed = false;
    let uploadErrorMessage = "";
    let updateErrorMessage = "";
    communityPdfDebug = {
      ...communityPdfDebug,
      step: "post-created",
      postId: data.id,
    };

    if (pdfFile) {
      try {
        const bucketName = "community-pdfs";
        const isPdf =
          pdfFile.type === "application/pdf" ||
          `${pdfFile.name ?? ""}`.toLowerCase().endsWith(".pdf");
        if (!pdfFile) {
          throw new Error("PDF file was selected but missing during upload.");
        }
        if (!isPdf) {
          throw new Error("Selected file is not a valid PDF.");
        }
        if (Number(pdfFile.size ?? 0) > 25 * 1024 * 1024) {
          throw new Error("Selected PDF exceeds the 25 MB limit.");
        }
        console.log("[Community PDF] bucket:", bucketName);
        console.log("[Community PDF] post id:", data.id);
        console.log("[Community PDF] file:", {
          name: pdfFile?.name,
          type: pdfFile?.type,
          size: pdfFile?.size,
        });
        console.log("[Community PDF] file before upload", pdfFile);
        console.log("[Community PDF] created post id", data.id);
        communityPdfDebug = {
          ...communityPdfDebug,
          step: "upload-starting",
          bucketName,
          postId: data.id,
          fileName: pdfFile?.name ?? "",
          fileType: pdfFile?.type ?? "",
          fileSize: typeof pdfFile?.size === "number" ? pdfFile.size : null,
        };
        const uploadResult = await uploadCommunityPdf(pdfFile, data.id);
        console.log("[Community PDF] upload data:", uploadResult?.uploadData);
        console.log("[Community PDF] storage path:", uploadResult?.storagePath);
        console.log("[Community PDF] public url result", uploadResult?.publicUrl);
        if (!uploadResult?.uploadData) {
          throw new Error("Storage upload returned no data and no error.");
        }
        if (!uploadResult?.publicUrl) {
          throw new Error("PDF uploaded, but Supabase did not return a public URL.");
        }
        communityPdfDebug = {
          ...communityPdfDebug,
          step: "upload-succeeded",
          storagePath: uploadResult?.storagePath ?? "",
          uploadData: uploadResult?.uploadData ?? null,
        };
        const pdfPayload = {
          pdf_file_name: uploadResult.fileName,
          pdf_storage_path: uploadResult.storagePath,
          pdf_public_url: uploadResult.publicUrl,
          pdf_file_size: uploadResult.fileSize,
          pdf_uploaded_at: createCreatedTimestamp(),
        };
        console.log("[Community PDF] updating post with pdf metadata", pdfPayload);
        try {
          const { data: updatedPost, error: updateError } = await supabase
            .from("community_posts")
            .update(pdfPayload)
            .eq("id", data.id)
            .select("*")
            .single();
          console.log("[Community PDF] update result", updatedPost, updateError);
          if (updateError) throw updateError;
          if (
            !updatedPost?.pdf_file_name ||
            !updatedPost?.pdf_storage_path ||
            !updatedPost?.pdf_public_url
          ) {
            throw new Error("community_posts update succeeded but returned post is missing PDF metadata.");
          }
          communityPdfDebug = {
            ...communityPdfDebug,
            step: "metadata-saved",
          };
          normalizedPost = normalizePost(updatedPost, authorProfile, [], []);
        } catch (updateError) {
          console.error("Updating the community post with PDF metadata failed:", updateError);
          updateFailed = true;
          updateErrorMessage = getErrorMessage(updateError, "The post could not be updated with the attachment.");
          communityPdfDebug = {
            ...communityPdfDebug,
            step: "metadata-update-failed",
            updateErrorMessage,
          };
        }
      } catch (pdfError) {
        console.error("Uploading the community PDF failed after post creation:", pdfError);
        console.error("[Community PDF] upload error object:", pdfError);
        console.error("[Community PDF] upload error message:", getErrorMessage(pdfError));
        console.error("[Community PDF] upload failed", {
          bucketName: "community-pdfs",
          storagePath: `community-posts/${data.id}/<timestamp>-<safeFileName>`,
          fileName: pdfFile?.name,
          fileType: pdfFile?.type,
          fileSize: pdfFile?.size,
          uploadError: pdfError,
        });
        pdfUploadFailed = true;
        uploadErrorMessage = getErrorMessage(pdfError, "Unknown error");
        communityPdfDebug = {
          ...communityPdfDebug,
          step: "upload-failed",
          bucketName: pdfError?.bucketName || communityPdfDebug.bucketName,
          storagePath: pdfError?.storagePath || communityPdfDebug.storagePath,
          uploadErrorMessage,
        };
      }
    }

    console.log("[Community PDF] final post", normalizedPost);
    return {
      post: normalizedPost,
      pdfUploadFailed,
      updateFailed,
      uploadErrorMessage,
      updateErrorMessage,
      communityPdfDebug,
    };
  } catch (error) {
    const uploadErrorMessage = getErrorMessage(error, "Unknown error: no readable error details were returned");
    console.error("[Community PDF] caught exception:", error);
    console.error("[Community PDF] caught exception message:", uploadErrorMessage);
    throw Object.assign(
      new Error(uploadErrorMessage),
      {
        communityPdfDebug: {
          ...communityPdfDebug,
          step: communityPdfDebug.step || "post-create-failed",
          uploadErrorMessage,
        },
      },
    );
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

export async function deleteCommunityPost(postId) {
  if (!postId) {
    throw new Error("A valid post id is required.");
  }

  if (!isSupabaseConfigured) {
    updateMockPosts((posts) => posts.filter((post) => String(post.id) !== String(postId)));
    return { ok: true };
  }

  const { error: commentsError } = await supabase.from("community_comments").delete().eq("post_id", postId);
  if (commentsError) throw commentsError;

  const { error: votesError } = await supabase.from("community_votes").delete().eq("post_id", postId);
  if (votesError) throw votesError;

  const { error: postError } = await supabase.from("community_posts").delete().eq("id", postId);
  if (postError) throw postError;

  return { ok: true };
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
