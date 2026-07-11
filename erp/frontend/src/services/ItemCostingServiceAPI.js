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
    const reason = data.message || data.detail || `Request failed (${response.status}).`;
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

export async function listItemCosting(page = 1, pageSize = 20) {
  const res = await fetch(`/api/itemcosting/?page=${page}&page_size=${pageSize}`, {
    credentials: "include",
  });
  const data = await parseJson(res);
  return {
    items: Array.isArray(data.results) ? data.results : [],
    count: Number(data.count || 0),
  };
}

export async function listItemCostingMeta() {
  const res = await fetch("/api/itemcosting/meta/", { credentials: "include" });
  return parseJson(res);
}

export async function getItemCostingCostPreview(itemCode, qty = 0) {
  const query = new URLSearchParams({
    item_code: String(itemCode || ""),
    qty: String(qty || 0),
  }).toString();
  const res = await fetch(`/api/itemcosting/cost-preview/?${query}`, { credentials: "include" });
  return parseJson(res);
}

export async function getItemCosting(id) {
  const res = await fetch(`/api/itemcosting/${id}/`, { credentials: "include" });
  return parseJson(res);
}

export async function createItemCosting(payload) {
  const headers = await csrfHeaders();
  const res = await fetch("/api/itemcosting/create/", {
    method: "POST",
    credentials: "include",
    headers,
    body: JSON.stringify(payload),
  });
  return parseJson(res);
}

export async function updateItemCosting(id, payload) {
  const headers = await csrfHeaders();
  const res = await fetch(`/api/itemcosting/${id}/`, {
    method: "PATCH",
    credentials: "include",
    headers,
    body: JSON.stringify(payload),
  });
  return parseJson(res);
}

export async function deleteItemCosting(id) {
  const headers = await csrfHeaders();
  delete headers["Content-Type"];
  const res = await fetch(`/api/itemcosting/${id}/`, {
    method: "DELETE",
    credentials: "include",
    headers,
  });
  return parseJson(res);
}
