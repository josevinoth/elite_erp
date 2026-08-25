import { useCallback, useEffect, useMemo, useState } from "react";
import { listStockRetrievalItems, updateStockRetrievalItem } from "../services/crudApi";
import { getSessionUser } from "../services/sessionUser";
import "../styles/StockRetrieval.css";
const RETRIEVAL_OPTIONS = ["Item Supplied", "Item Accepted", "Item Return"];
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
  const canEdit = isAdmin || ["stock team", "stock", "stores team"].includes(teamName);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [status, setStatus] = useState({ type: "", message: "" });
  const [items, setItems] = useState([]);

  const isNotPurchased = useCallback((row) => (
    String(row?.stock_status?.status_name || "").trim().toLowerCase() === "not purchased"
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
  const updateStatus = useCallback(async (itemId, retrievalStatusName) => {
    setSavingId(String(itemId));
    try {
      const response = await updateStockRetrievalItem(itemId, retrievalStatusName);
      const updatedItem = response?.item || null;
      setItems((prev) => {
        const next = prev
          .map((row) => (row.id === itemId ? { ...row, ...updatedItem } : row))
          .filter((row) => row?.retrieval_status?.status_name === "Item Requested");
        return next;
      });
      setStatus({ type: "success", message: "Retrieval status updated." });
    } catch (error) {
      setStatus({ type: "error", message: error.message || "Failed to update retrieval status." });
    } finally {
      setSavingId("");
    }
  }, []);
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
                <th>Item Category</th>
                <th>Item Name</th>
                <th>Item Code</th>
                <th>Item Type</th>
                <th>Stock Status</th>
                <th>Purchase Qty</th>
                <th>Requested Qty</th>
                <th className="stock-retrieval-table__right">L</th>
                <th className="stock-retrieval-table__right">W</th>
                <th className="stock-retrieval-table__right">H</th>
                <th className="stock-retrieval-table__right">Volume</th>
                <th>Retrieval Status</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={12} className="stock-retrieval-empty">No retrieval items found.</td>
                </tr>
              ) : items.map((row) => (
                <tr key={row.id}>
                  <td>{row?.costing_id || "-"}</td>
                  <td>{row.item_category || "-"}</td>
                  <td>{row.item_name || "-"}</td>
                  <td>{row.item_code || "-"}</td>
                  <td>{row.item_type || "-"}</td>
                  <td>{row?.stock_status?.status_name || "-"}</td>
                  <td className="stock-retrieval-table__right">{row.purchase_qty}</td>
                  <td className="stock-retrieval-table__right">{row.requested_qty}</td>
                  <td className="stock-retrieval-table__right">{row.length}</td>
                  <td className="stock-retrieval-table__right">{row.width}</td>
                  <td className="stock-retrieval-table__right">{row.height}</td>
                  <td className="stock-retrieval-table__right">{row.volume}</td>
                  <td>
                    <select
                      className="auth-input"
                      value={row?.retrieval_status?.status_name || "Item Requested"}
                      disabled={!canEdit || savingId === String(row.id) || isNotPurchased(row)}
                      onChange={(event) => updateStatus(row.id, event.target.value)}
                    >
                      <option value="Item Requested">Item Requested</option>
                      {RETRIEVAL_OPTIONS.map((option) => (
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
export default StockRetrievalPage;
