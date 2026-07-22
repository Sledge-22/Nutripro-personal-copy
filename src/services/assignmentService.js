import { isSupabaseConfigured, supabase } from "../lib/supabaseClient.js";
import { maybeGenerateCertificate } from "./certificateService.js";
import {
  createMockId,
  getMockAssignmentSubmissions,
  getMockCourses,
  getMockUsers,
  setMockAssignmentSubmissions,
  setMockCourses,
} from "./mockStore.js";

const VALID_SUBMISSION_STATUSES = new Set(["submitted", "approved", "needs_revision", "rejected"]);
const OPTIONAL_ASSIGNMENT_COLUMNS = ["title_en", "title_es", "instructions_en", "instructions_es"];

function normalizeEntityId(value) {
  const trimmedValue = `${value ?? ""}`.trim();
  if (!trimmedValue) return "";

  const numericValue = Number(trimmedValue);
  return Number.isNaN(numericValue) ? trimmedValue : numericValue;
}

function normalizeSubmissionType(value) {
  const normalizedValue = `${value ?? "file"}`.trim().toLowerCase();
  if (normalizedValue === "text" || normalizedValue === "file" || normalizedValue === "text_and_file") {
    return normalizedValue;
  }
  return "file";
}

function normalizeSubmissionStatus(value) {
  const normalizedValue = `${value ?? "submitted"}`.trim().toLowerCase();
  return VALID_SUBMISSION_STATUSES.has(normalizedValue) ? normalizedValue : "submitted";
}

function normalizeGrade(value) {
  if (value === "" || value === null || value === undefined) return null;

  const numericValue = Number(value);
  if (Number.isNaN(numericValue) || numericValue < 0 || numericValue > 100) {
    throw new Error("Grade must be between 0 and 100.");
  }

  return numericValue;
}

function normalizeOptionalNumber(value) {
  if (value === "" || value === null || value === undefined) return null;
  const numericValue = Number(value);
  return Number.isNaN(numericValue) ? null : numericValue;
}

function normalizeAssignment(row) {
  if (!row) return null;

  const titleEn = row.title_en ?? row.titleEn ?? "";
  const titleEs = row.title_es ?? row.titleEs ?? "";
  const instructionsEn = row.instructions_en ?? row.instructionsEn ?? "";
  const instructionsEs = row.instructions_es ?? row.instructionsEs ?? "";

  return {
    id: row.id,
    moduleId: row.module_id ?? row.moduleId,
    title: row.title ?? titleEn ?? titleEs ?? "",
    instructions: row.instructions ?? instructionsEn ?? instructionsEs ?? "",
    titleEn,
    title_en: titleEn,
    titleEs,
    title_es: titleEs,
    instructionsEn,
    instructions_en: instructionsEn,
    instructionsEs,
    instructions_es: instructionsEs,
    submissionType: normalizeSubmissionType(row.submission_type ?? row.submissionType),
    submission_type: normalizeSubmissionType(row.submission_type ?? row.submissionType),
  };
}

