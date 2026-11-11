import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BsCheckLg, BsXLg } from "react-icons/bs";
import ActionConfirmationPage from "../components/ActionConfirmationPage";
import ConfirmPopupModal from "../components/ConfirmPopupModal";
import { listStockRetrievalItems, updateStockRetrievalItem } from "../services/crudApi";
import AlertMessage from "../components/AlertMessage";
import TableSearchAndDownload from "../components/TableSearchAndDownload";
import "../styles/StockRetrieval.css";

const STATUS_NO_ACTION = "No Action";
const normalizeRejectedOption = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "item rejected" || normalized === "request rejected") {
    return "Item Rejected";
  }
  return value || "—";
};
const getLiveStockStatus = (row) => {
  const availableQty = Number(row?.available_stock_qty);
  if (!Number.isFinite(availableQty)) {
    return row?.stock_status?.status_name || "No Stock";
  }
  if (availableQty <= 0) return "No Stock";
  return availableQty < (Number(row?.requested_qty) || 0) ? "Partial Stock" : "In-Stock";
};
const getStockBadgeClass = (statusName) => {
  const normalized = String(statusName || "").trim().toLowerCase();
  if (normalized === "in-stock" || normalized === "in stock") return "stock-retrieval-badge--in-stock";
  if (normalized === "partial stock" || normalized === "partially ordered") return "stock-retrieval-badge--partial";
  return "stock-retrieval-badge--no-stock";
};
const getRetrievalBadgeClass = (statusName) => {
  const normalized = String(statusName || "").trim().toLowerCase();
  if (normalized.includes("accepted") || normalized === "item supplied") return "stock-retrieval-badge--success";
  if (normalized.includes("return") || normalized === "item rejected") return "stock-retrieval-badge--danger";
  if (normalized === "no action") return "stock-retrieval-badge--neutral";
  return "stock-retrieval-badge--pending";
};
function StockRetrievalPage() {
  const navigate = useNavigate();
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

   const retrievalRows = useMemo(() => (
     items.map((item) => {
       const allocations = Array.isArray(item?.grn_allocations) ? item.grn_allocations : [];
       const availableQty = Number(item?.available_stock_qty);
       const requestedQty = allocations.length
         ? allocations.reduce((sum, allocation) => sum + (Number(allocation?.allocated_qty) || 0), 0)
         : Number(item?.requested_qty) || 0;
       return {
         ...item,
         row_key: String(item.id),
         combined_item: `${item?.item_code || "-"} _ ${item?.item_category || "-"} _ ${item?.item_name || "-"}`,
         available_stock_qty: Number.isFinite(availableQty) ? String(availableQty) : "0",
         grn_allocated_qty: String(requestedQty),
         grn_retrieval_status_name: item?.retrieval_status?.status_name || "Item Requested",
       };
     })
   ), [items]);

    const filteredItems = useMemo(() => {
      // Global search first
      const searchLower = searchText.trim().toLowerCase();
      const globalSearched = searchLower
        ? retrievalRows.filter((row) =>
            Object.values(row).some((value) =>
              String(value || "").toLowerCase().includes(searchLower)
            )
          )
        : retrievalRows;

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
    }, [retrievalRows, searchText, columnFilters]);

   const tableColumns = [
     { key: "costing_ref", label: "Costing ID" },
     { key: "project_name", label: "Project ID - Name" },
     { key: "combined_item", label: "Item Code _ Item Category _ Item Name" },
     { key: "item_type", label: "Item Type" },
     { key: "stock_status", label: "Stock Status", exportValue: (row) => getLiveStockStatus(row) },
     { key: "available_stock_qty", label: "Available Qty" },
     { key: "grn_allocated_qty", label: "Requested Qty" },
     { key: "requested_by_name", label: "Requested By" },
     { key: "requested_on", label: "Requested On" },
     { key: "updated_by", label: "Updated By", exportValue: (row) => row?.updated_by || row?.requested_by_name || "—" },
     { key: "updated_on", label: "Updated On", exportValue: (row) => row?.updated_on || (row?.updated_at ? new Date(row.updated_at).toLocaleString() : (row?.requested_on ? new Date(row.requested_on).toLocaleString() : "—")) },
     { key: "grn_retrieval_status_name", label: "Retrieval Status", exportValue: (row) => normalizeRejectedOption(row?.grn_retrieval_status_name || row?.retrieval_status?.status_name || STATUS_ITEM_REQUESTED) },
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
      await updateStockRetrievalItem(itemId, {
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
      "FIFO stock accepted and moved to Stock Acceptance.",
      "success",
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
      STATUS_NO_ACTION,
      comment,
      "reject",
      "FIFO stock request rejected and moved to No Action.",
      "warning",
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
         <ConfirmPopupModal
           open={confirmModal.open}
           title={confirmModal.action === "accept" ? "Confirm Accept" : "Confirm Rejection"}
           type={confirmModal.action === "accept" ? "info" : "warning"}
           message="Confirm action. Do you want to proceed?"
           confirmLabel={savingId === String(confirmModal.row?.id) ? "Processing..." : "OK"}
           cancelLabel="Cancel"
           confirmDisabled={savingId === String(confirmModal.row?.id)}
           cancelDisabled={savingId === String(confirmModal.row?.id)}
           onConfirm={confirmModal.action === "accept" ? confirmAccept : confirmReject}
           onCancel={cancelConfirm}
         >
           <div className="stock-retrieval-modal__content">
             <p><strong>Item:</strong> {confirmModal.row?.item_name || "-"}</p>
             <p><strong>Item Code:</strong> {confirmModal.row?.item_code || "-"}</p>
             <p><strong>Allocation:</strong> The system will choose stock using FIFO.</p>
             <p><strong>Project:</strong> {confirmModal.row?.project_name || "-"}</p>
             {confirmModal.action === "accept" ? (
                <p><strong>New Status:</strong> <span className="stock-retrieval-modal__highlight--success">Item Supplied</span></p>
             ) : (
               <>
                  <p><strong>New Status:</strong> <span className="stock-retrieval-modal__highlight--danger">No Action</span></p>
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
                <th>Item Code _ Item Category _ Item Name</th>
                <th>Item Type</th>
                <th>Stock Status</th>
                <th>Available Qty</th>
                <th>Requested Qty</th>
                <th>Requested By</th>
                <th>Requested On</th>
                <th>Updated By</th>
                <th>Updated On</th>
                <th>Retrieval Status</th>
                <th>Action</th>
               <th>Rejection Comments</th>
               </tr>
               <tr>
                 <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={columnFilters.costing_ref ?? ""} onChange={(e) => setColumnFilters(prev => ({ ...prev, costing_ref: e.target.value }))} /></th>
                 <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={columnFilters.project_name ?? ""} onChange={(e) => setColumnFilters(prev => ({ ...prev, project_name: e.target.value }))} /></th>
                 <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={columnFilters.combined_item ?? ""} onChange={(e) => setColumnFilters(prev => ({ ...prev, combined_item: e.target.value }))} /></th>
                 <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={columnFilters.item_type ?? ""} onChange={(e) => setColumnFilters(prev => ({ ...prev, item_type: e.target.value }))} /></th>
                 <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={columnFilters.stock_status ?? ""} onChange={(e) => setColumnFilters(prev => ({ ...prev, stock_status: e.target.value }))} /></th>
                 <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={columnFilters.available_stock_qty ?? ""} onChange={(e) => setColumnFilters(prev => ({ ...prev, available_stock_qty: e.target.value }))} /></th>
                 <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={columnFilters.grn_allocated_qty ?? ""} onChange={(e) => setColumnFilters(prev => ({ ...prev, grn_allocated_qty: e.target.value }))} /></th>
                 <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={columnFilters.requested_by_name ?? ""} onChange={(e) => setColumnFilters(prev => ({ ...prev, requested_by_name: e.target.value }))} /></th>
                 <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={columnFilters.requested_on ?? ""} onChange={(e) => setColumnFilters(prev => ({ ...prev, requested_on: e.target.value }))} /></th>
                 <th></th>
                 <th></th>
                 <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={columnFilters.grn_retrieval_status_name ?? ""} onChange={(e) => setColumnFilters(prev => ({ ...prev, grn_retrieval_status_name: e.target.value }))} /></th>
                 <th></th>
                 <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={columnFilters.rejection_comment ?? ""} onChange={(e) => setColumnFilters(prev => ({ ...prev, rejection_comment: e.target.value }))} /></th>
               </tr>
            </thead>
             <tbody>
               {filteredItems.length === 0 ? (
                 <tr>
                    <td colSpan={14} className="stock-retrieval-empty">No retrieval items found.</td>
                 </tr>
                ) : filteredItems.map((row) => {
                 return (
                <tr key={row.row_key || row.id}>
                  <td>{row?.costing_ref || row?.costing_id || "-"}</td>
                  <td>{`${row?.project_code || "-"} - ${row?.project_name || "-"}`}</td>
                  <td>{row.combined_item}</td>
                  <td>{row.item_type || "-"}</td>
                  <td>
                    <span className={`stock-retrieval-badge ${getStockBadgeClass(getLiveStockStatus(row))}`}>
                      {getLiveStockStatus(row)}
                    </span>
                  </td>
                  <td className="stock-retrieval-table__right">{row.available_stock_qty}</td>
                  <td className="stock-retrieval-table__right">{row.grn_allocated_qty}</td>
                  <td>{row?.requested_by_name || "-"}</td>
                  <td>{row?.requested_on ? new Date(row.requested_on).toLocaleString() : "-"}</td>
                  <td>{row?.updated_by || row?.requested_by_name || "—"}</td>
                  <td>{row?.updated_on || (row?.updated_at ? new Date(row.updated_at).toLocaleString() : (row?.requested_on ? new Date(row.requested_on).toLocaleString() : "—"))}</td>
                  <td>
                    <span className={`stock-retrieval-badge ${getRetrievalBadgeClass(row?.grn_retrieval_status_name || row?.retrieval_status?.status_name)}`}>
                      {normalizeRejectedOption(row?.grn_retrieval_status_name || row?.retrieval_status?.status_name)}
                    </span>
                  </td>
                  <td>
                    <div className="stock-retrieval-actions">
                      <button
                        type="button"
                        className="stock-retrieval-action-btn stock-retrieval-action-btn--accept"
                        aria-label="Accept retrieval request"
                        title="Accept"
                        disabled={savingId === String(row.id) || Number(row.available_stock_qty) <= 0}
                        onClick={() => acceptItem(row)}
                      >
                        <BsCheckLg aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className="stock-retrieval-action-btn stock-retrieval-action-btn--reject"
                        aria-label="Reject retrieval request"
                        title="Reject"
                        disabled={savingId === String(row.id) || Number(row.available_stock_qty) <= 0}
                        onClick={() => rejectItem(row)}
                      >
                        <BsXLg aria-hidden="true" />
                      </button>
                    </div>
                  </td>
                  <td>{row?.rejection_comment || "-"}</td>
                </tr>
              )})}
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
