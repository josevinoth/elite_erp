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

      <form className="vendor-form" onSubmit={handleSave}>
        <div className="vendor-form__grid">
          <label className="vendor-form__field">
            Vendor Name *
            <input name="vendor_name" className="auth-input" value={form.vendor_name} onChange={onChange} required />
          </label>
          <label className="vendor-form__field">
            Contact Person
            <input name="contact_person" className="auth-input" value={form.contact_person} onChange={onChange} />
          </label>
          <label className="vendor-form__field">
            Phone Number
            <input name="phone_number" className="auth-input" value={form.phone_number} onChange={onChange} />
          </label>
          <label className="vendor-form__field">
            Email
            <input name="email_id" className="auth-input" value={form.email_id} onChange={onChange} />
          </label>
        </div>

        <label className="vendor-form__field vendor-form__field--full">
          Address
          <textarea
            rows={3}
            name="address"
            className="auth-input vendor-form__textarea"
            value={form.address}
            onChange={onChange}
          />
        </label>

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

