import { useEffect, useMemo, useState } from "react";
import { getLabFurnitureItemOrderedPos } from "../services/crudApi";

export default function OrderedQtyPosModal({ item, onClose }) {
  const [pos, setPos] = useState([]);
  const [itemMeta, setItemMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [filters, setFilters] = useState({
    po: "",
    vendor: "",
    qty: "",
    status: "ALL",
  });

  const [sortConfig, setSortConfig] = useState({
    key: "created_at",
    direction: "desc",
  });

  useEffect(() => {
    if (!item?.id) return;
    let isMounted = true;
    setLoading(true);
    setError(null);

    getLabFurnitureItemOrderedPos(item.id)
      .then((data) => {
        if (!isMounted) return;
        if (data && data.success) {
          setPos(data.pos || []);
          setItemMeta({
            item_code: data.item_code,
            item_name: data.item_name,
            item_category: data.item_category,
            total_ordered_qty: data.total_ordered_qty,
          });
        } else {
          setError(data?.message || "Failed to load purchase orders.");
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err?.message || "Error loading purchase orders.");
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [item?.id]);

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

  const getSortIndicator = (key) => {
    if (sortConfig.key !== key) {
      return <span style={{ opacity: 0.35, fontSize: "0.75rem" }}>⇅</span>;
    }
    return (
      <span style={{ color: "#0284c7", fontWeight: "bold", fontSize: "0.8rem" }}>
        {sortConfig.direction === "asc" ? "▲" : "▼"}
      </span>
    );
  };

  const filteredPos = useMemo(() => {
    return pos.filter((p) => {
      if (filters.po.trim()) {
        const query = filters.po.trim().toLowerCase();
        const poNum = String(p.po_number || p.order_code || "").toLowerCase();
        if (!poNum.includes(query)) return false;
      }

      if (filters.vendor.trim()) {
        const query = filters.vendor.trim().toLowerCase();
        const vName = String(p.vendor_name || "").toLowerCase();
        const vCode = String(p.vendor_code || "").toLowerCase();
        if (!vName.includes(query) && !vCode.includes(query)) return false;
      }

      if (filters.qty.trim()) {
        const numFilter = parseFloat(filters.qty);
        if (!isNaN(numFilter)) {
          if (Number(p.order_qty) < numFilter) return false;
        } else {
          if (!String(p.order_qty).includes(filters.qty.trim())) return false;
        }
      }

      if (filters.status && filters.status !== "ALL") {
        if ((p.status || "").toUpperCase() !== filters.status.toUpperCase()) {
          return false;
        }
      }

      return true;
    });
  }, [pos, filters]);

  const sortedPos = useMemo(() => {
    const list = [...filteredPos];
    if (!sortConfig.key) return list;

    return list.sort((a, b) => {
      let aVal = a[sortConfig.key];
      let bVal = b[sortConfig.key];

      if (sortConfig.key === "order_qty") {
        aVal = Number(aVal) || 0;
        bVal = Number(bVal) || 0;
        return sortConfig.direction === "asc" ? aVal - bVal : bVal - aVal;
      }

      if (sortConfig.key === "created_at") {
        aVal = new Date(aVal || 0).getTime();
        bVal = new Date(bVal || 0).getTime();
        return sortConfig.direction === "asc" ? aVal - bVal : bVal - aVal;
      }

      const aStr = String(aVal || "").toLowerCase();
      const bStr = String(bVal || "").toLowerCase();
      if (aStr < bStr) return sortConfig.direction === "asc" ? -1 : 1;
      if (aStr > bStr) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredPos, sortConfig]);

  const formatQty = (val) => {
    const num = Number(val);
    if (isNaN(num)) return "0.00";
    return num.toFixed(2);
  };

  const filteredTotalQty = useMemo(() => {
    const sum = sortedPos.reduce((acc, p) => acc + (Number(p.order_qty) || 0), 0);
    return formatQty(sum);
  }, [sortedPos]);

  const displayedItemCode = itemMeta?.item_code || item?.item_code || "";
  const displayedItemName = itemMeta?.item_name || item?.item_name || "";
  const displayedCategory = itemMeta?.item_category || item?.item_category || "";
  const displayedTotalOrdered = formatQty(itemMeta?.total_ordered_qty ?? item?.ordered_qty ?? 0);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="costing-modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: "920px",
          width: "95%",
          maxHeight: "88vh",
          display: "flex",
          flexDirection: "column",
          gap: "0.85rem",
        }}
      >
        {/* Header */}
        <div
          className="costing-modal-card__header"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "0.85rem 1rem",
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            borderRadius: "8px",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <h3 className="costing-modal-card__title" style={{ margin: 0, fontWeight: 700, color: "#0f172a", fontSize: "1.1rem" }}>
                Purchase Orders Placed
              </h3>
              <span
                style={{
                  background: "#e0f2fe",
                  color: "#0369a1",
                  border: "1px solid #bae6fd",
                  padding: "2px 8px",
                  borderRadius: "6px",
                  fontSize: "0.8rem",
                  fontWeight: 700,
                  letterSpacing: "0.03em",
                }}
              >
                {displayedItemCode}
              </span>
            </div>
            <div style={{ fontSize: "0.82rem", color: "#64748b", marginTop: "3px" }}>
              <strong>{displayedItemName}</strong>
              {displayedCategory ? ` • ${displayedCategory}` : ""}
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <div
              style={{
                textAlign: "right",
                background: "#ecfdf5",
                border: "1px solid #a7f3d0",
                padding: "4px 12px",
                borderRadius: "8px",
              }}
            >
              <span style={{ fontSize: "0.72rem", color: "#065f46", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", fontWeight: 600 }}>
                Total Ordered Qty
              </span>
              <strong style={{ fontSize: "1.05rem", color: "#047857" }}>
                {displayedTotalOrdered}
              </strong>
            </div>

            <button
              type="button"
              className="costing-modal-card__close"
              onClick={onClose}
              aria-label="Close"
              style={{
                fontSize: "1.5rem",
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "#64748b",
                padding: "2px 6px",
                lineHeight: 1,
              }}
            >
              &times;
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: "3rem", color: "#64748b", fontSize: "0.95rem" }}>
              Loading purchase orders...
            </div>
          ) : error ? (
            <div
              style={{
                padding: "1rem",
                background: "#fef2f2",
                color: "#991b1b",
                border: "1px solid #fecaca",
                borderRadius: "6px",
                margin: "1rem 0",
              }}
            >
              {error}
            </div>
          ) : pos.length === 0 ? (
            <div
              style={{
                padding: "3rem",
                textAlign: "center",
                color: "#64748b",
                background: "#f8fafc",
                borderRadius: "8px",
                border: "1px dashed #cbd5e1",
              }}
            >
              <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>📦</div>
              <div style={{ fontWeight: 600, color: "#334155", fontSize: "1rem" }}>
                No active Purchase Orders found
              </div>
              <div style={{ fontSize: "0.85rem", marginTop: "4px" }}>
                This item has no purchase orders with status &quot;Order Placed&quot;.
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
              {/* Filter controls */}
              <div
                style={{
                  display: "flex",
                  gap: "0.5rem",
                  marginBottom: "0.6rem",
                  flexWrap: "wrap",
                  alignItems: "center",
                }}
              >
                <input
                  type="text"
                  placeholder="Filter by PO..."
                  value={filters.po}
                  onChange={(e) => setFilters((p) => ({ ...p, po: e.target.value }))}
                  className="auth-input"
                  style={{
                    flex: "1 1 140px",
                    height: "32px",
                    fontSize: "0.82rem",
                    padding: "0 0.5rem",
                  }}
                />

                <input
                  type="text"
                  placeholder="Filter by Vendor..."
                  value={filters.vendor}
                  onChange={(e) => setFilters((p) => ({ ...p, vendor: e.target.value }))}
                  className="auth-input"
                  style={{
                    flex: "1 1 140px",
                    height: "32px",
                    fontSize: "0.82rem",
                    padding: "0 0.5rem",
                  }}
                />

                <input
                  type="text"
                  placeholder="Min Qty..."
                  value={filters.qty}
                  onChange={(e) => setFilters((p) => ({ ...p, qty: e.target.value }))}
                  className="auth-input"
                  style={{
                    width: "90px",
                    height: "32px",
                    fontSize: "0.82rem",
                    padding: "0 0.5rem",
                  }}
                />

                {(filters.po || filters.vendor || filters.qty || filters.status !== "ALL") && (
                  <button
                    type="button"
                    onClick={() => setFilters({ po: "", vendor: "", qty: "", status: "ALL" })}
                    style={{
                      border: "none",
                      background: "#f1f5f9",
                      color: "#475569",
                      padding: "4px 8px",
                      borderRadius: "4px",
                      cursor: "pointer",
                      fontSize: "0.78rem",
                      fontWeight: 600,
                    }}
                  >
                    Clear Filters
                  </button>
                )}
              </div>

              {/* Table */}
              <div
                className="costing-modal-card__table-wrap"
                style={{
                  flex: 1,
                  overflowY: "auto",
                  border: "1px solid #e2e8f0",
                  borderRadius: "6px",
                  maxHeight: "44vh",
                }}
              >
                <table className="users-table" style={{ width: "100%", tableLayout: "auto", borderCollapse: "collapse" }}>
                  <thead style={{ position: "sticky", top: 0, zIndex: 1, background: "#1e293b", color: "#f8fafc" }}>
                    <tr>
                      <th
                        onClick={() => handleSort("po_number")}
                        style={{ cursor: "pointer", userSelect: "none", width: "180px", color: "#f8fafc" }}
                      >
                        PO Number {getSortIndicator("po_number")}
                      </th>
                      <th
                        onClick={() => handleSort("vendor_name")}
                        style={{ cursor: "pointer", userSelect: "none", color: "#f8fafc" }}
                      >
                        Vendor {getSortIndicator("vendor_name")}
                      </th>
                      <th
                        onClick={() => handleSort("order_qty")}
                        style={{
                          cursor: "pointer",
                          userSelect: "none",
                          textAlign: "right",
                          width: "120px",
                          color: "#f8fafc",
                        }}
                      >
                        Ordered Qty {getSortIndicator("order_qty")}
                      </th>
                      <th
                        onClick={() => handleSort("created_at")}
                        style={{ cursor: "pointer", userSelect: "none", width: "150px", color: "#f8fafc" }}
                      >
                        Created Date {getSortIndicator("created_at")}
                      </th>
                      <th
                        onClick={() => handleSort("created_by")}
                        style={{ cursor: "pointer", userSelect: "none", width: "120px", color: "#f8fafc" }}
                      >
                        Created By {getSortIndicator("created_by")}
                      </th>
                      <th style={{ width: "130px", color: "#f8fafc" }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedPos.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ textAlign: "center", padding: "2rem", color: "#64748b" }}>
                          No purchase orders match your filter criteria.
                        </td>
                      </tr>
                    ) : (
                      sortedPos.map((p) => (
                        <tr key={p.id}>
                          <td style={{ fontWeight: 700, color: "#1e40af" }}>
                            {p.po_number || p.order_code}
                          </td>
                          <td>
                            <div style={{ fontWeight: 600, color: "#0f172a" }}>
                              {p.vendor_name}
                            </div>
                            {p.vendor_code && (
                              <div style={{ fontSize: "0.75rem", color: "#64748b" }}>
                                Code: {p.vendor_code}
                              </div>
                            )}
                          </td>
                          <td
                            style={{
                              textAlign: "right",
                              fontWeight: 700,
                              color: "#047857",
                              fontSize: "0.92rem",
                            }}
                          >
                            {formatQty(p.order_qty)}
                          </td>
                          <td style={{ fontSize: "0.82rem", color: "#475569" }}>
                            {p.created_at}
                          </td>
                          <td style={{ fontSize: "0.82rem", color: "#475569" }}>
                            {p.created_by}
                          </td>
                          <td>
                            <span
                              style={{
                                background: "#ecfdf5",
                                color: "#065f46",
                                border: "1px solid #a7f3d0",
                                padding: "2px 8px",
                                borderRadius: "999px",
                                fontSize: "0.75rem",
                                fontWeight: 600,
                                display: "inline-block",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {p.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {sortedPos.length > 0 && (
                    <tfoot style={{ position: "sticky", bottom: 0, background: "#f8fafc", borderTop: "2px solid #cbd5e1" }}>
                      <tr>
                        <td colSpan={2} style={{ fontWeight: 700, color: "#334155", textAlign: "right", padding: "8px 12px" }}>
                          Filtered Total:
                        </td>
                        <td
                          style={{
                            textAlign: "right",
                            fontWeight: 700,
                            color: "#047857",
                            fontSize: "0.95rem",
                            padding: "8px 12px",
                          }}
                        >
                          {filteredTotalQty}
                        </td>
                        <td colSpan={3}></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="costing-modal-card__footer"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            paddingTop: "0.5rem",
            borderTop: "1px solid #e2e8f0",
          }}
        >
          <div style={{ fontSize: "0.8rem", color: "#64748b" }}>
            Showing <strong>{sortedPos.length}</strong> of <strong>{pos.length}</strong> purchase orders
          </div>
          <button
            type="button"
            className="modal-btn modal-btn--cancel"
            onClick={onClose}
            style={{
              padding: "5px 16px",
              fontSize: "0.85rem",
              background: "#e2e8f0",
              border: "1px solid #cbd5e1",
              borderRadius: "6px",
              cursor: "pointer",
              fontWeight: 600,
              color: "#334155",
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

