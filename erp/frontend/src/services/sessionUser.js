const SESSION_USER_KEY = "eliteTrackUser";

export function getSessionUser() {
  try {
    const raw = window.localStorage.getItem(SESSION_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setSessionUser(user) {
  if (!user) {
    clearSessionUser();
    return;
  }

  window.localStorage.setItem(SESSION_USER_KEY, JSON.stringify(user));
}

export function clearSessionUser() {
  window.localStorage.removeItem(SESSION_USER_KEY);
}

