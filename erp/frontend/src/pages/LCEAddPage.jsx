import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  BsChevronDown,
  BsChevronRight,
  BsEyeFill,
  BsInfoCircle,
  BsPencilSquare,
  BsPlusCircleFill,
  BsTrashFill,
} from "react-icons/bs";
import {
  createLceChargeTypeOption,
  createLceEstimate,
  getLceEstimateById,
  getLceItemsCostDetails,
  getLcePurchaseHistory,
  listLabFurnitureItems,
  listLceEstimateMeta,
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

const calculateItemsTotalPrice = (items = []) =>
  toFixed(
    items.reduce(
      (sum, item) =>
        sum +
        (toNumber(item?.actual_cost) ||
          toNumber(item?.max_cost) ||
          toNumber(item?.min_cost)),
      0
    ),
    2
  );

const applyItemsToForm = (values, items = [], settlements = []) =>
  applyFormulas(values, settlements);

const calculateLinkedItemsTotalPrice = calculateItemsTotalPrice;
const applyLinkedItemsToForm = applyItemsToForm;

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

function PurchaseHistoryModal({ itemCode, itemName, itemCategory, onClose }) {
  const [loading, setLoading] = useState(true);
  const [purchases, setPurchases] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    const fetchHistory = async () => {
      setLoading(true);
      setError("");
      try {
        const data = await getLcePurchaseHistory(itemCode);
        if (alive) {
          setPurchases(Array.isArray(data?.purchases) ? data.purchases : []);
        }
      } catch (err) {
        if (alive) {
          setError(err.message || "Failed to load purchase history.");
        }
      } finally {
        if (alive) setLoading(false);
      }
    };
    if (itemCode) {
      fetchHistory();
    }
    return () => {
      alive = false;
    };
  }, [itemCode]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="costing-modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: "880px", width: "95%" }}
      >
        <div className="costing-modal-card__header">
          <div>
            <h3 className="costing-modal-card__title" style={{ margin: 0 }}>
              Purchase History &mdash; {itemCode}
            </h3>
            <span style={{ fontSize: "0.85rem", color: "#64748b" }}>
              {itemName} {itemCategory ? `| Category: ${itemCategory}` : ""}
            </span>
          </div>
          <button
            type="button"
            className="costing-modal-card__close"
            onClick={onClose}
            aria-label="Close"
            style={{
              fontSize: "1.5rem",
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#64748b",
            }}
          >
            &times;
          </button>
        </div>

        <div style={{ padding: "1rem" }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: "2rem", color: "#64748b" }}>
              Loading purchase history...
            </div>
          ) : error ? (
            <div className="costing-status-text costing-status-text--error" style={{ color: "#dc2626" }}>
              {error}
            </div>
          ) : purchases.length === 0 ? (
            <div style={{ textAlign: "center", padding: "2rem", color: "#64748b" }}>
              No historic purchases found for item code <strong>{itemCode}</strong>.
            </div>
          ) : (
            <div className="card-table-wrap">
              <table className="users-table">
                <thead>
                  <tr>
                    <th>Item Category</th>
                    <th>Item Name</th>
                    <th>Item Code</th>
                    <th>Cost</th>
                    <th>Purchase No.</th>
                    <th>Invoice No.</th>
                    <th>GRN No.</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {purchases.map((p, idx) => (
                    <tr key={idx}>
                      <td>{p.item_category || itemCategory || "-"}</td>
                      <td>{p.item_name || itemName || "-"}</td>
                      <td><strong>{p.item_code || itemCode}</strong></td>
                      <td>
                        <strong style={{ color: "#0f766e" }}>{p.cost}</strong>
                      </td>
                      <td>{p.purchase_number || "-"}</td>
                      <td>{p.invoice_number || "-"}</td>
                      <td>{p.grn_number || "-"}</td>
                      <td>{p.date || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div
          className="costing-modal-card__footer"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "0.75rem 1rem",
            borderTop: "1px solid #e2e8f0",
          }}
        >
          <span style={{ fontSize: "0.85rem", color: "#64748b" }}>
            Total purchases: <strong>{purchases.length}</strong>
          </span>
          <button
            type="button"
            className="crud-add-btn crud-add-btn--neutral"
            onClick={onClose}
          >
            Close
          </button>
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
  const [itemMasterOptions, setItemMasterOptions] = useState([]);

  const [items, setItems] = useState([]);
  const [nextItemRowId, setNextItemRowId] = useState(1);
  const [selectedItemCodeKeys, setSelectedItemCodeKeys] = useState([]);
  const [historyModalItem, setHistoryModalItem] = useState(null);
  const [itemSearchText, setItemSearchText] = useState("");

  const [balanceSettlements, setBalanceSettlements] = useState([emptySettlementRow(1)]);
  const [nextSettlementRowId, setNextSettlementRowId] = useState(2);

  // Accordion section states (default closed)
  const [paymentHistoryOpen, setPaymentHistoryOpen] = useState(false);
  const [itemsAccordionOpen, setItemsAccordionOpen] = useState(false);

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

        let itemOptions = Array.isArray(metaData?.item_master_options)
          ? metaData.item_master_options
          : [];
        if (itemOptions.length === 0) {
          try {
            const itemsRes = await listLabFurnitureItems();
            const rawList = Array.isArray(itemsRes) ? itemsRes : (itemsRes?.items || []);
            itemOptions = rawList.map((row) => ({
              id: row.id,
              item_code: row.item_code,
              item_name: row.item_name,
              item_category: row.item_category_name || (row.item_category?.name || ""),
              label: `${row.item_code} - ${row.item_name}`,
            }));
          } catch (e) {
            console.error("Failed to load item options fallback:", e);
          }
        }
        setItemMasterOptions(
          itemOptions.map((row) => ({
            value: String(row.id),
            item_code: row.item_code,
            item_name: row.item_name,
            item_category: row.item_category || "",
            label: row.label || `${row.item_code} - ${row.item_name}`,
          }))
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

        let loadedItems = [];
        if (Array.isArray(estimate.items) && estimate.items.length > 0) {
          loadedItems = estimate.items.map((it, idx) => ({
            rowId: Number(it.id) || idx + 1,
            item_code_id: String(it.item_code_id || it.id || ""),
            item_code: it.item_code || "",
            item_name: it.item_name || "",
            item_category: it.item_category || "",
            min_cost: String(it.min_cost ?? "0"),
            max_cost: String(it.max_cost ?? "0"),
            actual_cost: String(it.actual_cost ?? it.max_cost ?? "0"),
            lce_cost: String(it.lce_cost ?? "0"),
          }));
        } else if (estimate.item_code_id || estimate.item_code) {
          loadedItems = [
            {
              rowId: 1,
              item_code_id: String(estimate.item_code_id || ""),
              item_code: estimate.item_code || "",
              item_name: estimate.item_name || "",
              item_category: estimate.item_category || "",
              min_cost: String(estimate.min_cost ?? "0"),
              max_cost: String(estimate.max_cost ?? "0"),
              actual_cost: String(estimate.actual_cost ?? estimate.max_cost ?? "0"),
              lce_cost: String(estimate.lce_cost ?? "0"),
            },
          ];
        }
        setItems(loadedItems);
        setNextItemRowId(
          (loadedItems.reduce((max, row) => Math.max(max, Number(row.rowId) || 0), 0) || 0) + 1
        );
        if (loadedItems.length > 0) {
          setItemsAccordionOpen(true);
        }

        const settlementRows = mapSettlementRows(
          estimate.balance_settlements,
          merged.foreign_currency_id || ""
        );
        setBalanceSettlements(settlementRows);
        setForm(() =>
          applyFormulas(
            merged,
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
        applyItemsToForm(prevForm, items),
        balanceSettlements
      )
    );
  }, [lceId, items, balanceSettlements]);

  const handleChange = (key, value) =>
    setForm((prev) =>
      applyItemsToForm({ ...prev, [key]: value }, items, balanceSettlements)
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

  const handleAddItemRow = () => {
    setItems((prev) => [
      ...prev,
      {
        rowId: nextItemRowId,
        item_code_id: "",
        item_code: "",
        item_name: "",
        item_category: "",
        min_cost: "0",
        max_cost: "0",
        actual_cost: "0",
        lce_cost: "0",
      },
    ]);
    setNextItemRowId((prev) => prev + 1);
  };

  const handleRemoveItemRow = (rowId) => {
    setItems((prev) => prev.filter((r) => r.rowId !== rowId));
  };

  const handleMinCostChange = (rowId, value) => {
    setItems((prev) =>
      prev.map((row) => {
        if (row.rowId !== rowId) return row;
        const newMin = value;
        const shouldUpdateActual =
          !row.actual_cost ||
          row.actual_cost === "0" ||
          row.actual_cost === row.min_cost;
        const newActual = shouldUpdateActual ? newMin : row.actual_cost;
        const costVal =
          toNumber(newActual) || toNumber(newMin) || toNumber(row.max_cost);
        return {
          ...row,
          min_cost: newMin,
          actual_cost: newActual,
          lce_cost: toFixed(costVal * toNumber(form.cost_factor), 2),
        };
      })
    );
  };

  const handleMaxCostChange = (rowId, value) => {
    setItems((prev) =>
      prev.map((row) => {
        if (row.rowId !== rowId) return row;
        const newMax = value;
        const shouldUpdateActual =
          !row.actual_cost ||
          row.actual_cost === "0" ||
          row.actual_cost === row.max_cost;
        const newActual = shouldUpdateActual ? newMax : row.actual_cost;
        const costVal =
          toNumber(newActual) || toNumber(newMax) || toNumber(row.min_cost);
        return {
          ...row,
          max_cost: newMax,
          actual_cost: newActual,
          lce_cost: toFixed(costVal * toNumber(form.cost_factor), 2),
        };
      })
    );
  };

  const handleActualCostChange = (rowId, value) => {
    setItems((prev) =>
      prev.map((row) => {
        if (row.rowId !== rowId) return row;
        const costVal =
          toNumber(value) || toNumber(row.max_cost) || toNumber(row.min_cost);
        return {
          ...row,
          actual_cost: value,
          lce_cost: toFixed(costVal * toNumber(form.cost_factor), 2),
        };
      })
    );
  };

  const handleItemCodeChange = async (rowId, selectedId) => {
    const master = itemMasterOptions.find(
      (o) => String(o.value) === String(selectedId)
    );
    if (!master) {
      setItems((prev) =>
        prev.map((row) =>
          row.rowId === rowId
            ? {
                ...row,
                item_code_id: "",
                item_code: "",
                item_name: "",
                item_category: "",
                min_cost: "0",
                max_cost: "0",
                actual_cost: "0",
                lce_cost: "0",
              }
            : row
        )
      );
      return;
    }

    try {
      const data = await getLceItemsCostDetails([master.value]);
      const fetched =
        Array.isArray(data?.items) && data.items.length ? data.items[0] : null;
      const minCost = fetched ? String(fetched.min_cost ?? "0") : "0";
      const maxCost = fetched ? String(fetched.max_cost ?? "0") : "0";
      const actualCost = fetched ? String(fetched.actual_cost ?? maxCost) : "0";
      const costVal =
        toNumber(actualCost) || toNumber(maxCost) || toNumber(minCost);

      setItems((prev) =>
        prev.map((row) =>
          row.rowId === rowId
            ? {
                ...row,
                item_code_id: master.value,
                item_code: master.item_code,
                item_name: master.item_name,
                item_category: master.item_category,
                min_cost: minCost,
                max_cost: maxCost,
                actual_cost: actualCost,
                lce_cost: toFixed(costVal * toNumber(form.cost_factor), 2),
              }
            : row
        )
      );
    } catch (err) {
      console.error("Failed to fetch item costs:", err);
      setItems((prev) =>
        prev.map((row) =>
          row.rowId === rowId
            ? {
                ...row,
                item_code_id: master.value,
                item_code: master.item_code,
                item_name: master.item_name,
                item_category: master.item_category,
                min_cost: "0",
                max_cost: "0",
                actual_cost: "0",
                lce_cost: "0",
              }
            : row
        )
      );
    }
  };

  const toggleItemCodeKey = (codeKey) => {
    setSelectedItemCodeKeys((prev) => {
      if (prev.includes(codeKey)) {
        return prev.filter((id) => id !== codeKey);
      }
      return [...prev, codeKey];
    });
  };

  const selectedItemCodesLabel = useMemo(() => {
    if (!selectedItemCodeKeys.length) return "Select item code(s)...";
    if (selectedItemCodeKeys.length === 1) {
      const row = itemMasterOptions.find(
        (o) => String(o.value) === String(selectedItemCodeKeys[0])
      );
      return row?.label || `Selected: 1 item`;
    }
    return `${selectedItemCodeKeys.length} items selected`;
  }, [selectedItemCodeKeys, itemMasterOptions]);

  const handleAddMultiSelectedItems = async () => {
    if (!selectedItemCodeKeys.length) return;
    try {
      const data = await getLceItemsCostDetails(selectedItemCodeKeys);
      const fetchedItems = Array.isArray(data?.items) ? data.items : [];
      let curId = nextItemRowId;
      const newRows = [];

      selectedItemCodeKeys.forEach((keyVal) => {
        const master = itemMasterOptions.find(
          (o) => String(o.value) === String(keyVal)
        );
        const fetched = fetchedItems.find(
          (f) =>
            String(f.id) === String(keyVal) ||
            String(f.item_code_id) === String(keyVal) ||
            (master && f.item_code === master.item_code)
        );
        const minCost = fetched ? String(fetched.min_cost ?? "0") : "0";
        const maxCost = fetched ? String(fetched.max_cost ?? "0") : "0";
        const actualCost = fetched ? String(fetched.actual_cost ?? maxCost) : "0";

        newRows.push({
          rowId: curId++,
          item_code_id: master ? master.value : keyVal,
          item_code: master ? master.item_code : (fetched?.item_code || ""),
          item_name: master ? master.item_name : (fetched?.item_name || ""),
          item_category: master
            ? master.item_category
            : (fetched?.item_category || ""),
          min_cost: minCost,
          max_cost: maxCost,
          actual_cost: actualCost,
          lce_cost: toFixed(toNumber(actualCost) * toNumber(form.cost_factor), 2),
        });
      });

      setNextItemRowId(curId);
      setItems((prev) => {
        const filteredPrev = prev.filter((r) => r.item_code_id || r.item_code);
        return [...filteredPrev, ...newRows];
      });
      setSelectedItemCodeKeys([]);
      setItemsAccordionOpen(true);
    } catch (err) {
      setStatus(err.message || "Failed to load selected items.");
    }
  };

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

    const itemsPayload = items
      .filter((r) => r.item_code_id || r.item_code)
      .map((r) => {
        const costVal =
          toNumber(r.actual_cost) || toNumber(r.max_cost) || toNumber(r.min_cost);
        return {
          item_code_id: r.item_code_id,
          item_code: r.item_code,
          item_name: r.item_name,
          item_category: r.item_category,
          min_cost: r.min_cost,
          max_cost: r.max_cost,
          actual_cost: r.actual_cost,
          lce_cost: toFixed(costVal * toNumber(form.cost_factor), 2),
        };
      });

    try {
      const payload = {
        ...Object.fromEntries(
          EDITABLE_FIELDS.map(([key]) => [key, form[key]])
        ),
        other_charges_1_type: form.other_charges_1_type || "",
        other_charges_2_type: form.other_charges_2_type || "",
        other_charges_3_type: form.other_charges_3_type || "",
        other_charges_4_type: form.other_charges_4_type || "",
        foreign_currency_id: form.foreign_currency_id || "",
        items: itemsPayload,
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

      let loadedItems = [];
      if (Array.isArray(estimate.items) && estimate.items.length > 0) {
        loadedItems = estimate.items.map((it, idx) => ({
          rowId: Number(it.id) || idx + 1,
          item_code_id: String(it.item_code_id || it.id || ""),
          item_code: it.item_code || "",
          item_name: it.item_name || "",
          item_category: it.item_category || "",
          min_cost: String(it.min_cost ?? "0"),
          max_cost: String(it.max_cost ?? "0"),
          actual_cost: String(it.actual_cost ?? it.max_cost ?? "0"),
          lce_cost: String(it.lce_cost ?? toFixed(toNumber(it.actual_cost) * toNumber(form.cost_factor), 2)),
        }));
      } else if (estimate.item_code_id || estimate.item_code) {
        loadedItems = [
          {
            rowId: 1,
            item_code_id: String(estimate.item_code_id || ""),
            item_code: estimate.item_code || "",
            item_name: estimate.item_name || "",
            item_category: estimate.item_category || "",
            min_cost: String(estimate.min_cost ?? "0"),
            max_cost: String(estimate.max_cost ?? "0"),
            actual_cost: String(estimate.actual_cost ?? estimate.max_cost ?? "0"),
            lce_cost: String(estimate.lce_cost ?? toFixed(toNumber(estimate.actual_cost) * toNumber(form.cost_factor), 2)),
          },
        ];
      }
      setItems(loadedItems);

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
          applyItemsToForm(merged, loadedItems),
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
                        disabled={items.length > 0}
                        readOnly={items.length > 0}
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

        {/* ========== ACCORDION 2: Linked Item Codes & Purchase Cost History (Default Closed) ========== */}
        <Card className="lce-card mb-3 lce-accordion-card">
          <CardHeader
            className="lce-accordion-header"
            onClick={() => setItemsAccordionOpen((prev) => !prev)}
          >
            <div className="lce-accordion-title">
              <span className="lce-accordion-icon">
                {itemsAccordionOpen ? <BsChevronDown /> : <BsChevronRight />}
              </span>
              <h3>Linked Item Codes & Purchase Cost History</h3>
              {items.length > 0 && (
                <span className="vendor-card__badge" style={{ fontSize: "0.75rem", padding: "0.15rem 0.5rem" }}>
                  {items.length} item{items.length === 1 ? "" : "s"}
                </span>
              )}
            </div>
            <div onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                className="crud-add-btn"
                onClick={() => {
                  setItemsAccordionOpen(true);
                  handleAddItemRow();
                }}
              >
                + Add Item Row
              </button>
            </div>
          </CardHeader>
          {itemsAccordionOpen && (
            <CardBody>
              {/* Multi-item selector bar */}
              <div className="mb-3">
                <label
                  className="col-form-label"
                  style={{
                    fontWeight: 600,
                    display: "block",
                    marginBottom: "0.25rem",
                  }}
                >
                  Select Item Code(s)
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
                          {selectedItemCodesLabel}
                        </span>
                        <span>▼</span>
                      </summary>
                      <div
                        className="costing-selector-menu"
                        style={{
                          width: "100%",
                          zIndex: 100,
                          maxHeight: "300px",
                          overflowY: "auto",
                        }}
                      >
                        <div
                          className="costing-inline-actions costing-inline-actions--compact"
                          style={{ padding: "0.5rem" }}
                        >
                          <input
                            type="text"
                            className="form-control"
                            placeholder="Search item code or name..."
                            value={itemSearchText}
                            onChange={(e) => setItemSearchText(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            style={{ marginBottom: "0.5rem", fontSize: "0.85rem" }}
                          />
                          <div className="d-flex gap-2">
                            <button
                              type="button"
                              className="crud-add-btn"
                              onClick={() =>
                                setSelectedItemCodeKeys(
                                  itemMasterOptions
                                    .filter(
                                      (o) =>
                                        !itemSearchText ||
                                        o.label
                                          .toLowerCase()
                                          .includes(itemSearchText.toLowerCase())
                                    )
                                    .map((o) => o.value)
                                )
                              }
                            >
                              Select All Filtered
                            </button>
                            <button
                              type="button"
                              className="crud-add-btn crud-add-btn--neutral"
                              onClick={() => setSelectedItemCodeKeys([])}
                            >
                              Clear
                            </button>
                          </div>
                        </div>
                        {itemMasterOptions
                          .filter(
                            (o) =>
                              !itemSearchText ||
                              o.label
                                .toLowerCase()
                                .includes(itemSearchText.toLowerCase())
                          )
                          .map((o) => (
                            <label
                              key={o.value}
                              className="costing-selector-option"
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "0.5rem",
                                padding: "0.4rem 0.6rem",
                                cursor: "pointer",
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={selectedItemCodeKeys.includes(o.value)}
                                onChange={() => toggleItemCodeKey(o.value)}
                              />
                              <span style={{ fontSize: "0.85rem" }}>{o.label}</span>
                            </label>
                          ))}
                      </div>
                    </details>
                  </div>
                  <button
                    type="button"
                    className="crud-add-btn"
                    onClick={handleAddMultiSelectedItems}
                    disabled={!selectedItemCodeKeys.length}
                    style={{ height: "36px", whiteSpace: "nowrap" }}
                  >
                    Add Selected Items
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
                  Select multiple item codes or add rows individually. Auto-fetches category, name, min &amp; max cost from purchases.
                </small>
              </div>

              {/* Items Table */}
              <div className="card-table-wrap">
                {items.length === 0 ? (
                  <p
                    className="users-status"
                    style={{
                      textAlign: "center",
                      padding: "1rem",
                      color: "#64748b",
                    }}
                  >
                    No item codes linked yet. Use the selector above or click &ldquo;+ Add Item Row&rdquo;.
                  </p>
                ) : (
                  <table className="users-table">
                    <thead>
                      <tr>
                        <th style={{ minWidth: "140px" }}>Item Category</th>
                        <th style={{ minWidth: "160px" }}>Item Name</th>
                        <th style={{ minWidth: "220px" }}>Item Code</th>
                        <th style={{ minWidth: "100px" }}>Min Cost</th>
                        <th style={{ minWidth: "100px" }}>Max Cost</th>
                        <th style={{ minWidth: "120px" }}>Actual Cost</th>
                        <th style={{ minWidth: "130px" }}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
                            <span>LCE Cost</span>
                            <span
                              title="Product of Actual Cost and Cost Factor"
                              style={{
                                cursor: "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                color: "#94a3b8",
                                transition: "color 0.15s ease",
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.color = "#38bdf8")}
                              onMouseLeave={(e) => (e.currentTarget.style.color = "#94a3b8")}
                            >
                              <BsInfoCircle size={13} aria-hidden="true" />
                            </span>
                          </span>
                        </th>
                        <th style={{ minWidth: "180px" }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((row) => (
                        <tr key={row.rowId}>
                          <td>
                            <input
                              type="text"
                              className="form-control"
                              value={row.item_category || ""}
                              readOnly
                              disabled
                              placeholder="Auto"
                              title={row.item_category || "Auto-fetched category"}
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              className="form-control"
                              value={row.item_name || ""}
                              readOnly
                              disabled
                              placeholder="Auto"
                              title={row.item_name || "Auto-fetched name"}
                            />
                          </td>
                          <td>
                            <select
                              className="form-control"
                              value={row.item_code_id || ""}
                              onChange={(e) =>
                                handleItemCodeChange(row.rowId, e.target.value)
                              }
                            >
                              <option value="">Select Item Code</option>
                              {itemMasterOptions.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <input
                              type="number"
                              step="any"
                              className="form-control"
                              value={row.min_cost || "0"}
                              onChange={(e) =>
                                handleMinCostChange(row.rowId, e.target.value)
                              }
                              title="Min Cost (editable)"
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              step="any"
                              className="form-control"
                              value={row.max_cost || "0"}
                              onChange={(e) =>
                                handleMaxCostChange(row.rowId, e.target.value)
                              }
                              title="Max Cost (editable)"
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              step="any"
                              className="form-control"
                              value={row.actual_cost}
                              onChange={(e) =>
                                handleActualCostChange(row.rowId, e.target.value)
                              }
                              title="Actual Cost (editable)"
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              className="form-control"
                              value={toFixed(
                                (toNumber(row.actual_cost) ||
                                  toNumber(row.max_cost) ||
                                  toNumber(row.min_cost)) *
                                  toNumber(form.cost_factor),
                                2
                              )}
                              readOnly
                              disabled
                              style={{ fontWeight: 600, color: "#0f766e" }}
                              title="Product of Actual Cost and Cost Factor"
                            />
                          </td>
                          <td>
                            <div className="users-actions" style={{ justifyContent: "center" }}>
                              <button
                                type="button"
                                className="users-action"
                                style={{ background: "#1e3a5f", color: "#93c5fd" }}
                                onClick={() =>
                                  setHistoryModalItem({
                                    itemCode: row.item_code,
                                    itemName: row.item_name,
                                    itemCategory: row.item_category,
                                  })
                                }
                                disabled={!row.item_code}
                                title="View Purchase History"
                                aria-label="View Purchase History"
                              >
                                <BsEyeFill aria-hidden="true" size={15} />
                              </button>
                              <button
                                type="button"
                                className="users-action users-action--delete"
                                onClick={() => handleRemoveItemRow(row.rowId)}
                                title="Remove item"
                                aria-label="Remove item"
                              >
                                <BsTrashFill aria-hidden="true" size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              {items.length > 0 && (
                <div
                  style={{
                    marginTop: "0.75rem",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: "0.5rem",
                    fontSize: "0.85rem",
                    color: "#475569",
                    padding: "0.35rem 0.65rem",
                    backgroundColor: "#f8fafc",
                    borderRadius: "4px",
                    border: "1px solid #e2e8f0",
                  }}
                >
                  <span>
                    Total Linked Items: <strong>{items.length}</strong>
                  </span>
                  <span>
                    Sum Actual Cost (Ex Works):{" "}
                    <strong>
                      {calculateItemsTotalPrice(items)} {selectedForeignCurrencyCode}
                    </strong>
                  </span>
                  <span>
                    Sum LCE Cost:{" "}
                    <strong style={{ color: "#0f766e" }}>
                      {toFixed(
                        items.reduce(
                          (sum, it) =>
                            sum +
                            toNumber(it.actual_cost) * toNumber(form.cost_factor),
                          0
                        ),
                        2
                      )}{" "}
                      OMR
                    </strong>
                  </span>
                </div>
              )}
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

      {/* ------------------- Historic Purchases Modal ------------------- */}
      {historyModalItem ? (
        <PurchaseHistoryModal
          itemCode={historyModalItem.itemCode}
          itemName={historyModalItem.itemName}
          itemCategory={historyModalItem.itemCategory}
          onClose={() => setHistoryModalItem(null)}
        />
      ) : null}
    </section>
  );
}

export default LCEAddPage;
