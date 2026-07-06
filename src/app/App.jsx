import React, { useEffect, useMemo, useState } from "react";
import { Sidebar, Header } from "../components/ui.jsx";
import { AUTH_MODE, isProductionAuthMode } from "../config/authMode.js";
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
import { AdminWorkspacePage } from "../pages/AdminWorkspacePage.jsx";
import { StudentWorkspacePage } from "../pages/StudentWorkspacePage.jsx";
import {
  createAdminUser,
  deleteUser,
  DEMO_STUDENT_EMAIL,
  ensureDemoStudent,
  getUserProfileForAuthUser,
  getUsers,
  resetAdminUserPassword,
  updateStudentProfile,
  updateUser,
  updateUserStatus,
} from "../services/userService.js";
import {
  changePassword,
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
  publishCourse,
  unpublishCourse,
} from "../services/courseService.js";
import { getCertificates, generateCertificate, getStudentCertificates } from "../services/certificateService.js";
import { getStudentProgress, updateStudentProgress } from "../services/progressService.js";
import { getCommunityPosts, createCommunityPost, createCommunityComment } from "../services/communityService.js";
import { useLanguage } from "../i18n/LanguageContext.jsx";

const DEMO_SESSION_STORAGE_KEY = "nutripro-demo-session";
const DEMO_ACCOUNTS = {
  admin: {
    role: "Admin",
    roleKey: "admin",
    name: "Alex Morgan",
    email: "admin@nutripro.demo",
    identifiers: ["admin", "admin@nutripro.demo"],
    password: "nutriprotestA",
  },
  student: {
    role: "Student",
    roleKey: "student",
    name: "Maya Laurent",
    email: "maya@nutripro.demo",
    identifiers: ["maya", "maya@nutripro.demo"],
    password: "nutriprotestS",
  },
};

