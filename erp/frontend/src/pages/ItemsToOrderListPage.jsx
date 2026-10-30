import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BsArrowLeft,
  BsCartCheck,
  BsClipboardData,
  BsBoxes,
  BsCheckCircleFill,
} from "react-icons/bs";
import { listItemsToOrder } from "../services/crudApi";
import { Card, CardHeader, CardBody } from "../components/Card";
import "../styles/ProjectQuotation.css";
import "../styles/ProjectCostingSummary.css";

const getStockBadgeClass = (statusName) => {
  const normalized = String(statusName || "").trim().toLowerCase();
  if (normalized === "in-stock") return "project-costing-stock-badge--in-stock";
  if (normalized === "partial stock") return "project-costing-stock-badge--partial";
  return "project-costing-stock-badge--no-stock";
};

const getStageBadgeStyle = (stage) => {
  if (String(stage).toLowerCase() === "costing") {
    return {
      background: "rgba(139, 92, 246, 0.12)",
      color: "#7c3aed",
      border: "1px solid rgba(139, 92, 246, 0.35)",
      fontWeight: 600,
      padding: "0.2rem 0.55rem",
      borderRadius: "999px",
      fontSize: "0.8rem",
      display: "inline-block",
    };
  }
  return {
    background: "rgba(2, 132, 199, 0.12)",
    color: "#0284c7",
    border: "1px solid rgba(2, 132, 199, 0.35)",
    fontWeight: 600,
    padding: "0.2rem 0.55rem",
    borderRadius: "999px",
    fontSize: "0.8rem",
    display: "inline-block",
  };
};

function ItemsToOrderListPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState({ type: "", message: "" });
  const [stageTab, setStageTab] = useState("all"); // "all" | "quotation" | "costing"
  const [columnFilters, setColumnFilters] = useState({});

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setStatus({ type: "", message: "" });
    try {
      const data = await listItemsToOrder();
      setItems(Array.isArray(data?.items) ? data.items : []);
      if (data?.message) {
        setStatus({ type: "success", message: data.message });
      }
    } catch (err) {
      setItems([]);
      setStatus({ type: "error", message: err.message || "Failed to load items to order." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const filteredItems = useMemo(() => {
    return items.filter((row) => {
      // Stage tab filter
      if (stageTab !== "all" && String(row.stage).toLowerCase() !== stageTab) {
        return false;
      }

      // Column filters
      const activeFilters = Object.entries(columnFilters).filter(([, val]) => String(val || "").trim());
      return activeFilters.every(([key, filterVal]) => {
        const rowVal = String(row[key] ?? "").toLowerCase();
        return rowVal.includes(String(filterVal).trim().toLowerCase());
      });
    });
  }, [columnFilters, items, stageTab]);

  const stats = useMemo(() => {
    const totalItems = items.length;
    const quotationItems = items.filter((i) => String(i.stage).toLowerCase() === "quotation").length;
    const costingItems = items.filter((i) => String(i.stage).toLowerCase() === "costing").length;
    const totalOrderQty = items.reduce((sum, i) => sum + (Number(i.order_qty) || 0), 0);
    return { totalItems, quotationItems, costingItems, totalOrderQty };
  }, [items]);

  return (
    <section className="module-page project-costing-page">
      {/* Top Header */}
      <div className="crud-page__header pq-header project-costing-toolbar">
        <div>
          <h1 className="module-page__title project-costing-title">
            <span className="project-costing-title__icon" aria-hidden="true"><BsCartCheck /></span>
            <span className="project-costing-title__text">Items to Order</span>
          </h1>
        </div>
        <div className="pq-header-actions">
          <button
            type="button"
            className="crud-add-btn"
            onClick={() => navigate("/stocks")}
          >
            <BsArrowLeft aria-hidden="true" /> Back to Stocks
          </button>
        </div>
      </div>

      {status.message ? (
        <p className={`users-status users-status--${status.type}`}>{status.message}</p>
      ) : null}

      {/* Summary Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem", marginBottom: "1rem" }}>
        <div className="project-costing-card" style={{ padding: "1rem", borderLeft: "4px solid #0284c7" }}>
          <div style={{ fontSize: "0.85rem", color: "#64748b", fontWeight: 600 }}>TOTAL ITEMS TO ORDER</div>
          <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "#0f172a", marginTop: "0.25rem" }}>
            {stats.totalItems}
          </div>
          <div style={{ fontSize: "0.8rem", color: "#64748b", marginTop: "0.25rem" }}>
            {stats.totalOrderQty.toFixed(2)} units needed
          </div>
        </div>

        <div className="project-costing-card" style={{ padding: "1rem", borderLeft: "4px solid #0ea5e9" }}>
          <div style={{ fontSize: "0.85rem", color: "#64748b", fontWeight: 600 }}>FROM QUOTATION STAGE</div>
          <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "#0284c7", marginTop: "0.25rem" }}>
            {stats.quotationItems}
          </div>
          <div style={{ fontSize: "0.8rem", color: "#64748b", marginTop: "0.25rem" }}>Completed quotations</div>
        </div>

        <div className="project-costing-card" style={{ padding: "1rem", borderLeft: "4px solid #8b5cf6" }}>
          <div style={{ fontSize: "0.85rem", color: "#64748b", fontWeight: 600 }}>FROM COSTING STAGE</div>
          <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "#7c3aed", marginTop: "0.25rem" }}>
            {stats.costingItems}
          </div>
          <div style={{ fontSize: "0.8rem", color: "#64748b", marginTop: "0.25rem" }}>Completed costings</div>
        </div>
      </div>

      {/* Main Card */}
      <Card className="lca-card mb-3 pq-card">
        <CardHeader className="pq-card-header">
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
            <h2 style={{ margin: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <BsBoxes aria-hidden="true" />
              Pending Purchase Requirements
            </h2>
            <span className="vendor-card__badge" style={{ marginLeft: "0.5rem" }}>
              {filteredItems.length} {filteredItems.length === 1 ? "Record" : "Records"}
            </span>
          </div>

          {/* Stage Filter Buttons */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <button
              type="button"
              className={`crud-add-btn ${stageTab === "all" ? "" : "modal-btn--cancel"}`}
              style={{ padding: "0.35rem 0.75rem", fontSize: "0.85rem" }}
              onClick={() => setStageTab("all")}
            >
              All Stages ({stats.totalItems})
            </button>
            <button
              type="button"
              className={`crud-add-btn ${stageTab === "quotation" ? "" : "modal-btn--cancel"}`}
              style={{ padding: "0.35rem 0.75rem", fontSize: "0.85rem" }}
              onClick={() => setStageTab("quotation")}
            >
              Quotation ({stats.quotationItems})
            </button>
            <button
              type="button"
              className={`crud-add-btn ${stageTab === "costing" ? "" : "modal-btn--cancel"}`}
              style={{ padding: "0.35rem 0.75rem", fontSize: "0.85rem" }}
              onClick={() => setStageTab("costing")}
            >
              Costing ({stats.costingItems})
            </button>
          </div>
        </CardHeader>

        <CardBody className="pq-card-body">
          {loading ? (
            <p className="project-costing-popup project-costing-popup--warning">Loading items to order...</p>
          ) : (
            <div className="users-table-wrap pq-table-wrap-list project-costing-table-wrap">
              <table className="users-table project-costing-table">
                <thead>
                  <tr>
                    <th>Stage</th>
                    <th>Reference #</th>
                    <th>Project ID</th>
                    <th>Project Name</th>
                    <th>Item Category</th>
                    <th>Item Name</th>
                    <th>Item Code</th>
                    <th>Item Type</th>
                    <th className="project-costing-table__right">Requested Qty</th>
                    <th className="project-costing-table__right">Available Qty</th>
                    <th className="project-costing-table__right" style={{ color: "#b91c1c" }}>To Order Qty</th>
                    <th>Stock Status</th>
                    <th>Requested By</th>
                    <th>Requested Date</th>
                    <th>Updated By</th>
                    <th>Updated On</th>
                  </tr>
                  <tr>
                    <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={columnFilters.stage ?? ""} onChange={(e) => setColumnFilters((prev) => ({ ...prev, stage: e.target.value }))} /></th>
                    <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={columnFilters.reference_number ?? ""} onChange={(e) => setColumnFilters((prev) => ({ ...prev, reference_number: e.target.value }))} /></th>
                    <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={columnFilters.project_id ?? ""} onChange={(e) => setColumnFilters((prev) => ({ ...prev, project_id: e.target.value }))} /></th>
                    <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={columnFilters.project_name ?? ""} onChange={(e) => setColumnFilters((prev) => ({ ...prev, project_name: e.target.value }))} /></th>
                    <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={columnFilters.item_category ?? ""} onChange={(e) => setColumnFilters((prev) => ({ ...prev, item_category: e.target.value }))} /></th>
                    <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={columnFilters.item_name ?? ""} onChange={(e) => setColumnFilters((prev) => ({ ...prev, item_name: e.target.value }))} /></th>
                    <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={columnFilters.item_code ?? ""} onChange={(e) => setColumnFilters((prev) => ({ ...prev, item_code: e.target.value }))} /></th>
                    <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={columnFilters.item_type ?? ""} onChange={(e) => setColumnFilters((prev) => ({ ...prev, item_type: e.target.value }))} /></th>
                    <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={columnFilters.requested_qty ?? ""} onChange={(e) => setColumnFilters((prev) => ({ ...prev, requested_qty: e.target.value }))} /></th>
                    <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={columnFilters.purchase_qty ?? ""} onChange={(e) => setColumnFilters((prev) => ({ ...prev, purchase_qty: e.target.value }))} /></th>
                    <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={columnFilters.order_qty ?? ""} onChange={(e) => setColumnFilters((prev) => ({ ...prev, order_qty: e.target.value }))} /></th>
                    <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={columnFilters.stock_status ?? ""} onChange={(e) => setColumnFilters((prev) => ({ ...prev, stock_status: e.target.value }))} /></th>
                    <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={columnFilters.requested_by ?? ""} onChange={(e) => setColumnFilters((prev) => ({ ...prev, requested_by: e.target.value }))} /></th>
                    <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={columnFilters.requested_date ?? ""} onChange={(e) => setColumnFilters((prev) => ({ ...prev, requested_date: e.target.value }))} /></th>
                    <th></th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={16} className="project-costing-empty">
                        No missing stock items found. All requested quantities are covered by current stock.
                      </td>
                    </tr>
                  ) : filteredItems.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <span style={getStageBadgeStyle(row.stage)}>
                          {row.stage}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600 }}>{row.reference_number}</td>
                      <td>{row.project_id}</td>
                      <td>{row.project_name}</td>
                      <td>{row.item_category}</td>
                      <td>{row.item_name}</td>
                      <td>{row.item_code}</td>
                      <td>{row.item_type}</td>
                      <td className="project-costing-table__right">{row.requested_qty}</td>
                      <td className="project-costing-table__right">{row.purchase_qty}</td>
                      <td className="project-costing-table__right" style={{ fontWeight: 700, color: "#dc2626" }}>
                        {row.order_qty}
                      </td>
                      <td>
                        <span className={`project-costing-stock-badge ${getStockBadgeClass(row.stock_status)}`}>
                          {row.stock_status}
                        </span>
                      </td>
                      <td>{row.requested_by}</td>
                      <td>{row.requested_date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </section>
  );
}

export default ItemsToOrderListPage;
