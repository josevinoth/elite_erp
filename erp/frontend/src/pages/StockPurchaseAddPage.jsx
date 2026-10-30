import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { BsBoxArrowUpRight, BsExclamationTriangleFill, BsPencilSquare, BsPlusCircleFill, BsTrashFill, BsXCircleFill } from "react-icons/bs";
import { Card, CardHeader, CardBody } from "../components/Card";
import StockPurchaseItemModal from "./StockPurchaseItemModal";
import {
    checkStockPurchaseItemDelete,
    createStockPurchase,
    createStockPurchaseVendorDetail,
    createVendor,
    createVendorCategory,
    getStockPurchaseById,
    listLabFurnitureItemCategories,
    listLabFurnitureItems,
    listVendorCategories,
    listVendors,
    listUoms,
    listItemTypes,
    updateStockPurchase,
    updateStockPurchaseVendorDetail,
    listStockPurchaseStatusOptions,
} from "../services/crudApi";

const emptyItem = (id) => ({
    rowId: id,
    grn_number: "",
    item_master_id: "",
    item_category_id: "",
    item_category: "",
    item_name: "",
    item_code: "",
    item_code_id: "",
    item_type: "BUY",
    quantity: "",
    unit_price: "",
    total_price: "0.00",
    tax: "5",
    total_after_tax: "0.00",
    uom_id: "",
});

const toNumber = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

const toCurrency = (value) => (Math.round((value + Number.EPSILON) * 100) / 100).toFixed(2);

// Compute per-item total after tax: total_price + (total_price * tax%)
const computeRowTotalAfterTax = (total_price, tax) => {
    const tp = toNumber(total_price);
    const t = toNumber(tax);
    return toCurrency(tp + tp * (t / 100));
};

// ── Vendor Add Modal ─────────────────────────────────────────────────────────

const EMPTY_VENDOR_FORM = {
    vendor_name: "",
    contact_person: "",
    phone_number: "",
    email_id: "",
    address: "",
    category_id: "",
};

