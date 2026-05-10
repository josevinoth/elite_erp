import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { createLceEstimate, getLceEstimateById, updateLceEstimateById } from "../services/crudApi";
import { getSessionUser } from "../services/sessionUser";

const EDITABLE_FIELDS = [
  ["ex_works_material_cost", "EX WORKS MATERIAL COST"],
  ["packing_charges", "PACKING CHARGES"],
  ["documentation", "DOCUMENTATION"],
  ["other_charges_1", "OTHER CHARGES 1"],
  ["other_charges_2", "OTHER CHARGES 2"],
  ["other_charges_3", "OTHER CHARGES 3"],
  ["other_charges_4", "OTHER CHARGES 4"],
  ["advance_payment_value", "ADVANCE PAYMENT VALUE"],
  ["bank_exchange_rate", "BANK EXCHANGE RATE"],
  ["bank_muscat_charge_advance_payment", "BANK MUSCAT CHARGE - ADVANCE PAYMENT"],
  ["bank_muscat_charge_balance_payment", "BANK MUSCAT CHARGE - BALANCE PAYMENT"],
  ["freight_charge", "FREIGHT CHARGE"],
  ["customs_duty_omr", "CUSTOMS DUTY (OMR)"],
  ["oman_customs_boe_charge_omr", "OMAN CUSTOMS BOE CHARGE (OMR)"],
  ["rop_customs_inspection_charge", "ROP CUSTOMS INSPECTION CHARGE"],
  ["unloading_charge_muscat_stores_1", "UNLOADING CHARGE @ MUSCAT STORES 1"],
  ["unloading_charge_muscat_stores_2", "UNLOADING CHARGE @ MUSCAT STORES 2"],
  ["loading_charge_muscat_stores_delivery", "LOADING CHARGE @ MUSCAT STORES AT THE TIME OF CUSTOMER DELIVERY"],
];

const FORMULA_FIELDS = [
  ["total_supplier_price", "TOTAL SUPPLIER PRICE"],
  ["advance_payment_value_omr", "ADVANCE PAYMENT VALUE (OMR)"],
  ["balance_payment_value", "BALANCE PAYMENT VALUE"],
  ["balance_payment_value_omr", "BALANCE PAYMENT VALUE (OMR)"],
  ["total_supplier_price_omr", "TOTAL SUPPLIER PRICE (OMR)"],
  ["total", "TOTAL"],
];

const DEFAULT_FORM = Object.fromEntries([...EDITABLE_FIELDS, ...FORMULA_FIELDS].map(([k]) => [k, "0"]));

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toFixed = (value, digits = 3) => String(Math.round((value + Number.EPSILON) * 10 ** digits) / 10 ** digits);

function applyFormulas(values) {
  const next = { ...values };
  const totalSupplierPrice =
    toNumber(next.ex_works_material_cost)
    + toNumber(next.packing_charges)
    + toNumber(next.documentation)
    + toNumber(next.other_charges_1)
    + toNumber(next.other_charges_2)
    + toNumber(next.other_charges_3)
    + toNumber(next.other_charges_4);

  const advancePayment = toNumber(next.advance_payment_value);
  const bankRate = toNumber(next.bank_exchange_rate);
  const advanceOmr = advancePayment * bankRate;
  const balancePayment = totalSupplierPrice - advancePayment;
  const balanceOmr = balancePayment * bankRate;

  next.total_supplier_price = toFixed(totalSupplierPrice);
  next.advance_payment_value_omr = toFixed(advanceOmr);
  next.balance_payment_value = toFixed(balancePayment);
  next.balance_payment_value_omr = toFixed(balanceOmr);
  next.total_supplier_price_omr = toFixed(advanceOmr + balanceOmr);
  next.total = toFixed(
    toNumber(next.bank_muscat_charge_advance_payment)
      + toNumber(next.bank_muscat_charge_balance_payment)
      + toNumber(next.freight_charge)
      + toNumber(next.customs_duty_omr)
      + toNumber(next.oman_customs_boe_charge_omr)
      + toNumber(next.rop_customs_inspection_charge)
      + toNumber(next.unloading_charge_muscat_stores_1)
      + toNumber(next.unloading_charge_muscat_stores_2)
      + toNumber(next.loading_charge_muscat_stores_delivery)
  );
  return next;
}

