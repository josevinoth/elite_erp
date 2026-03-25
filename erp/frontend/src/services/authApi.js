function getCookie(name) {
  const cookieString = `; ${document.cookie}`;
  const parts = cookieString.split(`; ${name}=`);

  if (parts.length === 2) {
    return parts.pop().split(";").shift();
  }

  return "";
}

async function parseJson(response) {
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const reason =
      data.message ||
      data.detail ||
      (response.status ? `Request failed (${response.status}).` : "Request failed.");
    const error = new Error(reason);
    error.payload = data;
    throw error;
  }

  return data;
}

export async function ensureCsrfCookie() {
  const response = await fetch("/api/auth/csrf/", {
    method: "GET",
    credentials: "include",
  });

  return parseJson(response);
}

export async function registerUser(payload) {
  await ensureCsrfCookie();
  const csrftoken = getCookie("csrftoken");

  const response = await fetch("/api/auth/register/", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "X-CSRFToken": csrftoken,
    },
    body: new URLSearchParams(payload).toString(),
  });

  return parseJson(response);
}

export async function fetchRegisterMeta() {
  const response = await fetch("/api/auth/register/meta/", {
    method: "GET",
    credentials: "include",
  });

  return parseJson(response);
}

export async function listPendingRegistrations() {
  const response = await fetch("/api/users/pending/", {
    method: "GET",
    credentials: "include",
  });

  return parseJson(response);
}

export async function approveRegistration(userId, action = "approve") {
  await ensureCsrfCookie();
  const csrftoken = getCookie("csrftoken");

  const response = await fetch(`/api/users/${userId}/approve/`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken": csrftoken,
    },
    body: JSON.stringify({ action }),
  });

  return parseJson(response);
}

export async function loginUser(payload) {
  await ensureCsrfCookie();
  const csrftoken = getCookie("csrftoken");

  const response = await fetch("/api/auth/login/", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "X-CSRFToken": csrftoken,
    },
    body: new URLSearchParams(payload).toString(),
  });

  return parseJson(response);
}

export async function logoutUser() {
  await ensureCsrfCookie();
  const csrftoken = getCookie("csrftoken");

  const response = await fetch("/api/auth/logout/", {
    method: "POST",
    credentials: "include",
    headers: {
      "X-CSRFToken": csrftoken,
    },
  });

  return parseJson(response);
}

export async function listUsers() {
  const response = await fetch("/api/users/", {
    method: "GET",
    credentials: "include",
  });

  return parseJson(response);
}

export async function updateUserRole(userId, role, status = "", team = "") {
  await ensureCsrfCookie();
  const csrftoken = getCookie("csrftoken");

  const response = await fetch(`/api/users/${userId}/`, {
    method: "PATCH",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken": csrftoken,
    },
    body: JSON.stringify({ role, status, team }),
  });

  return parseJson(response);
}

export async function deleteUser(userId) {
  await ensureCsrfCookie();
  const csrftoken = getCookie("csrftoken");

  const response = await fetch(`/api/users/${userId}/`, {
    method: "DELETE",
    credentials: "include",
    headers: {
      "X-CSRFToken": csrftoken,
    },
  });

  return parseJson(response);
}


