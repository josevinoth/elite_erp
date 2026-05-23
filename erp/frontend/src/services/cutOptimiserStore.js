const CUT_OPTIMISER_RECORDS_KEY = "elite_erp_cut_optimiser_records_v1";

function readRecords() {
  try {
    const raw = window.localStorage.getItem(CUT_OPTIMISER_RECORDS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeRecords(records) {
  window.localStorage.setItem(CUT_OPTIMISER_RECORDS_KEY, JSON.stringify(records));
}

function toInt(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function listCutOptimiserRecords() {
  const rows = readRecords();
  return rows.sort((a, b) => toInt(b.id) - toInt(a.id));
}

export function getCutOptimiserRecordById(recordId) {
  const rows = readRecords();
  return rows.find((row) => String(row.id) === String(recordId)) || null;
}

export function getNextCutOptimiserRevision(projectKey, excludeRecordId = null) {
  if (!projectKey) return 1;

  const rows = readRecords();
  const maxRevision = rows
    .filter(
      (row) =>
        String(row.selectedProjectKey || "") === String(projectKey)
        && String(row.id) !== String(excludeRecordId || "")
    )
    .reduce((max, row) => Math.max(max, toInt(row.revision, 1)), 0);

  return maxRevision + 1;
}

export function createCutOptimiserRecord(payload) {
  const rows = readRecords();
  const nowIso = new Date().toISOString();
  const nextId = rows.reduce((max, row) => Math.max(max, toInt(row.id)), 0) + 1;

  const selectedProjectKey = String(payload?.selectedProjectKey || "");
  const revision = getNextCutOptimiserRevision(selectedProjectKey);

  const nextRecord = {
    id: nextId,
    revision,
    selectedProjectKey,
    projectLabel: payload?.projectLabel || "",
    form: payload?.form || {},
    rawSheets: Array.isArray(payload?.rawSheets) ? payload.rawSheets : [],
    cutItems: Array.isArray(payload?.cutItems) ? payload.cutItems : [],
    result: payload?.result || null,
    created_at: nowIso,
    updated_at: nowIso,
  };

  writeRecords([...rows, nextRecord]);
  return nextRecord;
}

export function updateCutOptimiserRecord(recordId, payload) {
  const rows = readRecords();
  const index = rows.findIndex((row) => String(row.id) === String(recordId));
  if (index < 0) {
    throw new Error("Cut optimiser record not found.");
  }

  const current = rows[index];
  const nextProjectKey = String(payload?.selectedProjectKey ?? current.selectedProjectKey ?? "");

  const nextRevision =
    nextProjectKey !== String(current.selectedProjectKey || "")
      ? getNextCutOptimiserRevision(nextProjectKey, recordId)
      : toInt(current.revision, 1);

  const updated = {
    ...current,
    selectedProjectKey: nextProjectKey,
    projectLabel: payload?.projectLabel ?? current.projectLabel ?? "",
    form: payload?.form ?? current.form,
    rawSheets: Array.isArray(payload?.rawSheets) ? payload.rawSheets : current.rawSheets,
    cutItems: Array.isArray(payload?.cutItems) ? payload.cutItems : current.cutItems,
    result: payload?.result ?? current.result,
    revision: nextRevision,
    updated_at: new Date().toISOString(),
  };

  const nextRows = [...rows];
  nextRows[index] = updated;
  writeRecords(nextRows);
  return updated;
}

export function deleteCutOptimiserRecord(recordId) {
  const rows = readRecords();
  const nextRows = rows.filter((row) => String(row.id) !== String(recordId));
  writeRecords(nextRows);
}

