import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  BsChevronDown,
  BsChevronRight,
  BsPencilSquare,
  BsPlusCircleFill,
} from "react-icons/bs";
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
import { Card, CardHeader, CardBody } from "../components/Card";
import "../styles/LCEAddPage.css";

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
  toFixed(
    items.reduce((sum, item) => sum + toNumber(item?.total_price), 0),
    2
  );

const applyLinkedItemsToForm = (values, items = []) =>
  applyFormulas({
    ...values,
    ex_works_material_cost: calculateLinkedItemsTotalPrice(items),
  });

const emptySettlementRow = (rowId, foreignCurrencyId = "") => ({
  rowId,
  settlement_date: "",
  foreign_currency_id: foreignCurrencyId,
  payment_amount: "0",
  factor: "0",
  amount: "0",
});

const mapSettlementRows = (rows, fallbackCurrencyId = "", prevSettlements = []) => {
  const mapped = (Array.isArray(rows) ? rows : []).map((row, index) => {
    const rowId = Number(row?.id) || index + 1;
    const prev = prevSettlements.find(
      (p) => Number(p?.rowId) === rowId || Number(p?.id) === rowId
    );
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
      foreign_currency_id: String(
        row?.foreign_currency_id || fallbackCurrencyId || prev?.foreign_currency_id || ""
      ),
      payment_amount: String(paymentAmount),
      factor: String(factor),
      amount: String(toNumber(paymentAmount) * toNumber(factor)),
    };
  });
  return mapped.length ? mapped : [emptySettlementRow(1, fallbackCurrencyId)];
};

function applyFormulas(values, settlementRowsWithValue = []) {
  const next = { ...values };

  const totalSupplierPrice =
    toNumber(next.ex_works_material_cost) +
    toNumber(next.packing_charges) +
    toNumber(next.documentation) +
    toNumber(next.other_charges_1) +
    toNumber(next.other_charges_2) +
    toNumber(next.other_charges_3) +
    toNumber(next.other_charges_4);

  let advancePayment = toNumber(next.advance_payment_value);
  let advExchangeRate = toNumber(next.bank_exchange_rate);

  // If settlement rows exist with values, allow syncing
  if (
    settlementRowsWithValue &&
    settlementRowsWithValue.some(
      (r) => toNumber(r.payment_amount) > 0 || toNumber(r.factor) > 0
    )
  ) {
    const sumAmt = settlementRowsWithValue.reduce(
      (sum, row) => sum + toNumber(row.payment_amount || 0),
      0
    );
    if (sumAmt > 0 && (!next.advance_payment_value || next.advance_payment_value === "0")) {
      advancePayment = sumAmt;
      next.advance_payment_value = toFixed(advancePayment, 2);
    }
    const firstFactorRow = settlementRowsWithValue.find((r) => toNumber(r.factor) > 0);
    if (firstFactorRow && (!next.bank_exchange_rate || next.bank_exchange_rate === "0")) {
      advExchangeRate = toNumber(firstFactorRow.factor);
      next.bank_exchange_rate = String(firstFactorRow.factor);
    }
  }

  const advancePaymentOMR = advancePayment * advExchangeRate;
  const balancePayment = Math.max(0, totalSupplierPrice - advancePayment);
  const balExchangeRate = toNumber(next.bank_exchange_rate_balance);
  const balancePaymentOMR = balancePayment * balExchangeRate;
  const totalSupplierPriceOMR = advancePaymentOMR + balancePaymentOMR;

  next.total_supplier_price = toFixed(totalSupplierPrice, 2);
  next.advance_payment_value = toFixed(advancePayment, 2);
  next.advance_payment_value_omr = toFixed(advancePaymentOMR, 3);
  next.balance_payment_value = toFixed(balancePayment, 2);
  next.balance_payment_value_omr = toFixed(balancePaymentOMR, 3);
  next.total_supplier_price_omr = toFixed(totalSupplierPriceOMR, 3);

  next.total = toFixed(
    totalSupplierPriceOMR +
      toNumber(next.bank_muscat_charge_advance_payment) +
      toNumber(next.bank_muscat_charge_balance_payment) +
      toNumber(next.freight_charge) +
      toNumber(next.customs_duty_omr) +
      toNumber(next.oman_customs_boe_charge_omr) +
      toNumber(next.rop_customs_inspection_charge) +
      toNumber(next.unloading_charge_muscat_stores_1) +
      toNumber(next.unloading_charge_muscat_stores_2) +
      toNumber(next.loading_charge_muscat_stores_delivery),
    3
  );

  const exWorks = toNumber(next.ex_works_material_cost);
  next.cost_factor = toFixed(
    exWorks > 0 ? toNumber(next.total) / exWorks : 0,
    4
  );

  return next;
}

