import { ensureCsrfCookie } from "./authApi";

function getCookie(name) {
  const cookieString = `; ${document.cookie}`;
  const parts = cookieString.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(";").shift();
  return "";
}

async function parseJson(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const reason =
      data.message || data.detail || `Request failed (${response.status}).`;
    const error = new Error(reason);
    error.payload = data;
    throw error;
  }
  return data;
}

async function csrfHeaders() {
  await ensureCsrfCookie();
  const token = getCookie("csrftoken");
  return { "Content-Type": "application/json", "X-CSRFToken": token };
}

// ── Vendors ───────────────────────────────────────────────
export async function listVendors() {
  const res = await fetch("/api/vendors/", { credentials: "include" });
  return parseJson(res);
}

export async function createVendor(payload) {
  const headers = await csrfHeaders();
  const res = await fetch("/api/vendors/create/", {
    method: "POST",
    credentials: "include",
    headers,
    body: JSON.stringify(payload),
  });
  return parseJson(res);
}

export async function updateVendor(id, payload) {
  const headers = await csrfHeaders();
  const res = await fetch(`/api/vendors/${id}/`, {
    method: "PATCH",
    credentials: "include",
    headers,
    body: JSON.stringify(payload),
  });
  return parseJson(res);
}

export async function deleteVendor(id) {
  const headers = await csrfHeaders();
  delete headers["Content-Type"];
  const res = await fetch(`/api/vendors/${id}/`, {
    method: "DELETE",
    credentials: "include",
    headers,
  });
  return parseJson(res);
}

// ── Projects ──────────────────────────────────────────────
export async function listProjects() {
  const res = await fetch("/api/projects/", { credentials: "include" });
  return parseJson(res);
}

export async function createProject(payload) {
  const headers = await csrfHeaders();
  const res = await fetch("/api/projects/create/", {
    method: "POST",
    credentials: "include",
    headers,
    body: JSON.stringify(payload),
  });
  return parseJson(res);
}

export async function updateProject(id, payload) {
  const headers = await csrfHeaders();
  const res = await fetch(`/api/projects/${id}/`, {
    method: "PATCH",
    credentials: "include",
    headers,
    body: JSON.stringify(payload),
  });
  return parseJson(res);
}

export async function deleteProject(id) {
  const headers = await csrfHeaders();
  delete headers["Content-Type"];
  const res = await fetch(`/api/projects/${id}/`, {
    method: "DELETE",
    credentials: "include",
    headers,
  });
  return parseJson(res);
}

export async function listProjectsMeta() {
  const res = await fetch("/api/projects/meta/", { credentials: "include" });
  return parseJson(res);
}

export async function addProjectLifecycleStatusOption(name) {
  const headers = await csrfHeaders();
  const res = await fetch("/api/projects/status-options/add/", {
    method: "POST",
    credentials: "include",
    headers,
    body: JSON.stringify({ name }),
  });
  return parseJson(res);
}

// -- LCE Costing -------------------------------------------
export async function listLceCostDetailsByProject(projectId) {
  const res = await fetch(`/api/lce-costing/by-project/${projectId}/`, { credentials: "include" });
  return parseJson(res);
}

export async function bulkSaveLceCostDetails(payload) {
  const headers = await csrfHeaders();
  const res = await fetch("/api/lce-costing/bulk-save/", {
    method: "POST",
    credentials: "include",
    headers,
    body: JSON.stringify(payload),
  });
  return parseJson(res);
}

export async function calculateLceCostIndex(payload) {
  const headers = await csrfHeaders();
  const res = await fetch("/api/lce-costing/cost-index/calculate/", {
    method: "POST",
    credentials: "include",
    headers,
    body: JSON.stringify(payload),
  });
  return parseJson(res);
}

export async function listLceCostingMeta() {
  const res = await fetch("/api/lce-costing/meta/", { credentials: "include" });
  return parseJson(res);
}

export async function listLceCostDetails() {
  const res = await fetch("/api/lce-costing/", { credentials: "include" });
  return parseJson(res);
}

export async function createLceCostDetail(payload) {
  const headers = await csrfHeaders();
  const res = await fetch("/api/lce-costing/create/", {
    method: "POST",
    credentials: "include",
    headers,
    body: JSON.stringify(payload),
  });
  return parseJson(res);
}

