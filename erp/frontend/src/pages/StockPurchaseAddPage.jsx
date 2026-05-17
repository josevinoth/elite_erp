import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { BsBoxArrowUpRight, BsPlusCircleFill, BsTrashFill } from "react-icons/bs";
import {
  createStockPurchase,
  createStockPurchaseVendorDetail,
  getStockPurchaseById,
  listLabFurnitureItems,
  listVendors,
  updateStockPurchase,
  updateStockPurchaseVendorDetail,
} from "../services/crudApi";

const emptyItem = (id) => ({
  rowId: id,
  grn_number: "",
  item_master_id: "",
  item_category: "",
  item_name: "",
  item_code: "",
  quantity: "",
  unit_price: "",
  total_price: "0.00",
});

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toCurrency = (value) => (Math.round((value + Number.EPSILON) * 100) / 100).toFixed(2);

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
  const [itemMasterOptions, setItemMasterOptions] = useState([]);
  const [items, setItems] = useState([emptyItem(1)]);
  const [nextItemId, setNextItemId] = useState(2);
  const [savedPurchaseDetailId, setSavedPurchaseDetailId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [savingPurchaseDetails, setSavingPurchaseDetails] = useState(false);
  const [status, setStatus] = useState("");
  const [purchaseStatus, setPurchaseStatus] = useState("");
  const [loadingRecord, setLoadingRecord] = useState(isEditMode);
  const [spNumber, setSpNumber] = useState("");

  useEffect(() => {
    let alive = true;

    Promise.all([listVendors(), listLabFurnitureItems()])
      .then(([vendorData, itemData]) => {
        if (!alive) return;
        setVendorOptions(vendorData.vendors || []);
        setItemMasterOptions(itemData.lab_furniture_items || []);
      })
      .catch(() => {
        if (!alive) return;
        setVendorOptions([]);
        setItemMasterOptions([]);
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
              item_master_id: "",
              item_category: item.item_category || "",
              item_name: item.item_name || "",
              item_code: item.item_code || "",
              quantity: item.quantity || "0",
              unit_price: item.unit_price || "0",
              total_price: item.total_price || "0",
              lce_estimate_id: item.lce_estimate_id || null,
            }))
          : [];

        setVendorFormValues({
          vendor_id: vendorDetail.vendor_id ? String(vendorDetail.vendor_id) : "",
          invoice_number: vendorDetail.invoice_number || "",
          invoice_date: vendorDetail.invoice_date || "",
          tax: vendorDetail.tax || "0",
          total_value: vendorDetail.total_value || "0",
        });
        setSpNumber(record.purchase_number || "");
        setSavedPurchaseDetailId(vendorDetail.id || null);
        setPurchaseStatus(vendorDetail.id ? "Purchase details loaded." : "");
        setNotes(record.notes || "");
        setItems(loadedItems.length ? loadedItems : [emptyItem(1)]);
        setNextItemId((loadedItems.reduce((max, row) => Math.max(max, Number(row.rowId) || 0), 0) || 0) + 1);
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

  const categoryOptions = useMemo(() => {
    const unique = new Map();
    itemMasterOptions.forEach((item) => {
      const category = String(item.item_category || "").trim();
      if (category && !unique.has(category)) {
        unique.set(category, category);
      }
    });
    return [...unique.values()].sort((a, b) => a.localeCompare(b));
  }, [itemMasterOptions]);

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

  const getItemNamesForCategory = (category) => {
    const unique = new Map();
    itemMasterOptions
      .filter((item) => String(item.item_category || "") === String(category || ""))
      .forEach((item) => {
        const name = String(item.item_name || "").trim();
        if (name && !unique.has(name)) unique.set(name, name);
      });
    return [...unique.values()].sort((a, b) => a.localeCompare(b));
  };

  const getItemCodesForSelection = (category, itemName) => {
    return itemMasterOptions
      .filter(
        (item) =>
          String(item.item_category || "") === String(category || "")
          && String(item.item_name || "") === String(itemName || "")
      )
      .map((item) => String(item.item_code || ""))
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
  };

  const handleCategorySelect = (rowId, category) => {
    setItems((prev) =>
      prev.map((row) => {
        if (row.rowId !== rowId) return row;
        return {
          ...row,
          item_master_id: "",
          item_category: category,
          item_name: "",
          item_code: "",
        };
      })
    );
  };

  const handleItemNameSelect = (rowId, itemName) => {
    const normalized = String(itemName || "").trim().toLowerCase();
    if (normalized) {
      const alreadyExists = items.some(
        (row) => row.rowId !== rowId && String(row.item_name || "").trim().toLowerCase() === normalized
      );
      if (alreadyExists) {
        window.alert("Duplicate item name is not allowed in the same invoice.");
        return;
      }
    }

    setItems((prev) =>
      prev.map((row) => {
        if (row.rowId !== rowId) return row;
        const selected = itemMasterOptions.find(
          (item) =>
            String(item.item_category || "") === String(row.item_category || "")
            && String(item.item_name || "") === String(itemName || "")
        );
        return {
          ...row,
          item_master_id: selected ? String(selected.id) : "",
          item_name: itemName,
          item_code: selected ? String(selected.item_code || "") : "",
        };
      })
    );
  };

  const handleItemCodeSelect = (rowId, itemCode) => {
    setItems((prev) =>
      prev.map((row) => {
        if (row.rowId !== rowId) return row;
        const selected = itemMasterOptions.find(
          (item) =>
            String(item.item_category || "") === String(row.item_category || "")
            && String(item.item_name || "") === String(row.item_name || "")
            && String(item.item_code || "") === String(itemCode || "")
        );
        return {
          ...row,
          item_master_id: selected ? String(selected.id) : "",
          item_code: itemCode,
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
        item_category: row.item_category,
        item_name: row.item_name,
        item_code: row.item_code,
        quantity: row.quantity || "0",
        unit_price: row.unit_price || "0",
        total_price: row.total_price || "0",
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

      {status ? <p className="users-status users-status--error">{status}</p> : null}
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
              <BsPlusCircleFill aria-hidden="true" />
            </button>
          </div>
          <div className="users-table-wrap">
            <table className="users-table">
              <thead>
                <tr>
                  <th>Item Category</th>
                  <th>Item Name</th>
                  <th>Item Code</th>
                  <th>GRN No.</th>
                  <th>Qty</th>
                  <th>Unit Price</th>
                  <th>Total Price</th>
                  <th style={{ textAlign: "center" }}>Trace</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.rowId}>
                    <td>
                      <select
                        className="auth-input"
                        value={row.item_category}
                        onChange={(e) => handleCategorySelect(row.rowId, e.target.value)}
                        disabled={!savedPurchaseDetailId}
                      >
                        <option value="">Select category</option>
                        {categoryOptions.map((category) => (
                          <option key={`${row.rowId}-cat-${category}`} value={category}>{category}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select
                        className="auth-input"
                        value={row.item_name}
                        onChange={(e) => handleItemNameSelect(row.rowId, e.target.value)}
                        disabled={!savedPurchaseDetailId || !row.item_category}
                      >
                        <option value="">Select item name</option>
                        {getItemNamesForCategory(row.item_category).map((itemName) => (
                          <option key={`${row.rowId}-name-${itemName}`} value={itemName}>{itemName}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select
                        className="auth-input"
                        value={row.item_code}
                        onChange={(e) => handleItemCodeSelect(row.rowId, e.target.value)}
                        disabled={!savedPurchaseDetailId || !row.item_name}
                      >
                        <option value="">Select item code</option>
                        {getItemCodesForSelection(row.item_category, row.item_name).map((itemCode) => (
                          <option key={`${row.rowId}-code-${itemCode}`} value={itemCode}>{itemCode}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input className="auth-input auth-input--readonly" value={row.grn_number || "Auto"} readOnly disabled />
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
                ))}
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

