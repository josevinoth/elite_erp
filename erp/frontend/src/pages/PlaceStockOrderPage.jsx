import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BsCartCheck,
  BsCartPlus,
  BsEye,
  BsX,
  BsBuilding,
  BsFileEarmarkText,
  BsArrowLeft,
  BsPerson,
  BsTelephone,
  BsEnvelope,
  BsGeoAlt,
  BsArrowDown,
  BsArrowUp,
  BsArrowDownUp,
  BsExclamationTriangleFill,
  BsXCircle,
} from "react-icons/bs";
import {
  listPlacedStockOrders,
  getPlacedStockOrderDetail,
  cancelPlacedStockOrder,
} from "../services/crudApi";
import { Card, CardHeader, CardBody } from "../components/Card";
import PlaceOrderModal from "../components/PlaceOrderModal";
import "../styles/PlaceStockOrder.css";
import "../styles/ProjectQuotation.css";
import "../styles/ProjectCostingSummary.css";

export default function PlaceStockOrderPage() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState({ type: "", message: "" });
  const [search, setSearch] = useState("");
  const [columnFilters, setColumnFilters] = useState({});
  const [isPlaceOrderModalOpen, setIsPlaceOrderModalOpen] = useState(false);

  // Detail Modal State
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [detailOrder, setDetailOrder] = useState(null);
  const [detailItems, setDetailItems] = useState([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState("");

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setStatus({ type: "", message: "" });
    try {
      const data = await listPlacedStockOrders();
      setOrders(Array.isArray(data?.orders) ? data.orders : []);
    } catch (err) {
      setOrders([]);
      setStatus({ type: "error", message: err.message || "Failed to load placed stock orders." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Open detail modal and fetch detail items
  const handleViewDetail = async (orderId) => {
    setSelectedOrderId(orderId);
    setLoadingDetail(true);
    setDetailError("");
    setDetailOrder(null);
    setDetailItems([]);
    try {
      const res = await getPlacedStockOrderDetail(orderId);
      setDetailOrder(res?.order || null);
      setDetailItems(Array.isArray(res?.items) ? res.items : []);
    } catch (err) {
      setDetailError(err?.message || "Failed to load purchase order details.");
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleCloseDetail = () => {
    setSelectedOrderId(null);
    setDetailOrder(null);
    setDetailItems([]);
    setDetailError("");
  };

  // Confirmation Modal State for PO Cancel
  const [confirmCancelModal, setConfirmCancelModal] = useState({
    open: false,
    orderId: null,
    poNumber: "",
    loading: false,
  });

  const promptCancelOrder = (orderId, poNumber) => {
    setConfirmCancelModal({
      open: true,
      orderId,
      poNumber: poNumber || "",
      loading: false,
    });
  };

  const handleCloseConfirmCancel = () => {
    if (confirmCancelModal.loading) return;
    setConfirmCancelModal({ open: false, orderId: null, poNumber: "", loading: false });
  };

  const handleConfirmCancel = async () => {
    if (!confirmCancelModal.orderId) return;
    setConfirmCancelModal((prev) => ({ ...prev, loading: true }));
    try {
      await cancelPlacedStockOrder(confirmCancelModal.orderId);
      setStatus({
        type: "success",
        message: `Purchase Order ${confirmCancelModal.poNumber} has been cancelled successfully. Ordered items returned to Items to Order.`,
      });
      setConfirmCancelModal({ open: false, orderId: null, poNumber: "", loading: false });
      fetchOrders();
      if (selectedOrderId === confirmCancelModal.orderId) {
        setDetailOrder((prev) => (prev ? { ...prev, status: "Cancelled" } : null));
      }
    } catch (err) {
      setConfirmCancelModal((prev) => ({ ...prev, loading: false }));
      setStatus({ type: "error", message: err.message || "Failed to cancel Purchase Order." });
    }
  };

  // Sorting state
  const [sortConfig, setSortConfig] = useState({
    key: "id",
    direction: "desc",
  });

  const handleSort = (key) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        return {
          key,
          direction: prev.direction === "asc" ? "desc" : "asc",
        };
      }
      return { key, direction: "asc" };
    });
  };

  const renderSortHeader = (label, key, width, isRight = false) => {
    const isSorted = sortConfig.key === key;
    return (
      <th
        style={{
          width,
          cursor: "pointer",
          userSelect: "none",
          textAlign: isRight ? "right" : "left",
        }}
        onClick={() => handleSort(key)}
        title={`Sort by ${label} (${isSorted && sortConfig.direction === "asc" ? "descending" : "ascending"})`}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.35rem",
            justifyContent: isRight ? "flex-end" : "flex-start",
          }}
        >
          <span>{label}</span>
          {isSorted ? (
            sortConfig.direction === "asc" ? (
              <BsArrowUp style={{ fontSize: "0.85rem", color: "#38bdf8" }} />
            ) : (
              <BsArrowDown style={{ fontSize: "0.85rem", color: "#38bdf8" }} />
            )
          ) : (
            <BsArrowDownUp style={{ fontSize: "0.75rem", opacity: 0.35 }} />
          )}
        </div>
      </th>
    );
  };

  // Filtered and sorted orders
  const filteredOrders = useMemo(() => {
    const result = orders.filter((order) => {
      // Global search
      if (search.trim()) {
        const query = search.trim().toLowerCase();
        const combined = `${order.po_number} ${order.vendor_name} ${order.vendor_code} ${order.created_by} ${order.status}`.toLowerCase();
        if (!combined.includes(query)) return false;
      }

      // Column filters
      const activeFilters = Object.entries(columnFilters).filter(([, val]) => String(val || "").trim());
      return activeFilters.every(([key, filterVal]) => {
        const needle = String(filterVal).trim().toLowerCase();
        const rowVal = String(order[key] ?? "").toLowerCase();
        return rowVal.includes(needle);
      });
    });

    if (sortConfig.key) {
      result.sort((a, b) => {
        let aVal = a[sortConfig.key];
        let bVal = b[sortConfig.key];

        if (sortConfig.key === "total_items" || sortConfig.key === "total_qty" || sortConfig.key === "id") {
          aVal = Number(aVal) || 0;
          bVal = Number(bVal) || 0;
        } else if (sortConfig.key === "created_at") {
          aVal = new Date(aVal || 0).getTime();
          bVal = new Date(bVal || 0).getTime();
        } else {
          aVal = String(aVal || "").toLowerCase();
          bVal = String(bVal || "").toLowerCase();
        }

        if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [orders, search, columnFilters, sortConfig]);

  // Summary stats
  const stats = useMemo(() => {
    const totalOrders = orders.length;
    const totalItemsCount = orders.reduce((acc, o) => acc + (Number(o.total_items) || 0), 0);
    const totalQty = orders.reduce((acc, o) => acc + (parseFloat(o.total_qty) || 0), 0);
    return { totalOrders, totalItemsCount, totalQty };
  }, [orders]);

  return (
    <section className="module-page project-costing-page">
      {/* Header */}
      <div className="crud-page__header pq-header project-costing-toolbar">
        <div>
          <h1 className="module-page__title project-costing-title">
            <span className="project-costing-title__icon" aria-hidden="true"><BsCartCheck /></span>
            <span className="project-costing-title__text">Procurement Orders</span>
          </h1>
        </div>
        <div className="pq-header-actions" style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <button
            type="button"
            className="crud-add-btn"
            style={{
              background: "#2563eb",
              color: "#ffffff",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.4rem",
              fontWeight: 600,
              boxShadow: "0 2px 4px rgba(37,99,235,0.25)",
            }}
            onClick={() => setIsPlaceOrderModalOpen(true)}
          >
            <BsCartPlus aria-hidden="true" style={{ fontSize: "1.05rem" }} /> Place Order
          </button>
          <button
            type="button"
            className="crud-add-btn"
            style={{ background: "#0284c7", color: "#ffffff", display: "inline-flex", alignItems: "center", gap: "0.4rem" }}
            onClick={() => navigate("/items-to-order")}
          >
            Items to Order
          </button>
          <button
            type="button"
            className="crud-add-btn"
            onClick={() => navigate("/stock-purchase")}
          >
            <BsArrowLeft aria-hidden="true" /> Back to Received Goods
          </button>
        </div>
      </div>

      {status.message && status.type === "error" ? (
        <p className={`users-status users-status--${status.type}`}>{status.message}</p>
      ) : null}

      {/* Summary Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: "0.75rem", marginBottom: "0.75rem" }}>
        <div className="project-costing-card" style={{ padding: "0.55rem 0.85rem", borderLeft: "3.5px solid #2563eb", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: "0.7rem", color: "#64748b", fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase" }}>PURCHASE ORDERS</div>
            <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.15rem" }}>Total POs created</div>
          </div>
          <div style={{ fontSize: "1.35rem", fontWeight: 700, color: "#1e3a8a", lineHeight: 1 }}>
            {stats.totalOrders}
          </div>
        </div>

        <div className="project-costing-card" style={{ padding: "0.55rem 0.85rem", borderLeft: "3.5px solid #0ea5e9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: "0.7rem", color: "#64748b", fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase" }}>ITEMS ORDERED</div>
            <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.15rem" }}>Total item line entries</div>
          </div>
          <div style={{ fontSize: "1.35rem", fontWeight: 700, color: "#0284c7", lineHeight: 1 }}>
            {stats.totalItemsCount}
          </div>
        </div>

        <div className="project-costing-card" style={{ padding: "0.55rem 0.85rem", borderLeft: "3.5px solid #10b981", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: "0.7rem", color: "#64748b", fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase" }}>TOTAL ORDER QUANTITY</div>
            <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.15rem" }}>Total units ordered</div>
          </div>
          <div style={{ fontSize: "1.35rem", fontWeight: 700, color: "#065f46", lineHeight: 1 }}>
            {stats.totalQty.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Orders Table Card */}
      <Card className="lca-card mb-3 pq-card">
        <CardHeader className="pq-card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.75rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <h2 style={{ margin: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <BsFileEarmarkText aria-hidden="true" />
              Procurement Orders
            </h2>
            <span className="vendor-card__badge">
              {filteredOrders.length} {filteredOrders.length === 1 ? "Order" : "Orders"}
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <input
              type="text"
              placeholder="Search orders..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="users-table__filter-input"
              style={{ width: "220px", padding: "0.35rem 0.65rem", fontSize: "0.85rem" }}
            />
          </div>
        </CardHeader>

        <CardBody className="pq-card-body">
          {loading ? (
            <p className="project-costing-popup project-costing-popup--warning">Loading purchase orders...</p>
          ) : (
            <div className="users-table-wrap pq-table-wrap-list project-costing-table-wrap">
              <table className="users-table project-costing-table">
                <thead>
                  <tr>
                    {renderSortHeader("PO Number", "po_number", "180px")}
                    {renderSortHeader("Vendor", "vendor_name")}
                    {renderSortHeader("Total Items", "total_items", "110px", true)}
                    {renderSortHeader("Total Qty", "total_qty", "110px", true)}
                    {renderSortHeader("Status", "status", "130px")}
                    {renderSortHeader("Created Date", "created_at", "140px")}
                    {renderSortHeader("Created By", "created_by", "120px")}
                    <th style={{ width: "90px", textAlign: "center" }}>Actions</th>
                  </tr>
                  <tr>
                    <th>
                      <input
                        className="users-table__filter-input"
                        type="text"
                        placeholder="Filter PO..."
                        value={columnFilters.po_number ?? ""}
                        onChange={(e) => setColumnFilters((p) => ({ ...p, po_number: e.target.value }))}
                      />
                    </th>
                    <th>
                      <input
                        className="users-table__filter-input"
                        type="text"
                        placeholder="Filter vendor..."
                        value={columnFilters.vendor_name ?? ""}
                        onChange={(e) => setColumnFilters((p) => ({ ...p, vendor_name: e.target.value }))}
                      />
                    </th>
                    <th>
                      <input
                        className="users-table__filter-input"
                        type="text"
                        placeholder="Filter items..."
                        value={columnFilters.total_items ?? ""}
                        onChange={(e) => setColumnFilters((p) => ({ ...p, total_items: e.target.value }))}
                      />
                    </th>
                    <th>
                      <input
                        className="users-table__filter-input"
                        type="text"
                        placeholder="Filter qty..."
                        value={columnFilters.total_qty ?? ""}
                        onChange={(e) => setColumnFilters((p) => ({ ...p, total_qty: e.target.value }))}
                      />
                    </th>
                    <th>
                      <input
                        className="users-table__filter-input"
                        type="text"
                        placeholder="Filter status..."
                        value={columnFilters.status ?? ""}
                        onChange={(e) => setColumnFilters((p) => ({ ...p, status: e.target.value }))}
                      />
                    </th>
                    <th></th>
                    <th>
                      <input
                        className="users-table__filter-input"
                        type="text"
                        placeholder="Filter user..."
                        value={columnFilters.created_by ?? ""}
                        onChange={(e) => setColumnFilters((p) => ({ ...p, created_by: e.target.value }))}
                      />
                    </th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="project-costing-empty">
                        No purchase orders found. Go to <strong>Items to Order</strong> to place an order.
                      </td>
                    </tr>
                  ) : (
                    filteredOrders.map((row) => (
                      <tr key={row.id}>
                        <td style={{ fontWeight: 700, color: "#1e40af", letterSpacing: "0.02em" }}>
                          {row.po_number}
                        </td>
                        <td>
                          <div style={{ fontWeight: 600, color: "#0f172a" }}>{row.vendor_name}</div>
                          {row.vendor_code && (
                            <div style={{ fontSize: "0.78rem", color: "#64748b" }}>Code: {row.vendor_code}</div>
                          )}
                        </td>
                        <td className="project-costing-table__right" style={{ fontWeight: 600 }}>
                          {row.total_items}
                        </td>
                        <td className="project-costing-table__right" style={{ fontWeight: 700, color: "#0f172a" }}>
                          {row.total_qty}
                        </td>
                        <td>
                          <span
                            style={{
                              background: String(row.status).toLowerCase() === "cancelled" ? "rgba(239, 68, 68, 0.12)" : "rgba(16, 185, 129, 0.12)",
                              color: String(row.status).toLowerCase() === "cancelled" ? "#dc2626" : "#059669",
                              border: `1px solid ${String(row.status).toLowerCase() === "cancelled" ? "rgba(239, 68, 68, 0.3)" : "rgba(16, 185, 129, 0.3)"}`,
                              fontWeight: 600,
                              padding: "0.2rem 0.55rem",
                              borderRadius: "999px",
                              fontSize: "0.8rem",
                              display: "inline-block",
                            }}
                          >
                            {row.status || "Order Placed"}
                          </span>
                        </td>
                        <td style={{ fontSize: "0.82rem", color: "#64748b" }}>
                          {row.created_at ? new Date(row.created_at).toLocaleDateString() : "—"}
                        </td>
                        <td style={{ fontSize: "0.82rem", color: "#475569" }}>
                          {row.created_by || "—"}
                        </td>
                        <td style={{ textAlign: "center", whiteSpace: "nowrap" }}>
                          {(() => {
                            const isOrderPlaced = String(row.status || "").trim().toLowerCase() === "order placed";
                            return (
                              <div style={{ display: "inline-flex", gap: "0.35rem", alignItems: "center", justifyContent: "center" }}>
                                <button
                                  type="button"
                                  className="crud-add-btn"
                                  style={{
                                    padding: "0.35rem 0.55rem",
                                    fontSize: "0.88rem",
                                    background: "#f1f5f9",
                                    color: "#334155",
                                    border: "1px solid #cbd5e1",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    borderRadius: "6px",
                                    lineHeight: 1,
                                  }}
                                  onClick={() => handleViewDetail(row.id)}
                                  title="View Purchase Order Details"
                                  aria-label="View Purchase Order Details"
                                >
                                  <BsEye aria-hidden="true" />
                                </button>
                                <button
                                  type="button"
                                  className="crud-add-btn modal-btn--cancel"
                                  disabled={!isOrderPlaced}
                                  style={{
                                    padding: "0.35rem 0.55rem",
                                    fontSize: "0.88rem",
                                    color: isOrderPlaced ? "#dc2626" : "#94a3b8",
                                    borderColor: isOrderPlaced ? "#fca5a5" : "#e2e8f0",
                                    background: isOrderPlaced ? "#fef2f2" : "#f8fafc",
                                    opacity: isOrderPlaced ? 1 : 0.35,
                                    cursor: isOrderPlaced ? "pointer" : "not-allowed",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    borderRadius: "6px",
                                    lineHeight: 1,
                                  }}
                                  onClick={() => isOrderPlaced && promptCancelOrder(row.id, row.po_number)}
                                  title={isOrderPlaced ? "Cancel Purchase Order" : `Cannot cancel (Status: ${row.status || "—"})`}
                                  aria-label="Cancel Purchase Order"
                                >
                                  <BsXCircle aria-hidden="true" />
                                </button>
                              </div>
                            );
                          })()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      {/* PO Detail Modal */}
      {selectedOrderId && (
        <div
          className="modal-overlay pso-modal-backdrop"
          onClick={handleCloseDetail}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1250,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(15, 23, 42, 0.55)",
            backdropFilter: "blur(4px)",
            padding: "1rem",
          }}
        >
          <div
            className="costing-modal-card pso-modal-content"
            style={{
              maxWidth: "1050px",
              width: "95%",
              maxHeight: "90vh",
              display: "flex",
              flexDirection: "column",
              gap: 0,
              padding: 0,
              overflow: "hidden",
              backgroundColor: "#ffffff",
              borderRadius: "12px",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              className="pso-modal-header"
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "1rem 1.25rem",
                background: "#f8fafc",
                borderBottom: "1px solid #e2e8f0",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
                <BsFileEarmarkText style={{ fontSize: "1.5rem", color: "#2563eb" }} />
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 700, color: "#0f172a" }}>
                      Purchase Order:
                    </h3>
                    <span
                      style={{
                        background: "#dbeafe",
                        color: "#1e40af",
                        fontWeight: 700,
                        padding: "0.2rem 0.6rem",
                        borderRadius: "6px",
                        fontSize: "0.95rem",
                        letterSpacing: "0.02em",
                      }}
                    >
                      {detailOrder?.po_number || "Loading..."}
                    </span>
                    <span
                      style={{
                        background: String(detailOrder?.status).toLowerCase() === "cancelled" ? "rgba(239, 68, 68, 0.12)" : "rgba(16, 185, 129, 0.12)",
                        color: String(detailOrder?.status).toLowerCase() === "cancelled" ? "#dc2626" : "#059669",
                        border: `1px solid ${String(detailOrder?.status).toLowerCase() === "cancelled" ? "rgba(239, 68, 68, 0.3)" : "rgba(16, 185, 129, 0.3)"}`,
                        fontWeight: 600,
                        padding: "0.15rem 0.55rem",
                        borderRadius: "999px",
                        fontSize: "0.78rem",
                      }}
                    >
                      {detailOrder?.status || "Order Placed"}
                    </span>
                  </div>
                  <div style={{ fontSize: "0.8rem", color: "#64748b", marginTop: "0.2rem" }}>
                    Date: {detailOrder?.created_at ? new Date(detailOrder.created_at).toLocaleString() : "—"}
                    {detailOrder?.created_by ? ` • Created By: ${detailOrder.created_by}` : ""}
                  </div>
                </div>
              </div>

              <button
                type="button"
                className="pso-modal-close"
                onClick={handleCloseDetail}
                aria-label="Close"
                style={{
                  background: "transparent",
                  border: "none",
                  fontSize: "1.75rem",
                  color: "#64748b",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "36px",
                  height: "36px",
                  borderRadius: "6px",
                  lineHeight: 1,
                }}
              >
                &times;
              </button>
            </div>

            {/* Modal Body */}
            <div
              className="pso-modal-body"
              style={{
                padding: "1.25rem",
                overflowY: "auto",
                flex: 1,
                display: "flex",
                flexDirection: "column",
                gap: "1.15rem",
              }}
            >
              {loadingDetail ? (
                <div style={{ textAlign: "center", padding: "3rem", color: "#64748b", fontSize: "0.95rem" }}>
                  Loading order details...
                </div>
              ) : detailError ? (
                <p className="users-status users-status--error">{detailError}</p>
              ) : (
                <>
                  {/* Vendor Details Card */}
                  {detailOrder && (
                    <div
                      className="pso-vendor-details-card"
                      style={{
                        background: "#f8fafc",
                        border: "1px solid #e2e8f0",
                        borderRadius: "8px",
                        padding: "1rem 1.25rem",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.5rem",
                          fontSize: "0.95rem",
                          fontWeight: 700,
                          color: "#1e293b",
                          marginBottom: "0.75rem",
                          paddingBottom: "0.5rem",
                          borderBottom: "1px solid #e2e8f0",
                        }}
                      >
                        <BsBuilding style={{ color: "#2563eb" }} />
                        <span>Vendor Information</span>
                      </div>

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                          gap: "0.85rem 1.5rem",
                        }}
                      >
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.15rem", fontSize: "0.85rem" }}>
                          <span style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", color: "#64748b", letterSpacing: "0.04em" }}>
                            Vendor Name
                          </span>
                          <span style={{ fontWeight: 600, color: "#0f172a" }}>
                            {detailOrder.vendor_name || "—"}
                          </span>
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: "0.15rem", fontSize: "0.85rem" }}>
                          <span style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", color: "#64748b", letterSpacing: "0.04em" }}>
                            Vendor Code
                          </span>
                          <span style={{ color: "#0f172a", fontWeight: 500 }}>
                            {detailOrder.vendor_code || "—"}
                          </span>
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: "0.15rem", fontSize: "0.85rem" }}>
                          <span style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", color: "#64748b", letterSpacing: "0.04em", display: "flex", alignItems: "center", gap: "0.3rem" }}>
                            <BsPerson /> Contact Person
                          </span>
                          <span style={{ color: "#0f172a" }}>
                            {detailOrder.contact_person || detailOrder.vendor_contact_person || "—"}
                          </span>
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: "0.15rem", fontSize: "0.85rem" }}>
                          <span style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", color: "#64748b", letterSpacing: "0.04em", display: "flex", alignItems: "center", gap: "0.3rem" }}>
                            <BsTelephone /> Phone Number
                          </span>
                          <span style={{ color: "#0f172a" }}>
                            {detailOrder.vendor_phone || "—"}
                          </span>
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: "0.15rem", fontSize: "0.85rem" }}>
                          <span style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", color: "#64748b", letterSpacing: "0.04em", display: "flex", alignItems: "center", gap: "0.3rem" }}>
                            <BsEnvelope /> Email
                          </span>
                          <span style={{ color: "#0f172a" }}>
                            {detailOrder.vendor_email || "—"}
                          </span>
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: "0.15rem", fontSize: "0.85rem", gridColumn: "1 / -1" }}>
                          <span style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", color: "#64748b", letterSpacing: "0.04em", display: "flex", alignItems: "center", gap: "0.3rem" }}>
                            <BsGeoAlt /> Address
                          </span>
                          <span style={{ color: "#0f172a", lineHeight: 1.4 }}>
                            {detailOrder.vendor_address || "—"}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Items List Section Header */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                      <h4 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "#1e293b" }}>
                        Ordered Items
                      </h4>
                      <span className="vendor-card__badge" style={{ background: "#e0f2fe", color: "#0369a1", border: "1px solid #bae6fd" }}>
                        {detailItems.length} {detailItems.length === 1 ? "Line Item" : "Line Items"}
                      </span>
                    </div>

                    <div
                      style={{
                        background: "#ecfdf5",
                        border: "1px solid #a7f3d0",
                        padding: "0.35rem 0.85rem",
                        borderRadius: "8px",
                        fontSize: "0.85rem",
                        color: "#065f46",
                      }}
                    >
                      Total Units: <strong style={{ fontSize: "0.95rem", color: "#047857" }}>{detailOrder?.total_qty}</strong>
                    </div>
                  </div>

                  {/* Items Table */}
                  <div
                    className="users-table-wrap"
                    style={{
                      border: "1px solid #e2e8f0",
                      borderRadius: "8px",
                      overflowY: "auto",
                      overflowX: "hidden",
                      maxHeight: "48vh",
                      width: "100%",
                    }}
                  >
                    <table
                      className="users-table pso-ordered-items-table"
                      style={{
                        width: "100%",
                        tableLayout: "fixed",
                        borderCollapse: "collapse",
                      }}
                    >
                      <thead>
                        <tr>
                          <th style={{ minWidth: "220px", whiteSpace: "normal", wordBreak: "break-word" }}>Item (Code _ Category _ Name)</th>
                          <th style={{ width: "110px", whiteSpace: "normal", wordBreak: "break-word" }}>Reference #</th>
                          <th style={{ width: "140px", whiteSpace: "normal", wordBreak: "break-word" }}>Project</th>
                          <th className="project-costing-table__right" style={{ width: "85px" }}>Requested Qty</th>
                          <th className="project-costing-table__right" style={{ width: "85px", color: "#1d4ed8" }}>Ordered Qty</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detailItems.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="project-costing-empty">No items recorded in this order.</td>
                          </tr>
                        ) : (
                          detailItems.map((item, idx) => (
                            <tr key={item.id || idx}>
                              <td style={{ verticalAlign: "top", whiteSpace: "normal", wordBreak: "break-word" }}>
                                <div style={{ fontWeight: 600, color: "#0f172a", lineHeight: 1.4 }}>
                                  {item.combined_label || `${item.item_code} _ ${item.item_category} _ ${item.item_name}`}
                                </div>
                              </td>
                              <td style={{ verticalAlign: "top", fontWeight: 500, color: "#334155", whiteSpace: "normal", wordBreak: "break-word" }}>
                                {item.reference_number || "—"}
                              </td>
                              <td style={{ verticalAlign: "top", whiteSpace: "normal", wordBreak: "break-word" }}>
                                <div style={{ fontWeight: 600, color: "#0f172a" }}>{item.project_id || "—"}</div>
                                {item.project_name && item.project_name !== "—" && (
                                  <div style={{ fontSize: "0.78rem", color: "#64748b", marginTop: "2px", lineHeight: 1.3 }}>{item.project_name}</div>
                                )}
                              </td>
                              <td className="project-costing-table__right" style={{ verticalAlign: "top", color: "#64748b", whiteSpace: "nowrap" }}>
                                {item.requested_qty}
                              </td>
                              <td className="project-costing-table__right" style={{ verticalAlign: "top", fontWeight: 700, color: "#1d4ed8", fontSize: "0.95rem", whiteSpace: "nowrap" }}>
                                {item.order_qty}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div
              className="pso-modal-footer"
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "0.75rem",
                padding: "0.85rem 1.25rem",
                background: "#f8fafc",
                borderTop: "1px solid #e2e8f0",
              }}
            >
              {detailOrder && String(detailOrder.status).toLowerCase() === "order placed" ? (
                <button
                  type="button"
                  className="crud-add-btn"
                  style={{
                    background: "#dc2626",
                    color: "#ffffff",
                    padding: "0.45rem 1rem",
                    fontSize: "0.85rem",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.4rem",
                    borderRadius: "6px",
                  }}
                  onClick={() => promptCancelOrder(detailOrder.id, detailOrder.po_number)}
                >
                  <BsXCircle aria-hidden="true" /> Cancel Purchase Order
                </button>
              ) : <div />}

              <button
                type="button"
                className="crud-add-btn modal-btn--cancel"
                onClick={handleCloseDetail}
                style={{ padding: "0.45rem 1.25rem" }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Place Order Modal (Manual / Direct PO Creation) */}
      <PlaceOrderModal
        isOpen={isPlaceOrderModalOpen}
        onClose={() => setIsPlaceOrderModalOpen(false)}
        initialItems={[]}
        allItems={[]}
        onSuccess={() => {
          fetchOrders();
        }}
      />

      {/* Confirmation Modal for Cancelling Purchase Order (Latest Style) */}
      {confirmCancelModal.open && (
        <div
          className="modal-overlay"
          onClick={handleCloseConfirmCancel}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1400,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(4px)",
            padding: "1rem",
          }}
        >
          <div
            className="modal-card"
            style={{
              maxWidth: "480px",
              width: "100%",
              backgroundColor: "#ffffff",
              borderRadius: "12px",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1)",
              overflow: "hidden",
              border: "1px solid #e2e8f0",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: "1rem 1.25rem",
                background: "#fff1f2",
                borderBottom: "1px solid #fecdd3",
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
              }}
            >
              <div
                style={{
                  width: "38px",
                  height: "38px",
                  borderRadius: "50%",
                  background: "#ffe4e6",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#e11d48",
                  fontSize: "1.25rem",
                  flexShrink: 0,
                }}
              >
                <BsExclamationTriangleFill />
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: "#9f1239" }}>
                  Cancel Purchase Order
                </h3>
                <span style={{ fontSize: "0.82rem", color: "#be123c", fontWeight: 600 }}>
                  {confirmCancelModal.poNumber}
                </span>
              </div>
              <button
                type="button"
                onClick={handleCloseConfirmCancel}
                disabled={confirmCancelModal.loading}
                style={{
                  background: "transparent",
                  border: "none",
                  fontSize: "1.5rem",
                  color: "#9f1239",
                  cursor: "pointer",
                  lineHeight: 1,
                  padding: "0.2rem",
                }}
                aria-label="Close"
              >
                &times;
              </button>
            </div>

            {/* Modal Content */}
            <div style={{ padding: "1.25rem" }}>
              <p style={{ margin: "0 0 0.85rem", color: "#334155", fontSize: "0.95rem", lineHeight: 1.5 }}>
                Are you sure you want to cancel Purchase Order <strong style={{ color: "#0f172a" }}>{confirmCancelModal.poNumber}</strong>?
              </p>
              <div
                style={{
                  padding: "0.75rem 0.9rem",
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                  color: "#475569",
                  fontSize: "0.82rem",
                  lineHeight: 1.45,
                }}
              >
                ℹ️ <strong>Release Note:</strong> All ordered quantities from this Purchase Order will be immediately returned back to the <strong>Items to Order</strong> page.
              </div>
            </div>

            {/* Modal Actions */}
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "0.6rem",
                padding: "0.85rem 1.25rem",
                background: "#f8fafc",
                borderTop: "1px solid #e2e8f0",
              }}
            >
              <button
                type="button"
                className="modal-btn modal-btn--cancel"
                onClick={handleCloseConfirmCancel}
                disabled={confirmCancelModal.loading}
                style={{ padding: "0.45rem 1rem", fontSize: "0.88rem" }}
              >
                Keep Order
              </button>
              <button
                type="button"
                className="crud-add-btn"
                onClick={handleConfirmCancel}
                disabled={confirmCancelModal.loading}
                style={{
                  background: "#dc2626",
                  color: "#ffffff",
                  padding: "0.45rem 1.15rem",
                  fontSize: "0.88rem",
                  fontWeight: 600,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.35rem",
                  borderRadius: "6px",
                  boxShadow: "0 2px 4px rgba(220, 38, 38, 0.25)",
                }}
              >
                <BsXCircle aria-hidden="true" />
                {confirmCancelModal.loading ? "Cancelling..." : "Yes, Cancel Order"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
