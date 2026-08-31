import { useCallback, useEffect, useMemo, useState } from "react";
import { createPlaceStockOrder, listPlaceStockOrderMeta } from "../services/crudApi";
import "../styles/PlaceStockOrder.css";

const EMPTY_VENDOR = {
  vendor_id: "",
  vendor_code: "",
  vendor_name: "",
  address: "",
  phone_number: "",
  email_id: "",
  contact_person: "",
};

function PlaceStockOrderPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [vendors, setVendors] = useState([]);
  const [items, setItems] = useState([]);
  const [vendorForm, setVendorForm] = useState(EMPTY_VENDOR);
  const [selectedItemIds, setSelectedItemIds] = useState([]);
  const [status, setStatus] = useState({ type: "", message: "" });

  const loadMeta = useCallback(async () => {
    const data = await listPlaceStockOrderMeta();
    setVendors(Array.isArray(data?.vendors) ? data.vendors : []);
    setItems(Array.isArray(data?.items) ? data.items : []);
  }, []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    loadMeta()
      .catch((error) => {
        if (!alive) return;
        setStatus({ type: "error", message: error.message || "Failed to load place order data." });
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [loadMeta]);

  const onVendorChange = (event) => {
    const vendorId = String(event.target.value || "");
    const vendor = vendors.find((row) => String(row.id) === vendorId);
    if (!vendor) {
      setVendorForm(EMPTY_VENDOR);
      return;
    }
    setVendorForm({
      vendor_id: vendorId,
      vendor_code: vendor.vendor_code || "",
      vendor_name: vendor.vendor_name || "",
      address: vendor.address || "",
      phone_number: vendor.phone_number || "",
      email_id: vendor.email_id || "",
      contact_person: vendor.contact_person || "",
    });
  };

  const onEmailChange = (event) => {
    const value = event.target.value;
    setVendorForm((prev) => ({ ...prev, email_id: value }));
  };

  const toggleItem = (itemId) => {
    const normalized = String(itemId);
    setSelectedItemIds((prev) => (
      prev.includes(normalized)
        ? prev.filter((id) => id !== normalized)
        : [...prev, normalized]
    ));
  };

  const allSelected = useMemo(
    () => items.length > 0 && selectedItemIds.length === items.length,
    [items.length, selectedItemIds.length]
  );

  const toggleAll = () => {
    if (allSelected) {
      setSelectedItemIds([]);
      return;
    }
    setSelectedItemIds(items.map((row) => String(row.id)));
  };

  const handleSave = async () => {
    if (!vendorForm.vendor_id) {
      setStatus({ type: "error", message: "Vendor is required." });
      return;
    }
    if (vendorForm.email_id && !String(vendorForm.email_id).includes("@")) {
      setStatus({ type: "error", message: "Email must contain '@'." });
      return;
    }
    if (!selectedItemIds.length) {
      setStatus({ type: "error", message: "Select at least one item." });
      return;
    }

    setSaving(true);
    setStatus({ type: "", message: "" });
    try {
      const response = await createPlaceStockOrder({
        vendor_id: vendorForm.vendor_id,
        email_id: vendorForm.email_id,
        item_ids: selectedItemIds,
      });
      setStatus({ type: "success", message: response.message || "Stock order placed." });
      setSelectedItemIds([]);
      await loadMeta();
    } catch (error) {
      setStatus({ type: "error", message: error.message || "Failed to place stock order." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="module-page place-stock-order-page">
      <div className="crud-page__header place-stock-order-header">
        <h1 className="module-page__title">Place Stock Order</h1>
      </div>

      {status.message ? <p className={`users-status users-status--${status.type}`}>{status.message}</p> : null}

      <div className="place-stock-order-card">
        <h2 className="place-stock-order-card__title">Vendor Details</h2>
        <div className="place-stock-order-form-grid">
          <label className="place-stock-order-field">
            Vendor Name *
            <select className="auth-input" value={vendorForm.vendor_id} onChange={onVendorChange}>
              <option value="">Select vendor</option>
              {vendors.map((vendor) => (
                <option key={vendor.id} value={vendor.id}>{vendor.vendor_name}</option>
              ))}
            </select>
          </label>
          <label className="place-stock-order-field">
            Vendor Code
            <input className="auth-input auth-input--readonly" value={vendorForm.vendor_code} readOnly disabled />
          </label>
          <label className="place-stock-order-field">
            Phone Number
            <input className="auth-input auth-input--readonly" value={vendorForm.phone_number} readOnly disabled />
          </label>
          <label className="place-stock-order-field">
            Email
            <input className="auth-input" value={vendorForm.email_id} onChange={onEmailChange} />
          </label>
          <label className="place-stock-order-field">
            Contact Person
            <input className="auth-input auth-input--readonly" value={vendorForm.contact_person} readOnly disabled />
          </label>
          <label className="place-stock-order-field place-stock-order-field--full">
            Address
            <textarea rows={3} className="auth-input place-stock-order-address" value={vendorForm.address} readOnly disabled />
          </label>
        </div>
      </div>

      <div className="place-stock-order-card">
        <div className="place-stock-order-items-header">
          <h2 className="place-stock-order-card__title">No Stock Items</h2>
          <button type="button" className="crud-add-btn" onClick={handleSave} disabled={saving || loading}>
            {saving ? "Saving..." : "Save Order"}
          </button>
        </div>

        {loading ? <p className="users-status">Loading items...</p> : null}

        {!loading ? (
          <div className="users-table-wrap place-stock-order-table-wrap">
            <table className="users-table place-stock-order-table">
              <thead>
                <tr>
                  <th>
                    <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Select all items" />
                  </th>
                  <th>Costing</th>
                  <th>Item Category</th>
                  <th>Item Name</th>
                  <th>Item Code</th>
                  <th>Item Type</th>
                  <th className="place-stock-order-table__right">Purchase Qty</th>
                  <th className="place-stock-order-table__right">Requested Qty</th>
                  <th className="place-stock-order-table__center">Size (L x W x H)</th>
                  <th className="place-stock-order-table__right">Volume</th>
                  <th>Stock Status</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="place-stock-order-empty">No 'No Stock' items found.</td>
                  </tr>
                ) : items.map((row) => {
                  const checked = selectedItemIds.includes(String(row.id));
                  return (
                    <tr key={row.id}>
                      <td>
                        <input type="checkbox" checked={checked} onChange={() => toggleItem(row.id)} aria-label={`Select item ${row.id}`} />
                      </td>
                      <td>{row.costing_code || row.costing_id}</td>
                      <td>{row.item_category}</td>
                      <td>{row.item_name}</td>
                      <td>{row.item_code}</td>
                      <td>{row.item_type}</td>
                      <td className="place-stock-order-table__right">{row.purchase_qty}</td>
                      <td className="place-stock-order-table__right">{row.requested_qty}</td>
                      <td className="place-stock-order-table__center">{row.length} x {row.width} x {row.height}</td>
                      <td className="place-stock-order-table__right">{row.volume}</td>
                      <td>{row.stock_status}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </section>
  );
}

export default PlaceStockOrderPage;

