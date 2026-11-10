import { useEffect, useMemo, useState } from "react";

import { listStockPlanningItems } from "../services/crudApi";

const getBadgeStyle = (statusName) => {
  const normalized = String(statusName || "").trim().toLowerCase();
  if (normalized === "partial stock") {
    return { background: "rgba(255, 193, 7, 0.15)", color: "#b26a00", border: "1px solid rgba(255, 193, 7, 0.45)" };
  }
  if (normalized === "no stock") {
    return { background: "rgba(239, 68, 68, 0.12)", color: "#b91c1c", border: "1px solid rgba(239, 68, 68, 0.35)" };
  }
  return { background: "rgba(100, 116, 139, 0.14)", color: "#475569", border: "1px solid rgba(100, 116, 139, 0.35)" };
};

function StockPlanningPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState({ type: "", message: "" });
  const [columnFilters, setColumnFilters] = useState({});

  useEffect(() => {
    let alive = true;
    listStockPlanningItems()
      .then((data) => {
        if (!alive) return;
        setRows(Array.isArray(data.items) ? data.items : []);
        setStatus({ type: "success", message: data.message || "Stock planning items loaded successfully." });
      })
      .catch((error) => {
        if (!alive) return;
        setRows([]);
        setStatus({ type: "error", message: error.message || "Failed to load stock planning items." });
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  const totals = useMemo(() => {
    const count = rows.length;
    const requestedQty = rows.reduce((acc, row) => acc + Number(row.requested_qty || 0), 0);
    return { count, requestedQty };
  }, [rows]);

  const filteredRows = useMemo(() => {
    const activeFilters = Object.entries(columnFilters).filter(([, val]) => String(val || "").trim());
    if (!activeFilters.length) return rows;
    return rows.filter((row) =>
      activeFilters.every(([key, filterVal]) => {
        const val = key === "updated_on"
          ? (row.updated_on || (row.updated_at ? new Date(row.updated_at).toLocaleString() : ""))
          : row[key];
        return String(val ?? "").toLowerCase().includes(String(filterVal).trim().toLowerCase());
      })
    );
  }, [rows, columnFilters]);

  return (
    <section className="module-page">
      <div className="crud-page__header" style={{ marginBottom: "0.8rem" }}>
        <div>
          <h1 className="module-page__title module-page__title--stock" style={{ margin: 0 }}>Stock Planning</h1>
          <p className="module-page__description" style={{ marginBottom: 0 }}>
            Quotation items where stock status is not In-Stock.
          </p>
        </div>
      </div>

      <div style={{ display: "flex", gap: "1rem", marginBottom: "0.8rem", color: "#475569", fontSize: "0.92rem" }}>
        <span><strong>Pending Items:</strong> {totals.count}</span>
        <span><strong>Total Requested Qty:</strong> {totals.requestedQty.toFixed(2)}</span>
      </div>

      {status.message ? (
        <p className={`users-status${status.type ? ` users-status--${status.type}` : ""}`}>
          {status.message}
        </p>
      ) : null}

      {loading ? <p className="users-status">Loading stock planning items...</p> : null}

      {!loading ? (
        <div className="users-table-wrap" style={{ overflowX: "auto" }}>
          <table className="users-table" style={{ tableLayout: "auto", width: "max-content", minWidth: "100%" }}>
            <thead>
              <tr>
                <th>Quotation Number</th>
                <th>Project ID</th>
                <th>Project Name</th>
                <th>Item Category</th>
                <th>Item Name</th>
                <th>Item Code</th>
                <th>Item Type</th>
                <th>Purchase Qty</th>
                <th>Requested Qty</th>
                <th>Stock Status</th>
                <th>Length</th>
                <th>Width</th>
                <th>Height</th>
                <th>Volume</th>
                <th>Updated By</th>
                <th>Updated On</th>
              </tr>
              <tr>
                <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={columnFilters.quotation_number ?? ""} onChange={(e) => setColumnFilters((prev) => ({ ...prev, quotation_number: e.target.value }))} /></th>
                <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={columnFilters.project_id ?? ""} onChange={(e) => setColumnFilters((prev) => ({ ...prev, project_id: e.target.value }))} /></th>
                <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={columnFilters.project_name ?? ""} onChange={(e) => setColumnFilters((prev) => ({ ...prev, project_name: e.target.value }))} /></th>
                <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={columnFilters.item_category ?? ""} onChange={(e) => setColumnFilters((prev) => ({ ...prev, item_category: e.target.value }))} /></th>
                <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={columnFilters.item_name ?? ""} onChange={(e) => setColumnFilters((prev) => ({ ...prev, item_name: e.target.value }))} /></th>
                <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={columnFilters.item_code ?? ""} onChange={(e) => setColumnFilters((prev) => ({ ...prev, item_code: e.target.value }))} /></th>
                <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={columnFilters.item_type ?? ""} onChange={(e) => setColumnFilters((prev) => ({ ...prev, item_type: e.target.value }))} /></th>
                <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={columnFilters.purchase_qty ?? ""} onChange={(e) => setColumnFilters((prev) => ({ ...prev, purchase_qty: e.target.value }))} /></th>
                <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={columnFilters.requested_qty ?? ""} onChange={(e) => setColumnFilters((prev) => ({ ...prev, requested_qty: e.target.value }))} /></th>
                <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={columnFilters.stock_status_name ?? ""} onChange={(e) => setColumnFilters((prev) => ({ ...prev, stock_status_name: e.target.value }))} /></th>
                <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={columnFilters.length ?? ""} onChange={(e) => setColumnFilters((prev) => ({ ...prev, length: e.target.value }))} /></th>
                <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={columnFilters.width ?? ""} onChange={(e) => setColumnFilters((prev) => ({ ...prev, width: e.target.value }))} /></th>
                <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={columnFilters.height ?? ""} onChange={(e) => setColumnFilters((prev) => ({ ...prev, height: e.target.value }))} /></th>
                <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={columnFilters.volume ?? ""} onChange={(e) => setColumnFilters((prev) => ({ ...prev, volume: e.target.value }))} /></th>
                <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={columnFilters.updated_by ?? ""} onChange={(e) => setColumnFilters((prev) => ({ ...prev, updated_by: e.target.value }))} /></th>
                <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={columnFilters.updated_on ?? ""} onChange={(e) => setColumnFilters((prev) => ({ ...prev, updated_on: e.target.value }))} /></th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={16} style={{ textAlign: "center", color: "#64748b", padding: "1rem" }}>
                    No stock planning items.
                  </td>
                </tr>
              ) : filteredRows.map((row) => (
                <tr key={row.id}>
                  <td>{row.quotation_number || "-"}</td>
                  <td>{row.project_id || "-"}</td>
                  <td>{row.project_name || "-"}</td>
                  <td>{row.item_category || "-"}</td>
                  <td>{row.item_name || "-"}</td>
                  <td>{row.item_code || "-"}</td>
                  <td>{row.item_type || "-"}</td>
                  <td style={{ textAlign: "right" }}>{row.purchase_qty}</td>
                  <td style={{ textAlign: "right" }}>{row.requested_qty}</td>
                  <td>
                    <span
                      style={{
                        ...getBadgeStyle(row.stock_status_name),
                        display: "inline-flex",
                        alignItems: "center",
                        minHeight: "30px",
                        padding: "0.2rem 0.55rem",
                        borderRadius: "999px",
                        fontSize: "0.8rem",
                        fontWeight: 600,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {row.stock_status_name || "-"}
                    </span>
                  </td>
                  <td style={{ textAlign: "right" }}>{row.length}</td>
                  <td style={{ textAlign: "right" }}>{row.width}</td>
                  <td style={{ textAlign: "right" }}>{row.height}</td>
                  <td style={{ textAlign: "right" }}>{row.volume}</td>
                  <td>{row.updated_by || "—"}</td>
                  <td>{row.updated_on || (row.updated_at ? new Date(row.updated_at).toLocaleString() : "—")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

export default StockPlanningPage;

