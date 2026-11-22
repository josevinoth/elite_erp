export function formatUtcDateTime(dateString) {
  if (!dateString) return "";
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return String(dateString);
    return d.toLocaleString();
  } catch {
    return String(dateString);
  }
}
