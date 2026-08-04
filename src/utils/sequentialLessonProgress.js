function normalizeId(value) {
  return `${value ?? ""}`.trim();
}

function firstFilledValue(...values) {
  return values.find((value) => `${value ?? ""}`.trim()) || "";
}

function truthyFlag(value) {
  if (typeof value === "boolean") return value;
  const normalized = `${value ?? ""}`.trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
}

function sortValue(entry, fallback) {
  const value = Number(entry?.sort_order ?? entry?.sortOrder);
  return Number.isFinite(value) ? value : fallback;
}

function compareOrderedEntries(left, right) {
  const sortDifference = sortValue(left, 0) - sortValue(right, 0);
  if (sortDifference) return sortDifference;

  const leftCreatedAt = Date.parse(left?.created_at ?? left?.createdAt ?? "");
  const rightCreatedAt = Date.parse(right?.created_at ?? right?.createdAt ?? "");
  if (Number.isFinite(leftCreatedAt) && Number.isFinite(rightCreatedAt) && leftCreatedAt !== rightCreatedAt) {
    return leftCreatedAt - rightCreatedAt;
  }

  return normalizeId(left?.id).localeCompare(normalizeId(right?.id), undefined, { numeric: true });
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
    return Boolean(row?.module_completed) ||
      Boolean(row?.completed) ||
      `${row?.status ?? ""}`.trim().toLowerCase() === "completed" ||
      Boolean(row?.completed_at ?? row?.completedAt) ||
      Number(row?.progress_percent ?? row?.progressPercent ?? 0) >= 100;
  }

  return Boolean(progress?.[`module-${normalizedId}`]) ||
    Boolean(progress?.[normalizedId]?.module_completed) ||
    Boolean(progress?.[normalizedId]?.completed) ||
    `${progress?.[normalizedId]?.status ?? ""}`.trim().toLowerCase() === "completed" ||
    Boolean(progress?.[normalizedId]?.completed_at ?? progress?.[normalizedId]?.completedAt) ||
    Number(progress?.[normalizedId]?.progress_percent ?? progress?.[normalizedId]?.progressPercent ?? 0) >= 100;
}

