import { isSupabaseConfigured, supabase } from "../lib/supabaseClient.js";
import {
  createMockId,
  getMockAssignmentSubmissions,
  getMockCertificates,
  getMockCourses,
  getMockProgress,
  getMockUsers,
  setMockCertificates,
} from "./mockStore.js";
import { getStudentEnrollments } from "./enrollmentService.js";
import { getModulesByCourse } from "./moduleService.js";
import { getStudentProgress } from "./progressService.js";

const OPTIONAL_CERTIFICATE_COLUMNS = ["student_name", "course_title", "issue_date", "issued_at"];

function createCertificateNumber() {
  const randomValue = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `NUTRI-${new Date().getFullYear()}-${randomValue}`;
}

function createIssueDate() {
  return new Date().toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function normalizeCertificate(row) {
  return {
    id: row.id,
    studentId: row.student_id ?? row.studentId,
    student: row.student_name ?? row.student ?? "",
    courseId: row.course_id ?? row.courseId,
    course: row.course_title ?? row.course ?? "",
    number: row.certificate_number ?? row.number ?? "",
    issueDate: row.issue_date ?? row.issueDate ?? row.issued_at ?? row.issuedAt ?? "",
    status: `${row.status ?? "issued"}`.toLowerCase(),
  };
}

async function runCertificateMutationWithFallback(operation, payload, attempt = 0) {
  const { data, error } = await operation(payload);
  if (!error) return data;

  const columnName = OPTIONAL_CERTIFICATE_COLUMNS.find(
    (column) =>
      column in payload &&
      (error.message?.includes(`'${column}'`) ||
        error.message?.includes(`certificates.${column}`) ||
        error.details?.includes(column) ||
        error.hint?.includes(column)),
  );

  if (columnName && attempt < OPTIONAL_CERTIFICATE_COLUMNS.length) {
    const nextPayload = { ...payload };
    delete nextPayload[columnName];
    console.warn(`Retrying certificate mutation without optional column ${columnName}. Run the matching SQL later to enable it.`);
    return runCertificateMutationWithFallback(operation, nextPayload, attempt + 1);
  }

  throw error;
}

function createMockCertificate(payload) {
  const certificates = getMockCertificates();
  const created = { id: createMockId(certificates), ...payload };
  setMockCertificates([created, ...certificates]);
  return created;
}

export async function getCertificates() {
  if (!isSupabaseConfigured) return getMockCertificates();

  try {
    const { data, error } = await supabase
      .from("certificates")
      .select("id,student_id,student_name,course_id,course_title,certificate_number,issue_date,issued_at,status")
      .order("id", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(normalizeCertificate);
  } catch {
    return getMockCertificates();
  }
}

function isActiveEnrollment(enrollment) {
  return `${enrollment?.status ?? "active"}`.trim().toLowerCase() === "active";
}

function isSubmissionApproved(submission) {
  const status = `${submission?.status ?? ""}`.trim().toLowerCase();
  return (
    status === "approved" ||
    status === "graded" ||
    submission?.grade !== null && submission?.grade !== undefined ||
    Boolean(submission?.graded_at || submission?.gradedAt) ||
    ((submission?.reviewed_at || submission?.reviewedAt) && (status === "approved" || status === "accepted"))
  );
}

async function findExistingIssuedCertificate(studentId, courseId) {
  const normalizedStudentId = `${studentId ?? ""}`.trim();
  const normalizedCourseId = `${courseId ?? ""}`.trim();
  if (!normalizedStudentId || !normalizedCourseId) return null;

  if (!isSupabaseConfigured) {
    return (
      getMockCertificates().find(
        (certificate) =>
          String(certificate.studentId) === normalizedStudentId &&
          String(certificate.courseId) === normalizedCourseId &&
          `${certificate.status ?? "issued"}`.toLowerCase() === "issued",
      ) ?? null
    );
  }

  const { data, error } = await supabase
    .from("certificates")
    .select("id,student_id,student_name,course_id,course_title,certificate_number,issue_date,issued_at,status")
    .eq("student_id", normalizedStudentId)
    .eq("course_id", normalizedCourseId)
    .eq("status", "issued")
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Checking for an existing issued certificate failed:", error);
    throw error;
  }

  return data ? normalizeCertificate(data) : null;
}

async function getSupabaseStudentAndCourse(studentId, courseId) {
  const [{ data: studentRow, error: studentError }, { data: courseRow, error: courseError }] = await Promise.all([
    supabase.from("users").select("id, name").eq("id", studentId).limit(1).maybeSingle(),
    supabase.from("courses").select("id, title").eq("id", courseId).limit(1).maybeSingle(),
  ]);

  if (studentError) throw studentError;
  if (courseError) throw courseError;

  return {
    student: studentRow
      ? {
          id: studentRow.id,
          name: studentRow.name ?? studentRow.full_name ?? "",
        }
      : null,
    course: courseRow
      ? {
          id: courseRow.id,
          title: courseRow.title ?? "",
        }
      : null,
  };
}

async function getSupabaseAssignmentsForModules(moduleIds = []) {
  if (!moduleIds.length) return [];
  const { data, error } = await supabase
    .from("module_assignments")
    .select("id,module_id,title,instructions,title_en,title_es,instructions_en,instructions_es,submission_type")
    .in("module_id", moduleIds);
  if (error) {
    console.error("Loading module assignments for certificate eligibility failed:", error);
    throw error;
  }
  return data ?? [];
}

async function getSupabaseSubmissionsForStudent(studentId, assignmentIds = []) {
  if (!assignmentIds.length) return [];
  const { data, error } = await supabase
    .from("assignment_submissions")
    .select("id,assignment_id,student_id,status,grade,reviewed_at,graded_at")
    .eq("student_id", studentId)
    .in("assignment_id", assignmentIds);

  if (error) {
    console.error("Loading assignment submissions for certificate eligibility failed:", error);
    throw error;
  }
  return data ?? [];
}

function getMockStudentAndCourse(studentId, courseId) {
  const student = getMockUsers().find((entry) => String(entry.id) === String(studentId)) ?? null;
  const course = getMockCourses().find((entry) => String(entry.id) === String(courseId)) ?? null;
  return { student, course };
}

function evaluateModuleEligibility({ module, progressState, assignmentMap, submissionMap }) {
  const moduleProgressComplete = Boolean(progressState?.[`module-${module.id}`]);
  const assignment = assignmentMap.get(String(module.id)) ?? null;
  const requiresAssignment =
    module?.requires_assignment ??
    module?.requiresAssignment ??
    Boolean(assignment);

  if (!moduleProgressComplete) {
    return { complete: false, waitingForGrading: false };
  }

  if (!requiresAssignment) {
    return { complete: true, waitingForGrading: false };
  }

  if (!assignment) {
    return { complete: false, waitingForGrading: false };
  }

  const submission = submissionMap.get(String(assignment.id)) ?? null;
  if (!submission) {
    return { complete: false, waitingForGrading: false };
  }

  if (isSubmissionApproved(submission)) {
    return { complete: true, waitingForGrading: false };
  }

  const submissionStatus = `${submission.status ?? ""}`.trim().toLowerCase();
  return {
    complete: false,
    waitingForGrading: submissionStatus === "submitted" || submissionStatus === "needs_revision" || submissionStatus === "rejected",
  };
}

export async function maybeGenerateCertificate(studentId, courseId) {
  const normalizedStudentId = `${studentId ?? ""}`.trim();
  const normalizedCourseId = `${courseId ?? ""}`.trim();
  if (!normalizedStudentId || !normalizedCourseId) {
    return { generated: false, existing: null, waitingForGrading: false, incomplete: true };
  }

  const existingCertificate = await findExistingIssuedCertificate(normalizedStudentId, normalizedCourseId);
  if (existingCertificate) {
    return { generated: false, existing: existingCertificate, waitingForGrading: false, incomplete: false };
  }

  const enrollments = await getStudentEnrollments(normalizedStudentId);
  const activeEnrollment = enrollments.find(
    (enrollment) => String(enrollment.courseId ?? enrollment.course_id) === normalizedCourseId && isActiveEnrollment(enrollment),
  );
  if (!activeEnrollment) {
    return { generated: false, existing: null, waitingForGrading: false, incomplete: true };
  }

  const modules = await getModulesByCourse(normalizedCourseId);
  if (!modules.length) {
    return { generated: false, existing: null, waitingForGrading: false, incomplete: true };
  }

  const progressState = await getStudentProgress(normalizedStudentId);

  let student = null;
  let course = null;
  let assignmentRows = [];
  let submissionRows = [];

  if (isSupabaseConfigured) {
    const supabaseEntities = await getSupabaseStudentAndCourse(normalizedStudentId, normalizedCourseId);
    student = supabaseEntities.student;
    course = supabaseEntities.course;
    assignmentRows = await getSupabaseAssignmentsForModules(modules.map((module) => module.id));
    submissionRows = await getSupabaseSubmissionsForStudent(normalizedStudentId, assignmentRows.map((assignment) => assignment.id));
  } else {
    const mockEntities = getMockStudentAndCourse(normalizedStudentId, normalizedCourseId);
    student = mockEntities.student;
    course = mockEntities.course;
    assignmentRows = modules
      .map((module) => module.assignment ? { ...module.assignment, module_id: module.id } : null)
      .filter(Boolean);
    submissionRows = getMockAssignmentSubmissions().filter(
      (submission) =>
        String(submission.student_id ?? submission.studentId) === normalizedStudentId &&
        assignmentRows.some((assignment) => String(assignment.id) === String(submission.assignment_id ?? submission.assignmentId)),
    );
  }

  const assignmentMap = new Map(assignmentRows.map((assignment) => [String(assignment.module_id ?? assignment.moduleId), assignment]));
  const submissionMap = new Map(submissionRows.map((submission) => [String(submission.assignment_id ?? submission.assignmentId), submission]));

  let waitingForGrading = false;
  const everyModuleComplete = modules.every((module) => {
    const eligibility = evaluateModuleEligibility({ module, progressState, assignmentMap, submissionMap });
    if (eligibility.waitingForGrading) waitingForGrading = true;
    return eligibility.complete;
  });

  if (!everyModuleComplete) {
    return { generated: false, existing: null, waitingForGrading, incomplete: true };
  }

  const createdCertificate = await generateCertificate({
    studentId: normalizedStudentId,
    student: student?.name ?? "",
    courseId: normalizedCourseId,
    course: course?.title ?? "",
  });

  return { generated: true, certificate: createdCertificate, waitingForGrading: false, incomplete: false };
}

export async function generateCertificate({ studentId, student, courseId, course }) {
  const existingCertificate = await findExistingIssuedCertificate(studentId, courseId);
  if (existingCertificate) return existingCertificate;

  const payload = {
    studentId,
    student,
    courseId,
    course,
    number: createCertificateNumber(),
    issueDate: createIssueDate(),
    status: "issued",
  };

  if (!isSupabaseConfigured) {
    return createMockCertificate(payload);
  }

  try {
    const insertPayload = {
      student_id: payload.studentId,
      student_name: payload.student,
      course_id: payload.courseId,
      course_title: payload.course,
      certificate_number: payload.number,
      issue_date: payload.issueDate,
      issued_at: new Date().toISOString(),
      status: payload.status,
    };
    const data = await runCertificateMutationWithFallback(
      (nextPayload) => supabase.from("certificates").insert(nextPayload).select("*").single(),
      insertPayload,
    );
    return normalizeCertificate(data);
  } catch {
    return createMockCertificate(payload);
  }
}

export async function getStudentCertificates(studentId) {
  if (!isSupabaseConfigured) {
    return getMockCertificates().filter((certificate) => certificate.studentId === studentId);
  }

  try {
    const { data, error } = await supabase.from("certificates").select("*").eq("student_id", studentId).order("id", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(normalizeCertificate);
  } catch {
    return getMockCertificates().filter((certificate) => certificate.studentId === studentId);
  }
}
