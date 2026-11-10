import { useEffect, useState } from "react";
import { BsBoxes, BsCheckCircleFill, BsPencilSquare, BsPlusCircleFill, BsXCircleFill } from "react-icons/bs";
import { CardBody, CardHeader } from "../components/Card";
import ConfirmPopupModal from "../components/ConfirmPopupModal";

const toNumber = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

const toMoney = (value, decimals = 2) => (
  (Math.round((toNumber(value) + Number.EPSILON) * (10 ** decimals)) / (10 ** decimals)).toFixed(decimals)
);

function CostingItemModal({
  isOpen,
  onClose,
  isEditMode = false,
  itemToEdit = null,
  combinedItemOptions = [],
  roomOptions = [],
  costTypes = [],
  materialCostTypeId = null,
  getItemCostPreview = null,
  listPurchaseItemGRNs = null,
  onSaveItem,
}) {
  const [form, setForm] = useState({
    room_name_id: "",
    cost_type_id: "",
    item_code_id: "",
    item_code: "",
    item_name: "",
    item_category_id: "",
    item_category: "",
    item_type: "",
    purchase_qty: "0",
    requested_qty: "1",
    lce_cost: "0",
    total_cost: "0",
  });
  const [availableBalance, setAvailableBalance] = useState(0);
  const [availableGrns, setAvailableGrns] = useState([]);
  const [formError, setFormError] = useState("");
  const [loadingCost, setLoadingCost] = useState(false);
  const [loadingGrns, setLoadingGrns] = useState(false);
  const [saving, setSaving] = useState(false);

  const [alertModal, setAlertModal] = useState({
    open: false,
    title: "Alert",
    message: "",
    type: "warning",
  });

  const isMaterialCostType = (costTypeId) => {
    const normalized = String(costTypeId || "").trim();
    if (!normalized) return false;
    if (materialCostTypeId && normalized === String(materialCostTypeId)) return true;
    const option = costTypes.find((c) => String(c.id) === normalized);
    return String(option?.name || "").trim().toUpperCase() === "MATERIAL";
  };

  const isMaterial = isMaterialCostType(form.cost_type_id);

  useEffect(() => {
    if (!isOpen) return;
    setFormError("");
    setLoadingCost(false);
    setLoadingGrns(false);
    setSaving(false);

    if (isEditMode && itemToEdit) {
      const master = combinedItemOptions.find(
        (m) => String(m.id) === String(itemToEdit.item_code_id) || String(m.item_code) === String(itemToEdit.item_code)
      );
      const masterId = master ? String(master.id) : String(itemToEdit.item_code_id || "");
      const itemCodeVal = itemToEdit.item_code || master?.item_code || "";

      setForm({
        room_name_id: String(itemToEdit.room_name?.id || itemToEdit.room_name_id || ""),
        cost_type_id: String(itemToEdit.cost_type?.id || itemToEdit.cost_type_id || ""),
        item_code_id: masterId,
        item_code: itemCodeVal,
        item_name: itemToEdit.item_name || master?.item_name || "",
        item_category_id: String(itemToEdit.item_category_id || master?.item_category_id || ""),
        item_category: itemToEdit.item_category || master?.item_category || "",
        item_type: itemToEdit.item_type || master?.item_type || "",
        purchase_qty: String(itemToEdit.purchase_qty ?? master?.available_qty ?? "0"),
        requested_qty: String(itemToEdit.requested_qty ?? "1"),
        lce_cost: String(itemToEdit.actual_cost || itemToEdit.cost_per_qty || "0"),
        total_cost: String(itemToEdit.total_cost || "0"),
      });

      // Fetch GRNs and available stock for this item
      if (itemCodeVal && listPurchaseItemGRNs) {
        setLoadingGrns(true);
        listPurchaseItemGRNs(itemCodeVal)
          .then((data) => {
            const grnList = Array.isArray(data?.grns) ? data.grns : [];
            setAvailableGrns(grnList);
            const totalBal = grnList.reduce((sum, g) => sum + toNumber(g.balance_qty), 0);
            setAvailableBalance(totalBal);
          })
          .catch(() => {})
          .finally(() => setLoadingGrns(false));
      }

      // Check LCE cost preview
      if (itemCodeVal && getItemCostPreview) {
        setLoadingCost(true);
        getItemCostPreview(itemCodeVal, itemToEdit.requested_qty || 1)
          .then((preview) => {
            const fetchedCost = toNumber(preview?.lce_cost);
            if (fetchedCost > 0) {
              setForm((prev) => ({
                ...prev,
                lce_cost: String(fetchedCost),
                total_cost: toMoney(toNumber(prev.requested_qty) * fetchedCost),
              }));
            }
          })
          .catch(() => {})
          .finally(() => setLoadingCost(false));
      }
    } else {
      const defaultCostType = materialCostTypeId
        ? String(materialCostTypeId)
        : (costTypes.find((c) => String(c.name || "").toUpperCase() === "MATERIAL")?.id || costTypes[0]?.id || "");
      const defaultRoom = roomOptions[0]?.id ? String(roomOptions[0].id) : "";

      setForm({
        room_name_id: defaultRoom,
        cost_type_id: String(defaultCostType),
        item_code_id: "",
        item_code: "",
        item_name: "",
        item_category_id: "",
        item_category: "",
        item_type: "",
        purchase_qty: "0",
        requested_qty: "1",
        lce_cost: "0",
        total_cost: "0",
      });
      setAvailableBalance(0);
      setAvailableGrns([]);
    }
  }, [
    isOpen,
    isEditMode,
    itemToEdit,
    combinedItemOptions,
    roomOptions,
    costTypes,
    materialCostTypeId,
    getItemCostPreview,
    listPurchaseItemGRNs,
  ]);

  if (!isOpen) return null;

  const handleItemSelect = async (masterId) => {
    setFormError("");
    if (!masterId) {
      setForm((prev) => ({
        ...prev,
        item_code_id: "",
        item_code: "",
        item_name: "",
        item_category_id: "",
        item_category: "",
        item_type: "",
        purchase_qty: "0",
        lce_cost: "0",
        total_cost: "0",
      }));
      setAvailableBalance(0);
      setAvailableGrns([]);
      return;
    }

    const selected = combinedItemOptions.find((item) => String(item.id) === String(masterId));
    if (!selected) return;

    setForm((prev) => ({
      ...prev,
      item_code_id: String(selected.id),
      item_code: selected.item_code,
      item_name: selected.item_name,
      item_category_id: String(selected.item_category_id || ""),
      item_category: selected.item_category || "",
      item_type: selected.item_type || "",
      purchase_qty: String(selected.available_qty ?? "0"),
      lce_cost: "0",
      total_cost: "0",
    }));

    // Fetch GRNs for FIFO allocation and available balance
    if (listPurchaseItemGRNs && selected.item_code) {
      setLoadingGrns(true);
      try {
        const grnData = await listPurchaseItemGRNs(selected.item_code);
        const grns = Array.isArray(grnData?.grns) ? grnData.grns : [];
        setAvailableGrns(grns);
        const totalBal = grns.reduce((sum, g) => sum + toNumber(g.balance_qty), 0);
        setAvailableBalance(totalBal);

        if (totalBal <= 0) {
          setFormError(`No available stock in GRNs for item code '${selected.item_code}'.`);
        } else if (toNumber(form.requested_qty) > totalBal) {
          setForm((prev) => ({ ...prev, requested_qty: String(totalBal) }));
        }
      } catch (_e) {
        setAvailableGrns([]);
        setAvailableBalance(0);
      } finally {
        setLoadingGrns(false);
      }
    }

    // Fetch LCE cost
    if (getItemCostPreview && selected.item_code) {
      setLoadingCost(true);
      try {
        const preview = await getItemCostPreview(selected.item_code, form.requested_qty || 1);
        const lceCost = toNumber(preview?.lce_cost);
        if (lceCost <= 0) {
          const errMsg = `LCE cost is not available or 0 for item code '${selected.item_code}'. You cannot add this item.`;
          setFormError(errMsg);
          setAlertModal({
            open: true,
            title: "Cannot Add Item",
            message: errMsg,
            type: "warning",
          });
          setForm((prev) => ({
            ...prev,
            lce_cost: "0",
            total_cost: "0",
          }));
        } else {
          setForm((prev) => {
            const reqQty = toNumber(prev.requested_qty) || 1;
            return {
              ...prev,
              lce_cost: String(lceCost),
              total_cost: toMoney(reqQty * lceCost),
            };
          });
        }
      } catch (_err) {
        setFormError("Failed to fetch LCE cost for this item code.");
      } finally {
        setLoadingCost(false);
      }
    }
  };

  const handleRequestedQtyChange = (val) => {
    setFormError("");
    const numericVal = toNumber(val);

    // If material and availableBalance is tracked, check limit
    if (isMaterial && availableBalance > 0 && numericVal > availableBalance) {
      setAlertModal({
        open: true,
        title: "Quantity Exceeds Available Stock",
        message: `Requested Qty (${val}) exceeds the available stock (${availableBalance}) for item code '${form.item_code}'. Setting quantity to maximum available balance.`,
        type: "warning",
      });
      setForm((prev) => {
        const lceCost = toNumber(prev.lce_cost);
        return {
          ...prev,
          requested_qty: String(availableBalance),
          total_cost: toMoney(availableBalance * lceCost),
        };
      });
      return;
    }

    setForm((prev) => {
      const lceCost = toNumber(prev.lce_cost);
      return {
        ...prev,
        requested_qty: val,
        total_cost: toMoney(numericVal * lceCost),
      };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");

    const isMaterial = isMaterialCostType(form.cost_type_id);
    if (isMaterial) {
      if (!form.item_code_id) {
        setFormError("Please select an item code.");
        return;
      }
      const lceCost = toNumber(form.lce_cost);
      if (lceCost <= 0) {
        const errMsg = `LCE cost is not available or 0 for item code '${form.item_code}'. You cannot add this item.`;
        setFormError(errMsg);
        setAlertModal({
          open: true,
          title: "Cannot Add Item",
          message: errMsg,
          type: "warning",
        });
        return;
      }
    } else {
      if (!String(form.item_name || "").trim()) {
        setFormError("Item name is required.");
        return;
      }
    }

    if (!form.room_name_id) {
      setFormError("Please select a room.");
      return;
    }

    const reqQty = toNumber(form.requested_qty);
    if (reqQty <= 0) {
      setFormError("Requested Qty must be greater than 0.");
      return;
    }

    // Auto-calculate FIFO allocations from available GRNs
    let remainingToAllocate = reqQty;
    const fifoAllocations = [];
    if (isMaterial && availableGrns.length > 0) {
      for (const grn of availableGrns) {
        if (remainingToAllocate <= 0) break;
        const bal = toNumber(grn.balance_qty);
        if (bal > 0) {
          const allocQty = Math.min(remainingToAllocate, bal);
          fifoAllocations.push({
            purchase_item_id: grn.id,
            allocated_qty: String(allocQty),
          });
          remainingToAllocate -= allocQty;
        }
      }
    }

    const payload = {
      cost_type_id: form.cost_type_id,
      item_category_id: isMaterial ? form.item_category_id || null : null,
      item_name: form.item_name,
      item_code_id: isMaterial ? form.item_code_id || null : null,
      room_name_id: form.room_name_id || null,
      requested_qty: String(form.requested_qty || "1"),
      actual_cost: String(form.lce_cost || "0"),
      ...(fifoAllocations.length > 0 ? { grn_allocations: fifoAllocations } : {}),
    };

    setSaving(true);
    try {
      await onSaveItem(payload, isEditMode ? itemToEdit?.id : null);
      onClose();
    } catch (err) {
      const msg = err.message || "Failed to save costing item.";
      setFormError(msg);
      setAlertModal({
        open: true,
        title: "Error",
        message: msg,
        type: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  const lceCostNum = toNumber(form.lce_cost);
  const isSaveDisabled =
    saving ||
    loadingCost ||
    loadingGrns ||
    !form.room_name_id ||
    toNumber(form.requested_qty) <= 0 ||
    (isMaterial && (!form.item_code_id || lceCostNum <= 0));

  return (
    <div
      className="modal-backdrop-custom"
      role="presentation"
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(15, 23, 42, 0.6)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1200,
        padding: "1rem",
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "min(680px, 94vw)",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          borderRadius: "10px",
          overflow: "hidden",
          boxShadow: "0 20px 45px rgba(0,0,0,0.3)",
          background: "#ffffff",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <CardHeader
          style={{
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "linear-gradient(135deg, #2a3042 0%, #36405a 100%)",
            color: "#ffffff",
            padding: "0.85rem 1.25rem",
          }}
        >
          <h3
            style={{
              margin: 0,
              display: "flex",
              alignItems: "center",
              gap: "0.55rem",
              color: "#ffffff",
              fontSize: "1.05rem",
              fontWeight: 600,
            }}
          >
            {isEditMode ? <BsPencilSquare /> : <BsPlusCircleFill />}
            {isEditMode ? "Edit Costing Item" : "Add Costing Item"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "#ffffff",
              cursor: "pointer",
              fontSize: "1.2rem",
              display: "flex",
              alignItems: "center",
              padding: 0,
            }}
            aria-label="Close"
          >
            <BsXCircleFill />
          </button>
        </CardHeader>

        <CardBody style={{ padding: "1.25rem 1.5rem", overflowY: "auto", flex: 1 }}>
          {formError ? (
            <div
              style={{
                background: "#fef2f2",
                border: "1px solid #fecaca",
                color: "#dc2626",
                padding: "0.65rem 0.85rem",
                borderRadius: "6px",
                marginBottom: "1rem",
                fontSize: "0.85rem",
              }}
            >
              {formError}
            </div>
          ) : null}

          <form onSubmit={handleSubmit}>
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {/* Room Selection */}
              <div
                className="modal-field-row"
                style={{
                  display: "grid",
                  gridTemplateColumns: "140px 1fr",
                  alignItems: "center",
                  gap: "1rem",
                }}
              >
                <label style={{ margin: 0, fontWeight: 600, color: "#334155", fontSize: "0.88rem" }}>
                  Room <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <select
                  className="auth-input"
                  style={{ width: "100%", height: "38px" }}
                  value={form.room_name_id}
                  onChange={(e) => setForm((prev) => ({ ...prev, room_name_id: e.target.value }))}
                  required
                >
                  <option value="">Select Room</option>
                  {roomOptions.map((room) => (
                    <option key={room.id} value={room.id}>
                      {room.room_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Cost Type Selection */}
              <div
                className="modal-field-row"
                style={{
                  display: "grid",
                  gridTemplateColumns: "140px 1fr",
                  alignItems: "center",
                  gap: "1rem",
                }}
              >
                <label style={{ margin: 0, fontWeight: 600, color: "#334155", fontSize: "0.88rem" }}>
                  Cost Type <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <select
                  className="auth-input"
                  style={{ width: "100%", height: "38px" }}
                  value={form.cost_type_id}
                  onChange={(e) => setForm((prev) => ({ ...prev, cost_type_id: e.target.value }))}
                  required
                >
                  {costTypes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Material: Combined Item Code dropdown */}
              {isMaterial ? (
                <div
                  className="modal-field-row"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "140px 1fr",
                    alignItems: "center",
                    gap: "1rem",
                  }}
                >
                  <label style={{ margin: 0, fontWeight: 600, color: "#334155", fontSize: "0.88rem" }}>
                    Item Code <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <div>
                    <select
                      className="auth-input"
                      style={{ width: "100%", height: "38px", color: "#1e293b", backgroundColor: "#ffffff" }}
                      value={form.item_code_id}
                      onChange={(e) => handleItemSelect(e.target.value)}
                      required
                    >
                      <option value="">Select Item (Code - Name - Category)</option>
                      {combinedItemOptions.map((item) => (
                        <option key={item.id} value={item.id} style={{ color: "#1e293b", backgroundColor: "#ffffff" }}>
                          {item.label || item.displayText || `${item.item_code || ""} - ${item.item_name || ""}`}
                        </option>
                      ))}
                    </select>

                    {/* Stock balance & LCE status indicators */}
                    <div style={{ marginTop: "0.35rem", display: "flex", gap: "0.75rem", alignItems: "center" }}>
                      {loadingCost || loadingGrns ? (
                        <span style={{ fontSize: "0.78rem", color: "#64748b" }}>Checking stock & pricing...</span>
                      ) : null}

                      {form.item_code_id && !loadingGrns ? (
                        <span
                          style={{
                            fontSize: "0.78rem",
                            fontWeight: 600,
                            padding: "0.15rem 0.5rem",
                            borderRadius: "4px",
                            background: availableBalance > 0 ? "rgba(34, 197, 94, 0.12)" : "rgba(239, 68, 68, 0.12)",
                            color: availableBalance > 0 ? "#16a34a" : "#dc2626",
                          }}
                        >
                          {availableBalance > 0
                            ? `Available Stock (FIFO): ${availableBalance} units`
                            : "No stock available in GRNs"}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : (
                /* Non-material item name */
                <div
                  className="modal-field-row"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "140px 1fr",
                    alignItems: "center",
                    gap: "1rem",
                  }}
                >
                  <label style={{ margin: 0, fontWeight: 600, color: "#334155", fontSize: "0.88rem" }}>
                    Item Name <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <input
                    type="text"
                    className="auth-input"
                    style={{ width: "100%", height: "38px" }}
                    value={form.item_name}
                    onChange={(e) => setForm((prev) => ({ ...prev, item_name: e.target.value }))}
                    placeholder="Enter item name"
                    required
                  />
                </div>
              )}

              {/* Requested Qty */}
              <div
                className="modal-field-row"
                style={{
                  display: "grid",
                  gridTemplateColumns: "140px 1fr",
                  alignItems: "center",
                  gap: "1rem",
                }}
              >
                <label style={{ margin: 0, fontWeight: 600, color: "#334155", fontSize: "0.88rem" }}>
                  Requested Qty <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <div>
                  <input
                    type="number"
                    min="1"
                    max={isMaterial && availableBalance > 0 ? availableBalance : undefined}
                    className="auth-input"
                    style={{ width: "100%", height: "38px" }}
                    value={form.requested_qty}
                    onChange={(e) => handleRequestedQtyChange(e.target.value)}
                    required
                  />
                  {isMaterial && availableBalance > 0 ? (
                    <small style={{ color: "#64748b", fontSize: "0.78rem", display: "block", marginTop: "0.25rem" }}>
                      Stock will be automatically pulled from earliest available GRNs (FIFO). Max: {availableBalance}.
                    </small>
                  ) : null}
                </div>
              </div>

              {/* Action Buttons */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "0.75rem",
                  marginTop: "1.25rem",
                  paddingTop: "1rem",
                  borderTop: "1px solid #e2e8f0",
                }}
              >
                <button
                  type="button"
                  className="modal-btn modal-btn--cancel"
                  onClick={onClose}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="crud-add-btn"
                  disabled={isSaveDisabled}
                  title={
                    isMaterial && (!form.item_code_id || lceCostNum <= 0)
                      ? "LCE cost must be available and > 0 to add this item"
                      : ""
                  }
                >
                  {saving ? "Saving..." : isEditMode ? "Save Changes" : "Add Item"}
                </button>
              </div>
            </div>
          </form>
        </CardBody>
      </div>

      <ConfirmPopupModal
        open={alertModal.open}
        title={alertModal.title}
        type={alertModal.type}
        message={alertModal.message}
        confirmLabel="OK"
        cancelLabel={null}
        onConfirm={() => setAlertModal((prev) => ({ ...prev, open: false }))}
        onCancel={() => setAlertModal((prev) => ({ ...prev, open: false }))}
      />
    </div>
  );
}

export default CostingItemModal;