function requirementProgressIsComplete(progress, moduleId, requirement) {
  const normalizedId = normalizeId(moduleId);
  const key = `${requirement}-${normalizedId}`;

  if (Array.isArray(progress)) {
    const row = progress.find(
      (entry) => normalizeId(entry?.module_id ?? entry?.moduleId) === normalizedId,
    );
    if (!row) return false;

    if (requirement === "pdf") {
      return Boolean(row.pdf_completed ?? row.pdf_viewed ?? row.pdfOpened ?? row.pdf_opened);
    }

    if (requirement === "video") {
      return Boolean(
        row.video_completed ??
          row.video_viewed ??
          row.video_viewed_at ??
          row.videoViewedAt ??
          row.videoOpened ??
          row.video_opened,
      );
    }

    return false;
  }

  return Boolean(
      progress?.[key] ??
      progress?.[normalizedId]?.[`${requirement}_completed`] ??
      progress?.[normalizedId]?.[`${requirement}_viewed`] ??
      progress?.[normalizedId]?.[`${requirement}_viewed_at`] ??
      progress?.[normalizedId]?.[`${requirement}ViewedAt`] ??
      progress?.[normalizedId]?.[`${requirement}Opened`],
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

export function getLessonRequirements(lesson = {}) {
  const assignment = lesson?.assignment ?? null;
  const assignmentRecordExists = Boolean(
    assignment?.id ||
      firstFilledValue(
        assignment?.title,
        assignment?.title_en,
        assignment?.titleEn,
        assignment?.title_es,
        assignment?.titleEs,
        assignment?.instructions,
        assignment?.instructions_en,
        assignment?.instructionsEn,
        assignment?.instructions_es,
        assignment?.instructionsEs,
      ),
  );
  const requiresAssignment = truthyFlag(lesson?.requires_assignment ?? lesson?.requiresAssignment);

  const hasPdf = Boolean(
    firstFilledValue(
      lesson?.pdf_url,
      lesson?.pdfUrl,
      lesson?.pdf_file_url,
      lesson?.pdfFileUrl,
      lesson?.pdf_public_url,
      lesson?.pdfPublicUrl,
      lesson?.pdf_path,
      lesson?.pdfPath,
      lesson?.pdf_storage_path,
      lesson?.pdfStoragePath,
      lesson?.pdf_external_url,
      lesson?.pdfExternalUrl,
      lesson?.external_pdf_url,
      lesson?.externalPdfUrl,
      lesson?.pdf_link,
      lesson?.pdfLink,
    ),
  );
  const hasVideo = Boolean(
    firstFilledValue(
      lesson?.video_url,
      lesson?.videoUrl,
      lesson?.video_file_url,
      lesson?.videoFileUrl,
      lesson?.video_public_url,
      lesson?.videoPublicUrl,
      lesson?.video_path,
      lesson?.videoPath,
      lesson?.video_storage_path,
      lesson?.videoStoragePath,
      lesson?.embed_url,
      lesson?.embedUrl,
      lesson?.video_embed_url,
      lesson?.videoEmbedUrl,
      lesson?.video_external_url,
      lesson?.videoExternalUrl,
      lesson?.external_video_url,
      lesson?.externalVideoUrl,
      lesson?.video_link,
      lesson?.videoLink,
      lesson?.video?.url,
      lesson?.video?.link,
    ),
  );
  const hasAssignment = Boolean(requiresAssignment && assignmentRecordExists);

  return {
    hasPdf,
    hasVideo,
    hasAssignment,
    requiresPdfView: hasPdf,
    requiresVideoView: hasVideo,
    requiresAssignmentSubmission: hasAssignment,
  };
}

export function lessonHasAnyContent(lesson = {}) {
  const requirements = getLessonRequirements(lesson);
  return Boolean(
    requirements.hasPdf ||
      requirements.hasVideo ||
      requirements.hasAssignment ||
      firstFilledValue(
        lesson?.lesson_content,
        lesson?.lessonContent,
        lesson?.image_url,
        lesson?.imageUrl,
        lesson?.image_file_name,
        lesson?.imageName,
      ),
  );
}

export function getLessonCompletionState({ lesson, progress = {}, submissions = null } = {}) {
  const requirements = getLessonRequirements(lesson);
  const assignment = lesson?.assignment ?? null;
  const submission = submissionForAssignment(submissions, assignment?.id);
  const moduleComplete = progressIsComplete(progress, lesson?.id);
  const pdfComplete = !requirements.requiresPdfView || requirementProgressIsComplete(progress, lesson?.id, "pdf");
  const videoComplete =
    !requirements.requiresVideoView || requirementProgressIsComplete(progress, lesson?.id, "video");
  const assignmentComplete =
    !requirements.requiresAssignmentSubmission ||
    submissionIsApproved(submission) ||
    (submissions === null && moduleComplete);

  return {
    ...requirements,
    moduleComplete,
    pdfComplete,
    videoComplete,
    assignmentComplete,
    requirementsComplete: pdfComplete && videoComplete && assignmentComplete,
    isComplete: moduleComplete,
    submission,
  };
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
    .sort(compareOrderedEntries)
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
        .sort(compareOrderedEntries)
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
    .sort(compareOrderedEntries)
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
    const completionState = getLessonCompletionState({ lesson, progress, submissions });
    const isComplete = completionState.isComplete;
    const isUnlocked = index === 0 || previousLessonsComplete;
    const previousLesson = orderedLessons[index - 1] ?? null;

    console.log("[LessonUnlock]", {
      currentModuleId: normalizeId(lesson?.id),
      previousModuleId: normalizeId(previousLesson?.id),
      previousProgress: previousLesson ? progressIsComplete(progress, previousLesson.id) : null,
      previousIsComplete: previousLesson
        ? getLessonCompletionState({ lesson: previousLesson, progress, submissions }).isComplete
        : null,
      isUnlocked,
      requirements: {
        hasPdf: completionState.hasPdf,
        hasVideo: completionState.hasVideo,
        hasAssignment: completionState.hasAssignment,
        pdfComplete: completionState.pdfComplete,
        videoComplete: completionState.videoComplete,
        assignmentComplete: completionState.assignmentComplete,
        moduleComplete: completionState.moduleComplete,
      },
    });

    if (isComplete) completedCount += 1;

    const state = {
      lesson,
      index,
      isComplete,
      isUnlocked,
      isLocked: !isUnlocked,
      assignmentComplete: completionState.assignmentComplete,
      requiresAssignment: completionState.requiresAssignmentSubmission,
      requirements: completionState,
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
