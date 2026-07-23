function normalizeId(value) {
  return `${value ?? ""}`.trim();
}

function sortValue(entry, fallback) {
  const value = Number(entry?.sort_order ?? entry?.sortOrder);
  return Number.isFinite(value) ? value : fallback;
}

function submissionIsApproved(submission) {
  if (!submission) return false;

  const status = `${submission.status ?? ""}`.trim().toLowerCase();
  return (
    status === "approved" ||
    status === "graded" ||
    (submission.grade !== null && submission.grade !== undefined) ||
    Boolean(submission.graded_at ?? submission.gradedAt)
  );
}

function progressIsComplete(progress, moduleId) {
  const normalizedId = normalizeId(moduleId);

  if (Array.isArray(progress)) {
    const row = progress.find(
      (entry) => normalizeId(entry?.module_id ?? entry?.moduleId) === normalizedId,
    );
    return Boolean(row?.module_completed ?? row?.completed);
  }

  return Boolean(
    progress?.[`module-${normalizedId}`] ??
      progress?.[normalizedId]?.module_completed ??
      progress?.[normalizedId]?.completed,
  );
}

function submissionForAssignment(submissions, assignmentId) {
  const normalizedId = normalizeId(assignmentId);
  if (!normalizedId) return null;

  if (Array.isArray(submissions)) {
    return (
      submissions.find(
        (entry) => normalizeId(entry?.assignment_id ?? entry?.assignmentId) === normalizedId,
      ) ?? null
    );
  }

  if (submissions instanceof Map) {
    return submissions.get(normalizedId) ?? submissions.get(assignmentId) ?? null;
  }

  return submissions?.[normalizedId] ?? null;
}

function orderedCourseLessons(classes = [], modules = []) {
  const safeClasses = Array.isArray(classes) ? classes : [];
  const safeModules = Array.isArray(modules) ? modules : [];
  const moduleById = new Map(
    safeModules
      .filter((module) => normalizeId(module?.id))
      .map((module) => [normalizeId(module.id), module]),
  );
  const seen = new Set();
  const ordered = [];

  [...safeClasses]
    .sort((left, right) => sortValue(left, 0) - sortValue(right, 0))
    .forEach((courseClass, classIndex) => {
      const classId = normalizeId(courseClass?.id);
      const nestedModules = Array.isArray(courseClass?.modules) ? courseClass.modules : [];
      const classModules = [
        ...nestedModules,
        ...safeModules.filter(
          (module) =>
            normalizeId(module?.class_id ?? module?.classId) === classId &&
            !nestedModules.some((nested) => normalizeId(nested?.id) === normalizeId(module?.id)),
        ),
      ];

      classModules
        .sort((left, right) => sortValue(left, 0) - sortValue(right, 0))
        .forEach((module, moduleIndex) => {
          const moduleId = normalizeId(module?.id);
          if (!moduleId || seen.has(moduleId)) return;
          seen.add(moduleId);
          ordered.push({
            ...moduleById.get(moduleId),
            ...module,
            classId,
            classTitle: courseClass?.title ?? "",
            classIndex,
            moduleIndex,
          });
        });
    });

  safeModules
    .filter((module) => !seen.has(normalizeId(module?.id)))
    .sort((left, right) => sortValue(left, 0) - sortValue(right, 0))
    .forEach((module, moduleIndex) => {
      const moduleId = normalizeId(module?.id);
      if (!moduleId) return;
      ordered.push({
        ...module,
        classId: normalizeId(module?.class_id ?? module?.classId),
        classTitle: "",
        classIndex: safeClasses.length,
        moduleIndex,
      });
    });

  return ordered;
}

export function getSequentialLessonStates({
  classes = [],
  modules = [],
  progress = {},
  submissions = null,
} = {}) {
  const orderedLessons = orderedCourseLessons(classes, modules);
  const lessonStates = new Map();
  let previousLessonsComplete = true;
  let blockingLesson = null;
  let completedCount = 0;

  orderedLessons.forEach((lesson, index) => {
    const assignment = lesson?.assignment ?? null;
    const requiresAssignment = Boolean(
      lesson?.requires_assignment ?? lesson?.requiresAssignment ?? assignment?.id,
    );
    const submission = submissionForAssignment(submissions, assignment?.id);
    const progressComplete = progressIsComplete(progress, lesson.id);
    const assignmentComplete =
      !requiresAssignment ||
      submissionIsApproved(submission) ||
      (submissions === null && progressComplete);
    const isComplete = progressComplete && assignmentComplete;
    const isUnlocked = index === 0 || previousLessonsComplete;

    if (isComplete) completedCount += 1;

    const state = {
      lesson,
      index,
      isComplete,
      isUnlocked,
      isLocked: !isUnlocked,
      assignmentComplete,
      requiresAssignment,
      blockingLesson: isUnlocked ? null : blockingLesson,
      lockReason:
        !isUnlocked && blockingLesson?.classId !== lesson.classId
          ? "previous-class"
          : !isUnlocked
            ? "previous-lesson"
            : null,
    };

    lessonStates.set(normalizeId(lesson.id), state);

    if (previousLessonsComplete && !isComplete) {
      blockingLesson = lesson;
    }
    previousLessonsComplete = previousLessonsComplete && isComplete;
  });

  const nextLessonState =
    orderedLessons
      .map((lesson) => lessonStates.get(normalizeId(lesson.id)))
      .find((state) => state?.isUnlocked && !state?.isComplete) ?? null;

  return {
    orderedLessons,
    lessonStates,
    completedCount,
    totalCount: orderedLessons.length,
    nextLesson: nextLessonState?.lesson ?? null,
    courseComplete: orderedLessons.length > 0 && completedCount === orderedLessons.length,
  };
}