function formatPurchaseOption(row) {
  const id = String(row?.id ?? "");
  const purchaseNumber = String(
    row?.purchase_number || row?.purchaseNumber || ""
  ).trim();
  const invoiceNumber = String(
    row?.invoice_number || row?.invoiceNumber || ""
  ).trim();
  const base = purchaseNumber
    ? `Purchase: ${purchaseNumber}`
    : `Purchase ID: ${id}`;
  const label = invoiceNumber ? `${base} | Invoice: ${invoiceNumber}` : base;
  return { value: id, label };
}

/* ------------------- Purchase Item Selection Modal ------------------- */
function PurchaseItemModal({
  items,
  initialSelected,
  onConfirm,
  onClose,
  currentLceId,
  selectedForeignCurrencyCode,
}) {
  const [checked, setChecked] = useState(() => new Set(initialSelected));
  const [search, setSearch] = useState("");

  const isTaken = (item) =>
    item.lce_estimate_id &&
    String(item.lce_estimate_id) !== String(currentLceId || "");

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

  const selectableIds = filteredItems
    .filter((i) => !isTaken(i))
    .map((i) => i.id);
  const allSelected =
    selectableIds.length > 0 && selectableIds.every((id) => checked.has(id));

  const toggle = (id) => {
    setChecked((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <div className="modal-overlay">
      <div className="costing-modal-card">
        <div className="costing-modal-card__header">
          <h3 className="costing-modal-card__title">Select Purchase Items</h3>
          <div className="costing-inline-actions">
            <button
              type="button"
              className="crud-add-btn"
              onClick={() =>
                setChecked((prev) => {
                  const n = new Set(prev);
                  selectableIds.forEach((id) => n.add(id));
                  return n;
                })
              }
            >
              Select All
            </button>
            <button
              type="button"
              className="crud-add-btn crud-add-btn--neutral"
              onClick={() => setChecked(new Set())}
            >
              Clear
            </button>
          </div>
        </div>

        <input
          type="search"
          className="auth-input costing-modal-card__search"
          placeholder="Search by GRN, item name, code, category, purchase or invoice..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div className="users-table-wrap users-table-wrap--sticky costing-modal-card__table-wrap">
          <table className="users-table">
            <thead>
              <tr>
                <th className="users-table__sticky-head costing-modal-card__th costing-modal-card__th--checkbox">
                  <input
                    type="checkbox"
                    checked={allSelected}
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
                <tr>
                  <td colSpan={11} className="costing-modal-card__empty">
                    No items match your search.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const taken = isTaken(item);
                  const lceTag = item.lce_estimate_id
                    ? `LCE_${String(item.lce_estimate_id).padStart(3, "0")}`
                    : "-";
                  const rowClassName = `costing-modal-card__row${
                    taken ? " costing-modal-card__row--taken" : ""
                  }${checked.has(item.id) && !taken ? " costing-modal-card__row--selected" : ""}`;
                  return (
                    <tr
                      key={item.id}
                      title={
                        taken
                          ? `Already linked to ${lceTag}. Delink it first to reassign.`
                          : ""
                      }
                      className={rowClassName}
                    >
                      <td className="costing-modal-card__cell--checkbox">
                        <input
                          type="checkbox"
                          checked={checked.has(item.id)}
                          disabled={taken}
                          onChange={() => !taken && toggle(item.id)}
                        />
                      </td>
                      <td>{item.grn_number}</td>
                      <td>{item.purchase_number || "-"}</td>
                      <td>{item.invoice_number || "-"}</td>
                      <td>{item.item_category}</td>
                      <td>{item.item_name}</td>
                      <td>{item.item_code}</td>
                      <td>{item.quantity}</td>
                      <td>
                        {item.unit_price} {selectedForeignCurrencyCode}
                      </td>
                      <td>
                        {item.total_price} {selectedForeignCurrencyCode}
                      </td>
                      <td className={taken ? "costing-modal-card__lce--taken" : ""}>
                        {lceTag}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="costing-modal-card__footer">
          <span className="costing-help-text">
            {filteredItems.filter((i) => isTaken(i)).length > 0 &&
              `${filteredItems.filter((i) => isTaken(i)).length} item(s) already linked to another LCE (shown in red, disabled).`}
          </span>
          <div className="costing-inline-actions">
            <button
              type="button"
              className="crud-add-btn crud-add-btn--neutral"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="button"
              className="crud-add-btn"
              onClick={() => onConfirm([...checked])}
            >
              Confirm Selection ({checked.size})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------- Main LCE Add / Edit Page ------------------- */
function LCEAddPage() {
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

  const [linkedItems, setLinkedItems] = useState([]);
  const [selectedItemIds, setSelectedItemIds] = useState([]);
  const [balanceSettlements, setBalanceSettlements] = useState([emptySettlementRow(1)]);
  const [nextSettlementRowId, setNextSettlementRowId] = useState(2);

  const [selectedPurchaseIds, setSelectedPurchaseIds] = useState([]);
  const [modalItems, setModalItems] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);

  // Accordion section states (default closed)
  const [paymentHistoryOpen, setPaymentHistoryOpen] = useState(false);
  const [linkedItemsOpen, setLinkedItemsOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setStatus("");

    const resolveAndLoad = async () => {
      try {
        const metaData = await listLceEstimateMeta();
        if (!alive) return;

        const metaChargeTypes = Array.isArray(metaData?.charge_types)
          ? metaData.charge_types
          : [];
        const EXCLUDED = [
          "OTHER CHARGES 1",
          "OTHER CHARGES 2",
          "OTHER CHARGES 3",
          "OTHER CHARGES 4",
        ];
        const defaultChargeTypes = [
          "EMPTY CONTAINER WEIGHING CHARGE",
          "CONTAINER LOADING FEE",
          "LOADED CONTAINER WEIGHING CHARGE",
        ];
        const mergedChargeTypes = [
          ...new Set([
            ...metaChargeTypes.map((r) => r.name),
            ...defaultChargeTypes,
          ]),
        ].filter((name) => !EXCLUDED.includes(name.toUpperCase()));
        setChargeTypeOptions(
          mergedChargeTypes.map((name) => ({ value: name, label: name }))
        );

        const currencies = Array.isArray(metaData?.currencies)
          ? metaData.currencies
          : [];
        setCurrencyOptions(
          currencies.map((row) => ({
            value: String(row.id),
            label: row.label || `${row.country_name} - ${row.currency_code}`,
            currencyCode: String(row.currency_code || "").trim().toUpperCase(),
          }))
        );

        let purchases = Array.isArray(metaData?.stock_purchases)
          ? metaData.stock_purchases
          : [];
        if (purchases.length === 0) {
          const stockListData = await listStockPurchases();
          purchases = Array.isArray(stockListData?.stock_purchases)
            ? stockListData.stock_purchases
            : [];
        }
        setStockPurchaseOptions(
          purchases
            .map((row) => ({
              value: String(row.id),
              label: row?.label || formatPurchaseOption(row).label,
            }))
            .filter((row) => row.value)
        );
      } catch (metaErr) {
        console.error("Failed to load LCE meta:", metaErr);
      }

      if (!lceId) {
        setForm(applyFormulas({ ...DEFAULT_FORM }));
        setBalanceSettlements([emptySettlementRow(1)]);
        setNextSettlementRowId(2);
        setLoading(false);
        return;
      }

      try {
        const recordData = await getLceEstimateById(lceId);
        if (!alive) return;

        const estimate = recordData?.lce_estimate || {};
        const merged = { ...DEFAULT_FORM };
        [...EDITABLE_FIELDS, ...FORMULA_FIELDS].forEach(([key]) => {
          merged[key] = String(estimate[key] ?? merged[key]);
        });
        EXTRA_FIELDS.forEach((key) => {
          merged[key] = String(estimate[key] ?? merged[key] ?? "");
        });
        const items = Array.isArray(estimate.purchase_items)
          ? estimate.purchase_items
          : [];
        setLinkedItems(items);
        setSelectedItemIds((estimate.linked_item_ids || []).map(Number));
        const settlementRows = mapSettlementRows(
          estimate.balance_settlements,
          merged.foreign_currency_id || ""
        );
        setBalanceSettlements(settlementRows);
        setForm(() =>
          applyFormulas(
            applyLinkedItemsToForm(merged, items),
            settlementRows
          )
        );
        setNextSettlementRowId(
          (settlementRows.reduce(
            (max, row) => Math.max(max, Number(row.rowId) || 0),
            0
          ) || 0) + 1
        );
      } catch (err) {
        if (!alive) return;
        setStatus(err.message || "Failed to load LCE details.");
      } finally {
        if (alive) setLoading(false);
      }
    };

    resolveAndLoad();

    return () => {
      alive = false;
    };
  }, [lceId]);

  useEffect(() => {
    if (!lceId) return;
    setForm((prevForm) =>
      applyFormulas(
        applyLinkedItemsToForm(prevForm, linkedItems),
        balanceSettlements
      )
    );
  }, [lceId, linkedItems, balanceSettlements]);

  const handleChange = (key, value) =>
    setForm((prev) =>
      applyLinkedItemsToForm({ ...prev, [key]: value }, linkedItems)
    );

  const handleChargeTypeAdd = async (typeKey) => {
    const raw = window.prompt("Enter new charge type");
    const value = String(raw || "").trim();
    if (!value) return;
    if (
      chargeTypeOptions.some(
        (o) => o.value.toLowerCase() === value.toLowerCase()
      )
    ) {
      window.alert("Charge type already exists.");
      return;
    }
    try {
      const data = await createLceChargeTypeOption(value);
      const created = data?.charge_type?.name || value;
      setChargeTypeOptions((prev) => [...prev, { value: created, label: created }]);
      setForm((prev) => ({ ...prev, [typeKey]: created }));
    } catch (error) {
      setStatus(error?.message || "Failed to add charge type.");
    }
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
      const row = stockPurchaseOptions.find(
        (o) => o.value === selectedPurchaseIds[0]
      );
      return row?.label || `Selected: 1`;
    }
    return `${selectedPurchaseIds.length} purchase(s) selected`;
  }, [selectedPurchaseIds, stockPurchaseOptions]);

  const selectedForeignCurrencyCode = useMemo(() => {
    const selected = currencyOptions.find(
      (opt) => String(opt.value) === String(form.foreign_currency_id)
    );
    return selected?.currencyCode || "EUR";
  }, [currencyOptions, form.foreign_currency_id]);

  const withForeignCurrencyLabel = (key, label) => {
    if (FOREIGN_CURRENCY_KEYS.has(key)) {
      return `${label} (${selectedForeignCurrencyCode})`;
    }
    return label;
  };

  const addSettlementRow = () => {
    const nextRow = emptySettlementRow(
      nextSettlementRowId,
      form.foreign_currency_id || ""
    );
    setNextSettlementRowId((prev) => prev + 1);
    setBalanceSettlements((prev) => [...prev, nextRow]);
  };

  const removeSettlementRow = (rowId) => {
    setBalanceSettlements((prev) => {
      const filtered = prev.filter((row) => row.rowId !== rowId);
      return filtered.length ? filtered : [emptySettlementRow(1, form.foreign_currency_id || "")];
    });
  };

  const handleSettlementChange = (rowId, key, value) => {
    setBalanceSettlements((prev) =>
      prev.map((row) => {
        if (row.rowId !== rowId) return row;
        const updated = { ...row, [key]: value };
        if (key === "payment_amount" || key === "factor") {
          updated.amount = toFixed(
            toNumber(updated.payment_amount) * toNumber(updated.factor),
            2
          );
        }
        return updated;
      })
    );
  };

  const settlementRowsWithValue = useMemo(
    () =>
      balanceSettlements.map((row) => ({
        ...row,
        foreign_currency_id: form.foreign_currency_id || row.foreign_currency_id || "",
        amount: toFixed(toNumber(row.payment_amount) * toNumber(row.factor), 2),
      })),
    [balanceSettlements, form.foreign_currency_id]
  );

  const handleShowItems = async () => {
    if (!selectedPurchaseIds.length) return;
    setModalLoading(true);
    setStatus("");
    try {
      const results = await Promise.all(
        selectedPurchaseIds.map((id) => getLcePurchaseItems(id).catch(() => null))
      );
      const allItems = [];
      results.forEach((data) => {
        if (data && Array.isArray(data.items)) {
          allItems.push(...data.items);
        }
      });
      const uniqueItems = Array.from(
        new Map(allItems.map((item) => [item.id, item])).values()
      );
      setModalItems(uniqueItems);
      setModalOpen(true);
    } catch (err) {
      setStatus(err.message || "Failed to load purchase items.");
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
      .filter(
        (row) =>
          String(row.settlement_date || "").trim() ||
          toNumber(row.payment_amount) !== 0 ||
          toNumber(row.factor) !== 0 ||
          String(row.foreign_currency_id || "").trim()
      )
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
        ...Object.fromEntries(
          EDITABLE_FIELDS.filter(([key]) => key !== "ex_works_material_cost").map(
            ([key]) => [key, form[key]]
          )
        ),
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

      const data = isAddMode
        ? await createLceEstimate(payload)
        : await updateLceEstimateById(lceId, payload);
      const estimate = data.lce_estimate || {};
      const merged = { ...form };
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
      const items = Array.isArray(estimate.purchase_items)
        ? estimate.purchase_items
        : [];
      setLinkedItems(items);
      setSelectedItemIds((estimate.linked_item_ids || []).map(Number));

      let settlementRows = balanceSettlements;
      if (
        Array.isArray(estimate.balance_settlements) &&
        estimate.balance_settlements.length > 0
      ) {
        settlementRows = mapSettlementRows(
          estimate.balance_settlements,
          merged.foreign_currency_id || "",
          balanceSettlements
        );
        setBalanceSettlements(settlementRows);
        setNextSettlementRowId(
          (settlementRows.reduce(
            (max, row) => Math.max(max, Number(row.rowId) || 0),
            0
          ) || 0) + 1
        );
      }
      setForm(() =>
        applyFormulas(
          applyLinkedItemsToForm(merged, items),
          settlementRows
        )
      );
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

  const formatLceId = (id) => `LCE_${String(id).padStart(3, "0")}`;

  return (
    <section className="lce-page-container">
      {status ? (
        <p
          className={`users-status ${
            status.includes("successfully")
              ? "users-status--success"
              : "users-status--error"
          }`}
          style={{ maxWidth: "580px", width: "100%", margin: "0 auto 1rem" }}
        >
          {status}
        </p>
      ) : null}

      {loading ? (
        <p className="users-status">Loading LCE details...</p>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSave();
          }}
          style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}
        >
          {/* ========= CARD 1: Add/Edit LCE ========= */}
          <Card className="lce-card mb-3">
            <CardHeader>
              <h2>Add/Edit LCE</h2>
              {lceId ? (
                <span className="vendor-card__badge">
                  <BsPencilSquare aria-hidden="true" /> Editing #{lceId}
                </span>
              ) : null}
            </CardHeader>
            <CardBody>
              <div className="lce-fields-grid">

                  {/* ── Header: LCE ID + Currency ── */}
                  <div className="lce-field-pair">
                    <label className="lce-label">LCE Number</label>
                    <div className="lce-input">
                      <input
                        type="text"
                        className="form-control"
                        value={lceId ? formatLceId(lceId) : "Auto-generated"}
                        disabled
                        readOnly
                      />
                    </div>
                  </div>

                  <div className="lce-field-pair">
                    <label className="lce-label">Foreign Currency</label>
                    <div className="lce-input">
                      <select
                        className="form-control"
                        value={form["foreign_currency_id"] || ""}
                        onChange={(e) =>
                          handleChange("foreign_currency_id", e.target.value)
                        }
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

                  {/* 1. EX WORKS MATERIAL COST (FOREIGN CURRENCY) */}
                  <div className="lce-field-pair">
                    <label className="lce-label">
                      {withForeignCurrencyLabel("ex_works_material_cost", "EX WORKS MATERIAL COST")}
                    </label>
                    <div className="lce-input">
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

                  {/* 2. PACKING CHARGES (FOREIGN CURRENCY) */}
                  <div className="lce-field-pair">
                    <label className="lce-label">
                      {withForeignCurrencyLabel("packing_charges", "PACKING CHARGES")}
                    </label>
                    <div className="lce-input">
                      <input
                        type="number"
                        step="any"
                        className="form-control"
                        value={form["packing_charges"]}
                        onChange={(e) => handleChange("packing_charges", e.target.value)}
                      />
                    </div>
                  </div>

                  {/* 3. DOCUMENTATION CHARGES (FOREIGN CURRENCY) */}
                  <div className="lce-field-pair">
                    <label className="lce-label">
                      {withForeignCurrencyLabel("documentation", "DOCUMENTATION CHARGES")}
                    </label>
                    <div className="lce-input">
                      <input
                        type="number"
                        step="any"
                        className="form-control"
                        value={form["documentation"]}
                        onChange={(e) => handleChange("documentation", e.target.value)}
                      />
                    </div>
                  </div>

                  {/* 4–6. ANY OTHER CHARGES (FOREIGN CURRENCY) */}
                  {OTHER_CHARGE_FIELDS.map(([key, label, typeKey], idx) => (
                    <div key={key} className="lce-field-pair">
                      <label className="lce-label">
                        {withForeignCurrencyLabel(key, `ANY OTHER CHARGES (${idx + 1})`)}
                      </label>
                      <div className="lce-input">
                        <div className="lce-charge-control-row">
                          <select
                            className="form-control"
                            value={form[typeKey] || ""}
                            onChange={(e) => handleChange(typeKey, e.target.value)}
                          >
                            <option value="">Select charge type</option>
                            {chargeTypeOptions.map((o) => (
                              <option key={`${typeKey}-${o.value}`} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            className="crud-add-btn lce-btn-add-type"
                            onClick={() => handleChargeTypeAdd(typeKey)}
                            title="Add charge type"
                          >+</button>
                          <input
                            type="number"
                            step="any"
                            className="form-control"
                            value={form[key]}
                            disabled={!form[typeKey]}
                            onChange={(e) => handleChange(key, e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* 7. TOTAL SUPPLIER PRICE (FOREIGN CURRENCY) */}
                  <div className="lce-field-pair lce-field-pair--blue">
                    <label className="lce-label">
                      {withForeignCurrencyLabel("total_supplier_price", "TOTAL SUPPLIER PRICE")}
                    </label>
                    <div className="lce-input">
                      <input
                        type="number"
                        className="form-control"
                        value={form["total_supplier_price"]}
                        disabled
                        readOnly
                      />
                    </div>
                  </div>

                  {/* 8. ADVANCE PAYMENT VALUE (FOREIGN CURRENCY) */}
                  <div className="lce-field-pair">
                    <label className="lce-label">
                      {withForeignCurrencyLabel("advance_payment_value", "ADVANCE PAYMENT VALUE")}
                    </label>
                    <div className="lce-input">
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
                  <div className="lce-field-pair">
                    <label className="lce-label">BANK EXCHANGE RATE - ADVANCE PAYMENT</label>
                    <div className="lce-input">
                      <input
                        type="number"
                        step="any"
                        className="form-control lce-input--red"
                        value={form["bank_exchange_rate"]}
                        onChange={(e) => handleChange("bank_exchange_rate", e.target.value)}
                      />
                    </div>
                  </div>

                  {/* 10. ADVANCE PAYMENT VALUE (OMR) */}
                  <div className="lce-field-pair lce-field-pair--blue">
                    <label className="lce-label">ADVANCE PAYMENT VALUE (OMR)</label>
                    <div className="lce-input">
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
                  <div className="lce-field-pair">
                    <label className="lce-label">
                      {withForeignCurrencyLabel("balance_payment_value", "BALANCE PAYMENT VALUE")}
                    </label>
                    <div className="lce-input">
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
                  <div className="lce-field-pair">
                    <label className="lce-label">BANK EXCHANGE RATE - BALANCE PAYMENT</label>
                    <div className="lce-input">
                      <input
                        type="number"
                        step="any"
                        className="form-control lce-input--green"
                        value={form["bank_exchange_rate_balance"]}
                        onChange={(e) => handleChange("bank_exchange_rate_balance", e.target.value)}
                      />
                    </div>
                  </div>

                  {/* 13. BALANCE PAYMENT VALUE (OMR) */}
                  <div className="lce-field-pair lce-field-pair--blue">
                    <label className="lce-label">BALANCE PAYMENT VALUE (OMR)</label>
                    <div className="lce-input">
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
                  <div className="lce-field-pair lce-field-pair--dark">
                    <label className="lce-label">TOTAL SUPPLIER PRICE (OMR)</label>
                    <div className="lce-input">
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
                  <div className="lce-field-pair">
                    <label className="lce-label">BANK MUSCAT CHARGE - ADVANCE PAYMENT</label>
                    <div className="lce-input">
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
                  <div className="lce-field-pair">
                    <label className="lce-label">BANK MUSCAT CHARGE - BALANCE PAYMENT</label>
                    <div className="lce-input">
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
                  <div className="lce-field-pair">
                    <label className="lce-label">FREIGHT CHARGE</label>
                    <div className="lce-input">
                      <input
                        type="number"
                        step="any"
                        className="form-control lce-input--red"
                        value={form["freight_charge"]}
                        onChange={(e) => handleChange("freight_charge", e.target.value)}
                      />
                    </div>
                  </div>

                  {/* 18. CUSTOMS DUTY (OMR) */}
                  <div className="lce-field-pair">
                    <label className="lce-label">CUSTOMS DUTY (OMR)</label>
                    <div className="lce-input">
                      <input
                        type="number"
                        step="any"
                        className="form-control lce-input--red"
                        value={form["customs_duty_omr"]}
                        onChange={(e) => handleChange("customs_duty_omr", e.target.value)}
                      />
                    </div>
                  </div>

                  {/* 19. OMAN CUSTOMS BOE CHARGE (OMR) */}
                  <div className="lce-field-pair">
                    <label className="lce-label">OMAN CUSTOMS BOE CHARGE (OMR)</label>
                    <div className="lce-input">
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
                  <div className="lce-field-pair">
                    <label className="lce-label">ROP CUSTOMS INSPECTION CHARGE</label>
                    <div className="lce-input">
                      <input
                        type="number"
                        step="any"
                        className="form-control lce-input--green"
                        value={form["rop_customs_inspection_charge"]}
                        onChange={(e) => handleChange("rop_customs_inspection_charge", e.target.value)}
                      />
                    </div>
                  </div>

                  {/* 21. UNLOADING CHARGE @ MUSCAT STORES (1) */}
                  <div className="lce-field-pair">
                    <label className="lce-label">UNLOADING CHARGE @ MUSCAT STORES (1)</label>
                    <div className="lce-input">
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
                  <div className="lce-field-pair">
                    <label className="lce-label">UNLOADING CHARGE @ MUSCAT STORES (2)</label>
                    <div className="lce-input">
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
                  <div className="lce-field-pair">
                    <label className="lce-label">LOADING CHARGE @ MUSCAT STORES AT THE TIME OF CUSTOMER DELIVERY</label>
                    <div className="lce-input">
                      <input
                        type="number"
                        step="any"
                        className="form-control"
                        value={form["loading_charge_muscat_stores_delivery"]}
                        onChange={(e) => handleChange("loading_charge_muscat_stores_delivery", e.target.value)}
                      />
                    </div>
                  </div>

                  {/* ── Summary Totals ── */}
                  <div className="lce-field-pair lce-field-pair--dark mt-3">
                    <label className="lce-label">TOTAL (OMR)</label>
                    <div className="lce-input">
                      <input
                        type="number"
                        className="form-control"
                        value={form["total"]}
                        disabled
                        readOnly
                      />
                    </div>
                  </div>

                  <div className="lce-field-pair lce-field-pair--dark">
                    <label className="lce-label">COST FACTOR</label>
                    <div className="lce-input">
                      <input
                        type="number"
                        className="form-control"
                        value={form["cost_factor"]}
                        disabled
                        readOnly
                      />
                    </div>
                  </div>

                </div>{/* /lce-fields-grid */}
            </CardBody>
          </Card>

          {/* ========== ACCORDION 1: Payment History (Default Closed) ========== */}
          <Card className="lce-card mb-3 lce-accordion-card">
            <CardHeader
              className="lce-accordion-header"
              onClick={() => setPaymentHistoryOpen((prev) => !prev)}
            >
              <div className="lce-accordion-title">
                <span className="lce-accordion-icon">
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

        {/* ========== ACCORDION 2: Linked Purchase Invoice Items & Linked Purchase Items (Default Closed) ========== */}
        <Card className="lce-card mb-3 lce-accordion-card">
          <CardHeader
            className="lce-accordion-header"
            onClick={() => setLinkedItemsOpen((prev) => !prev)}
          >
            <div className="lce-accordion-title">
              <span className="lce-accordion-icon">
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
                    LCE link.
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
                        <th>Qty</th>
                        <th>Total Price</th>
                        <th>LCE COST (OMR)/Unit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {linkedItems.map((item) => {
                        const lceCost = toFixed(
                          toNumber(item.total_price) *
                            toNumber(form.cost_factor)
                        );
                        const perUnitLceCost =
                          toNumber(item.quantity) > 0
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
                            <td>
                              {item.total_price} {selectedForeignCurrencyCode}
                            </td>
                            <td>
                              <strong>{perUnitLceCost}</strong>
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
        <div className="lce-page-actions">
          <button
            type="submit"
            className="crud-add-btn"
            disabled={saving || loading}
          >
            <BsPlusCircleFill aria-hidden="true" />
            <span>{saving ? "Saving..." : "Save LCE Details"}</span>
          </button>
          <button
            type="button"
            className="modal-btn modal-btn--cancel"
            onClick={() => navigate("/projects/costing")}
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
          currentLceId={lceId}
          selectedForeignCurrencyCode={selectedForeignCurrencyCode}
          onConfirm={handleModalConfirm}
          onClose={() => setModalOpen(false)}
        />
      ) : null}
    </section>
  );
}

export default LCEAddPage;
