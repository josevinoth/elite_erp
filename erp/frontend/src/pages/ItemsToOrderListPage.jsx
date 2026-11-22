import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BsArrowLeft,
  BsArrowRight,
  BsCartCheck,
  BsCartPlus,
  BsBoxes,
  BsClipboardData,
  BsCheckCircleFill,
} from "react-icons/bs";
import { listItemsToOrder } from "../services/crudApi";
import { Card, CardHeader, CardBody } from "../components/Card";
import PlaceOrderModal from "../components/PlaceOrderModal";
import TotalReqdProjectsModal from "../components/TotalReqdProjectsModal";
import "../styles/ProjectQuotation.css";
import "../styles/ProjectCostingSummary.css";

const getStockBadgeClass = (statusName) => {
  const normalized = String(statusName || "").trim().toLowerCase();
  if (normalized === "in-stock") return "project-costing-stock-badge--in-stock";
  if (normalized === "partial stock" || normalized === "partially ordered") return "project-costing-stock-badge--partial";
  return "project-costing-stock-badge--no-stock";
};

function ItemsToOrderListPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState({ type: "", message: "" });
  const [columnFilters, setColumnFilters] = useState({});
  const [selectedItemIds, setSelectedItemIds] = useState(new Set());
  const [isPlaceOrderModalOpen, setIsPlaceOrderModalOpen] = useState(false);
  const [selectedRequestedItem, setSelectedRequestedItem] = useState(null);

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
      // Column filters
      const activeFilters = Object.entries(columnFilters).filter(([, val]) => String(val || "").trim());
      return activeFilters.every(([key, filterVal]) => {
        const needle = String(filterVal).trim().toLowerCase();
        if (key === "project_or_ref") {
          const combined = `${row.reference_number || ""} ${row.combined_project || ""} ${row.project_id || ""} ${row.project_name || ""}`.toLowerCase();
          return combined.includes(needle);
        }
        if (key === "combined_project") {
          const combined = (row.combined_project || `${row.project_id ?? ""} _ ${row.project_name ?? ""}`).toLowerCase();
          return combined.includes(needle);
        }
        if (key === "combined_item") {
          const combined = (row.combined_item || row.combined_label || `${row.item_code ?? ""} _ ${row.item_category ?? ""} _ ${row.item_name ?? ""}`).toLowerCase();
          return combined.includes(needle);
        }
        const rowVal = String(row[key] ?? "").toLowerCase();
        return rowVal.includes(needle);
      });
    });
  }, [columnFilters, items]);

  const stats = useMemo(() => {
    const totalItems = items.length;
    const totalOrderQty = items.reduce((sum, i) => sum + (Number(i.order_qty) || 0), 0);
    const totalRequestedQty = items.reduce((sum, i) => sum + (Number(i.requested_qty) || 0), 0);
    return { totalItems, totalOrderQty, totalRequestedQty };
  }, [items]);

  // Checkbox Selection
  const allFilteredSelected = useMemo(() => {
    if (filteredItems.length === 0) return false;
    return filteredItems.every((row) => selectedItemIds.has(row.id));
  }, [filteredItems, selectedItemIds]);

  const someFilteredSelected = useMemo(() => {
    if (filteredItems.length === 0) return false;
    return filteredItems.some((row) => selectedItemIds.has(row.id)) && !allFilteredSelected;
  }, [filteredItems, selectedItemIds, allFilteredSelected]);

  const toggleSelectAll = () => {
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        filteredItems.forEach((row) => next.delete(row.id));
      } else {
        filteredItems.forEach((row) => next.add(row.id));
      }
      return next;
    });
  };

  const toggleSelectRow = (id) => {
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

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
        <div className="pq-header-actions" style={{ display: "flex", gap: "0.5rem" }}>
          <button
            type="button"
            className="crud-add-btn"
            style={{ background: "#475569" }}
            onClick={() => navigate("/stock-purchase/place-order")}
          >
            View Procurement Orders <BsArrowRight aria-hidden="true" />
          </button>
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
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: "0.75rem", marginBottom: "0.75rem" }}>
        <div className="project-costing-card" style={{ padding: "0.55rem 0.85rem", borderLeft: "3.5px solid #0284c7", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: "0.7rem", color: "#64748b", fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase" }}>TOTAL ITEMS TO ORDER</div>
            <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.15rem" }}>
              <span style={{ fontWeight: 600, color: "#0f172a" }}>{stats.totalOrderQty.toFixed(2)}</span> units needed
            </div>
          </div>
          <div style={{ fontSize: "1.35rem", fontWeight: 700, color: "#0f172a", lineHeight: 1 }}>
            {stats.totalItems}
          </div>
        </div>

        <div className="project-costing-card" style={{ padding: "0.55rem 0.85rem", borderLeft: "3.5px solid #dc2626", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: "0.7rem", color: "#64748b", fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase" }}>TOTAL ORDER QUANTITY</div>
            <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.15rem" }}>Units to purchase</div>
          </div>
          <div style={{ fontSize: "1.35rem", fontWeight: 700, color: "#dc2626", lineHeight: 1 }}>
            {stats.totalOrderQty.toFixed(2)}
          </div>
        </div>

        <div className="project-costing-card" style={{ padding: "0.55rem 0.85rem", borderLeft: "3.5px solid #8b5cf6", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: "0.7rem", color: "#64748b", fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase" }}>TOTAL REQUESTED QTY</div>
            <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.15rem" }}>Units requested in Costing</div>
          </div>
          <div style={{ fontSize: "1.35rem", fontWeight: 700, color: "#7c3aed", lineHeight: 1 }}>
            {stats.totalRequestedQty.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Main Card */}
      <Card className="lca-card mb-3 pq-card">
        <CardHeader className="pq-card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.75rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
            <h2 style={{ margin: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <BsBoxes aria-hidden="true" />
              Pending Purchase Requirements
            </h2>
            <span className="vendor-card__badge">
              {filteredItems.length} {filteredItems.length === 1 ? "Record" : "Records"}
            </span>
            {selectedItemIds.size > 0 && (
              <span className="vendor-card__badge" style={{ background: "#dbeafe", color: "#1d4ed8", border: "1px solid #93c5fd" }}>
                {selectedItemIds.size} Selected
              </span>
            )}
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
                    <th>Projects & Ref #</th>
                    <th>Item (Code _ Category _ Name)</th>
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
                    <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={columnFilters.project_or_ref ?? ""} onChange={(e) => setColumnFilters((prev) => ({ ...prev, project_or_ref: e.target.value }))} /></th>
                    <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={columnFilters.combined_item ?? ""} onChange={(e) => setColumnFilters((prev) => ({ ...prev, combined_item: e.target.value }))} /></th>
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
                      <td colSpan={11} className="project-costing-empty">
                        No missing stock items found. All requested quantities are covered by current stock.
                      </td>
                    </tr>
                  ) : filteredItems.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <button
                          type="button"
                          onClick={() => setSelectedRequestedItem(row)}
                          style={{
                            background: "#e0f2fe",
                            color: "#0284c7",
                            border: "1px solid #7dd3fc",
                            borderRadius: "6px",
                            padding: "3px 10px",
                            fontWeight: 600,
                            cursor: "pointer",
                            fontSize: "0.8rem",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "5px",
                            whiteSpace: "nowrap",
                            transition: "all 0.15s ease",
                          }}
                          title="View project requirements & reference numbers"
                        >
                          <span>{row.requests_count ? `${row.requests_count} Projects` : "View Projects"}</span>
                          <span style={{ fontSize: "0.75rem" }}>📋</span>
                        </button>
                      </td>
                      <td style={{ fontWeight: 600, color: "#0f172a" }}>
                        {row.combined_item || row.combined_label || [row.item_code, row.item_category, row.item_name].filter(Boolean).join(" _ ") || "—"}
                      </td>
                      <td>{row.item_type || "—"}</td>
                      <td className="project-costing-table__right">
                        <button
                          type="button"
                          onClick={() => setSelectedRequestedItem(row)}
                          style={{
                            background: "#e0f2fe",
                            color: "#0284c7",
                            border: "1px solid #7dd3fc",
                            borderRadius: "6px",
                            padding: "2px 8px",
                            fontWeight: 700,
                            cursor: "pointer",
                            fontSize: "0.82rem",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                            transition: "all 0.15s ease",
                          }}
                          title={`View projects requesting ${row.item_code} (${row.requested_qty})`}
                        >
                          <span>{row.requested_qty ?? "—"}</span>
                          <span style={{ fontSize: "0.75rem", opacity: 0.85 }}>📋</span>
                        </button>
                      </td>
                      <td className="project-costing-table__right">{row.purchase_qty ?? "—"}</td>
                      <td className="project-costing-table__right" style={{ fontWeight: 700, color: "#dc2626" }}>
                        {row.order_qty ?? "—"}
                      </td>
                      <td>
                        <span className={`project-costing-stock-badge ${getStockBadgeClass(row.stock_status)}`}>
                          {row.stock_status || "—"}
                        </span>
                      </td>
                      <td>{row.requested_by || "—"}</td>
                      <td>{row.requested_date || "—"}</td>
                      <td>{row.updated_by || "—"}</td>
                      <td>{row.updated_on || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Place Order Modal */}
      <PlaceOrderModal
        isOpen={isPlaceOrderModalOpen}
        onClose={() => setIsPlaceOrderModalOpen(false)}
        initialItems={items.filter((i) => selectedItemIds.has(i.id))}
        allItems={items}
        onSuccess={() => {
          fetchItems();
          setSelectedItemIds(new Set());
        }}
      />

      {/* Project Requirements & References Modal */}
      {selectedRequestedItem && (
        <TotalReqdProjectsModal
          item={selectedRequestedItem}
          onClose={() => setSelectedRequestedItem(null)}
        />
      )}
    </section>
  );
}

export default ItemsToOrderListPage;