function normalizeSubmission(row, context = {}) {
  if (!row) return null;

  const assignment = normalizeAssignment(context.assignment);
  const module = context.module ?? null;
  const courseClass = context.courseClass ?? null;
  const course = context.course ?? null;
  const student = context.student ?? null;
  const grade = row.grade === null || row.grade === undefined || row.grade === "" ? null : Number(row.grade);
  const filePublicUrl = row.file_public_url ?? row.file_url ?? row.submission_file_url ?? "";
  const fileStoragePath = row.file_storage_path ?? row.storage_path ?? row.submission_file_storage_path ?? "";

  return {
    id: row.id,
    assignmentId: row.assignment_id ?? row.assignmentId,
    studentId: row.student_id ?? row.studentId,
    textResponse: row.text_response ?? row.response_text ?? row.submission_text ?? "",
    text_response: row.text_response ?? row.response_text ?? row.submission_text ?? "",
    filePublicUrl,
    file_public_url: filePublicUrl,
    fileUrl: filePublicUrl,
    fileName: row.file_name ?? row.submission_file_name ?? "",
    file_name: row.file_name ?? row.submission_file_name ?? "",
    fileStoragePath,
    file_storage_path: fileStoragePath,
    fileType: row.file_type ?? row.submission_file_type ?? "",
    file_type: row.file_type ?? row.submission_file_type ?? "",
    fileSize: normalizeOptionalNumber(row.file_size),
    file_size: normalizeOptionalNumber(row.file_size),
    status: normalizeSubmissionStatus(row.status),
    adminFeedback: row.admin_feedback ?? "",
    admin_feedback: row.admin_feedback ?? "",
    grade: Number.isNaN(grade) ? null : grade,
    reviewedAt: row.reviewed_at ?? null,
    reviewed_at: row.reviewed_at ?? null,
    gradedAt: row.graded_at ?? null,
    graded_at: row.graded_at ?? null,
    submittedAt: row.submitted_at ?? row.created_at ?? null,
    submitted_at: row.submitted_at ?? row.created_at ?? null,
    assignment,
    assignmentTitle: assignment?.title ?? context.assignmentTitle ?? "",
    assignmentInstructions: assignment?.instructions ?? "",
    moduleId: assignment?.moduleId ?? module?.id ?? null,
    moduleTitle: module?.title ?? "",
    classId: module?.class_id ?? module?.classId ?? courseClass?.id ?? null,
    classTitle: courseClass?.title ?? "",
    courseId: module?.courseId ?? course?.id ?? null,
    courseTitle: course?.title ?? "",
    studentName: student?.name ?? "",
    studentEmail: student?.email ?? "",
  };
}

function sanitizeAssignmentData(assignmentData = {}) {
  const titleEn = `${assignmentData.titleEn ?? assignmentData.title_en ?? ""}`.trim();
  const titleEs = `${assignmentData.titleEs ?? assignmentData.title_es ?? ""}`.trim();
  const instructionsEn = `${assignmentData.instructionsEn ?? assignmentData.instructions_en ?? ""}`.trim();
  const instructionsEs = `${assignmentData.instructionsEs ?? assignmentData.instructions_es ?? ""}`.trim();
  const fallbackTitle = `${assignmentData.title ?? ""}`.trim();
  const fallbackInstructions = `${assignmentData.instructions ?? ""}`.trim();

  return {
    title: fallbackTitle || titleEn || titleEs,
    instructions: fallbackInstructions || instructionsEn || instructionsEs,
    title_en: titleEn || null,
    title_es: titleEs || null,
    instructions_en: instructionsEn || null,
    instructions_es: instructionsEs || null,
    submission_type: "file",
  };
}

async function runAssignmentMutationWithFallback(operation, payload, attempt = 0) {
  const { data, error } = await operation(payload);
  if (!error) return data;

  const columnName = OPTIONAL_ASSIGNMENT_COLUMNS.find(
    (column) =>
      column in payload &&
      (error.message?.includes(`'${column}'`) ||
        error.message?.includes(`module_assignments.${column}`) ||
        error.details?.includes(column) ||
        error.hint?.includes(column)),
  );

  if (columnName && attempt < OPTIONAL_ASSIGNMENT_COLUMNS.length) {
    const nextPayload = { ...payload };
    delete nextPayload[columnName];
    console.warn(`Retrying assignment mutation without optional column ${columnName}. Run the matching SQL later to enable it.`);
    return runAssignmentMutationWithFallback(operation, nextPayload, attempt + 1);
  }

  throw error;
}

function allMockModules() {
  return getMockCourses().flatMap((course) =>
    (course.modules ?? []).map((module) => ({
      course,
      module,
    })),
  );
}

function findMockModuleEntry(moduleId) {
  return allMockModules().find(({ module }) => String(module.id) === String(moduleId)) ?? null;
}

function nextMockAssignmentId() {
  return allMockModules().reduce((maxValue, { module }) => Math.max(maxValue, Number(module.assignment?.id) || 0), 0) + 1;
}

