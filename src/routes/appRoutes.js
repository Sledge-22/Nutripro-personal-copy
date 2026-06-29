export const ROUTES = {
  login: "/",
  admin: {
    dashboard: "/admin",
    users: "/admin/users",
    postCourses: "/admin/post-courses",
    certificates: "/admin/certificates",
  },
  student: {
    dashboard: "/student",
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
