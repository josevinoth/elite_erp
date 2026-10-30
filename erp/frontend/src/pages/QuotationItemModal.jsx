import { useEffect, useState } from "react";
import { BsPencilSquare, BsPlusCircleFill, BsXCircleFill } from "react-icons/bs";
import { CardBody, CardHeader } from "../components/Card";
import ConfirmPopupModal from "../components/ConfirmPopupModal";

const toNumber = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

const toMoney = (value, decimals = 2) => (
  (Math.round((toNumber(value) + Number.EPSILON) * (10 ** decimals)) / (10 ** decimals)).toFixed(decimals)
);

function QuotationItemModal({
  isOpen,
  onClose,
  isEditMode = false,
  itemToEdit = null,
  combinedItemOptions = [],
  roomOptions = [],
  costTypes = [],
  materialCostTypeId = null,
  getItemCostPreview = null,
  openRoomModal = null,
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
  const [formError, setFormError] = useState("");
  const [loadingCost, setLoadingCost] = useState(false);
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

  useEffect(() => {
    if (!isOpen) return;
    setFormError("");
    setLoadingCost(false);
    setSaving(false);

    if (isEditMode && itemToEdit) {
      const master = combinedItemOptions.find(
        (m) => String(m.id) === String(itemToEdit.item_code_id) || String(m.item_code) === String(itemToEdit.item_code)
      );
      const masterId = master ? String(master.id) : String(itemToEdit.item_code_id || "");
      const initialForm = {
        room_name_id: String(itemToEdit.room_name?.id || itemToEdit.room_name_id || ""),
        cost_type_id: String(itemToEdit.cost_type?.id || itemToEdit.cost_type_id || ""),
        item_code_id: masterId,
        item_code: itemToEdit.item_code || master?.item_code || "",
        item_name: itemToEdit.item_name || master?.item_name || "",
        item_category_id: String(itemToEdit.item_category_id || master?.item_category_id || ""),
        item_category: itemToEdit.item_category || master?.item_category || "",
        item_type: itemToEdit.item_type || master?.item_type || "",
        purchase_qty: String(itemToEdit.purchase_qty ?? master?.available_qty ?? "0"),
        requested_qty: String(itemToEdit.requested_qty ?? "1"),
        lce_cost: String(itemToEdit.actual_cost || itemToEdit.cost_per_qty || "0"),
        total_cost: String(itemToEdit.total_cost || "0"),
      };
      setForm(initialForm);

      if (initialForm.item_code && getItemCostPreview) {
        setLoadingCost(true);
        getItemCostPreview(initialForm.item_code, initialForm.requested_qty || 1)
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
    }
  }, [isOpen, isEditMode, itemToEdit, combinedItemOptions, roomOptions, costTypes, materialCostTypeId, getItemCostPreview]);

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

    if (getItemCostPreview) {
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
    setForm((prev) => {
      const nextQty = val;
      const lceCost = toNumber(prev.lce_cost);
      return {
        ...prev,
        requested_qty: nextQty,
        total_cost: toMoney(toNumber(nextQty) * lceCost),
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

    const payload = {
      cost_type_id: form.cost_type_id,
      item_category_id: isMaterial ? form.item_category_id || null : null,
      item_name: form.item_name,
      item_code_id: isMaterial ? form.item_code_id || null : null,
      room_name_id: form.room_name_id || null,
      requested_qty: String(form.requested_qty || "1"),
      actual_cost: String(form.lce_cost || "0"),
    };

    setSaving(true);
    try {
      await onSaveItem(payload, isEditMode ? itemToEdit?.id : null);
      onClose();
    } catch (err) {
      const msg = err.message || "Failed to save quotation item.";
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

  const isMaterial = isMaterialCostType(form.cost_type_id);
  const lceCostNum = toNumber(form.lce_cost);
  const isSaveDisabled =
    saving ||
    loadingCost ||
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
        <CardHeader style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h3 style={{ margin: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}>
            {isEditMode ? <BsPencilSquare /> : <BsPlusCircleFill />}
            {isEditMode ? "Edit Quotation Item" : "Add Quotation Item"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#ffffff",
              fontSize: "1.3rem",
              display: "flex",
              alignItems: "center",
            }}
            aria-label="Close"
          >
            <BsXCircleFill />
          </button>
        </CardHeader>

        <CardBody style={{ padding: "1.25rem 1.5rem", overflowY: "auto", flex: "1 1 auto" }}>
          {formError ? (
            <p className="users-status users-status--error" style={{ margin: "0 0 1rem", padding: "0.6rem 0.8rem" }}>
              {formError}
            </p>
          ) : null}

          <form onSubmit={handleSubmit}>
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {/* Room Field */}
              <div className="modal-field-row">
                <label className="modal-field-row__label">
                  Room <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <div className="modal-field-row__control">
                  <select
                    className="form-control auth-input"
                    value={form.room_name_id}
                    onChange={(e) => setForm((prev) => ({ ...prev, room_name_id: e.target.value }))}
                    required
                  >
                    <option value="">Select Room</option>
                    {roomOptions.map((room) => (
                      <option key={room.id} value={String(room.id)}>
                        {room.room_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Cost Type */}
              <div className="modal-field-row">
                <label className="modal-field-row__label">
                  Cost Type <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <div className="modal-field-row__control">
                  <select
                    className="form-control auth-input"
                    value={form.cost_type_id}
                    onChange={(e) => {
                      const nextVal = e.target.value;
                      setForm((prev) => ({
                        ...prev,
                        cost_type_id: nextVal,
                        item_code_id: "",
                        item_code: "",
                        item_name: "",
                        item_category_id: "",
                        item_category: "",
                        lce_cost: "0",
                        total_cost: "0",
                      }));
                    }}
                    required
                  >
                    <option value="">Select Cost Type</option>
                    {costTypes.map((ct) => (
                      <option key={ct.id} value={String(ct.id)}>
                        {ct.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Combined Item Code Dropdown (only for MATERIAL) */}
              {isMaterial ? (
                <div className="modal-field-row">
                  <label className="modal-field-row__label">
                    Item Code <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <div className="modal-field-row__control">
                    <select
                      className="form-control auth-input"
                      value={form.item_code_id}
                      onChange={(e) => handleItemSelect(e.target.value)}
                      required
                    >
                      <option value="">Select Item (Item Code - Name - Category)</option>
                      {combinedItemOptions.map((item) => (
                        <option key={`opt-item-${item.id}`} value={item.id}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                    {loadingCost ? (
                      <small style={{ color: "#64748b", fontSize: "0.78rem", marginTop: "0.2rem", display: "block" }}>
                        Verifying item...
                      </small>
                    ) : null}
                  </div>
                </div>
              ) : (
                /* Non-MATERIAL custom item name & unit cost */
                <>
                  <div className="modal-field-row">
                    <label className="modal-field-row__label">
                      Item Name <span style={{ color: "#ef4444" }}>*</span>
                    </label>
                    <div className="modal-field-row__control">
                      <input
                        type="text"
                        className="form-control auth-input"
                        value={form.item_name}
                        onChange={(e) => setForm((prev) => ({ ...prev, item_name: e.target.value }))}
                        placeholder="Enter description/item name"
                        required
                      />
                    </div>
                  </div>
                  <div className="modal-field-row">
                    <label className="modal-field-row__label">
                      Unit Cost (OMR)
                    </label>
                    <div className="modal-field-row__control">
                      <input
                        type="number"
                        step="any"
                        min="0"
                        className="form-control auth-input"
                        value={form.lce_cost}
                        onChange={(e) => {
                          const val = e.target.value;
                          setForm((prev) => ({
                            ...prev,
                            lce_cost: val,
                            total_cost: toMoney(toNumber(prev.requested_qty) * toNumber(val)),
                          }));
                        }}
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Requested Qty */}
              <div className="modal-field-row">
                <label className="modal-field-row__label">
                  Requested Qty <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <div className="modal-field-row__control">
                  <input
                    type="number"
                    min="0.01"
                    step="any"
                    className="form-control auth-input"
                    value={form.requested_qty}
                    onChange={(e) => handleRequestedQtyChange(e.target.value)}
                    placeholder="Enter requested quantity"
                    required
                  />
                </div>
              </div>

              {/* Modal Actions */}
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
                <button type="button" className="modal-btn modal-btn--cancel" onClick={onClose} disabled={saving}>
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

export default QuotationItemModal;