export async function updateLceCostDetail(id, payload) {
  const headers = await csrfHeaders();
  const res = await fetch(`/api/lce-costing/${id}/`, {
    method: "PATCH",
    credentials: "include",
    headers,
    body: JSON.stringify(payload),
  });
  return parseJson(res);
}

export async function deleteLceCostDetail(id) {
  const headers = await csrfHeaders();
  delete headers["Content-Type"];
  const res = await fetch(`/api/lce-costing/${id}/`, {
    method: "DELETE",
    credentials: "include",
    headers,
  });
  return parseJson(res);
}

export async function importLceCostingExcel(file) {
  await ensureCsrfCookie();
  const token = getCookie("csrftoken");
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch("/api/lce-costing/import/", {
    method: "POST",
    credentials: "include",
    headers: { "X-CSRFToken": token },
    body: formData,
  });
  return parseJson(res);
}

export async function downloadLceCostingImportTemplate() {
  const res = await fetch("/api/lce-costing/template/", { credentials: "include" });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || `Request failed (${res.status}).`);
  }
  const blob = await res.blob();
  const downloadUrl = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = downloadUrl;
  link.download = "lce_costing_import_template.xlsx";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(downloadUrl);
}

export async function downloadLceCostingExport() {
  const res = await fetch("/api/lce-costing/export/", { credentials: "include" });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || `Request failed (${res.status}).`);
  }
  const blob = await res.blob();
  const downloadUrl = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = downloadUrl;
  link.download = "lce_costing_export.xlsx";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(downloadUrl);
}

// -- LCE Estimate (purchase-linked) ------------------------
export async function listLceEstimates() {
  const res = await fetch("/api/lce-estimates/", { credentials: "include" });
  return parseJson(res);
}

export async function createLceEstimate(payload) {
  const headers = await csrfHeaders();
  const res = await fetch("/api/lce-estimates/create/", {
    method: "POST",
    credentials: "include",
    headers,
    body: JSON.stringify(payload),
  });
  return parseJson(res);
}

export async function getLceEstimateById(lceId) {
  const res = await fetch(`/api/lce-estimates/record/${lceId}/`, { credentials: "include" });
  return parseJson(res);
}

export async function updateLceEstimateById(lceId, payload) {
  const headers = await csrfHeaders();
  const res = await fetch(`/api/lce-estimates/record/${lceId}/`, {
    method: "PATCH",
    credentials: "include",
    headers,
    body: JSON.stringify(payload),
  });
  return parseJson(res);
}

export async function deleteLceEstimateById(lceId) {
  const headers = await csrfHeaders();
  delete headers["Content-Type"];
  const res = await fetch(`/api/lce-estimates/record/${lceId}/`, {
    method: "DELETE",
    credentials: "include",
    headers,
  });
  return parseJson(res);
}


// ── Lab Furniture Items ───────────────────────────────────
export async function listLabFurnitureItems() {
  const res = await fetch("/api/lab-furniture-items/", { credentials: "include" });
  return parseJson(res);
}

export async function createLabFurnitureItem(payload) {
  const headers = await csrfHeaders();
  const res = await fetch("/api/lab-furniture-items/create/", {
    method: "POST",
    credentials: "include",
    headers,
    body: JSON.stringify(payload),
  });
  return parseJson(res);
}

export async function updateLabFurnitureItem(id, payload) {
  const headers = await csrfHeaders();
  const res = await fetch(`/api/lab-furniture-items/${id}/`, {
    method: "PATCH",
    credentials: "include",
    headers,
    body: JSON.stringify(payload),
  });
  return parseJson(res);
}

export async function deleteLabFurnitureItem(id) {
  const headers = await csrfHeaders();
  delete headers["Content-Type"];
  const res = await fetch(`/api/lab-furniture-items/${id}/`, {
    method: "DELETE",
    credentials: "include",
    headers,
  });
  return parseJson(res);
}

export async function listLabFurnitureItemCategories() {
  const res = await fetch("/api/lab-furniture-item-categories/", { credentials: "include" });
  return parseJson(res);
}

export async function createLabFurnitureItemCategory(payload) {
  const headers = await csrfHeaders();
  const res = await fetch("/api/lab-furniture-item-categories/create/", {
    method: "POST",
    credentials: "include",
    headers,
    body: JSON.stringify(payload),
  });
  return parseJson(res);
}

// ── Stock Purchase ────────────────────────────────────────
export async function listStockPurchases() {
  const res = await fetch("/api/stock-purchases/", { credentials: "include" });
  return parseJson(res);
}

