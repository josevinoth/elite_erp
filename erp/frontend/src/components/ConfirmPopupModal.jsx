import {
  BsCheckCircleFill,
  BsExclamationTriangleFill,
  BsInfoCircleFill,
  BsXCircleFill,
} from "react-icons/bs";
import AlertMessage from "./AlertMessage";
import { CardHeader, CardBody } from "./Card";

function ConfirmPopupModal({
  open = false,
  type = "warning",
  message = "",
  title = "Confirmation",
  className = "",
  confirmLabel = "OK",
  cancelLabel = "Cancel",
  confirmDisabled = false,
  cancelDisabled = false,
  onConfirm,
  onCancel,
  children = null,
}) {
  if (!open) return null;

  const renderIcon = () => {
    if (type === "error" || type === "danger") {
      return <BsXCircleFill style={{ color: "#f87171", fontSize: "1.1rem" }} />;
    }
    if (type === "success") {
      return <BsCheckCircleFill style={{ color: "#4ade80", fontSize: "1.1rem" }} />;
    }
    if (type === "info") {
      return <BsInfoCircleFill style={{ color: "#60a5fa", fontSize: "1.1rem" }} />;
    }
    return <BsExclamationTriangleFill style={{ color: "#fbbf24", fontSize: "1.1rem" }} />;
  };

  return (
    <div
      className="pq-confirm-modal-backdrop"
      role="presentation"
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(15, 23, 42, 0.65)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 2000,
        padding: "1rem",
      }}
      onClick={onCancel}
    >
      <div
        className={`pq-confirm-modal ${className}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{
          width: "min(520px, 94vw)",
          borderRadius: "10px",
          overflow: "hidden",
          boxShadow: "0 20px 45px rgba(0, 0, 0, 0.35)",
          background: "#ffffff",
          border: "1px solid #cbd5e1",
          display: "flex",
          flexDirection: "column",
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <CardHeader
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0.85rem 1.25rem",
            background: "linear-gradient(135deg, #2a3042 0%, #36405a 100%)",
            color: "#ffffff",
          }}
        >
          <h3
            style={{
              margin: 0,
              fontSize: "1rem",
              fontWeight: 600,
              color: "#ffffff",
              display: "flex",
              alignItems: "center",
              gap: "0.6rem",
            }}
          >
            {renderIcon()}
            {title}
          </h3>
          <button
            type="button"
            onClick={onCancel}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#ffffff",
              fontSize: "1.2rem",
              display: "flex",
              alignItems: "center",
              padding: 0,
            }}
            aria-label="Close"
          >
            <BsXCircleFill />
          </button>
        </CardHeader>
        <CardBody style={{ padding: "1.25rem 1.5rem", background: "#ffffff" }}>
          {message ? (
            <AlertMessage
              type={type === "error" ? "danger" : (type === "success" ? "success" : (type === "info" ? "info" : "warning"))}
              message={message}
            />
          ) : null}
          {children}
          <div
            className="pq-confirm-modal__actions"
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "0.65rem",
              marginTop: "1.25rem",
            }}
          >
            {cancelLabel ? (
              <button
                type="button"
                className="modal-btn modal-btn--cancel"
                onClick={onCancel}
                disabled={cancelDisabled}
              >
                {cancelLabel}
              </button>
            ) : null}
            <button
              type="button"
              className="modal-btn modal-btn--save"
              onClick={onConfirm}
              disabled={confirmDisabled}
            >
              {confirmLabel}
            </button>
          </div>
        </CardBody>
      </div>
    </div>
  );
}

export default ConfirmPopupModal;
