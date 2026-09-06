import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import ActionConfirmationPage from "../components/ActionConfirmationPage";
import { listStockAcceptanceItems, updateStockAcceptanceItem } from "../services/crudApi";
import AlertMessage from "../components/AlertMessage";
import { getSessionUser } from "../services/sessionUser";
import TableSearchAndDownload from "../components/TableSearchAndDownload";
import "../styles/ProjectCostingSummary.css";

const getStatusHighlightClass = (status) => {
  if (status === "Item Accepted") return "stock-acceptance-modal__highlight--success";
  if (status === "Item Return") return "stock-acceptance-modal__highlight--danger";
  return "stock-acceptance-modal__highlight";
};

const formatSize = (row) => {
  const length = String(row?.length ?? "").trim();
  const width = String(row?.width ?? "").trim();
  const height = String(row?.height ?? "").trim();
  if (!length && !width && !height) return "-";
  return `${length || "0"} x ${width || "0"} x ${height || "0"}`;
};

function StockAcceptancePage() {
  const navigate = useNavigate();
  const currentUser = useMemo(() => getSessionUser(), []);
  const roleName = String(currentUser?.role || "").trim().toLowerCase();
  const isAdmin = roleName === "admin" || roleName === "super admin" || roleName === "staff";
  const currentUserId = String(currentUser?.id || "").trim();

   const [loading, setLoading] = useState(true);
   const [savingId, setSavingId] = useState("");
   const [status, setStatus] = useState({ type: "", message: "" });
   const [items, setItems] = useState([]);
   const [searchText, setSearchText] = useState("");
   const [columnFilters, setColumnFilters] = useState({});
   const [confirmModal, setConfirmModal] = useState({
    open: false,
    row: null,
    nextStatus: "",
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

   const mapRows = useCallback((rows = []) => (
     rows.map((row) => ({
       ...row,
       can_edit: isAdmin || String(row?.project_owner_id || "") === currentUserId,
     }))
   ), [currentUserId, isAdmin]);

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
     { key: "quotation_number", label: "Quotation Number" },
     { key: "project_code", label: "Project ID" },
     { key: "project_name", label: "Project Name" },
     { key: "item_category", label: "Item Category" },
     { key: "item_name", label: "Item Name" },
     { key: "item_code", label: "Item Code" },
     { key: "item_type", label: "Item Type" },
     { key: "purchase_qty", label: "Purchase Qty" },
     { key: "requested_qty", label: "Requested Qty" },
     { key: "size", label: "Size (L x W x H)", exportValue: formatSize },
     { key: "volume", label: "Volume" },
     { key: "retrieval_status", label: "Stock Status", exportValue: (row) => row?.retrieval_status?.status_name || "Stock Supplied" },
   ];

   const loadItems = useCallback(async () => {
    const data = await listStockAcceptanceItems();
    const rows = Array.isArray(data?.items) ? data.items : [];
    const filteredRows = isAdmin
      ? rows
      : rows.filter((row) => String(row?.project_owner_id || "") === currentUserId);
    setItems(mapRows(filteredRows));
  }, [currentUserId, isAdmin, mapRows]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    loadItems()
      .catch((error) => {
        if (!alive) return;
        setStatus({ type: "error", message: error.message || "Failed to load stock acceptance items." });
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [loadItems]);

  const onUpdateStatus = useCallback(async (row, nextStatus) => {
    if (!nextStatus) return;
    setConfirmModal({ open: true, row, nextStatus });
  }, []);

  const confirmStatusUpdate = useCallback(async () => {
    const { row, nextStatus } = confirmModal;
    if (!nextStatus) return;
    setSavingId(String(row.id));
    try {
      await updateStockAcceptanceItem(row.id, nextStatus);
      await loadItems();
      setStatus({ type: "", message: "" });
      setConfirmation({
        open: true,
        alertType: nextStatus === "No Action" ? "warning" : "success",
        message: nextStatus === "No Action" ? "Stock returned to vendor and moved back to No Action." : "Stock accepted successfully.",
        summary: buildSummary(row),
      });
      setConfirmModal({ open: false, row: null, nextStatus: "" });
    } catch (error) {
      setStatus({ type: "danger", message: error.message || "Failed to update stock acceptance status." });
      setConfirmModal({ open: false, row: null, nextStatus: "" });
    } finally {
      setSavingId("");
    }
  }, [buildSummary, confirmModal, loadItems]);

  const cancelStatusUpdate = useCallback(() => {
    setConfirmModal({ open: false, row: null, nextStatus: "" });
  }, []);

  const returnToList = useCallback(async () => {
    setLoading(true);
    setConfirmation({ open: false, alertType: "success", message: "", summary: null });
    navigate("/stock-acceptance", { replace: true });
    try {
      await loadItems();
    } catch (error) {
      setStatus({ type: "danger", message: error.message || "Failed to refresh stock acceptance items." });
    } finally {
      setLoading(false);
    }
  }, [loadItems, navigate]);

  return (
    <section className="module-page stock-acceptance-page">
      <div className="crud-page__header stock-acceptance-toolbar">
        <h1 className="module-page__title module-page__title--stock">Stock Acceptance</h1>
      </div>
      {confirmation.open ? (
        <ActionConfirmationPage
          title="Stock Acceptance Confirmation"
          alertType={confirmation.alertType}
          message={confirmation.message}
          summary={confirmation.summary || {}}
          onReturn={returnToList}
        />
      ) : null}
      {!confirmation.open ? <AlertMessage type={status.type} message={status.message} /> : null}
       {!confirmation.open && confirmModal.open && confirmModal.row ? (
         <div className="stock-acceptance-modal-backdrop" onClick={(event) => { if (event.target === event.currentTarget) cancelStatusUpdate(); }}>
           <div className="stock-acceptance-modal" role="dialog" aria-modal="true" aria-labelledby="stock-acceptance-confirm-title">
             <h3 id="stock-acceptance-confirm-title" className="stock-acceptance-modal__title">Confirm Status Update</h3>
             <div className="stock-acceptance-modal__content">
               <p><strong>Item:</strong> {confirmModal.row?.item_name || "-"}</p>
               <p><strong>Item Code:</strong> {confirmModal.row?.item_code || "-"}</p>
               <p><strong>Project:</strong> {confirmModal.row?.project_name || "-"}</p>
               <p><strong>Current Status:</strong> {confirmModal.row?.retrieval_status?.status_name || "Stock Supplied"}</p>
                <p><strong>New Status:</strong> <span className={getStatusHighlightClass(confirmModal.nextStatus === "No Action" ? "Item Return" : confirmModal.nextStatus)}>{confirmModal.nextStatus === "No Action" ? "No Action" : confirmModal.nextStatus}</span></p>
             </div>
             <div className="stock-acceptance-modal__actions">
               <button type="button" className="modal-btn modal-btn--cancel" onClick={cancelStatusUpdate} disabled={savingId === String(confirmModal.row?.id)}>
                 Cancel
               </button>
               <button type="button" className="modal-btn modal-btn--save" onClick={confirmStatusUpdate} disabled={savingId === String(confirmModal.row?.id)}>
                 {savingId === String(confirmModal.row?.id) ? "Updating..." : "Confirm Update"}
               </button>
             </div>
           </div>
         </div>
       ) : null}
       {!confirmation.open && !isAdmin ? <AlertMessage type="warning" message="Only your owned projects are visible here." /> : null}
       {!confirmation.open && loading ? <p className="users-status">Loading stock acceptance items...</p> : null}
       {!confirmation.open && !loading ? (
         <>
            <TableSearchAndDownload
              rows={filteredItems}
              columns={tableColumns}
              title="Stock Acceptance"
              onSearchChange={setSearchText}
              showDownloadButton={true}
            />
           <div className="users-table-wrap project-costing-table-wrap stock-acceptance-wrap">
          <table className="users-table project-costing-table project-costing-table--quotation stock-acceptance-table">
            <thead>
              <tr>
                <th>Quotation Number</th>
                <th>Project ID</th>
                <th>Project Name</th>
                <th>Item Category</th>
                <th>Item Name</th>
                <th>Item Code</th>
                <th>Item Type</th>
                <th className="project-costing-table__right">Purchase Qty</th>
                <th className="project-costing-table__right">Requested Qty</th>
                <th>Size (L x W x H)</th>
                <th className="project-costing-table__right">Volume</th>
                 <th>Stock Status</th>
                 <th>Update Status</th>
               </tr>
               <tr>
                 <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={columnFilters.quotation_number ?? ""} onChange={(e) => setColumnFilters(prev => ({ ...prev, quotation_number: e.target.value }))} /></th>
                 <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={columnFilters.project_code ?? ""} onChange={(e) => setColumnFilters(prev => ({ ...prev, project_code: e.target.value }))} /></th>
                 <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={columnFilters.project_name ?? ""} onChange={(e) => setColumnFilters(prev => ({ ...prev, project_name: e.target.value }))} /></th>
                 <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={columnFilters.item_category ?? ""} onChange={(e) => setColumnFilters(prev => ({ ...prev, item_category: e.target.value }))} /></th>
                 <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={columnFilters.item_name ?? ""} onChange={(e) => setColumnFilters(prev => ({ ...prev, item_name: e.target.value }))} /></th>
                 <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={columnFilters.item_code ?? ""} onChange={(e) => setColumnFilters(prev => ({ ...prev, item_code: e.target.value }))} /></th>
                 <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={columnFilters.item_type ?? ""} onChange={(e) => setColumnFilters(prev => ({ ...prev, item_type: e.target.value }))} /></th>
                 <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={columnFilters.purchase_qty ?? ""} onChange={(e) => setColumnFilters(prev => ({ ...prev, purchase_qty: e.target.value }))} /></th>
                 <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={columnFilters.requested_qty ?? ""} onChange={(e) => setColumnFilters(prev => ({ ...prev, requested_qty: e.target.value }))} /></th>
                 <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={columnFilters.size ?? ""} onChange={(e) => setColumnFilters(prev => ({ ...prev, size: e.target.value }))} /></th>
                 <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={columnFilters.volume ?? ""} onChange={(e) => setColumnFilters(prev => ({ ...prev, volume: e.target.value }))} /></th>
                 <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={columnFilters.retrieval_status ?? ""} onChange={(e) => setColumnFilters(prev => ({ ...prev, retrieval_status: e.target.value }))} /></th>
                 <th></th>
               </tr>
             </thead>
              <tbody>
                {filteredItems.length === 0 ? (
                 <tr>
                   <td colSpan={13} className="project-costing-empty">No stock supplied items found.</td>
                 </tr>
               ) : filteredItems.map((row) => (
                <tr key={row.id}>
                  <td>{row.quotation_number || "-"}</td>
                  <td>{row.project_code || "-"}</td>
                  <td>{row.project_name || "-"}</td>
                  <td>{row.item_category || "-"}</td>
                  <td>{row.item_name || "-"}</td>
                  <td>{row.item_code || "-"}</td>
                  <td>{row.item_type || "-"}</td>
                  <td className="project-costing-table__right">{row.purchase_qty}</td>
                  <td className="project-costing-table__right">{row.requested_qty}</td>
                  <td>{formatSize(row)}</td>
                  <td className="project-costing-table__right">{row.volume}</td>
                  <td>{row?.retrieval_status?.status_name || "Stock Supplied"}</td>
                  <td>
                    <div className="stock-acceptance-actions">
                      <button
                        type="button"
                        className="modal-btn modal-btn--save"
                        disabled={!row.can_edit || savingId === String(row.id)}
                        onClick={() => onUpdateStatus(row, "Item Accepted")}
                        title="Mark as Item Accepted"
                      >
                        ✓ Accept
                      </button>
                      <button
                        type="button"
                        className="modal-btn modal-btn--cancel"
                        disabled={!row.can_edit || savingId === String(row.id)}
                        onClick={() => onUpdateStatus(row, "No Action")}
                        title="Mark as No Action"
                      >
                        ↩ Return
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
           </table>
           </div>
         </>
       ) : null}
     </section>
   );
 }

 export default StockAcceptancePage;



