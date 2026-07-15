import React, { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "./ui.jsx";
import { isModeratorRole } from "../services/communityService.js";
import { useLanguage } from "../i18n/LanguageContext.jsx";
import { getEmbeddablePdfUrl } from "../utils/mediaLinks.js";

const TITLE_LIMIT = 140;
const COMMUNITY_PDF_MAX_BYTES = 25 * 1024 * 1024;
const BAD_LINKS_PATTERN = /(https?:\/\/\S+\s*){3,}/i;
const PAYMENT_INFO_PATTERN = /\b(?:\d[ -]*?){13,16}\b/;
const REPEATED_CHAR_PATTERN = /(.)\1{7,}/;
const ABUSIVE_PATTERN = /\b(?:idiot|stupid|moron|hate)\b/i;

const categoryKeys = ["question", "discussion", "announcement", "resource", "support"];
const sortKeys = ["new", "commented", "pinned"];
const filterKeys = ["all", "question", "discussion", "announcement", "resource", "support", "resolved", "unresolved", "mine"];
const removalReasons = ["spam", "harassment", "inappropriate", "off_topic", "private_information", "other"];

function normalizeRole(role) {
  return `${role ?? ""}`.trim().toLowerCase();
}

function initialsFromName(name) {
  return (name || "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "NP";
}

function formatDate(value, language = "es") {
  if (!value) return "";
  try {
    return new Date(value).toLocaleDateString(language === "es" ? "es-ES" : "en-US", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return value;
  }
}

function getRoleLabel(t, role) {
  const normalized = normalizeRole(role);
  return t(`roles.${normalized}`) || role;
}

function detectPostWarning(title, body) {
  const combined = `${title ?? ""} ${body ?? ""}`.trim();
  if (!combined) return false;
  return (
    BAD_LINKS_PATTERN.test(combined) ||
    PAYMENT_INFO_PATTERN.test(combined) ||
    REPEATED_CHAR_PATTERN.test(combined) ||
    ABUSIVE_PATTERN.test(combined)
  );
}

function canViewPost(post, canModerate, accessibleCourseIds) {
  if (!post) return false;
  if (canModerate) return true;
  if (post.isRemoved) return false;
  if (!post.courseId) return true;
  return accessibleCourseIds.has(String(post.courseId));
}

function getVisibleComments(post, canModerate) {
  const comments = Array.isArray(post?.comments) ? post.comments : [];
  return comments.filter((comment) => (canModerate ? true : !comment.isRemoved));
}

function getCommentCount(post, canModerate) {
  return getVisibleComments(post, canModerate).length;
}

function getPostCourseTitle(post, courseMap) {
  if (post?.courseTitle) return post.courseTitle;
  return courseMap.get(String(post?.courseId ?? ""))?.title ?? "";
}

function formatFileSize(bytes) {
  const normalizedBytes = Number(bytes);
  if (!Number.isFinite(normalizedBytes) || normalizedBytes <= 0) return "";
  if (normalizedBytes >= 1024 * 1024) return `${(normalizedBytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(normalizedBytes / 1024))} KB`;
}

function getCategoryOptions(t, canModerate) {
  return categoryKeys
    .filter((key) => canModerate || key !== "announcement")
    .map((key) => ({ value: key, label: t(`community.categories.${key}`) }));
}

function getReadableErrorMessage(error) {
  if (!error) return "No error object returned";
  if (typeof error === "string") return error;
  if (error instanceof Error && error.message) return error.message;
  if (error.message) return error.message;
  if (error.error_description) return error.error_description;
  if (error.details) return error.details;
  if (error.hint) return error.hint;
  if (error.code) return `Code: ${error.code}`;
  if (error.statusCode) return `Status code: ${error.statusCode}`;
  if (error.status) return `Status: ${error.status}`;
  try {
    const json = JSON.stringify(error, Object.getOwnPropertyNames(error));
    if (json && json !== "{}") return json;
  } catch {}
  try {
    return String(error);
  } catch {}
  return "Unknown error: no readable error details were returned";
}

function CommunityMetaBadges({ post, courseTitle, canModerate, t }) {
  return (
    <div className="community-badges">
      <span className={`community-badge category-${post.category}`}>{t(`community.categories.${post.category}`)}</span>
      {courseTitle ? <span className="community-badge neutral">{courseTitle}</span> : null}
      {post.isPinned ? <span className="community-badge pinned">{t("community.pinned")}</span> : null}
      {post.isResolved ? <span className="community-badge resolved">{t("community.resolved")}</span> : null}
      {post.isAnnouncement ? <span className="community-badge announcement">{t("community.categories.announcement")}</span> : null}
      {canModerate && post.isRemoved ? <span className="community-badge removed">{t("community.removedByModerator")}</span> : null}
      {post.isLocked ? <span className="community-badge neutral">{t("community.locked")}</span> : null}
    </div>
  );
}

function ModeratorRemovePanel({ value, onChange, onConfirm, onCancel, t }) {
  return (
    <div className="community-remove-panel">
      <label>
        <span>{t("community.removeWhy")}</span>
        <select value={value} onChange={(event) => onChange(event.target.value)}>
          {removalReasons.map((reason) => (
            <option key={reason} value={reason}>
              {t(`community.removalReasons.${reason}`)}
            </option>
          ))}
        </select>
      </label>
      <div className="community-inline-actions">
        <button type="button" className="ghost-btn" onClick={onCancel}>
          {t("common.cancel")}
        </button>
        <button type="button" className="danger-btn" onClick={onConfirm}>
          {t("community.confirmRemove")}
        </button>
      </div>
    </div>
  );
}

export function CommunityBoard({
  posts,
  currentUser,
  courses,
  onCreatePost,
  onCreateComment,
  onUpdatePost,
  onDeletePost,
  onUpdateComment,
}) {
  const { t, language } = useLanguage();
  const normalizedRole = normalizeRole(currentUser?.roleKey ?? currentUser?.role ?? "student");
  const canModerate = isModeratorRole(normalizedRole);
  const accessibleCourses = Array.isArray(courses) ? courses : [];
  const courseMap = useMemo(
    () => new Map(accessibleCourses.map((course) => [String(course.id), course])),
    [accessibleCourses],
  );
  const accessibleCourseIds = useMemo(
    () => new Set(accessibleCourses.map((course) => String(course.id))),
    [accessibleCourses],
  );
  const [composer, setComposer] = useState({
    title: "",
    body: "",
    tags: "",
    pdfFile: null,
  });
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("new");
  const [expandedPostId, setExpandedPostId] = useState(null);
  const [commentDrafts, setCommentDrafts] = useState({});
  const [message, setMessage] = useState({ type: "", text: "" });
  const [validation, setValidation] = useState("");
  const [warning, setWarning] = useState("");
  const [removeDrafts, setRemoveDrafts] = useState({});
  const [communityPdfDebug, setCommunityPdfDebug] = useState(null);
  const [pendingDeletePostId, setPendingDeletePostId] = useState(null);
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const composerBodyRef = useRef(null);

  useEffect(() => {
    if (isComposerOpen) {
      composerBodyRef.current?.focus();
    }
  }, [isComposerOpen]);

  const visiblePosts = useMemo(() => {
    const safePosts = Array.isArray(posts) ? posts : [];
    const filteredPosts = safePosts.filter((post) => {
      if (!canViewPost(post, canModerate, accessibleCourseIds)) return false;
      if (post.isRemoved) return false;

      const courseTitle = getPostCourseTitle(post, courseMap);
      const searchValue = search.trim().toLowerCase();
      if (searchValue) {
        const haystack = [
          post.title,
          post.body,
          post.author,
          courseTitle,
          ...(Array.isArray(post.tags) ? post.tags : []),
        ]
          .join(" ")
          .toLowerCase();

        if (!haystack.includes(searchValue)) return false;
      }

      if (filter === "mine" && String(post.studentId) !== String(currentUser?.id ?? "")) return false;
      if (filter === "resolved" && !post.isResolved) return false;
      if (filter === "unresolved" && post.isResolved) return false;
      if (categoryKeys.includes(filter) && post.category !== filter) return false;

      return true;
    });

    return filteredPosts.sort((left, right) => {
      if (left.isPinned !== right.isPinned) return left.isPinned ? -1 : 1;
      if (sort === "pinned") return left.isPinned === right.isPinned ? 0 : left.isPinned ? -1 : 1;
      if (sort === "commented") return getCommentCount(right, canModerate) - getCommentCount(left, canModerate);
      return new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime();
    });
  }, [accessibleCourseIds, canModerate, courseMap, currentUser?.id, filter, posts, search, sort]);

  const moderationPosts = useMemo(() => {
    if (!canModerate) return [];
    return (Array.isArray(posts) ? posts : [])
      .filter((post) => Boolean(post?.isRemoved))
      .sort((left, right) => new Date(right.removedAt || right.createdAt || 0).getTime() - new Date(left.removedAt || left.createdAt || 0).getTime());
  }, [canModerate, posts]);

  const setComposerValue = (field, value) => {
    setComposer((current) => ({ ...current, [field]: value }));
  };

  const resetComposer = () => {
    setComposer({
      title: "",
      body: "",
      tags: "",
      pdfFile: null,
    });
    setValidation("");
    setWarning("");
    setCommunityPdfDebug(null);
  };

  const handleSubmitPost = async (event) => {
    event.preventDefault();
    setValidation("");
    setMessage({ type: "", text: "" });
    setCommunityPdfDebug(null);

    const title = composer.title.trim();
    const body = composer.body.trim();
    const pdfFile = composer.pdfFile;
    if (!body) {
      setValidation(t("community.validation.required"));
      return;
    }
    if (title.length > TITLE_LIMIT) {
      setValidation(t("community.validation.titleLimit", { count: TITLE_LIMIT }));
      return;
    }
    if (pdfFile && pdfFile.type !== "application/pdf" && !`${pdfFile.name ?? ""}`.toLowerCase().endsWith(".pdf")) {
      setValidation(t("community.pdfOnlyError"));
      return;
    }
    if (pdfFile && Number(pdfFile.size ?? 0) > COMMUNITY_PDF_MAX_BYTES) {
      setValidation(t("community.pdfSizeError"));
      return;
    }

    const nextWarning = detectPostWarning(title, body) ? t("community.warningGuidelines") : "";
    setWarning(nextWarning);

    try {
      const result = await onCreatePost({
        studentId: currentUser?.id,
        studentProfile: currentUser,
        author: currentUser?.name,
        authorRole: normalizedRole,
        title: title || body.slice(0, TITLE_LIMIT).trim(),
        body,
        category: "discussion",
        courseId: null,
        tags: composer.tags,
        isPinned: false,
        pdfFile,
      });
      setCommunityPdfDebug(result?.communityPdfDebug ?? null);
      const hasPdfFailure = result?.pdfUploadFailed || result?.updateFailed || result?.missingPostId;
      if (!hasPdfFailure) {
        resetComposer();
        setIsComposerOpen(false);
      }
      setMessage({
        type: hasPdfFailure ? "warning" : "success",
        text: result?.missingPostId
          ? t("community.pdfMissingPostId")
          : result?.updateFailed
            ? `${t("community.pdfMetadataUpdateFailed")} ${result?.updateErrorMessage || "Unknown error"}`.trim()
            : result?.pdfUploadFailed
              ? `${t("community.pdfUploadFailedPrefix")} ${result?.uploadErrorMessage || "Unknown error"}`.trim()
              : t("community.postPublished"),
      });
    } catch (error) {
      console.error("Creating a community post failed:", error);
      setCommunityPdfDebug(error?.communityPdfDebug ?? null);
      setMessage({ type: "error", text: `${t("community.pdfUploadFailedPrefix")} ${getReadableErrorMessage(error)}` });
    }
  };

  const handleSubmitComment = async (post) => {
    const body = `${commentDrafts[post.id] ?? ""}`.trim();
    if (!body) return;

    try {
      await onCreateComment(post.id, {
        studentId: currentUser?.id,
        studentProfile: currentUser,
        author: currentUser?.name,
        authorRole: normalizedRole,
        body,
      });
      setCommentDrafts((current) => ({ ...current, [post.id]: "" }));
      setMessage({ type: "success", text: t("community.commentPublished") });
    } catch (error) {
      console.error("Creating a community comment failed:", error);
      setMessage({ type: "error", text: t("community.errorLoad") });
    }
  };

  const handleUpdatePostAction = async (postId, updates, successKey = "") => {
    try {
      await onUpdatePost(postId, updates);
      if (successKey) setMessage({ type: "success", text: t(successKey) });
    } catch (error) {
      console.error("Updating a community post failed:", error);
      setMessage({ type: "error", text: t("community.moderationFailed") });
    }
  };

  const handleUpdateCommentAction = async (commentId, updates, successKey = "") => {
    try {
      await onUpdateComment(commentId, updates);
      if (successKey) setMessage({ type: "success", text: t(successKey) });
    } catch (error) {
      console.error("Updating a community comment failed:", error);
      setMessage({ type: "error", text: t("community.moderationFailed") });
    }
  };

  const handleDeletePost = async (postId) => {
    try {
      await onDeletePost?.(postId);
      setPendingDeletePostId(null);
      setMessage({ type: "success", text: t("community.postPermanentlyDeleted") });
    } catch (error) {
      console.error("Deleting a community post permanently failed:", error);
      setMessage({ type: "error", text: t("community.moderationFailed") });
    }
  };

  const feedEmpty = !visiblePosts.length;
  const hasSearch = Boolean(search.trim());
  const pdfInputId = "community-post-pdf";

  return (
    <div className="community-forum-layout">
      <section className="community-main">
        {isComposerOpen ? (
          <form className="section-card community-composer" onSubmit={handleSubmitPost}>
            <div className="community-composer-head">
              <div className="community-composer-title">
                <span className="community-composer-icon">
                  <Icon name="plus" size={20} />
                </span>
                <div>
                  <h3>{t("community.createPost")}</h3>
                  <p>{t("community.intro")}</p>
                </div>
              </div>

              <div className="community-inline-actions">
                <button className="primary-btn" type="submit">
                  <Icon name="plus" />
                  {t("community.publish")}
                </button>
                <button
                  className="ghost-btn"
                  type="button"
                  onClick={() => {
                    resetComposer();
                    setIsComposerOpen(false);
                  }}
                >
                  {t("common.cancel")}
                </button>
              </div>
            </div>

            <div className="community-composer-body">
              <label className="full-span">
                <span>{t("community.sharePrompt")}</span>
                <textarea
                  ref={composerBodyRef}
                  rows="3"
                  value={composer.body}
                  onChange={(event) => setComposerValue("body", event.target.value)}
                  placeholder={t("community.sharePrompt")}
                />
              </label>

              <div className="community-composer-controls">
                <label>
                  <span>{t("community.postTitle")}</span>
                  <input
                    value={composer.title}
                    maxLength={TITLE_LIMIT}
                    onChange={(event) => setComposerValue("title", event.target.value)}
                    placeholder={t("community.postTitle")}
                  />
                </label>

                <label>
                  <span>{t("community.tags")}</span>
                  <input
                    value={composer.tags}
                    onChange={(event) => setComposerValue("tags", event.target.value)}
                    placeholder={t("community.tagsPlaceholder")}
                  />
                </label>

                <div className="community-file-control">
                  <span>{t("community.attachPdf")}</span>
                  <input
                    id={pdfInputId}
                    className="community-file-input"
                    type="file"
                    accept=".pdf,application/pdf"
                    onChange={(event) => setComposerValue("pdfFile", event.target.files?.[0] ?? null)}
                  />
                  <label htmlFor={pdfInputId} className="ghost-btn community-file-trigger">
                    {composer.pdfFile ? t("community.replacePdf") : t("community.attachPdf")}
                  </label>
                </div>
              </div>

              <div className="community-composer-meta">
                <span className="community-field-helper">{t("community.attachPdfHelp")}</span>
                {composer.pdfFile ? (
                  <div className="community-attachment-chip">
                    <span>{composer.pdfFile.name}</span>
                    <button type="button" className="ghost-btn" onClick={() => setComposerValue("pdfFile", null)}>
                      {t("community.removePdf")}
                    </button>
                  </div>
                ) : (
                  <span className="community-field-helper">{t("community.attachPdfLimit")}</span>
                )}
              </div>
            </div>

            {validation ? <div className="community-alert error">{validation}</div> : null}
            {warning ? <div className="community-alert warning">{warning}</div> : null}
          </form>
        ) : (
          <button type="button" className="section-card community-compose-trigger" onClick={() => setIsComposerOpen(true)}>
            <span className="community-composer-icon">
              <Icon name="plus" size={20} />
            </span>
            <span className="community-compose-trigger-copy">
              <strong>{t("community.createPost")}</strong>
              <small>{t("community.intro")}</small>
            </span>
          </button>
        )}

        {message.text ? <div className={`community-alert ${message.type}`}>{message.text}</div> : null}

        {(import.meta.env.DEV || canModerate) && communityPdfDebug ? (
          <div className="community-alert warning">
            <strong>{t("community.pdfDebugInfo")}</strong>
            <div className="community-debug-grid">
              <span>{t("community.currentStep")}: {communityPdfDebug.step || "unknown"}</span>
              <span>{t("community.bucketName")}: {communityPdfDebug.bucketName || "community-pdfs"}</span>
              <span>{t("community.storagePath")}: {communityPdfDebug.storagePath || "—"}</span>
              <span>{t("community.postId")}: {communityPdfDebug.postId || "—"}</span>
              <span>{t("community.fileName")}: {communityPdfDebug.fileName || "—"}</span>
              <span>{t("community.fileType")}: {communityPdfDebug.fileType || "—"}</span>
              <span>{t("community.fileSize")}: {communityPdfDebug.fileSize ? formatFileSize(communityPdfDebug.fileSize) : "—"}</span>
              <span>{t("community.failurePoint")}: {communityPdfDebug.uploadErrorMessage || communityPdfDebug.updateErrorMessage || "—"}</span>
            </div>
          </div>
        ) : null}

        <div className="section-card community-toolbar">
          <label className="community-search">
            <Icon name="community" size={16} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("community.search")}
            />
          </label>

          <div className="community-toolbar-row">
            <select value={filter} onChange={(event) => setFilter(event.target.value)}>
              {filterKeys.map((key) => (
                <option key={key} value={key}>
                  {t(`community.filters.${key}`)}
                </option>
              ))}
            </select>

            <select value={sort} onChange={(event) => setSort(event.target.value)}>
              {sortKeys.map((key) => (
                <option key={key} value={key}>
                  {t(`community.sort.${key}`)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="community-feed">
          {feedEmpty ? (
            <section className="section-card">
              <h3>{hasSearch ? t("community.noSearchResultsTitle") : t("community.noPostsTitle")}</h3>
              <p>{hasSearch ? t("community.noSearchResultsBody") : t("community.noPostsBody")}</p>
            </section>
          ) : (
            visiblePosts.map((post) => {
              const expanded = expandedPostId === post.id;
              const courseTitle = getPostCourseTitle(post, courseMap);
              const comments = getVisibleComments(post, canModerate);
              const hasPdfMetadata = Boolean(post.pdfFileName || post.pdfStoragePath || post.pdfPublicUrl);
              const canShowPdf = Boolean(post.pdfPublicUrl);
              const canResolvePost = canModerate || String(post.studentId ?? "") === String(currentUser?.id ?? "");
              const removeKey = `post-${post.id}`;
              const removeState = removeDrafts[removeKey];

              return (
                <article key={post.id} className={`section-card community-post-card ${post.isAnnouncement ? "is-announcement" : ""} ${post.isRemoved ? "is-removed" : ""}`}>
                  <div className="community-post-shell">
                    <div className="community-post-content">
                      <div className="community-post-topline">
                        {(post.profilePictureUrl || post.profile_picture_url) ? (
                          <img className="post-avatar avatar-image" src={post.profilePictureUrl || post.profile_picture_url} alt={post.author} />
                        ) : (
                          <div className="post-avatar">{post.initials || initialsFromName(post.author)}</div>
                        )}

                        <div className="community-author-block">
                          <div className="post-meta">
                            <strong>{post.author}</strong>
                                      <span className={`community-role-badge role-${post.authorRole}`}>{getRoleLabel(t, post.authorRole)}</span>
                            <span>{formatDate(post.createdAt || post.time, language)}</span>
                          </div>
                          <CommunityMetaBadges post={post} courseTitle={courseTitle} canModerate={canModerate} t={t} />
                        </div>
                      </div>

                  <h3>{post.title}</h3>
                      <p className="community-post-body">{expanded ? post.body : post.body}</p>

                      {canShowPdf ? (
                        <div className="community-pdf-card">
                          <div>
                            <span className="community-badge neutral">{t("community.pdfAttached")}</span>
                            <strong>{post.pdfFileName || "community-resource.pdf"}</strong>
                            {post.pdfFileSize ? <small>{formatFileSize(post.pdfFileSize)}</small> : null}
                          </div>
                          <a className="secondary-btn" href={post.pdfPublicUrl} target="_blank" rel="noreferrer">
                            {t("community.openPdf")}
                          </a>
                        </div>
                      ) : canModerate && hasPdfMetadata ? <div className="community-alert warning">{t("community.pdfMetadataMissingUrl")}</div> : null}

                      {Array.isArray(post.tags) && post.tags.length ? (
                        <div className="community-tags">
                          {post.tags.map((tag) => (
                            <span className="community-tag" key={`${post.id}-${tag}`}>#{tag}</span>
                          ))}
                        </div>
                      ) : null}

                      {canModerate && post.isRemoved && post.removalReason ? (
                        <p className="community-removed-note">
                          {t("community.removedByModerator")} · {t(`community.removalReasons.${post.removalReason}`)}
                        </p>
                      ) : null}

                      <div className="community-post-actions">
                        <button type="button" className="ghost-btn" onClick={() => setExpandedPostId(expanded ? null : post.id)}>
                          {t("community.comments")} ({comments.length})
                        </button>

                        {post.category === "question" && canResolvePost && !post.isResolved ? (
                          <button type="button" className="ghost-btn" onClick={() => void handleUpdatePostAction(post.id, { is_resolved: true, resolved_at: new Date().toISOString() }, "community.postResolved")}>
                            {t("community.markResolved")}
                          </button>
                        ) : null}

                        {canModerate ? (
                          <>
                            <button type="button" className="ghost-btn" onClick={() => void handleUpdatePostAction(post.id, { is_pinned: !post.isPinned }, post.isPinned ? "community.postUnpinned" : "community.postPinned")}>
                              {post.isPinned ? t("community.unpin") : t("community.pin")}
                            </button>
                            <button type="button" className="ghost-btn" onClick={() => void handleUpdatePostAction(post.id, { is_locked: !post.isLocked }, post.isLocked ? "community.postUnlocked" : "community.postLocked")}>
                              {post.isLocked ? t("community.unlock") : t("community.lock")}
                            </button>
                            {!post.isRemoved ? (
                              <button
                                type="button"
                                className="danger-btn"
                                onClick={() =>
                                  setRemoveDrafts((current) => ({
                                    ...current,
                                    [removeKey]: { reason: current[removeKey]?.reason || "spam" },
                                  }))
                                }
                              >
                                {t("community.remove")}
                              </button>
                            ) : (
                              <button type="button" className="ghost-btn" onClick={() => void handleUpdatePostAction(post.id, { is_removed: false, removed_at: null, removed_by: null, removal_reason: null }, "community.postRestored")}>
                                {t("community.restore")}
                              </button>
                            )}
                          </>
                        ) : null}
                      </div>

                      {canModerate && removeState && !post.isRemoved ? (
                        <ModeratorRemovePanel
                          value={removeState.reason}
                          onChange={(reason) =>
                            setRemoveDrafts((current) => ({
                              ...current,
                              [removeKey]: { reason },
                            }))
                          }
                          onCancel={() =>
                            setRemoveDrafts((current) => {
                              const next = { ...current };
                              delete next[removeKey];
                              return next;
                            })
                          }
                          onConfirm={() => {
                            void handleUpdatePostAction(post.id, {
                              is_removed: true,
                              removed_at: new Date().toISOString(),
                              removed_by: currentUser?.id ?? null,
                              removal_reason: removeState.reason,
                            }, "community.postMovedToModeration");
                            setRemoveDrafts((current) => {
                              const next = { ...current };
                              delete next[removeKey];
                              return next;
                            });
                          }}
                          t={t}
                        />
                      ) : null}

                      {expanded ? (
                        <div className="community-thread">
                          {canShowPdf ? (
                            <div className="community-pdf-preview">
                              <div className="community-pdf-preview-head">
                                <strong>{post.pdfFileName || "community-resource.pdf"}</strong>
                                {post.pdfFileSize ? <span>{formatFileSize(post.pdfFileSize)}</span> : null}
                              </div>
                              {getEmbeddablePdfUrl(post.pdfPublicUrl) ? (
                                <>
                                  <iframe
                                    title={post.pdfFileName || "Community PDF"}
                                    src={getEmbeddablePdfUrl(post.pdfPublicUrl)}
                                  />
                                  <p>{t("community.pdfPreviewFallback")}</p>
                                </>
                              ) : (
                                <p>{t("community.pdfPreviewFallback")}</p>
                              )}
                              <a className="ghost-btn" href={post.pdfPublicUrl} target="_blank" rel="noreferrer">
                                {t("community.openPdfNewTab")}
                              </a>
                            </div>
                          ) : canModerate && hasPdfMetadata ? <div className="community-alert warning">{t("community.pdfMetadataMissingUrl")}</div> : null}

                          <div className="community-comments">
                            {comments.length ? (
                              comments.map((comment) => {
                                const commentRemoveKey = `comment-${comment.id}`;
                                const commentRemoveState = removeDrafts[commentRemoveKey];

                                return (
                                  <div className={`community-comment ${comment.isRemoved ? "is-removed" : ""}`} key={comment.id}>
                                    <div className="post-meta">
                                      <strong>{comment.author}</strong>
                                      <span className={`community-role-badge role-${comment.authorRole}`}>{getRoleLabel(t, comment.authorRole)}</span>
                                      <span>{formatDate(comment.createdAt || comment.time, language)}</span>
                                      {comment.isHelpfulAnswer ? <span className="community-helpful">{t("community.helpfulAnswer")}</span> : null}
                                    </div>
                                    <p>{comment.isRemoved && !canModerate ? t("community.removedByModerator") : comment.body}</p>

                                    {canModerate ? (
                                      <div className="community-inline-actions">
                                        {post.category === "question" && canResolvePost && !comment.isHelpfulAnswer ? (
                                          <button
                                            type="button"
                                            className="ghost-btn"
                                            onClick={() => {
                                              void handleUpdateCommentAction(comment.id, { is_helpful_answer: true }, "community.commentHelpful");
                                              void handleUpdatePostAction(post.id, { is_resolved: true, resolved_at: new Date().toISOString() });
                                            }}
                                          >
                                            {t("community.helpfulAnswer")}
                                          </button>
                                        ) : null}

                                        {!comment.isRemoved ? (
                                          <button
                                            type="button"
                                            className="danger-btn"
                                            onClick={() =>
                                              setRemoveDrafts((current) => ({
                                                ...current,
                                                [commentRemoveKey]: { reason: current[commentRemoveKey]?.reason || "spam" },
                                              }))
                                            }
                                          >
                                            {t("community.remove")}
                                          </button>
                                        ) : (
                                          <button type="button" className="ghost-btn" onClick={() => void handleUpdateCommentAction(comment.id, { is_removed: false, removed_at: null, removed_by: null, removal_reason: null }, "community.commentRestored")}>
                                            {t("community.restore")}
                                          </button>
                                        )}
                                      </div>
                                    ) : null}

                                    {canModerate && commentRemoveState && !comment.isRemoved ? (
                                      <ModeratorRemovePanel
                                        value={commentRemoveState.reason}
                                        onChange={(reason) =>
                                          setRemoveDrafts((current) => ({
                                            ...current,
                                            [commentRemoveKey]: { reason },
                                          }))
                                        }
                                        onCancel={() =>
                                          setRemoveDrafts((current) => {
                                            const next = { ...current };
                                            delete next[commentRemoveKey];
                                            return next;
                                          })
                                        }
                                        onConfirm={() => {
                                          void handleUpdateCommentAction(comment.id, {
                                            is_removed: true,
                                            removed_at: new Date().toISOString(),
                                            removed_by: currentUser?.id ?? null,
                                            removal_reason: commentRemoveState.reason,
                                          }, "community.commentRemoved");
                                          setRemoveDrafts((current) => {
                                            const next = { ...current };
                                            delete next[commentRemoveKey];
                                            return next;
                                          });
                                        }}
                                        t={t}
                                      />
                                    ) : null}
                                  </div>
                                );
                              })
                            ) : (
                              <p className="community-empty-comments">{t("community.noComments")}</p>
                            )}
                          </div>

                          {!post.isLocked ? (
                            <div className="community-comment-form">
                              <textarea
                                rows="3"
                                value={commentDrafts[post.id] ?? ""}
                                onChange={(event) =>
                                  setCommentDrafts((current) => ({
                                    ...current,
                                    [post.id]: event.target.value,
                                  }))
                                }
                                placeholder={t("community.addComment")}
                              />
                              <button className="secondary-btn" type="button" onClick={() => void handleSubmitComment(post)}>
                                {t("community.postComment")}
                              </button>
                            </div>
                          ) : (
                            <div className="community-alert info">{t("community.lockedPostHelp")}</div>
                          )}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>

        {canModerate ? (
          <section className="section-card community-moderation">
            <div className="section-heading">
              <div>
                <span className="eyebrow">{t("community.moderation")}</span>
                <h3>{t("community.removedPosts")}</h3>
                <p>{t("community.moderationIntro")}</p>
              </div>
            </div>

            {moderationPosts.length ? (
              <div className="community-feed">
                {moderationPosts.map((post) => (
                  <article key={`moderation-${post.id}`} className="section-card community-post-card is-removed">
                    <div className="community-post-content">
                      <div className="community-post-topline">
                        {(post.profilePictureUrl || post.profile_picture_url) ? (
                          <img className="post-avatar avatar-image" src={post.profilePictureUrl || post.profile_picture_url} alt={post.author} />
                        ) : (
                          <div className="post-avatar">{post.initials || initialsFromName(post.author)}</div>
                        )}

                        <div className="community-author-block">
                          <div className="post-meta">
                            <strong>{post.author}</strong>
                            <span className={`community-role-badge role-${post.authorRole}`}>{getRoleLabel(t, post.authorRole)}</span>
                            <span>{formatDate(post.createdAt || post.time, language)}</span>
                          </div>
                          <div className="community-badges">
                            <span className="community-badge removed">{t("community.removed")}</span>
                            {post.removalReason ? <span className="community-badge neutral">{t("community.reason")}: {t(`community.removalReasons.${post.removalReason}`)}</span> : null}
                            {post.removedAt ? <span className="community-badge neutral">{t("community.removedAt")}: {formatDate(post.removedAt, language)}</span> : null}
                            {post.removedBy ? <span className="community-badge neutral">{t("community.removedBy")}: {post.removedBy}</span> : null}
                            {post.pdfPublicUrl || post.pdfFileName ? <span className="community-badge neutral">{t("community.pdfAttached")}</span> : null}
                          </div>
                        </div>
                      </div>

                      <h3>{post.title}</h3>
                      <p className="community-post-body">{post.body}</p>

                      <div className="community-tags">
                        <span className="community-tag">{getCommentCount(post, true)} {t("community.comments")}</span>
                      </div>

                      <div className="community-inline-actions">
                        <button
                          type="button"
                          className="secondary-btn"
                          onClick={() => void handleUpdatePostAction(post.id, { is_removed: false, removed_at: null, removed_by: null, removal_reason: null }, "community.postRestored")}
                        >
                          {t("community.restorePost")}
                        </button>
                        <button
                          type="button"
                          className="danger-btn"
                          onClick={() => setPendingDeletePostId((current) => current === post.id ? null : post.id)}
                        >
                          {t("community.permanentlyDelete")}
                        </button>
                        {post.pdfPublicUrl ? (
                          <a className="ghost-btn" href={post.pdfPublicUrl} target="_blank" rel="noreferrer">
                            {t("community.openPdf")}
                          </a>
                        ) : null}
                      </div>

                      {pendingDeletePostId === post.id ? (
                        <div className="community-alert warning">
                          <strong>{t("community.permanentDeleteWarning")}</strong>
                          <div className="community-inline-actions">
                            <button type="button" className="ghost-btn" onClick={() => setPendingDeletePostId(null)}>
                              {t("common.cancel")}
                            </button>
                            <button type="button" className="danger-btn" onClick={() => void handleDeletePost(post.id)}>
                              {t("community.permanentlyDelete")}
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="community-alert info">
                <strong>{t("community.noPostsInModeration")}</strong>
                <div>{t("community.noPostsInModerationHelp")}</div>
              </div>
            )}
          </section>
        ) : null}
      </section>

    </div>
  );
}
