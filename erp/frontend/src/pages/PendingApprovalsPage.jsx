import { useCallback, useEffect, useState } from "react";
import {
  BsCheckCircleFill,
  BsClockHistory,
  BsPersonCheck,
  BsXCircleFill,
} from "react-icons/bs";
import { approveRegistration, listPendingRegistrations } from "../services/authApi";

function PendingApprovalsPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionMsg, setActionMsg] = useState("");
  const [processing, setProcessing] = useState(null); // user id being processed

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    listPendingRegistrations()
      .then((data) => {
        setRows(Array.isArray(data.pending_users) ? data.pending_users : []);
      })
      .catch((e) => setError(e.message || "Failed to load pending registrations."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleAction = async (userId, action) => {
    const label = action === "approve" ? "Approve" : "Reject";
    if (!window.confirm(`${label} this registration request?`)) return;

    setProcessing(userId);
    setError("");
    setActionMsg("");
    try {
      const data = await approveRegistration(userId, action);
      setActionMsg(data.message || `User ${action}d successfully.`);
      setRows((prev) => prev.filter((r) => r.id !== userId));
    } catch (e) {
      setError(e.message || `Failed to ${action} user.`);
    } finally {
      setProcessing(null);
    }
  };

  return (
    <section className="module-page crud-page">
      <div className="crud-page__header">
        <h1 className="module-page__title">
          <BsPersonCheck aria-hidden="true" style={{ marginRight: "0.5rem", color: "var(--primary)" }} />
          Pending Approvals
          {rows.length > 0 && (
            <span className="pending-badge pending-badge--header">{rows.length}</span>
          )}
        </h1>
      </div>

      {actionMsg ? <p className="pending-action-success">{actionMsg}</p> : null}
      {error ? <p className="users-status users-status--error">{error}</p> : null}
      {loading ? <p className="users-status">Loading...</p> : null}

      {!loading && rows.length === 0 && !error ? (
        <div className="pending-empty">
          <BsCheckCircleFill className="pending-empty__icon" aria-hidden="true" />
          <p>No pending registrations. All caught up!</p>
        </div>
      ) : null}

      {!loading && rows.length > 0 ? (
        <div className="users-table-wrap users-table-wrap--sticky">
          <table className="users-table">
            <thead>
              <tr>
                <th className="users-table__sticky-head">Username</th>
                <th className="users-table__sticky-head">Email</th>
                <th className="users-table__sticky-head">Registered On</th>
                <th className="users-table__sticky-head">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <BsClockHistory
                      aria-hidden="true"
                      style={{ marginRight: "0.4rem", color: "#f97316", verticalAlign: "middle" }}
                    />
                    {row.username}
                  </td>
                  <td>{row.email}</td>
                  <td>{row.date_joined}</td>
                  <td>
                    <div className="users-actions">
                      <button
                        type="button"
                        className="pending-action-btn pending-action-btn--approve"
                        aria-label="Approve"
                        disabled={processing === row.id}
                        onClick={() => handleAction(row.id, "approve")}
                        title="Approve registration"
                      >
                        <BsCheckCircleFill aria-hidden="true" />
                        <span>Approve</span>
                      </button>
                      <button
                        type="button"
                        className="pending-action-btn pending-action-btn--reject"
                        aria-label="Reject"
                        disabled={processing === row.id}
                        onClick={() => handleAction(row.id, "reject")}
                        title="Reject registration"
                      >
                        <BsXCircleFill aria-hidden="true" />
                        <span>Reject</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

export default PendingApprovalsPage;

