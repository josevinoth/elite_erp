import { useCallback, useEffect, useMemo, useState } from "react";
import { listStockRetrievalItems, updateStockRetrievalItem } from "../services/crudApi";
import { getSessionUser } from "../services/sessionUser";
import "../styles/StockRetrieval.css";

const normalizeRejectedOption = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "item rejected" || normalized === "request rejected") {
    return "Item Rejected";
  }
  return value;
};
const getPopupClassName = (type) => {
  if (type === "error") return "popup-error";
  if (type === "warning") return "popup-warning";
  return "popup-success";
};
function StockRetrievalPage() {
  const currentUser = useMemo(() => getSessionUser(), []);
  const roleName = String(currentUser?.role || "").trim().toLowerCase();
  const teamName = String(currentUser?.team || "").trim().toLowerCase();
  const isAdmin = roleName === "admin" || roleName === "super admin" || roleName === "staff";
  const isStockRole = ["stock team", "stock", "stores team"].includes(roleName);
  const canEdit = isAdmin || isStockRole || ["stock team", "stock", "stores team"].includes(teamName);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [status, setStatus] = useState({ type: "", message: "" });
  const [items, setItems] = useState([]);
  const [rejectionDialog, setRejectionDialog] = useState({
    open: false,
    itemId: null,
    comment: "",
  });

  const isNotPurchased = useCallback((row) => (
    ["no stock", "not purchased"].includes(String(row?.stock_status?.status_name || "").trim().toLowerCase())
  ), []);
  const loadItems = useCallback(async () => {
    const data = await listStockRetrievalItems();
    setItems(Array.isArray(data?.items) ? data.items : []);
  }, []);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    loadItems()
      .catch((error) => {
        if (!alive) return;
        setStatus({ type: "error", message: error.message || "Failed to load stock retrieval items." });
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [loadItems]);
  const submitStatusUpdate = useCallback(async (itemId, retrievalStatusName, rejectionComment = "", action = "") => {
    setSavingId(String(itemId));
    try {
      const response = await updateStockRetrievalItem(itemId, retrievalStatusName, rejectionComment, action);
      const updatedItem = response?.item || null;
      setItems((prev) => {
        return prev.map((row) => (row.id === itemId ? { ...row, ...updatedItem } : row));
      });
      setStatus({ type: "success", message: "Retrieval status updated." });
    } catch (error) {
      setStatus({ type: "error", message: error.message || "Failed to update retrieval status." });
    } finally {
      setSavingId("");
    }
  }, []);

  const openRejectionDialog = useCallback((itemId, currentComment = "") => {
    setRejectionDialog({
      open: true,
      itemId,
      comment: String(currentComment || ""),
    });
  }, []);

  const closeRejectionDialog = useCallback(() => {
    setRejectionDialog({ open: false, itemId: null, comment: "" });
  }, []);

  const acceptItem = useCallback(async (row) => {
    await submitStatusUpdate(row.id, "Item Supplied", "", "accept");
  }, [submitStatusUpdate]);

  const rejectItem = useCallback((row) => {
    openRejectionDialog(row.id, row?.rejection_comment || "");
  }, [openRejectionDialog]);

  const submitRejectionComment = useCallback(async () => {
    const rejectionComment = String(rejectionDialog.comment || "").trim();
    if (!rejectionComment) {
      setStatus({ type: "warning", message: "Rejection comments are required." });
      return;
    }
    const targetId = rejectionDialog.itemId;
    closeRejectionDialog();
    await submitStatusUpdate(targetId, "Item Requested", rejectionComment, "reject");
  }, [closeRejectionDialog, rejectionDialog.comment, rejectionDialog.itemId, submitStatusUpdate]);
  return (
    <section className="module-page stock-retrieval-page">
      <div className="crud-page__header stock-retrieval-toolbar">
        <h1 className="module-page__title">Stock Retrieval</h1>
      </div>
      {status.message ? (
        <p className={`users-status stock-retrieval-status ${getPopupClassName(status.type)}`}>{status.message}</p>
      ) : null}
      {!canEdit ? (
        <p className="users-status popup-warning stock-retrieval-warning">Only stock team or admin can update retrieval status.</p>
      ) : null}
      {loading ? <p className="users-status">Loading stock retrieval items...</p> : null}
      {!loading ? (
        <div className="users-table-wrap stock-retrieval-wrap">
          <table className="users-table stock-retrieval-table">
            <thead>
              <tr>
                <th>Costing ID</th>
                <th>Project ID - Name</th>
                <th>Item Category</th>
                <th>Item Name</th>
                <th>Item Code</th>
                <th>Item Type</th>
                <th>Stock Status</th>
                <th>Available Qty</th>
                <th>Requested Qty</th>
                <th>Requested By</th>
                <th>Requested On</th>
                <th className="stock-retrieval-table__right">L</th>
                <th className="stock-retrieval-table__right">W</th>
                <th className="stock-retrieval-table__right">H</th>
                <th className="stock-retrieval-table__right">Volume</th>
                <th>Retrieval Status</th>
                <th>Action</th>
                <th>Rejection Comments</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={18} className="stock-retrieval-empty">No retrieval items found.</td>
                </tr>
              ) : items.map((row) => (
                <tr key={row.id}>
                  <td>{row?.costing_ref || row?.costing_id || "-"}</td>
                  <td>{`${row?.project_code || "-"} - ${row?.project_name || "-"}`}</td>
                  <td>{row.item_category || "-"}</td>
                  <td>{row.item_name || "-"}</td>
                  <td>{row.item_code || "-"}</td>
                  <td>{row.item_type || "-"}</td>
                  <td>{row?.stock_status?.status_name || "-"}</td>
                  <td className="stock-retrieval-table__right">{row.purchase_qty}</td>
                  <td className="stock-retrieval-table__right">{row.requested_qty}</td>
                  <td>{row?.requested_by_name || "-"}</td>
                  <td>{row?.requested_on ? new Date(row.requested_on).toLocaleString() : "-"}</td>
                  <td className="stock-retrieval-table__right">{row.length}</td>
                  <td className="stock-retrieval-table__right">{row.width}</td>
                  <td className="stock-retrieval-table__right">{row.height}</td>
                  <td className="stock-retrieval-table__right">{row.volume}</td>
                  <td>{normalizeRejectedOption(row?.retrieval_status?.status_name || "Item Requested")}</td>
                  <td>
                    <div className="stock-retrieval-actions">
                      <button
                        type="button"
                        className="modal-btn modal-btn--save stock-retrieval-action-btn"
                        disabled={!canEdit || savingId === String(row.id) || isNotPurchased(row)}
                        onClick={() => acceptItem(row)}
                      >
                        Accept
                      </button>
                      <button
                        type="button"
                        className="modal-btn modal-btn--cancel stock-retrieval-action-btn"
                        disabled={!canEdit || savingId === String(row.id)}
                        onClick={() => rejectItem(row)}
                      >
                        Reject
                      </button>
                    </div>
                  </td>
                  <td>{row?.rejection_comment || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {rejectionDialog.open ? (
        <div className="stock-retrieval-modal-backdrop" onClick={(event) => { if (event.target === event.currentTarget) closeRejectionDialog(); }}>
          <div className="stock-retrieval-modal" role="dialog" aria-modal="true" aria-labelledby="stock-retrieval-rejection-title">
            <h3 id="stock-retrieval-rejection-title" className="stock-retrieval-modal__title">Enter rejection comments</h3>
            <textarea
              className="auth-input stock-retrieval-modal__textarea"
              rows={4}
              value={rejectionDialog.comment}
              onChange={(event) => setRejectionDialog((prev) => ({ ...prev, comment: event.target.value }))}
              placeholder="Enter reason for rejection (item will move to Item Requested)"
            />
            <div className="stock-retrieval-modal__actions">
              <button type="button" className="modal-btn modal-btn--cancel" onClick={closeRejectionDialog}>Cancel</button>
              <button type="button" className="modal-btn modal-btn--save" onClick={submitRejectionComment}>Save</button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
export default StockRetrievalPage;
