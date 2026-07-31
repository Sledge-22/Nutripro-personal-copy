export const ROUTES = {
  home: "/",
  login: "/login",
  privacy: "/privacy",
  accessDenied: "/access-denied",
  auth: {
    changePassword: "/auth/change-password",
    privacyReminder: "/auth/privacy-reminder",
    setupPreview: "/auth/change-password-preview",
    access: "/auth/access",
  },
  admin: {
    dashboard: "/admin",
    users: "/admin/users",
    postCourses: "/admin/post-courses",
    courseCreate: "/admin/post-courses/new",
    courseBuilder: (courseId) => `/admin/post-courses/${courseId}`,
    courseEdit: (courseId) => `/admin/post-courses/${courseId}/edit`,
    studentPreview: (courseId) => `/admin/student-preview/${courseId}`,
    community: "/admin/community",
    messages: "/admin/messages",
    teamApplications: "/admin/team-applications",
    assignmentReviews: "/admin/assignment-reviews",
    certificates: "/admin/certificates",
    settings: "/admin/settings",
  },
  student: {
    dashboard: "/student",
    profile: "/student/profile",
    certificates: "/student/certificates",
    courses: "/student/courses",
    community: "/student/community",
    messages: "/student/messages",
    courseDetail: (courseId) => `/student/courses/${courseId}`,
  },
};

export function isAdminRoute(pathname) {
  return pathname.startsWith("/admin");
}

export function isAdminCourseRoute(pathname) {
  return (
    pathname === ROUTES.admin.postCourses ||
    pathname === ROUTES.admin.courseCreate ||
    pathname.startsWith(`${ROUTES.admin.postCourses}/`)
  );
}

export function isAdminStudentPreviewRoute(pathname) {
  return pathname.startsWith("/admin/student-preview/");
}

export function getAdminStudentPreviewCourseId(pathname) {
  if (!isAdminStudentPreviewRoute(pathname)) return "";
  return `${pathname.slice("/admin/student-preview/".length)}`.trim();
}

export function getAdminCourseRouteState(pathname) {
  if (pathname === ROUTES.admin.postCourses) {
    return { view: "manager", courseId: "" };
  }

  if (pathname === ROUTES.admin.courseCreate) {
    return { view: "create", courseId: "" };
  }

  if (!pathname.startsWith(`${ROUTES.admin.postCourses}/`)) {
    return { view: "", courseId: "" };
  }

  const suffix = pathname.slice(`${ROUTES.admin.postCourses}/`.length);
  if (!suffix) return { view: "manager", courseId: "" };

  if (suffix.endsWith("/edit")) {
    return {
      view: "edit",
      courseId: suffix.slice(0, -"/edit".length),
    };
  }

  return {
    view: "builder",
    courseId: suffix,
  };
}

export function isStudentRoute(pathname) {
  return pathname.startsWith("/student");
}

export function isAuthUtilityRoute(pathname) {
  return pathname.startsWith("/auth/");
}