function CostingPage() {
  const { lceId } = useParams();
  const navigate = useNavigate();
  const currentUser = useMemo(() => getSessionUser(), []);
  const isAddMode = !lceId;

  const [form, setForm] = useState(DEFAULT_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setStatus("");

    const resolveAndLoad = async () => {
      const recordId = lceId;
      if (!recordId) {
        setForm(applyFormulas({ ...DEFAULT_FORM }));
        setLoading(false);
        return;
      }

      const data = await getLceEstimateById(recordId);
      if (!alive) return;
      const estimate = data.lce_estimate || {};

      const merged = { ...DEFAULT_FORM };
      [...EDITABLE_FIELDS, ...FORMULA_FIELDS].forEach(([key]) => {
        merged[key] = String(estimate[key] ?? merged[key]);
      });
      setForm(applyFormulas(merged));
      setLoading(false);
    };

    resolveAndLoad()
      .catch((err) => {
        if (!alive) return;
        setStatus(err.message || "Failed to load LCE details.");
        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [lceId]);

  const handleChange = (key, value) => {
    setForm((prev) => applyFormulas({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    setStatus("");
    try {
      const payload = {
        ...Object.fromEntries(EDITABLE_FIELDS.map(([key]) => [key, form[key]])),
        created_by: currentUser?.username || "",
      };
      const data = isAddMode
        ? await createLceEstimate(payload)
        : await updateLceEstimateById(lceId, payload);
      const estimate = data.lce_estimate || {};
      setForm((prev) => applyFormulas({ ...prev, ...estimate }));
      setStatus("LCE saved successfully.");

      if (isAddMode && estimate.id) {
        navigate(`/projects/costing/record/${estimate.id}`, { replace: true });
      }
    } catch (err) {
      setStatus(err.message || "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="module-page">
      <div className="crud-page__header" style={{ marginBottom: "0.8rem" }}>
        <div>
          <h1 className="module-page__title" style={{ margin: 0 }}>{isAddMode ? "LCE Add" : "LCE Form"}</h1>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button type="button" className="crud-add-btn" onClick={() => navigate("/projects/costing")}>Back to LCE List</button>
          <button type="button" className="crud-add-btn" onClick={handleSave} disabled={saving || loading}>
            {saving ? "Saving..." : "Save LCE Details"}
          </button>
        </div>
      </div>

      {status ? <p className="users-status">{status}</p> : null}
      {loading ? <p className="users-status">Loading...</p> : null}


      {!loading ? (
        <div className="users-table-wrap" style={{ maxHeight: "68vh", overflowY: "auto" }}>
          <table className="users-table" style={{ minWidth: 860 }}>
            <thead>
              <tr>
                <th style={{ minWidth: 520 }}>Field</th>
                <th style={{ minWidth: 220, textAlign: "right" }}>Value</th>
              </tr>
            </thead>
            <tbody>
              {EDITABLE_FIELDS.map(([key, label]) => (
                <tr key={key}>
                  <td>{label}</td>
                  <td>
                    <input
                      type="number"
                      className="auth-input"
                      style={{ textAlign: "right" }}
                      step="any"
                      value={form[key]}
                      onChange={(e) => handleChange(key, e.target.value)}
                    />
                  </td>
                </tr>
              ))}
              {FORMULA_FIELDS.map(([key, label]) => (
                <tr key={key} style={{ background: "rgba(22,178,165,0.09)" }}>
                  <td><strong>{label}</strong></td>
                  <td>
                    <input
                      type="number"
                      className="auth-input"
                      style={{ textAlign: "right", fontWeight: 700 }}
                      value={form[key]}
                      readOnly
                    />
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

export default CostingPage;

