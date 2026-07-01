import React, { useEffect, useMemo, useState } from "react";
import { Sidebar, Header } from "../components/ui.jsx";
import {
  initialCertificates,
  initialCommunityPosts,
  initialCourses,
  initialStudentProgress,
  initialUsers,
} from "../data/mockData.js";
import { ROUTES, isAdminRoute, isStudentRoute } from "../routes/appRoutes.js";
import { LoginPage } from "../pages/LoginPage.jsx";
import { AdminWorkspacePage } from "../pages/AdminWorkspacePage.jsx";
import { StudentWorkspacePage } from "../pages/StudentWorkspacePage.jsx";
import { DEMO_STUDENT_EMAIL, ensureDemoStudent, getUsers, updateUserStatus, deleteUser } from "../services/userService.js";
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
import { getCommunityPosts, createCommunityPost } from "../services/communityService.js";

function getPathname() {
  return window.location.pathname || ROUTES.login;
}

function navigateTo(pathname, replace = false) {
  if (replace) window.history.replaceState({}, "", pathname);
  else window.history.pushState({}, "", pathname);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

function formatSupabaseError(error) {
  if (!error) return "Saving the course failed.";
  if (typeof error === "string") return error;

  const parts = [error.message, error.details, error.hint].filter(Boolean);
  if (error.code) parts.push(`Code: ${error.code}`);

  return parts.length ? parts.join(" ") : "Saving the course failed.";
}

function upsertCourseList(courses, nextCourse) {
  const existingIndex = courses.findIndex((course) => course.id === nextCourse.id);
  if (existingIndex === -1) return [...courses, nextCourse];

  return courses.map((course) => (course.id === nextCourse.id ? nextCourse : course));
}

export function App() {
  const initialDemoStudent = initialUsers.find((user) => user.email?.toLowerCase() === DEMO_STUDENT_EMAIL) ?? initialUsers[0] ?? null;
  const [pathname, setPathname] = useState(getPathname());
  const [users, setUsers] = useState(initialUsers);
  const [courses, setCourses] = useState(initialCourses);
  const [demoStudent, setDemoStudent] = useState(initialDemoStudent);
  const demoStudentId = demoStudent?.id ?? initialDemoStudent?.id ?? 1;
  const [studentCourses, setStudentCourses] = useState(
    initialCourses.filter((course) => Array.isArray(course.owners) && course.owners.includes(demoStudentId)),
  );
  const [certificates, setCertificates] = useState(initialCertificates);
  const [studentCertificates, setStudentCertificates] = useState(
    initialCertificates.filter((certificate) => certificate.studentId === demoStudentId),
  );
  const [posts, setPosts] = useState(initialCommunityPosts);
  const [progressState, setProgressState] = useState(initialStudentProgress);

  useEffect(() => {
    const sync = () => setPathname(getPathname());
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);

  useEffect(() => {
    void loadWorkspaceData();
  }, []);

  async function resolveDemoStudent() {
    try {
      return await ensureDemoStudent();
    } catch (error) {
      console.error("Failed to resolve the Maya Laurent demo student:", error);
      return null;
    }
  }

  async function loadWorkspaceData() {
    const resolvedDemoStudent = await resolveDemoStudent();
    const nextUsers = await getUsers();
    const activeDemoStudent =
      nextUsers.find((user) => user.email?.toLowerCase() === DEMO_STUDENT_EMAIL) ??
      resolvedDemoStudent ??
      initialDemoStudent;
    const activeStudentId = activeDemoStudent?.id;

    if (!activeStudentId) {
      console.error("Student course access failed because the Maya Laurent demo student user is missing.");
    }

    const [
      nextCourses,
      nextStudentCourses,
      nextCertificates,
      nextStudentCertificates,
      nextPosts,
      nextProgress,
    ] = await Promise.all([
      getCourses(),
      activeStudentId ? getStudentCourses(activeStudentId) : Promise.resolve([]),
      getCertificates(),
      activeStudentId ? getStudentCertificates(activeStudentId) : Promise.resolve([]),
      getCommunityPosts(),
      activeStudentId ? getStudentProgress(activeStudentId) : Promise.resolve(initialStudentProgress),
    ]);

    setUsers(nextUsers);
    setDemoStudent(activeDemoStudent ?? null);
    setCourses(nextCourses);
    setStudentCourses(nextStudentCourses);
    setCertificates(nextCertificates);
    setStudentCertificates(nextStudentCertificates);
    setPosts(nextPosts);
    setProgressState(nextProgress);
  }

  async function refreshCourses(nextStudentId = demoStudentId) {
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

  async function refreshCertificates(nextStudentId = demoStudentId) {
    const [allCertificates, ownedCertificates] = await Promise.all([
      getCertificates(),
      nextStudentId ? getStudentCertificates(nextStudentId) : Promise.resolve([]),
    ]);
    setCertificates(allCertificates);
    setStudentCertificates(ownedCertificates);
  }

  const role = isAdminRoute(pathname) ? "Admin" : isStudentRoute(pathname) ? "Student" : null;

  const adminNav = useMemo(() => ([
    { path: ROUTES.admin.dashboard, label: "Dashboard", icon: "dashboard" },
    { path: ROUTES.admin.users, label: "Users Admin", icon: "users" },
    { path: ROUTES.admin.postCourses, label: "Post Courses", icon: "courses" },
    { path: ROUTES.admin.assignmentReviews, label: "Assignment Reviews", icon: "certificate" },
    { path: ROUTES.admin.certificates, label: "Certificates Generator", icon: "certificate" },
  ]), []);

  const studentNav = useMemo(() => ([
    { path: ROUTES.student.dashboard, label: "Dashboard", icon: "dashboard" },
    { path: ROUTES.student.certificates, label: "Certificates", icon: "certificate" },
    { path: ROUTES.student.courses, label: "Courses", icon: "courses" },
    { path: ROUTES.student.community, label: "Community", icon: "community" },
  ]), []);

  const title = useMemo(() => {
    const map = {
      [ROUTES.admin.dashboard]: "Dashboard",
      [ROUTES.admin.users]: "Users Admin",
      [ROUTES.admin.postCourses]: "Post Courses",
      [ROUTES.admin.assignmentReviews]: "Assignment Reviews",
      [ROUTES.admin.certificates]: "Certificates Generator",
      [ROUTES.student.dashboard]: "Dashboard",
      [ROUTES.student.certificates]: "Certificates",
      [ROUTES.student.courses]: "Courses",
      [ROUTES.student.community]: "Community",
    };

    if (pathname.startsWith("/student/courses/")) {
      const courseId = `${pathname.split("/").pop() ?? ""}`.trim();
      return (
        studentCourses.find((course) => String(course.id) === courseId)?.title ||
        courses.find((course) => String(course.id) === courseId)?.title ||
        "Course detail"
      );
    }

    return map[pathname] || "Nutripro";
  }, [courses, pathname, studentCourses]);

  const handleLogin = (nextRole) => navigateTo(nextRole === "Admin" ? ROUTES.admin.dashboard : ROUTES.student.dashboard);
  const handleLogout = () => navigateTo(ROUTES.login);

  async function handleUpdateUserStatus(userId, status) {
    await updateUserStatus(userId, status);
    setUsers(await getUsers());
  }

  async function handleDeleteUser(userId) {
    await deleteUser(userId);
    setUsers(await getUsers());
  }

  async function handleSaveCourse(course, editingId) {
    try {
      const savedCourse = editingId ? await updateCourse(editingId, course) : await createCourse(course);
      const activeStudentId = demoStudent?.id;

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
      return { ok: false, error: formatSupabaseError(error) };
    }
  }

  async function handleDeleteCourse(courseId) {
    await deleteCourse(courseId);
    await refreshCourses();
  }

  async function handleUpdateCourseVisibility(courseId, visibleToStudents) {
    try {
      const updatedCourse = visibleToStudents ? await publishCourse(courseId) : await unpublishCourse(courseId);
      const activeStudentId = demoStudent?.id;

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
        message: visibleToStudents ? "Course is now visible to students." : "Course is now hidden from students.",
      };
    } catch (error) {
      console.error("Updating course visibility failed:", error);
      return { ok: false, error: formatSupabaseError(error) };
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

  async function handleUpdateProgress(updates) {
    if (!demoStudentId) {
      console.error("Student progress update failed because the Maya Laurent demo student user is missing.");
      return;
    }

    const nextProgress = await updateStudentProgress(demoStudentId, updates);
    setProgressState(nextProgress);
  }

  if (!role) return <LoginPage onChoose={handleLogin} />;

  return <div className="app-shell"><Sidebar role={role} navItems={role === "Admin" ? adminNav : studentNav} currentPath={pathname.startsWith("/student/courses/") ? ROUTES.student.courses : pathname} onNavigate={(nextPath) => navigateTo(nextPath)} onLogout={handleLogout} /><main className="workspace"><Header role={role} title={pathname.startsWith("/student/courses/") ? "Courses" : title} detailTitle={pathname.startsWith("/student/courses/") ? title : null} /><div className="content">{role === "Admin" ? <AdminWorkspacePage pathname={pathname} users={users} courses={courses} certificates={certificates} onUpdateUserStatus={handleUpdateUserStatus} onDeleteUser={handleDeleteUser} onSaveCourse={handleSaveCourse} onDeleteCourse={handleDeleteCourse} onUpdateCourseVisibility={handleUpdateCourseVisibility} onGenerateCertificate={handleGenerateCertificate} /> : <StudentWorkspacePage pathname={pathname} studentId={demoStudentId} courses={studentCourses} certificates={studentCertificates} posts={posts} progressState={progressState} onCreatePost={handleCreatePost} onUpdateProgress={handleUpdateProgress} />}</div></main></div>;
}
