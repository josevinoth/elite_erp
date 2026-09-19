import AlertMessage from "./AlertMessage";

function ConfirmPopupModal({
  open = false,
  type = "warning",
  message = "",
  title = "Confirmation",
  confirmLabel = "OK",
  cancelLabel = "Cancel",
  confirmDisabled = false,
  cancelDisabled = false,
  onConfirm,
  onCancel,
  children = null,
}) {
  if (!open) return null;

  return (
    <div className="pq-confirm-modal-backdrop" role="presentation" onClick={onCancel}>
      <div
        className="pq-confirm-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <h3 className="pq-confirm-modal__title">{title}</h3>
        <AlertMessage type={type} message={message} />
        {children}
        <div className="pq-confirm-modal__actions">
          <button
            type="button"
            className="modal-btn modal-btn--save"
            onClick={onConfirm}
            disabled={confirmDisabled}
          >
            {confirmLabel}
          </button>
          <button
            type="button"
            className="modal-btn modal-btn--cancel"
            onClick={onCancel}
            disabled={cancelDisabled}
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmPopupModal;

