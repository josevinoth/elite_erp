import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import ActionConfirmationPage from "../components/ActionConfirmationPage";
import ConfirmPopupModal from "../components/ConfirmPopupModal";
import { createStockReturnRequest, listStockReturnItems, updateStockReturnItem } from "../services/crudApi";
import { getSessionUser } from "../services/sessionUser";
import AlertMessage from "../components/AlertMessage";
import TableSearchAndDownload from "../components/TableSearchAndDownload";
import "../styles/StockRetrieval.css";

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatReturnBreakdown = (row, mode = "pending") => {
  const allocations = Array.isArray(row?.return_breakdown) ? row.return_breakdown : [];
  const filtered = allocations.filter((allocation) => {
    if (mode === "eligible") return toNumber(allocation?.remaining_consumed_qty) > 0;
    return toNumber(allocation?.pending_return_qty) > 0;
  });
  if (!filtered.length) return "-";
  return filtered.map((allocation) => {
    const qty = mode === "eligible" ? allocation?.remaining_consumed_qty : allocation?.pending_return_qty;
    return `${allocation?.grn_number || "-"} (${qty || "0"})`;
  }).join(", ");
};

function StockReturnPage() {
  const navigate = useNavigate();
  const currentUser = useMemo(() => getSessionUser(), []);
  const roleName = String(currentUser?.role || "").trim().toLowerCase();
  const teamName = String(currentUser?.team || "").trim().toLowerCase();
  const isAdmin = roleName === "admin" || roleName === "super admin" || roleName === "staff";
  const isStockRole = ["stock team", "stock", "stores team"].includes(roleName) || ["stock team", "stock", "stores team"].includes(teamName);
  const currentUserId = String(currentUser?.id || "").trim();

  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [status, setStatus] = useState({ type: "", message: "" });
  const [items, setItems] = useState([]);
  const [eligibleItems, setEligibleItems] = useState([]);
  const [returnDrafts, setReturnDrafts] = useState({});
  const [searchText, setSearchText] = useState("");
  const [columnFilters, setColumnFilters] = useState({});
  const [confirmModal, setConfirmModal] = useState({
    open: false,
    row: null,
    action: "",
    comment: "",
  });
  const [confirmation, setConfirmation] = useState({
    open: false,
    alertType: "success",
    message: "",
    summary: null,
  });

  const buildSummary = useCallback((row = {}) => ({
    item_name: row?.item_name || "-",
    item_code: row?.item_code || "-",
    project_name: row?.project_name || "-",
    quotation_number: row?.quotation_number || "-",
    return_qty: row?.return_qty || "-",
  }), []);

  const filteredItems = useMemo(() => {
    const searchLower = searchText.trim().toLowerCase();
    const enrichedRows = items.map((row) => ({
      ...row,
      return_allocation: formatReturnBreakdown(row, "pending"),
    }));
    const globalSearched = searchLower
      ? enrichedRows.filter((row) =>
          Object.values(row).some((value) =>
            String(value || "").toLowerCase().includes(searchLower)
          )
        )
      : enrichedRows;

    const activeFilters = Object.entries(columnFilters).filter(([, value]) => String(value || "").trim());
    if (!activeFilters.length) return globalSearched;

    return globalSearched.filter((row) =>
      activeFilters.every(([key, filterValue]) =>
        String(row[key] || "").toLowerCase().includes(String(filterValue).trim().toLowerCase())
      )
    );
  }, [items, searchText, columnFilters]);

  const visibleEligibleItems = useMemo(() => {
    const searchLower = searchText.trim().toLowerCase();
    if (!searchLower) return eligibleItems;
    return eligibleItems.filter((row) => (
      [
        row?.quotation_number,
        row?.project_name,
        row?.item_name,
        row?.item_code,
        formatReturnBreakdown(row, "eligible"),
      ].some((value) => String(value || "").toLowerCase().includes(searchLower))
    ));
  }, [eligibleItems, searchText]);

  const tableColumns = [
    { key: "costing_id", label: "Costing ID" },
    { key: "item_category", label: "Item Category" },
    { key: "item_name", label: "Item Name" },
    { key: "item_code", label: "Item Code" },
    { key: "stock_status", label: "Stock Status", exportValue: (row) => row?.stock_status?.status_name || "-" },
    { key: "requested_qty", label: "Requested Qty" },
    { key: "return_qty", label: "Return Qty" },
    { key: "return_allocation", label: "FIFO GRN Allocation" },
    { key: "retrieval_status", label: "Return Status", exportValue: (row) => row?.retrieval_status?.status_name || "Item Return" },
    { key: "rejection_comment", label: "Rejection Comments" },
  ];

  const loadItems = useCallback(async () => {
    const data = await listStockReturnItems();
    setItems(Array.isArray(data?.items) ? data.items : []);
    setEligibleItems(Array.isArray(data?.eligible_items) ? data.eligible_items : []);
  }, []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    loadItems()
      .catch((error) => {
        if (!alive) return;
        setStatus({ type: "error", message: error.message || "Failed to load stock return items." });
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [loadItems]);

  const updateReturnDraft = useCallback((itemId, value) => {
    setReturnDrafts((prev) => ({ ...prev, [itemId]: value }));
  }, []);

  const requestReturn = useCallback(async (row) => {
    const draftValue = String(returnDrafts[row?.id] || "").trim();
    if (!draftValue || toNumber(draftValue) <= 0) {
      setStatus({ type: "warning", message: "Enter a valid return quantity." });
      return;
    }

    const requestKey = `request-${row?.id}`;
    setSavingId(requestKey);
    try {
      const response = await createStockReturnRequest({
        item_id: row?.id,
        item_code: row?.item_code,
        return_qty: draftValue,
      });
      await loadItems();
      setReturnDrafts((prev) => ({ ...prev, [row?.id]: "" }));
      setStatus({ type: "", message: "" });
      setConfirmation({
        open: true,
        alertType: "info",
        message: response?.message || "FIFO return request created successfully.",
        summary: {
          ...buildSummary(row),
          return_qty: response?.return_qty || draftValue,
        },
      });
    } catch (error) {
      setStatus({ type: "danger", message: error.message || "Failed to create stock return request." });
    } finally {
      setSavingId("");
    }
  }, [buildSummary, loadItems, returnDrafts]);

  const submitStatusUpdate = useCallback(async (
    row,
    retrievalStatusName,
    rejectionComment = "",
    action = "",
    successMessage = "Stock status updated successfully",
    successType = "success"
  ) => {
    const itemId = row?.id;
    setSavingId(String(itemId));
    try {
      const response = await updateStockReturnItem(itemId, {
        retrieval_status_name: retrievalStatusName,
        rejection_comment: rejectionComment,
        action,
      });
      await loadItems();
      setStatus({ type: "", message: "" });
      setConfirmation({
        open: true,
        alertType: successType,
        message: successMessage,
        summary: {
          ...buildSummary(row),
          return_qty: response?.return_qty || row?.return_qty || "-",
        },
      });
    } catch (error) {
      setStatus({ type: "danger", message: error.message || "Return request failed." });
    } finally {
      setSavingId("");
    }
  }, [buildSummary, loadItems]);

  const approveItem = useCallback((row) => {
    setConfirmModal({ open: true, row, action: "approve", comment: "" });
  }, []);

  const confirmApprove = useCallback(async () => {
    const { row } = confirmModal;
    setConfirmModal({ open: false, row: null, action: "", comment: "" });
    await submitStatusUpdate(
      row,
      "Item Return Accepted",
      "",
      "approve",
      "Item returned successfully.",
      "success"
    );
  }, [confirmModal, submitStatusUpdate]);

  const rejectItem = useCallback((row) => {
    setConfirmModal({ open: true, row, action: "reject", comment: row?.rejection_comment || "" });
  }, []);

  const confirmReject = useCallback(async () => {
    const { row, comment } = confirmModal;
    setConfirmModal({ open: false, row: null, action: "", comment: "" });
    if (!comment.trim()) {
      setStatus({ type: "warning", message: "Rejection comments are required." });
      return;
    }
    await submitStatusUpdate(
      row,
      "Item Accepted",
      comment,
      "reject",
      "Return rejected and moved back to Item Accepted.",
      "warning"
    );
  }, [confirmModal, submitStatusUpdate]);

  const cancelConfirm = useCallback(() => {
    setConfirmModal({ open: false, row: null, action: "", comment: "" });
  }, []);

  const returnToList = useCallback(async () => {
    setLoading(true);
    setConfirmation({ open: false, alertType: "success", message: "", summary: null });
    navigate("/stock-return", { replace: true });
    try {
      await loadItems();
    } catch (error) {
      setStatus({ type: "danger", message: error.message || "Failed to refresh stock return items." });
    } finally {
      setLoading(false);
    }
  }, [loadItems, navigate]);

  return (
    <section className="module-page stock-retrieval-page">
      <div className="crud-page__header stock-retrieval-toolbar">
        <h1 className="module-page__title module-page__title--stock">Stock Return</h1>
      </div>
      {confirmation.open ? (
        <ActionConfirmationPage
          title="Stock Return Confirmation"
          alertType={confirmation.alertType}
          message={confirmation.message}
          summary={confirmation.summary || {}}
          onReturn={returnToList}
        />
      ) : null}
      {!confirmation.open ? <AlertMessage type={status.type} message={status.message} /> : null}
      {!confirmation.open && confirmModal.open && confirmModal.row ? (
        <ConfirmPopupModal
          open={confirmModal.open}
          title={confirmModal.action === "approve" ? "Confirm Approval" : "Confirm Rejection"}
          type={confirmModal.action === "approve" ? "info" : "warning"}
          message="Confirm action. Do you want to proceed?"
          confirmLabel={savingId === String(confirmModal.row?.id) ? "Processing..." : "OK"}
          cancelLabel="Cancel"
          confirmDisabled={savingId === String(confirmModal.row?.id)}
          cancelDisabled={savingId === String(confirmModal.row?.id)}
          onConfirm={confirmModal.action === "approve" ? confirmApprove : confirmReject}
          onCancel={cancelConfirm}
        >
          <div className="stock-retrieval-modal__content">
            <p><strong>Item:</strong> {confirmModal.row?.item_name || "-"}</p>
            <p><strong>Item Code:</strong> {confirmModal.row?.item_code || "-"}</p>
            <p><strong>Costing ID:</strong> {confirmModal.row?.costing_id || "-"}</p>
            <p><strong>Return Qty:</strong> {confirmModal.row?.return_qty || "0"}</p>
            <p><strong>FIFO Allocation:</strong> {formatReturnBreakdown(confirmModal.row, "pending")}</p>
            {confirmModal.action === "approve" ? (
              <p><strong>New Status:</strong> <span className="stock-retrieval-modal__highlight--success">Item Return Accepted (In-Stock)</span></p>
            ) : (
              <>
                <p><strong>New Status:</strong> <span className="stock-retrieval-modal__highlight--danger">Item Accepted</span></p>
                <label className="stock-retrieval-modal__label">
                  Rejection Comment:
                  <textarea
                    className="auth-input stock-retrieval-modal__textarea stock-retrieval-modal__textarea--spaced"
                    rows={3}
                    value={confirmModal.comment}
                    onChange={(e) => setConfirmModal((prev) => ({ ...prev, comment: e.target.value }))}
                    placeholder="Enter reason for rejection"
                  />
                </label>
              </>
            )}
          </div>
        </ConfirmPopupModal>
      ) : null}
      {!confirmation.open && !(isAdmin || isStockRole) ? <AlertMessage type="warning" message="Stock team, project owners, or admin can update return status." /> : null}
      {!confirmation.open && loading ? <p className="users-status">Loading stock return items...</p> : null}
      {!confirmation.open && !loading ? (
        <>
          <div className="costing-section-card costing-section-card--spaced">
            <div className="costing-section-card__head">
              <h3 className="costing-section-card__title">Create Return Request</h3>
            </div>
            <p className="costing-help-text costing-help-text--mt">
              Enter only the return quantity. FIFO will allocate the return against the earliest consumed GRNs automatically.
            </p>
            <div className="users-table-wrap stock-retrieval-wrap">
              <table className="users-table stock-retrieval-table">
                <thead>
                  <tr>
                    <th>Quotation Number</th>
                    <th>Project Name</th>
                    <th>Item Name</th>
                    <th>Item Code</th>
                    <th className="stock-retrieval-table__right">Accepted Qty</th>
                    <th>Available GRNs</th>
                    <th>Return Qty</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleEligibleItems.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="stock-retrieval-empty">No accepted items available for return.</td>
                    </tr>
                  ) : visibleEligibleItems.map((row) => {
                    const canEdit = isAdmin || isStockRole || String(row?.project_owner_id || "") === currentUserId;
                    const requestKey = `request-${row?.id}`;
                    return (
                      <tr key={`eligible-${row.id}`}>
                        <td>{row?.quotation_number || "-"}</td>
                        <td>{row?.project_name || "-"}</td>
                        <td>{row?.item_name || "-"}</td>
                        <td>{row?.item_code || "-"}</td>
                        <td className="stock-retrieval-table__right">{row?.accepted_qty || "0"}</td>
                        <td>{formatReturnBreakdown(row, "eligible")}</td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            className="auth-input"
                            value={returnDrafts[row?.id] || ""}
                            disabled={!canEdit || savingId === requestKey}
                            onChange={(event) => updateReturnDraft(row?.id, event.target.value)}
                            placeholder="Qty"
                          />
                        </td>
                        <td>
                          <button
                            type="button"
                            className="modal-btn modal-btn--save stock-retrieval-action-btn"
                            disabled={!canEdit || savingId === requestKey}
                            onClick={() => requestReturn(row)}
                          >
                            {savingId === requestKey ? "Creating..." : "Create Return"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <TableSearchAndDownload
            rows={filteredItems}
            columns={tableColumns}
            title="Stock Return"
            onSearchChange={setSearchText}
            showDownloadButton={true}
          />
          <div className="users-table-wrap stock-retrieval-wrap">
            <table className="users-table stock-retrieval-table">
              <thead>
                <tr>
                  <th>Costing ID</th>
                  <th>Item Category</th>
                  <th>Item Name</th>
                  <th>Item Code</th>
                  <th>Stock Status</th>
                  <th className="stock-retrieval-table__right">Requested Qty</th>
                  <th className="stock-retrieval-table__right">Return Qty</th>
                  <th>FIFO GRN Allocation</th>
                  <th>Return Status</th>
                  <th>Action</th>
                  <th>Rejection Comments</th>
                </tr>
                <tr>
                  <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={columnFilters.costing_id ?? ""} onChange={(e) => setColumnFilters((prev) => ({ ...prev, costing_id: e.target.value }))} /></th>
                  <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={columnFilters.item_category ?? ""} onChange={(e) => setColumnFilters((prev) => ({ ...prev, item_category: e.target.value }))} /></th>
                  <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={columnFilters.item_name ?? ""} onChange={(e) => setColumnFilters((prev) => ({ ...prev, item_name: e.target.value }))} /></th>
                  <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={columnFilters.item_code ?? ""} onChange={(e) => setColumnFilters((prev) => ({ ...prev, item_code: e.target.value }))} /></th>
                  <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={columnFilters.stock_status ?? ""} onChange={(e) => setColumnFilters((prev) => ({ ...prev, stock_status: e.target.value }))} /></th>
                  <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={columnFilters.requested_qty ?? ""} onChange={(e) => setColumnFilters((prev) => ({ ...prev, requested_qty: e.target.value }))} /></th>
                  <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={columnFilters.return_qty ?? ""} onChange={(e) => setColumnFilters((prev) => ({ ...prev, return_qty: e.target.value }))} /></th>
                  <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={columnFilters.return_allocation ?? ""} onChange={(e) => setColumnFilters((prev) => ({ ...prev, return_allocation: e.target.value }))} /></th>
                  <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={columnFilters.retrieval_status ?? ""} onChange={(e) => setColumnFilters((prev) => ({ ...prev, retrieval_status: e.target.value }))} /></th>
                  <th></th>
                  <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={columnFilters.rejection_comment ?? ""} onChange={(e) => setColumnFilters((prev) => ({ ...prev, rejection_comment: e.target.value }))} /></th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="stock-retrieval-empty">No return items found.</td>
                  </tr>
                ) : filteredItems.map((row) => {
                  const canEdit = isAdmin || isStockRole || String(row?.project_owner_id || "") === currentUserId;
                  return (
                    <tr key={row.id}>
                      <td>{row?.costing_id || "-"}</td>
                      <td>{row.item_category || "-"}</td>
                      <td>{row.item_name || "-"}</td>
                      <td>{row.item_code || "-"}</td>
                      <td>{row?.stock_status?.status_name || "-"}</td>
                      <td className="stock-retrieval-table__right">{row.requested_qty}</td>
                      <td className="stock-retrieval-table__right">{row.return_qty || "0"}</td>
                      <td>{row.return_allocation}</td>
                      <td>{row?.retrieval_status?.status_name || "Item Return"}</td>
                      <td>
                        <div className="stock-retrieval-actions">
                          <button
                            type="button"
                            className="modal-btn modal-btn--save stock-retrieval-action-btn"
                            disabled={!canEdit || savingId === String(row.id)}
                            onClick={() => approveItem(row)}
                          >
                            Approved
                          </button>
                          <button
                            type="button"
                            className="modal-btn modal-btn--cancel stock-retrieval-action-btn"
                            disabled={!canEdit || savingId === String(row.id)}
                            onClick={() => rejectItem(row)}
                          >
                            Rejected
                          </button>
                        </div>
                      </td>
                      <td>{row?.rejection_comment || "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </section>
  );
}

export default StockReturnPage;


