import { useEffect, useState } from "react";
import { getStockPurchaseItemGrns } from "../services/crudApi";

const formatQty = (value) => {
  const quantity = Number(value);
  return Number.isFinite(quantity) ? quantity.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "0";
};

export default function StockPurchaseDetailsModal({ item, onClose }) {
  const [grns, setGrns] = useState([]);
  const [itemMeta, setItemMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const itemCodeOrId = item?.item_code_id || item?.item_code;
    if (!itemCodeOrId) {
      setLoading(false);
      setError("Item code is unavailable.");
      return undefined;
    }

    let isMounted = true;
    getStockPurchaseItemGrns(itemCodeOrId)
      .then((data) => {
        if (!isMounted) return;
        setGrns(Array.isArray(data?.grns) ? data.grns : []);
        setItemMeta(data);
      })
      .catch((err) => {
        if (isMounted) setError(err?.message || "Error loading purchase details.");
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [item?.item_code_id, item?.item_code]);

  const totalPurchased = grns.reduce((total, grn) => total + (Number(grn.purchase_qty) || 0), 0);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="costing-modal-card"
        onClick={(event) => event.stopPropagation()}
        style={{ maxWidth: "980px", width: "96%", maxHeight: "85vh", display: "flex", flexDirection: "column", gap: "0.85rem" }}
      >
        <div className="costing-modal-card__header">
          <div>
            <h3 className="costing-modal-card__title" style={{ margin: 0 }}>Purchase Details by GRN</h3>
            <div style={{ color: "#64748b", fontSize: "0.82rem", marginTop: "4px" }}>
              <strong>{itemMeta?.item_code || item?.item_code}</strong>
              {" — "}
              {itemMeta?.item_name || item?.item_name}
              {itemMeta?.item_category || item?.item_category
                ? ` • ${itemMeta?.item_category || item?.item_category}`
                : ""}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <strong style={{ color: "#0369a1" }}>Purchased: {formatQty(totalPurchased)}</strong>
            <button type="button" className="costing-modal-card__close" onClick={onClose} aria-label="Close">
              &times;
            </button>
          </div>
        </div>

        <div style={{ overflow: "auto", minHeight: "120px" }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: "2.5rem", color: "#64748b" }}>Loading purchase details...</div>
          ) : error ? (
            <div style={{ padding: "1rem", color: "#991b1b", background: "#fef2f2", borderRadius: "6px" }}>{error}</div>
          ) : grns.length === 0 ? (
            <div style={{ textAlign: "center", padding: "2.5rem", color: "#64748b" }}>No purchase details found.</div>
          ) : (
            <table className="users-table" style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>GRN</th>
                  <th style={{ textAlign: "left" }}>PO Number</th>
                  <th style={{ textAlign: "left" }}>Purchase Date</th>
                  <th style={{ textAlign: "left" }}>Vendor / Invoice</th>
                  <th style={{ textAlign: "right" }}>Purchased</th>
                  <th style={{ textAlign: "right" }}>Consumed</th>
                  <th style={{ textAlign: "right" }}>Balance</th>
                  <th style={{ textAlign: "right" }}>Unit Price</th>
                </tr>
              </thead>
              <tbody>
                {grns.map((grn) => (
                  <tr
                    key={grn.id}
                    style={String(grn.id) === String(item?.purchase_item_id) ? { background: "#eff6ff" } : undefined}
                  >
                    <td>{grn.grn_number || "—"}</td>
                    <td>{grn.po_number || "—"}</td>
                    <td>{grn.purchase_date || "—"}</td>
                    <td>{[grn.vendor, grn.invoice_number].filter(Boolean).join(" / ") || "—"}</td>
                    <td style={{ textAlign: "right", fontWeight: 700 }}>{formatQty(grn.purchase_qty)}</td>
                    <td style={{ textAlign: "right" }}>{formatQty(grn.consumed_qty)}</td>
                    <td style={{ textAlign: "right" }}>{formatQty(grn.balance_qty)}</td>
                    <td style={{ textAlign: "right" }}>{grn.cost || "0.00"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="costing-modal-card__footer" style={{ justifyContent: "flex-end" }}>
          <button type="button" className="users-btn users-btn--secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
