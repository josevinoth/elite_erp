import "../styles/ProjectCostingSummary.css";

const ICONS_BY_TYPE = {
  default: "ℹ️",
  success: "✔️",
  info: "📘",
  danger: "❌",
  warning: "⚠️",
};

const normalizeType = (type) => {
  const raw = String(type || "").trim().toLowerCase();
  if (raw === "error") return "danger";
  if (raw === "") return "default";
  if (["default", "success", "info", "danger", "warning"].includes(raw)) {
    return raw;
  }
  return "default";
};

function AlertMessage({ type = "default", message = "" }) {
  if (!String(message || "").trim()) return null;

  const alertType = normalizeType(type);
  const icon = ICONS_BY_TYPE[alertType] || ICONS_BY_TYPE.default;
  const normalizedMessage = String(message || "").trim();
  const messageText =
    alertType === "warning"
      ? normalizedMessage.replace(/^([\u26A0]\uFE0F?|⚠️)\s*/u, "")
      : normalizedMessage;

  return (
    <div className={`erp-alert alert alert-${alertType} erp-alert-${alertType}`} role="status" aria-live="polite">
      <span className="alert-icon" aria-hidden="true">{icon}</span>
      <span className="erp-alert__text">{messageText}</span>
    </div>
  );
}

export default AlertMessage;