function getPathname() {
  return window.location.pathname || ROUTES.login;
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

function getAccessBlockReason(profile) {
  const statusKey = `${profile?.statusKey ?? profile?.status ?? ""}`.trim().toLowerCase();
  if (statusKey === "inactive") return "inactive";
  if (statusKey === "suspended" || statusKey === "paused") return "suspended";
  return null;
}

function readDemoSession() {
  try {
    const rawSession = window.localStorage.getItem(DEMO_SESSION_STORAGE_KEY);
    if (!rawSession) return null;

    const parsedSession = JSON.parse(rawSession);
    const roleKey = `${parsedSession?.roleKey ?? ""}`.trim().toLowerCase();
    return roleKey === "admin" || roleKey === "student" ? parsedSession : null;
  } catch (error) {
    console.error("Reading the demo login session failed:", error);
    return null;
  }
}

function persistDemoSession(account) {
  try {
    window.localStorage.setItem(
      DEMO_SESSION_STORAGE_KEY,
      JSON.stringify({
        role: account.role,
        roleKey: account.roleKey,
        name: account.name,
        email: account.email,
      }),
    );
  } catch (error) {
    console.error("Saving the demo login session failed:", error);
  }
}

function clearDemoSession() {
  try {
    window.localStorage.removeItem(DEMO_SESSION_STORAGE_KEY);
  } catch (error) {
    console.error("Clearing the demo login session failed:", error);
  }
}

export function App() {
  const { t } = useLanguage();
  const isDemoAuthMode = AUTH_MODE === "demo";
  const authConfigured = isProductionAuthMode && isAuthConfigured();
  const initialDemoStudent = initialUsers.find((user) => user.email?.toLowerCase() === DEMO_STUDENT_EMAIL) ?? initialUsers[0] ?? null;

  const [pathname, setPathname] = useState(getPathname());
  const [authLoading, setAuthLoading] = useState(authConfigured);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [loginInfo, setLoginInfo] = useState("");
  const [authSession, setAuthSession] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers] = useState(initialUsers);
  const [courses, setCourses] = useState(initialCourses);
  const [studentProfile, setStudentProfile] = useState(initialDemoStudent);
  const [studentCourses, setStudentCourses] = useState(
    initialCourses.filter((course) => Array.isArray(course.owners) && course.owners.includes(initialDemoStudent?.id ?? 1)),
  );
  const [certificates, setCertificates] = useState(initialCertificates);
  const [studentCertificates, setStudentCertificates] = useState(
    initialCertificates.filter((certificate) => certificate.studentId === (initialDemoStudent?.id ?? 1)),
  );
  const [posts, setPosts] = useState(initialCommunityPosts);
  const [progressState, setProgressState] = useState(initialStudentProgress);
  const [demoSession, setDemoSession] = useState(() => (isProductionAuthMode ? null : readDemoSession()));

  const activeStudentId = authConfigured
    ? currentUser?.roleKey === "student"
      ? currentUser?.id ?? null
      : null
    : studentProfile?.id ?? initialDemoStudent?.id ?? 1;

  useEffect(() => {
    const sync = () => setPathname(getPathname());
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);

  useEffect(() => {
    if (!authConfigured) {
      setAuthLoading(false);
      void loadDemoWorkspace();
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
  }, [authConfigured, t]);

  useEffect(() => {
    if (!authConfigured) return;

    if (!authSession?.user) {
      setCurrentUser(null);
      setLoginInfo("");
      setWorkspaceLoading(false);
      if (pathname !== ROUTES.login) navigateTo(ROUTES.login, true);
      return;
    }

    void loadAuthenticatedWorkspace(authSession.user);
  }, [authConfigured, authSession]);

  useEffect(() => {
    if (isProductionAuthMode) return;

    if (!demoSession) {
      if (pathname !== ROUTES.login) navigateTo(ROUTES.login, true);
      return;
    }

    if (!pathMatchesRole(pathname, demoSession.roleKey)) {
      navigateTo(dashboardPathForRole(demoSession.roleKey), true);
    }
  }, [demoSession, pathname]);

  async function loadDemoWorkspace() {
    const resolvedDemoStudent = await ensureDemoStudent();
    const nextUsers = await getUsers();
    const activeDemoStudent =
      nextUsers.find((user) => user.email?.toLowerCase() === DEMO_STUDENT_EMAIL) ??
      resolvedDemoStudent ??
      initialDemoStudent;
    const nextStudentId = activeDemoStudent?.id;

    const [
      nextCourses,
      nextStudentCourses,
      nextCertificates,
      nextStudentCertificates,
      nextPosts,
      nextProgress,
    ] = await Promise.all([
      getCourses(),
      nextStudentId ? getStudentCourses(nextStudentId) : Promise.resolve([]),
      getCertificates(),
      nextStudentId ? getStudentCertificates(nextStudentId) : Promise.resolve([]),
      getCommunityPosts(),
      nextStudentId ? getStudentProgress(nextStudentId) : Promise.resolve(initialStudentProgress),
    ]);

    setUsers(nextUsers);
    setStudentProfile(activeDemoStudent ?? null);
    setCourses(nextCourses);
    setStudentCourses(nextStudentCourses);
    setCertificates(nextCertificates);
    setStudentCertificates(nextStudentCertificates);
    setPosts(nextPosts);
    setProgressState(nextProgress);
  }

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
      } else if (profile?.mustChangePassword || profile?.must_change_password) {
        if (pathname !== ROUTES.auth.changePassword) navigateTo(ROUTES.auth.changePassword, true);
      } else if (!pathMatchesRole(pathname, roleKey)) {
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
    if (authConfigured) return toRoleLabel(currentUser?.roleKey ?? currentUser?.role);
    if (demoSession?.role) return toRoleLabel(demoSession.roleKey ?? demoSession.role);
    return null;
  }, [authConfigured, currentUser, demoSession]);

  const adminNav = useMemo(() => ([
    { path: ROUTES.admin.dashboard, label: t("common.dashboard"), icon: "dashboard" },
    { path: ROUTES.admin.users, label: t("common.usersAdmin"), icon: "users" },
    { path: ROUTES.admin.postCourses, label: t("common.postCourses"), icon: "courses" },
    { path: ROUTES.admin.assignmentReviews, label: t("common.assignmentReviews"), icon: "certificate" },
    { path: ROUTES.admin.certificates, label: t("common.certificatesGenerator"), icon: "certificate" },
  ]), [t]);

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
      [ROUTES.admin.assignmentReviews]: t("common.assignmentReviews"),
      [ROUTES.admin.certificates]: t("common.certificatesGenerator"),
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
        courses.find((course) => String(course.id) === courseId)?.title ||
        t("student.courseDetail")
      );
    }

    return map[pathname] || "Nutripro";
  }, [courses, pathname, studentCourses, t]);

  async function handleDemoLogin({ identifier, password }) {
    setLoginError("");
    setLoginInfo("");

    const normalizedIdentifier = `${identifier ?? ""}`.trim().toLowerCase();
    const matchedAccount = Object.values(DEMO_ACCOUNTS).find(
      (account) => account.identifiers.includes(normalizedIdentifier) && account.password === password,
    );

    if (!matchedAccount) {
      setLoginError(t("auth.invalidCredentials"));
      return;
    }

    persistDemoSession(matchedAccount);
    setDemoSession(matchedAccount);
    navigateTo(dashboardPathForRole(matchedAccount.roleKey), true);
  }

  async function handleAuthLogin({ identifier, password }) {
    setLoginError("");
    setLoginInfo("");
    setAuthLoading(true);

    try {
      const { session } = await signInWithCredentials(identifier, password);
      setAuthSession(session);
    } catch (error) {
      console.error("Signing in with Supabase Auth failed:", error);
      setLoginError(formatSupabaseError(error, t("auth.signInFailed")));
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleLogout() {
    if (authConfigured) {
      try {
        await signOut();
      } catch (error) {
        console.error("Signing out failed:", error);
      }
      setCurrentUser(null);
      setAuthSession(null);
    } else {
      clearDemoSession();
      setDemoSession(null);
      setLoginError("");
      setLoginInfo("");
    }

    navigateTo(ROUTES.login, true);
  }

  async function handleForcedPasswordChange(nextPassword) {
    try {
      const result = await changePassword(currentUser?.id, nextPassword);
      setCurrentUser(result.profile ?? currentUser);
      navigateTo(dashboardPathForRole(result.profile?.roleKey ?? currentUser?.roleKey), true);
      return { ok: true };
    } catch (error) {
      console.error("Updating the password failed:", error);
      return { ok: false, error: formatSupabaseError(error, t("auth.passwordChangeFailed")) };
    }
  }

  async function handleUpdateUserStatus(userId, status) {
    await updateUserStatus(userId, status);
    const nextUsers = await getUsers();
    setUsers(nextUsers);
    if (String(currentUser?.id) === String(userId)) {
      setCurrentUser(nextUsers.find((user) => String(user.id) === String(userId)) ?? currentUser);
    }
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

  async function handleCreateUser(payload) {
    const result = await createAdminUser(payload);
    const nextUsers = await getUsers();
    setUsers(nextUsers);
    return result;
  }

  async function handleResetUserPassword(userId, temporaryPassword = "") {
    const result = await resetAdminUserPassword(userId, temporaryPassword);
    const nextUsers = await getUsers();
    setUsers(nextUsers);
    return result;
  }

  async function handleDeleteUser(userId) {
    await deleteUser(userId);
    setUsers(await getUsers());
  }

  async function handleSaveCourse(course, editingId) {
    try {
      const savedCourse = editingId ? await updateCourse(editingId, course) : await createCourse(course);
      setCourses((currentCourses) => upsertCourseList(currentCourses, savedCourse));

      setStudentCourses((currentCourses) => {
        const shouldOwnCourse =
          Boolean(activeStudentId) && Array.isArray(savedCourse.owners) && savedCourse.owners.includes(activeStudentId);
        if (!shouldOwnCourse) return currentCourses.filter((existingCourse) => existingCourse.id !== savedCourse.id);
        return upsertCourseList(currentCourses, savedCourse);
      });

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

  async function handleUpdateCourseVisibility(courseId, visibleToStudents) {
    try {
      const updatedCourse = visibleToStudents ? await publishCourse(courseId) : await unpublishCourse(courseId);

      setCourses((currentCourses) => upsertCourseList(currentCourses, updatedCourse));
      setStudentCourses((currentCourses) => {
        if (!visibleToStudents) return currentCourses.filter((course) => course.id !== courseId);

        const shouldShowCourse =
          Boolean(activeStudentId) &&
          Array.isArray(updatedCourse.owners) &&
          updatedCourse.owners.includes(activeStudentId) &&
          updatedCourse.status === "published";

        if (!shouldShowCourse) return currentCourses;
        return upsertCourseList(currentCourses, updatedCourse);
      });

      void refreshCourses().catch((refreshError) => {
        console.error("Refreshing courses after visibility update failed:", refreshError);
      });

      return {
        ok: true,
        message: visibleToStudents ? t("admin.courseVisibleNow") : t("admin.courseHiddenNow"),
      };
    } catch (error) {
      console.error("Updating course visibility failed:", error);
      return { ok: false, error: formatSupabaseError(error, t("admin.updatingCourseVisibilityFailed")) };
    }
  }

  async function handleGenerateCertificate(payload) {
    await generateCertificate(payload);
    await refreshCertificates();
  }

  async function handleCreatePost(payload) {
    await createCommunityPost(payload);
    setPosts(await getCommunityPosts());
  }

  async function handleCreateComment(postId, payload) {
    await createCommunityComment(postId, payload);
    setPosts(await getCommunityPosts());
  }

  async function handleUpdateStudentProfile(updates) {
    if (!activeStudentId) return { ok: false, error: t("student.demoStudentMissing") };

    try {
      const savedProfile = await updateStudentProfile(activeStudentId, updates);
      const nextUsers = await getUsers();
      setUsers(nextUsers);
      setStudentProfile(savedProfile ?? nextUsers.find((user) => String(user.id) === String(activeStudentId)) ?? studentProfile);
      if (authConfigured && String(currentUser?.id) === String(activeStudentId)) {
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
  }

  if (isProductionAuthMode && !authConfigured) {
    return (
      <LoginPage
        authMode="production"
        onLogin={handleAuthLogin}
        loading={false}
        error={t("auth.loadingSessionFailed")}
        info={t("auth.productionConfigMissing")}
      />
    );
  }

  if (authConfigured) {
    if (authLoading) {
      return <LoginPage authMode="production" loading error={loginError} info={t("auth.loadingSession")} onLogin={handleAuthLogin} />;
    }

    if (!authSession?.user || !currentUser) {
      return <LoginPage authMode="production" onLogin={handleAuthLogin} loading={authLoading} error={loginError} info={loginInfo} />;
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

    if (currentUser?.mustChangePassword || currentUser?.must_change_password) {
      return <ForcedPasswordPage onSubmit={handleForcedPasswordChange} loading={workspaceLoading} />;
    }

    if (workspaceLoading && role === "Student" && pathname.startsWith("/student/courses/")) {
      return <StudentWorkspacePage pathname={pathname} studentId={activeStudentId} studentProfile={studentProfile} courses={studentCourses} certificates={studentCertificates} posts={posts} progressState={progressState} onCreatePost={handleCreatePost} onCreateComment={handleCreateComment} onUpdateProfile={handleUpdateStudentProfile} onUpdateProgress={handleUpdateProgress} />;
    }
  } else if (!role) {
    return <LoginPage authMode={isDemoAuthMode ? "demo" : "production"} onLogin={handleDemoLogin} loading={false} error={loginError} info={loginInfo} />;
  }

  const demoHeaderProfile =
    role === "Admin"
      ? users.find((user) => `${user.roleKey ?? user.role ?? ""}`.trim().toLowerCase() === "admin") ??
        demoSession ??
        DEMO_ACCOUNTS.admin
      : studentProfile ?? demoSession ?? DEMO_ACCOUNTS.student;

  return <div className="app-shell"><Sidebar role={role} navItems={role === "Admin" ? adminNav : studentNav} currentPath={pathname.startsWith("/student/courses/") ? ROUTES.student.courses : pathname} onNavigate={(nextPath) => navigateTo(nextPath)} onLogout={() => void handleLogout()} /><main className="workspace"><Header role={role} title={pathname.startsWith("/student/courses/") ? t("common.courses") : title} detailTitle={pathname.startsWith("/student/courses/") ? title : null} profile={authConfigured ? currentUser : demoHeaderProfile} /><div className="content">{role === "Admin" ? <AdminWorkspacePage pathname={pathname} users={users} courses={courses} certificates={certificates} onUpdateUserStatus={handleUpdateUserStatus} onUpdateUser={handleUpdateUser} onCreateUser={handleCreateUser} onResetUserPassword={handleResetUserPassword} onDeleteUser={handleDeleteUser} onSaveCourse={handleSaveCourse} onDeleteCourse={handleDeleteCourse} onUpdateCourseVisibility={handleUpdateCourseVisibility} onGenerateCertificate={handleGenerateCertificate} /> : <StudentWorkspacePage pathname={pathname} studentId={activeStudentId} studentProfile={studentProfile} courses={studentCourses} certificates={studentCertificates} posts={posts} progressState={progressState} onCreatePost={handleCreatePost} onCreateComment={handleCreateComment} onUpdateProfile={handleUpdateStudentProfile} onUpdateProgress={handleUpdateProgress} />}</div></main></div>;
}
