import AlertMessage from "./AlertMessage";
import "../styles/ProjectCostingSummary.css";

function ActionConfirmationPage({
  title,
  message,
  alertType = "success",
  summary = {},
  onReturn,
}) {
  return (
    <section className="workflow-confirmation" aria-live="polite">
      <h2 className="workflow-confirmation__title">{title}</h2>
      <AlertMessage type={alertType} message={message} />
      <div className="workflow-confirmation__card">
        <p className="workflow-confirmation__row"><strong>Item Name:</strong> {summary.item_name || "-"}</p>
        <p className="workflow-confirmation__row"><strong>Item Code:</strong> {summary.item_code || "-"}</p>
        <p className="workflow-confirmation__row"><strong>Project Name:</strong> {summary.project_name || "-"}</p>
        <p className="workflow-confirmation__row"><strong>Quotation Number:</strong> {summary.quotation_number || "-"}</p>
      </div>
      <div className="workflow-confirmation__actions">
        <button type="button" className="modal-btn modal-btn--save" onClick={onReturn}>
          Return to List
        </button>
      </div>
    </section>
  );
}

export default ActionConfirmationPage;