export async function getStockPurchaseById(id) {
  const res = await fetch(`/api/stock-purchases/${id}/`, { credentials: "include" });
  return parseJson(res);
}

export async function createStockPurchase(payload) {
  const headers = await csrfHeaders();
  const res = await fetch("/api/stock-purchases/create/", {
    method: "POST",
    credentials: "include",
    headers,
    body: JSON.stringify(payload),
  });
  return parseJson(res);
}

export async function updateStockPurchase(id, payload) {
  const headers = await csrfHeaders();
  const res = await fetch(`/api/stock-purchases/${id}/`, {
    method: "PATCH",
    credentials: "include",
    headers,
    body: JSON.stringify(payload),
  });
  return parseJson(res);
}

export async function deleteStockPurchase(id) {
  const headers = await csrfHeaders();
  delete headers["Content-Type"];
  const res = await fetch(`/api/stock-purchases/${id}/`, {
    method: "DELETE",
    credentials: "include",
    headers,
  });
  return parseJson(res);
}

export async function createStockPurchaseVendorDetail(payload) {
  const headers = await csrfHeaders();
  const res = await fetch("/api/stock-purchase-vendors/create/", {
    method: "POST",
    credentials: "include",
    headers,
    body: JSON.stringify(payload),
  });
  return parseJson(res);
}

export async function updateStockPurchaseVendorDetail(id, payload) {
  const headers = await csrfHeaders();
  const res = await fetch(`/api/stock-purchase-vendors/${id}/`, {
    method: "PATCH",
    credentials: "include",
    headers,
    body: JSON.stringify(payload),
  });
  return parseJson(res);
}

// ── Stock Maintenance ─────────────────────────────────────
export async function listStockMaintenance() {
  const res = await fetch("/api/stock-maintenance/", { credentials: "include" });
  return parseJson(res);
}

export async function createStockMaintenance(payload) {
  const headers = await csrfHeaders();
  const res = await fetch("/api/stock-maintenance/create/", {
    method: "POST",
    credentials: "include",
    headers,
    body: JSON.stringify(payload),
  });
  return parseJson(res);
}

export async function updateStockMaintenance(id, payload) {
  const headers = await csrfHeaders();
  const res = await fetch(`/api/stock-maintenance/${id}/`, {
    method: "PATCH",
    credentials: "include",
    headers,
    body: JSON.stringify(payload),
  });
  return parseJson(res);
}

export async function deleteStockMaintenance(id) {
  const headers = await csrfHeaders();
  delete headers["Content-Type"];
  const res = await fetch(`/api/stock-maintenance/${id}/`, {
    method: "DELETE",
    credentials: "include",
    headers,
  });
  return parseJson(res);
}

export async function listStockMaintenanceMeta() {
  const res = await fetch("/api/stock-maintenance/meta/", { credentials: "include" });
  return parseJson(res);
}

export async function addStockMaintenanceTypeOption(name) {
  const headers = await csrfHeaders();
  const res = await fetch("/api/stock-maintenance/type-options/add/", {
    method: "POST",
    credentials: "include",
    headers,
    body: JSON.stringify({ name }),
  });
  return parseJson(res);
}

// ── Tasks ─────────────────────────────────────────────────
export async function listTasks() {
  const res = await fetch("/api/tasks/", { credentials: "include" });
  return parseJson(res);
}

export async function createTask(payload) {
  const headers = await csrfHeaders();
  const res = await fetch("/api/tasks/create/", {
    method: "POST",
    credentials: "include",
    headers,
    body: JSON.stringify(payload),
  });
  return parseJson(res);
}

export async function updateTask(id, payload) {
  const headers = await csrfHeaders();
  const res = await fetch(`/api/tasks/${id}/`, {
    method: "PATCH",
    credentials: "include",
    headers,
    body: JSON.stringify(payload),
  });
  return parseJson(res);
}

export async function deleteTask(id) {
  const headers = await csrfHeaders();
  delete headers["Content-Type"];
  const res = await fetch(`/api/tasks/${id}/`, {
    method: "DELETE",
    credentials: "include",
    headers,
  });
  return parseJson(res);
}

export async function listTaskMeta() {
  const res = await fetch("/api/tasks/meta/", { credentials: "include" });
  return parseJson(res);
}

export async function listHeaderNotifications() {
  const res = await fetch("/api/notifications/header/", { credentials: "include" });
  return parseJson(res);
}

