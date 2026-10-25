import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { BsPencilSquare, BsPlusCircleFill } from "react-icons/bs";
import { createVendor, getVendor, listVendors, updateVendor } from "../services/crudApi";
import "../styles/Vendor.css";

const EMPTY_FORM = {
  vendor_name: "",
  contact_person: "",
  phone_number: "",
  email_id: "",
  address: "",
};

const normalize = (value) => String(value || "").trim();

function VendorFormPage() {
  const { id } = useParams();
  const isEditMode = Boolean(id);
  const navigate = useNavigate();

  const [form, setForm] = useState(EMPTY_FORM);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(isEditMode);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;

    const loadData = async () => {
      if (isEditMode) setLoading(true);
      setError("");

      try {
        const [listData, singleData] = await Promise.all([
          listVendors().catch(() => ({ vendors: [] })),
          isEditMode ? getVendor(id).catch(() => null) : Promise.resolve(null),
        ]);

        if (!alive) return;

        const allVendors = Array.isArray(listData?.vendors) ? listData.vendors : [];
        setVendors(allVendors);

        if (isEditMode) {
          const vendorRecord =
            singleData?.vendor ||
            allVendors.find((v) => String(v.id) === String(id));

          if (vendorRecord) {
            setForm({
              vendor_name: vendorRecord.vendor_name || "",
              contact_person: vendorRecord.contact_person || "",
              phone_number: vendorRecord.phone_number || "",
              email_id: vendorRecord.email_id || "",
              address: vendorRecord.address || "",
            });
          } else {
            setError("Vendor not found.");
          }
        } else {
          setForm(EMPTY_FORM);
        }
      } catch (err) {
        if (!alive) return;
        setError(err.message || "Failed to load vendor details.");
      } finally {
        if (alive) setLoading(false);
      }
    };

    loadData();

    return () => {
      alive = false;
    };
  }, [id, isEditMode]);

  const duplicateNameExists = useMemo(() => {
    const target = normalize(form.vendor_name).toLowerCase();
    if (!target) return false;
    return vendors.some(
      (row) =>
        String(row.vendor_name || "").trim().toLowerCase() === target &&
        (!isEditMode || String(row.id) !== String(id))
    );
  }, [form.vendor_name, vendors, id, isEditMode]);

  const onChange = (event) => {
    const { name, value } = event.target;
    if (name === "phone_number") {
      const numbersOnly = value.replace(/\D/g, "");
      setForm((prev) => ({ ...prev, [name]: numbersOnly }));
      return;
    }
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const onPhoneKeyDown = (e) => {
    const allowed = ["Backspace", "Delete", "ArrowLeft", "ArrowRight", "Tab", "Enter", "Home", "End"];
    if (allowed.includes(e.key) || e.ctrlKey || e.metaKey) return;
    if (!/^[0-9]$/.test(e.key)) {
      e.preventDefault();
    }
  };

  const onPhonePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text/plain");
    const digitsOnly = pasted.replace(/\D/g, "");
    setForm((prev) => ({
      ...prev,
      phone_number: (prev.phone_number + digitsOnly).slice(0, 15),
    }));
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
      setError("Vendor name is required.");
      return;
    }
    if (!payload.contact_person) {
      setError("Contact person is required.");
      return;
    }
    if (!payload.phone_number) {
      setError("Phone number is required.");
      return;
    }
    if (!/^\d+$/.test(payload.phone_number)) {
      setError("Phone number must contain numbers only.");
      return;
    }
    if (!payload.email_id) {
      setError("Email is required.");
      return;
    }
    if (!payload.email_id.includes("@")) {
      setError("Email must contain '@'.");
      return;
    }
    if (!payload.address) {
      setError("Address is required.");
      return;
    }
    if (duplicateNameExists) {
      setError("Vendor name already exists.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      if (isEditMode) {
        await updateVendor(id, payload);
      } else {
        await createVendor(payload);
      }
      navigate("/vendors");
    } catch (err) {
      setError(err.message || `Failed to ${isEditMode ? "update" : "create"} vendor.`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="vendor-form-page">
      <div className="vendor-form-page__center">
        <div className="vendor-card col-4">
          <div className="vendor-card__head">
            <h2 className="vendor-card__title">
              <BsPlusCircleFill className="vendor-card__title-icon" aria-hidden="true" />
              Add/Edit Vendors
            </h2>
            {isEditMode ? (
              <span className="vendor-card__badge">
                <BsPencilSquare aria-hidden="true" /> Editing #{id}
              </span>
            ) : null}
          </div>

          <div className="vendor-card__body">
            {loading ? <p className="users-status">Loading vendor details...</p> : null}
            {error ? <p className="users-status users-status--error">{error}</p> : null}
            {duplicateNameExists ? (
              <p className="users-status users-status--warning">Vendor name already exists.</p>
            ) : null}

            {!loading ? (
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
                      autoFocus
                    />
                  </div>
                </div>

                <div className="vendor-form__field-row">
                  <label htmlFor="contact_person" className="vendor-form__label">
                    Contact Person <span className="vendor-form__required">*</span>
                  </label>
                  <div className="vendor-form__control">
                    <input
                      id="contact_person"
                      name="contact_person"
                      className="auth-input"
                      value={form.contact_person}
                      onChange={onChange}
                      required
                      placeholder="Enter contact person"
                    />
                  </div>
                </div>

                <div className="vendor-form__field-row">
                  <label htmlFor="phone_number" className="vendor-form__label">
                    Phone Number <span className="vendor-form__required">*</span>
                  </label>
                  <div className="vendor-form__control">
                    <input
                      id="phone_number"
                      name="phone_number"
                      type="tel"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={15}
                      className="auth-input"
                      value={form.phone_number}
                      onChange={onChange}
                      onKeyDown={onPhoneKeyDown}
                      onPaste={onPhonePaste}
                      required
                      placeholder="Enter numbers only"
                    />
                  </div>
                </div>

                <div className="vendor-form__field-row">
                  <label htmlFor="email_id" className="vendor-form__label">
                    Email <span className="vendor-form__required">*</span>
                  </label>
                  <div className="vendor-form__control">
                    <input
                      id="email_id"
                      name="email_id"
                      type="email"
                      className="auth-input"
                      value={form.email_id}
                      onChange={onChange}
                      required
                      placeholder="Enter email address"
                    />
                  </div>
                </div>

                <div className="vendor-form__field-row vendor-form__field-row--textarea">
                  <label htmlFor="address" className="vendor-form__label">
                    Address <span className="vendor-form__required">*</span>
                  </label>
                  <div className="vendor-form__control">
                    <textarea
                      id="address"
                      rows={3}
                      name="address"
                      className="auth-input vendor-form__textarea"
                      value={form.address}
                      onChange={onChange}
                      required
                      placeholder="Enter address"
                    />
                  </div>
                </div>

                <div className="vendor-form__actions">
                  <button type="submit" className="crud-add-btn" disabled={saving}>
                    <BsPlusCircleFill aria-hidden="true" />
                    <span>
                      {saving
                        ? "Saving..."
                        : isEditMode
                        ? "Update Vendor"
                        : "Add Vendor"}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="modal-btn modal-btn--cancel"
                    onClick={() => navigate("/vendors")}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

export default VendorFormPage;
