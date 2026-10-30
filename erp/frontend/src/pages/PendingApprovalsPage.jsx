import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BsArrowRepeat,
  BsCheckCircleFill,
  BsClockHistory,
  BsDownload,
  BsEnvelopeFill,
  BsPeopleFill,
  BsPersonCheckFill,
  BsSearch,
  BsXCircle,
  BsXCircleFill,
} from "react-icons/bs";
import AlertMessage from "../components/AlertMessage";
import { Card, CardBody, CardHeader } from "../components/Card";
import ConfirmPopupModal from "../components/ConfirmPopupModal";
import { approveRegistration, listPendingRegistrations } from "../services/authApi";
import { exportRowsToExcel } from "../utils/exportToExcel";

const EXPORT_COLUMNS = [
  { key: "username", label: "Username" },
  { key: "email", label: "Email" },
  { key: "date_joined", label: "Registered On" },
];

const formatDate = (val) => {
  if (!val) return "-";
  try {
    const d = new Date(val);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    }
  } catch (_e) {
    // fallback to original string
  }
  return String(val);
};

function PendingApprovalsPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionMsg, setActionMsg] = useState("");
  const [processing, setProcessing] = useState(null);
  const [exporting, setExporting] = useState(false);

  // Column and global filters
  const [filters, setFilters] = useState({
    username: "",
    email: "",
    date_joined: "",
    search: "",
  });

  // Confirm modal state
  const [confirmModal, setConfirmModal] = useState({
    open: false,
    user: null,
    action: "", // 'approve' | 'reject'
  });

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

  const handleOpenConfirm = (user, action) => {
    setConfirmModal({
      open: true,
      user,
      action,
    });
  };

  const handleCloseConfirm = () => {
    setConfirmModal({
      open: false,
      user: null,
      action: "",
    });
  };

  const handleConfirmAction = async () => {
    const { user, action } = confirmModal;
    if (!user || !action) return;

    setProcessing(user.id);
    setError("");
    setActionMsg("");
    handleCloseConfirm();

    try {
      const data = await approveRegistration(user.id, action);
      setActionMsg(data.message || `User '${user.username}' was ${action}d successfully.`);
      setRows((prev) => prev.filter((r) => r.id !== user.id));
    } catch (e) {
      setError(e.message || `Failed to ${action} user '${user.username}'.`);
    } finally {
      setProcessing(null);
    }
  };

  const handleExport = async () => {
    setError("");
    setExporting(true);
    try {
      await exportRowsToExcel({
        fileName: "User_Confirmation_Pending_Approvals",
        sheetName: "Pending Approvals",
        columns: EXPORT_COLUMNS,
        rows: filteredRows,
      });
    } catch (e) {
      setError(e.message || "Failed to export pending approvals.");
    } finally {
      setExporting(false);
    }
  };

  const hasActiveFilters = Boolean(
    filters.username.trim() ||
    filters.email.trim() ||
    filters.date_joined.trim() ||
    filters.search.trim()
  );

  const clearFilters = () => {
    setFilters({
      username: "",
      email: "",
      date_joined: "",
      search: "",
    });
  };

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const username = String(row.username || "").toLowerCase();
      const email = String(row.email || "").toLowerCase();
      const dateJoined = String(row.date_joined || "").toLowerCase();
      const formatted = formatDate(row.date_joined).toLowerCase();

      if (filters.search) {
        const query = filters.search.toLowerCase().trim();
        const matchesGlobal =
          username.includes(query) ||
          email.includes(query) ||
          dateJoined.includes(query) ||
          formatted.includes(query);
        if (!matchesGlobal) return false;
      }

      if (filters.username && !username.includes(filters.username.toLowerCase().trim())) {
        return false;
      }

      if (filters.email && !email.includes(filters.email.toLowerCase().trim())) {
        return false;
      }

      if (filters.date_joined) {
        const dQuery = filters.date_joined.toLowerCase().trim();
        if (!dateJoined.includes(dQuery) && !formatted.includes(dQuery)) {
          return false;
        }
      }

      return true;
    });
  }, [rows, filters]);

  return (
    <section className="module-page crud-page">
      <Card className="lca-card mb-3 pq-card" style={{ boxShadow: "0 4px 18px rgba(0,0,0,0.08)", borderRadius: "10px" }}>
        <CardHeader
          className="pq-card-header"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "0.75rem",
            background: "linear-gradient(135deg, #2a3042 0%, #36405a 100%)",
            color: "#ffffff",
            padding: "0.95rem 1.4rem",
            borderTopLeftRadius: "10px",
            borderTopRightRadius: "10px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <span
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "8px",
                background: "rgba(255, 255, 255, 0.12)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.25rem",
                color: "#60a5fa",
              }}
            >
              <BsPeopleFill />
            </span>
            <div>
              <h1
                style={{
                  margin: 0,
                  fontSize: "1.2rem",
                  fontWeight: 700,
                  color: "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.6rem",
                }}
              >
                User Confirmation (Pending Approvals)
                {rows.length > 0 && (
                  <span
                    className="pending-badge pending-badge--header"
                    style={{
                      background: "#f97316",
                      color: "#ffffff",
                      fontSize: "0.78rem",
                      fontWeight: 700,
                      padding: "0.18rem 0.55rem",
                      borderRadius: "12px",
                      letterSpacing: "0.3px",
                    }}
                  >
                    {rows.length} pending
                  </span>
                )}
              </h1>
              <p style={{ margin: "0.2rem 0 0", fontSize: "0.82rem", color: "#cbd5e1" }}>
                Review and approve newly registered user accounts to grant ERP access.
              </p>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <button
              type="button"
              className="crud-add-btn"
              onClick={load}
              disabled={loading}
              title="Refresh list"
              style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}
            >
              <BsArrowRepeat style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
              <span>Refresh</span>
            </button>
            <button
              type="button"
              className="crud-add-btn"
              onClick={handleExport}
              disabled={loading || exporting || filteredRows.length === 0}
              style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}
            >
              <BsDownload aria-hidden="true" />
              <span>{exporting ? "Exporting..." : "Download Excel"}</span>
            </button>
          </div>
        </CardHeader>

        <CardBody className="pq-card-body" style={{ padding: "1.25rem 1.4rem" }}>
          {actionMsg ? (
            <div style={{ marginBottom: "1rem" }}>
              <AlertMessage type="success" message={actionMsg} />
            </div>
          ) : null}

          {error ? (
            <div style={{ marginBottom: "1rem" }}>
              <AlertMessage type="danger" message={error} />
            </div>
          ) : null}

          {/* Quick Search & Summary Bar */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "0.75rem",
              marginBottom: "1rem",
              paddingBottom: "0.75rem",
              borderBottom: "1px solid #e2e8f0",
            }}
          >
            <div
              style={{
                position: "relative",
                width: "min(360px, 100%)",
                display: "flex",
                alignItems: "center",
              }}
            >
              <BsSearch
                style={{
                  position: "absolute",
                  left: "0.75rem",
                  color: "#94a3b8",
                  fontSize: "0.9rem",
                  pointerEvents: "none",
                }}
              />
              <input
                type="text"
                className="auth-input"
                placeholder="Search by username, email or date..."
                value={filters.search}
                onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
                style={{
                  paddingLeft: "2.2rem",
                  height: "36px",
                  fontSize: "0.85rem",
                  width: "100%",
                }}
              />
              {filters.search && (
                <button
                  type="button"
                  onClick={() => setFilters((prev) => ({ ...prev, search: "" }))}
                  style={{
                    position: "absolute",
                    right: "0.6rem",
                    background: "none",
                    border: "none",
                    color: "#94a3b8",
                    cursor: "pointer",
                    padding: 0,
                    display: "flex",
                    alignItems: "center",
                  }}
                  title="Clear search"
                >
                  <BsXCircle />
                </button>
              )}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  style={{
                    fontSize: "0.82rem",
                    padding: "0.35rem 0.65rem",
                    borderRadius: "6px",
                    border: "1px solid #cbd5e1",
                    background: "#f8fafc",
                    color: "#475569",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.35rem",
                    fontWeight: 500,
                  }}
                >
                  <BsXCircle />
                  <span>Clear Filters</span>
                </button>
              )}
              <span style={{ fontSize: "0.84rem", color: "#64748b", fontWeight: 500 }}>
                Showing <strong>{filteredRows.length}</strong> of <strong>{rows.length}</strong> pending request{rows.length !== 1 ? "s" : ""}
              </span>
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: "center", padding: "3rem 1rem", color: "#64748b" }}>
              <BsArrowRepeat
                style={{
                  fontSize: "2rem",
                  color: "#3b82f6",
                  animation: "spin 1s linear infinite",
                  marginBottom: "0.5rem",
                }}
              />
              <p style={{ margin: 0, fontSize: "0.95rem" }}>Loading pending user registrations...</p>
            </div>
          ) : rows.length === 0 && !error ? (
            <div
              style={{
                textAlign: "center",
                padding: "3.5rem 1.5rem",
                background: "#f8fafc",
                borderRadius: "8px",
                border: "1px dashed #cbd5e1",
                marginTop: "0.5rem",
              }}
            >
              <div
                style={{
                  width: "60px",
                  height: "60px",
                  borderRadius: "50%",
                  background: "rgba(34, 197, 94, 0.12)",
                  color: "#16a34a",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "2rem",
                  marginBottom: "0.85rem",
                }}
              >
                <BsCheckCircleFill />
              </div>
              <h3 style={{ margin: "0 0 0.35rem", fontSize: "1.1rem", color: "#1e293b", fontWeight: 600 }}>
                All Caught Up!
              </h3>
              <p style={{ margin: 0, fontSize: "0.88rem", color: "#64748b" }}>
                There are no pending user registration requests waiting for confirmation.
              </p>
            </div>
          ) : filteredRows.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "2.5rem 1.5rem",
                background: "#f8fafc",
                borderRadius: "8px",
                border: "1px dashed #cbd5e1",
              }}
            >
              <p style={{ margin: "0 0 0.75rem", fontSize: "0.92rem", color: "#64748b" }}>
                No pending registrations matched your filter criteria.
              </p>
              <button
                type="button"
                className="crud-add-btn"
                onClick={clearFilters}
                style={{ fontSize: "0.82rem", padding: "0.4rem 0.85rem" }}
              >
                Reset Filters
              </button>
            </div>
          ) : (
            <div className="users-table-wrap users-table-wrap--sticky pq-table-wrap-list">
              <table className="users-table">
                <thead>
                  <tr>
                    <th className="users-table__sticky-head" style={{ width: "28%" }}>Username</th>
                    <th className="users-table__sticky-head" style={{ width: "32%" }}>Email Address</th>
                    <th className="users-table__sticky-head" style={{ width: "22%" }}>Registered On</th>
                    <th className="users-table__sticky-head" style={{ width: "18%", textAlign: "center" }}>Actions</th>
                  </tr>
                  <tr style={{ background: "#f8fafc" }}>
                    <th>
                      <input
                        className="users-table__filter-input"
                        type="text"
                        placeholder="Filter username..."
                        value={filters.username}
                        onChange={(e) => setFilters((prev) => ({ ...prev, username: e.target.value }))}
                      />
                    </th>
                    <th>
                      <input
                        className="users-table__filter-input"
                        type="text"
                        placeholder="Filter email..."
                        value={filters.email}
                        onChange={(e) => setFilters((prev) => ({ ...prev, email: e.target.value }))}
                      />
                    </th>
                    <th>
                      <input
                        className="users-table__filter-input"
                        type="text"
                        placeholder="Filter date..."
                        value={filters.date_joined}
                        onChange={(e) => setFilters((prev) => ({ ...prev, date_joined: e.target.value }))}
                      />
                    </th>
                    <th style={{ textAlign: "center" }}>
                      {hasActiveFilters && (
                        <button
                          type="button"
                          onClick={clearFilters}
                          style={{
                            background: "none",
                            border: "none",
                            color: "#64748b",
                            fontSize: "0.78rem",
                            cursor: "pointer",
                            textDecoration: "underline",
                            fontWeight: 500,
                          }}
                        >
                          Clear
                        </button>
                      )}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.55rem" }}>
                          <span
                            style={{
                              width: "28px",
                              height: "28px",
                              borderRadius: "50%",
                              background: "#ffedd5",
                              color: "#ea580c",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "0.85rem",
                              flexShrink: 0,
                            }}
                          >
                            <BsClockHistory />
                          </span>
                          <span style={{ fontWeight: 600, color: "#1e293b" }}>{row.username}</span>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", color: "#334155" }}>
                          <BsEnvelopeFill style={{ color: "#94a3b8", fontSize: "0.85rem" }} />
                          <span>{row.email || "-"}</span>
                        </div>
                      </td>
                      <td style={{ color: "#475569", fontSize: "0.85rem" }}>
                        {formatDate(row.date_joined)}
                      </td>
                      <td>
                        <div
                          className="users-actions"
                          style={{ display: "flex", justifyContent: "center", gap: "0.5rem" }}
                        >
                          <button
                            type="button"
                            className="pending-action-btn pending-action-btn--approve"
                            aria-label="Approve"
                            disabled={processing === row.id}
                            onClick={() => handleOpenConfirm(row, "approve")}
                            title="Approve registration"
                          >
                            <BsCheckCircleFill aria-hidden="true" />
                            <span>{processing === row.id ? "Working..." : "Approve"}</span>
                          </button>
                          <button
                            type="button"
                            className="pending-action-btn pending-action-btn--reject"
                            aria-label="Reject"
                            disabled={processing === row.id}
                            onClick={() => handleOpenConfirm(row, "reject")}
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
          )}
        </CardBody>
      </Card>

      {/* Modern UI Confirm Popup Modal */}
      <ConfirmPopupModal
        open={confirmModal.open}
        title={
          confirmModal.action === "approve"
            ? "Approve User Registration"
            : "Reject User Registration"
        }
        type={confirmModal.action === "approve" ? "info" : "warning"}
        message={
          confirmModal.action === "approve"
            ? `Are you sure you want to approve the registration request for user "${confirmModal.user?.username}" (${confirmModal.user?.email || "No email"})? The user account will be activated and allowed to sign in immediately.`
            : `Are you sure you want to reject the registration request for user "${confirmModal.user?.username}" (${confirmModal.user?.email || "No email"})? This user will not be permitted access to the system.`
        }
        confirmLabel={confirmModal.action === "approve" ? "Approve User" : "Reject User"}
        cancelLabel="Cancel"
        confirmDisabled={processing !== null}
        onConfirm={handleConfirmAction}
        onCancel={handleCloseConfirm}
      />
    </section>
  );
}

export default PendingApprovalsPage;