export async function listUnreadTaskNotifications() {
  const res = await fetch("/api/notifications/tasks/unread/", { credentials: "include" });
  return parseJson(res);
}

export async function listUnreadMessageNotifications() {
  const res = await fetch("/api/notifications/messages/unread/", { credentials: "include" });
  return parseJson(res);
}

export async function markTaskNotificationsRead(taskIds = []) {
  const headers = await csrfHeaders();
  const normalizedIds = Array.isArray(taskIds)
    ? taskIds
    : [taskIds];

  const res = await fetch("/api/notifications/tasks/mark-read/", {
    method: "POST",
    credentials: "include",
    headers,
    body: JSON.stringify({ task_ids: normalizedIds }),
  });
  return parseJson(res);
}

export async function markMessageNotificationsReadByTask(taskId) {
  const headers = await csrfHeaders();
  const res = await fetch("/api/notifications/messages/mark-read/", {
    method: "POST",
    credentials: "include",
    headers,
    body: JSON.stringify({ task_id: taskId }),
  });
  return parseJson(res);
}

export async function addTaskStatusOption(name) {
  const headers = await csrfHeaders();
  const res = await fetch("/api/tasks/status-options/add/", {
    method: "POST",
    credentials: "include",
    headers,
    body: JSON.stringify({ name }),
  });
  return parseJson(res);
}

export async function addProjectStatusOption(name) {
  const headers = await csrfHeaders();
  const res = await fetch("/api/tasks/project-status-options/add/", {
    method: "POST",
    credentials: "include",
    headers,
    body: JSON.stringify({ name }),
  });
  return parseJson(res);
}

export async function addActivityOption(name) {
  const headers = await csrfHeaders();
  const res = await fetch("/api/tasks/activity-options/add/", {
    method: "POST",
    credentials: "include",
    headers,
    body: JSON.stringify({ name }),
  });
  return parseJson(res);
}

export async function importTasksExcel(file) {
  await ensureCsrfCookie();
  const token = getCookie("csrftoken");
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch("/api/tasks/import/", {
    method: "POST",
    credentials: "include",
    headers: { "X-CSRFToken": token },
    body: formData,
  });
  return parseJson(res);
}

export async function downloadTaskImportTemplate() {
  const res = await fetch("/api/tasks/template/", { credentials: "include" });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || `Request failed (${res.status}).`);
  }
  const blob = await res.blob();
  const downloadUrl = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = downloadUrl;
  link.download = "task_import_template.xlsx";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(downloadUrl);
}

// ── Timesheets ───────────────────────────────────────────
export async function listTimesheets() {
  const res = await fetch("/api/timesheets/", { credentials: "include" });
  return parseJson(res);
}

export async function createTimesheet(payload) {
  const headers = await csrfHeaders();
  const res = await fetch("/api/timesheets/create/", {
    method: "POST",
    credentials: "include",
    headers,
    body: JSON.stringify(payload),
  });
  return parseJson(res);
}

export async function updateTimesheet(id, payload) {
  const headers = await csrfHeaders();
  const res = await fetch(`/api/timesheets/${id}/`, {
    method: "PATCH",
    credentials: "include",
    headers,
    body: JSON.stringify(payload),
  });
  return parseJson(res);
}

export async function deleteTimesheet(id) {
  const headers = await csrfHeaders();
  delete headers["Content-Type"];
  const res = await fetch(`/api/timesheets/${id}/`, {
    method: "DELETE",
    credentials: "include",
    headers,
  });
  return parseJson(res);
}

export async function listTimesheetMeta() {
  const res = await fetch("/api/timesheets/meta/", { credentials: "include" });
  return parseJson(res);
}


export async function importTimesheetsExcel(file) {
  await ensureCsrfCookie();
  const token = getCookie("csrftoken");
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch("/api/timesheets/import/", {
    method: "POST",
    credentials: "include",
    headers: { "X-CSRFToken": token },
    body: formData,
  });
  return parseJson(res);
}

export async function downloadTimesheetImportTemplate() {
  const res = await fetch("/api/timesheets/template/", { credentials: "include" });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || `Request failed (${res.status}).`);
  }
  const blob = await res.blob();
  const downloadUrl = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = downloadUrl;
  link.download = "timesheet_import_template.xlsx";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(downloadUrl);
}

