import { isSupabaseConfigured, supabase } from "../lib/supabaseClient.js";
import { getMockCourses, setMockCourses } from "./mockStore.js";
import { getUsers } from "./userService.js";

function normalizeEntityId(value) {
  const trimmedValue = `${value ?? ""}`.trim();
  if (!trimmedValue) return "";

  const numericValue = Number(trimmedValue);
  return Number.isNaN(numericValue) ? trimmedValue : numericValue;
}

function normalizeEnrollmentStatus(status) {
  const normalizedStatus = `${status ?? "active"}`.trim().toLowerCase();
  if (normalizedStatus === "inactive") return "inactive";
  return "active";
}

function normalizeEnrollment(row = {}) {
  const studentId = row.student_id ?? row.studentId ?? row.user_id ?? row.userId ?? null;
  const courseId = row.course_id ?? row.courseId ?? null;
  const status = normalizeEnrollmentStatus(row.status);

  return {
    id: row.id ?? `${studentId ?? "student"}-${courseId ?? "course"}`,
    studentId,
    student_id: studentId,
    courseId,
    course_id: courseId,
    status,
    enrolledAt: row.enrolled_at ?? row.enrolledAt ?? row.created_at ?? row.createdAt ?? "",
    enrolled_at: row.enrolled_at ?? row.enrolledAt ?? row.created_at ?? row.createdAt ?? "",
    createdAt: row.created_at ?? row.createdAt ?? "",
    created_at: row.created_at ?? row.createdAt ?? "",
  };
}

function buildMockEnrollmentRows() {
  const courses = getMockCourses();
  const rows = [];

  courses.forEach((course) => {
    const owners = Array.isArray(course.owners) ? course.owners : [];
    owners.forEach((studentId) => {
      rows.push(
        normalizeEnrollment({
          id: `${studentId}-${course.id}`,
          student_id: studentId,
          course_id: course.id,
          status: "active",
        }),
      );
    });
  });

  return rows;
}

function updateMockCourseOwners(courseId, updater) {
  const normalizedCourseId = normalizeEntityId(courseId);
  const nextCourses = getMockCourses().map((course) => {
    if (String(course.id) !== String(normalizedCourseId)) return course;

    const currentOwners = Array.isArray(course.owners) ? course.owners : [];
    return {
      ...course,
      owners: updater(
        currentOwners.map((ownerId) => normalizeEntityId(ownerId)).filter(Boolean),
      ),
    };
  });

  setMockCourses(nextCourses);
}

async function fetchSupabaseEnrollmentRows() {
  const { data, error } = await supabase.from("enrollments").select("*");
  if (error) {
    console.error("Loading enrollments from Supabase failed:", error);
    throw error;
  }

  return (data ?? []).map(normalizeEnrollment);
}

function isActiveEnrollment(row) {
  return normalizeEnrollmentStatus(row?.status) === "active";
}

function isMissingStatusColumnError(error) {
  const message = `${error?.message ?? ""} ${error?.details ?? ""} ${error?.hint ?? ""}`.toLowerCase();
  return message.includes("status") && (message.includes("column") || message.includes("schema cache"));
}

async function insertEnrollmentRow(payload) {
  const preferredPayload = {
    student_id: payload.student_id,
    course_id: payload.course_id,
    status: normalizeEnrollmentStatus(payload.status),
  };

  const { data, error } = await supabase.from("enrollments").insert([preferredPayload]).select("*").single();
  if (!error) return normalizeEnrollment(data);

  if (isMissingStatusColumnError(error)) {
    console.warn("Enrollment status column is missing. Retrying enrollment insert without status.");
    const fallbackResponse = await supabase
      .from("enrollments")
      .insert([{ student_id: payload.student_id, course_id: payload.course_id }])
      .select("*")
      .single();

    if (fallbackResponse.error) {
      console.error("Inserting the fallback enrollment row failed:", fallbackResponse.error);
      throw fallbackResponse.error;
    }

    return normalizeEnrollment(fallbackResponse.data);
  }

  console.error("Inserting the enrollment row failed:", error);
  throw error;
}

async function updateEnrollmentStatus(rowId, status) {
  const { data, error } = await supabase
    .from("enrollments")
    .update({ status: normalizeEnrollmentStatus(status) })
    .eq("id", rowId)
    .select("*")
    .single();

  if (!error) return normalizeEnrollment(data);

  if (isMissingStatusColumnError(error)) {
    console.warn("Enrollment status column is missing. Falling back to deleting the enrollment row.");
    return null;
  }

  console.error("Updating the enrollment status failed:", error);
  throw error;
}

