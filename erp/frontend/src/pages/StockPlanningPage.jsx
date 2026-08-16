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

  return (
    <section className="module-page">
      <div className="crud-page__header" style={{ marginBottom: "0.8rem" }}>
        <div>
          <h1 className="module-page__title" style={{ margin: 0 }}>Stock Planning</h1>
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
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={14} style={{ textAlign: "center", color: "#64748b", padding: "1rem" }}>
                    No stock planning items.
                  </td>
                </tr>
              ) : rows.map((row) => (
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

