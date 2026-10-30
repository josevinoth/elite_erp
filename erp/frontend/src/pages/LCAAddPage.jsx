import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  BsChevronDown,
  BsChevronRight,
  BsPencilSquare,
  BsPlusCircleFill,
} from "react-icons/bs";
import {
  createLcaChargeTypeOption,
  createLcaActuals,
  getLcaActualsById,
  getLcaPurchaseItems,
  listLcaMeta,
  listStockPurchases,
  updateLcaActualsById,
} from "../services/crudApi";
import { getSessionUser } from "../services/sessionUser";
import { Card, CardHeader, CardBody } from "../components/Card";
import "../styles/LCAAddPage.css";

const OTHER_CHARGE_FIELDS = [
  ["other_charges_1", "Other Charges 1", "other_charges_1_type"],
  ["other_charges_2", "Other Charges 2", "other_charges_2_type"],
  ["other_charges_3", "Other Charges 3", "other_charges_3_type"],
  ["other_charges_4", "Other Charges 4", "other_charges_4_type"],
];

const EDITABLE_FIELDS = [
  ["ex_works_material_cost", "Ex Works Material Cost"],
  ["packing_charges", "Packing Charges"],
  ["documentation", "Documentation Charges"],
  ...OTHER_CHARGE_FIELDS.map(([valueKey, label]) => [
    valueKey,
    label
      .split(" ")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" "),
  ]),
  ["advance_payment_value", "Advance Payment Value"],
  ["bank_exchange_rate", "Bank Exchange Rate - Advance Payment"],
  ["bank_exchange_rate_balance", "Bank Exchange Rate - Balance Payment"],
  ["bank_muscat_charge_advance_payment", "Bank Muscat Charge - Advance Payment"],
  ["bank_muscat_charge_balance_payment", "Bank Muscat Charge - Balance Payment"],
  ["freight_charge", "Freight Charge"],
  ["customs_duty_omr", "Customs Duty (OMR)"],
  ["oman_customs_boe_charge_omr", "Oman Customs BOE Charge (OMR)"],
  ["rop_customs_inspection_charge", "ROP Customs Inspection Charge"],
  ["unloading_charge_muscat_stores_1", "Unloading Charge @ Muscat Stores 1"],
  ["unloading_charge_muscat_stores_2", "Unloading Charge @ Muscat Stores 2"],
  ["loading_charge_muscat_stores_delivery", "Loading Charge @ Muscat Stores At The Time Of Customer Delivery"],
];

const FORMULA_FIELDS = [
  ["total_supplier_price", "Total Supplier Price"],
  ["advance_payment_value_omr", "Advance Payment Value (OMR)"],
  ["balance_payment_value", "Balance Payment Value"],
  ["balance_payment_value_omr", "Balance Payment Value (OMR)"],
  ["total_supplier_price_omr", "Total Supplier Price (OMR)"],
  ["total", "Total (OMR)"],
  ["cost_factor", "Cost Factor"],
];

const EXTRA_FIELDS = [
  "other_charges_1_type",
  "other_charges_2_type",
  "other_charges_3_type",
  "other_charges_4_type",
  "foreign_currency_id",
];

const DEFAULT_FORM = Object.fromEntries(
  [...EDITABLE_FIELDS, ...FORMULA_FIELDS].map(([k]) => [k, "0"])
);
EXTRA_FIELDS.forEach((key) => {
  DEFAULT_FORM[key] = "";
});

const FOREIGN_CURRENCY_KEYS = new Set([
  "ex_works_material_cost",
  "packing_charges",
  "documentation",
  "other_charges_1",
  "other_charges_2",
  "other_charges_3",
  "other_charges_4",
  "advance_payment_value",
  "balance_payment_value",
  "total_supplier_price",
]);

const toNumber = (value) => {
  const p = Number(value);
  return Number.isFinite(p) ? p : 0;
};

const toFixed = (value, digits = 2) =>
  String(Math.round((value + Number.EPSILON) * 10 ** digits) / 10 ** digits);

const calculateLinkedItemsTotalPrice = (items = []) =>
  items.reduce((sum, item) => sum + toNumber(item.total_price), 0);

const calculatePriceAfterTaxPerUnit = (item) => {
  if (item?.price_after_tax_per_unit && !isNaN(Number(item.price_after_tax_per_unit))) {
    return toFixed(Number(item.price_after_tax_per_unit), 2);
  }
  const qty = toNumber(item?.quantity);
  const totalAfterTax = toNumber(item?.total_after_tax);
  if (totalAfterTax > 0 && qty > 0) {
    return toFixed(totalAfterTax / qty, 2);
  }
  const unitPrice = toNumber(item?.unit_price);
  const tax = toNumber(item?.tax);
  if (unitPrice > 0) {
    return toFixed(unitPrice * (1 + tax / 100), 2);
  }
  const totalPrice = toNumber(item?.total_price);
  if (totalPrice > 0 && qty > 0) {
    return toFixed((totalPrice / qty) * (1 + tax / 100), 2);
  }
  return "0.00";
};

