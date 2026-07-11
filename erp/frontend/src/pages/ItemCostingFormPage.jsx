import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  createItemCosting,
  getItemCostingCostPreview,
  getItemCosting,
  listItemCostingMeta,
  updateItemCosting,
} from "../services/ItemCostingServiceAPI";

const EMPTY_FORM = {
  project_ref_id: "",
  item_category_id: "",
  item_description: "",
  item_code: "",
  qty: "",
  cost_max: "0",
  cost_min: "0",
  cost: "0",
  uom_id: "",
  total_price: "0",
};

function ItemCostingFormPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditMode = Boolean(id);

  const [form, setForm] = useState(EMPTY_FORM);
  const [meta, setMeta] = useState({ project_refs: [], item_categories: [], lab_items: [], uoms: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [isManualCost, setIsManualCost] = useState(false);

  useEffect(() => {
    let alive = true;

    const loadData = async () => {
      setLoading(true);
      setStatus("");
      try {
        const [metaData, detailData] = await Promise.all([
          listItemCostingMeta(),
          isEditMode ? getItemCosting(id) : Promise.resolve(null),
        ]);

        if (!alive) return;

        setMeta({
          project_refs: Array.isArray(metaData?.project_refs) ? metaData.project_refs : [],
          item_categories: Array.isArray(metaData?.item_categories) ? metaData.item_categories : [],
          lab_items: Array.isArray(metaData?.lab_items) ? metaData.lab_items : [],
          uoms: Array.isArray(metaData?.uoms) ? metaData.uoms : [],
        });

        if (detailData?.item) {
          setForm({
            project_ref_id: String(detailData.item.project_ref_id || ""),
            item_category_id: String(detailData.item.item_category_id || ""),
            item_description: detailData.item.item_description || "",
            item_code: detailData.item.item_code || "",
            qty: String(detailData.item.qty ?? ""),
            cost_max: String(detailData.item.cost_max ?? 0),
            cost_min: String(detailData.item.cost_min ?? 0),
            cost: String(detailData.item.cost ?? 0),
            uom_id: String(detailData.item.uom_id || ""),
            total_price: String(detailData.item.total_price ?? 0),
          });
        }
      } catch (error) {
        if (!alive) return;
        setStatus(error.message || "Unable to load Item Costing form.");
      } finally {
        if (alive) setLoading(false);
      }
    };

    loadData();
    return () => {
      alive = false;
    };
  }, [id, isEditMode]);

  const pageTitle = useMemo(() => (isEditMode ? "Edit Item Costing" : "Add Item Costing"), [isEditMode]);

  const descriptionOptions = useMemo(() => {
    if (!form.item_category_id) return [];
    const seen = new Set();
    return (meta.lab_items || [])
      .filter((row) => String(row.item_category_id) === String(form.item_category_id))
      .filter((row) => {
        const key = String(row.item_name || "").trim().toLowerCase();
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((row) => row.item_name);
  }, [meta.lab_items, form.item_category_id]);

  const itemCodeOptions = useMemo(() => {
    if (!form.item_category_id || !form.item_description) return [];
    return (meta.lab_items || [])
      .filter((row) => String(row.item_category_id) === String(form.item_category_id))
      .filter((row) => String(row.item_name || "") === String(form.item_description || ""))
      .map((row) => row.item_code);
  }, [meta.lab_items, form.item_category_id, form.item_description]);

  const refreshCostPreview = async (itemCode, qtyValue) => {
    if (!itemCode) {
      setForm((prev) => ({ ...prev, cost_max: "0", cost_min: "0", cost: "0", total_price: "0" }));
      setIsManualCost(false);
      return;
    }
    try {
      const data = await getItemCostingCostPreview(itemCode, qtyValue || 0);
      // Only update cost if it hasn't been manually changed by the user
      if (!isManualCost) {
        setForm((prev) => ({
          ...prev,
          cost_max: String(data.cost_max ?? 0),
          cost_min: String(data.cost_min ?? 0),
          cost: String(data.cost ?? 0),
          total_price: String(data.total_price ?? 0),
        }));
      } else {
        // If manual cost exists, only update cost_max and cost_min, recalculate total_price
        const manualCost = parseFloat(form.cost) || 0;
        const newTotalPrice = manualCost * (parseFloat(qtyValue) || 0);
        setForm((prev) => ({
          ...prev,
          cost_max: String(data.cost_max ?? 0),
          cost_min: String(data.cost_min ?? 0),
          total_price: String(newTotalPrice),
        }));
      }
    } catch (error) {
      setStatus(error.message || "Unable to calculate costs.");
      setForm((prev) => ({ ...prev, cost_max: "0", cost_min: "0", cost: "0", total_price: "0" }));
    }
  };

  const handleChange = (event) => {
    const { name, value } = event.target;

    if (name === "item_category_id") {
      setForm((prev) => ({
        ...prev,
        item_category_id: value,
        item_description: "",
        item_code: "",
        cost_max: "0",
        cost_min: "0",
        cost: "0",
        total_price: "0",
      }));
      setIsManualCost(false);
      return;
    }

    if (name === "item_description") {
      setForm((prev) => ({
        ...prev,
        item_description: value,
        item_code: "",
        cost_max: "0",
        cost_min: "0",
        cost: "0",
        total_price: "0",
      }));
      setIsManualCost(false);
      return;
    }

    if (name === "item_code") {
      setForm((prev) => ({ ...prev, item_code: value }));
      setIsManualCost(false);
      refreshCostPreview(value, form.qty);
      return;
    }

    if (name === "qty") {
      const newQty = value;
      const costValue = parseFloat(form.cost) || 0;
      const newTotalPrice = costValue * (parseFloat(value) || 0);
      setForm((prev) => ({
        ...prev,
        qty: newQty,
        total_price: String(newTotalPrice),
      }));
      refreshCostPreview(form.item_code, value);
      return;
    }

    if (name === "cost") {
      const newCost = parseFloat(value) || 0;
      const qtyValue = parseFloat(form.qty) || 0;
      const newTotalPrice = newCost * qtyValue;
      setForm((prev) => ({
        ...prev,
        cost: value,
        total_price: String(newTotalPrice),
      }));
      setIsManualCost(true);
      return;
    }

    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setStatus("");
    try {
      const payload = {
        project_ref_id: form.project_ref_id,
        item_category_id: form.item_category_id,
        item_description: form.item_description,
        item_code: form.item_code,
        qty: form.qty,
        uom_id: form.uom_id || null,
        ic_cost: parseFloat(form.cost) || 0,
        ic_total_price: parseFloat(form.total_price) || 0,
      };

      if (isEditMode) {
        await updateItemCosting(id, payload);
      } else {
        await createItemCosting(payload);
      }

      navigate("/item-costing");
    } catch (error) {
      setStatus(error.message || "Unable to save Item Costing record.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="module-page crud-page">
      <div className="crud-page__header">
        <h1 className="module-page__title">{pageTitle}</h1>
      </div>

      {status ? <p className="users-status users-status--error">{status}</p> : null}
      {loading ? <p className="users-status">Loading...</p> : null}

      {!loading ? (
        <form className="modal-form" onSubmit={handleSubmit} style={{ maxWidth: "100%" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "1rem" }}>
          <div className="modal-form__row">
            <label className="modal-form__label" htmlFor="project_ref_id">Project Ref *</label>
            <select
              id="project_ref_id"
              name="project_ref_id"
              className="auth-input"
              value={form.project_ref_id}
              onChange={handleChange}
              required
            >
              <option value="">Select Project Ref</option>
              {meta.project_refs.map((option) => (
                <option key={option.id} value={option.id}>{option.name}</option>
              ))}
            </select>
          </div>

          <div className="modal-form__row">
            <label className="modal-form__label" htmlFor="item_category_id">Item Category *</label>
            <select
              id="item_category_id"
              name="item_category_id"
              className="auth-input"
              value={form.item_category_id}
              onChange={handleChange}
              required
            >
              <option value="">Select Item Category</option>
              {meta.item_categories.map((option) => (
                <option key={option.id} value={option.id}>{option.name}</option>
              ))}
            </select>
          </div>

          <div className="modal-form__row">
            <label className="modal-form__label" htmlFor="item_description">Item Description *</label>
            <select
              id="item_description"
              name="item_description"
              className="auth-input"
              value={form.item_description}
              onChange={handleChange}
              disabled={!form.item_category_id}
              required
            >
              <option value="">Select Item Description</option>
              {descriptionOptions.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>

          <div className="modal-form__row">
            <label className="modal-form__label" htmlFor="item_code">Item Code *</label>
            <select
              id="item_code"
              name="item_code"
              className="auth-input"
              value={form.item_code}
              onChange={handleChange}
              disabled={!form.item_description}
              required
            >
              <option value="">Select Item Code</option>
              {itemCodeOptions.map((code) => (
                <option key={code} value={code}>{code}</option>
              ))}
            </select>
          </div>

          <div className="modal-form__row">
            <label className="modal-form__label" htmlFor="qty">Qty *</label>
            <input
              id="qty"
              name="qty"
              type="number"
              min="0"
              className="auth-input"
              value={form.qty}
              onChange={handleChange}
              required
            />
          </div>

          <div className="modal-form__row">
            <label className="modal-form__label" htmlFor="uom_id">UOM</label>
            <select
              id="uom_id"
              name="uom_id"
              className="auth-input"
              value={form.uom_id}
              onChange={handleChange}
            >
              <option value="">Select UOM</option>
              {meta.uoms.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
          </div>

          <div className="modal-form__row">
            <label className="modal-form__label" htmlFor="cost_max">Cost Max</label>
            <input
              id="cost_max"
              name="cost_max"
              type="number"
              className="auth-input auth-input--readonly"
              value={form.cost_max}
              disabled
              readOnly
            />
          </div>

          <div className="modal-form__row">
            <label className="modal-form__label" htmlFor="cost_min">Cost Min</label>
            <input
              id="cost_min"
              name="cost_min"
              type="number"
              className="auth-input auth-input--readonly"
              value={form.cost_min}
              disabled
              readOnly
            />
          </div>

          <div className="modal-form__row">
            <label className="modal-form__label" htmlFor="cost">User Cost *</label>
            <input
              id="cost"
              name="cost"
              type="number"
              className="auth-input"
              value={form.cost}
              onChange={handleChange}
              required
            />
          </div>

          <div className="modal-form__row">
            <label className="modal-form__label" htmlFor="total_price">Total Price</label>
            <input
              id="total_price"
              name="total_price"
              type="number"
              className="auth-input auth-input--readonly"
              value={form.total_price}
              disabled
              readOnly
            />
          </div>

          <div className="modal-form__actions" style={{ gridColumn: "1 / -1" }}>
            <button
              type="button"
              className="modal-btn modal-btn--cancel"
              onClick={() => navigate("/item-costing")}
            >
              Cancel
            </button>
            <button type="submit" className="modal-btn modal-btn--save" disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
          </div>
        </form>
      ) : null}
    </section>
  );
}

export default ItemCostingFormPage;