function VendorAddModal({ onClose, onVendorCreated, vendorCategoryOptions, onAddCategory }) {
    const [form, setForm] = useState(EMPTY_VENDOR_FORM);
    const [saving, setSaving] = useState(false);
    const [modalError, setModalError] = useState("");
    const [allVendors, setAllVendors] = useState([]);
    const [addingCategory, setAddingCategory] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState("");
    const [categoryError, setCategoryError] = useState("");

    useEffect(() => {
        listVendors()
            .then((data) => setAllVendors(data.vendors || []))
            .catch(() => setAllVendors([]));
    }, []);

    const duplicateVendorName = useMemo(() => {
        const target = String(form.vendor_name || "").trim().toLowerCase();
        if (!target) return false;
        return allVendors.some(
            (v) => String(v.vendor_name || v.name || "").trim().toLowerCase() === target
        );
    }, [form.vendor_name, allVendors]);

    const onModalChange = (e) => {
        const { name, value } = e.target;
        if (name === "phone_number") {
            setForm((prev) => ({ ...prev, [name]: value.replace(/\D/g, "") }));
            return;
        }
        setForm((prev) => ({ ...prev, [name]: value }));
    };

    const handleModalSave = async (e) => {
        e.preventDefault();
        setModalError("");
        const vn = String(form.vendor_name || "").trim();
        if (!vn) { setModalError("Vendor name is required."); return; }
        if (!form.category_id) { setModalError("Vendor category is required."); return; }
        if (!String(form.contact_person || "").trim()) { setModalError("Contact person is required."); return; }
        if (!String(form.phone_number || "").trim()) { setModalError("Phone number is required."); return; }
        if (!String(form.email_id || "").trim()) { setModalError("Email is required."); return; }
        if (!String(form.email_id || "").includes("@")) { setModalError("Email must contain '@'."); return; }
        if (!String(form.address || "").trim()) { setModalError("Address is required."); return; }
        if (duplicateVendorName) { setModalError("Vendor name already exists."); return; }
        setSaving(true);
        try {
            const payload = {
                vendor_name: vn,
                contact_person: String(form.contact_person || "").trim(),
                phone_number: String(form.phone_number || "").trim(),
                email_id: String(form.email_id || "").trim(),
                address: String(form.address || "").trim(),
                category_id: form.category_id || null,
            };
            const data = await createVendor(payload);
            onVendorCreated(data.vendor || {});
        } catch (err) {
            setModalError(err?.message || "Failed to create vendor.");
        } finally {
            setSaving(false);
        }
    };

    const handleAddCategory = async () => {
        setCategoryError("");
        const name = String(newCategoryName || "").trim();
        if (!name) { setCategoryError("Category name is required."); return; }
        if (vendorCategoryOptions.some((c) => String(c.name || "").trim().toLowerCase() === name.toLowerCase())) {
            setCategoryError("Category already exists."); return;
        }
        setAddingCategory(true);
        try {
            const data = await createVendorCategory({ name });
            const cat = data.category || {};
            onAddCategory(cat);
            setForm((prev) => ({ ...prev, category_id: String(cat.id || "") }));
            setNewCategoryName("");
        } catch (err) {
            setCategoryError(err?.message || "Failed to add category.");
        } finally {
            setAddingCategory(false);
        }
    };

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
                        <BsPlusCircleFill />
                        Add Vendor
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
                    {modalError ? (
                        <p className="users-status users-status--error" style={{ margin: "0 0 1rem", padding: "0.5rem 0.8rem" }}>
                            {modalError}
                        </p>
                    ) : null}
                    {duplicateVendorName ? (
                        <p className="users-status users-status--warning" style={{ margin: "0 0 1rem", padding: "0.5rem 0.8rem" }}>
                            Vendor name already exists.
                        </p>
                    ) : null}
                    <form onSubmit={handleModalSave}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                            {/* Vendor Name */}
                            <div className="modal-field-row">
                                <label className="modal-field-row__label">
                                    Vendor Name <span style={{ color: "#ef4444" }}>*</span>
                                </label>
                                <div className="modal-field-row__control">
                                    <input
                                        name="vendor_name"
                                        className="auth-input"
                                        value={form.vendor_name}
                                        onChange={onModalChange}
                                        placeholder="Enter vendor name"
                                        autoFocus
                                        required
                                    />
                                </div>
                            </div>

                            {/* Vendor Category */}
                            <div className="modal-field-row modal-field-row--top">
                                <label className="modal-field-row__label">
                                    Vendor Category <span style={{ color: "#ef4444" }}>*</span>
                                </label>
                                <div className="modal-field-row__control" style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                                    <select
                                        name="category_id"
                                        className="auth-input"
                                        value={form.category_id}
                                        onChange={onModalChange}
                                        required
                                    >
                                        <option value="">Select category</option>
                                        {vendorCategoryOptions.map((cat) => (
                                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                                        ))}
                                    </select>
                                    <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
                                        <input
                                            className="auth-input"
                                            placeholder="New category name"
                                            value={newCategoryName}
                                            onChange={(e) => { setNewCategoryName(e.target.value); setCategoryError(""); }}
                                            style={{ flex: 1, minWidth: 0 }}
                                        />
                                        <button
                                            type="button"
                                            className="crud-add-btn"
                                            style={{ whiteSpace: "nowrap", padding: "0.4rem 0.75rem", fontSize: "0.85rem" }}
                                            onClick={handleAddCategory}
                                            disabled={addingCategory}
                                        >
                                            {addingCategory ? "Adding..." : "Add Category"}
                                        </button>
                                    </div>
                                    {categoryError ? (
                                        <p style={{ color: "#ef4444", fontSize: "0.8rem", margin: 0 }}>{categoryError}</p>
                                    ) : null}
                                </div>
                            </div>

                            {/* Contact Person */}
                            <div className="modal-field-row">
                                <label className="modal-field-row__label">
                                    Contact Person <span style={{ color: "#ef4444" }}>*</span>
                                </label>
                                <div className="modal-field-row__control">
                                    <input
                                        name="contact_person"
                                        className="auth-input"
                                        value={form.contact_person}
                                        onChange={onModalChange}
                                        placeholder="Contact person name"
                                        required
                                    />
                                </div>
                            </div>

                            {/* Phone Number */}
                            <div className="modal-field-row">
                                <label className="modal-field-row__label">
                                    Phone Number <span style={{ color: "#ef4444" }}>*</span>
                                </label>
                                <div className="modal-field-row__control">
                                    <input
                                        name="phone_number"
                                        className="auth-input"
                                        type="tel"
                                        inputMode="numeric"
                                        maxLength={15}
                                        value={form.phone_number}
                                        onChange={onModalChange}
                                        placeholder="Numbers only"
                                        required
                                    />
                                </div>
                            </div>

                            {/* Email */}
                            <div className="modal-field-row">
                                <label className="modal-field-row__label">
                                    Email <span style={{ color: "#ef4444" }}>*</span>
                                </label>
                                <div className="modal-field-row__control">
                                    <input
                                        name="email_id"
                                        className="auth-input"
                                        type="email"
                                        value={form.email_id}
                                        onChange={onModalChange}
                                        placeholder="vendor@example.com"
                                        required
                                    />
                                </div>
                            </div>

                            {/* Address */}
                            <div className="modal-field-row modal-field-row--top">
                                <label className="modal-field-row__label">
                                    Address <span style={{ color: "#ef4444" }}>*</span>
                                </label>
                                <div className="modal-field-row__control">
                                    <textarea
                                        name="address"
                                        className="auth-input modal-form__textarea"
                                        rows={2}
                                        value={form.address}
                                        onChange={onModalChange}
                                        placeholder="Vendor address"
                                        required
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="modal-form__actions" style={{ marginTop: "1.25rem", display: "flex", justifyContent: "flex-end", gap: "0.6rem" }}>
                            <button type="button" className="modal-btn modal-btn--cancel" onClick={onClose}>
                                Cancel
                            </button>
                            <button type="submit" className="modal-btn modal-btn--save" disabled={saving}>
                                {saving ? "Saving..." : "Add Vendor"}
                            </button>
                        </div>
                    </form>
                </CardBody>
            </Card>
        </div>
    );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

