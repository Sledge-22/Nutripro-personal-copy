import React, { useEffect, useMemo, useState } from "react";
import { Sidebar, Header } from "../components/ui.jsx";
import { initialCertificates, initialCommunityPosts, initialCourses, initialStudentProgress, initialUsers } from "../data/mockData.js";
import { ROUTES, isAdminRoute, isStudentRoute } from "../routes/appRoutes.js";
import { LoginPage } from "../pages/LoginPage.jsx";
import { AdminWorkspacePage } from "../pages/AdminWorkspacePage.jsx";
import { StudentWorkspacePage } from "../pages/StudentWorkspacePage.jsx";

function getPathname() {
  return window.location.pathname || ROUTES.login;
}

function navigateTo(pathname, replace = false) {
  if (replace) window.history.replaceState({}, "", pathname);
  else window.history.pushState({}, "", pathname);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export function App() {
  const [pathname, setPathname] = useState(getPathname());
  const [users, setUsers] = useState(initialUsers);
  const [courses, setCourses] = useState(initialCourses);
  const [certificates, setCertificates] = useState(initialCertificates);
  const [posts, setPosts] = useState(initialCommunityPosts);
  const [progressState, setProgressState] = useState(initialStudentProgress);

  useEffect(() => {
    const sync = () => setPathname(getPathname());
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);

  const role = isAdminRoute(pathname) ? "Admin" : isStudentRoute(pathname) ? "Student" : null;

  const adminNav = useMemo(() => ([
    { path: ROUTES.admin.dashboard, label: "Dashboard", icon: "dashboard" },
    { path: ROUTES.admin.users, label: "Users Admin", icon: "users" },
    { path: ROUTES.admin.postCourses, label: "Post Courses", icon: "courses" },
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
      [ROUTES.admin.certificates]: "Certificates Generator",
      [ROUTES.student.dashboard]: "Dashboard",
      [ROUTES.student.certificates]: "Certificates",
      [ROUTES.student.courses]: "Courses",
      [ROUTES.student.community]: "Community",
    };
    if (pathname.startsWith("/student/courses/")) {
      const courseId = Number(pathname.split("/").pop());
      return courses.find((course) => course.id === courseId)?.title || "Course detail";
    }
    return map[pathname] || "Nutripro";
  }, [courses, pathname]);

  const handleLogin = (nextRole) => navigateTo(nextRole === "Admin" ? ROUTES.admin.dashboard : ROUTES.student.dashboard);
  const handleLogout = () => navigateTo(ROUTES.login);

  if (!role) return <LoginPage onChoose={handleLogin} />;

  return <div className="app-shell"><Sidebar role={role} navItems={role === "Admin" ? adminNav : studentNav} currentPath={pathname.startsWith("/student/courses/") ? ROUTES.student.courses : pathname} onNavigate={(nextPath) => navigateTo(nextPath)} onLogout={handleLogout} /><main className="workspace"><Header role={role} title={pathname.startsWith("/student/courses/") ? "Courses" : title} detailTitle={pathname.startsWith("/student/courses/") ? title : null} /><div className="content">{role === "Admin" ? <AdminWorkspacePage pathname={pathname} users={users} setUsers={setUsers} courses={courses} setCourses={setCourses} certificates={certificates} setCertificates={setCertificates} /> : <StudentWorkspacePage pathname={pathname} courses={courses} certificates={certificates} posts={posts} setPosts={setPosts} progressState={progressState} setProgressState={setProgressState} />}</div></main></div>;
}