function updateMockAssignmentForModule(moduleId, updater) {
  let updatedAssignment = null;

  const nextCourses = getMockCourses().map((course) => ({
    ...course,
    modules: (course.modules ?? []).map((module) => {
      if (String(module.id) !== String(moduleId)) return module;

      const nextAssignment = updater(module.assignment ?? null, module, course);
      updatedAssignment = nextAssignment;

      return {
        ...module,
        assignment: nextAssignment,
      };
    }),
  }));

  setMockCourses(nextCourses);
  return updatedAssignment;
}

async function hydrateSubmissions(rows = []) {
  if (!rows.length) return [];

  const assignmentIds = Array.from(new Set(rows.map((row) => row.assignment_id ?? row.assignmentId).filter(Boolean)));
  const studentIds = Array.from(new Set(rows.map((row) => row.student_id ?? row.studentId).filter(Boolean)));

  const [assignmentRows, userRows] = await Promise.all([
    assignmentIds.length
      ? supabase.from("module_assignments").select("*").in("id", assignmentIds).then(({ data, error }) => {
          if (error) throw error;
          return data ?? [];
        })
      : Promise.resolve([]),
    studentIds.length
      ? supabase.from("users").select("*").in("id", studentIds).then(({ data, error }) => {
          if (error) throw error;
          return data ?? [];
        })
      : Promise.resolve([]),
  ]);

  const assignmentMap = new Map(assignmentRows.map((assignment) => [String(assignment.id), assignment]));
  const moduleIds = Array.from(
    new Set(assignmentRows.map((assignment) => assignment.module_id ?? assignment.moduleId).filter(Boolean)),
  );

  const moduleRows = moduleIds.length
    ? await supabase.from("modules").select("*").in("id", moduleIds).then(({ data, error }) => {
        if (error) throw error;
        return data ?? [];
      })
    : [];

  const moduleMap = new Map(moduleRows.map((module) => [String(module.id), module]));
  const classIds = Array.from(new Set(moduleRows.map((module) => module.class_id ?? module.classId).filter(Boolean)));
  const classRows = classIds.length
    ? await supabase.from("course_classes").select("id,title").in("id", classIds).then(({ data, error }) => {
        if (error) throw error;
        return data ?? [];
      })
    : [];
  const classMap = new Map(classRows.map((courseClass) => [String(courseClass.id), courseClass]));
  const courseIds = Array.from(new Set(moduleRows.map((module) => module.course_id ?? module.courseId).filter(Boolean)));

  const courseRows = courseIds.length
    ? await supabase.from("courses").select("*").in("id", courseIds).then(({ data, error }) => {
        if (error) throw error;
        return data ?? [];
      })
    : [];

  const courseMap = new Map(courseRows.map((course) => [String(course.id), course]));
  const userMap = new Map(userRows.map((user) => [String(user.id), user]));

  return rows.map((row) => {
    const assignment = assignmentMap.get(String(row.assignment_id ?? row.assignmentId));
    const module = assignment ? moduleMap.get(String(assignment.module_id ?? assignment.moduleId)) : null;
    const courseClass = module ? classMap.get(String(module.class_id ?? module.classId)) : null;
    const course = module ? courseMap.get(String(module.course_id ?? module.courseId)) : null;
    const student = userMap.get(String(row.student_id ?? row.studentId));

    return normalizeSubmission(row, { assignment, module, courseClass, course, student });
  });
}

function hydrateMockSubmission(submission) {
  const assignmentId = submission.assignment_id ?? submission.assignmentId;
  const studentId = submission.student_id ?? submission.studentId;
  const assignmentEntry = allMockModules().find(({ module }) => String(module.assignment?.id) === String(assignmentId)) ?? null;
  const student = getMockUsers().find((user) => String(user.id) === String(studentId)) ?? null;

  return normalizeSubmission(submission, {
    assignment: assignmentEntry?.module?.assignment ?? null,
    module: assignmentEntry?.module ?? null,
    courseClass:
      assignmentEntry?.course?.classes?.find(
        (entry) => String(entry.id) === String(assignmentEntry?.module?.class_id ?? assignmentEntry?.module?.classId),
      ) ?? null,
    course: assignmentEntry?.course ?? null,
    student,
  });
}

