import { useEffect, useMemo, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  createLceChargeTypeOption,
  createLceEstimate,
  getLceEstimateById,
  getLcePurchaseItems,
  listLceEstimateMeta,
  listStockPurchases,
  updateLceEstimateById,
} from "../services/crudApi";
import { getSessionUser } from "../services/sessionUser";

const OTHER_CHARGE_FIELDS = [
  ["other_charges_1", "Other Charges 1", "other_charges_1_type"],
  ["other_charges_2", "Other Charges 2", "other_charges_2_type"],
  ["other_charges_3", "Other Charges 3", "other_charges_3_type"],
  ["other_charges_4", "Other Charges 4", "other_charges_4_type"],
];

const EDITABLE_FIELDS = [
  ["ex_works_material_cost", "Ex Works Material Cost"],
  ["packing_charges", "Packing Charges"],
  ["documentation", "Documentation"],
  ...OTHER_CHARGE_FIELDS.map(([valueKey, label]) => [valueKey, label.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ")]),
  ["advance_payment_value", "Advance Payment Value"],
  ["bank_muscat_charge_advance_payment", "Total Advance Payment (OMR)"],
  // ["bank_muscat_charge_balance_payment", "Balance Payment (OMR)"], // Removed as per user request
   ["freight_charge", "Freight Charge (OMR)"],
  ["customs_duty_omr", "Customs Duty (OMR)"],
  ["oman_customs_boe_charge_omr", "Oman Customs Boe Charge (OMR)"],
   ["rop_customs_inspection_charge", "Rop Customs Inspection Charge (OMR)"],
   ["unloading_charge_muscat_stores_1", "Unloading Charge @ Muscat Stores 1 (OMR)"],
   ["unloading_charge_muscat_stores_2", "Unloading Charge @ Muscat Stores 2 (OMR)"],
  ["loading_charge_muscat_stores_delivery", "Loading Charge @ Muscat Stores At The Time Of Customer Delivery"],
];

const FORMULA_FIELDS = [
  ["total_supplier_price", "Total Supplier Price"],
  ["balance_payment_value", "Balance Payment Value"],
  // ["balance_payment_value_omr", "Balance Payment Value (OMR)"], // Removed as per user request
  ["total_supplier_price_omr", "LCE COST (OMR)"],
   ["total", "Total (OMR)"],
  ["cost_factor", "Cost Factor"],
];

const EXTRA_FIELDS = ["other_charges_1_type", "other_charges_2_type", "other_charges_3_type", "other_charges_4_type", "foreign_currency_id"];
const DEFAULT_FORM = Object.fromEntries([...EDITABLE_FIELDS, ...FORMULA_FIELDS].map(([k]) => [k, "0"]));
EXTRA_FIELDS.forEach((key) => { DEFAULT_FORM[key] = ""; });

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

const toNumber = (value) => { const p = Number(value); return Number.isFinite(p) ? p : 0; };
const toFixed = (value, digits = 2) => String(Math.round((value + Number.EPSILON) * 10 ** digits) / 10 ** digits);

const calculateLinkedItemsTotalPrice = (items = []) => toFixed(
  items.reduce((sum, item) => sum + toNumber(item?.total_price), 0), 2
);

const applyLinkedItemsToForm = (values, items = []) => applyFormulas({
  ...values,
  ex_works_material_cost: calculateLinkedItemsTotalPrice(items),
});

const emptySettlementRow = (rowId, foreignCurrencyId = "") => ({
  rowId,
  settlement_date: "",
  foreign_currency_id: foreignCurrencyId,
  payment_amount: "0", // EUR
  factor: "0", // Exchange rate
  amount: "0", // OMR, always calculated
});

// Enhanced: preserve payment_amount if missing from backend, using previous settlements as fallback
const mapSettlementRows = (rows, fallbackCurrencyId = "", prevSettlements = []) => {
  const mapped = (Array.isArray(rows) ? rows : []).map((row, index) => {
    const rowId = Number(row?.id) || index + 1;
    // Try to find previous settlement by rowId or id
    const prev = prevSettlements.find(
      (p) => Number(p?.rowId) === rowId || Number(p?.id) === rowId
    );
    // On initial load, only fallback if backend value is undefined or null (not for empty string or '0')
    let paymentAmount = row?.payment_amount;
    if (paymentAmount === undefined || paymentAmount === null) {
      paymentAmount = prev ? prev.payment_amount : "0";
    }
    let factor = row?.factor;
    if (factor === undefined || factor === null) {
      factor = prev ? prev.factor : "0";
    }
    return {
      rowId,
      settlement_date: String(row?.settlement_date || prev?.settlement_date || ""),
      foreign_currency_id: String(row?.foreign_currency_id || fallbackCurrencyId || prev?.foreign_currency_id || ""),
      payment_amount: String(paymentAmount),
      factor: String(factor),
      amount: String(toNumber(paymentAmount) * toNumber(factor)),
    };
  });
  return mapped.length ? mapped : [emptySettlementRow(1, fallbackCurrencyId)];
};

// SearchableSelect component for dropdowns
function SearchableSelect({ value, onChange, options, placeholder, disabled = false }) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  const filtered = options.filter((opt) =>
    opt.label.toLowerCase().includes(search.toLowerCase())
  );

  const selected = options.find((opt) => opt.value === value);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="costing-select">
      <div
        className={`auth-input costing-select__trigger${disabled ? " costing-select__trigger--disabled" : ""}`}
        onClick={() => !disabled && setOpen((p) => !p)}
      >
        <span>{selected?.label || placeholder}</span>
        <span>▼</span>
      </div>
      {open && !disabled && (
        <div className="costing-select__menu">
          <input
            type="search"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="auth-input costing-select__search"
            onClick={(e) => e.stopPropagation()}
          />
          <div className="costing-select__list">
            {filtered.length === 0 ? (
              <div className="costing-select__empty">No options found</div>
            ) : (
              filtered.map((opt) => (
                <div
                  key={opt.value}
                  className={`costing-select__option${value === opt.value ? " costing-select__option--selected" : ""}`}
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                    setSearch("");
                  }}
                >
                  {opt.label}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function applyFormulas(values, settlementRowsWithValue = []) {
  const next = { ...values };
  // Settled Total (Foreign Currency) = sum of Payment Amounts (foreign currency) in Payment History
  const settledTotalForeign = settlementRowsWithValue && settlementRowsWithValue.length > 0
    ? settlementRowsWithValue.reduce((sum, row) => sum + toNumber(row.payment_amount || 0), 0)
    : 0;

  // Pending (Foreign Currency) = EX WORKS MATERIAL COST - Settled Total (Foreign Currency)
  // Removed pending_value_foreign_currency as per request

  const totalSupplierPrice =
    toNumber(next.ex_works_material_cost) + toNumber(next.packing_charges) + toNumber(next.documentation)
    + toNumber(next.other_charges_1) + toNumber(next.other_charges_2)
    + toNumber(next.other_charges_3) + toNumber(next.other_charges_4);

  // ADVANCE PAYMENT VALUE = sum of Payment Amount (EUR) in Payment History
  const advancePayment = settlementRowsWithValue && settlementRowsWithValue.length > 0
    ? settlementRowsWithValue.reduce((sum, row) => sum + toNumber(row.payment_amount || 0), 0)
    : 0;

  // Total ADVANCE PAYMENT (OMR) = sum of Payment Amount (EUR) * BANK EXCHANGE RATE (MUSCAT) in Payment History
  const totalAdvancePaymentOMR = settlementRowsWithValue && settlementRowsWithValue.length > 0
    ? settlementRowsWithValue.reduce((sum, row) => sum + (toNumber(row.payment_amount) * toNumber(row.factor)), 0)
    : toNumber(next.bank_muscat_charge_advance_payment);

  // BALANCE PAYMENT (OMR) = EX WORKS MATERIAL COST (EUR) - ADVANCE PAYMENT VALUE (EUR)
  const balancePayment = toNumber(next.ex_works_material_cost) - advancePayment;

  next.advance_payment_value = toFixed(advancePayment, 2);
  next.bank_muscat_charge_advance_payment = toFixed(totalAdvancePaymentOMR, 2);
  next.bank_muscat_charge_balance_payment = toFixed(balancePayment, 2);

  next.total_supplier_price = toFixed(totalSupplierPrice, 2);
  // The following OMR fields are now only for display, not used in formulas
  next.advance_payment_value_omr = toFixed(totalAdvancePaymentOMR, 2);
  next.balance_payment_value = toFixed(balancePayment, 2);
  next.balance_payment_value_omr = "";
  // Set Total Supplier Price (OMR) = Total Advance Payment (OMR) (sum of Amount (OMR) in Payment History)
  next.total_supplier_price_omr = toFixed(totalAdvancePaymentOMR, 2);
  next.total = toFixed(
    toNumber(next.bank_muscat_charge_advance_payment) + toNumber(next.bank_muscat_charge_balance_payment)
    + toNumber(next.freight_charge) + toNumber(next.customs_duty_omr)
    + toNumber(next.oman_customs_boe_charge_omr) + toNumber(next.rop_customs_inspection_charge)
    + toNumber(next.unloading_charge_muscat_stores_1) + toNumber(next.unloading_charge_muscat_stores_2)
    + toNumber(next.loading_charge_muscat_stores_delivery)
  );
  const exWorks = toNumber(next.ex_works_material_cost);
  next.cost_factor = toFixed(exWorks > 0 ? toNumber(next.total) / exWorks : 0, 2);
  return next;
}

function formatPurchaseOption(row) {
  const id = String(row?.id ?? "");
  const purchaseNumber = String(row?.purchase_number || row?.purchaseNumber || "").trim();
  const invoiceNumber = String(row?.invoice_number || row?.invoiceNumber || "").trim();
  const base = purchaseNumber ? `Purchase: ${purchaseNumber}` : `Purchase ID: ${id}`;
  const label = invoiceNumber ? `${base} | Invoice: ${invoiceNumber}` : base;
  return { value: id, label };
}

/* ─────────────────── Purchase Item Selection Modal ─────────────────── */
function PurchaseItemModal({ items, initialSelected, onConfirm, onClose, currentLceId, selectedForeignCurrencyCode }) {
  const [checked, setChecked] = useState(() => new Set(initialSelected));
  const [search, setSearch] = useState("");

  // An item is "taken" if it's linked to a DIFFERENT LCE (not this one).
  const isTaken = (item) =>
    item.lce_estimate_id && String(item.lce_estimate_id) !== String(currentLceId || "");

  const filteredItems = items.filter((item) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      String(item.grn_number || "").toLowerCase().includes(q) ||
      String(item.item_name || "").toLowerCase().includes(q) ||
      String(item.item_code || "").toLowerCase().includes(q) ||
      String(item.item_category || "").toLowerCase().includes(q) ||
      String(item.purchase_number || "").toLowerCase().includes(q) ||
      String(item.invoice_number || "").toLowerCase().includes(q)
    );
  });

  const selectableIds = filteredItems.filter((i) => !isTaken(i)).map((i) => i.id);
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => checked.has(id));

  const toggle = (id) => {
    setChecked((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  };

  return (
    <div className="modal-overlay">
      <div className="costing-modal-card">

        {/* ── Header bar ── */}
        <div className="costing-modal-card__header">
          <h3 className="costing-modal-card__title">Select Purchase Items</h3>
          <div className="costing-inline-actions">
            <button type="button" className="crud-add-btn"
              onClick={() => setChecked((prev) => { const n = new Set(prev); selectableIds.forEach((id) => n.add(id)); return n; })}>
              Select All
            </button>
            <button type="button" className="crud-add-btn crud-add-btn--neutral"
              onClick={() => setChecked(new Set())}>
              Clear
            </button>
          </div>
        </div>

        {/* ── Search bar ── */}
        <input
          type="search"
          className="auth-input costing-modal-card__search"
          placeholder="Search by GRN, item name, code, category, purchase or invoice…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {/* ── Table ── */}
        <div className="users-table-wrap users-table-wrap--sticky costing-modal-card__table-wrap">
          <table className="users-table">
            <thead>
              <tr>
                <th className="users-table__sticky-head costing-modal-card__th costing-modal-card__th--checkbox">
                  <input type="checkbox" checked={allSelected}
                    onChange={() => {
                      setChecked((prev) => {
                        const n = new Set(prev);
                        if (allSelected) selectableIds.forEach((id) => n.delete(id));
                        else selectableIds.forEach((id) => n.add(id));
                        return n;
                      });
                    }}
                  />
                </th>
                <th className="users-table__sticky-head costing-modal-card__th">GRN No.</th>
                <th className="users-table__sticky-head costing-modal-card__th">Purchase No.</th>
                <th className="users-table__sticky-head costing-modal-card__th">Invoice No.</th>
                <th className="users-table__sticky-head costing-modal-card__th">Item Category</th>
                <th className="users-table__sticky-head costing-modal-card__th">Item Name</th>
                <th className="users-table__sticky-head costing-modal-card__th">Item Code</th>
                <th className="users-table__sticky-head costing-modal-card__th">Qty</th>
                <th className="users-table__sticky-head costing-modal-card__th">Unit Price</th>
                <th className="users-table__sticky-head costing-modal-card__th">Total Price</th>
                <th className="users-table__sticky-head costing-modal-card__th">LCE</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.length === 0 ? (
                <tr><td colSpan={11} className="costing-modal-card__empty">No items match your search.</td></tr>
              ) : filteredItems.map((item) => {
                const taken = isTaken(item);
                const lceTag = item.lce_estimate_id ? `LCE_${String(item.lce_estimate_id).padStart(3, "0")}` : "—";
                const rowClassName = `costing-modal-card__row${taken ? " costing-modal-card__row--taken" : ""}${checked.has(item.id) && !taken ? " costing-modal-card__row--selected" : ""}`;
                return (
                  <tr
                    key={item.id}
                    title={taken ? `Already linked to ${lceTag}. Delink it first to reassign.` : ""}
                    className={rowClassName}
                  >
                    <td className="costing-modal-card__cell--checkbox">
                      <input type="checkbox" checked={checked.has(item.id)} disabled={taken}
                        onChange={() => !taken && toggle(item.id)} />
                    </td>
                    <td>{item.grn_number}</td>
                    <td>{item.purchase_number || "—"}</td>
                    <td>{item.invoice_number || "—"}</td>
                    <td>{item.item_category}</td>
                    <td>{item.item_name}</td>
                    <td>{item.item_code}</td>
                    <td>{item.quantity}</td>
                    <td>{item.unit_price} {selectedForeignCurrencyCode}</td>
                    <td>{item.total_price} {selectedForeignCurrencyCode}</td>
                    <td className={taken ? "costing-modal-card__lce--taken" : ""}>{lceTag}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* ── Footer ── */}
        <div className="costing-modal-card__footer">
          <span className="costing-help-text">
            {filteredItems.filter((i) => isTaken(i)).length > 0 &&
              `${filteredItems.filter((i) => isTaken(i)).length} item(s) already linked to another LCE (shown in red, disabled).`}
          </span>
          <div className="costing-inline-actions">
            <button type="button" className="crud-add-btn crud-add-btn--neutral" onClick={onClose}>Cancel</button>
            <button type="button" className="crud-add-btn" onClick={() => onConfirm([...checked])}>
              Confirm Selection ({checked.size})
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

/* ─────────────────── Main LCE Page ─────────────────── */
function CostingPage() {
  const { lceId } = useParams();
  const navigate = useNavigate();
  const currentUser = useMemo(() => getSessionUser(), []);
  const isAddMode = !lceId;

  const [form, setForm] = useState(DEFAULT_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [chargeTypeOptions, setChargeTypeOptions] = useState([]);
  const [currencyOptions, setCurrencyOptions] = useState([]);
  const [stockPurchaseOptions, setStockPurchaseOptions] = useState([]);

  // linked items (persisted on the LCE)
  const [linkedItems, setLinkedItems] = useState([]);
  const [selectedItemIds, setSelectedItemIds] = useState([]);
  const [balanceSettlements, setBalanceSettlements] = useState([emptySettlementRow(1)]);
  const [nextSettlementRowId, setNextSettlementRowId] = useState(2);

  // modal state
  const [selectedPurchaseIds, setSelectedPurchaseIds] = useState([]);
  const [modalItems, setModalItems] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setStatus("");

    const resolveAndLoad = async () => {
      const [metaData, recordData] = await Promise.all([
        listLceEstimateMeta(),
        lceId ? getLceEstimateById(lceId) : Promise.resolve(null),
      ]);
      if (!alive) return;

      const metaChargeTypes = Array.isArray(metaData?.charge_types) ? metaData.charge_types : [];
      const EXCLUDED = ["OTHER CHARGES 1", "OTHER CHARGES 2", "OTHER CHARGES 3", "OTHER CHARGES 4"];
      const defaultChargeTypes = ["EMPTY CONTAINER WEIGHING CHARGE", "CONTAINER LOADING FEE", "LOADED CONTAINER WEIGHING CHARGE"];
      const mergedChargeTypes = [...new Set([...metaChargeTypes.map((r) => r.name), ...defaultChargeTypes])]
        .filter((name) => !EXCLUDED.includes(name.toUpperCase()));
      setChargeTypeOptions(mergedChargeTypes.map((name) => ({ value: name, label: name })));

      const currencies = Array.isArray(metaData?.currencies) ? metaData.currencies : [];
      setCurrencyOptions(currencies.map((row) => ({
        value: String(row.id),
        label: row.label || `${row.country_name} - ${row.currency_code}`,
        currencyCode: String(row.currency_code || "").trim().toUpperCase(),
      })));

      let purchases = Array.isArray(metaData?.stock_purchases) ? metaData.stock_purchases : [];
      if (purchases.length === 0) {
        const stockListData = await listStockPurchases();
        purchases = Array.isArray(stockListData?.stock_purchases) ? stockListData.stock_purchases : [];
      }
      setStockPurchaseOptions(
        purchases
          .map((row) => ({
            value: String(row.id),
            label: row?.label || formatPurchaseOption(row).label,
          }))
          .filter((row) => row.value)
      );

      if (!recordData) {
        setForm(applyFormulas({ ...DEFAULT_FORM }));
        setBalanceSettlements([emptySettlementRow(1)]);
        setNextSettlementRowId(2);
        setLoading(false);
        return;
      }

      const estimate = recordData.lce_estimate || {};
      const merged = { ...DEFAULT_FORM };
      [...EDITABLE_FIELDS, ...FORMULA_FIELDS].forEach(([key]) => { merged[key] = String(estimate[key] ?? merged[key]); });
      EXTRA_FIELDS.forEach((key) => { merged[key] = String(estimate[key] ?? merged[key] ?? ""); });
      const items = Array.isArray(estimate.purchase_items) ? estimate.purchase_items : [];
      setLinkedItems(items);
      setSelectedItemIds((estimate.linked_item_ids || []).map(Number));
      const settlementRows = mapSettlementRows(estimate.balance_settlements, merged.foreign_currency_id || "");
      setBalanceSettlements(settlementRows);
      // Recalculate formulas using loaded settlements
      setForm((prevForm) => applyFormulas(applyLinkedItemsToForm(merged, items), settlementRows));
      setNextSettlementRowId((settlementRows.reduce((max, row) => Math.max(max, Number(row.rowId) || 0), 0) || 0) + 1);
      setLoading(false);
    };

    resolveAndLoad().catch((err) => {
      if (!alive) return;
      setStatus(err.message || "Failed to load LCE details.");
      setLoading(false);
    });

    return () => { alive = false; };
  }, [lceId]);

  // Ensure calculated fields are always up-to-date when editing an LCE
  useEffect(() => {
    if (!lceId) return; // Only for edit mode
    // Recalculate formulas using current form, linkedItems, and settlements
    setForm((prevForm) => applyFormulas(applyLinkedItemsToForm(prevForm, linkedItems), balanceSettlements));
  }, [lceId, linkedItems, balanceSettlements]);

  const handleChange = (key, value) => setForm((prev) => applyLinkedItemsToForm({ ...prev, [key]: value }, linkedItems));

  const handleChargeTypeAdd = async (typeKey) => {
    const raw = window.prompt("Enter new charge type");
    const value = String(raw || "").trim();
    if (!value) return;
    if (chargeTypeOptions.some((o) => o.value.toLowerCase() === value.toLowerCase())) {
      window.alert("Charge type already exists."); return;
    }
    try {
      const data = await createLceChargeTypeOption(value);
      const created = data?.charge_type?.name || value;
      setChargeTypeOptions((prev) => [...prev, { value: created, label: created }]);
      setForm((prev) => ({ ...prev, [typeKey]: created }));
    } catch (error) { setStatus(error?.message || "Failed to add charge type."); }
  };

  const togglePurchaseId = (purchaseId) => {
    setSelectedPurchaseIds((prev) => {
      if (prev.includes(purchaseId)) {
        return prev.filter((id) => id !== purchaseId);
      }
      return [...prev, purchaseId];
    });
  };

  const selectedPurchaseLabel = useMemo(() => {
    if (!selectedPurchaseIds.length) return "Select purchase / invoice";
    if (selectedPurchaseIds.length === 1) {
      const row = stockPurchaseOptions.find((o) => o.value === selectedPurchaseIds[0]);
      return row?.label || "1 selected";
    }
    return `${selectedPurchaseIds.length} purchase(s) selected`;
  }, [selectedPurchaseIds, stockPurchaseOptions]);

  const selectedForeignCurrencyCode = useMemo(() => {
    const selected = currencyOptions.find((o) => String(o.value) === String(form.foreign_currency_id || ""));
    return selected?.currencyCode || "FOREIGN CURRENCY";
  }, [currencyOptions, form.foreign_currency_id]);

  const withForeignCurrencyLabel = (key, label) => {
    // Restore currency units in label as before
    if (FOREIGN_CURRENCY_KEYS.has(key)) {
      return `${label} (${selectedForeignCurrencyCode})`;
    }
    if (key === "foreign_currency_id") {
      return "Foreign Currency";
    }
    return label;
  };

  const settlementRowsWithValue = useMemo(
    () => balanceSettlements.map((row) => ({
      ...row,
      value: toFixed(toNumber(row.payment_amount) * toNumber(row.factor), 2),
    })),
    [balanceSettlements]
  );

  const settledValueTotal = useMemo(
    () => toFixed(settlementRowsWithValue.reduce((sum, row) => sum + toNumber(row.value), 0), 2),
    [settlementRowsWithValue]
  );

  // Add settledValueTotalEUR for foreign currency
  const settledValueTotalEUR = useMemo(
    () => toFixed(settlementRowsWithValue.reduce((sum, row) => sum + toNumber(row.payment_amount), 0), 2),
    [settlementRowsWithValue]
  );

  // --- FORCE FORMULA RECALCULATION ON SETTLEMENT CHANGE ---
  const handleSettlementChange = (rowId, key, value) => {
    setBalanceSettlements((prev) => {
      const updated = prev.map((row) => (row.rowId === rowId ? { ...row, [key]: value } : row));
      // Force recalculation of form fields based on new settlements
      setForm((oldForm) => applyFormulas({ ...oldForm }, updated));
      return updated;
    });
  };

  const addSettlementRow = () => {
    setBalanceSettlements((prev) => [...prev, emptySettlementRow(nextSettlementRowId, form.foreign_currency_id || "")]);
    setNextSettlementRowId((prev) => prev + 1);
  };

  const removeSettlementRow = (rowId) => {
    setBalanceSettlements((prev) => (prev.length > 1 ? prev.filter((row) => row.rowId !== rowId) : prev));
  };

  const handleShowItems = async () => {
    if (!selectedPurchaseIds.length) { setStatus("Please select at least one purchase."); return; }
    setModalLoading(true);
    setStatus("");
    try {
      const responses = await Promise.all(selectedPurchaseIds.map((purchaseId) => getLcePurchaseItems(purchaseId)));
      const merged = [];
      const seen = new Set();
      responses.forEach((data) => {
        const rows = Array.isArray(data?.items) ? data.items : [];
        rows.forEach((row) => {
          if (seen.has(row.id)) return;
          seen.add(row.id);
          merged.push(row);
        });
      });
      setModalItems(merged);
      setModalOpen(true);
    } catch (err) {
      setStatus(err?.message || "Failed to load purchase items.");
    } finally {
      setModalLoading(false);
    }
  };

  const handleModalConfirm = (ids) => {
    const modalIds = new Set(modalItems.map((i) => i.id));
    const keepFromPrevious = selectedItemIds.filter((id) => !modalIds.has(id));
    const nextIds = [...keepFromPrevious, ...ids];
    setSelectedItemIds(nextIds);

    const keepRows = linkedItems.filter((row) => !modalIds.has(row.id));
    const pickedRows = modalItems.filter((row) => ids.includes(row.id));
      const nextLinkedItems = [...keepRows, ...pickedRows];
      setLinkedItems(nextLinkedItems);
      setForm((prev) => applyLinkedItemsToForm(prev, nextLinkedItems));
    setModalOpen(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setStatus("");

    const settlementPayload = settlementRowsWithValue
      .filter((row) => (
        String(row.settlement_date || "").trim()
        || toNumber(row.payment_amount) !== 0
        || toNumber(row.factor) !== 0
        || String(row.foreign_currency_id || "").trim()
      ))
      .map((row) => ({
        settlement_date: String(row.settlement_date || "").trim(),
        foreign_currency_id: String(row.foreign_currency_id || "").trim(),
        payment_amount: row.payment_amount,
        factor: row.factor,
        amount: String(toNumber(row.payment_amount) * toNumber(row.factor)),
      }));

    if (settlementPayload.some((row) => !row.settlement_date)) {
      setStatus("Settlement date is required for each balance settlement row.");
      setSaving(false);
      return;
    }

    try {
      const payload = {
        ...Object.fromEntries(EDITABLE_FIELDS.filter(([key]) => key !== "ex_works_material_cost").map(([key]) => [key, form[key]])),
        ex_works_material_cost: calculateLinkedItemsTotalPrice(linkedItems),
        other_charges_1_type: form.other_charges_1_type || "",
        other_charges_2_type: form.other_charges_2_type || "",
        other_charges_3_type: form.other_charges_3_type || "",
        other_charges_4_type: form.other_charges_4_type || "",
        foreign_currency_id: form.foreign_currency_id || "",
        item_ids: selectedItemIds,
        balance_settlements: settlementPayload,
        created_by: currentUser?.username || "",
      };
      const data = isAddMode ? await createLceEstimate(payload) : await updateLceEstimateById(lceId, payload);
      const estimate = data.lce_estimate || {};
      const merged = { ...form }; // Start with previous form state
      [...EDITABLE_FIELDS, ...FORMULA_FIELDS].forEach(([key]) => {
        if (estimate[key] !== undefined && estimate[key] !== null) {
          merged[key] = String(estimate[key]);
        }
      });
      EXTRA_FIELDS.forEach((key) => {
        if (estimate[key] !== undefined && estimate[key] !== null) {
          merged[key] = String(estimate[key]);
        }
      });
      const items = Array.isArray(estimate.purchase_items) ? estimate.purchase_items : [];
      setLinkedItems(items);
      setSelectedItemIds((estimate.linked_item_ids || []).map(Number));
      // Only update settlements if backend returns a non-empty array, otherwise preserve current state
      let settlementRows = balanceSettlements;
      if (Array.isArray(estimate.balance_settlements) && estimate.balance_settlements.length > 0) {
        // Use enhanced mapping: preserve payment_amount if missing from backend
        settlementRows = mapSettlementRows(
          estimate.balance_settlements,
          merged.foreign_currency_id || "",
          balanceSettlements
        );
        setBalanceSettlements(settlementRows);
        setNextSettlementRowId((settlementRows.reduce((max, row) => Math.max(max, Number(row.rowId) || 0), 0) || 0) + 1);
      } else {
        // Do NOT update balanceSettlements if backend returns empty/null/undefined
        settlementRows = balanceSettlements;
      }
      // Always recalculate formulas using the latest settlements
      setForm(() => applyFormulas(applyLinkedItemsToForm(merged, items), settlementRows));
      setStatus("LCE saved successfully.");
      if (isAddMode && estimate.id) navigate(`/projects/costing/record/${estimate.id}`, { replace: true });
    } catch (err) {
      setStatus(err.message || "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const lceLabel = lceId ? `LCE_${String(lceId).padStart(3, "0")}` : "(New)";

  return (
    <section className="module-page">
      <div className="crud-page__header costing-page__header">
        <div>
          <h1 className="module-page__title costing-page__title">
            {isAddMode ? "LCE Add" : `LCE Form — ${lceLabel}`}
          </h1>
        </div>
        <div className="costing-inline-actions">
          <button type="button" className="crud-add-btn" onClick={() => navigate("/projects/costing")}>Back to LCE List</button>
          <button type="button" className="crud-add-btn" onClick={handleSave} disabled={saving || loading}>
            {saving ? "Saving..." : "Save LCE Details"}
          </button>
        </div>
      </div>

      {status ? <p className="users-status">{status}</p> : null}
      {loading ? <p className="users-status">Loading...</p> : null}

      {!loading ? (
        <>
          {/* ── Cost fields ── */}
          <div className="lce-form-grid lce-form-grid--four">
            {/* Add Foreign Currency field at the top of the form */}
            <label key="foreign_currency_id" className="lce-form-card">
              <span className="lce-form-card__label">{withForeignCurrencyLabel("foreign_currency_id", "Foreign Currency")}</span>
              <select
                className="auth-input lce-form-card__input"
                value={form["foreign_currency_id"] || ""}
                onChange={e => handleChange("foreign_currency_id", e.target.value)}
              >
                <option value="">Select currency</option>
                {currencyOptions.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>
            {EDITABLE_FIELDS.filter(([key]) => key !== "bank_exchange_rate").map(([key, label]) => {
              const isCalculatedExWorks = key === "ex_works_material_cost";
              const otherField = OTHER_CHARGE_FIELDS.find(([vk]) => vk === key);
              if (isCalculatedExWorks) {
                return (
                  <label key={key} className="lce-form-card">
                    <span className="lce-form-card__label">
                      <strong>{withForeignCurrencyLabel(key, label)}</strong> <small className="costing-inline-note">(calculated from linked items)</small>
                    </span>
                    <input
                      type="number"
                      className="auth-input lce-form-card__input lce-form-card__input--readonly"
                      step="any"
                      value={form[key]}
                      disabled
                      readOnly
                    />
                  </label>
                );
              }
              if (otherField) {
                const [, chargeLabel, typeKey] = otherField;
                return (
                  <div key={key} className="lce-form-card">
                    <span className="lce-form-card__label">{withForeignCurrencyLabel(key, chargeLabel)}</span>
                    <div className="lce-charge-split-row">
                      <div className="lce-charge-split-col">
                        <div className="lce-charge-type-row">
                          <select
                            className="auth-input lce-form-card__input costing-min-width-reset"
                            value={form[typeKey] || ""}
                            onChange={(e) => handleChange(typeKey, e.target.value)}
                          >
                            <option value="">Select charge type</option>
                            {chargeTypeOptions.map((o) => <option key={`${typeKey}-${o.value}`} value={o.value}>{o.label}</option>)}
                          </select>
                          <button
                            type="button"
                            className="crud-add-btn"
                            onClick={() => handleChargeTypeAdd(typeKey)}
                            aria-label="Add charge type"
                            title="Add charge type"
                          >
                            +
                          </button>
                        </div>
                      </div>
                      <div className="lce-charge-split-col">
                        <input
                          type="number"
                          className="auth-input lce-form-card__input"
                          step="any"
                          value={form[key]}
                          disabled={!form[typeKey]}
                          onChange={(e) => handleChange(key, e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                );
              }
               // Make Advance Payment Value always read-only and calculated
               if (key === "advance_payment_value") {
                 return [
                   <label key={key} className="lce-form-card">
                     <span className="lce-form-card__label">
                       <strong>{withForeignCurrencyLabel(key, label)}</strong> <small className="costing-inline-note">(sum of Payment Amount (OMR) in Payment History)</small>
                     </span>
                     <input
                       type="number"
                       className="auth-input lce-form-card__input lce-form-card__input--readonly"
                       step="any"
                       value={form[key]}
                       disabled
                       readOnly
                     />
                   </label>,
                   // Insert Balance Payment Value (EUR) field here
                   <label key="balance_payment_value" className="lce-form-card">
                      <span className="lce-form-card__label">
                        <strong>{withForeignCurrencyLabel("balance_payment_value", "Balance Payment Value")}</strong>
                      </span>
                     <input
                       type="number"
                       className="auth-input lce-form-card__input lce-form-card__input--readonly"
                       step="any"
                       value={form["balance_payment_value"]}
                       disabled
                       readOnly
                     />
                   </label>
                 ];
               }
               // Make Total Advance Payment (OMR) always disabled and read-only
               if (key === "bank_muscat_charge_advance_payment") {
                 return (
                   <label key={key} className="lce-form-card">
                     <span className="lce-form-card__label">
                       <strong>{withForeignCurrencyLabel(key, label)}</strong> <small className="costing-inline-note">(sum of Amount (OMR) in Payment History)</small>
                     </span>
                     <input
                       type="number"
                       className="auth-input lce-form-card__input lce-form-card__input--readonly"
                       step="any"
                       value={form[key]}
                       disabled
                       readOnly
                     />
                   </label>
                 );
               }
              return (
                <label key={key} className="lce-form-card">
                  <span className="lce-form-card__label">{withForeignCurrencyLabel(key, label)}</span>
                  <input type="number" className="auth-input lce-form-card__input" step="any" value={form[key]} onChange={(e) => handleChange(key, e.target.value)} />
                </label>
              );
            })}

            {FORMULA_FIELDS.filter(([key]) => key !== "balance_payment_value").map(([key, label]) => {
              let displayLabel = key === "total_supplier_price_omr" ? "LCE COST (OMR)" : withForeignCurrencyLabel(key, label);
              return (
                <label key={key} className="lce-form-card lce-form-card--formula">
                  <span className="lce-form-card__label"><strong>{displayLabel}</strong></span>
                  <input type="number" className="auth-input lce-form-card__input lce-form-card__input--readonly" value={form[key]} readOnly />
                </label>
              );
            })}
          </div>

          <div className="costing-section-card costing-section-card--spaced">
            <div className="costing-section-card__head">
              <h3 className="costing-section-card__title">Payment History</h3>
              <button type="button" className="crud-add-btn" onClick={addSettlementRow}>+ Add Settlement</button>
            </div>
             <p className="costing-help-text costing-help-text--mt">
               Final Value (OMR) = Factor x Amount.
             </p>

                    <div className="users-table-wrap">
                      <table className="users-table">
                        <thead>
                          <tr>
                            <th>Payment Date</th>
                            {/* Removed Foreign Currency column */}
                              <th>{`Payment Amount (${selectedForeignCurrencyCode})`}</th>
                            <th>BANK EXCHANGE RATE (MUSCAT)</th>
                              <th>Payment Amount (OMR)</th>
                            <th className="costing-col-action">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {settlementRowsWithValue.map((row) => (
                            <tr key={row.rowId}>
                              <td>
                                <input
                                  type="date"
                                  className="auth-input"
                                  value={row.settlement_date}
                                  onChange={(e) => handleSettlementChange(row.rowId, "settlement_date", e.target.value)}
                                />
                              </td>
                              {/* Removed Foreign Currency cell */}
                              <td>
                                <input
                                  type="number"
                                  step="any"
                                  className="auth-input"
                                  value={row.payment_amount}
                                  onChange={(e) => handleSettlementChange(row.rowId, "payment_amount", e.target.value)}
                                />
                              </td>
                              <td>
                                <input
                                  type="number"
                                  step="any"
                                  className="auth-input"
                                  value={row.factor}
                                  onChange={(e) => handleSettlementChange(row.rowId, "factor", e.target.value)}
                                  aria-label="BANK EXCHANGE RATE (MUSCAT)"
                                />
                              </td>
                              <td>
                                <input
                                  type="number"
                                  className="auth-input"
                                  value={toFixed(toNumber(row.payment_amount) * toNumber(row.factor), 2)}
                                  readOnly
                                  disabled
                                />
                              </td>
                              <td>
                                <button
                                  type="button"
                                  className="crud-add-btn crud-add-btn--neutral costing-btn--full"
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

            <div className="costing-inline-actions costing-inline-actions--summary">
              {/* Settled Total display removed as per request */}
              {/* Pending field removed as per request */}
            </div>
          </div>

          {/* ── Purchase invoice selector (top) ── */}
          <div className="costing-section-card costing-section-card--lg-gap">
            <h3 className="costing-section-card__title costing-section-card__title--spaced">Link Purchase Invoice Items</h3>
            <div className="costing-selector-row">
              <div className="costing-selector-main">
                <label className="costing-selector-label">Purchase / Invoice</label>
                <details className="costing-selector-details">
                  <summary
                    className="auth-input costing-selector-summary"
                  >
                    {selectedPurchaseLabel}
                  </summary>
                  <div className="costing-selector-menu">
                    <div className="costing-inline-actions costing-inline-actions--compact">
                      <button type="button" className="crud-add-btn" onClick={() => setSelectedPurchaseIds(stockPurchaseOptions.map((o) => o.value))}>
                        Select All
                      </button>
                      <button type="button" className="crud-add-btn crud-add-btn--neutral" onClick={() => setSelectedPurchaseIds([])}>
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
                <small className="costing-inline-note">Use checkboxes to select multiple purchase numbers.</small>
              </div>
              <button
                type="button"
                className="crud-add-btn costing-btn-show-items"
                onClick={handleShowItems}
                disabled={!selectedPurchaseIds.length || modalLoading}
              >
                {modalLoading ? "Loading..." : "Show Items"}
              </button>
            </div>
            {selectedItemIds.length > 0 ? (
              <p className="costing-status-text costing-status-text--success">
                {selectedItemIds.length} item(s) selected — save to persist LCE link.
              </p>
            ) : null}
          </div>

          {/* ── Linked items table ── */}
          <div className="costing-linked-section">
            <h2 className="module-page__title costing-linked-section__title">
              Linked Purchase Items {linkedItems.length > 0 ? `(${linkedItems.length})` : ""}
            </h2>
            {linkedItems.length === 0 ? (
              <p className="users-status">No purchase items linked yet. Use the section above to select items.</p>
            ) : (
              <div className="users-table-wrap">
                <table className="users-table">
                  <thead>
                    <tr>
                      <th>GRN No.</th>
                      <th>Purchase No.</th>
                      <th>Invoice No.</th>
                      <th>Item Category</th>
                      <th>Item Name</th>
                      <th>Item Code</th>
                      <th>Qty</th>
                      <th>Total Price</th>
                      <th>LCE COST (OMR)/Unit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {linkedItems.map((item) => {
                       const lceCost = toFixed(toNumber(item.total_price) * toNumber(form.cost_factor));
                       const perUnitLceCost = (toNumber(item.quantity) > 0)
                         ? toFixed(toNumber(lceCost) / toNumber(item.quantity))
                         : "-";
                       return (
                         <tr key={item.id}>
                           <td>{item.grn_number}</td>
                           <td>{item.purchase_number || "-"}</td>
                           <td>{item.invoice_number || "-"}</td>
                           <td>{item.item_category}</td>
                           <td>{item.item_name}</td>
                           <td>{item.item_code}</td>
                           <td>{item.quantity}</td>
                           <td>{item.total_price} {selectedForeignCurrencyCode}</td>
                           <td><strong>{perUnitLceCost}</strong></td>
                         </tr>
                       );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : null}

       {modalOpen ? (
         <PurchaseItemModal
           items={modalItems}
           initialSelected={selectedItemIds}
           onConfirm={handleModalConfirm}
           onClose={() => setModalOpen(false)}
           currentLceId={lceId}
           selectedForeignCurrencyCode={selectedForeignCurrencyCode}
         />
       ) : null}
    </section>
  );
}

export default CostingPage;

