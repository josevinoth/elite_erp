import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import ActionConfirmationPage from "../components/ActionConfirmationPage";
import { listStockRetrievalItems, updateStockRetrievalItem } from "../services/crudApi";
import { getSessionUser } from "../services/sessionUser";
import AlertMessage from "../components/AlertMessage";
import TableSearchAndDownload from "../components/TableSearchAndDownload";
import "../styles/StockRetrieval.css";

const normalizeRejectedOption = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "item rejected" || normalized === "request rejected") {
    return "Item Rejected";
  }
  return value;
};
const getStatusHighlightClass = (action) => {
  if (action === "accept") return "stock-retrieval-modal__highlight--success";
  if (action === "reject") return "stock-retrieval-modal__highlight--danger";
  return "stock-retrieval-modal__highlight";
};
function StockRetrievalPage() {
  const navigate = useNavigate();
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
    const [searchText, setSearchText] = useState("");
    const [columnFilters, setColumnFilters] = useState({});
    const [rejectionDialog, setRejectionDialog] = useState({
    open: false,
    itemId: null,
    comment: "",
  });
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
  }), []);

   const isNotPurchased = useCallback((row) => (
     ["no stock", "not purchased"].includes(String(row?.stock_status?.status_name || "").trim().toLowerCase())
   ), []);

    const filteredItems = useMemo(() => {
      // Global search first
      const searchLower = searchText.trim().toLowerCase();
      const globalSearched = searchLower
        ? items.filter((row) =>
            Object.values(row).some((value) =>
              String(value || "").toLowerCase().includes(searchLower)
            )
          )
        : items;

      // Then apply per-column filters
      const activeFilters = Object.entries(columnFilters).filter(
        ([, value]) => String(value || "").trim()
      );

      if (!activeFilters.length) return globalSearched;

      return globalSearched.filter((row) =>
        activeFilters.every(([key, filterValue]) =>
          String(row[key] || "")
            .toLowerCase()
            .includes(String(filterValue).trim().toLowerCase())
        )
      );
    }, [items, searchText, columnFilters]);

   const tableColumns = [
     { key: "costing_ref", label: "Costing ID" },
     { key: "project_name", label: "Project ID - Name" },
     { key: "item_category", label: "Item Category" },
     { key: "item_name", label: "Item Name" },
     { key: "item_code", label: "Item Code" },
     { key: "item_type", label: "Item Type" },
     { key: "stock_status", label: "Stock Status", exportValue: (row) => row?.stock_status?.status_name || "-" },
     { key: "purchase_qty", label: "Available Qty" },
     { key: "requested_qty", label: "Requested Qty" },
     { key: "requested_by_name", label: "Requested By" },
     { key: "requested_on", label: "Requested On" },
     { key: "length", label: "L" },
     { key: "width", label: "W" },
     { key: "height", label: "H" },
     { key: "volume", label: "Volume" },
     { key: "retrieval_status", label: "Retrieval Status", exportValue: (row) => normalizeRejectedOption(row?.retrieval_status?.status_name || "Item Requested") },
     { key: "rejection_comment", label: "Rejection Comments" },
   ];

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
      await updateStockRetrievalItem(itemId, retrievalStatusName, rejectionComment, action);
      await loadItems();
      setStatus({ type: "", message: "" });
      setConfirmation({
        open: true,
        alertType: successType,
        message: successMessage,
        summary: buildSummary(row),
      });
    } catch (error) {
      setStatus({ type: "danger", message: error.message || "Failed to update retrieval status." });
    } finally {
      setSavingId("");
    }
  }, [buildSummary, loadItems]);

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
    setConfirmModal({ open: true, row, action: "accept", comment: "" });
  }, []);

  const confirmAccept = useCallback(async () => {
    const { row } = confirmModal;
    setConfirmModal({ open: false, row: null, action: "", comment: "" });
    await submitStatusUpdate(
      row,
      "Item Supplied",
      "",
      "accept",
      "Stock status updated successfully",
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
      "No Action",
      comment,
      "reject",
      "Retrieval request moved back to No Action",
      "warning"
    );
  }, [confirmModal, submitStatusUpdate]);

  const cancelConfirm = useCallback(() => {
    setConfirmModal({ open: false, row: null, action: "", comment: "" });
  }, []);

  const submitRejectionComment = useCallback(async () => {
    const rejectionComment = String(rejectionDialog.comment || "").trim();
    if (!rejectionComment) {
      setStatus({ type: "warning", message: "Rejection comments are required." });
      return;
    }
    const targetId = rejectionDialog.itemId;
    closeRejectionDialog();
    const targetRow = items.find((row) => row.id === targetId) || { id: targetId };
    await submitStatusUpdate(
      targetRow,
      "No Action",
      rejectionComment,
      "reject",
      "Retrieval request moved back to No Action",
      "warning"
    );
  }, [closeRejectionDialog, rejectionDialog.comment, rejectionDialog.itemId, submitStatusUpdate, items]);

  const returnToList = useCallback(async () => {
    setLoading(true);
    setConfirmation({ open: false, alertType: "success", message: "", summary: null });
    navigate("/stock-retrieval", { replace: true });
    try {
      await loadItems();
    } catch (error) {
      setStatus({ type: "danger", message: error.message || "Failed to refresh stock retrieval items." });
    } finally {
      setLoading(false);
    }
  }, [loadItems, navigate]);
  return (
    <section className="module-page stock-retrieval-page">
      <div className="crud-page__header stock-retrieval-toolbar">
        <h1 className="module-page__title module-page__title--stock">Stock Retrieval</h1>
      </div>
      {confirmation.open ? (
        <ActionConfirmationPage
          title="Stock Retrieval Confirmation"
          alertType={confirmation.alertType}
          message={confirmation.message}
          summary={confirmation.summary || {}}
          onReturn={returnToList}
        />
      ) : null}
      {!confirmation.open ? <AlertMessage type={status.type} message={status.message} /> : null}
       {!confirmation.open && confirmModal.open && confirmModal.row ? (
         <div className="stock-retrieval-modal-backdrop" onClick={(event) => { if (event.target === event.currentTarget) cancelConfirm(); }}>
           <div className="stock-retrieval-modal" role="dialog" aria-modal="true" aria-labelledby="stock-retrieval-confirm-title">
             <h3 id="stock-retrieval-confirm-title" className="stock-retrieval-modal__title">
               {confirmModal.action === "accept" ? "Confirm Accept" : "Confirm Rejection"}
             </h3>
             <div className="stock-retrieval-modal__content">
               <p><strong>Item:</strong> {confirmModal.row?.item_name || "-"}</p>
               <p><strong>Item Code:</strong> {confirmModal.row?.item_code || "-"}</p>
               <p><strong>Project:</strong> {confirmModal.row?.project_name || "-"}</p>
               {confirmModal.action === "accept" ? (
                 <p><strong>New Status:</strong> <span className="stock-retrieval-modal__highlight--success">Item Supplied</span></p>
               ) : (
                 <>
                   <p><strong>New Status:</strong> <span className="stock-retrieval-modal__highlight--danger">Item Requested</span></p>
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
             <div className="stock-retrieval-modal__actions">
               <button type="button" className="modal-btn modal-btn--cancel" onClick={cancelConfirm} disabled={savingId === String(confirmModal.row?.id)}>
                 Cancel
               </button>
               <button
                 type="button"
                 className={confirmModal.action === "accept" ? "modal-btn modal-btn--save" : "modal-btn modal-btn--cancel"}
                 onClick={confirmModal.action === "accept" ? confirmAccept : confirmReject}
                 disabled={savingId === String(confirmModal.row?.id)}
               >
                 {savingId === String(confirmModal.row?.id) ? "Processing..." : "Confirm"}
               </button>
             </div>
           </div>
         </div>
       ) : null}
       {!confirmation.open && !canEdit ? <AlertMessage type="warning" message="Only stock team or admin can update retrieval status." /> : null}
       {!confirmation.open && loading ? <p className="users-status">Loading stock retrieval items...</p> : null}
        {!confirmation.open && !loading ? (
          <>
            <TableSearchAndDownload
              rows={filteredItems}
              columns={tableColumns}
              title="Stock Retrieval"
              onSearchChange={setSearchText}
              showDownloadButton={true}
            />
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
               <tr>
                 <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={columnFilters.costing_ref ?? ""} onChange={(e) => setColumnFilters(prev => ({ ...prev, costing_ref: e.target.value }))} /></th>
                 <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={columnFilters.project_name ?? ""} onChange={(e) => setColumnFilters(prev => ({ ...prev, project_name: e.target.value }))} /></th>
                 <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={columnFilters.item_category ?? ""} onChange={(e) => setColumnFilters(prev => ({ ...prev, item_category: e.target.value }))} /></th>
                 <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={columnFilters.item_name ?? ""} onChange={(e) => setColumnFilters(prev => ({ ...prev, item_name: e.target.value }))} /></th>
                 <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={columnFilters.item_code ?? ""} onChange={(e) => setColumnFilters(prev => ({ ...prev, item_code: e.target.value }))} /></th>
                 <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={columnFilters.item_type ?? ""} onChange={(e) => setColumnFilters(prev => ({ ...prev, item_type: e.target.value }))} /></th>
                 <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={columnFilters.stock_status ?? ""} onChange={(e) => setColumnFilters(prev => ({ ...prev, stock_status: e.target.value }))} /></th>
                 <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={columnFilters.purchase_qty ?? ""} onChange={(e) => setColumnFilters(prev => ({ ...prev, purchase_qty: e.target.value }))} /></th>
                 <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={columnFilters.requested_qty ?? ""} onChange={(e) => setColumnFilters(prev => ({ ...prev, requested_qty: e.target.value }))} /></th>
                 <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={columnFilters.requested_by_name ?? ""} onChange={(e) => setColumnFilters(prev => ({ ...prev, requested_by_name: e.target.value }))} /></th>
                 <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={columnFilters.requested_on ?? ""} onChange={(e) => setColumnFilters(prev => ({ ...prev, requested_on: e.target.value }))} /></th>
                 <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={columnFilters.length ?? ""} onChange={(e) => setColumnFilters(prev => ({ ...prev, length: e.target.value }))} /></th>
                 <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={columnFilters.width ?? ""} onChange={(e) => setColumnFilters(prev => ({ ...prev, width: e.target.value }))} /></th>
                 <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={columnFilters.height ?? ""} onChange={(e) => setColumnFilters(prev => ({ ...prev, height: e.target.value }))} /></th>
                 <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={columnFilters.volume ?? ""} onChange={(e) => setColumnFilters(prev => ({ ...prev, volume: e.target.value }))} /></th>
                 <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={columnFilters.retrieval_status ?? ""} onChange={(e) => setColumnFilters(prev => ({ ...prev, retrieval_status: e.target.value }))} /></th>
                 <th></th>
                 <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={columnFilters.rejection_comment ?? ""} onChange={(e) => setColumnFilters(prev => ({ ...prev, rejection_comment: e.target.value }))} /></th>
               </tr>
            </thead>
             <tbody>
               {filteredItems.length === 0 ? (
                 <tr>
                   <td colSpan={18} className="stock-retrieval-empty">No retrieval items found.</td>
                 </tr>
               ) : filteredItems.map((row) => (
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
         </>
       ) : null}
      {!confirmation.open && rejectionDialog.open ? (
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