export async function getAssignmentByModule(moduleId) {
  if (!moduleId) return null;

  if (!isSupabaseConfigured) {
    return normalizeAssignment(findMockModuleEntry(moduleId)?.module?.assignment ?? null);
  }

  const normalizedModuleId = normalizeEntityId(moduleId);
  const { data, error } = await supabase
    .from("module_assignments")
    .select("*")
    .eq("module_id", normalizedModuleId)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Failed to load module assignment from Supabase:", error);
    throw error;
  }

  return normalizeAssignment(data);
}

export async function getAssignmentsByModuleIds(moduleIds = []) {
  const normalizedIds = Array.from(new Set(moduleIds.map((moduleId) => normalizeEntityId(moduleId)).filter(Boolean)));
  if (!normalizedIds.length) return new Map();

  if (!isSupabaseConfigured) {
    return new Map(
      normalizedIds
        .map((moduleId) => {
          const assignment = normalizeAssignment(findMockModuleEntry(moduleId)?.module?.assignment ?? null);
          return assignment ? [String(moduleId), assignment] : null;
        })
        .filter(Boolean),
    );
  }

  const { data, error } = await supabase.from("module_assignments").select("*").in("module_id", normalizedIds);
  if (error) {
    console.error("Failed to load module assignments from Supabase:", error);
    throw error;
  }

  return new Map((data ?? []).map((row) => [String(row.module_id ?? row.moduleId), normalizeAssignment(row)]));
}

export async function createAssignment(moduleId, assignmentData) {
  const normalizedModuleId = normalizeEntityId(moduleId);
  const payload = sanitizeAssignmentData(assignmentData);

  if (!payload.title) {
    throw new Error("Assignment title is required.");
  }

  if (!isSupabaseConfigured) {
    return normalizeAssignment(
      updateMockAssignmentForModule(normalizedModuleId, () => ({
        id: nextMockAssignmentId(),
        moduleId: normalizedModuleId,
        ...payload,
        titleEn: payload.title_en ?? "",
        titleEs: payload.title_es ?? "",
        instructionsEn: payload.instructions_en ?? "",
        instructionsEs: payload.instructions_es ?? "",
        submissionType: payload.submission_type,
      })),
    );
  }

  const data = await runAssignmentMutationWithFallback(
    (nextPayload) =>
      supabase
        .from("module_assignments")
        .insert([{ module_id: normalizedModuleId, ...nextPayload }])
        .select("*")
        .single(),
    payload,
  );

  return normalizeAssignment(data);
}

export async function updateAssignment(assignmentId, assignmentData) {
  const normalizedAssignmentId = normalizeEntityId(assignmentId);
  const payload = sanitizeAssignmentData(assignmentData);

  if (!payload.title) {
    throw new Error("Assignment title is required.");
  }

  if (!isSupabaseConfigured) {
    const assignmentEntry = allMockModules().find(({ module }) => String(module.assignment?.id) === String(normalizedAssignmentId)) ?? null;
    if (!assignmentEntry) return null;

    return normalizeAssignment(
      updateMockAssignmentForModule(assignmentEntry.module.id, (assignment) => ({
        ...(assignment ?? {}),
        id: normalizedAssignmentId,
        moduleId: assignmentEntry.module.id,
        ...payload,
        titleEn: payload.title_en ?? "",
        titleEs: payload.title_es ?? "",
        instructionsEn: payload.instructions_en ?? "",
        instructionsEs: payload.instructions_es ?? "",
        submissionType: payload.submission_type,
      })),
    );
  }

  const data = await runAssignmentMutationWithFallback(
    (nextPayload) =>
      supabase
        .from("module_assignments")
        .update(nextPayload)
        .eq("id", normalizedAssignmentId)
        .select("*")
        .single(),
    payload,
  );

  return normalizeAssignment(data);
}