async function updateEnrollmentStatusByStudentAndCourse(studentId, courseId, status) {
  const { data, error } = await supabase
    .from("enrollments")
    .update({ status: normalizeEnrollmentStatus(status) })
    .eq("student_id", studentId)
    .eq("course_id", courseId)
    .select("*")
    .limit(1)
    .maybeSingle();

  if (!error) return data ? normalizeEnrollment(data) : null;

  if (isMissingStatusColumnError(error)) {
    console.warn("Enrollment status column is missing. Falling back to deleting the enrollment row.");
    return null;
  }

  console.error("Updating the enrollment status by student and course failed:", error);
  throw error;
}

export async function getEnrollments() {
  if (!isSupabaseConfigured || !supabase) return buildMockEnrollmentRows();
  return fetchSupabaseEnrollmentRows();
}

export async function getEnrollmentsByStudent(studentId) {
  const normalizedStudentId = normalizeEntityId(studentId);
  if (!normalizedStudentId) return [];

  const rows = await getEnrollments();
  return rows.filter((row) => String(row.studentId) === String(normalizedStudentId));
}

export async function getStudentEnrollments(studentId) {
  return getEnrollmentsByStudent(studentId);
}

export async function getEnrollmentsByCourse(courseId) {
  const normalizedCourseId = normalizeEntityId(courseId);
  if (!normalizedCourseId) return [];

  const rows = await getEnrollments();
  return rows.filter((row) => String(row.courseId) === String(normalizedCourseId));
}

export async function getCourseEnrollments(courseId) {
  return getEnrollmentsByCourse(courseId);
}

export async function getStudents() {
  const users = await getUsers();
  return users.filter((user) => {
    const normalizedRole = `${user?.roleKey ?? user?.role ?? ""}`.trim().toLowerCase();
    return normalizedRole === "student" || normalizedRole === "estudiante";
  });
}

export async function assignCourseToStudent(studentId, courseId) {
  const normalizedStudentId = normalizeEntityId(studentId);
  const normalizedCourseId = normalizeEntityId(courseId);

  if (!normalizedStudentId || !normalizedCourseId) {
    throw new Error("A valid student and course are required.");
  }

  if (!isSupabaseConfigured || !supabase) {
    updateMockCourseOwners(normalizedCourseId, (owners) =>
      owners.includes(normalizedStudentId) ? owners : [...owners, normalizedStudentId],
    );

    return normalizeEnrollment({
      student_id: normalizedStudentId,
      course_id: normalizedCourseId,
      status: "active",
    });
  }

  const existingRows = await getEnrollmentsByStudent(normalizedStudentId);
  const existingRow =
    existingRows.find((row) => String(row.courseId) === String(normalizedCourseId)) ?? null;

  if (!existingRow) {
    return insertEnrollmentRow({
      student_id: normalizedStudentId,
      course_id: normalizedCourseId,
      status: "active",
    });
  }

  if (isActiveEnrollment(existingRow)) return existingRow;

  const updatedRow = existingRow.id
    ? await updateEnrollmentStatus(existingRow.id, "active")
    : await updateEnrollmentStatusByStudentAndCourse(normalizedStudentId, normalizedCourseId, "active");
  if (updatedRow) return updatedRow;

  return insertEnrollmentRow({
    student_id: normalizedStudentId,
    course_id: normalizedCourseId,
    status: "active",
  });
}

export async function removeCourseFromStudent(studentId, courseId) {
  const normalizedStudentId = normalizeEntityId(studentId);
  const normalizedCourseId = normalizeEntityId(courseId);

  if (!normalizedStudentId || !normalizedCourseId) {
    throw new Error("A valid student and course are required.");
  }

  if (!isSupabaseConfigured || !supabase) {
    updateMockCourseOwners(normalizedCourseId, (owners) =>
      owners.filter((ownerId) => String(ownerId) !== String(normalizedStudentId)),
    );

    return { ok: true, status: "inactive" };
  }

  const existingRows = await getEnrollmentsByStudent(normalizedStudentId);
  const existingRow =
    existingRows.find((row) => String(row.courseId) === String(normalizedCourseId)) ?? null;

  if (!existingRow) return { ok: true, status: "inactive" };

  const updatedRow = existingRow.id
    ? await updateEnrollmentStatus(existingRow.id, "inactive")
    : await updateEnrollmentStatusByStudentAndCourse(normalizedStudentId, normalizedCourseId, "inactive");
  if (updatedRow) return updatedRow;

  const { error } = await supabase
    .from("enrollments")
    .delete()
    .eq("student_id", normalizedStudentId)
    .eq("course_id", normalizedCourseId);

  if (error) {
    console.error("Removing the enrollment row failed:", error);
    throw error;
  }

  return { ok: true, status: "inactive" };
}

export async function removeStudentFromCourse(courseId, studentId) {
  return removeCourseFromStudent(studentId, courseId);
}