function StockPurchaseAddPage() {
    const navigate = useNavigate();
    const { purchaseId } = useParams();
    const isEditMode = Boolean(purchaseId);

    const [notes, setNotes] = useState("");
    const [vendorFormValues, setVendorFormValues] = useState({
        vendor_id: "",
        invoice_number: "",
        invoice_date: "",
        total_value: "0",
    });
    const [vendorOptions, setVendorOptions] = useState([]);
    const [vendorCategoryOptions, setVendorCategoryOptions] = useState([]);
    const [uomOptions, setUomOptions] = useState([]);
    const [itemTypeOptions, setItemTypeOptions] = useState([]);
    const [categoryOptions, setCategoryOptions] = useState([]);
    const [itemMasterOptions, setItemMasterOptions] = useState([]);
    const [items, setItems] = useState([emptyItem(1)]);
    const [nextItemId, setNextItemId] = useState(2);
    const [savedPurchaseDetailId, setSavedPurchaseDetailId] = useState(null);
    const [saving, setSaving] = useState(false);
    const [savingPurchaseDetails, setSavingPurchaseDetails] = useState(false);
    const [status, setStatus] = useState(""); // for UI messages
    const [statusId, setStatusId] = useState("");
    const [statusOptions, setStatusOptions] = useState([]);
    const [showVendorModal, setShowVendorModal] = useState(false);
    const [showItemModal, setShowItemModal] = useState(false);
    const [itemToEdit, setItemToEdit] = useState(null);
    // Fetch status options
    useEffect(() => {
        let alive = true;
        listStockPurchaseStatusOptions()
            .then((data) => {
                if (!alive) return;
                setStatusOptions(data.status_options || []);
            })
            .catch(() => {
                if (!alive) return;
                setStatusOptions([]);
            });
        return () => { alive = false; };
    }, []);
    const [purchaseStatus, setPurchaseStatus] = useState("");
    const [loadingRecord, setLoadingRecord] = useState(isEditMode);
    const [spNumber, setSpNumber] = useState("");
    const [checkingDeleteRowId, setCheckingDeleteRowId] = useState(null);
    const [deleteDialog, setDeleteDialog] = useState({
        open: false,
        rowId: null,
        mode: "confirm",
        title: "",
        message: "",
    });

    useEffect(() => {
        let alive = true;

        Promise.all([
            listVendors(),
            listLabFurnitureItems(),
            listLabFurnitureItemCategories(),
            listUoms(),
            listItemTypes(),
            listVendorCategories(),
        ])
            .then(([vendorData, itemData, categoryData, uomData, itemTypeData, vendorCatData]) => {
                if (!alive) return;
                setVendorOptions(vendorData.vendors || []);
                setItemMasterOptions(itemData.lab_furniture_items || []);
                setCategoryOptions(categoryData.item_categories || []);
                setUomOptions(Array.isArray(uomData) ? uomData : (uomData.uoms || []));
                const itemTypes = Array.isArray(itemTypeData) ? itemTypeData : (itemTypeData?.item_types || []);
                setItemTypeOptions(itemTypes);
                setVendorCategoryOptions(vendorCatData.categories || []);
            })
            .catch(() => {
                if (!alive) return;
                setVendorOptions([]);
                setItemMasterOptions([]);
                setCategoryOptions([]);
                setUomOptions([]);
                setItemTypeOptions([]);
                setVendorCategoryOptions([]);
            });

        return () => {
            alive = false;
        };
    }, []);

    useEffect(() => {
        if (!isEditMode || !purchaseId) {
            setLoadingRecord(false);
            return;
        }

        let alive = true;
        setLoadingRecord(true);
        setStatus("");

        getStockPurchaseById(purchaseId)
            .then((data) => {
                if (!alive) return;
                const record = data.stock_purchase || {};
                const vendorDetail = record.vendor_detail || {};
                const loadedItems = Array.isArray(record.items)
                    ? record.items.map((item, index) => {
                        const tp = item.total_price || "0";
                        const tax = item.tax !== undefined && item.tax !== null && item.tax !== "" ? item.tax : "5";
                        return {
                            rowId: item.id || index + 1,
                            grn_number: item.grn_number || "",
                            item_master_id: item.item_master_id ? String(item.item_master_id) : (item.item_code_id ? String(item.item_code_id) : ""),
                            item_category_id: item.item_category_id ? String(item.item_category_id) : "",
                            item_category: item.item_category || "",
                            item_name: item.item_name || "",
                            item_code: item.item_code || "",
                            item_code_id: item.item_code_id ? String(item.item_code_id) : (item.item_master_id ? String(item.item_master_id) : ""),
                            item_type: item.item_type || "BUY",
                            quantity: item.quantity || "0",
                            unit_price: item.unit_price || "0",
                            total_price: tp,
                            tax: tax,
                            total_after_tax: item.total_after_tax || computeRowTotalAfterTax(tp, tax),
                            lce_estimate_id: item.lce_estimate_id || null,
                            uom_id: item.uom_id ? String(item.uom_id) : "",
                        };
                    })
                    : [];

                setVendorFormValues({
                    vendor_id: vendorDetail.vendor_id ? String(vendorDetail.vendor_id) : "",
                    invoice_number: vendorDetail.invoice_number || "",
                    invoice_date: vendorDetail.invoice_date || "",
                    total_value: vendorDetail.total_value || "",
                });
                setSpNumber(record.purchase_number || "");
                setSavedPurchaseDetailId(vendorDetail.id || null);
                setPurchaseStatus("");
                setNotes(record.notes || "");
                setItems(loadedItems.length ? loadedItems : [emptyItem(1)]);
                setNextItemId((loadedItems.reduce((max, row) => Math.max(max, Number(row.rowId) || 0), 0) || 0) + 1);
                setStatusId(record.status_id ? String(record.status_id) : "");
            })
            .catch((error) => {
                if (!alive) return;
                setStatus(error?.message || "Failed to load stock purchase record.");
            })
            .finally(() => {
                if (!alive) return;
                setLoadingRecord(false);
            });

        return () => {
            alive = false;
        };
    }, [isEditMode, purchaseId]);

    const handleVendorChange = (event) => {
        const { name, value } = event.target;
        setPurchaseStatus("");
        setVendorFormValues((prev) => ({ ...prev, [name]: value }));
    };

    const computedItemsTotalValue = useMemo(() => {
        const total = items.reduce((sum, row) => sum + toNumber(row.total_price), 0);
        return toCurrency(total);
    }, [items]);

    // Sum of all per-item total_after_tax values
    const computedTotalAfterTax = useMemo(() => {
        const total = items.reduce((sum, row) => sum + toNumber(row.total_after_tax), 0);
        return toCurrency(total);
    }, [items]);

    const getItemCodesForSelection = (categoryId) => {
        return itemMasterOptions
            .filter(
                (item) => !categoryId || String(item.item_category_id || "") === String(categoryId || "")
            )
            .map((item) => ({
                id: String(item.id || ""),
                code: String(item.item_code || ""),
                name: String(item.item_name || ""),
                categoryId: String(item.item_category_id || ""),
            }))
            .filter((item) => item.id && item.code)
            .sort((a, b) => a.code.localeCompare(b.code));
    };

    const getItemNamesForSelection = (categoryId) => {
        return itemMasterOptions
            .filter(
                (item) => !categoryId || String(item.item_category_id || "") === String(categoryId || "")
            )
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
    };

    const getItemMasterByCategoryAndName = (categoryId, itemName) => {
        const name = String(itemName || "").trim().toLowerCase();
        if (!categoryId || !name) return null;
        return itemMasterOptions.find(
            (item) => String(item.item_category_id || "") === String(categoryId)
                && String(item.item_name || "").trim().toLowerCase() === name
        ) || null;
    };

    const getItemMasterById = (itemId) => {
        const normalizedId = String(itemId || "").trim();
        if (!normalizedId) return null;
        return itemMasterOptions.find((item) => String(item.id || "") === normalizedId) || null;
    };

    const masterPatchFromMaster = (masterItem) => ({
        item_name: masterItem?.item_name || "",
        item_type: masterItem?.item_type || "BUY",
    });

    useEffect(() => {
        if (!itemMasterOptions.length) return;

        setItems((prev) =>
            prev.map((row) => {
                const masterItem = getItemMasterById(row.item_code_id || row.item_master_id)
                    || getItemMasterByCategoryAndName(row.item_category_id, row.item_name);
                if (!masterItem) return row;
                const patch = masterPatchFromMaster(masterItem);
                if (
                    row.item_name === patch.item_name
                    && row.item_type === patch.item_type
                ) {
                    return row;
                }
                return {
                    ...row,
                    ...patch,
                    item_master_id: row.item_master_id || String(masterItem.id || ""),
                    item_category_id: row.item_category_id || String(masterItem.item_category_id || ""),
                    item_category: row.item_category || String(masterItem.item_category || ""),
                    item_code: row.item_code || String(masterItem.item_code || ""),
                    item_code_id: row.item_code_id || String(masterItem.id || ""),
                    // Always sync UOM from Item Master for selected item code.
                    uom_id: masterItem.uom_id ? String(masterItem.uom_id) : "",
                };
            })
        );
    }, [itemMasterOptions]);

    const handleItemCodeSelect = (rowId, itemMasterId) => {
        setItems((prev) =>
            prev.map((row) => {
                if (row.rowId !== rowId) return row;
                if (!itemMasterId) {
                    return {
                        ...row,
                        item_master_id: "",
                        item_code: "",
                        item_code_id: "",
                        item_name: "",
                    };
                }
                const selected = getItemMasterById(itemMasterId);
                const selectedCategory = selected ? categoryOptions.find((c) => String(c.id) === String(selected.item_category_id || "")) : null;
                return {
                    ...row,
                    item_master_id: selected ? String(selected.id) : "",
                    item_code: selected ? String(selected.item_code || "") : "",
                    item_code_id: selected ? String(selected.id || "") : "",
                    item_name: selected ? String(selected.item_name || "") : "",
                    item_category_id: selected ? String(selected.item_category_id || "") : row.item_category_id,
                    item_category: selected ? (selectedCategory?.name || selected.item_category || "") : row.item_category,
                    item_type: selected ? String(selected.item_type || "BUY") : row.item_type,
                    uom_id: selected?.uom_id ? String(selected.uom_id) : "",
                };
            })
        );
    };

    const handleCategorySelect = (rowId, categoryId) => {
        const selectedCategory = categoryOptions.find((category) => String(category.id) === String(categoryId || ""));
        setItems((prev) =>
            prev.map((row) => {
                if (row.rowId !== rowId) return row;
                return {
                    ...row,
                    item_master_id: "",
                    item_category_id: String(categoryId || ""),
                    item_category: selectedCategory?.name || "",
                    item_name: "",
                    item_code: "",
                    item_code_id: "",
                    uom_id: "",
                };
            })
        );
    };

    const handleItemNameSelect = (rowId, itemMasterId) => {
        setItems((prev) =>
            prev.map((row) => {
                if (row.rowId !== rowId) return row;
                if (!itemMasterId) {
                    return {
                        ...row,
                        item_master_id: "",
                        item_name: "",
                        item_code: "",
                        item_code_id: "",
                    };
                }
                const selected = getItemMasterById(itemMasterId);
                const selectedCategory = selected ? categoryOptions.find((c) => String(c.id) === String(selected.item_category_id || "")) : null;
                return {
                    ...row,
                    item_master_id: selected ? String(selected.id) : "",
                    item_category_id: selected ? String(selected.item_category_id || "") : row.item_category_id,
                    item_category: selected ? (selectedCategory?.name || selected.item_category || "") : row.item_category,
                    item_name: selected ? String(selected.item_name || "") : "",
                    item_code: selected ? String(selected.item_code || "") : "",
                    item_code_id: selected ? String(selected.id || "") : "",
                    item_type: selected ? String(selected.item_type || "BUY") : row.item_type,
                    // UOM is pulled from Item Master when item code is selected.
                    uom_id: selected?.uom_id ? String(selected.uom_id) : "",
                };
            })
        );
    };

    const handleItemValueChange = (rowId, key, value) => {
        setItems((prev) =>
            prev.map((row) => {
                if (row.rowId !== rowId) return row;
                const next = { ...row, [key]: value };
                if (key === "quantity" || key === "unit_price") {
                    next.total_price = toCurrency(toNumber(next.quantity) * toNumber(next.unit_price));
                }
                // Recalculate total_after_tax when total_price or tax changes
                if (key === "quantity" || key === "unit_price" || key === "tax") {
                    next.total_after_tax = computeRowTotalAfterTax(next.total_price, next.tax);
                }
                return next;
            })
        );
    };

    const persistItemsToBackend = async (newItems) => {
        if (!savedPurchaseDetailId) return;
        const cleanedItems = newItems
            .filter((row) => String(row.item_master_id || row.item_code_id || "").trim())
            .map((row) => ({
                id: row.rowId,
                grn_number: row.grn_number || "",
                item_category_id: row.item_category_id || null,
                item_category: row.item_category,
                item_name: row.item_name,
                item_code: row.item_code,
                item_code_id: row.item_code_id || row.item_master_id || null,
                item_master_id: row.item_master_id || row.item_code_id || null,
                item_type: row.item_type || "BUY",
                quantity: row.quantity || "0",
                unit_price: row.unit_price || "0",
                total_price: row.total_price || "0",
                tax: row.tax || "0",
                total_after_tax: row.total_after_tax || "0",
                uom_id: row.uom_id || null,
            }));

        const totalVal = toCurrency(
            cleanedItems.reduce((acc, r) => acc + (toNumber(r.total_price) || 0), 0)
        );
        const totalAfterTax = toCurrency(
            cleanedItems.reduce((acc, r) => acc + (toNumber(r.total_after_tax) || 0), 0)
        );

        const payload = {
            notes,
            vendor_detail_id: savedPurchaseDetailId,
            items: cleanedItems,
            status_id: statusId,
            total_value: totalVal,
            total_after_tax: totalAfterTax,
        };

        try {
            setSaving(true);
            const successData = isEditMode
                ? await updateStockPurchase(purchaseId, payload)
                : await createStockPurchase(payload);

            const savedSP = successData?.stock_purchase || {};
            const savedPurchaseId = savedSP?.id;
            const savedSpNumber = savedSP?.purchase_number || "";
            if (savedSpNumber) setSpNumber(savedSpNumber);

            if (!isEditMode && savedPurchaseId) {
                navigate(`/stock-purchase/record/${savedPurchaseId}`, { replace: true });
            }
            setStatus("Items saved successfully.");
        } catch (error) {
            setStatus(error?.message || "Failed to save items to stock purchase.");
        } finally {
            setSaving(false);
        }
    };

    const handleSaveItemFromModal = async (savedItem) => {
        let updatedItems = [];
        setItems((prev) => {
            if (savedItem.rowId) {
                updatedItems = prev.map((row) => (row.rowId === savedItem.rowId ? { ...row, ...savedItem } : row));
            } else {
                const isSingleEmptyStub =
                    prev.length === 1 &&
                    !prev[0].item_code &&
                    !prev[0].item_master_id &&
                    !prev[0].item_code_id &&
                    !prev[0].item_name;

                const newRow = {
                    ...savedItem,
                    rowId: isSingleEmptyStub ? prev[0].rowId : nextItemId,
                };

                if (isSingleEmptyStub) {
                    updatedItems = [newRow];
                } else {
                    setNextItemId((id) => id + 1);
                    updatedItems = [...prev, newRow];
                }
            }
            return updatedItems;
        });

        if (updatedItems.length) {
            await persistItemsToBackend(updatedItems);
        }
    };

    const addItemRow = () => {
        if (!savedPurchaseDetailId) return;
        setItemToEdit(null);
        setShowItemModal(true);
    };

    const closeDeleteDialog = () => {
        setDeleteDialog({
            open: false,
            rowId: null,
            mode: "confirm",
            title: "",
            message: "",
        });
    };

    const confirmDeleteItemRow = async () => {
        const rowId = deleteDialog.rowId;
        if (!rowId) {
            closeDeleteDialog();
            return;
        }
        let updated = items;
        if (items.length > 1) {
            updated = items.filter((r) => r.rowId !== rowId);
            setItems(updated);
        }
        closeDeleteDialog();
        if (updated.length) {
            await persistItemsToBackend(updated);
        }
    };

    const deleteItemRow = async (rowId) => {
        if (!savedPurchaseDetailId) return;
        const row = items.find((r) => r.rowId === rowId);
        if (!row) return;

        if (row?.lce_estimate_id) {
            setDeleteDialog({
                open: true,
                rowId,
                mode: "warning",
                title: "Cannot Delete GRN Row",
                message: "This GRN row is linked to an LCE estimate. Delink it first, then try again.",
            });
            return;
        }

        const isPersistedRow = String(row.rowId || "").trim().length > 0 && String(row.rowId).match(/^\d+$/);
        if (isPersistedRow) {
            setCheckingDeleteRowId(rowId);
            try {
                const check = await checkStockPurchaseItemDelete(rowId);
                if (!check?.can_delete) {
                    setDeleteDialog({
                        open: true,
                        rowId,
                        mode: "warning",
                        title: "Deletion Restricted",
                        message: check?.message || "This GRN row is linked downstream and cannot be deleted.",
                    });
                    return;
                }
            } catch (error) {
                setDeleteDialog({
                    open: true,
                    rowId,
                    mode: "warning",
                    title: "Delete Check Failed",
                    message: error?.message || "Unable to validate downstream links for this GRN row right now.",
                });
                return;
            } finally {
                setCheckingDeleteRowId(null);
            }
        }

        setDeleteDialog({
            open: true,
            rowId,
            mode: "confirm",
            title: "Delete Purchase Item Row",
            message: `Are you sure you want to delete GRN row ${row.grn_number || `#${rowId}`}?`,
        });
    };

    const getDeleteItemTitle = (row) => {
        if (row.lce_estimate_id) {
            return "Cannot delete: this item is linked to an LCE estimate. Please delink it from LCE first, then try again.";
        }
        if (items.length <= 1) return "At least one item is required";
        if (!savedPurchaseDetailId) return "Save purchase details first";
        return "Delete";
    };

    const handleSavePurchaseDetails = async () => {
        setPurchaseStatus("");
        if (!vendorFormValues.vendor_id) {
            setPurchaseStatus("Select vendor before saving purchase details.");
            return;
        }
        if (!String(vendorFormValues.invoice_number || "").trim()) {
            setPurchaseStatus("Invoice number is required.");
            return;
        }
        if (!String(vendorFormValues.invoice_date || "").trim()) {
            setPurchaseStatus("Invoice date is required.");
            return;
        }

        setSavingPurchaseDetails(true);
        try {
            const payload = {
                vendor_id: vendorFormValues.vendor_id,
                invoice_number: vendorFormValues.invoice_number,
                invoice_date: vendorFormValues.invoice_date,
                total_value: computedItemsTotalValue,
                total_after_tax: computedTotalAfterTax,
            };
            const data = savedPurchaseDetailId
                ? await updateStockPurchaseVendorDetail(savedPurchaseDetailId, payload)
                : await createStockPurchaseVendorDetail(payload);
            setSavedPurchaseDetailId(data.vendor_detail?.id || null);
            setPurchaseStatus(savedPurchaseDetailId ? "Purchase details updated." : "Purchase details saved. You can now add items.");
        } catch (error) {
            setSavedPurchaseDetailId(null);
            const message = error?.message || "Failed to save purchase details.";
            setPurchaseStatus(message);
            if (String(message).toLowerCase().includes("invoice number already exists")) {
                window.alert(message);
            }
        } finally {
            setSavingPurchaseDetails(false);
        }
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setSaving(true);
        setStatus("");

        const cleanedItems = items
            .filter((row) => String(row.item_master_id || row.item_code_id || "").trim())
            .map((row) => ({
                id: row.rowId,
                grn_number: row.grn_number || "",
                item_category_id: row.item_category_id || null,
                item_category: row.item_category,
                item_name: row.item_name,
                item_code: row.item_code,
                item_code_id: row.item_code_id || row.item_master_id || null,
                item_master_id: row.item_master_id || row.item_code_id || null,
                item_type: row.item_type || "BUY",
                quantity: row.quantity || "0",
                unit_price: row.unit_price || "0",
                total_price: row.total_price || "0",
                tax: row.tax || "0",
                total_after_tax: row.total_after_tax || "0",
                uom_id: row.uom_id || null,
            }));

        const seenNames = new Set();
        for (const row of cleanedItems) {
            const name = String(row.item_name || "").trim().toLowerCase();
            if (!name) continue;
            if (seenNames.has(name)) {
                setStatus(`Duplicate item name (${row.item_name}) is not allowed in the same invoice.`);
                setSaving(false);
                return;
            }
            seenNames.add(name);
        }

        // Prevent duplicate item code rows for the same invoice before API call.
        const seenCodes = new Set();
        for (const row of cleanedItems) {
            const code = String(row.item_code || "").trim().toUpperCase();
            if (!code) continue;
            if (seenCodes.has(code)) {
                const invoiceNo = String(vendorFormValues.invoice_number || "").trim() || "this invoice";
                setStatus(`Duplicate item code (${code}) is not allowed for ${invoiceNo}.`);
                setSaving(false);
                return;
            }
            seenCodes.add(code);
        }

        if (!savedPurchaseDetailId) {
            setStatus("Save purchase details first before adding items.");
            setSaving(false);
            return;
        }

        try {
            const payload = {
                notes,
                vendor_detail_id: savedPurchaseDetailId,
                items: cleanedItems,
                status_id: statusId,
                total_value: computedItemsTotalValue,
                total_after_tax: computedTotalAfterTax,
            };
            const successData = isEditMode
                ? await updateStockPurchase(purchaseId, payload)
                : await createStockPurchase(payload);

            const savedSP = successData?.stock_purchase || {};
            const savedPurchaseId = savedSP?.id;
            const savedSpNumber = savedSP?.purchase_number || "";

            if (savedSpNumber) setSpNumber(savedSpNumber);

            if (isEditMode) {
                setStatus("Stock purchase updated successfully. You can continue editing items on this page.");
            } else {
                // Stay on page — redirect to edit URL so subsequent saves use PATCH
                setStatus(`Stock purchase ${savedSpNumber || "saved"} successfully. You can continue adding or editing items.`);
                if (savedPurchaseId) {
                    navigate(`/stock-purchase/record/${savedPurchaseId}`, { replace: true });
                }
            }
        } catch (error) {
            setStatus(error?.message || "Save failed.");
        } finally {
            setSaving(false);
        }
    };

    // Helper to determine status type
    const getStatusType = (status) => {
        if (!status) return "";
        const s = status.toLowerCase();
        if (
            s.includes("successfully") ||
            s.includes("saved") ||
            s.includes("updated")
        ) {
            return "success";
        }
        return "error";
    };

    const renderSectionAlert = (message) => {
        if (!message) return null;
        const type = getStatusType(message);
        return (
            <p
                className={`users-status users-status--${type}`}
                style={
                    type === "success"
                        ? { background: "#22bb33", color: "#fff", padding: "0.5rem 1rem", borderRadius: 6, margin: "0 0 0.8rem" }
                        : { background: "orange", color: "#fff", padding: "0.5rem 1rem", borderRadius: 6, margin: "0 0 0.8rem" }
                }
            >
                {message}
            </p>
        );
    };

    return (
        <section className="module-page">
            <div className="crud-page__header" style={{ marginBottom: "0.8rem" }}>
                <h1 className="module-page__title module-page__title--stock" style={{ margin: 0 }}>
                    {isEditMode ? "Stock Purchase Edit" : "Stock Purchase Add"}
                    {spNumber ? <span style={{ marginLeft: "0.75rem", color: "#0ea5e9", fontWeight: 700, fontSize: "1rem" }}>[{spNumber}]</span> : null}
                </h1>
            </div>

            {loadingRecord ? <p className="users-status">Loading record...</p> : null}

            {!loadingRecord ? <form className="modal-form stock-purchase-add-form" onSubmit={handleSubmit}>
                <div className="stock-purchase-add-form__row--full">
                    <Card className="purchase-details-card mb-3">
                        <CardHeader>
                            <h3 style={{ margin: 0 }}>Purchase Details</h3>
                        </CardHeader>
                        <CardBody>
                            {renderSectionAlert(purchaseStatus)}

                            <div className="modal-form__row stock-purchase-add-form__purchase-details-row">
                                <div className="modal-form__row">
                                    <label className="modal-form__label" htmlFor="sp-vendor-id">Vendor *</label>
                                    <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
                                        <select
                                            id="sp-vendor-id"
                                            name="vendor_id"
                                            className="auth-input"
                                            style={{ flex: 1 }}
                                            value={vendorFormValues.vendor_id}
                                            onChange={handleVendorChange}
                                            required
                                        >
                                            <option value="">Select vendor</option>
                                            {vendorOptions.map((vendor) => (
                                                <option key={vendor.id} value={vendor.id}>{vendor.vendor_name || vendor.name}</option>
                                            ))}
                                        </select>
                                        <button
                                            type="button"
                                            className="crud-add-btn"
                                            style={{ whiteSpace: "nowrap", padding: "0.35rem 0.7rem", fontSize: "0.85rem" }}
                                            onClick={() => setShowVendorModal(true)}
                                            title="Add new vendor"
                                            aria-label="Add new vendor"
                                        >
                                            <BsPlusCircleFill style={{ marginRight: "0.3rem" }} />
                                            Add
                                        </button>
                                    </div>
                                </div>
                                <div className="modal-form__row">
                                    <label className="modal-form__label" htmlFor="sp-invoice-number">Invoice Number</label>
                                    <input
                                        id="sp-invoice-number"
                                        name="invoice_number"
                                        type="text"
                                        className="auth-input"
                                        value={vendorFormValues.invoice_number}
                                        onChange={handleVendorChange}
                                        required
                                    />
                                </div>
                                <div className="modal-form__row">
                                    <label className="modal-form__label" htmlFor="sp-invoice-date">Invoice Date</label>
                                    <input
                                        id="sp-invoice-date"
                                        name="invoice_date"
                                        type="date"
                                        className="auth-input"
                                        value={vendorFormValues.invoice_date}
                                        onChange={handleVendorChange}
                                        required
                                    />
                                </div>
                                <div className="modal-form__row">
                                    <label className="modal-form__label" htmlFor="sp-total-value">Total Value</label>
                                    <input
                                        id="sp-total-value"
                                        name="total_value"
                                        type="number"
                                        step="any"
                                        className="auth-input auth-input--readonly"
                                        value={computedItemsTotalValue}
                                        readOnly
                                        disabled
                                        title="Sum of all item Total Price values"
                                    />
                                </div>
                                <div className="modal-form__row">
                                    <label className="modal-form__label" htmlFor="sp-total-after-tax">Total After Tax</label>
                                    <input
                                        id="sp-total-after-tax"
                                        type="number"
                                        step="any"
                                        className="auth-input auth-input--readonly"
                                        value={computedTotalAfterTax}
                                        readOnly
                                        disabled
                                        title="Sum of all item Total After Tax values"
                                    />
                                </div>
                                <div className="modal-form__row">
                                    <label className="modal-form__label" htmlFor="sp-status">Status *</label>
                                    <select
                                        id="sp-status"
                                        name="status_id"
                                        className="auth-input"
                                        value={statusId}
                                        onChange={e => setStatusId(e.target.value)}
                                        required
                                    >
                                        <option value="">Select status</option>
                                        {statusOptions.map((opt) => (
                                            <option key={opt.id} value={opt.id}>{opt.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="modal-form__row" style={{ marginTop: "1rem" }}>
                                <label className="modal-form__label" htmlFor="sp-notes">Notes</label>
                                <textarea
                                    id="sp-notes"
                                    name="notes"
                                    className="auth-input modal-form__textarea"
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                />
                            </div>

                            <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "0.6rem", marginTop: "1rem" }}>
                                <button
                                    type="button"
                                    className="crud-add-btn"
                                    onClick={handleSavePurchaseDetails}
                                    disabled={savingPurchaseDetails}
                                >
                                    {savingPurchaseDetails ? "Saving Purchase Details..." : "Save Purchase Details"}
                                </button>
                                <button
                                    type="button"
                                    className="modal-btn modal-btn--cancel"
                                    onClick={() => navigate("/stock-purchase")}
                                    disabled={saving || savingPurchaseDetails}
                                >
                                    Cancel
                                </button>
                            </div>
                        </CardBody>
                    </Card>
                </div>

                <div className="stock-purchase-add-form__row--full">
                    {renderSectionAlert(status)}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                        <h3 style={{ margin: 0 }}>Purchase Items</h3>
                        <button
                            type="button"
                            className="crud-add-btn"
                            onClick={addItemRow}
                            disabled={saving || !savedPurchaseDetailId}
                            title="Add Item Row"
                            aria-label="Add Item Row"
                        >
                            <BsPlusCircleFill aria-hidden="true" />Add
                        </button>
                    </div>
                    <div className="users-table-wrap" style={{ overflowX: "scroll", WebkitOverflowScrolling: "touch" }}>
                        <table className="users-table users-table--sp-items">
                            <thead>
                            <tr>
                                <th style={{ width: "150px" }}>Item Code</th>
                                <th style={{ width: "200px", whiteSpace: "normal", wordWrap: "break-word", overflowWrap: "break-word" }}>Item Category</th>
                                <th style={{ width: "220px", whiteSpace: "normal", wordWrap: "break-word", overflowWrap: "break-word" }}>Item Name</th>
                                <th style={{ width: "110px" }}>Item Type</th>
                                <th style={{ width: "110px" }}>GRN No.</th>
                                <th style={{ width: "125px" }}>UOM</th>
                                <th style={{ width: "95px" }}>Qty/Size</th>
                                <th style={{ width: "110px" }}>Unit Price</th>
                                <th style={{ width: "110px" }}>Total Price</th>
                                <th style={{ width: "105px" }}>Tax (%)</th>
                                <th style={{ width: "125px" }}>Total After Tax</th>
                                <th style={{ width: "60px", textAlign: "center" }}>Action</th>
                            </tr>
                            </thead>
                            <tbody>
                            {items.map((row) => {
                                const uomObj = uomOptions.find((u) => String(u.id) === String(row.uom_id));
                                const uomDisplay = uomObj ? (uomObj.symbol || uomObj.name) : "—";
                                const isStubRow = !row.item_code && !row.item_name;

                                return (
                                    <tr key={row.rowId}>
                                        <td style={{ width: "140px", fontWeight: 600, color: "#1e293b" }}>
                                            {row.item_code || (isStubRow ? <span style={{ color: "#94a3b8", fontStyle: "italic" }}>Not set</span> : "—")}
                                        </td>
                                        <td style={{ width: "180px", whiteSpace: "normal", wordWrap: "break-word", overflowWrap: "break-word" }}>
                                            {row.item_category || "—"}
                                        </td>
                                        <td style={{ width: "200px", whiteSpace: "normal", wordWrap: "break-word", overflowWrap: "break-word" }}>
                                            {row.item_name || "—"}
                                        </td>
                                        <td style={{ width: "100px" }}>
                                            <span style={{
                                                display: "inline-block",
                                                padding: "0.2rem 0.5rem",
                                                fontSize: "0.78rem",
                                                borderRadius: "4px",
                                                background: "#f1f5f9",
                                                color: "#334155",
                                                fontWeight: 600,
                                            }}>
                                                {row.item_type || "BUY"}
                                            </span>
                                        </td>
                                        <td style={{ width: "100px" }}>
                                            {row.grn_number || <span style={{ color: "#94a3b8", fontStyle: "italic" }}>Auto</span>}
                                        </td>
                                        <td style={{ width: "110px" }}>
                                            {uomDisplay}
                                        </td>
                                        <td style={{ width: "90px", textAlign: "right" }}>
                                            {row.quantity || "0"}
                                        </td>
                                        <td style={{ width: "100px", textAlign: "right" }}>
                                            {row.unit_price ? Number(row.unit_price).toFixed(2) : "0.00"}
                                        </td>
                                        <td style={{ width: "110px", textAlign: "right", fontWeight: 500 }}>
                                            {row.total_price || "0.00"}
                                        </td>
                                        <td style={{ width: "95px", textAlign: "right" }}>
                                            {row.tax !== undefined && row.tax !== null && row.tax !== "" ? `${row.tax}%` : "5%"}
                                        </td>
                                        <td style={{ width: "125px", textAlign: "right", fontWeight: 600, color: "#0f766e" }}>
                                            {row.total_after_tax || "0.00"}
                                        </td>
                                        <td style={{ width: "85px", verticalAlign: "middle", textAlign: "center" }}>
                                            <div style={{ display: "inline-flex", gap: "0.3rem", alignItems: "center", justifyContent: "center" }}>
                                                <button
                                                    type="button"
                                                    className="users-action users-action--edit"
                                                    onClick={() => {
                                                        setItemToEdit(row);
                                                        setShowItemModal(true);
                                                    }}
                                                    disabled={!savedPurchaseDetailId || saving}
                                                    title="Edit Item"
                                                    aria-label="Edit Item"
                                                    style={{ display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                                                >
                                                    <BsPencilSquare aria-hidden="true" />
                                                </button>
                                                <button
                                                    type="button"
                                                    className="users-action users-action--delete"
                                                    onClick={() => deleteItemRow(row.rowId)}
                                                    disabled={!savedPurchaseDetailId || items.length <= 1 || saving || checkingDeleteRowId === row.rowId || !!row.lce_estimate_id}
                                                    title={checkingDeleteRowId === row.rowId ? "Checking linked usage..." : getDeleteItemTitle(row)}
                                                    aria-label="Delete"
                                                    style={{ display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                                                >
                                                    <BsTrashFill aria-hidden="true" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </form> : null}

            {deleteDialog.open ? (
                <div className="modal-overlay" onClick={closeDeleteDialog}>
                    <div className="modal-card" style={{ maxWidth: 560 }} onClick={(event) => event.stopPropagation()}>
                        <div className="modal-card__head">
                            <h2 className="modal-card__title" style={{ display: "inline-flex", alignItems: "center", gap: "0.45rem" }}>
                                <BsExclamationTriangleFill aria-hidden="true" style={{ color: "#f59e0b" }} />
                                {deleteDialog.title}
                            </h2>
                        </div>
                        <div className="modal-form" style={{ gap: "0.9rem" }}>
                            <p className={deleteDialog.mode === "warning" ? "users-status users-status--warning" : "users-status"} style={{ margin: 0 }}>
                                {deleteDialog.message}
                            </p>
                            <div className="modal-form__actions">
                                <button type="button" className="modal-btn modal-btn--cancel" onClick={closeDeleteDialog}>
                                    {deleteDialog.mode === "warning" ? "OK" : "Cancel"}
                                </button>
                                {deleteDialog.mode === "confirm" ? (
                                    <button type="button" className="modal-btn modal-btn--save" onClick={confirmDeleteItemRow}>
                                        Delete Row
                                    </button>
                                ) : null}
                            </div>
                        </div>
                    </div>
                </div>
            ) : null}

            {/* Vendor Add Modal */}
            {showVendorModal ? (
                <VendorAddModal
                    onClose={() => setShowVendorModal(false)}
                    onVendorCreated={(newVendor) => {
                        setVendorOptions((prev) => [...prev, newVendor]);
                        setVendorFormValues((prev) => ({ ...prev, vendor_id: String(newVendor.id || "") }));
                        setShowVendorModal(false);
                        setPurchaseStatus(`Vendor "${newVendor.vendor_name || newVendor.name}" added and selected.`);
                    }}
                    vendorCategoryOptions={vendorCategoryOptions}
                    onAddCategory={(newCat) => {
                        setVendorCategoryOptions((prev) => {
                            if (prev.some((c) => c.id === newCat.id)) return prev;
                            return [...prev, newCat].sort((a, b) => a.name.localeCompare(b.name));
                        });
                    }}
                />
            ) : null}

            {/* Purchase Item Add/Edit Modal */}
            <StockPurchaseItemModal
                isOpen={showItemModal}
                onClose={() => {
                    setShowItemModal(false);
                    setItemToEdit(null);
                }}
                onSaveItem={handleSaveItemFromModal}
                itemToEdit={itemToEdit}
                categoryOptions={categoryOptions}
                itemMasterOptions={itemMasterOptions}
                itemTypeOptions={itemTypeOptions}
                uomOptions={uomOptions}
                existingItems={items}
            />
        </section>
    );
}

export default StockPurchaseAddPage;