const calculateFormulas = (nextForm) => {
  const exWorks = toNumber(nextForm.ex_works_material_cost);
  const packing = toNumber(nextForm.packing_charges);
  const doc = toNumber(nextForm.documentation);
  const other1 = toNumber(nextForm.other_charges_1);
  const other2 = toNumber(nextForm.other_charges_2);
  const other3 = toNumber(nextForm.other_charges_3);
  const other4 = toNumber(nextForm.other_charges_4);

  const totalSupplierPrice =
    exWorks + packing + doc + other1 + other2 + other3 + other4;

  const advancePaymentValue = toNumber(nextForm.advance_payment_value);
  const bankExchangeRate = toNumber(nextForm.bank_exchange_rate);
  const advancePaymentValueOmr = advancePaymentValue * bankExchangeRate;

  const balancePaymentValue = totalSupplierPrice - advancePaymentValue;
  const bankExchangeRateBalance = toNumber(nextForm.bank_exchange_rate_balance);
  const balancePaymentValueOmr = balancePaymentValue * bankExchangeRateBalance;

  const totalSupplierPriceOmr = advancePaymentValueOmr + balancePaymentValueOmr;

  const bankMuscatAdvance = toNumber(nextForm.bank_muscat_charge_advance_payment);
  const bankMuscatBalance = toNumber(nextForm.bank_muscat_charge_balance_payment);
  const freight = toNumber(nextForm.freight_charge);
  const customs = toNumber(nextForm.customs_duty_omr);
  const boe = toNumber(nextForm.oman_customs_boe_charge_omr);
  const rop = toNumber(nextForm.rop_customs_inspection_charge);
  const unload1 = toNumber(nextForm.unloading_charge_muscat_stores_1);
  const unload2 = toNumber(nextForm.unloading_charge_muscat_stores_2);
  const loadingDelivery = toNumber(nextForm.loading_charge_muscat_stores_delivery);

  const total =
    totalSupplierPriceOmr +
    bankMuscatAdvance +
    bankMuscatBalance +
    freight +
    customs +
    boe +
    rop +
    unload1 +
    unload2 +
    loadingDelivery;

  const costFactor = exWorks > 0 ? total / exWorks : 0;

  return {
    ...nextForm,
    total_supplier_price: toFixed(totalSupplierPrice, 3),
    advance_payment_value_omr: toFixed(advancePaymentValueOmr, 3),
    balance_payment_value: toFixed(balancePaymentValue, 3),
    balance_payment_value_omr: toFixed(balancePaymentValueOmr, 3),
    total_supplier_price_omr: toFixed(totalSupplierPriceOmr, 3),
    total: toFixed(total, 3),
    cost_factor: toFixed(costFactor, 4),
  };
};

