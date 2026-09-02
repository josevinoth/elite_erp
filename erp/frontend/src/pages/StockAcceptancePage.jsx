import { useCallback, useEffect, useMemo, useState } from "react";
import { listStockAcceptanceItems, updateStockAcceptanceItem } from "../services/crudApi";
import { getSessionUser } from "../services/sessionUser";
import "../styles/ProjectCostingSummary.css";

const EDIT_OPTIONS = ["Stock Accepted", "Stock Returned"];

const getPopupClassName = (type) => {
  if (type === "error") return "popup-error";
  if (type === "warning") return "popup-warning";
  return "popup-success";
};

const formatSize = (row) => {
  const length = String(row?.length ?? "").trim();
  const width = String(row?.width ?? "").trim();
  const height = String(row?.height ?? "").trim();
  if (!length && !width && !height) return "-";
  return `${length || "0"} x ${width || "0"} x ${height || "0"}`;
};

function StockAcceptancePage() {
  const currentUser = useMemo(() => getSessionUser(), []);
  const roleName = String(currentUser?.role || "").trim().toLowerCase();
  const isAdmin = roleName === "admin" || roleName === "super admin" || roleName === "staff";
  const currentUserId = String(currentUser?.id || "").trim();

  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [status, setStatus] = useState({ type: "", message: "" });
  const [items, setItems] = useState([]);

  const mapRows = useCallback((rows = []) => (
    rows.map((row) => ({
      ...row,
      can_edit: isAdmin || String(row?.project_owner_id || "") === currentUserId,
    }))
  ), [currentUserId, isAdmin]);

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
    setSavingId(String(row.id));
    try {
      await updateStockAcceptanceItem(row.id, nextStatus);
      setItems((prev) => prev.filter((item) => item.id !== row.id));
      setStatus({ type: "success", message: "Stock acceptance status updated." });
    } catch (error) {
      setStatus({ type: "error", message: error.message || "Failed to update stock acceptance status." });
    } finally {
      setSavingId("");
    }
  }, []);

  return (
    <section className="module-page stock-acceptance-page">
      <div className="crud-page__header stock-acceptance-toolbar">
        <h1 className="module-page__title">Stock Acceptance</h1>
      </div>
      {status.message ? (
        <p className={`users-status stock-acceptance-status ${getPopupClassName(status.type)}`}>{status.message}</p>
      ) : null}
      {!isAdmin ? (
        <p className="users-status popup-warning stock-acceptance-status">Only your owned projects are visible here.</p>
      ) : null}
      {loading ? <p className="users-status">Loading stock acceptance items...</p> : null}
      {!loading ? (
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
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={13} className="project-costing-empty">No stock supplied items found.</td>
                </tr>
              ) : items.map((row) => (
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
                    <select
                      className="auth-input"
                      value=""
                      disabled={!row.can_edit || savingId === String(row.id)}
                      onChange={(event) => onUpdateStatus(row, event.target.value)}
                    >
                      <option value="">Select status</option>
                      {EDIT_OPTIONS.map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
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

export default StockAcceptancePage;