export async function deleteAssignment(assignmentId) {
  const normalizedAssignmentId = normalizeEntityId(assignmentId);

  if (!isSupabaseConfigured) {
    const assignmentEntry = allMockModules().find(({ module }) => String(module.assignment?.id) === String(normalizedAssignmentId)) ?? null;
    if (!assignmentEntry) return true;

    updateMockAssignmentForModule(assignmentEntry.module.id, () => null);
    setMockAssignmentSubmissions(
      getMockAssignmentSubmissions().filter(
        (submission) => String(submission.assignment_id ?? submission.assignmentId) !== String(normalizedAssignmentId),
      ),
    );
    return true;
  }

  const { error: submissionError } = await supabase
    .from("assignment_submissions")
    .delete()
    .eq("assignment_id", normalizedAssignmentId);

  if (submissionError) {
    console.error("Failed to delete assignment submissions in Supabase:", submissionError);
    throw submissionError;
  }

  const { error } = await supabase.from("module_assignments").delete().eq("id", normalizedAssignmentId);
  if (error) {
    console.error("Failed to delete module assignment in Supabase:", error);
    throw error;
  }

  return true;
}

export async function deleteAssignmentsForModuleIds(moduleIds = []) {
  const normalizedIds = Array.from(new Set(moduleIds.map((moduleId) => normalizeEntityId(moduleId)).filter(Boolean)));
  if (!normalizedIds.length) return;

  if (!isSupabaseConfigured) {
    const assignmentIds = allMockModules()
      .filter(({ module }) => normalizedIds.some((moduleId) => String(module.id) === String(moduleId)))
      .map(({ module }) => module.assignment?.id)
      .filter(Boolean);

    const nextCourses = getMockCourses().map((course) => ({
      ...course,
      modules: (course.modules ?? []).map((module) =>
        normalizedIds.some((moduleId) => String(module.id) === String(moduleId))
          ? { ...module, assignment: null }
          : module,
      ),
    }));

    setMockCourses(nextCourses);
    setMockAssignmentSubmissions(
      getMockAssignmentSubmissions().filter(
        (submission) =>
          !assignmentIds.some((assignmentId) => String(submission.assignment_id ?? submission.assignmentId) === String(assignmentId)),
      ),
    );
    return;
  }

  const { data: assignments, error: assignmentLoadError } = await supabase
    .from("module_assignments")
    .select("id")
    .in("module_id", normalizedIds);

  if (assignmentLoadError) {
    console.error("Failed to load module assignments before cleanup:", assignmentLoadError);
    throw assignmentLoadError;
  }

  const assignmentIds = (assignments ?? []).map((assignment) => assignment.id).filter(Boolean);

  if (assignmentIds.length) {
    const { error: submissionDeleteError } = await supabase
      .from("assignment_submissions")
      .delete()
      .in("assignment_id", assignmentIds);

    if (submissionDeleteError) {
      console.error("Failed to delete assignment submissions before module cleanup:", submissionDeleteError);
      throw submissionDeleteError;
    }
  }

  const { error } = await supabase.from("module_assignments").delete().in("module_id", normalizedIds);
  if (error) {
    console.error("Failed to delete module assignments before module cleanup:", error);
    throw error;
  }
}

export async function syncAssignmentsForModules(savedModules = [], sourceModules = []) {
  if (!savedModules.length) return [];

  const nextModules = [];

  for (const savedModule of savedModules) {
    const sourceModule =
      sourceModules.find((module) => String(module.id) === String(savedModule.id)) ??
      sourceModules.find((module) => Number(module.sortOrder ?? 0) === Number(savedModule.sortOrder ?? 0)) ??
      sourceModules[savedModule.sortOrder - 1] ??
      sourceModules[nextModules.length];

    const sourceAssignment = sourceModule?.assignment ?? null;

    const requiresAssignment =
      sourceModule?.requires_assignment ??
      sourceModule?.requiresAssignment ??
      Boolean(sourceAssignment?.title?.trim());

    if (requiresAssignment && sourceAssignment?.title?.trim()) {
      const createdAssignment = await createAssignment(savedModule.id, sourceAssignment);
      nextModules.push({
        ...savedModule,
        assignment: createdAssignment,
      });
    } else {
      nextModules.push({
        ...savedModule,
        assignment: null,
      });
    }
  }

  return nextModules;
}

