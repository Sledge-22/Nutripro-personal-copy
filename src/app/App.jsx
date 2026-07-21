import React, { useEffect, useMemo, useState } from "react";
import { Sidebar, Header } from "../components/ui.jsx";
import { ENABLE_AUTH_TEST_TOOLS, isProductionAuthMode } from "../config/authMode.js";
import {
  initialCertificates,
  initialCommunityPosts,
  initialCourses,
  initialStudentProgress,
  initialUsers,
} from "../data/mockData.js";
import { ROUTES, isAdminRoute, isAuthUtilityRoute, isStudentRoute } from "../routes/appRoutes.js";
import { LoginPage } from "../pages/LoginPage.jsx";
import { ForcedPasswordPage } from "../pages/ForcedPasswordPage.jsx";
import { AccessNoticePage } from "../pages/AccessNoticePage.jsx";
import { PrivacyPage } from "../pages/PrivacyPage.jsx";
import { AdminWorkspacePage } from "../pages/AdminWorkspacePage.jsx";
import { StudentWorkspacePage } from "../pages/StudentWorkspacePage.jsx";
import {
  canUpdateUserStatus,
  createAdminUser,
  deleteUser,
  getUserProfileForAuthUser,
  getUsers,
  resetAdminUserPassword,
  sendUserInvitation,
  updateStudentProfile,
  updateUser,
  updateUserStatus,
} from "../services/userService.js";
import {
  completePrivacyConsent,
  completeFirstTimeSetup,
  dismissPrivacyReminder,
  getCurrentSession,
  isAuthConfigured,
  signInWithCredentials,
  signOut,
  subscribeToAuthChanges,
} from "../services/authService.js";
import {
  getCourses,
  createCourse,
  updateCourse,
  deleteCourse,
  getStudentCourses,
} from "../services/courseService.js";
import { setStudentCourseAssignments } from "../services/enrollmentService.js";
import {
  getCertificates,
  generateCertificate,
  getStudentCertificates,
  maybeGenerateCertificate,
} from "../services/certificateService.js";
import { getStudentProgress, updateStudentProgress } from "../services/progressService.js";
import {
  getCommunityPosts,
  createCommunityPost,
  createCommunityComment,
  deleteCommunityPost,
  toggleCommunityPostVote,
  updateCommunityPost,
  updateCommunityComment,
} from "../services/communityService.js";
import { useLanguage } from "../i18n/LanguageContext.jsx";

function getPathname() {
  return window.location.pathname || ROUTES.home;
}