function PurchaseItemModal({
  items,
  initialSelected,
  currentLcaId,
  selectedForeignCurrencyCode,
  onConfirm,
  onClose,
}) {
  const [selectedIds, setSelectedIds] = useState(() => new Set(initialSelected));

  const toggleItem = (itemId) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    const selectable = items.filter(
      (item) =>
        !item.lca_actuals_id ||
        String(item.lca_actuals_id) === String(currentLcaId)
    );
    setSelectedIds(new Set(selectable.map((i) => i.id)));
  };

  const handleClearAll = () => {
    setSelectedIds(new Set());
  };

  return (
    <div
      className="modal-backdrop-custom"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1050,
      }}
    >
      <div
        className="modal-dialog-custom"
        style={{
          background: "#fff",
          borderRadius: "8px",
          width: "90%",
          maxWidth: "1000px",
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
        }}
      >
        <div
          style={{
            padding: "1rem 1.25rem",
            borderBottom: "1px solid #e2e8f0",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h5 style={{ margin: 0, fontWeight: 600 }}>Select Purchase Items for LCA</h5>
          <button
            type="button"
            className="btn-close"
            aria-label="Close"
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              fontSize: "1.25rem",
              cursor: "pointer",
            }}
          >
            &times;
          </button>
        </div>

        <div style={{ padding: "0.75rem 1.25rem", borderBottom: "1px solid #e2e8f0", display: "flex", gap: "0.5rem" }}>
          <button type="button" className="crud-add-btn" onClick={handleSelectAll}>
            Select All Available
          </button>
          <button type="button" className="crud-add-btn crud-add-btn--neutral" onClick={handleClearAll}>
            Clear Selection
          </button>
          <span style={{ marginLeft: "auto", alignSelf: "center", fontSize: "0.85rem", color: "#64748b" }}>
            {selectedIds.size} of {items.length} items selected
          </span>
        </div>

        <div style={{ padding: "1rem 1.25rem", overflowY: "auto", flex: 1 }}>
          <table className="users-table">
            <thead>
              <tr>
                <th style={{ width: "40px" }}></th>
                <th>GRN No.</th>
                <th>Purchase No.</th>
                <th>Invoice No.</th>
                <th>Item Category</th>
                <th>Item Name</th>
                <th>Item Code</th>
                <th>Total Price ({selectedForeignCurrencyCode})</th>
                <th>Total Price After Tax / Unit ({selectedForeignCurrencyCode})</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const isLinkedOther =
                  item.lca_actuals_id &&
                  String(item.lca_actuals_id) !== String(currentLcaId);
                const isChecked = selectedIds.has(item.id);
                return (
                  <tr
                    key={item.id}
                    style={{
                      backgroundColor: isLinkedOther ? "#f1f5f9" : "transparent",
                      opacity: isLinkedOther ? 0.6 : 1,
                    }}
                  >
                    <td>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        disabled={Boolean(isLinkedOther)}
                        onChange={() => toggleItem(item.id)}
                      />
                    </td>
                    <td>{item.grn_number}</td>
                    <td>{item.purchase_number || "-"}</td>
                    <td>{item.invoice_number || "-"}</td>
                    <td>{item.item_category}</td>
                    <td>{item.item_name}</td>
                    <td>{item.item_code}</td>
                    <td>{item.total_price}</td>
                    <td>{calculatePriceAfterTaxPerUnit(item)}</td>
                    <td>
                      {isLinkedOther ? (
                        <span className="vendor-card__badge" style={{ fontSize: "0.7rem", backgroundColor: "#dc2626" }}>
                          Linked to LCA #{item.lca_actuals_id}
                        </span>
                      ) : (
                        <span className="vendor-card__badge" style={{ fontSize: "0.7rem" }}>
                          Available
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div
          style={{
            padding: "0.75rem 1.25rem",
            borderTop: "1px solid #e2e8f0",
            display: "flex",
            justifyContent: "flex-end",
            gap: "0.5rem",
          }}
        >
          <button type="button" className="modal-btn modal-btn--cancel" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="crud-add-btn"
            onClick={() => {
              onConfirm(Array.from(selectedIds));
              onClose();
            }}
          >
            Confirm Selection ({selectedIds.size})
          </button>
        </div>
      </div>
    </div>
  );
}

function LCAAddPage() {
  const { lcaId } = useParams();
  const navigate = useNavigate();

  const [form, setForm] = useState(DEFAULT_FORM);
  const [currencies, setCurrencies] = useState([]);
  const [chargeTypeOptions, setChargeTypeOptions] = useState([]);
  const [settlementRows, setSettlementRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");

  const [stockPurchaseOptions, setStockPurchaseOptions] = useState([]);
  const [selectedPurchaseIds, setSelectedPurchaseIds] = useState([]);
  const [linkedItems, setLinkedItems] = useState([]);
  const [selectedItemIds, setSelectedItemIds] = useState([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalItems, setModalItems] = useState([]);

  // Accordion section states (default closed)
  const [paymentHistoryOpen, setPaymentHistoryOpen] = useState(false);
  const [linkedItemsOpen, setLinkedItemsOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);

    const initMeta = async () => {
      try {
        const meta = await listLcaMeta();
        if (!alive) return;
        setCurrencies(Array.isArray(meta?.currencies) ? meta.currencies : []);
        setChargeTypeOptions(Array.isArray(meta?.charge_types) ? meta.charge_types : []);
        if (Array.isArray(meta?.stock_purchases) && meta.stock_purchases.length) {
          const options = meta.stock_purchases.map((sp) => ({
            value: sp.id,
            label: sp.label || `${sp.purchase_number || `SPV${String(sp.id).padStart(4, "0")}`}${sp.invoice_number ? ` | Inv: ${sp.invoice_number}` : ""}`,
          }));
          setStockPurchaseOptions(options);
        }
      } catch {
        if (!alive) return;
        setCurrencies([]);
        setChargeTypeOptions([]);
      }
    };

    const initPurchases = async () => {
      try {
        const spData = await listStockPurchases();
        if (!alive) return;
        const records = Array.isArray(spData?.stock_purchases)
          ? spData.stock_purchases
          : Array.isArray(spData?.vendor_details)
          ? spData.vendor_details
          : [];
        if (records.length) {
          const options = records.map((v) => {
            const inv = v.invoice_number ? ` | Inv: ${v.invoice_number}` : "";
            const spId = v.purchase_number || `SPV${String(v.id).padStart(4, "0")}`;
            return { value: v.id, label: `${spId}${inv}` };
          });
          setStockPurchaseOptions(options);
        }
      } catch {
        if (!alive) return;
      }
    };

    const initRecord = async () => {
      if (!lcaId) return;
      try {
        const data = await getLcaActualsById(lcaId);
        if (!alive) return;
        const actuals = data?.lca_actuals || {};
        const nextForm = { ...DEFAULT_FORM };
        [...EDITABLE_FIELDS, ...FORMULA_FIELDS].forEach(([k]) => {
          if (actuals[k] !== undefined && actuals[k] !== null) {
            nextForm[k] = String(actuals[k]);
          }
        });
        EXTRA_FIELDS.forEach((k) => {
          if (actuals[k] !== undefined && actuals[k] !== null) {
            nextForm[k] = String(actuals[k]);
          }
        });
        setForm(calculateFormulas(nextForm));

        const rows = Array.isArray(actuals.balance_settlements)
          ? actuals.balance_settlements.map((r, idx) => ({
              ...r,
              rowId: r.id || `settlement_${idx}_${Date.now()}`,
            }))
          : [];
        setSettlementRows(rows);

        const items = Array.isArray(actuals.purchase_items) ? actuals.purchase_items : [];
        setLinkedItems(items);
        setSelectedItemIds(items.map((i) => i.id));
      } catch (err) {
        if (!alive) return;
        setStatus(err.message || "Failed to load LCA record.");
      }
    };

    Promise.all([initMeta(), initPurchases(), initRecord()]).finally(() => {
      if (alive) setLoading(false);
    });

    return () => {
      alive = false;
    };
  }, [lcaId]);

  const currencyOptions = useMemo(
    () =>
      currencies.map((c) => ({
        value: c.id,
        label: `${c.country_name} - ${c.currency_code}`,
        currency_code: c.currency_code,
      })),
    [currencies]
  );

  const selectedForeignCurrencyCode = useMemo(() => {
    const selected = currencyOptions.find(
      (c) => String(c.value) === String(form.foreign_currency_id)
    );
    return selected ? selected.currency_code : "FC";
  }, [currencyOptions, form.foreign_currency_id]);

  const withForeignCurrencyLabel = (fieldKey, baseLabel) =>
    FOREIGN_CURRENCY_KEYS.has(fieldKey)
      ? `${baseLabel} (${selectedForeignCurrencyCode})`
      : baseLabel;

  const handleChange = (key, value) => {
    setForm((prev) => calculateFormulas({ ...prev, [key]: value }));
  };

  const handleAddChargeType = async (fieldKey) => {
    const name = window.prompt("Enter new charge type:");
    if (!name || !name.trim()) return;
    try {
      const res = await createLcaChargeTypeOption(name.trim());
      const newOption = res?.charge_type;
      if (newOption) {
        setChargeTypeOptions((prev) =>
          [...prev, newOption].sort((a, b) => a.name.localeCompare(b.name))
        );
        handleChange(fieldKey, newOption.name);
      }
    } catch (err) {
      alert(err.message || "Failed to create charge type.");
    }
  };

  const addSettlementRow = () => {
    setSettlementRows((prev) => [
      ...prev,
      {
        rowId: `new_${Date.now()}_${Math.random()}`,
        settlement_date: new Date().toISOString().slice(0, 10),
        foreign_currency_id: form.foreign_currency_id || "",
        payment_amount: "0",
        factor: "0",
        value: "0",
      },
    ]);
  };

  const removeSettlementRow = (rowId) => {
    setSettlementRows((prev) => prev.filter((r) => r.rowId !== rowId));
  };

  const handleSettlementChange = (rowId, key, value) => {
    setSettlementRows((prev) =>
      prev.map((r) => (r.rowId === rowId ? { ...r, [key]: value } : r))
    );
  };

  const settlementRowsWithValue = useMemo(
    () =>
      settlementRows.length
        ? settlementRows
        : [
            {
              rowId: "initial_row",
              settlement_date: new Date().toISOString().slice(0, 10),
              foreign_currency_id: form.foreign_currency_id || "",
              payment_amount: "0",
              factor: "0",
              value: "0",
            },
          ],
    [settlementRows, form.foreign_currency_id]
  );

  const togglePurchaseId = (val) => {
    setSelectedPurchaseIds((prev) =>
      prev.includes(val) ? prev.filter((v) => v !== val) : [...prev, val]
    );
  };

  const selectedPurchaseLabel = useMemo(() => {
    if (!selectedPurchaseIds.length) return "Select purchases...";
    if (selectedPurchaseIds.length === 1) {
      const opt = stockPurchaseOptions.find((o) => o.value === selectedPurchaseIds[0]);
      return opt ? opt.label : `Selected: ${selectedPurchaseIds[0]}`;
    }
    return `${selectedPurchaseIds.length} purchases selected`;
  }, [selectedPurchaseIds, stockPurchaseOptions]);

  const handleShowItems = async () => {
    if (!selectedPurchaseIds.length) {
      alert("Please select at least one purchase first.");
      return;
    }
    setModalLoading(true);
    try {
      const allResults = await Promise.all(
        selectedPurchaseIds.map((id) => getLcaPurchaseItems(id))
      );
      const combined = [];
      allResults.forEach((res) => {
        if (Array.isArray(res?.items)) {
          combined.push(...res.items);
        }
      });
      setModalItems(combined);
      setModalOpen(true);
    } catch (err) {
      alert(err.message || "Failed to load purchase items.");
    } finally {
      setModalLoading(false);
    }
  };

  const handleModalConfirm = (newSelectedIds) => {
    setSelectedItemIds(newSelectedIds);
    const chosenItems = modalItems.filter((i) => newSelectedIds.includes(i.id));
    setLinkedItems(chosenItems);

    const calculatedExWorks = calculateLinkedItemsTotalPrice(chosenItems);
    setForm((prev) => {
      const next = {
        ...prev,
        ex_works_material_cost: toFixed(calculatedExWorks, 3),
      };
      return calculateFormulas(next);
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setStatus("");

    const payload = {
      ...form,
      item_ids: selectedItemIds,
      balance_settlements: settlementRowsWithValue.map((r) => ({
        settlement_date: r.settlement_date,
        foreign_currency_id: r.foreign_currency_id || form.foreign_currency_id,
        payment_amount: r.payment_amount,
        factor: r.factor,
      })),
      created_by: getSessionUser() || "System",
    };

    try {
      const res = lcaId
        ? await updateLcaActualsById(lcaId, payload)
        : await createLcaActuals(payload);

      const savedId = res?.lca_actuals?.id || lcaId;
      setStatus("Saved successfully!");
      if (!lcaId && savedId) {
        navigate(`/projects/lca/record/${savedId}`, { replace: true });
      }
    } catch (err) {
      setStatus(err.message || "Failed to save LCA record.");
    } finally {
      setSaving(false);
    }
  };

  const formatLcaId = (id) => `LCA_${String(id).padStart(3, "0")}`;

  return (
    <section className="lca-page-container">
      {status ? (
        <p
          className={`users-status ${
            status.includes("success")
              ? "users-status--success"
              : "users-status--error"
          }`}
          style={{ width: "70%", minWidth: "720px", maxWidth: "960px", marginBottom: "1rem" }}
        >
          {status}
        </p>
      ) : null}

      {loading ? (
        <p className="users-status">Loading LCA details...</p>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSave();
          }}
          style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}
        >
          {/* ========= CARD 1: Add/Edit LCA (Main Form) ========= */}
          <Card className="lca-card mb-3">
            <CardHeader>
              <h2>Add/Edit LCA</h2>
              {lcaId ? (
                <span className="vendor-card__badge">
                  <BsPencilSquare aria-hidden="true" /> Editing #{lcaId}
                </span>
              ) : null}
            </CardHeader>
            <CardBody>
              <div className="lca-fields-grid">

                {/* Header: LCA Number + Foreign Currency */}
                <div className="lca-field-pair">
                  <label className="lca-label">LCA Number</label>
                  <div className="lca-input">
                    <input
                      type="text"
                      className="form-control"
                      value={lcaId ? formatLcaId(lcaId) : "Auto-generated"}
                      disabled
                      readOnly
                    />
                  </div>
                </div>

                <div className="lca-field-pair">
                  <label className="lca-label">Foreign Currency</label>
                  <div className="lca-input">
                    <select
                      className="form-control"
                      value={form["foreign_currency_id"] || ""}
                      onChange={(e) => handleChange("foreign_currency_id", e.target.value)}
                    >
                      <option value="">Select currency</option>
                      {currencyOptions.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* 1. EX WORKS MATERIAL COST */}
                <div className="lca-field-pair">
                  <label className="lca-label">
                    {withForeignCurrencyLabel("ex_works_material_cost", "EX WORKS MATERIAL COST")}
                  </label>
                  <div className="lca-input">
                    <input
                      type="number"
                      step="any"
                      className="form-control"
                      value={form["ex_works_material_cost"]}
                      disabled={linkedItems.length > 0}
                      readOnly={linkedItems.length > 0}
                      onChange={(e) => handleChange("ex_works_material_cost", e.target.value)}
                    />
                  </div>
                </div>

                {/* 2. PACKING CHARGES */}
                <div className="lca-field-pair">
                  <label className="lca-label">
                    {withForeignCurrencyLabel("packing_charges", "PACKING CHARGES")}
                  </label>
                  <div className="lca-input">
                    <input
                      type="number"
                      step="any"
                      className="form-control"
                      value={form["packing_charges"]}
                      onChange={(e) => handleChange("packing_charges", e.target.value)}
                    />
                  </div>
                </div>

                {/* 3. DOCUMENTATION CHARGES */}
                <div className="lca-field-pair">
                  <label className="lca-label">
                    {withForeignCurrencyLabel("documentation", "DOCUMENTATION CHARGES")}
                  </label>
                  <div className="lca-input">
                    <input
                      type="number"
                      step="any"
                      className="form-control"
                      value={form["documentation"]}
                      onChange={(e) => handleChange("documentation", e.target.value)}
                    />
                  </div>
                </div>

                {/* 4. OTHER CHARGES 1 */}
                <div className="lca-field-pair">
                  <label className="lca-label">
                    {withForeignCurrencyLabel("other_charges_1", "OTHER CHARGES 1")}
                  </label>
                  <div className="lca-input">
                    <div className="lca-charge-control-row">
                      <select
                        className="form-control"
                        value={form["other_charges_1_type"] || ""}
                        onChange={(e) => handleChange("other_charges_1_type", e.target.value)}
                      >
                        <option value="">Select charge type</option>
                        {chargeTypeOptions.map((o) => (
                          <option key={o.id} value={o.name}>
                            {o.name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="crud-add-btn lca-btn-add-type"
                        title="Add charge type"
                        onClick={() => handleAddChargeType("other_charges_1_type")}
                      >
                        +
                      </button>
                      <input
                        type="number"
                        step="any"
                        className="form-control"
                        placeholder="Value"
                        value={form["other_charges_1"]}
                        onChange={(e) => handleChange("other_charges_1", e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {/* 5. OTHER CHARGES 2 */}
                <div className="lca-field-pair">
                  <label className="lca-label">
                    {withForeignCurrencyLabel("other_charges_2", "OTHER CHARGES 2")}
                  </label>
                  <div className="lca-input">
                    <div className="lca-charge-control-row">
                      <select
                        className="form-control"
                        value={form["other_charges_2_type"] || ""}
                        onChange={(e) => handleChange("other_charges_2_type", e.target.value)}
                      >
                        <option value="">Select charge type</option>
                        {chargeTypeOptions.map((o) => (
                          <option key={o.id} value={o.name}>
                            {o.name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="crud-add-btn lca-btn-add-type"
                        title="Add charge type"
                        onClick={() => handleAddChargeType("other_charges_2_type")}
                      >
                        +
                      </button>
                      <input
                        type="number"
                        step="any"
                        className="form-control"
                        placeholder="Value"
                        value={form["other_charges_2"]}
                        onChange={(e) => handleChange("other_charges_2", e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {/* 6. OTHER CHARGES 3 */}
                <div className="lca-field-pair">
                  <label className="lca-label">
                    {withForeignCurrencyLabel("other_charges_3", "OTHER CHARGES 3")}
                  </label>
                  <div className="lca-input">
                    <div className="lca-charge-control-row">
                      <select
                        className="form-control"
                        value={form["other_charges_3_type"] || ""}
                        onChange={(e) => handleChange("other_charges_3_type", e.target.value)}
                      >
                        <option value="">Select charge type</option>
                        {chargeTypeOptions.map((o) => (
                          <option key={o.id} value={o.name}>
                            {o.name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="crud-add-btn lca-btn-add-type"
                        title="Add charge type"
                        onClick={() => handleAddChargeType("other_charges_3_type")}
                      >
                        +
                      </button>
                      <input
                        type="number"
                        step="any"
                        className="form-control"
                        placeholder="Value"
                        value={form["other_charges_3"]}
                        onChange={(e) => handleChange("other_charges_3", e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {/* 7. OTHER CHARGES 4 */}
                <div className="lca-field-pair">
                  <label className="lca-label">
                    {withForeignCurrencyLabel("other_charges_4", "OTHER CHARGES 4")}
                  </label>
                  <div className="lca-input">
                    <div className="lca-charge-control-row">
                      <select
                        className="form-control"
                        value={form["other_charges_4_type"] || ""}
                        onChange={(e) => handleChange("other_charges_4_type", e.target.value)}
                      >
                        <option value="">Select charge type</option>
                        {chargeTypeOptions.map((o) => (
                          <option key={o.id} value={o.name}>
                            {o.name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="crud-add-btn lca-btn-add-type"
                        title="Add charge type"
                        onClick={() => handleAddChargeType("other_charges_4_type")}
                      >
                        +
                      </button>
                      <input
                        type="number"
                        step="any"
                        className="form-control"
                        placeholder="Value"
                        value={form["other_charges_4"]}
                        onChange={(e) => handleChange("other_charges_4", e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {/* 8. ADVANCE PAYMENT VALUE (FOREIGN CURRENCY) */}
                <div className="lca-field-pair">
                  <label className="lca-label">
                    {withForeignCurrencyLabel("advance_payment_value", "ADVANCE PAYMENT VALUE")}
                  </label>
                  <div className="lca-input">
                    <input
                      type="number"
                      step="any"
                      className="form-control"
                      value={form["advance_payment_value"]}
                      onChange={(e) => handleChange("advance_payment_value", e.target.value)}
                    />
                  </div>
                </div>

                {/* 9. BANK EXCHANGE RATE - ADVANCE PAYMENT */}
                <div className="lca-field-pair">
                  <label className="lca-label">BANK EXCHANGE RATE - ADVANCE PAYMENT</label>
                  <div className="lca-input">
                    <input
                      type="number"
                      step="any"
                      className="form-control lca-input--green"
                      value={form["bank_exchange_rate"]}
                      onChange={(e) => handleChange("bank_exchange_rate", e.target.value)}
                    />
                  </div>
                </div>

                {/* 10. ADVANCE PAYMENT VALUE (OMR) */}
                <div className="lca-field-pair lca-field-pair--blue">
                  <label className="lca-label">ADVANCE PAYMENT VALUE (OMR)</label>
                  <div className="lca-input">
                    <input
                      type="number"
                      className="form-control"
                      value={form["advance_payment_value_omr"]}
                      disabled
                      readOnly
                    />
                  </div>
                </div>

                {/* 11. BALANCE PAYMENT VALUE (FOREIGN CURRENCY) */}
                <div className="lca-field-pair">
                  <label className="lca-label">
                    {withForeignCurrencyLabel("balance_payment_value", "BALANCE PAYMENT VALUE")}
                  </label>
                  <div className="lca-input">
                    <input
                      type="number"
                      step="any"
                      className="form-control"
                      value={form["balance_payment_value"]}
                      disabled
                      readOnly
                    />
                  </div>
                </div>

                {/* 12. BANK EXCHANGE RATE - BALANCE PAYMENT */}
                <div className="lca-field-pair">
                  <label className="lca-label">BANK EXCHANGE RATE - BALANCE PAYMENT</label>
                  <div className="lca-input">
                    <input
                      type="number"
                      step="any"
                      className="form-control lca-input--green"
                      value={form["bank_exchange_rate_balance"]}
                      onChange={(e) => handleChange("bank_exchange_rate_balance", e.target.value)}
                    />
                  </div>
                </div>

                {/* 13. BALANCE PAYMENT VALUE (OMR) */}
                <div className="lca-field-pair lca-field-pair--blue">
                  <label className="lca-label">BALANCE PAYMENT VALUE (OMR)</label>
                  <div className="lca-input">
                    <input
                      type="number"
                      className="form-control"
                      value={form["balance_payment_value_omr"]}
                      disabled
                      readOnly
                    />
                  </div>
                </div>

                {/* 14. TOTAL SUPPLIER PRICE (OMR) */}
                <div className="lca-field-pair lca-field-pair--dark">
                  <label className="lca-label">TOTAL SUPPLIER PRICE (OMR)</label>
                  <div className="lca-input">
                    <input
                      type="number"
                      className="form-control"
                      value={form["total_supplier_price_omr"]}
                      disabled
                      readOnly
                    />
                  </div>
                </div>

                {/* 15. BANK MUSCAT CHARGE - ADVANCE PAYMENT */}
                <div className="lca-field-pair">
                  <label className="lca-label">BANK MUSCAT CHARGE - ADVANCE PAYMENT</label>
                  <div className="lca-input">
                    <input
                      type="number"
                      step="any"
                      className="form-control"
                      value={form["bank_muscat_charge_advance_payment"]}
                      onChange={(e) => handleChange("bank_muscat_charge_advance_payment", e.target.value)}
                    />
                  </div>
                </div>

                {/* 16. BANK MUSCAT CHARGE - BALANCE PAYMENT */}
                <div className="lca-field-pair">
                  <label className="lca-label">BANK MUSCAT CHARGE - BALANCE PAYMENT</label>
                  <div className="lca-input">
                    <input
                      type="number"
                      step="any"
                      className="form-control"
                      value={form["bank_muscat_charge_balance_payment"]}
                      onChange={(e) => handleChange("bank_muscat_charge_balance_payment", e.target.value)}
                    />
                  </div>
                </div>

                {/* 17. FREIGHT CHARGE */}
                <div className="lca-field-pair">
                  <label className="lca-label">FREIGHT CHARGE</label>
                  <div className="lca-input">
                    <input
                      type="number"
                      step="any"
                      className="form-control lca-input--red"
                      value={form["freight_charge"]}
                      onChange={(e) => handleChange("freight_charge", e.target.value)}
                    />
                  </div>
                </div>

                {/* 18. CUSTOMS DUTY (OMR) */}
                <div className="lca-field-pair">
                  <label className="lca-label">CUSTOMS DUTY (OMR)</label>
                  <div className="lca-input">
                    <input
                      type="number"
                      step="any"
                      className="form-control lca-input--red"
                      value={form["customs_duty_omr"]}
                      onChange={(e) => handleChange("customs_duty_omr", e.target.value)}
                    />
                  </div>
                </div>

                {/* 19. OMAN CUSTOMS BOE CHARGE (OMR) */}
                <div className="lca-field-pair">
                  <label className="lca-label">OMAN CUSTOMS BOE CHARGE (OMR)</label>
                  <div className="lca-input">
                    <input
                      type="number"
                      step="any"
                      className="form-control"
                      value={form["oman_customs_boe_charge_omr"]}
                      onChange={(e) => handleChange("oman_customs_boe_charge_omr", e.target.value)}
                    />
                  </div>
                </div>

                {/* 20. ROP CUSTOMS INSPECTION CHARGE */}
                <div className="lca-field-pair">
                  <label className="lca-label">ROP CUSTOMS INSPECTION CHARGE</label>
                  <div className="lca-input">
                    <input
                      type="number"
                      step="any"
                      className="form-control lca-input--green"
                      value={form["rop_customs_inspection_charge"]}
                      onChange={(e) => handleChange("rop_customs_inspection_charge", e.target.value)}
                    />
                  </div>
                </div>

                {/* 21. UNLOADING CHARGE @ MUSCAT STORES (1) */}
                <div className="lca-field-pair">
                  <label className="lca-label">UNLOADING CHARGE @ MUSCAT STORES (1)</label>
                  <div className="lca-input">
                    <input
                      type="number"
                      step="any"
                      className="form-control"
                      value={form["unloading_charge_muscat_stores_1"]}
                      onChange={(e) => handleChange("unloading_charge_muscat_stores_1", e.target.value)}
                    />
                  </div>
                </div>

                {/* 22. UNLOADING CHARGE @ MUSCAT STORES (2) */}
                <div className="lca-field-pair">
                  <label className="lca-label">UNLOADING CHARGE @ MUSCAT STORES (2)</label>
                  <div className="lca-input">
                    <input
                      type="number"
                      step="any"
                      className="form-control"
                      value={form["unloading_charge_muscat_stores_2"]}
                      onChange={(e) => handleChange("unloading_charge_muscat_stores_2", e.target.value)}
                    />
                  </div>
                </div>

                {/* 23. LOADING CHARGE @ MUSCAT STORES AT THE TIME OF CUSTOMER DELIVERY */}
                <div className="lca-field-pair">
                  <label className="lca-label">
                    LOADING CHARGE @ MUSCAT STORES AT THE TIME OF CUSTOMER DELIVERY
                  </label>
                  <div className="lca-input">
                    <input
                      type="number"
                      step="any"
                      className="form-control"
                      value={form["loading_charge_muscat_stores_delivery"]}
                      onChange={(e) => handleChange("loading_charge_muscat_stores_delivery", e.target.value)}
                    />
                  </div>
                </div>

                {/* Summary Totals */}
                <div className="lca-field-pair lca-field-pair--dark mt-3">
                  <label className="lca-label">TOTAL (OMR)</label>
                  <div className="lca-input">
                    <input
                      type="number"
                      className="form-control"
                      value={form["total"]}
                      disabled
                      readOnly
                    />
                  </div>
                </div>

                <div className="lca-field-pair lca-field-pair--dark">
                  <label className="lca-label">COST FACTOR</label>
                  <div className="lca-input">
                    <input
                      type="number"
                      className="form-control"
                      value={form["cost_factor"]}
                      disabled
                      readOnly
                    />
                  </div>
                </div>

              </div>{/* /lca-fields-grid */}
            </CardBody>
          </Card>

          {/* ========== CARD 2: Payment History (Default Closed Accordion) ========== */}
          <Card className="lca-card mb-3 lca-accordion-card">
            <CardHeader
              className="lca-accordion-header"
              onClick={() => setPaymentHistoryOpen((prev) => !prev)}
            >
              <div className="lca-accordion-title">
                <span className="lca-accordion-icon">
                  {paymentHistoryOpen ? <BsChevronDown /> : <BsChevronRight />}
                </span>
                <h3>Payment History</h3>
                {settlementRowsWithValue.length > 0 && (
                  <span className="vendor-card__badge" style={{ fontSize: "0.75rem", padding: "0.15rem 0.5rem" }}>
                    {settlementRowsWithValue.length} record{settlementRowsWithValue.length === 1 ? "" : "s"}
                  </span>
                )}
              </div>
              <div onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  className="crud-add-btn"
                  onClick={() => {
                    setPaymentHistoryOpen(true);
                    addSettlementRow();
                  }}
                >
                  + Add Settlement
                </button>
              </div>
            </CardHeader>
            {paymentHistoryOpen && (
              <CardBody>
                <p
                  style={{
                    marginTop: 0,
                    marginBottom: "0.75rem",
                    fontSize: "0.8rem",
                    color: "#64748b",
                  }}
                >
                  Final Value (OMR) = Factor x Amount.
                </p>
                <div className="card-table-wrap">
                  <table className="users-table">
                    <thead>
                      <tr>
                        <th>Payment Date</th>
                        <th>{`Payment Amount (${selectedForeignCurrencyCode})`}</th>
                        <th>BANK EXCHANGE RATE</th>
                        <th>Amount (OMR)</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {settlementRowsWithValue.map((row) => (
                        <tr key={row.rowId}>
                          <td>
                            <input
                              type="date"
                              className="form-control"
                              value={row.settlement_date}
                              onChange={(e) =>
                                handleSettlementChange(
                                  row.rowId,
                                  "settlement_date",
                                  e.target.value
                                )
                              }
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              step="any"
                              className="form-control"
                              value={row.payment_amount}
                              onChange={(e) =>
                                handleSettlementChange(
                                  row.rowId,
                                  "payment_amount",
                                  e.target.value
                                )
                              }
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              step="any"
                              className="form-control"
                              value={row.factor}
                              onChange={(e) =>
                                handleSettlementChange(
                                  row.rowId,
                                  "factor",
                                  e.target.value
                                )
                              }
                              aria-label="BANK EXCHANGE RATE"
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              className="form-control"
                              value={toFixed(
                                toNumber(row.payment_amount) * toNumber(row.factor),
                                2
                              )}
                              readOnly
                              disabled
                            />
                          </td>
                          <td>
                            <button
                              type="button"
                              className="crud-add-btn crud-add-btn--neutral"
                              style={{ padding: "0.25rem 0.65rem", fontSize: "0.78rem" }}
                              onClick={() => removeSettlementRow(row.rowId)}
                              disabled={settlementRowsWithValue.length <= 1}
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardBody>
            )}
          </Card>

          {/* ========== CARD 3: Linked Purchase Items (Default Closed Accordion) ========== */}
          <Card className="lca-card mb-3 lca-accordion-card">
            <CardHeader
              className="lca-accordion-header"
              onClick={() => setLinkedItemsOpen((prev) => !prev)}
            >
              <div className="lca-accordion-title">
                <span className="lca-accordion-icon">
                  {linkedItemsOpen ? <BsChevronDown /> : <BsChevronRight />}
                </span>
                <h3>Linked Purchase Invoice Items & Linked Purchase Items</h3>
                {linkedItems.length > 0 && (
                  <span className="vendor-card__badge" style={{ fontSize: "0.75rem", padding: "0.15rem 0.5rem" }}>
                    {linkedItems.length} item{linkedItems.length === 1 ? "" : "s"}
                  </span>
                )}
              </div>
            </CardHeader>
            {linkedItemsOpen && (
              <CardBody>
                <div className="mb-3">
                  <label
                    className="col-form-label"
                    style={{
                      fontWeight: 600,
                      display: "block",
                      marginBottom: "0.25rem",
                    }}
                  >
                    Purchase / Invoice
                  </label>
                  <div className="d-flex gap-2 align-items-center">
                    <div style={{ flex: 1, position: "relative" }}>
                      <details
                        className="costing-selector-details"
                        style={{ width: "100%" }}
                      >
                        <summary
                          className="form-control"
                          style={{
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                          }}
                        >
                          <span
                            style={{
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {selectedPurchaseLabel}
                          </span>
                          <span>▼</span>
                        </summary>
                        <div
                          className="costing-selector-menu"
                          style={{ width: "100%", zIndex: 100 }}
                        >
                          <div className="costing-inline-actions costing-inline-actions--compact">
                            <button
                              type="button"
                              className="crud-add-btn"
                              onClick={() =>
                                setSelectedPurchaseIds(
                                  stockPurchaseOptions.map((o) => o.value)
                                )
                              }
                            >
                              Select All
                            </button>
                            <button
                              type="button"
                              className="crud-add-btn crud-add-btn--neutral"
                              onClick={() => setSelectedPurchaseIds([])}
                            >
                              Clear
                            </button>
                          </div>
                          {stockPurchaseOptions.map((o) => (
                            <label
                              key={o.value}
                              className="costing-selector-option"
                            >
                              <input
                                type="checkbox"
                                checked={selectedPurchaseIds.includes(o.value)}
                                onChange={() => togglePurchaseId(o.value)}
                              />
                              <span>{o.label}</span>
                            </label>
                          ))}
                        </div>
                      </details>
                    </div>
                    <button
                      type="button"
                      className="crud-add-btn"
                      onClick={handleShowItems}
                      disabled={!selectedPurchaseIds.length || modalLoading}
                      style={{ height: "36px", whiteSpace: "nowrap" }}
                    >
                      {modalLoading ? "Loading..." : "Show Items"}
                    </button>
                  </div>
                  <small
                    className="costing-inline-note"
                    style={{
                      display: "block",
                      marginTop: "0.25rem",
                      color: "#64748b",
                    }}
                  >
                    Use checkboxes to select multiple purchase numbers.
                  </small>
                  {selectedItemIds.length > 0 ? (
                    <p
                      className="costing-status-text costing-status-text--success"
                      style={{
                        marginTop: "0.35rem",
                        fontSize: "0.82rem",
                        color: "#16a34a",
                      }}
                    >
                      {selectedItemIds.length} item(s) selected &mdash; save to persist
                      LCA link.
                    </p>
                  ) : null}
                </div>

                <div className="card-table-wrap">
                  {linkedItems.length === 0 ? (
                    <p
                      className="users-status"
                      style={{
                        textAlign: "center",
                        padding: "1rem",
                        color: "#64748b",
                      }}
                    >
                      No purchase items linked yet. Use the selector above to select
                      items.
                    </p>
                  ) : (
                    <table className="users-table">
                      <thead>
                        <tr>
                          <th>GRN No.</th>
                          <th>Purchase No.</th>
                          <th>Invoice No.</th>
                          <th>Item Category</th>
                          <th>Item Name</th>
                          <th>Item Code</th>
                          <th>Total Price</th>
                          <th>Total Price After Tax / Unit</th>
                          <th>LCA COST (OMR)/Unit</th>
                        </tr>
                      </thead>
                      <tbody>
                        {linkedItems.map((item) => {
                          const lcaCost = toFixed(
                            toNumber(item.total_price) *
                              toNumber(form.cost_factor)
                          );
                          const perUnitLcaCost =
                            toNumber(item.quantity) > 0
                              ? toFixed(toNumber(lcaCost) / toNumber(item.quantity))
                              : "-";
                          return (
                            <tr key={item.id}>
                              <td>{item.grn_number}</td>
                              <td>{item.purchase_number || "-"}</td>
                              <td>{item.invoice_number || "-"}</td>
                              <td>{item.item_category}</td>
                              <td>{item.item_name}</td>
                              <td>{item.item_code}</td>
                              <td>
                                {item.total_price} {selectedForeignCurrencyCode}
                              </td>
                              <td>
                                {calculatePriceAfterTaxPerUnit(item)} {selectedForeignCurrencyCode}
                              </td>
                              <td>
                                <strong>{perUnitLcaCost}</strong>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </CardBody>
            )}
          </Card>

          {/* ========== Bottom Page Actions ========== */}
          <div className="lca-page-actions">
            <button
              type="submit"
              className="crud-add-btn"
              disabled={saving || loading}
            >
              <BsPlusCircleFill aria-hidden="true" />
              <span>{saving ? "Saving..." : "Save LCA Details"}</span>
            </button>
            <button
              type="button"
              className="modal-btn modal-btn--cancel"
              onClick={() => navigate("/projects/lca")}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* ------------------- Selection Modal ------------------- */}
      {modalOpen ? (
        <PurchaseItemModal
          items={modalItems}
          initialSelected={selectedItemIds}
          currentLcaId={lcaId}
          selectedForeignCurrencyCode={selectedForeignCurrencyCode}
          onConfirm={handleModalConfirm}
          onClose={() => setModalOpen(false)}
        />
      ) : null}
    </section>
  );
}

export default LCAAddPage;
