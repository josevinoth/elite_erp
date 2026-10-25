import { useCallback, useEffect, useMemo, useState } from "react";
import { BsPencilSquare, BsPlusCircleFill, BsTrashFill } from "react-icons/bs";
import { createVendor, deleteVendor, listVendors, updateVendor } from "../services/crudApi";
import "../styles/Vendor.css";

const EMPTY_FORM = {
  vendor_name: "",
  contact_person: "",
  phone_number: "",
  email_id: "",
  address: "",
};

const normalize = (value) => String(value || "").trim();

function VendorsPage() {
  const [vendors, setVendors] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState({ type: "", message: "" });

  const loadVendors = useCallback(async () => {
    const data = await listVendors();
    setVendors(Array.isArray(data?.vendors) ? data.vendors : []);
  }, []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    loadVendors()
      .catch((error) => {
        if (!alive) return;
        setStatus({ type: "error", message: error.message || "Failed to load vendors." });
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [loadVendors]);

  const duplicateNameExists = useMemo(() => {
    const target = normalize(form.vendor_name).toLowerCase();
    if (!target) return false;
    return vendors.some((row) => String(row.vendor_name || "").trim().toLowerCase() === target && String(row.id) !== String(editingId || ""));
  }, [editingId, form.vendor_name, vendors]);

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
  };

  const onChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const startEdit = (vendor) => {
    setEditingId(vendor.id);
    setForm({
      vendor_name: vendor.vendor_name || "",
      contact_person: vendor.contact_person || "",
      phone_number: vendor.phone_number || "",
      email_id: vendor.email_id || "",
      address: vendor.address || "",
    });
  };

  const handleSave = async (event) => {
    event.preventDefault();
    const payload = {
      vendor_name: normalize(form.vendor_name),
      contact_person: normalize(form.contact_person),
      phone_number: normalize(form.phone_number),
      email_id: normalize(form.email_id),
      address: normalize(form.address),
    };

    if (!payload.vendor_name) {
      setStatus({ type: "error", message: "Vendor name is required." });
      return;
    }
    if (duplicateNameExists) {
      setStatus({ type: "error", message: "Vendor name already exists." });
      return;
    }
    if (payload.email_id && !payload.email_id.includes("@")) {
      setStatus({ type: "error", message: "Email must contain '@'." });
      return;
    }

    setSaving(true);
    setStatus({ type: "", message: "" });
    try {
      if (editingId) {
        await updateVendor(editingId, payload);
        setStatus({ type: "success", message: "Vendor updated." });
      } else {
        await createVendor(payload);
        setStatus({ type: "success", message: "Vendor created." });
      }
      await loadVendors();
      resetForm();
    } catch (error) {
      setStatus({ type: "error", message: error.message || "Failed to save vendor." });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (vendorId) => {
    if (!window.confirm("Delete this vendor?")) return;
    try {
      await deleteVendor(vendorId);
      await loadVendors();
      if (String(editingId || "") === String(vendorId)) {
        resetForm();
      }
      setStatus({ type: "success", message: "Vendor deleted." });
    } catch (error) {
      setStatus({ type: "error", message: error.message || "Failed to delete vendor." });
    }
  };

  return (
    <section className="module-page vendor-page">
      <div className="crud-page__header vendor-page__header">
        <h1 className="module-page__title module-page__title--vendors">Vendors</h1>
      </div>

      {status.message ? <p className={`users-status users-status--${status.type}`}>{status.message}</p> : null}

      <div className="vendor-card col-4">
        <div className="vendor-card__head">
          <h2 className="vendor-card__title">
            <BsPlusCircleFill className="vendor-card__title-icon" aria-hidden="true" />
            Add/Edit Vendors
          </h2>
          {editingId ? (
            <span className="vendor-card__badge">
              <BsPencilSquare aria-hidden="true" /> Editing #{editingId}
            </span>
          ) : null}
        </div>

        <div className="vendor-card__body">
          <form className="vendor-form" onSubmit={handleSave}>
            <div className="vendor-form__field-row">
              <label htmlFor="vendor_name" className="vendor-form__label">
                Vendor Name <span className="vendor-form__required">*</span>
              </label>
              <div className="vendor-form__control">
                <input
                  id="vendor_name"
                  name="vendor_name"
                  className="auth-input"
                  value={form.vendor_name}
                  onChange={onChange}
                  required
                  placeholder="Enter vendor name"
                />
              </div>
            </div>

            <div className="vendor-form__field-row">
              <label htmlFor="contact_person" className="vendor-form__label">
                Contact Person
              </label>
              <div className="vendor-form__control">
                <input
                  id="contact_person"
                  name="contact_person"
                  className="auth-input"
                  value={form.contact_person}
                  onChange={onChange}
                  placeholder="Enter contact person"
                />
              </div>
            </div>

            <div className="vendor-form__field-row">
              <label htmlFor="phone_number" className="vendor-form__label">
                Phone Number
              </label>
              <div className="vendor-form__control">
                <input
                  id="phone_number"
                  name="phone_number"
                  className="auth-input"
                  value={form.phone_number}
                  onChange={onChange}
                  placeholder="Enter phone number"
                />
              </div>
            </div>

            <div className="vendor-form__field-row">
              <label htmlFor="email_id" className="vendor-form__label">
                Email
              </label>
              <div className="vendor-form__control">
                <input
                  id="email_id"
                  name="email_id"
                  type="email"
                  className="auth-input"
                  value={form.email_id}
                  onChange={onChange}
                  placeholder="Enter email address"
                />
              </div>
            </div>

            <div className="vendor-form__field-row vendor-form__field-row--textarea">
              <label htmlFor="address" className="vendor-form__label">
                Address
              </label>
              <div className="vendor-form__control">
                <textarea
                  id="address"
                  rows={3}
                  name="address"
                  className="auth-input vendor-form__textarea"
                  value={form.address}
                  onChange={onChange}
                  placeholder="Enter address"
                />
              </div>
            </div>

            <div className="vendor-form__actions">
              <button type="submit" className="crud-add-btn" disabled={saving}>
                <BsPlusCircleFill aria-hidden="true" />
                <span>{saving ? "Saving..." : editingId ? "Update Vendor" : "Add Vendor"}</span>
              </button>
              {editingId ? (
                <button type="button" className="modal-btn modal-btn--cancel" onClick={resetForm}>
                  Cancel Edit
                </button>
              ) : null}
            </div>
          </form>
        </div>
      </div>

      {duplicateNameExists ? (
        <p className="users-status users-status--warning">Vendor name already exists.</p>
      ) : null}

      {loading ? <p className="users-status">Loading vendors...</p> : null}

      {!loading ? (
        <div className="users-table-wrap vendor-table-wrap">
          <table className="users-table vendor-table">
            <thead>
              <tr>
                <th>Vendor Code</th>
                <th>Vendor Name</th>
                <th>Contact Person</th>
                <th>Phone</th>
                <th>Email</th>
                <th>Address</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {vendors.length === 0 ? (
                <tr>
                  <td colSpan={7} className="vendor-table__empty">No vendors found.</td>
                </tr>
              ) : vendors.map((vendor) => (
                <tr key={vendor.id}>
                  <td>{vendor.vendor_code || "-"}</td>
                  <td>{vendor.vendor_name || "-"}</td>
                  <td>{vendor.contact_person || "-"}</td>
                  <td>{vendor.phone_number || "-"}</td>
                  <td>{vendor.email_id || "-"}</td>
                  <td className="vendor-table__address">{vendor.address || "-"}</td>
                  <td>
                    <div className="vendor-table__actions">
                      <button type="button" className="users-action users-action--edit" title="Edit" onClick={() => startEdit(vendor)}>
                        <BsPencilSquare aria-hidden="true" />
                      </button>
                      <button type="button" className="users-action users-action--delete" title="Delete" onClick={() => handleDelete(vendor.id)}>
                        <BsTrashFill aria-hidden="true" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

export default VendorsPage;