export async function setStudentCourseAssignments(studentId, courseIds = []) {
  const normalizedStudentId = normalizeEntityId(studentId);
  if (!normalizedStudentId) {
    throw new Error("A valid student is required.");
  }

  const desiredCourseIds = Array.from(
    new Set((Array.isArray(courseIds) ? courseIds : []).map(normalizeEntityId).filter(Boolean)),
  );

  const currentRows = await getEnrollmentsByStudent(normalizedStudentId);
  const currentActiveCourseIds = currentRows
    .filter(isActiveEnrollment)
    .map((row) => normalizeEntityId(row.courseId));

  const desiredSet = new Set(desiredCourseIds.map(String));
  const currentSet = new Set(currentActiveCourseIds.map(String));

  const courseIdsToAssign = desiredCourseIds.filter((courseId) => !currentSet.has(String(courseId)));
  const courseIdsToRemove = currentActiveCourseIds.filter((courseId) => !desiredSet.has(String(courseId)));

  for (const courseId of courseIdsToAssign) {
    await assignCourseToStudent(normalizedStudentId, courseId);
  }

  for (const courseId of courseIdsToRemove) {
    await removeCourseFromStudent(normalizedStudentId, courseId);
  }

  return getEnrollmentsByStudent(normalizedStudentId);
}

export async function assignStudentsToCourse(courseId, studentIds = []) {
  const normalizedCourseId = normalizeEntityId(courseId);
  if (!normalizedCourseId) {
    throw new Error("A valid course is required.");
  }

  const desiredStudentIds = Array.from(
    new Set((Array.isArray(studentIds) ? studentIds : []).map(normalizeEntityId).filter(Boolean)),
  );

  const currentRows = await getEnrollmentsByCourse(normalizedCourseId);
  const currentActiveStudentIds = currentRows
    .filter(isActiveEnrollment)
    .map((row) => normalizeEntityId(row.studentId));

  const desiredSet = new Set(desiredStudentIds.map(String));
  const currentSet = new Set(currentActiveStudentIds.map(String));

  const studentIdsToAssign = desiredStudentIds.filter((studentId) => !currentSet.has(String(studentId)));
  const studentIdsToRemove = currentActiveStudentIds.filter((studentId) => !desiredSet.has(String(studentId)));

  for (const studentId of studentIdsToAssign) {
    await assignCourseToStudent(studentId, normalizedCourseId);
  }

  for (const studentId of studentIdsToRemove) {
    await removeCourseFromStudent(studentId, normalizedCourseId);
  }

  return getEnrollmentsByCourse(normalizedCourseId);
}

export async function setCourseStudentAssignments(courseId, selectedStudentIds = []) {
  return assignStudentsToCourse(courseId, selectedStudentIds);
}

export async function isStudentEnrolled(studentId, courseId) {
  const rows = await getEnrollmentsByStudent(studentId);
  return rows.some(
    (row) =>
      String(row.courseId) === String(normalizeEntityId(courseId)) &&
      isActiveEnrollment(row),
  );
}

export async function getStudentAccessibleCourses(studentId) {
  const normalizedStudentId = normalizeEntityId(studentId);
  if (!normalizedStudentId) return [];

  if (!isSupabaseConfigured || !supabase) {
    return getMockCourses().filter(
      (course) =>
        String(course.status ?? "published").toLowerCase() === "published" &&
        Array.isArray(course.owners) &&
        course.owners.some((ownerId) => String(ownerId) === String(normalizedStudentId)),
    );
  }

  const activeRows = (await getEnrollmentsByStudent(normalizedStudentId)).filter(isActiveEnrollment);
  const courseIds = activeRows.map((row) => row.courseId).filter(Boolean);
  if (!courseIds.length) return [];

  const { data, error } = await supabase
    .from("courses")
    .select("*")
    .eq("status", "published")
    .in("id", courseIds);

  if (error) {
    console.error("Loading the student-accessible courses from Supabase failed:", error);
    throw error;
  }

  return data ?? [];
}

// TODO(payment): When payments are added later, payment success/failure should create or update
// enrollment rows instead of bypassing these access checks.
export async function ensureDemoStudentEnrollments(studentId, limit = 2) {
  const normalizedStudentId = normalizeEntityId(studentId);
  if (!normalizedStudentId) return [];

  const activeRows = (await getEnrollmentsByStudent(normalizedStudentId)).filter(isActiveEnrollment);
  if (activeRows.length) return activeRows;

  let publishedCourses = [];
  if (!isSupabaseConfigured || !supabase) {
    publishedCourses = getMockCourses().filter(
      (course) => `${course.status ?? "published"}`.toLowerCase() === "published",
    );
  } else {
    const { data, error } = await supabase
      .from("courses")
      .select("id, status")
      .eq("status", "published")
      .order("id", { ascending: true });

    if (error) {
      console.error("Loading the published demo courses failed:", error);
      throw error;
    }

    publishedCourses = data ?? [];
  }

  for (const course of publishedCourses.slice(0, Math.max(1, limit))) {
    await assignCourseToStudent(normalizedStudentId, course.id);
  }

  return (await getEnrollmentsByStudent(normalizedStudentId)).filter(isActiveEnrollment);
}