// ── CDC Team Expence ────────────────────────────────────
export async function listCdcTeamExpences() {
  const res = await fetch("/api/cdc-team-expence/", { credentials: "include" });
  return parseJson(res);
}

export async function createCdcTeamExpence(payload) {
  const headers = await csrfHeaders();
  const res = await fetch("/api/cdc-team-expence/create/", {
    method: "POST",
    credentials: "include",
    headers,
    body: JSON.stringify(payload),
  });
  return parseJson(res);
}

export async function updateCdcTeamExpence(id, payload) {
  const headers = await csrfHeaders();
  const res = await fetch(`/api/cdc-team-expence/${id}/`, {
    method: "PATCH",
    credentials: "include",
    headers,
    body: JSON.stringify(payload),
  });
  return parseJson(res);
}

export async function deleteCdcTeamExpence(id) {
  const headers = await csrfHeaders();
  delete headers["Content-Type"];
  const res = await fetch(`/api/cdc-team-expence/${id}/`, {
    method: "DELETE",
    credentials: "include",
    headers,
  });
  return parseJson(res);
}

export async function listCdcTeamExpenceMeta() {
  const res = await fetch("/api/cdc-team-expence/meta/", { credentials: "include" });
  return parseJson(res);
}

export async function bulkUpdateCdcTeamExpences(ids, payload) {
  const headers = await csrfHeaders();
  const res = await fetch("/api/cdc-team-expence/bulk-update/", {
    method: "POST",
    credentials: "include",
    headers,
    body: JSON.stringify({ ids, ...payload }),
  });
  return parseJson(res);
}

export async function addExpenseItemOption(name) {
  const headers = await csrfHeaders();
  const res = await fetch("/api/cdc-team-expence/item-options/add/", {
    method: "POST",
    credentials: "include",
    headers,
    body: JSON.stringify({ name }),
  });
  return parseJson(res);
}

export async function addExpenseStatusOption(name) {
  const headers = await csrfHeaders();
  const res = await fetch("/api/cdc-team-expence/status-options/add/", {
    method: "POST",
    credentials: "include",
    headers,
    body: JSON.stringify({ name }),
  });
  return parseJson(res);
}

export async function addExpenseSessionOption(name) {
  const headers = await csrfHeaders();
  const res = await fetch("/api/cdc-team-expence/session-options/add/", {
    method: "POST",
    credentials: "include",
    headers,
    body: JSON.stringify({ name }),
  });
  return parseJson(res);
}

// ── Reusable Comments ───────────────────────────────────
export async function listComments(moduleName, recordId) {
  const query = new URLSearchParams({
    module_name: String(moduleName || ""),
    record_id: String(recordId || ""),
  }).toString();
  const res = await fetch(`/api/comments/?${query}`, { credentials: "include" });
  return parseJson(res);
}

export async function createComment(payload) {
  await ensureCsrfCookie();
  const token = getCookie("csrftoken");
  const isFormData = typeof FormData !== "undefined" && payload instanceof FormData;
  const headers = isFormData
    ? { "X-CSRFToken": token }
    : { "Content-Type": "application/json", "X-CSRFToken": token };
  const res = await fetch("/api/comments/create/", {
    method: "POST",
    credentials: "include",
    headers,
    body: isFormData ? payload : JSON.stringify(payload),
  });
  return parseJson(res);
}

export async function updateComment(id, payload) {
  await ensureCsrfCookie();
  const token = getCookie("csrftoken");
  const isFormData = typeof FormData !== "undefined" && payload instanceof FormData;
  const headers = isFormData
    ? { "X-CSRFToken": token }
    : { "Content-Type": "application/json", "X-CSRFToken": token };
  const res = await fetch(`/api/comments/${id}/`, {
    method: "PATCH",
    credentials: "include",
    headers,
    body: isFormData ? payload : JSON.stringify(payload),
  });
  return parseJson(res);
}

export async function deleteComment(id) {
  const headers = await csrfHeaders();
  delete headers["Content-Type"];
  const res = await fetch(`/api/comments/${id}/`, {
    method: "DELETE",
    credentials: "include",
    headers,
  });
  return parseJson(res);
}

export async function deleteCommentAttachment(id) {
  const headers = await csrfHeaders();
  delete headers["Content-Type"];
  const res = await fetch(`/api/comment-attachments/${id}/`, {
    method: "DELETE",
    credentials: "include",
    headers,
  });
  return parseJson(res);
}

