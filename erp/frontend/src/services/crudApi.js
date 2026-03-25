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

// ── Stock Purchase ────────────────────────────────────────
export async function listStockPurchases() {
  const res = await fetch("/api/stock-purchases/", { credentials: "include" });
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

