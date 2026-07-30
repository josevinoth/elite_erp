import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { BsBoxArrowUpRight, BsPlusCircleFill, BsTrashFill } from "react-icons/bs";
import {
  createStockPurchase,
  createStockPurchaseVendorDetail,
  getStockPurchaseById,
  listLabFurnitureItemCategories,
  listLabFurnitureItems,
  listVendors,
  listUoms,
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
  total_price: "0.0",
  uom_id: "",
  length: "0",
  width: "0",
  height: "0",
  volume: "0.0",
});

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toCurrency = (value) => (Math.round((value + Number.EPSILON) * 100) / 100).toFixed(2);

const toDimensionValue = (value, fallback = "0") => {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
};

function StockPurchaseAddPage() {
  const navigate = useNavigate();
  const { purchaseId } = useParams();
  const isEditMode = Boolean(purchaseId);

  const [notes, setNotes] = useState("");
  const [vendorFormValues, setVendorFormValues] = useState({
    vendor_id: "",
    invoice_number: "",
    invoice_date: "",
    tax: "0",
    total_value: "0",
  });
  const [vendorOptions, setVendorOptions] = useState([]);
  const [uomOptions, setUomOptions] = useState([]);
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

  useEffect(() => {
    let alive = true;

    Promise.all([listVendors(), listLabFurnitureItems(), listLabFurnitureItemCategories(), listUoms()])
        .then(([vendorData, itemData, categoryData, uomData]) => {
          if (!alive) return;
          setVendorOptions(vendorData.vendors || []);
          setItemMasterOptions(itemData.lab_furniture_items || []);
          setCategoryOptions(categoryData.item_categories || []);
          setUomOptions(Array.isArray(uomData) ? uomData : (uomData.uoms || []));
        })
        .catch(() => {
          if (!alive) return;
          setVendorOptions([]);
          setItemMasterOptions([]);
          setCategoryOptions([]);
          setUomOptions([]);
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
              ? record.items.map((item, index) => ({
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
                total_price: item.total_price || "0",
                lce_estimate_id: item.lce_estimate_id || null,
                uom_id: item.uom_id ? String(item.uom_id) : "",
                length: item.length || "0",
                width: item.width || "0",
                height: item.height || "0",
                volume: item.volume || "0.000",
              }))
              : [];

          setVendorFormValues({
            vendor_id: vendorDetail.vendor_id ? String(vendorDetail.vendor_id) : "",
            invoice_number: vendorDetail.invoice_number || "",
            invoice_date: vendorDetail.invoice_date || "",
            tax: vendorDetail.tax || "0",
            total_value: vendorDetail.total_value || "",
          });
          setSpNumber(record.purchase_number || "");
          setSavedPurchaseDetailId(vendorDetail.id || null);
          setPurchaseStatus(vendorDetail.id ? "Purchase details loaded." : "");
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

  const computedTotalAfterTax = useMemo(() => {
    const subtotal = toNumber(computedItemsTotalValue);
    const taxPercent = toNumber(vendorFormValues.tax);
    const totalAfterTax = subtotal + (subtotal * taxPercent / 100);
    return toCurrency(totalAfterTax);
  }, [computedItemsTotalValue, vendorFormValues.tax]);

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
          category: String(item.item_category || ""),
          uomId: item.uom_id ? String(item.uom_id) : "",
        }))
        .filter((item) => item.id && item.code)
        .sort((a, b) => a.code.localeCompare(b.code));
  };

  const getItemMasterById = (itemId) => {
    const normalizedId = String(itemId || "").trim();
    if (!normalizedId) return null;
    return itemMasterOptions.find((item) => String(item.id || "") === normalizedId) || null;
  };

  const dimensionPatchFromMaster = (masterItem) => ({
    length: toDimensionValue(masterItem?.length, "0"),
    width: toDimensionValue(masterItem?.width, "0"),
    height: toDimensionValue(masterItem?.height, "0"),
    volume: toDimensionValue(masterItem?.volume, "0"),
  });

  useEffect(() => {
    if (!itemMasterOptions.length) return;

    setItems((prev) =>
      prev.map((row) => {
        const masterItem = getItemMasterById(row.item_code_id || row.item_master_id);
        if (!masterItem) return row;
        const patch = dimensionPatchFromMaster(masterItem);
        if (
          row.length === patch.length
          && row.width === patch.width
          && row.height === patch.height
          && row.volume === patch.volume
        ) {
          return row;
        }
        return {
          ...row,
          ...patch,
          item_master_id: row.item_master_id || String(masterItem.id || ""),
          item_category_id: row.item_category_id || String(masterItem.item_category_id || ""),
          item_category: row.item_category || String(masterItem.item_category || ""),
          item_name: row.item_name || String(masterItem.item_name || ""),
          item_code: row.item_code || String(masterItem.item_code || ""),
          item_code_id: row.item_code_id || String(masterItem.id || ""),
          uom_id: row.uom_id || (masterItem.uom_id ? String(masterItem.uom_id) : ""),
        };
      })
    );
  }, [itemMasterOptions]);

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
            ...dimensionPatchFromMaster(null),
          };
        })
    );
  };

  const handleItemCodeSelect = (rowId, itemCodeId) => {
    setItems((prev) =>
        prev.map((row) => {
          if (row.rowId !== rowId) return row;
          const selected = getItemMasterById(itemCodeId);
          return {
            ...row,
            item_master_id: selected ? String(selected.id) : "",
            item_category_id: selected ? String(selected.item_category_id || "") : row.item_category_id,
            item_category: selected ? String(selected.item_category || "") : row.item_category,
            item_name: selected ? String(selected.item_name || "") : row.item_name,
            item_code: selected ? String(selected.item_code || "") : "",
            item_code_id: selected ? String(selected.id || "") : "",
            uom_id: selected?.uom_id ? String(selected.uom_id) : row.uom_id,
            ...dimensionPatchFromMaster(selected),
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
          return next;
        })
    );
  };

  const addItemRow = () => {
    if (!savedPurchaseDetailId) return;
    setItems((prev) => [...prev, emptyItem(nextItemId)]);
    setNextItemId((prev) => prev + 1);
  };

  const deleteItemRow = (rowId) => {
    if (!savedPurchaseDetailId) return;
    const row = items.find((r) => r.rowId === rowId);
    if (row?.lce_estimate_id) return; // blocked — button should also be disabled
    const confirmed = window.confirm("Delete this purchase item row?");
    if (!confirmed) return;
    setItems((prev) => (prev.length > 1 ? prev.filter((r) => r.rowId !== rowId) : prev));
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
        tax: vendorFormValues.tax || "0",
        total_value: computedItemsTotalValue,
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
        .filter((row) => String(row.item_name || "").trim())
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

  return (
      <section className="module-page">
        <div className="crud-page__header" style={{ marginBottom: "0.8rem" }}>
          <h1 className="module-page__title" style={{ margin: 0 }}>
            {isEditMode ? "Stock Purchase Edit" : "Stock Purchase Add"}
            {spNumber ? <span style={{ marginLeft: "0.75rem", color: "#0ea5e9", fontWeight: 700, fontSize: "1rem" }}>[{spNumber}]</span> : null}
          </h1>
          <button
              type="button"
              className="crud-add-btn"
              onClick={() => navigate("/stock-purchase")}
              disabled={saving}
          >
            Back to List
          </button>
        </div>

        {status ? (
            <p
                className={`users-status users-status--${getStatusType(status)}`}
                style={
                  getStatusType(status) === "success"
                      ? { background: "#22bb33", color: "#fff", padding: "0.5rem 1rem", borderRadius: 6, margin: 0 }
                      : { background: "orange", color: "#fff", padding: "0.5rem 1rem", borderRadius: 6, margin: 0 }
                }
            >
              {status}
            </p>
        ) : null}
        {loadingRecord ? <p className="users-status">Loading record...</p> : null}

        {!loadingRecord ? <form className="modal-form stock-purchase-add-form" onSubmit={handleSubmit}>
          <div className="stock-purchase-add-form__row--full">
            <h3 style={{ margin: "0.2rem 0 0.6rem" }}>Purchase Details</h3>
          </div>

          <div className="modal-form__row stock-purchase-add-form__row--full stock-purchase-add-form__purchase-details-row">
            <div className="modal-form__row">
              <label className="modal-form__label" htmlFor="sp-vendor-id">Vendor *</label>
              <select
                  id="sp-vendor-id"
                  name="vendor_id"
                  className="auth-input"
                  value={vendorFormValues.vendor_id}
                  onChange={handleVendorChange}
                  required
              >
                <option value="">Select vendor</option>
                {vendorOptions.map((vendor) => (
                    <option key={vendor.id} value={vendor.id}>{vendor.name}</option>
                ))}
              </select>
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
              />
            </div>
            <div className="modal-form__row">
              <label className="modal-form__label" htmlFor="sp-tax">Tax (%)</label>
              <input
                  id="sp-tax"
                  name="tax"
                  type="number"
                  step="any"
                  className="auth-input"
                  value={vendorFormValues.tax}
                  onChange={handleVendorChange}
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

          <div className="stock-purchase-add-form__row--full" style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <button
                type="button"
                className="crud-add-btn"
                onClick={handleSavePurchaseDetails}
                disabled={savingPurchaseDetails}
            >
              {savingPurchaseDetails ? "Saving Purchase Details..." : "Save Purchase Details"}
            </button>
            {purchaseStatus ? <span className="users-status" style={{ margin: 0 }}>{purchaseStatus}</span> : null}
          </div>

          <div className="modal-form__row stock-purchase-add-form__row--full">
            <label className="modal-form__label" htmlFor="sp-notes">Notes</label>
            <textarea
                id="sp-notes"
                name="notes"
                className="auth-input modal-form__textarea"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="stock-purchase-add-form__row--full">
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
            <div className="users-table-wrap" style={{ overflowX: "auto" }}>
              <table className="users-table users-table--sp-items">
                <thead>
                <tr>
                  <th>Item Category</th>
                  <th>Item Name</th>
                  <th>Item Code</th>
                  <th>Item Type</th>
                  <th>GRN No.</th>
                  <th>UOM</th>
                  <th>Qty/Size</th>
                  <th>Unit Price</th>
                  <th>Total Price</th>
                  <th>Length</th>
                  <th>Width</th>
                  <th>Height/Thk</th>
                  <th>Volume</th>
                  <th style={{ textAlign: "center" }}>Trace</th>
                  <th>Action</th>
                </tr>
                </thead>
                <tbody>
                {items.map((row) => {
                  // ...existing code...
                  return (
                      <tr key={row.rowId}>
                        <td>
                          <select
                              className="auth-input"
                              value={row.item_category_id}
                              onChange={(e) => handleCategorySelect(row.rowId, e.target.value)}
                              disabled={!savedPurchaseDetailId}
                          >
                            <option value="">Select category</option>
                            {categoryOptions.map((category) => (
                                <option key={`${row.rowId}-cat-${category.id}`} value={category.id}>{category.name}</option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <input className="auth-input auth-input--readonly" value={row.item_name} readOnly disabled />
                        </td>
                        <td>
                          <select
                              className="auth-input"
                              value={row.item_code_id}
                              onChange={(e) => handleItemCodeSelect(row.rowId, e.target.value)}
                              disabled={!savedPurchaseDetailId || !row.item_category_id}
                          >
                            <option value="">Select item code</option>
                            {getItemCodesForSelection(row.item_category_id).map((item) => (
                                <option key={`${row.rowId}-code-${item.id}`} value={item.id}>{item.code}</option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <select
                              className="auth-input"
                              value={row.item_type}
                              onChange={(e) => handleItemValueChange(row.rowId, "item_type", e.target.value)}
                              disabled={!savedPurchaseDetailId}
                          >
                            <option value="BUY">BUY</option>
                            <option value="MAKE">MAKE</option>
                          </select>
                        </td>
                        <td>
                          <input className="auth-input auth-input--readonly" value={row.grn_number || "Auto"} readOnly disabled />
                        </td>
                        <td>
                          <select
                              className="auth-input"
                              value={row.uom_id}
                              onChange={(e) => handleItemValueChange(row.rowId, "uom_id", e.target.value)}
                              disabled={!savedPurchaseDetailId}
                          >
                            <option value="">— UOM —</option>
                            {uomOptions.map((u) => (
                                <option key={u.id} value={u.id}>{u.name} ({u.symbol})</option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <input
                              type="number"
                              step="any"
                              className="auth-input"
                              value={row.quantity}
                              onChange={(e) => handleItemValueChange(row.rowId, "quantity", e.target.value)}
                              disabled={!savedPurchaseDetailId}
                          />
                        </td>
                        <td>
                          <input
                              type="number"
                              step="any"
                              className="auth-input"
                              value={row.unit_price}
                              onChange={(e) => handleItemValueChange(row.rowId, "unit_price", e.target.value)}
                              disabled={!savedPurchaseDetailId}
                          />
                        </td>
                        <td>
                          <input className="auth-input auth-input--readonly" value={row.total_price} readOnly />
                        </td>
                        <td>
                          <input
                              type="number"
                              step="any"
                              min="0"
                              className="auth-input auth-input--readonly"
                              value={row.length}
                              readOnly
                              disabled
                          />
                        </td>
                        <td>
                          <input
                              type="number"
                              step="any"
                              min="0"
                              className="auth-input auth-input--readonly"
                              value={row.width}
                              readOnly
                              disabled
                          />
                        </td>
                        <td>
                          <input
                              type="number"
                              step="any"
                              min="0"
                              className="auth-input auth-input--readonly"
                              value={row.height}
                              readOnly
                              disabled
                          />
                        </td>
                        <td>
                          <input
                              className="auth-input auth-input--readonly"
                              value={row.volume}
                              readOnly
                              disabled
                          />
                        </td>
                        <td style={{ verticalAlign: "middle", textAlign: "center" }}>
                          {row.rowId && row.grn_number ? (
                              <a
                                  href={`/stock-purchase/item-trace/${row.rowId}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title="Open traceability view"
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "0.25rem",
                                    color: "#16b2a5",
                                    fontSize: "0.75rem",
                                    fontWeight: 600,
                                    textDecoration: "none",
                                    padding: "2px 6px",
                                    border: "1px solid #16b2a5",
                                    borderRadius: "4px",
                                    whiteSpace: "nowrap",
                                  }}
                              >
                                <BsBoxArrowUpRight size={11} aria-hidden="true" />
                                Trace
                              </a>
                          ) : (
                              <span style={{ color: "#5a8a88", fontSize: "0.75rem" }}>—</span>
                          )}
                        </td>
                        <td style={{ verticalAlign: "middle", textAlign: "center" }}>
                          <button
                              type="button"
                              className="users-action users-action--delete"
                              onClick={() => deleteItemRow(row.rowId)}
                              disabled={!savedPurchaseDetailId || items.length <= 1 || saving || !!row.lce_estimate_id}
                              title={getDeleteItemTitle(row)}
                              aria-label="Delete"
                              style={{ display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                          >
                            <BsTrashFill aria-hidden="true" />
                          </button>
                        </td>
                      </tr>
                  );
                })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="modal-form__actions">
            <button type="button" className="modal-btn modal-btn--cancel" onClick={() => navigate("/stock-purchase")}>
              Cancel
            </button>
            <button type="submit" className="modal-btn modal-btn--save" disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </form> : null}
      </section>
  );
}

export default StockPurchaseAddPage;

