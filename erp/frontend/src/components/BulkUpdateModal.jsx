import { useMemo, useState } from "react";
import { BsXCircle } from "react-icons/bs";
import Select from "react-select";

/**
 * Modal for bulk updating selected CDC expense records.
 *
 * Props:
 *   isOpen           - boolean, whether modal is visible
 *   selectedCount    - number, count of selected records
 *   statusOptions    - array of status options
 *   cdcUsers         - array of CDC team user options
 *   onClose          - callback when closing modal
 *   onSubmit         - async callback (payload) => when submitting
 *   isSubmitting     - boolean, whether submission is in progress
 */
function BulkUpdateModal({
  isOpen,
  selectedCount,
  statusOptions,
  cdcUsers,
  onClose,
  onSubmit,
  isSubmitting,
}) {
  const [status, setStatus] = useState("");
  const [settledBy, setSettledBy] = useState("");
  const [settledOn, setSettledOn] = useState("");
  const [error, setError] = useState("");

  const selectStyles = useMemo(
    () => ({
      control: (base, state) => ({
        ...base,
        minHeight: 40,
        backgroundColor: "#0a3338",
        borderColor: state.isFocused ? "#16b2a5" : "#1e666d",
        boxShadow: state.isFocused ? "0 0 0 3px rgba(22,178,165,0.2)" : "none",
        ":hover": { borderColor: "#25d2c3" },
      }),
      singleValue: (base) => ({ ...base, color: "#f0fffe" }),
      input: (base) => ({ ...base, color: "#f0fffe" }),
      placeholder: (base) => ({ ...base, color: "#cce8e5" }),
      menu: (base) => ({ ...base, backgroundColor: "#0b3a40", zIndex: 2000 }),
      menuPortal: (base) => ({ ...base, zIndex: 3000 }),
      option: (base, state) => ({
        ...base,
        backgroundColor: state.isFocused ? "#11474f" : "#0b3a40",
        color: "#f0fffe",
      }),
    }),
    []
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // Validation: settled_on is required when settled_by is selected
    if (settledBy && !settledOn) {
      setError("Settled On is required when Settled By is selected");
      return;
    }

    const payload = {};
    if (status) payload.status = status;
    if (settledBy) payload.settled_by = settledBy;
    if (settledOn) payload.settled_on = settledOn;

    // If nothing selected, don't submit
    if (Object.keys(payload).length === 0) {
      setError("Please select at least one field to update");
      return;
    }

    try {
      await onSubmit(payload);
      // Reset form on success
      setStatus("");
      setSettledBy("");
      setSettledOn("");
      onClose();
    } catch (err) {
      setError(err.message || "Update failed");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-card__head">
          <h2 className="modal-card__title">
            Bulk Update ({selectedCount} selected)
          </h2>
          <button
            type="button"
            className="modal-card__close"
            aria-label="Close"
            onClick={onClose}
            disabled={isSubmitting}
          >
            <BsXCircle aria-hidden="true" />
          </button>
        </div>

        <form className="modal-form" onSubmit={handleSubmit}>
          {error && <p className="users-status users-status--error">{error}</p>}

          <div className="modal-form__row">
            <label className="modal-form__label" htmlFor="bulk-status">
              Status
            </label>
            <Select
              inputId="bulk-status"
              className="crud-select"
              classNamePrefix="crud-select"
              isSearchable
              isClearable
              options={statusOptions}
              placeholder="Select Status (optional)"
              value={
                statusOptions.find((opt) => String(opt.value) === String(status)) ||
                null
              }
              onChange={(option) =>
                setStatus(option ? option.value : "")
              }
              menuPortalTarget={typeof document !== "undefined" ? document.body : null}
              menuPosition="fixed"
              styles={selectStyles}
            />
          </div>

          <div className="modal-form__row">
            <label className="modal-form__label" htmlFor="bulk-settled-by">
              Settled By
            </label>
            <Select
              inputId="bulk-settled-by"
              className="crud-select"
              classNamePrefix="crud-select"
              isSearchable
              isClearable
              options={cdcUsers}
              placeholder="Select User (optional)"
              value={
                cdcUsers.find((opt) => String(opt.value) === String(settledBy)) ||
                null
              }
              onChange={(option) =>
                setSettledBy(option ? option.value : "")
              }
              menuPortalTarget={typeof document !== "undefined" ? document.body : null}
              menuPosition="fixed"
              styles={selectStyles}
            />
          </div>

          <div className="modal-form__row">
            <label className="modal-form__label" htmlFor="bulk-settled-on">
              Settled On
            </label>
            <input
              id="bulk-settled-on"
              type="date"
              className={`auth-input${settledBy && !settledOn ? " auth-input--error" : ""}`}
              value={settledOn}
              onChange={(e) => setSettledOn(e.target.value)}
            />
            {settledBy && !settledOn && (
              <small style={{ color: "#ff6b6b", display: "block", marginTop: "0.25rem" }}>
                Required when Settled By is selected
              </small>
            )}
          </div>

          <div className="modal-form__actions">
            <button
              type="button"
              className="modal-btn modal-btn--cancel"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="modal-btn modal-btn--save"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Updating..." : "Update Selected"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default BulkUpdateModal;