export async function submitAssignment(assignmentId, studentId, responseData = {}) {
  const normalizedAssignmentId = normalizeEntityId(assignmentId);
  const normalizedStudentId = normalizeEntityId(studentId);
  const submittedAt = new Date().toISOString();
  const payload = {
    assignment_id: normalizedAssignmentId,
    student_id: normalizedStudentId,
    text_response: `${responseData.textResponse ?? responseData.text_response ?? ""}`.trim() || null,
    file_public_url:
      responseData.filePublicUrl ??
      responseData.file_public_url ??
      responseData.fileUrl ??
      responseData.file_url ??
      null,
    file_name: responseData.fileName ?? responseData.file_name ?? null,
    file_storage_path:
      responseData.fileStoragePath ??
      responseData.file_storage_path ??
      responseData.storagePath ??
      responseData.storage_path ??
      null,
    file_type: responseData.fileType ?? responseData.file_type ?? null,
    file_size:
      responseData.fileSize === null || responseData.fileSize === undefined || responseData.fileSize === ""
        ? null
        : Number(responseData.fileSize),
    status: "submitted",
    admin_feedback: null,
    grade: null,
    submitted_at: submittedAt,
    reviewed_at: null,
    graded_at: null,
  };

  if (!isSupabaseConfigured) {
    const submissions = getMockAssignmentSubmissions();
    const existingSubmission = submissions.find(
      (submission) =>
        String(submission.assignment_id ?? submission.assignmentId) === String(normalizedAssignmentId) &&
        String(submission.student_id ?? submission.studentId) === String(normalizedStudentId),
    );

    if (existingSubmission && normalizeSubmissionStatus(existingSubmission.status) === "approved") {
      throw new Error("This assignment has already been submitted. Resubmission is not allowed.");
    }

    const nextSubmission = existingSubmission
      ? {
          ...existingSubmission,
          ...payload,
          created_at: existingSubmission.created_at ?? submittedAt,
        }
      : {
          id: createMockId(submissions),
          ...payload,
          created_at: submittedAt,
        };

    const nextSubmissions = existingSubmission
      ? submissions.map((submission) =>
          String(submission.id) === String(existingSubmission.id) ? nextSubmission : submission,
        )
      : [...submissions, nextSubmission];

    setMockAssignmentSubmissions(nextSubmissions);
    const hydratedSubmission = hydrateMockSubmission(nextSubmission);
    if (hydratedSubmission?.courseId) {
      try {
        await maybeGenerateCertificate(normalizedStudentId, hydratedSubmission.courseId);
      } catch (certificateError) {
        console.error("Checking certificate eligibility after mock assignment submission failed:", certificateError);
      }
    }
    return hydratedSubmission;
  }

  const { data: existingRows, error: existingError } = await supabase
    .from("assignment_submissions")
    .select("*")
    .eq("assignment_id", normalizedAssignmentId)
    .eq("student_id", normalizedStudentId)
    .limit(1);

  if (existingError) {
    console.error("Failed to check for an existing assignment submission:", existingError);
    throw existingError;
  }

  const existingSubmission = (existingRows ?? [])[0] ?? null;

  if (existingSubmission && normalizeSubmissionStatus(existingSubmission.status) === "approved") {
    throw new Error("This assignment has already been submitted. Resubmission is not allowed.");
  }

  const mutation = existingSubmission
    ? supabase
        .from("assignment_submissions")
        .update(payload)
        .eq("id", existingSubmission.id)
        .select("*")
        .single()
    : supabase.from("assignment_submissions").insert([payload]).select("*").single();

  const { data, error } = await mutation;
  if (error) {
    console.error("Failed to create assignment submission in Supabase:", error);
    throw error;
  }

  const hydratedSubmission = (await hydrateSubmissions([data]))[0] ?? null;
  if (hydratedSubmission?.courseId) {
    try {
      await maybeGenerateCertificate(normalizedStudentId, hydratedSubmission.courseId);
    } catch (certificateError) {
      console.error("Checking certificate eligibility after assignment submission failed:", certificateError);
    }
  }

  return hydratedSubmission;
}

export async function getSubmissionsForAdmin() {
  if (!isSupabaseConfigured) {
    return getMockAssignmentSubmissions().map(hydrateMockSubmission);
  }

  const { data, error } = await supabase
    .from("assignment_submissions")
    .select("*")
    .order("submitted_at", { ascending: false, nullsFirst: false })
    .order("id", { ascending: false });

  if (error) {
    console.error("Failed to load assignment submissions from Supabase:", error);
    throw error;
  }

  return hydrateSubmissions(data ?? []);
}

