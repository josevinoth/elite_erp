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
  ["other_charges_1", "OTHER CHARGES 1", "other_charges_1_type"],
  ["other_charges_2", "OTHER CHARGES 2", "other_charges_2_type"],
  ["other_charges_3", "OTHER CHARGES 3", "other_charges_3_type"],
  ["other_charges_4", "OTHER CHARGES 4", "other_charges_4_type"],
];

const EDITABLE_FIELDS = [
  ["ex_works_material_cost", "EX WORKS MATERIAL COST"],
  ["packing_charges", "PACKING CHARGES"],
  ["documentation", "DOCUMENTATION"],
  ...OTHER_CHARGE_FIELDS.map(([valueKey, label]) => [valueKey, label]),
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
  ["cost_factor", "COST FACTOR"],
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
const toFixed = (value, digits = 3) => String(Math.round((value + Number.EPSILON) * 10 ** digits) / 10 ** digits);

const calculateLinkedItemsTotalPrice = (items = []) => toFixed(
  items.reduce((sum, item) => sum + toNumber(item?.total_price), 0)
);

const applyLinkedItemsToForm = (values, items = []) => applyFormulas({
  ...values,
  ex_works_material_cost: calculateLinkedItemsTotalPrice(items),
});

const emptySettlementRow = (rowId, foreignCurrencyId = "") => ({
  rowId,
  settlement_date: "",
  foreign_currency_id: foreignCurrencyId,
  amount: "0",
  factor: "0",
});

const mapSettlementRows = (rows, fallbackCurrencyId = "") => {
  const mapped = (Array.isArray(rows) ? rows : []).map((row, index) => ({
    rowId: Number(row?.id) || index + 1,
    settlement_date: String(row?.settlement_date || ""),
    foreign_currency_id: String(row?.foreign_currency_id || fallbackCurrencyId || ""),
    amount: String(row?.amount ?? "0"),
    factor: String(row?.factor ?? "0"),
  }));
  return mapped.length ? mapped : [emptySettlementRow(1, fallbackCurrencyId)];
};

// Check if entire purchase is taken (all items linked to same LCE)
const isPurchaseFullyTaken = (purchaseId, items, currentLceId) => {
  const purchaseItems = items.filter((item) => String(item.purchase_id || item.stock_purchase_id) === String(purchaseId));
  if (purchaseItems.length === 0) return false;
  return purchaseItems.every((item) => item.lce_estimate_id && String(item.lce_estimate_id) !== String(currentLceId || ""));
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
    <div ref={containerRef} style={{ position: "relative", width: "100%" }}>
      <div
        className="auth-input"
        style={{
          background: disabled ? "#e5e7eb" : "#ffffff",
          color: disabled ? "#9ca3af" : "#111827",
          cursor: disabled ? "not-allowed" : "pointer",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "0.5rem 0.75rem",
          minHeight: 40,
          borderRadius: 4,
          opacity: disabled ? 0.6 : 1,
        }}
        onClick={() => !disabled && setOpen((p) => !p)}
      >
        <span>{selected?.label || placeholder}</span>
        <span>▼</span>
      </div>
      {open && !disabled && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            marginTop: 4,
            background: "#ffffff",
            border: "1px solid #d1d5db",
            borderRadius: 4,
            zIndex: 10,
            boxShadow: "0 10px 15px rgba(0,0,0,0.1)",
          }}
        >
          <input
            type="search"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: "100%",
              padding: "0.5rem 0.75rem",
              border: "none",
              borderBottom: "1px solid #e5e7eb",
              outline: "none",
              fontSize: "0.875rem",
            }}
            onClick={(e) => e.stopPropagation()}
          />
          <div style={{ maxHeight: 200, overflowY: "auto" }}>
            {filtered.length === 0 ? (
              <div style={{ padding: "0.75rem", color: "#6b7280", textAlign: "center" }}>No options found</div>
            ) : (
              filtered.map((opt) => (
                <div
                  key={opt.value}
                  style={{
                    padding: "0.5rem 0.75rem",
                    cursor: "pointer",
                    background: value === opt.value ? "#d1fae5" : "transparent",
                    color: value === opt.value ? "#065f46" : "#111827",
                    fontWeight: value === opt.value ? 600 : 400,
                    fontSize: "0.875rem",
                  }}
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                    setSearch("");
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.background = "#f3f4f6";
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = value === opt.value ? "#d1fae5" : "transparent";
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

function applyFormulas(values) {
  const next = { ...values };
  const totalSupplierPrice =
    toNumber(next.ex_works_material_cost) + toNumber(next.packing_charges) + toNumber(next.documentation)
    + toNumber(next.other_charges_1) + toNumber(next.other_charges_2)
    + toNumber(next.other_charges_3) + toNumber(next.other_charges_4);
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
    toNumber(next.bank_muscat_charge_advance_payment) + toNumber(next.bank_muscat_charge_balance_payment)
    + toNumber(next.freight_charge) + toNumber(next.customs_duty_omr)
    + toNumber(next.oman_customs_boe_charge_omr) + toNumber(next.rop_customs_inspection_charge)
    + toNumber(next.unloading_charge_muscat_stores_1) + toNumber(next.unloading_charge_muscat_stores_2)
    + toNumber(next.loading_charge_muscat_stores_delivery)
  );
  const exWorks = toNumber(next.ex_works_material_cost);
  next.cost_factor = toFixed(exWorks > 0 ? toNumber(next.total) / exWorks : 0, 6);
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
function PurchaseItemModal({ items, initialSelected, onConfirm, onClose, currentLceId }) {
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

  const thStyle = {
    background: "#0f5860",
    color: "#e9fffd",
    borderBottom: "2px solid #28a9a0",
    fontWeight: 700,
    letterSpacing: "0.03em",
    position: "sticky",
    top: 0,
    zIndex: 2,
    whiteSpace: "nowrap",
  };

  return (
    <div className="modal-overlay" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "#0a3a40", color: "#f0fffe", borderRadius: 10, border: "1px solid #1a6f77", padding: "1.25rem 1.5rem", maxWidth: 1200, width: "95%", maxHeight: "85vh", display: "flex", flexDirection: "column", gap: "0.75rem" }}>

        {/* ── Header bar ── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.65rem 0.85rem", borderRadius: 6, background: "#08464d", border: "1px solid #1d737b" }}>
          <h3 style={{ margin: 0, fontSize: "1.05rem", letterSpacing: "0.02em" }}>Select Purchase Items</h3>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button type="button" className="crud-add-btn"
              onClick={() => setChecked((prev) => { const n = new Set(prev); selectableIds.forEach((id) => n.add(id)); return n; })}>
              Select All
            </button>
            <button type="button" className="crud-add-btn" style={{ background: "#6c757d" }}
              onClick={() => setChecked(new Set())}>
              Clear
            </button>
          </div>
        </div>

        {/* ── Search bar ── */}
        <input
          type="search"
          className="auth-input"
          placeholder="Search by GRN, item name, code, category, purchase or invoice…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ background: "#062f34", border: "1px solid #1e666d", color: "#f0fffe" }}
        />

        {/* ── Table ── */}
        <div className="users-table-wrap" style={{ overflowY: "auto", flex: 1 }}>
          <table className="users-table" style={{ width: "100%" }}>
            <thead>
              <tr>
                <th style={{ ...thStyle, width: 36, textAlign: "center" }}>
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
                <th style={thStyle}>GRN No.</th>
                <th style={thStyle}>Purchase No.</th>
                <th style={thStyle}>Invoice No.</th>
                <th style={thStyle}>Item Category</th>
                <th style={thStyle}>Item Name</th>
                <th style={thStyle}>Item Code</th>
                <th style={thStyle}>Qty</th>
                <th style={thStyle}>Unit Price</th>
                <th style={thStyle}>Total Price</th>
                <th style={thStyle}>LCE</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.length === 0 ? (
                <tr><td colSpan={11} style={{ textAlign: "center", padding: "1rem", color: "#8ab8b6" }}>No items match your search.</td></tr>
              ) : filteredItems.map((item) => {
                const taken = isTaken(item);
                const lceTag = item.lce_estimate_id ? `LCE_${String(item.lce_estimate_id).padStart(3, "0")}` : "—";
                return (
                  <tr
                    key={item.id}
                    title={taken ? `Already linked to ${lceTag}. Delink it first to reassign.` : ""}
                    style={{
                      opacity: taken ? 0.45 : 1,
                      background: taken ? "rgba(255,80,80,0.07)" : checked.has(item.id) ? "rgba(22,178,165,0.18)" : undefined,
                      cursor: taken ? "not-allowed" : "default",
                    }}
                  >
                    <td style={{ textAlign: "center" }}>
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
                    <td>{item.unit_price}</td>
                    <td>{item.total_price}</td>
                    <td style={taken ? { color: "#f87171", fontWeight: 600 } : {}}>{lceTag}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* ── Footer ── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ fontSize: "0.82rem", color: "#8ab8b6" }}>
            {filteredItems.filter((i) => isTaken(i)).length > 0 &&
              `${filteredItems.filter((i) => isTaken(i)).length} item(s) already linked to another LCE (shown in red, disabled).`}
          </span>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button type="button" className="crud-add-btn" style={{ background: "#6c757d" }} onClick={onClose}>Cancel</button>
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
      setForm(applyLinkedItemsToForm(merged, items));
      setLinkedItems(items);
      setSelectedItemIds((estimate.linked_item_ids || []).map(Number));
      const settlementRows = mapSettlementRows(estimate.balance_settlements, merged.foreign_currency_id || "");
      setBalanceSettlements(settlementRows);
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
    return FOREIGN_CURRENCY_KEYS.has(key) ? `${label} (${selectedForeignCurrencyCode})` : label;
  };

  const settlementRowsWithValue = useMemo(
    () => balanceSettlements.map((row) => ({
      ...row,
      value: toFixed(toNumber(row.amount) * toNumber(row.factor)),
    })),
    [balanceSettlements]
  );

  const settledValueTotal = useMemo(
    () => toFixed(settlementRowsWithValue.reduce((sum, row) => sum + toNumber(row.value), 0)),
    [settlementRowsWithValue]
  );

  const pendingSettlementValue = useMemo(
    () => toFixed(toNumber(form.ex_works_material_cost) - toNumber(settledValueTotal)),
    [form.ex_works_material_cost, settledValueTotal]
  );

  const handleSettlementChange = (rowId, key, value) => {
    setBalanceSettlements((prev) => prev.map((row) => (row.rowId === rowId ? { ...row, [key]: value } : row)));
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
        || toNumber(row.amount) !== 0
        || toNumber(row.factor) !== 0
        || String(row.foreign_currency_id || "").trim()
      ))
      .map((row) => ({
        settlement_date: String(row.settlement_date || "").trim(),
        foreign_currency_id: String(row.foreign_currency_id || "").trim(),
        amount: row.amount,
        factor: row.factor,
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
      const merged = { ...DEFAULT_FORM };
      [...EDITABLE_FIELDS, ...FORMULA_FIELDS].forEach(([key]) => { merged[key] = String(estimate[key] ?? merged[key]); });
      EXTRA_FIELDS.forEach((key) => { merged[key] = String(estimate[key] ?? merged[key] ?? ""); });
      const items = Array.isArray(estimate.purchase_items) ? estimate.purchase_items : [];
      setForm(applyLinkedItemsToForm(merged, items));
      setLinkedItems(items);
      setSelectedItemIds((estimate.linked_item_ids || []).map(Number));
      const settlementRows = mapSettlementRows(estimate.balance_settlements, merged.foreign_currency_id || "");
      setBalanceSettlements(settlementRows);
      setNextSettlementRowId((settlementRows.reduce((max, row) => Math.max(max, Number(row.rowId) || 0), 0) || 0) + 1);
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
      <div className="crud-page__header" style={{ marginBottom: "0.8rem" }}>
        <div>
          <h1 className="module-page__title" style={{ margin: 0 }}>
            {isAddMode ? "LCE Add" : `LCE Form — ${lceLabel}`}
          </h1>
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
        <>
          {/* ── Cost fields ── */}
          <div className="lce-form-grid lce-form-grid--four">
            <label className="lce-form-card">
              <span className="lce-form-card__label">FOREIGN CURRENCY</span>
              <select
                className="auth-input lce-form-card__input"
                style={{ background: "#ffffff", color: "#111827" }}
                value={form.foreign_currency_id || ""}
                onChange={(e) => handleChange("foreign_currency_id", e.target.value)}
              >
                <option value="">Select currency</option>
                {currencyOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>

            {EDITABLE_FIELDS.map(([key, label]) => {
              const isCalculatedExWorks = key === "ex_works_material_cost";
              const otherField = OTHER_CHARGE_FIELDS.find(([vk]) => vk === key);
              if (isCalculatedExWorks) {
                return (
                  <label key={key} className="lce-form-card">
                    <span className="lce-form-card__label">
                      <strong>{withForeignCurrencyLabel(key, label)}</strong> <small style={{ color: "#cce8e5", fontWeight: 400 }}>(calculated from linked items)</small>
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
                            className="auth-input lce-form-card__input"
                            style={{ background: "#ffffff", color: "#111827", minWidth: 0 }}
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
                          style={{ textAlign: "right" }}
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
              return (
                <label key={key} className="lce-form-card">
                  <span className="lce-form-card__label">{withForeignCurrencyLabel(key, label)}</span>
                  <input type="number" className="auth-input lce-form-card__input" step="any" value={form[key]} onChange={(e) => handleChange(key, e.target.value)} />
                </label>
              );
            })}

            {FORMULA_FIELDS.map(([key, label]) => (
              <label key={key} className="lce-form-card lce-form-card--formula">
                <span className="lce-form-card__label"><strong>{withForeignCurrencyLabel(key, label)}</strong></span>
                <input type="number" className="auth-input lce-form-card__input lce-form-card__input--readonly" value={form[key]} readOnly />
              </label>
            ))}
          </div>

          <div
            style={{
              marginTop: "1.25rem",
              padding: "1rem",
              border: "1px solid #1a6f77",
              borderRadius: 8,
              background: "#0a3a40",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
              <h3 style={{ margin: 0 }}>Balance Settlement</h3>
              <button type="button" className="crud-add-btn" onClick={addSettlementRow}>+ Add Settlement</button>
            </div>
            <p style={{ margin: "0.5rem 0 0.8rem", color: "#cce8e5", fontSize: "0.86rem" }}>
              Final Value = Factor x Amount. Settled total is deducted from EX WORKS MATERIAL COST to show pending amount.
            </p>

            <div className="table-responsive">
              <table className="users-table" style={{ width: "100%" }}>
                <thead>
                  <tr>
                    <th>Date of Settlement</th>
                    <th>Foreign Currency</th>
                    <th>Amount</th>
                    <th>Factor</th>
                    <th>Final Value</th>
                    <th style={{ width: 90 }}>Action</th>
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
                      <td>
                        <select
                          className="auth-input"
                          value={row.foreign_currency_id || ""}
                          onChange={(e) => handleSettlementChange(row.rowId, "foreign_currency_id", e.target.value)}
                        >
                          <option value="">Select currency</option>
                          {currencyOptions.map((o) => <option key={`settlement-${row.rowId}-${o.value}`} value={o.value}>{o.label}</option>)}
                        </select>
                      </td>
                      <td>
                        <input
                          type="number"
                          step="any"
                          className="auth-input"
                          value={row.amount}
                          onChange={(e) => handleSettlementChange(row.rowId, "amount", e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          step="any"
                          className="auth-input"
                          value={row.factor}
                          onChange={(e) => handleSettlementChange(row.rowId, "factor", e.target.value)}
                        />
                      </td>
                      <td>
                        <input type="number" className="auth-input" value={row.value} readOnly disabled />
                      </td>
                      <td>
                        <button
                          type="button"
                          className="crud-add-btn"
                          style={{ background: "#6c757d", width: "100%" }}
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

            <div style={{ display: "flex", gap: "1rem", marginTop: "0.85rem", flexWrap: "wrap" }}>
              <span style={{ color: "#cce8e5" }}><strong>EX WORKS MATERIAL COST:</strong> {form.ex_works_material_cost}</span>
              <span style={{ color: "#cce8e5" }}><strong>Settled Total:</strong> {settledValueTotal}</span>
              <span style={{ color: toNumber(pendingSettlementValue) < 0 ? "#fca5a5" : "#7ee787", fontWeight: 700 }}>
                Pending: {pendingSettlementValue}
              </span>
            </div>
          </div>

          {/* ── Purchase invoice selector (top) ── */}
          <div
            style={{
              marginTop: "1.5rem",
              padding: "1rem",
              border: "1px solid #1a6f77",
              borderRadius: 6,
              background: "#0a3a40",
              color: "#f0fffe",
            }}
          >
            <h3 style={{ marginTop: 0, marginBottom: "0.75rem" }}>Link Purchase Invoice Items</h3>
            <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-end", flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 300px" }}>
                <label style={{ display: "block", marginBottom: 4, fontWeight: 600, fontSize: "0.85rem" }}>Purchase / Invoice</label>
                <details style={{ width: "100%" }}>
                  <summary
                    className="auth-input"
                    style={{
                      listStyle: "none",
                      cursor: "pointer",
                      userSelect: "none",
                      display: "flex",
                      alignItems: "center",
                      minHeight: 40,
                      background: "#0a3338",
                    }}
                  >
                    {selectedPurchaseLabel}
                  </summary>
                  <div
                    style={{
                      marginTop: 8,
                      border: "1px solid #1e666d",
                      borderRadius: 6,
                      maxHeight: 180,
                      overflowY: "auto",
                      background: "#062f34",
                      padding: "0.4rem 0.5rem",
                    }}
                  >
                    <div style={{ display: "flex", gap: "0.5rem", marginBottom: 8 }}>
                      <button type="button" className="crud-add-btn" onClick={() => setSelectedPurchaseIds(stockPurchaseOptions.map((o) => o.value))}>
                        Select All
                      </button>
                      <button type="button" className="crud-add-btn" style={{ background: "#6c757d" }} onClick={() => setSelectedPurchaseIds([])}>
                        Clear
                      </button>
                    </div>
                    {stockPurchaseOptions.map((o) => (
                      <label
                        key={o.value}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.5rem",
                          padding: "0.25rem 0.15rem",
                          cursor: "pointer",
                        }}
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
                <small style={{ color: "#cce8e5" }}>Use checkboxes to select multiple purchase numbers.</small>
              </div>
              <button
                type="button"
                className="crud-add-btn"
                onClick={handleShowItems}
                disabled={!selectedPurchaseIds.length || modalLoading}
                style={{ height: 38 }}
              >
                {modalLoading ? "Loading..." : "Show Items"}
              </button>
            </div>
            {selectedItemIds.length > 0 ? (
              <p style={{ marginTop: "0.5rem", marginBottom: 0, color: "#7ee787", fontWeight: 600 }}>
                {selectedItemIds.length} item(s) selected — save to persist LCE link.
              </p>
            ) : null}
          </div>

          {/* ── Linked items table ── */}
          <div style={{ marginTop: "1.5rem" }}>
            <h2 className="module-page__title" style={{ marginBottom: "0.5rem" }}>
              Linked Purchase Items {linkedItems.length > 0 ? `(${linkedItems.length})` : ""}
            </h2>
            {linkedItems.length === 0 ? (
              <p className="users-status">No purchase items linked yet. Use the section above to select items.</p>
            ) : (
              <div className="table-responsive">
                <table className="users-table" style={{ width: "100%" }}>
                  <thead>
                    <tr>
                      <th>GRN No.</th>
                      <th>Purchase No.</th>
                      <th>Invoice No.</th>
                      <th>Item Category</th>
                      <th>Item Name</th>
                      <th>Item Code</th>
                      <th>Qty</th>
                      <th>Unit Price</th>
                      <th>Total Price</th>
                      <th>LCE Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {linkedItems.map((item) => {
                      const lceCost = toFixed(toNumber(item.total_price) * toNumber(form.cost_factor));
                      return (
                        <tr key={item.id}>
                          <td>{item.grn_number}</td>
                          <td>{item.purchase_number || "-"}</td>
                          <td>{item.invoice_number || "-"}</td>
                          <td>{item.item_category}</td>
                          <td>{item.item_name}</td>
                          <td>{item.item_code}</td>
                          <td>{item.quantity}</td>
                          <td>{item.unit_price}</td>
                          <td>{item.total_price}</td>
                          <td><strong>{lceCost}</strong></td>
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
        />
      ) : null}
    </section>
  );
}

export default CostingPage;

