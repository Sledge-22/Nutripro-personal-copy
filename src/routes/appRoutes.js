export const ROUTES = {
  login: "/",
  auth: {
    changePassword: "/auth/change-password",
    setupPreview: "/auth/change-password-preview",
    access: "/auth/access",
  },
  admin: {
    dashboard: "/admin",
    users: "/admin/users",
    postCourses: "/admin/post-courses",
    assignmentReviews: "/admin/assignment-reviews",
    certificates: "/admin/certificates",
  },
  student: {
    dashboard: "/student",
    profile: "/student/profile",
    certificates: "/student/certificates",
    courses: "/student/courses",
    community: "/student/community",
    courseDetail: (courseId) => `/student/courses/${courseId}`,
  },
};

export function isAdminRoute(pathname) {
  return pathname.startsWith("/admin");
}

export function isStudentRoute(pathname) {
  return pathname.startsWith("/student");
}

export function isAuthUtilityRoute(pathname) {
  return pathname.startsWith("/auth/");
}
