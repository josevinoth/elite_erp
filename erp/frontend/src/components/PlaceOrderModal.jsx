import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BsBoxes, BsPlusLg, BsTrash, BsCheckCircleFill } from "react-icons/bs";
import Select from "react-select";
import { createPlaceStockOrder, listPlaceStockOrderVendors } from "../services/crudApi";
import "../styles/PlaceStockOrder.css";

export default function PlaceOrderModal({
  isOpen,
  onClose,
  initialItems = [],
  allItems = [],
  onSuccess,
}) {
  const navigate = useNavigate();
  const [vendors, setVendors] = useState([]);
  const [masterItems, setMasterItems] = useState([]);
  const [selectedVendorId, setSelectedVendorId] = useState("");
  const [orderItems, setOrderItems] = useState([]);
  const [loadingVendors, setLoadingVendors] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successInfo, setSuccessInfo] = useState(null);

  // Manual item addition state
  const [showAddManual, setShowAddManual] = useState(false);
  const [manualSelectedItemId, setManualSelectedItemId] = useState("");
  const [manualQty, setManualQty] = useState("");
  const [manualRef, setManualRef] = useState("");

  // Initialize order items when modal opens
  useEffect(() => {
    if (isOpen) {
      setError("");
      setSuccessInfo(null);
      // Auto-open manual addition if no initial items provided
      setShowAddManual(!initialItems || initialItems.length === 0);
      setManualSelectedItemId("");
      setManualQty("");
      setManualRef("");

      const mapped = (initialItems || []).map((item) => ({
        ...item,
        order_qty: Number(item.order_qty || item.requested_qty || 0),
        available_qty: item.purchase_qty ?? item.available_qty ?? "0.00",
      }));
      setOrderItems(mapped);

      // Load vendors & master items
      setLoadingVendors(true);
      listPlaceStockOrderVendors()
        .then((data) => {
          setVendors(Array.isArray(data?.vendors) ? data.vendors : []);
          setMasterItems(Array.isArray(data?.master_items) ? data.master_items : []);
        })
        .catch((err) => {
          setError(err?.message || "Failed to load vendors.");
        })
        .finally(() => {
          setLoadingVendors(false);
        });
    }
  }, [isOpen, initialItems]);

  const selectedVendor = useMemo(() => {
    if (!selectedVendorId) return null;
    return vendors.find((v) => String(v.id) === String(selectedVendorId)) || null;
  }, [vendors, selectedVendorId]);

  // Options for adding item manually from available items to order or catalog
  const availableManualItemOptions = useMemo(() => {
    const existingCodes = new Set(orderItems.map((i) => String(i.item_code || i.id)));
    const combinedPool = [...(allItems || [])];
    const seenCodes = new Set(combinedPool.map((i) => String(i.item_code || i.id)));

    (masterItems || []).forEach((m) => {
      const codeKey = String(m.item_code || m.id);
      if (!seenCodes.has(codeKey)) {
        seenCodes.add(codeKey);
        combinedPool.push(m);
      }
    });

    return combinedPool
      .filter((i) => !existingCodes.has(String(i.item_code || i.id)))
      .map((i) => {
        const needLabel = i.order_qty && Number(i.order_qty) > 0 && i.stage !== "Manual" ? ` (Need: ${i.order_qty})` : "";
        return {
          value: String(i.id),
          label: `${i.combined_label || `${i.item_code} _ ${i.item_category} _ ${i.item_name}`}${needLabel}`,
          item: i,
        };
      });
  }, [allItems, masterItems, orderItems]);

  const handleAddManualItem = () => {
    if (!manualSelectedItemId) return;
    const option = availableManualItemOptions.find((opt) => opt.value === manualSelectedItemId);
    if (!option) return;

    const baseItem = option.item;
    const qty = parseFloat(manualQty) || (parseFloat(baseItem.order_qty) > 0 ? parseFloat(baseItem.order_qty) : 1);

    setOrderItems((prev) => [
      ...prev,
      {
        ...baseItem,
        stage: baseItem.stage || "Manual",
        project_id: manualRef.trim() || baseItem.project_id || "",
        reference_number: baseItem.reference_number || "",
        requested_qty: baseItem.requested_qty || "0.00",
        available_qty: baseItem.purchase_qty ?? baseItem.available_qty ?? baseItem.physical_qty ?? "0.00",
        order_qty: qty,
      },
    ]);

    setManualSelectedItemId("");
    setManualQty("");
    setManualRef("");
  };

  const handleUpdateItemQty = (id, newQty) => {
    setOrderItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, order_qty: newQty } : item))
    );
  };

  const handleRemoveItem = (id) => {
    setOrderItems((prev) => prev.filter((item) => item.id !== id));
  };

  const totalQuantity = useMemo(() => {
    const sum = orderItems.reduce((acc, i) => acc + (Number(i.order_qty) || 0), 0);
    return Math.round(sum * 100) / 100;
  }, [orderItems]);

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!selectedVendorId) {
      setError("Please select a vendor.");
      return;
    }
    if (orderItems.length === 0) {
      setError("Please add at least one item to order.");
      return;
    }

    const hasInvalidQty = orderItems.some((i) => Number(i.order_qty) <= 0);
    if (hasInvalidQty) {
      setError("All items must have an Order Qty greater than 0.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const payload = {
        vendor_id: selectedVendorId,
        items: orderItems.map((item) => ({
          item_code_ref_id: item.item_code_ref_id,
          item_code: item.item_code,
          item_name: item.item_name,
          item_category: item.item_category,
          combined_label: item.combined_label,
          requested_qty: item.requested_qty,
          order_qty: item.order_qty,
          stage: item.stage || "Manual",
          reference_number: item.reference_number || "",
          project_id: item.project_id || "",
          project_name: item.project_name || "",
          costing_item_id: item.stage === "Costing" ? item.item_id : null,
          quotation_item_id: item.stage === "Quotation" ? item.item_id : null,
        })),
      };

      const result = await createPlaceStockOrder(payload);
      setSuccessInfo(result.order);
      if (onSuccess) {
        onSuccess(result.order);
      }
    } catch (err) {
      setError(err.message || "Failed to create Purchase Order.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="costing-modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: "1050px",
          width: "96%",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
        }}
      >
        {/* Modal Header */}
        <div
          className="costing-modal-card__header"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "0.85rem 1.25rem",
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            borderRadius: "8px",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <BsBoxes style={{ fontSize: "1.2rem", color: "#0284c7" }} />
              <h3 className="costing-modal-card__title" style={{ margin: 0, fontWeight: 700, color: "#0f172a", fontSize: "1.15rem" }}>
                Place Purchase Order
              </h3>
            </div>
            <span style={{ fontSize: "0.82rem", color: "#64748b" }}>
              Generate Purchase Order <strong style={{ color: "#0284c7" }}>PO_FY(26_27)_0000+ID</strong> for selected missing stock items
            </span>
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
            }}
          >
            &times;
          </button>
        </div>

        {/* Content Area */}
        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "1rem", padding: "0.2rem" }}>
          {error && (
            <div
              style={{
                padding: "0.75rem 1rem",
                background: "#fef2f2",
                color: "#991b1b",
                border: "1px solid #fecaca",
                borderRadius: "6px",
                fontSize: "0.88rem",
              }}
            >
              {error}
            </div>
          )}

          {successInfo ? (
            <div
              style={{
                padding: "2rem",
                textAlign: "center",
                background: "#f0fdf4",
                border: "1px solid #bbf7d0",
                borderRadius: "10px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "0.75rem",
              }}
            >
              <BsCheckCircleFill style={{ fontSize: "2.8rem", color: "#16a34a" }} />
              <h3 style={{ margin: 0, color: "#166534", fontSize: "1.3rem" }}>
                Purchase Order Created Successfully!
              </h3>
              <div
                style={{
                  background: "#ffffff",
                  padding: "0.6rem 1.4rem",
                  borderRadius: "8px",
                  border: "2px dashed #16a34a",
                  fontSize: "1.2rem",
                  fontWeight: 800,
                  color: "#0f172a",
                  letterSpacing: "0.03em",
                }}
              >
                {successInfo.po_number || successInfo.order_code}
              </div>
              <p style={{ margin: 0, color: "#475569", fontSize: "0.9rem" }}>
                Vendor: <strong>{successInfo.vendor_name}</strong> | Items: <strong>{successInfo.total_items}</strong> | Total Qty: <strong>{successInfo.total_qty}</strong>
              </p>
              <div style={{ marginTop: "1rem", display: "flex", gap: "0.75rem" }}>
                <button
                  type="button"
                  className="crud-add-btn"
                  onClick={() => {
                    onClose();
                    navigate("/stock-purchase/place-order");
                  }}
                  style={{ padding: "0.5rem 1.25rem" }}
                >
                  View in Procurement Orders List
                </button>
                <button
                  type="button"
                  className="users-btn users-btn--secondary"
                  onClick={onClose}
                  style={{ padding: "0.5rem 1.25rem" }}
                >
                  Close
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Vendor Selection Card */}
              <div
                style={{
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                  padding: "1rem",
                }}
              >
                <h4 style={{ margin: "0 0 0.65rem 0", fontSize: "0.95rem", color: "#1e293b", fontWeight: 700 }}>
                  1. Vendor Information
                </h4>
                <div style={{ maxWidth: "450px", marginBottom: "0.75rem" }}>
                  <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: "#475569", marginBottom: "4px" }}>
                    Select Vendor *
                  </label>
                  <Select
                    className="crud-select"
                    classNamePrefix="crud-select"
                    isSearchable
                    isLoading={loadingVendors}
                    placeholder="Search & select vendor..."
                    menuPosition="fixed"
                    menuPortalTarget={typeof document !== "undefined" ? document.body : null}
                    styles={{
                      menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                      menu: (base) => ({ ...base, zIndex: 9999 }),
                    }}
                    options={vendors.map((v) => ({
                      value: String(v.id),
                      label: `${v.vendor_name}${v.vendor_code ? ` (${v.vendor_code})` : ""}`,
                    }))}
                    value={
                      selectedVendor
                        ? {
                            value: String(selectedVendor.id),
                            label: `${selectedVendor.vendor_name}${selectedVendor.vendor_code ? ` (${selectedVendor.vendor_code})` : ""}`,
                          }
                        : null
                    }
                    onChange={(opt) => setSelectedVendorId(opt ? opt.value : "")}
                  />
                </div>

                {/* Vendor Details Grid */}
                {selectedVendor && (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                      gap: "0.75rem",
                      background: "#ffffff",
                      border: "1px solid #cbd5e1",
                      borderRadius: "6px",
                      padding: "0.75rem 1rem",
                      fontSize: "0.82rem",
                    }}
                  >
                    <div>
                      <span style={{ color: "#64748b", display: "block" }}>Vendor Code</span>
                      <strong style={{ color: "#0f172a" }}>{selectedVendor.vendor_code || "—"}</strong>
                    </div>
                    <div>
                      <span style={{ color: "#64748b", display: "block" }}>Contact Person</span>
                      <strong style={{ color: "#0f172a" }}>{selectedVendor.contact_person || "—"}</strong>
                    </div>
                    <div>
                      <span style={{ color: "#64748b", display: "block" }}>Phone Number</span>
                      <strong style={{ color: "#0f172a" }}>{selectedVendor.phone_number || "—"}</strong>
                    </div>
                    <div>
                      <span style={{ color: "#64748b", display: "block" }}>Email</span>
                      <strong style={{ color: "#0f172a" }}>{selectedVendor.email_id || "—"}</strong>
                    </div>
                    <div style={{ gridColumn: "1 / -1" }}>
                      <span style={{ color: "#64748b", display: "block" }}>Address</span>
                      <span style={{ color: "#334155" }}>{selectedVendor.address || "—"}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Order Items Section */}
              <div
                style={{
                  background: "#ffffff",
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                  padding: "1rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.75rem",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
                  <h4 style={{ margin: 0, fontSize: "0.95rem", color: "#1e293b", fontWeight: 700 }}>
                    2. Items to Order ({orderItems.length})
                  </h4>
                  <button
                    type="button"
                    className="crud-add-btn"
                    onClick={() => setShowAddManual(!showAddManual)}
                    style={{ fontSize: "0.8rem", padding: "0.3rem 0.75rem", display: "inline-flex", alignItems: "center", gap: "4px" }}
                  >
                    <BsPlusLg /> {showAddManual ? "Hide Manual Add" : "Add Item Manually"}
                  </button>
                </div>

                {/* Manual Add Card */}
                {showAddManual && (
                  <div
                    style={{
                      background: "#f0f9ff",
                      border: "1px solid #bae6fd",
                      borderRadius: "6px",
                      padding: "0.75rem",
                      display: "flex",
                      alignItems: "flex-end",
                      gap: "0.75rem",
                      flexWrap: "wrap",
                    }}
                  >
                    <div style={{ flex: 1, minWidth: "260px" }}>
                      <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, color: "#0369a1", marginBottom: "3px" }}>
                        Pick Item to Order *
                      </label>
                      <Select
                        className="crud-select"
                        classNamePrefix="crud-select"
                        isSearchable
                        placeholder="Search item to order..."
                        menuPosition="fixed"
                        menuPortalTarget={typeof document !== "undefined" ? document.body : null}
                        styles={{
                          menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                          menu: (base) => ({ ...base, zIndex: 9999 }),
                        }}
                        options={availableManualItemOptions}
                        value={
                          availableManualItemOptions.find((opt) => opt.value === manualSelectedItemId) || null
                        }
                        onChange={(opt) => {
                          setManualSelectedItemId(opt ? opt.value : "");
                          if (opt?.item?.order_qty) {
                            setManualQty(String(opt.item.order_qty));
                          }
                        }}
                      />
                    </div>
                    <div style={{ width: "110px" }}>
                      <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, color: "#0369a1", marginBottom: "3px" }}>
                        Order Qty *
                      </label>
                      <input
                        type="number"
                        min="0.01"
                        step="any"
                        className="auth-input"
                        value={manualQty}
                        onChange={(e) => setManualQty(e.target.value)}
                        placeholder="Qty"
                        style={{ height: "38px" }}
                      />
                    </div>
                    <div style={{ width: "160px" }}>
                      <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, color: "#0369a1", marginBottom: "3px" }}>
                        Project / Ref (Optional)
                      </label>
                      <input
                        type="text"
                        className="auth-input"
                        value={manualRef}
                        onChange={(e) => setManualRef(e.target.value)}
                        placeholder="e.g. PRJ-01 or Min Stock"
                        style={{ height: "38px" }}
                      />
                    </div>
                    <button
                      type="button"
                      className="crud-add-btn"
                      onClick={handleAddManualItem}
                      disabled={!manualSelectedItemId || Number(manualQty) <= 0}
                      style={{ height: "38px", padding: "0 1rem" }}
                    >
                      Add Item
                    </button>
                  </div>
                )}

                {/* Items Table */}
                <div
                  className="card-table-wrap"
                  style={{
                    maxHeight: "36vh",
                    overflowY: "auto",
                    border: "1px solid #e2e8f0",
                    borderRadius: "6px",
                  }}
                >
                  <table className="users-table" style={{ width: "100%", tableLayout: "fixed", borderCollapse: "collapse" }}>
                    <thead style={{ position: "sticky", top: 0, zIndex: 3, background: "#f8fafc" }}>
                      <tr>
                        <th style={{ width: "38px", textAlign: "center" }}>#</th>
                        <th style={{ width: "85px" }}>Stage</th>
                        <th style={{ width: "auto" }}>Item (Code _ Category _ Name)</th>
                        <th style={{ width: "140px" }}>Project / Ref</th>
                        <th style={{ width: "95px", textAlign: "right" }}>Reqd Qty</th>
                        <th style={{ width: "105px", textAlign: "right" }}>Available Qty</th>
                        <th style={{ width: "110px", textAlign: "right" }}>Order Qty *</th>
                        <th style={{ width: "45px", textAlign: "center" }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orderItems.length === 0 ? (
                        <tr>
                          <td colSpan={8} style={{ textAlign: "center", padding: "2rem", color: "#64748b" }}>
                            No items selected. Use &ldquo;Add Item Manually&rdquo; above to pick items to order.
                          </td>
                        </tr>
                      ) : (
                        orderItems.map((item, idx) => (
                          <tr key={`${item.id}-${idx}`}>
                            <td style={{ textAlign: "center", color: "#64748b", fontSize: "0.82rem", verticalAlign: "top" }}>
                              {idx + 1}
                            </td>
                            <td style={{ verticalAlign: "top" }}>
                              <span
                                style={{
                                  background: item.stage === "Costing" ? "rgba(139, 92, 246, 0.12)" : "rgba(2, 132, 199, 0.12)",
                                  color: item.stage === "Costing" ? "#7c3aed" : "#0284c7",
                                  border: `1px solid ${item.stage === "Costing" ? "rgba(139, 92, 246, 0.35)" : "rgba(2, 132, 199, 0.35)"}`,
                                  padding: "2px 8px",
                                  borderRadius: "12px",
                                  fontSize: "0.75rem",
                                  fontWeight: 600,
                                  whiteSpace: "nowrap",
                                  display: "inline-block",
                                }}
                              >
                                {item.stage || "Manual"}
                              </span>
                            </td>
                            <td style={{ verticalAlign: "top", whiteSpace: "normal", wordBreak: "break-word" }}>
                              <strong style={{ color: "#0f172a", fontSize: "0.85rem", lineHeight: 1.4, display: "block" }}>
                                {item.combined_label || `${item.item_code} _ ${item.item_category} _ ${item.item_name}`}
                              </strong>
                            </td>
                            <td style={{ verticalAlign: "top", fontSize: "0.82rem", color: "#475569", whiteSpace: "normal", wordBreak: "break-word" }}>
                              {item.project_id && item.project_id !== "—" ? (
                                <div>
                                  <span style={{ fontWeight: 600, color: "#0f172a" }}>{item.project_id}</span>
                                  {item.reference_number && item.reference_number !== "—" && (
                                    <span style={{ color: "#64748b", marginLeft: "0.3rem" }}>({item.reference_number})</span>
                                  )}
                                </div>
                              ) : item.reference_number && item.reference_number !== "—" ? (
                                <span>{item.reference_number}</span>
                              ) : (
                                <span style={{ color: "#94a3b8" }}>—</span>
                              )}
                            </td>
                            <td style={{ textAlign: "right", color: "#64748b", verticalAlign: "top", whiteSpace: "nowrap" }}>
                              {item.requested_qty || "0.00"}
                            </td>
                            <td style={{ textAlign: "right", color: "#64748b", verticalAlign: "top", whiteSpace: "nowrap" }}>
                              {item.purchase_qty ?? item.available_qty ?? "0.00"}
                            </td>
                            <td style={{ textAlign: "right" }}>
                              <input
                                type="number"
                                min="0.01"
                                step="any"
                                className="auth-input"
                                value={item.order_qty}
                                onChange={(e) => handleUpdateItemQty(item.id, e.target.value)}
                                style={{
                                  width: "95px",
                                  textAlign: "right",
                                  padding: "3px 6px",
                                  fontWeight: 700,
                                  color: "#0369a1",
                                  border: "1px solid #cbd5e1",
                                  borderRadius: "4px",
                                }}
                              />
                            </td>
                            <td style={{ textAlign: "center" }}>
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(item.id)}
                                style={{
                                  background: "none",
                                  border: "none",
                                  cursor: "pointer",
                                  color: "#dc2626",
                                  padding: "4px",
                                }}
                                title="Remove item"
                              >
                                <BsTrash />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Table Summary Footer */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "0.5rem 0.75rem",
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: "6px",
                    fontSize: "0.85rem",
                  }}
                >
                  <span style={{ color: "#475569" }}>
                    Total Line Items: <strong>{orderItems.length}</strong>
                  </span>
                  <span style={{ color: "#0284c7", fontWeight: 700, fontSize: "0.95rem" }}>
                    Total Order Quantity: {totalQuantity}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        {!successInfo && (
          <div
            className="costing-modal-card__footer"
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "0.75rem 0.25rem 0",
              borderTop: "1px solid #e2e8f0",
            }}
          >
            <button
              type="button"
              className="users-btn users-btn--secondary"
              onClick={onClose}
              disabled={submitting}
              style={{ padding: "0.45rem 1.4rem", fontSize: "0.85rem", borderRadius: "6px", cursor: "pointer" }}
            >
              Cancel
            </button>

            <button
              type="button"
              className="crud-add-btn"
              onClick={handleSubmit}
              disabled={submitting || !selectedVendorId || orderItems.length === 0}
              style={{ padding: "0.5rem 1.75rem", fontSize: "0.9rem", fontWeight: 700 }}
            >
              {submitting ? "Creating Order..." : "Create Purchase Order"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