export async function getSubmissionsByAssignment(assignmentId) {
  const normalizedAssignmentId = normalizeEntityId(assignmentId);

  if (!isSupabaseConfigured) {
    return getMockAssignmentSubmissions()
      .filter((submission) => String(submission.assignment_id ?? submission.assignmentId) === String(normalizedAssignmentId))
      .map(hydrateMockSubmission);
  }

  const { data, error } = await supabase
    .from("assignment_submissions")
    .select("*")
    .eq("assignment_id", normalizedAssignmentId)
    .order("submitted_at", { ascending: false, nullsFirst: false })
    .order("id", { ascending: false });

  if (error) {
    console.error("Failed to load assignment submissions for the selected assignment:", error);
    throw error;
  }

  return hydrateSubmissions(data ?? []);
}

export async function getStudentSubmission(assignmentId, studentId) {
  const normalizedAssignmentId = normalizeEntityId(assignmentId);
  const normalizedStudentId = normalizeEntityId(studentId);

  if (!isSupabaseConfigured) {
    const submission =
      getMockAssignmentSubmissions().find(
        (row) =>
          String(row.assignment_id ?? row.assignmentId) === String(normalizedAssignmentId) &&
          String(row.student_id ?? row.studentId) === String(normalizedStudentId),
      ) ?? null;

    return submission ? hydrateMockSubmission(submission) : null;
  }

  const { data, error } = await supabase
    .from("assignment_submissions")
    .select("*")
    .eq("assignment_id", normalizedAssignmentId)
    .eq("student_id", normalizedStudentId)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Failed to load the student assignment submission from Supabase:", error);
    throw error;
  }

  if (!data) return null;
  return (await hydrateSubmissions([data]))[0] ?? null;
}

export async function reviewSubmission(submissionId, status, adminFeedback, grade) {
  const normalizedSubmissionId = normalizeEntityId(submissionId);
  const nextStatus = normalizeSubmissionStatus(status);
  const nextGrade = normalizeGrade(grade);
  const timestamp = new Date().toISOString();
  const payload = {
    status: nextStatus,
    admin_feedback: `${adminFeedback ?? ""}`.trim() || null,
    grade: nextGrade,
    reviewed_at: timestamp,
    graded_at: nextGrade === null ? null : timestamp,
  };

  if (!isSupabaseConfigured) {
    const submissions = getMockAssignmentSubmissions();
    const existingSubmission = submissions.find((submission) => String(submission.id) === String(normalizedSubmissionId));
    if (!existingSubmission) throw new Error("Submission not found.");

    const nextSubmission = {
      ...existingSubmission,
      ...payload,
    };

    setMockAssignmentSubmissions(
      submissions.map((submission) => (submission.id === existingSubmission.id ? nextSubmission : submission)),
    );
    const hydratedSubmission = hydrateMockSubmission(nextSubmission);
    const certificateOutcome = hydratedSubmission?.studentId && hydratedSubmission?.courseId
      ? await maybeGenerateCertificate(hydratedSubmission.studentId, hydratedSubmission.courseId)
      : null;

    return hydratedSubmission
      ? {
          ...hydratedSubmission,
          certificateOutcome,
        }
      : null;
  }

  const { data, error } = await supabase
    .from("assignment_submissions")
    .update(payload)
    .eq("id", normalizedSubmissionId)
    .select("*")
    .single();

  if (error) {
    console.error("Failed to save assignment review in Supabase:", error);
    throw error;
  }

  const hydratedSubmission = (await hydrateSubmissions([data]))[0] ?? null;
  const certificateOutcome = hydratedSubmission?.studentId && hydratedSubmission?.courseId
    ? await maybeGenerateCertificate(hydratedSubmission.studentId, hydratedSubmission.courseId)
    : null;

  return hydratedSubmission
    ? {
        ...hydratedSubmission,
        certificateOutcome,
      }
    : null;
}
