import { useEffect, useMemo, useState } from "react";
import { BsPencilSquare, BsPlusCircleFill, BsXCircleFill } from "react-icons/bs";
import { Card, CardHeader, CardBody } from "../components/Card";

const toNumber = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

const toCurrency = (value) => (Math.round((value + Number.EPSILON) * 100) / 100).toFixed(2);

const computeRowTotalAfterTax = (total_price, tax) => {
    const tp = toNumber(total_price);
    const t = toNumber(tax);
    return toCurrency(tp + tp * (t / 100));
};

const EMPTY_FORM = {
    item_code_id: "",
    item_code: "",
    item_master_id: "",
    item_category_id: "",
    item_category: "",
    item_name: "",
    item_type: "BUY",
    uom_id: "",
    quantity: "",
    unit_price: "",
    total_price: "0.00",
    tax: "5",
    total_after_tax: "0.00",
    grn_number: "",
};

function StockPurchaseItemModal({
    isOpen,
    onClose,
    onSaveItem,
    itemToEdit = null,
    categoryOptions = [],
    itemMasterOptions = [],
    itemTypeOptions = [],
    uomOptions = [],
    existingItems = [],
}) {
    const isEditMode = Boolean(itemToEdit);
    const [form, setForm] = useState(EMPTY_FORM);
    const [formError, setFormError] = useState("");

    useEffect(() => {
        if (!isOpen) return;
        setFormError("");

        if (itemToEdit) {
            const tp = itemToEdit.total_price || toCurrency(toNumber(itemToEdit.quantity) * toNumber(itemToEdit.unit_price));
            const taxVal = itemToEdit.tax !== undefined && itemToEdit.tax !== null && itemToEdit.tax !== "" ? itemToEdit.tax : "5";
            const tat = itemToEdit.total_after_tax || computeRowTotalAfterTax(tp, taxVal);

            setForm({
                item_code_id: String(itemToEdit.item_code_id || itemToEdit.item_master_id || ""),
                item_code: itemToEdit.item_code || "",
                item_master_id: String(itemToEdit.item_master_id || itemToEdit.item_code_id || ""),
                item_category_id: itemToEdit.item_category_id ? String(itemToEdit.item_category_id) : "",
                item_category: itemToEdit.item_category || "",
                item_name: itemToEdit.item_name || "",
                item_type: itemToEdit.item_type || "BUY",
                uom_id: itemToEdit.uom_id ? String(itemToEdit.uom_id) : "",
                quantity: String(itemToEdit.quantity || ""),
                unit_price: String(itemToEdit.unit_price || ""),
                total_price: tp,
                tax: String(taxVal),
                total_after_tax: tat,
                grn_number: itemToEdit.grn_number || "",
            });
        } else {
            setForm(EMPTY_FORM);
        }
    }, [isOpen, itemToEdit]);

    const getItemMasterById = (itemId) => {
        const normalizedId = String(itemId || "").trim();
        if (!normalizedId) return null;
        return itemMasterOptions.find((item) => String(item.id || "") === normalizedId) || null;
    };

    const itemCodesForSelection = useMemo(() => {
        return itemMasterOptions
            .filter((item) => !form.item_category_id || String(item.item_category_id || "") === String(form.item_category_id))
            .map((item) => ({
                id: String(item.id || ""),
                code: String(item.item_code || ""),
                name: String(item.item_name || ""),
                categoryId: String(item.item_category_id || ""),
            }))
            .filter((item) => item.id && item.code)
            .sort((a, b) => a.code.localeCompare(b.code));
    }, [itemMasterOptions, form.item_category_id]);

    const itemNamesForSelection = useMemo(() => {
        return itemMasterOptions
            .filter((item) => !form.item_category_id || String(item.item_category_id || "") === String(form.item_category_id))
            .map((item) => ({
                id: String(item.id || ""),
                code: String(item.item_code || ""),
                name: String(item.item_name || ""),
                categoryId: String(item.item_category_id || ""),
                category: String(item.item_category || ""),
                uomId: item.uom_id ? String(item.uom_id) : "",
            }))
            .filter((item) => item.id && item.name)
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [itemMasterOptions, form.item_category_id]);

    const handleItemCodeSelect = (itemMasterId) => {
        setFormError("");
        if (!itemMasterId) {
            setForm((prev) => ({
                ...prev,
                item_code_id: "",
                item_code: "",
                item_master_id: "",
                item_name: "",
            }));
            return;
        }

        const selected = getItemMasterById(itemMasterId);
        const selectedCategory = selected ? categoryOptions.find((c) => String(c.id) === String(selected.item_category_id || "")) : null;

        setForm((prev) => ({
            ...prev,
            item_code_id: selected ? String(selected.id) : "",
            item_code: selected ? String(selected.item_code || "") : "",
            item_master_id: selected ? String(selected.id) : "",
            item_name: selected ? String(selected.item_name || "") : "",
            item_category_id: selected ? String(selected.item_category_id || "") : prev.item_category_id,
            item_category: selected ? (selectedCategory?.name || selected.item_category || "") : prev.item_category,
            item_type: selected ? String(selected.item_type || "BUY") : prev.item_type,
            uom_id: selected?.uom_id ? String(selected.uom_id) : prev.uom_id,
        }));
    };

    const handleCategorySelect = (categoryId) => {
        setFormError("");
        const selectedCategory = categoryOptions.find((c) => String(c.id) === String(categoryId || ""));
        setForm((prev) => ({
            ...prev,
            item_category_id: String(categoryId || ""),
            item_category: selectedCategory?.name || "",
            item_code_id: "",
            item_code: "",
            item_master_id: "",
            item_name: "",
            uom_id: "",
        }));
    };

    const handleItemNameSelect = (itemMasterId) => {
        setFormError("");
        if (!itemMasterId) {
            setForm((prev) => ({
                ...prev,
                item_code_id: "",
                item_code: "",
                item_master_id: "",
                item_name: "",
            }));
            return;
        }

        const selected = getItemMasterById(itemMasterId);
        const selectedCategory = selected ? categoryOptions.find((c) => String(c.id) === String(selected.item_category_id || "")) : null;

        setForm((prev) => ({
            ...prev,
            item_master_id: selected ? String(selected.id) : "",
            item_code_id: selected ? String(selected.id) : "",
            item_code: selected ? String(selected.item_code || "") : "",
            item_name: selected ? String(selected.item_name || "") : "",
            item_category_id: selected ? String(selected.item_category_id || "") : prev.item_category_id,
            item_category: selected ? (selectedCategory?.name || selected.item_category || "") : prev.item_category,
            item_type: selected ? String(selected.item_type || "BUY") : prev.item_type,
            uom_id: selected?.uom_id ? String(selected.uom_id) : prev.uom_id,
        }));
    };

    const handleNumericChange = (field, val) => {
        setFormError("");
        setForm((prev) => {
            const updated = { ...prev, [field]: val };
            const qty = field === "quantity" ? val : prev.quantity;
            const price = field === "unit_price" ? val : prev.unit_price;
            const taxRate = field === "tax" ? val : prev.tax;

            const tp = toCurrency(toNumber(qty) * toNumber(price));
            const tat = computeRowTotalAfterTax(tp, taxRate);

            updated.total_price = tp;
            updated.total_after_tax = tat;
            return updated;
        });
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        setFormError("");

        // Validation: All fields mandatory
        if (!form.item_code_id && !form.item_code) {
            setFormError("Item Code is mandatory.");
            return;
        }
        if (!form.item_category_id) {
            setFormError("Item Category is mandatory.");
            return;
        }
        if (!String(form.item_name || "").trim()) {
            setFormError("Item Name is mandatory.");
            return;
        }
        if (!String(form.item_type || "").trim()) {
            setFormError("Item Type is mandatory.");
            return;
        }
        if (!form.uom_id) {
            setFormError("UOM is mandatory.");
            return;
        }
        if (!form.quantity || toNumber(form.quantity) <= 0) {
            setFormError("Quantity must be greater than 0.");
            return;
        }
        if (form.unit_price === "" || form.unit_price === null || toNumber(form.unit_price) < 0) {
            setFormError("Unit Price is mandatory and must be 0 or greater.");
            return;
        }
        if (form.tax === "" || form.tax === null || toNumber(form.tax) < 0) {
            setFormError("Tax (%) is mandatory and must be 0 or greater.");
            return;
        }

        // Check for duplicates in existingItems (excluding currently edited item)
        const currentTargetId = itemToEdit?.rowId;
        const duplicateCode = existingItems.some(
            (row) =>
                row.rowId !== currentTargetId &&
                String(row.item_code || "").trim().toUpperCase() === String(form.item_code || "").trim().toUpperCase()
        );
        if (duplicateCode) {
            setFormError(`Item code "${form.item_code}" is already in this purchase.`);
            return;
        }

        const duplicateName = existingItems.some(
            (row) =>
                row.rowId !== currentTargetId &&
                String(row.item_name || "").trim().toLowerCase() === String(form.item_name || "").trim().toLowerCase()
        );
        if (duplicateName) {
            setFormError(`Item name "${form.item_name}" is already in this purchase.`);
            return;
        }

        onSaveItem({
            rowId: itemToEdit?.rowId || null,
            grn_number: form.grn_number || itemToEdit?.grn_number || "",
            item_master_id: form.item_master_id || form.item_code_id,
            item_code: form.item_code,
            item_code_id: form.item_code_id || form.item_master_id,
            item_category_id: form.item_category_id,
            item_category: form.item_category,
            item_name: form.item_name,
            item_type: form.item_type,
            uom_id: form.uom_id,
            quantity: String(form.quantity),
            unit_price: String(form.unit_price),
            total_price: form.total_price,
            tax: String(form.tax),
            total_after_tax: form.total_after_tax,
            lce_estimate_id: itemToEdit?.lce_estimate_id || null,
        });

        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <Card
                className="modal-card"
                style={{
                    maxWidth: 680,
                    width: "95%",
                    maxHeight: "90vh",
                    display: "flex",
                    flexDirection: "column",
                    padding: 0,
                    overflow: "hidden",
                }}
                onClick={(e) => e.stopPropagation()}
            >
                <CardHeader style={{ flexShrink: 0 }}>
                    <h3 style={{ margin: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        {isEditMode ? <BsPencilSquare /> : <BsPlusCircleFill />}
                        {isEditMode ? "Edit Purchase Item" : "Add Purchase Item"}
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
                        <p className="users-status users-status--error" style={{ margin: "0 0 1rem", padding: "0.5rem 0.8rem" }}>
                            {formError}
                        </p>
                    ) : null}

                    <form onSubmit={handleSubmit}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                            {/* Item Code */}
                            <div className="modal-field-row">
                                <label className="modal-field-row__label">
                                    Item Code <span style={{ color: "#ef4444" }}>*</span>
                                </label>
                                <div className="modal-field-row__control">
                                    <select
                                        className="auth-input"
                                        value={form.item_code_id}
                                        onChange={(e) => handleItemCodeSelect(e.target.value)}
                                        required
                                    >
                                        <option value="">Select item code</option>
                                        {itemCodesForSelection.map((item) => (
                                            <option key={`modal-code-${item.id}`} value={item.id}>
                                                {item.code} {item.name ? `— ${item.name}` : ""}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Item Category */}
                            <div className="modal-field-row">
                                <label className="modal-field-row__label">
                                    Item Category <span style={{ color: "#ef4444" }}>*</span>
                                </label>
                                <div className="modal-field-row__control">
                                    <select
                                        className="auth-input"
                                        value={form.item_category_id}
                                        onChange={(e) => handleCategorySelect(e.target.value)}
                                        required
                                    >
                                        <option value="">Select category</option>
                                        {categoryOptions.map((cat) => (
                                            <option key={`modal-cat-${cat.id}`} value={cat.id}>
                                                {cat.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Item Name */}
                            <div className="modal-field-row">
                                <label className="modal-field-row__label">
                                    Item Name <span style={{ color: "#ef4444" }}>*</span>
                                </label>
                                <div className="modal-field-row__control">
                                    <select
                                        className="auth-input"
                                        value={form.item_master_id}
                                        onChange={(e) => handleItemNameSelect(e.target.value)}
                                        required
                                    >
                                        <option value="">Select item name</option>
                                        {itemNamesForSelection.map((item) => (
                                            <option key={`modal-name-${item.id}`} value={item.id}>
                                                {item.name} {item.code ? `(${item.code})` : ""}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Item Type */}
                            <div className="modal-field-row">
                                <label className="modal-field-row__label">
                                    Item Type <span style={{ color: "#ef4444" }}>*</span>
                                </label>
                                <div className="modal-field-row__control">
                                    <select
                                        className="auth-input"
                                        value={form.item_type}
                                        onChange={(e) => setForm((prev) => ({ ...prev, item_type: e.target.value }))}
                                        required
                                    >
                                        <option value="">Select item type</option>
                                        {itemTypeOptions.map((it) => (
                                            <option key={`modal-it-${it.id}`} value={it.it_name}>
                                                {it.it_name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* UOM */}
                            <div className="modal-field-row">
                                <label className="modal-field-row__label">
                                    UOM <span style={{ color: "#ef4444" }}>*</span>
                                </label>
                                <div className="modal-field-row__control">
                                    <select
                                        className="auth-input"
                                        value={form.uom_id}
                                        onChange={(e) => setForm((prev) => ({ ...prev, uom_id: e.target.value }))}
                                        required
                                    >
                                        <option value="">Select UOM</option>
                                        {uomOptions.map((u) => (
                                            <option key={`modal-uom-${u.id}`} value={u.id}>
                                                {u.name} ({u.symbol})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Quantity */}
                            <div className="modal-field-row">
                                <label className="modal-field-row__label">
                                    Quantity / Size <span style={{ color: "#ef4444" }}>*</span>
                                </label>
                                <div className="modal-field-row__control">
                                    <input
                                        type="number"
                                        step="any"
                                        min="1"
                                        className="auth-input"
                                        value={form.quantity}
                                        onChange={(e) => handleNumericChange("quantity", e.target.value)}
                                        placeholder="Enter quantity"
                                        required
                                    />
                                </div>
                            </div>

                            {/* Unit Price */}
                            <div className="modal-field-row">
                                <label className="modal-field-row__label">
                                    Unit Price <span style={{ color: "#ef4444" }}>*</span>
                                </label>
                                <div className="modal-field-row__control">
                                    <input
                                        type="number"
                                        step="any"
                                        min="0"
                                        className="auth-input"
                                        value={form.unit_price}
                                        onChange={(e) => handleNumericChange("unit_price", e.target.value)}
                                        placeholder="Enter unit price"
                                        required
                                    />
                                </div>
                            </div>

                            {/* Total Price (Auto) */}
                            <div className="modal-field-row">
                                <label className="modal-field-row__label">
                                    Total Price
                                </label>
                                <div className="modal-field-row__control">
                                    <input
                                        type="text"
                                        className="auth-input auth-input--readonly"
                                        value={form.total_price}
                                        readOnly
                                        disabled
                                        title="Auto-calculated: Quantity × Unit Price"
                                    />
                                </div>
                            </div>

                            {/* Tax (%) */}
                            <div className="modal-field-row">
                                <label className="modal-field-row__label">
                                    Tax (%) <span style={{ color: "#ef4444" }}>*</span>
                                </label>
                                <div className="modal-field-row__control">
                                    <input
                                        type="number"
                                        step="any"
                                        min="0"
                                        className="auth-input"
                                        value={form.tax}
                                        onChange={(e) => handleNumericChange("tax", e.target.value)}
                                        placeholder="5"
                                        required
                                    />
                                </div>
                            </div>

                            {/* Total After Tax (Auto) */}
                            <div className="modal-field-row">
                                <label className="modal-field-row__label">
                                    Total After Tax
                                </label>
                                <div className="modal-field-row__control">
                                    <input
                                        type="text"
                                        className="auth-input auth-input--readonly"
                                        value={form.total_after_tax}
                                        readOnly
                                        disabled
                                        title="Auto-calculated: Total Price + (Total Price × Tax%)"
                                    />
                                </div>
                            </div>

                            {/* GRN No. */}
                            {form.grn_number ? (
                                <div className="modal-field-row">
                                    <label className="modal-field-row__label">
                                        GRN Number
                                    </label>
                                    <div className="modal-field-row__control">
                                        <input
                                            type="text"
                                            className="auth-input auth-input--readonly"
                                            value={form.grn_number}
                                            readOnly
                                            disabled
                                        />
                                    </div>
                                </div>
                            ) : null}
                        </div>

                        <div className="modal-form__actions" style={{ display: "flex", justifyContent: "flex-end", gap: "0.6rem", marginTop: "1.25rem" }}>
                            <button type="button" className="modal-btn modal-btn--cancel" onClick={onClose}>
                                Cancel
                            </button>
                            <button type="submit" className="modal-btn modal-btn--save">
                                {isEditMode ? "Update Item" : "Add Item"}
                            </button>
                        </div>
                    </form>
                </CardBody>
            </Card>
        </div>
    );
}

export default StockPurchaseItemModal;
