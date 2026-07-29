const describeTarget = (table, ids) => ({
  table,
  ids: Array.isArray(ids) ? ids.map(String) : [String(ids)],
});

/**
 * Destructive database writes must never be used by normal save/sync paths.
 * Callers must represent an explicit, confirmed Admin action.
 */
export function requireConfirmedDelete({
  table,
  ids,
  confirmed = false,
  allowBulk = false,
  reason = "",
}) {
  const normalizedIds = (Array.isArray(ids) ? ids : [ids]).filter(
    (id) => id !== null && id !== undefined && `${id}`.trim(),
  );
  const target = describeTarget(table, normalizedIds);

  if (!confirmed) {
    console.warn("[DataSafety] Blocked destructive operation without explicit confirmation.", {
      ...target,
      reason,
    });
    throw new Error("This delete requires explicit administrator confirmation.");
  }

  if (normalizedIds.length !== 1 && !allowBulk) {
    console.warn("[DataSafety] Blocked unapproved bulk delete.", {
      ...target,
      reason,
    });
    throw new Error("Bulk delete is blocked by the data safety policy.");
  }

  if (import.meta.env.DEV) {
    console.warn("[DataSafety] Running explicitly confirmed destructive operation.", {
      ...target,
      reason,
    });
  }

  return normalizedIds;
}