function navigateTo(pathname, replace = false) {
  if (replace) window.history.replaceState({}, "", pathname);
  else window.history.pushState({}, "", pathname);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

function formatSupabaseError(error, fallbackMessage) {
  if (!error) return fallbackMessage;
  if (typeof error === "string") return error;

  const parts = [error.message, error.details, error.hint].filter(Boolean);
  if (error.code) parts.push(`Code: ${error.code}`);
  return parts.length ? parts.join(" ") : fallbackMessage;
}

function isValidUuid(value) {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function upsertCourseList(courses, nextCourse) {
  const existingIndex = courses.findIndex((course) => String(course.id) === String(nextCourse.id));
  if (existingIndex === -1) return [...courses, nextCourse];
  return courses.map((course) => (String(course.id) === String(nextCourse.id) ? nextCourse : course));
}

function toRoleLabel(role) {
  const normalizedRole = `${role ?? ""}`.trim().toLowerCase();
  if (normalizedRole === "admin") return "Admin";
  if (normalizedRole === "student") return "Student";
  if (normalizedRole === "instructor") return "Instructor";
  if (normalizedRole === "support") return "Support";
  return null;
}

function dashboardPathForRole(role) {
  const normalizedRole = `${role ?? ""}`.trim().toLowerCase();
  if (normalizedRole === "admin") return ROUTES.admin.dashboard;
  if (normalizedRole === "student") return ROUTES.student.dashboard;
  return ROUTES.auth.access;
}

function pathMatchesRole(pathname, role) {
  const normalizedRole = `${role ?? ""}`.trim().toLowerCase();
  if (normalizedRole === "admin") return isAdminRoute(pathname);
  if (normalizedRole === "student") return isStudentRoute(pathname);
  return isAuthUtilityRoute(pathname);
}

function isProtectedWorkspaceRoute(pathname) {
  return isAdminRoute(pathname) || isStudentRoute(pathname);
}

function getAccessBlockReason(profile) {
  const statusKey = `${profile?.statusKey ?? profile?.status ?? ""}`.trim().toLowerCase();
  if (statusKey === "inactive") return "inactive";
  if (statusKey === "suspended" || statusKey === "paused") return "suspended";
  return null;
}

function needsPrivacyConsent(profile) {
  return !Boolean(profile?.privacyPolicyAccepted ?? profile?.privacy_policy_accepted);
}

function shouldShowPrivacyReminder(profile) {
  const accepted = Boolean(profile?.privacyPolicyAccepted ?? profile?.privacy_policy_accepted);
  const dismissed = Boolean(
    profile?.privacyConsentReminderDismissed ?? profile?.privacy_consent_reminder_dismissed,
  );
  return accepted && !dismissed;
}

export function App() {
  const { t, language } = useLanguage();
  const productionAuthAvailable = isAuthConfigured();
  const showAuthTestTools = ENABLE_AUTH_TEST_TOOLS;

  const [pathname, setPathname] = useState(getPathname());
  const [authLoading, setAuthLoading] = useState(productionAuthAvailable);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [loginInfo, setLoginInfo] = useState("");
  const [authSession, setAuthSession] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [privacyReminderSeenThisSession, setPrivacyReminderSeenThisSession] = useState(false);
  const [users, setUsers] = useState(initialUsers);
  const [courses, setCourses] = useState(initialCourses);
  const [studentProfile, setStudentProfile] = useState(null);
  const [studentCourses, setStudentCourses] = useState([]);
  const [certificates, setCertificates] = useState(initialCertificates);
  const [studentCertificates, setStudentCertificates] = useState([]);
  const [posts, setPosts] = useState(initialCommunityPosts);
  const [progressState, setProgressState] = useState(initialStudentProgress);

  const activeStudentId = currentUser?.roleKey === "student" ? currentUser?.id ?? null : null;

  useEffect(() => {
    const sync = () => setPathname(getPathname());
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);

  useEffect(() => {
    if (!productionAuthAvailable) {
      setAuthLoading(false);
      return;
    }

    let active = true;

    void (async () => {
      try {
        const { session } = await getCurrentSession();
        if (!active) return;
        setAuthSession(session);
      } catch (error) {
        console.error("Loading the current Supabase session failed:", error);
        if (active) setLoginError(formatSupabaseError(error, t("auth.loadingSessionFailed")));
      } finally {
        if (active) setAuthLoading(false);
      }
    })();

    const subscription = subscribeToAuthChanges((session) => {
      setAuthSession(session);
      setAuthLoading(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [productionAuthAvailable, t]);

  useEffect(() => {
    if (!productionAuthAvailable) return;

    if (!authSession?.user) {
      setCurrentUser(null);
      setPrivacyReminderSeenThisSession(false);
      setLoginInfo("");
      setWorkspaceLoading(false);
      if (pathname !== ROUTES.login && pathname !== ROUTES.privacy) {
        navigateTo(ROUTES.login, true);
      }
      return;
    }

    void loadAuthenticatedWorkspace(authSession.user);
  }, [productionAuthAvailable, authSession, pathname, privacyReminderSeenThisSession]);

  async function loadAuthenticatedWorkspace(authUser) {
    setWorkspaceLoading(true);
    setLoginError("");

    try {
      const profile = await getUserProfileForAuthUser(authUser);
      setCurrentUser(profile);

      const roleKey = profile?.roleKey ?? `${profile?.role ?? ""}`.toLowerCase();
      const nextStudentId = roleKey === "student" ? profile?.id ?? null : null;

      const [
        nextUsers,
        nextCourses,
        nextCertificates,
        nextPosts,
        nextStudentCourses,
        nextStudentCertificates,
        nextProgress,
      ] = await Promise.all([
        getUsers(),
        getCourses(),
        getCertificates(),
        getCommunityPosts(),
        nextStudentId ? getStudentCourses(nextStudentId) : Promise.resolve([]),
        nextStudentId ? getStudentCertificates(nextStudentId) : Promise.resolve([]),
        nextStudentId ? getStudentProgress(nextStudentId) : Promise.resolve(initialStudentProgress),
      ]);

      setUsers(nextUsers);
      setCourses(nextCourses);
      setCertificates(nextCertificates);
      setPosts(nextPosts);
      setStudentProfile(roleKey === "student" ? profile : null);
      setStudentCourses(nextStudentCourses);
      setStudentCertificates(nextStudentCertificates);
      setProgressState(nextProgress);

      const blockedReason = getAccessBlockReason(profile);
      if (blockedReason || !["admin", "student"].includes(roleKey)) {
        if (pathname !== ROUTES.auth.access) navigateTo(ROUTES.auth.access, true);
      } else if (profile?.mustChangePassword || profile?.must_change_password || needsPrivacyConsent(profile)) {
        if (pathname !== ROUTES.auth.changePassword) navigateTo(ROUTES.auth.changePassword, true);
      } else if (shouldShowPrivacyReminder(profile) && !privacyReminderSeenThisSession) {
        if (pathname !== ROUTES.auth.privacyReminder) navigateTo(ROUTES.auth.privacyReminder, true);
      } else if (isProtectedWorkspaceRoute(pathname) && !pathMatchesRole(pathname, roleKey)) {
        navigateTo(ROUTES.accessDenied, true);
      } else if (
        pathname === ROUTES.home ||
        pathname === ROUTES.login ||
        pathname === ROUTES.accessDenied ||
        isAuthUtilityRoute(pathname)
      ) {
        navigateTo(dashboardPathForRole(roleKey), true);
      }
    } catch (error) {
      console.error("Loading the authenticated Nutripro workspace failed:", error);
      setLoginError(formatSupabaseError(error, t("auth.loadingProfileFailed")));
      setCurrentUser(null);
      setAuthSession(null);
      void signOut().catch((signOutError) => {
        console.error("Signing out after a profile load failure failed:", signOutError);
      });
      navigateTo(ROUTES.login, true);
    } finally {
      setWorkspaceLoading(false);
    }
  }

  async function refreshCourses(nextStudentId = activeStudentId) {
    const [allCoursesResult, ownedCoursesResult] = await Promise.allSettled([
      getCourses(),
      nextStudentId ? getStudentCourses(nextStudentId) : Promise.resolve([]),
    ]);

    if (allCoursesResult.status === "rejected") {
      console.error("Refreshing all courses failed:", allCoursesResult.reason);
      throw allCoursesResult.reason;
    }

    setCourses(allCoursesResult.value);

    if (ownedCoursesResult.status === "fulfilled") {
      setStudentCourses(ownedCoursesResult.value);
    } else {
      console.error("Refreshing student courses failed:", ownedCoursesResult.reason);
    }
  }

  async function refreshCertificates(nextStudentId = activeStudentId) {
    const [allCertificates, ownedCertificates] = await Promise.all([
      getCertificates(),
      nextStudentId ? getStudentCertificates(nextStudentId) : Promise.resolve([]),
    ]);
    setCertificates(allCertificates);
    setStudentCertificates(ownedCertificates);
  }

  const role = useMemo(() => {
    return toRoleLabel(currentUser?.roleKey ?? currentUser?.role);
  }, [currentUser]);

  const adminNav = useMemo(() => ([
    { path: ROUTES.admin.dashboard, label: t("common.dashboard"), icon: "dashboard" },
    { path: ROUTES.admin.users, label: t("common.usersAdmin"), icon: "users" },
    { path: ROUTES.admin.postCourses, label: t("common.postCourses"), icon: "courses" },
    { path: ROUTES.admin.community, label: t("common.community"), icon: "community" },
    { path: ROUTES.admin.assignmentReviews, label: t("common.assignmentReviews"), icon: "certificate" },
    { path: ROUTES.admin.certificates, label: t("common.certificatesGenerator"), icon: "certificate" },
    { path: ROUTES.admin.settings, label: language === "es" ? "ConfiguraciÃ³n" : "Settings", icon: "dashboard" },
  ]), [language, t]);

  const studentNav = useMemo(() => ([
    { path: ROUTES.student.dashboard, label: t("common.dashboard"), icon: "dashboard" },
    { path: ROUTES.student.profile, label: t("common.myProfile"), icon: "users" },
    { path: ROUTES.student.certificates, label: t("common.certificates"), icon: "certificate" },
    { path: ROUTES.student.courses, label: t("common.courses"), icon: "courses" },
    { path: ROUTES.student.community, label: t("common.community"), icon: "community" },
  ]), [t]);

  const title = useMemo(() => {
    const map = {
      [ROUTES.admin.dashboard]: t("common.dashboard"),
      [ROUTES.admin.users]: t("common.usersAdmin"),
      [ROUTES.admin.postCourses]: t("common.postCourses"),
      [ROUTES.admin.community]: t("common.community"),
      [ROUTES.admin.assignmentReviews]: t("common.assignmentReviews"),
      [ROUTES.admin.certificates]: t("common.certificatesGenerator"),
      [ROUTES.admin.settings]: language === "es" ? "ConfiguraciÃ³n" : "Settings",
      [ROUTES.student.dashboard]: t("common.dashboard"),
      [ROUTES.student.profile]: t("common.myProfile"),
      [ROUTES.student.certificates]: t("common.certificates"),
      [ROUTES.student.courses]: t("common.courses"),
      [ROUTES.student.community]: t("common.community"),
      [ROUTES.auth.changePassword]: t("auth.changePassword"),
      [ROUTES.auth.access]: t("auth.accessRestricted"),
    };

    if (pathname.startsWith("/student/courses/")) {
      const courseId = `${pathname.split("/").pop() ?? ""}`.trim();
      return (
        studentCourses.find((course) => String(course.id) === courseId)?.title ||
        t("student.courseDetail")
      );
    }

    return map[pathname] || "Nutripro";
  }, [courses, language, pathname, studentCourses, t]);

  async function handleAuthLogin({ identifier, password }) {
    setLoginError("");
    setLoginInfo("");
    setAuthLoading(true);

    try {
      const { session } = await signInWithCredentials(identifier, password);
      setAuthSession(session);
    } catch (error) {
      console.error("Signing in with Supabase Auth failed:", error);
      const rawMessage = `${error?.message ?? ""}`.trim();
      const translatedError =
        rawMessage === "No account found for that username."
          ? (t("auth.noAccountForUsername") !== "auth.noAccountForUsername"
              ? t("auth.noAccountForUsername")
              : language === "es"
                ? "No se encontrÃ³ una cuenta con ese nombre de usuario."
                : "No account found for that username.")
          : rawMessage === "Your account is not active. Please contact an administrator."
            ? t("auth.inactiveAccountMessage")
            : formatSupabaseError(error, t("auth.signInFailed"));
      setLoginError(translatedError);
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleLogout() {
    try {
      await signOut();
    } catch (error) {
      console.error("Signing out failed:", error);
    }
    setCurrentUser(null);
    setAuthSession(null);
    setLoginError("");
    setLoginInfo("");

    navigateTo(ROUTES.login, true);
  }

  async function handleForcedPasswordChange(nextPassword) {
    try {
      const requiresPasswordChange = Boolean(currentUser?.mustChangePassword || currentUser?.must_change_password);
      const requiresConsent = needsPrivacyConsent(currentUser);

      const result = requiresPasswordChange
        ? await completeFirstTimeSetup(
            currentUser?.id,
            nextPassword.username,
            nextPassword.password,
            currentUser?.username,
            {
              privacyPolicyAccepted: requiresConsent ? nextPassword.privacyPolicyAccepted : false,
              privacyPolicyVersion: nextPassword.privacyPolicyVersion,
            },
          )
        : {
            profile: await completePrivacyConsent(
              currentUser?.id,
              nextPassword.privacyPolicyVersion || "2026-07-draft",
            ),
          };

      setCurrentUser(result.profile ?? currentUser);
      if (requiresConsent) {
        setPrivacyReminderSeenThisSession(true);
      }
      navigateTo(dashboardPathForRole(result.profile?.roleKey ?? currentUser?.roleKey), true);
      return { ok: true };
    } catch (error) {
      console.error("Updating the password failed:", error);
      const rawMessage = `${error?.message ?? ""}`.trim();
      const translatedError =
        rawMessage === "Username is not available." ? t("auth.usernameUnavailable") : formatSupabaseError(error, t("auth.passwordChangeFailed"));
      return { ok: false, error: translatedError };
    }
  }

  async function handleDismissPrivacyReminder() {
    try {
      const updatedProfile = await dismissPrivacyReminder(currentUser?.id);
      setPrivacyReminderSeenThisSession(true);
      setCurrentUser(updatedProfile ?? currentUser);
      if ((updatedProfile?.roleKey ?? currentUser?.roleKey) === "student") {
        setStudentProfile(updatedProfile ?? studentProfile);
      }
      navigateTo(dashboardPathForRole(updatedProfile?.roleKey ?? currentUser?.roleKey), true);
    } catch (error) {
      console.error("Dismissing the privacy reminder failed:", error);
    }
  }

  async function handleUpdateUserStatus(userOrId, status) {
    const targetUser =
      typeof userOrId === "object"
        ? userOrId
        : users.find((user) => String(user.id) === String(userOrId)) ?? null;
    const guard = canUpdateUserStatus(targetUser, currentUser, status);

    console.log("[UserStatus] student test protected?", canUpdateUserStatus({ email: "student@nutripro.test" }, currentUser, status));
    console.log("[UserStatus] guard", {
      email: targetUser?.email || "",
      nextStatus: `${status ?? ""}`.trim().toLowerCase(),
      guard,
    });

    if (!guard.allowed) {
      const statusGuardError = new Error(guard.reason);
      statusGuardError.code = guard.code;
      throw statusGuardError;
    }

    const updatedUser = await updateUserStatus(userOrId, status);
    const targetUserId = typeof userOrId === "object" ? userOrId?.id : userOrId;
    const targetEmail =
      typeof userOrId === "object" ? `${userOrId?.email ?? ""}`.trim().toLowerCase() : `${updatedUser?.email ?? ""}`.trim().toLowerCase();

    setUsers((current) =>
      current.map((user) =>
        (targetEmail && `${user.email ?? ""}`.trim().toLowerCase() === targetEmail) ||
        (targetUserId && String(user.id) === String(targetUserId))
          ? { ...user, ...updatedUser }
          : user,
      ),
    );

    if (
      (targetEmail && `${currentUser?.email ?? ""}`.trim().toLowerCase() === targetEmail) ||
      String(currentUser?.id) === String(targetUserId)
    ) {
      setCurrentUser((current) => ({ ...current, ...updatedUser }));
    }

    const nextUsers = await getUsers();
    setUsers(nextUsers);
  }

  async function handleUpdateUser(userId, updates) {
    await updateUser(userId, updates);
    const nextUsers = await getUsers();
    setUsers(nextUsers);
    if (String(currentUser?.id) === String(userId)) {
      const nextCurrentUser = nextUsers.find((user) => String(user.id) === String(userId)) ?? currentUser;
      setCurrentUser(nextCurrentUser);
      if (nextCurrentUser?.roleKey === "student") setStudentProfile(nextCurrentUser);
    }
  }

  async function handleCreateUser(payload, options = {}) {
    const result = await createAdminUser(payload, {
      productionAuthEnabled: isProductionAuthMode,
      productionOnboardingTest: Boolean(options.productionOnboardingTest),
    });
    const nextUsers = await getUsers();
    setUsers(nextUsers);
    return result;
  }

  async function handleResetUserPassword(userId, temporaryPassword = "", options = {}) {
    const result = await resetAdminUserPassword(userId, temporaryPassword, {
      productionAuthEnabled: isProductionAuthMode,
      productionOnboardingTest: Boolean(options.productionOnboardingTest),
      language: options.language,
    });
    const nextUsers = await getUsers();
    setUsers(nextUsers);
    return result;
  }

  async function handleDeleteUser(userId) {
    const result = await deleteUser(userId);
    setUsers(await getUsers());
    return result;
  }

  async function handleSendUserInvitation(user, options = {}) {
    const result = await sendUserInvitation(user, options);
    setUsers(await getUsers());
    return result;
  }

  async function handleSaveCourse(course, editingId, options = {}) {
    try {
      const savedCourse = editingId
        ? await updateCourse(editingId, course, options)
        : await createCourse(course, options);
      setCourses((currentCourses) => upsertCourseList(currentCourses, savedCourse));

      void refreshCourses().catch((refreshError) => {
        console.error("Refreshing courses after save failed:", refreshError);
      });
      return { ok: true };
    } catch (error) {
      console.error("Saving course failed:", error);
      return { ok: false, error: formatSupabaseError(error, t("admin.savingCourseFailed")) };
    }
  }

  async function handleDeleteCourse(courseId) {
    await deleteCourse(courseId);
    await refreshCourses();
  }

  async function handleSetStudentCourseAssignments(studentId, courseIds) {
    try {
      await setStudentCourseAssignments(studentId, courseIds);
      const [nextUsers, nextCourses] = await Promise.all([getUsers(), getCourses()]);
      setUsers(nextUsers);
      setCourses(nextCourses);

      if (String(activeStudentId ?? "") === String(studentId)) {
        setStudentCourses(await getStudentCourses(studentId));
      } else {
        void refreshCourses().catch((refreshError) => {
          console.error("Refreshing courses after assignment update failed:", refreshError);
        });
      }

      return { ok: true };
    } catch (error) {
      console.error("Saving student course assignments failed:", error);
      return {
        ok: false,
        error: formatSupabaseError(error, t("admin.savingAssignmentsFailed")),
      };
    }
  }

  async function handleGenerateCertificate(payload) {
    await generateCertificate(payload);
    await refreshCertificates();
  }

  async function handleCreatePost(payload) {
    const result = await createCommunityPost(payload);
    setPosts(await getCommunityPosts());
    return result;
  }

  async function handleCreateComment(postId, payload) {
    await createCommunityComment(postId, payload);
    setPosts(await getCommunityPosts());
  }

  async function handleToggleCommunityPostVote(postId, userId, voteType) {
    await toggleCommunityPostVote(postId, userId, voteType);
    setPosts(await getCommunityPosts());
  }

  async function handleUpdateCommunityPost(postId, updates) {
    await updateCommunityPost(postId, updates);
    setPosts(await getCommunityPosts());
  }

  async function handleDeleteCommunityPost(postId) {
    await deleteCommunityPost(postId);
    setPosts(await getCommunityPosts());
  }

  async function handleUpdateCommunityComment(commentId, updates) {
    await updateCommunityComment(commentId, updates);
    setPosts(await getCommunityPosts());
  }

  async function handleUpdateStudentProfile(updates) {
    if (!activeStudentId) {
      return {
        ok: false,
        error: language === "es"
          ? "No se encontró el perfil del estudiante activo."
          : "The active student profile could not be found.",
      };
    }

    try {
      const savedProfile = await updateStudentProfile(activeStudentId, updates);
      const nextUsers = await getUsers();
      setUsers(nextUsers);
      setStudentProfile(savedProfile ?? nextUsers.find((user) => String(user.id) === String(activeStudentId)) ?? studentProfile);
      if (String(currentUser?.id) === String(activeStudentId)) {
        setCurrentUser(savedProfile ?? currentUser);
      }
      setPosts(await getCommunityPosts());
      return { ok: true, profile: savedProfile };
    } catch (error) {
      console.error("Updating the student profile failed:", error);
      return { ok: false, error: formatSupabaseError(error, t("student.savingProfileFailed")) };
    }
  }
  async function handleUpdateProgress(updates) {
    if (!activeStudentId) {
      console.error("Student progress update failed because the active student user is missing.");
      return;
    }

    const nextProgress = await updateStudentProgress(activeStudentId, updates);
    setProgressState(nextProgress);

    const touchedModuleIds = Array.from(
      new Set(
        Object.keys(updates)
          .map((key) => key.split("-")[1])
          .filter(Boolean),
      ),
    );
    const touchedCourseIds = Array.from(
      new Set(
        courses
          .filter((course) =>
            (course.modules ?? []).some((module) => touchedModuleIds.includes(String(module.id))),
          )
          .map((course) => course.id)
          .filter(Boolean),
      ),
    );

    if (touchedCourseIds.length) {
      for (const courseId of touchedCourseIds) {
        try {
          await maybeGenerateCertificate(activeStudentId, courseId);
        } catch (certificateError) {
          console.error("Checking certificate eligibility after progress update failed:", certificateError);
        }
      }
      await refreshCertificates(activeStudentId);
    }
  }

  if (pathname === ROUTES.auth.setupPreview) {
    return <ForcedPasswordPage onSubmit={async () => ({ ok: true })} loading={false} />;
  }

  if (pathname === ROUTES.privacy) {
    return <PrivacyPage onBack={() => navigateTo(ROUTES.login, true)} />;
  }

  if (!productionAuthAvailable) {
    return (
      <LoginPage
        onLogin={handleAuthLogin}
        loading={false}
        error={t("auth.loadingSessionFailed")}
        info={t("auth.productionConfigMissing")}
      />
    );
  }

  if (authLoading) {
    return <LoginPage loading error={loginError} info={t("auth.checkingAccess")} onLogin={handleAuthLogin} />;
  }

  if (!authSession?.user || !currentUser) {
    return <LoginPage onLogin={handleAuthLogin} loading={false} error={loginError} info={loginInfo} />;
  }

  const blockedReason = getAccessBlockReason(currentUser);
  if (blockedReason === "inactive") {
    return (
      <AccessNoticePage
        title={t("auth.inactiveAccount")}
        message={t("auth.inactiveAccountMessage")}
        onSignOut={() => void handleLogout()}
        role={currentUser?.roleKey}
      />
    );
  }

  if (blockedReason === "suspended") {
    return (
      <AccessNoticePage
        title={t("auth.suspendedAccount")}
        message={t("auth.suspendedAccountMessage")}
        onSignOut={() => void handleLogout()}
        role={currentUser?.roleKey}
      />
    );
  }

  if (!["admin", "student"].includes(currentUser?.roleKey)) {
    return (
      <AccessNoticePage
        title={t("auth.dashboardUnavailable")}
        message={t("auth.dashboardUnavailableMessage", { role: currentUser?.role ?? currentUser?.roleKey ?? "User" })}
        onSignOut={() => void handleLogout()}
        role={currentUser?.roleKey}
      />
    );
  }

  if (currentUser?.mustChangePassword || currentUser?.must_change_password || needsPrivacyConsent(currentUser)) {
    return (
      <ForcedPasswordPage
        onSubmit={handleForcedPasswordChange}
        loading={workspaceLoading}
        currentUsername={currentUser?.username || ""}
        requirePasswordChange={Boolean(currentUser?.mustChangePassword || currentUser?.must_change_password)}
        requirePrivacyConsent={needsPrivacyConsent(currentUser)}
      />
    );
  }

  if (pathname === ROUTES.auth.privacyReminder && shouldShowPrivacyReminder(currentUser)) {
    return (
      <ForcedPasswordPage
        onSubmit={async () => {
          setPrivacyReminderSeenThisSession(true);
          navigateTo(dashboardPathForRole(currentUser?.roleKey), true);
          return { ok: true };
        }}
        onDismissReminder={handleDismissPrivacyReminder}
        loading={workspaceLoading}
        currentUsername={currentUser?.username || ""}
        requirePasswordChange={false}
        requirePrivacyConsent={false}
        showPrivacyReminder
      />
    );
  }

  if (pathname === ROUTES.accessDenied) {
    return (
      <AccessNoticePage
        title={t("auth.accessDenied")}
        message={t("auth.accessDeniedMessage")}
        actionLabel={t("auth.returnToDashboard")}
        onAction={() => navigateTo(dashboardPathForRole(currentUser?.roleKey), true)}
        onSignOut={() => void handleLogout()}
        role={currentUser?.roleKey}
      />
    );
  }

  if (workspaceLoading && role === "Student" && pathname.startsWith("/student/courses/")) {
    return <StudentWorkspacePage pathname={pathname} studentId={activeStudentId} studentProfile={studentProfile} courses={studentCourses} certificates={studentCertificates} posts={posts} progressState={progressState} onCreatePost={handleCreatePost} onCreateComment={handleCreateComment} onUpdatePost={handleUpdateCommunityPost} onUpdateComment={handleUpdateCommunityComment} onUpdateProfile={handleUpdateStudentProfile} onUpdateProgress={handleUpdateProgress} />;
  }

  return <div className="app-shell"><Sidebar role={role} navItems={role === "Admin" ? adminNav : studentNav} currentPath={pathname.startsWith("/student/courses/") ? ROUTES.student.courses : pathname} onNavigate={(nextPath) => navigateTo(nextPath)} onLogout={() => void handleLogout()} /><main className="workspace"><Header role={role} title={pathname.startsWith("/student/courses/") ? t("common.courses") : title} detailTitle={pathname.startsWith("/student/courses/") ? title : null} profile={currentUser} navItems={role === "Admin" ? adminNav : studentNav} currentPath={pathname.startsWith("/student/courses/") ? ROUTES.student.courses : pathname} onNavigate={(nextPath) => navigateTo(nextPath)} onLogout={() => void handleLogout()} /><div className="content">{role === "Admin" ? <AdminWorkspacePage pathname={pathname} users={users} courses={courses} certificates={certificates} posts={posts} currentUser={currentUser} showAuthTestTools={showAuthTestTools} onUpdateUserStatus={handleUpdateUserStatus} onUpdateUser={handleUpdateUser} onCreateUser={handleCreateUser} onResetUserPassword={handleResetUserPassword} onSendUserInvitation={handleSendUserInvitation} onDeleteUser={handleDeleteUser} onSetStudentCourseAssignments={handleSetStudentCourseAssignments} onSaveCourse={handleSaveCourse} onDeleteCourse={handleDeleteCourse} onGenerateCertificate={handleGenerateCertificate} onCreatePost={handleCreatePost} onCreateComment={handleCreateComment} onUpdatePost={handleUpdateCommunityPost} onDeletePost={handleDeleteCommunityPost} onUpdateComment={handleUpdateCommunityComment} /> : <StudentWorkspacePage pathname={pathname} studentId={activeStudentId} studentProfile={studentProfile} courses={studentCourses} certificates={studentCertificates} posts={posts} progressState={progressState} onCreatePost={handleCreatePost} onCreateComment={handleCreateComment} onUpdatePost={handleUpdateCommunityPost} onUpdateComment={handleUpdateCommunityComment} onUpdateProfile={handleUpdateStudentProfile} onUpdateProgress={handleUpdateProgress} />}</div></main></div>;
}
