import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { components } from "react-select";
import CrudPage from "../components/CrudPage";
import TotalReqdProjectsModal from "../components/TotalReqdProjectsModal";
import OrderedQtyPosModal from "../components/OrderedQtyPosModal";
import ConsumedQtyProjectsModal from "../components/ConsumedQtyProjectsModal";
import {
  createLabFurnitureItem,
  deleteLabFurnitureItem,
  listItemCodeNames,
  listLabFurnitureItemCategories,
  listLabFurnitureItems,
  listUoms,
  listItemTypes,
  updateLabFurnitureItem,
} from "../services/crudApi";

const PROCUREMENT_CLASSIFICATION_OPTIONS = [
  { value: "OMAN", label: "OMAN" },
  { value: "UAE", label: "UAE" },
  { value: "IMP", label: "IMP" },
];

const BUSINESS_CRITICALITY_OPTIONS = [
  { value: "VIP", label: "VIP" },
  { value: "CRITICAL", label: "CRITICAL" },
  { value: "NON CRITICAL", label: "NON CRITICAL" },
  { value: "UNDESIRED", label: "UNDESIRED" },
];

const COLUMNS = [
  {
    key: "combined_item",
    label: "Item (Code _ Category _ Name)",
    width: "320px",
    minWidth: "300px",
  },
  { key: "uom", label: "UOM", width: "90px", minWidth: "80px" },
  { key: "physical_qty", label: "Physical Qty", align: "right", width: "80px", minWidth: "70px" },
  { key: "ordered_qty", label: "Ordered Qty", align: "right", width: "80px", minWidth: "70px" },
  { key: "physical_plus_ordered_qty", label: "Phy. + Ord. Qty", align: "right", width: "85px", minWidth: "75px" },
  { key: "total_reqd", label: "Total Reqd", align: "right", width: "80px", minWidth: "70px" },
  { key: "to_order_qty", label: "To Order Qty (Excluding Recommended Free Stk Qty)", align: "right", width: "135px", minWidth: "115px" },
  { key: "recommended_free_stock_qty", label: "Recommended Free Stock Qty", align: "right", width: "115px", minWidth: "95px" },
  { key: "to_order_qty_including_free_stock", label: "To Order Qty (Including Recommended Free Stk Qty)", align: "right", width: "135px", minWidth: "115px" },
  { key: "warning_alert_qty", label: "Warning Alert Qty", align: "right", width: "80px", minWidth: "70px" },
  { key: "procurement_classification", label: "Procurement Classification", width: "110px", minWidth: "95px" },
  { key: "business_criticality", label: "Business Criticality", width: "105px", minWidth: "90px" },
  { key: "item_type", label: "Item Type", width: "90px", minWidth: "80px" },
];

const FIELDS = [
  {
    key: "item_code_ref_id",
    label: "Item Code _ Item Category _ Item Name",
    required: true,
    placeholder: "Search & select Item Code _ Category _ Name...",
  },
  {
    key: "procurement_classification",
    label: "Procurement Classification",
    options: PROCUREMENT_CLASSIFICATION_OPTIONS,
    placeholder: "Select Procurement Classification",
    required: true,
    isClearable: false,
  },
  {
    key: "business_criticality",
    label: "Business Criticality",
    options: BUSINESS_CRITICALITY_OPTIONS,
    placeholder: "Select Business Criticality",
    required: true,
    isClearable: false,
  },
  { key: "item_type_id", label: "Item Type", required: true },
  { key: "uom_id", label: "UOM", required: true },
  { key: "length", label: "Length/Size", type: "number", min: 0, step: "any", default: "0" },
  { key: "width", label: "Width", type: "number", min: 0, step: "any", default: "0" },
  { key: "height", label: "Height/Thk", type: "number", min: 0, step: "any", default: "0" },
  { key: "volume", label: "Volume", type: "number", readOnly: true, default: "0" },
  { key: "total_reqd", label: "Total Reqd", type: "number", min: 0, step: "any", default: "0" },
  { key: "recommended_free_stock_qty", label: "Recommended Free Stock Qty", type: "number", min: 0, step: "any", default: "0" },
  { key: "warning_alert_qty", label: "Warning Alert Qty", type: "number", min: 0, step: "any", default: "0" },
  { key: "physical_qty", label: "Physical Qty", type: "number", readOnly: true, default: "0" },
  { key: "ordered_qty", label: "Ordered Qty", type: "number", readOnly: true, default: "0" },
  { key: "physical_plus_ordered_qty", label: "Physical + Ordered Qty", type: "number", readOnly: true, default: "0" },
  { key: "to_order_qty_including_free_stock", label: "To Order Qty (Including Recommended Free Stk Qty)", type: "number", readOnly: true, default: "0" },
  { key: "to_order_qty", label: "To Order Qty (Excluding Recommended Free Stk Qty)", type: "number", readOnly: true, default: "0" },
];

const QUANTITY_KEYS = [
  "recommended_free_stock_qty",
  "warning_alert_qty",
  "to_order_qty",
  "to_order_qty_including_free_stock",
  "physical_plus_ordered_qty",
  "physical_qty",
  "ordered_qty",
  "total_reqd",
];

function withQuantityDefaults(row = {}) {
  const next = { ...row };
  QUANTITY_KEYS.forEach((key) => {
    next[key] = row[key] === "" || row[key] == null ? 0 : row[key];
  });
  const phy = Number(next.physical_qty || 0);
  const ord = Number(next.ordered_qty || 0);
  next.physical_plus_ordered_qty = (Number.isFinite(phy) ? phy : 0) + (Number.isFinite(ord) ? ord : 0);
  const tot = Number(next.total_reqd || 0);
  const rec = Number(next.recommended_free_stock_qty || 0);
  next.to_order_qty = (Number.isFinite(tot) ? tot : 0) - next.physical_plus_ordered_qty;
  next.to_order_qty_including_free_stock =
    (Number.isFinite(tot) ? tot : 0) + (Number.isFinite(rec) ? rec : 0) - next.physical_plus_ordered_qty;
  const code = (next.item_code || "").trim();
  const cat = (next.item_category || "").trim();
  const name = (next.item_name || "").trim();
  next.combined_item = [code, cat, name].filter(Boolean).join(" _ ") || "—";
  return next;
}

function ItemCodeMenuList(props) {
  const [query, setQuery] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  const childrenArray = useMemo(() => {
    if (!props.children) return [];
    return Array.isArray(props.children) ? props.children : [props.children];
  }, [props.children]);

  const filteredChildren = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return childrenArray;
    const searchTerms = q.split(/\s+/).filter(Boolean);
    return childrenArray.filter((child) => {
      const data = child?.props?.data;
      const text = String(data?.label || child?.props?.children || "").toLowerCase();
      return searchTerms.every((term) => text.includes(term));
    });
  }, [childrenArray, query]);

  return (
    <components.MenuList {...props}>
      <div
        style={{
          position: "sticky",
          top: 0,
          background: "#ffffff",
          zIndex: 20,
          padding: "8px 10px",
          borderBottom: "1px solid #e2e8f0",
          boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
        }}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
          <span
            style={{
              position: "absolute",
              left: "10px",
              color: "#64748b",
              fontSize: "0.85rem",
              pointerEvents: "none",
            }}
          >
            🔍
          </span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by item code, category or name..."
            style={{
              width: "100%",
              padding: "7px 28px 7px 30px",
              fontSize: "0.85rem",
              borderRadius: "6px",
              border: "1px solid #cbd5e1",
              outline: "none",
              boxSizing: "border-box",
              backgroundColor: "#f8fafc",
            }}
            onKeyDown={(e) => {
              if (e.key !== "Escape") {
                e.stopPropagation();
              }
            }}
          />
          {query ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setQuery("");
                inputRef.current?.focus();
              }}
              style={{
                position: "absolute",
                right: "6px",
                background: "none",
                border: "none",
                color: "#94a3b8",
                cursor: "pointer",
                padding: "2px 6px",
                fontSize: "0.85rem",
              }}
              title="Clear search"
            >
              ✕
            </button>
          ) : null}
        </div>
      </div>
      {filteredChildren.length === 0 ? (
        <div style={{ padding: "1.5rem", textAlign: "center", color: "#64748b", fontSize: "0.85rem" }}>
          No matching items found for &ldquo;{query}&rdquo;
        </div>
      ) : (
        filteredChildren
      )}
    </components.MenuList>
  );
}

function StockItemsPage() {
  const [selectedRequestedItem, setSelectedRequestedItem] = useState(null);
  const [selectedOrderedItem, setSelectedOrderedItem] = useState(null);
  const [selectedConsumedItem, setSelectedConsumedItem] = useState(null);
  const [categoryOptions, setCategoryOptions] = useState([]);
  const [itemCodeOptions, setItemCodeOptions] = useState([]);
  const [uomOptions, setUomOptions] = useState([]);
  const [itemTypeOptions, setItemTypeOptions] = useState([]);

  const loadCategories = useCallback(async () => {
    const data = await listLabFurnitureItemCategories();
    const categories = Array.isArray(data.item_categories)
      ? data.item_categories.map((category) => ({
          value: String(category.id),
          label: category.name,
        }))
      : [];
    setCategoryOptions(categories);
    return categories;
  }, []);

  const loadItemCodeNames = useCallback(async () => {
    const data = await listItemCodeNames();
    const rows = Array.isArray(data.item_code_names) ? data.item_code_names : [];
    const options = rows.map((itemCodeName) => {
      const category = itemCodeName.item_category || "";
      const label = category
        ? `${itemCodeName.item_code} _ ${category} _ ${itemCodeName.item_name}`
        : `${itemCodeName.item_code} _ ${itemCodeName.item_name}`;
      return {
        value: String(itemCodeName.id),
        label,
        itemCode: itemCodeName.item_code,
        itemName: itemCodeName.item_name,
        itemCategory: category,
        itemCategoryId: itemCodeName.item_category_id == null ? "" : String(itemCodeName.item_category_id),
        procurementClassification: itemCodeName.procurement_classification || "",
        businessCriticality: itemCodeName.business_criticality || "",
      };
    });
    setItemCodeOptions(options);
    return options;
  }, []);

  const loadUoms = useCallback(async () => {
    const data = await listUoms();
    const rows = Array.isArray(data) ? data : (Array.isArray(data?.uoms) ? data.uoms : []);
    const options = rows.map((uom) => ({
      value: String(uom.id),
      label: `${uom.name} (${uom.symbol})`,
    }));
    setUomOptions(options);
    return options;
  }, []);

  const loadItemTypes = useCallback(async () => {
    const data = await listItemTypes();
    const rows = Array.isArray(data) ? data : (Array.isArray(data?.item_types) ? data.item_types : []);
    const options = rows.map((itemType) => ({
      value: String(itemType.id),
      label: itemType.it_name,
    }));
    setItemTypeOptions(options);
    return options;
  }, []);

  useEffect(() => {
    Promise.all([loadCategories(), loadItemCodeNames(), loadUoms(), loadItemTypes()]).catch(() => {
      setCategoryOptions([]);
      setItemCodeOptions([]);
      setUomOptions([]);
      setItemTypeOptions([]);
    });
  }, [loadCategories, loadItemCodeNames, loadUoms, loadItemTypes]);

  const fetchFn = useCallback(async () => {
    const data = await listLabFurnitureItems();
    const rows = Array.isArray(data.lab_furniture_items) ? data.lab_furniture_items : [];
    return rows.map(withQuantityDefaults);
  }, []);

  const enrichPayload = useCallback(
    (payload) => {
      const next = { ...payload };
      const selected = itemCodeOptions.find(
        (opt) => String(opt.value) === String(payload.item_code_ref_id || "")
      );
      if (selected) {
        next.item_code_ref_id = selected.value;
        next.item_name_ref_id = selected.value;
        next.item_code = selected.itemCode;
        next.item_name = selected.itemName;
        next.item_category_id = selected.itemCategoryId;
        next.item_category = selected.itemCategory;
        if (!next.procurement_classification && selected.procurementClassification) {
          next.procurement_classification = selected.procurementClassification;
        }
        if (!next.business_criticality && selected.businessCriticality) {
          next.business_criticality = selected.businessCriticality;
        }
      }
      return withQuantityDefaults(next);
    },
    [itemCodeOptions]
  );

  const createFn = useCallback(
    async (payload) => {
      const data = await createLabFurnitureItem(enrichPayload(payload));
      return withQuantityDefaults(data.lab_furniture_item);
    },
    [enrichPayload]
  );

  const updateFn = useCallback(
    async (id, payload) => {
      const data = await updateLabFurnitureItem(id, enrichPayload(payload));
      return withQuantityDefaults(data.lab_furniture_item);
    },
    [enrichPayload]
  );

  const fields = [
    {
      ...FIELDS[0],
      options: itemCodeOptions,
      components: {
        MenuList: ItemCodeMenuList,
      },
      filterOption: (candidate, input) => {
        if (!input) return true;
        const terms = input.toLowerCase().split(/\s+/).filter(Boolean);
        const text = candidate.label.toLowerCase();
        return terms.every((t) => text.includes(t));
      },
      placeholder: "Search & select Item Code _ Category _ Name...",
      isClearable: false,
    },
    FIELDS[1],
    FIELDS[2],
    {
      ...FIELDS[3],
      options: itemTypeOptions,
      isClearable: false,
    },
    {
      ...FIELDS[4],
      options: uomOptions,
      isClearable: false,
    },
    ...FIELDS.slice(5),
  ];

  const computeValues = useCallback(
    (changedKey, _changedValue, allValues) => {
      if (changedKey === "item_code_ref_id") {
        const selected = itemCodeOptions.find(
          (option) => String(option.value) === String(allValues.item_code_ref_id || "")
        );
        return {
          item_code_ref_id: selected ? selected.value : "",
          item_name_ref_id: selected ? selected.value : "",
          item_code: selected?.itemCode || "",
          item_name: selected?.itemName || "",
          item_category_id: selected?.itemCategoryId || "",
          item_category: selected?.itemCategory || "",
          procurement_classification: selected?.procurementClassification || allValues.procurement_classification || "",
          business_criticality: selected?.businessCriticality || allValues.business_criticality || "",
        };
      }

    if (["physical_qty", "ordered_qty", "total_reqd", "recommended_free_stock_qty"].includes(changedKey)) {
      const physicalQty = Number(allValues.physical_qty || 0);
      const orderedQty = Number(allValues.ordered_qty || 0);
      const physicalPlusOrdered =
        (Number.isFinite(physicalQty) ? physicalQty : 0) +
        (Number.isFinite(orderedQty) ? orderedQty : 0);
      const totalReqd = Number(allValues.total_reqd || 0);
      const recommendedFreeStock = Number(allValues.recommended_free_stock_qty || 0);
      const toOrderExc = (Number.isFinite(totalReqd) ? totalReqd : 0) - physicalPlusOrdered;
      const toOrderInc =
        (Number.isFinite(totalReqd) ? totalReqd : 0) +
        (Number.isFinite(recommendedFreeStock) ? recommendedFreeStock : 0) -
        physicalPlusOrdered;

      return {
        physical_plus_ordered_qty: physicalPlusOrdered,
        to_order_qty: toOrderExc,
        to_order_qty_including_free_stock: toOrderInc,
      };
    }

    if (!["length", "width", "height"].includes(changedKey)) {
      return {};
    }

    const length = Number(allValues.length || 0);
    const width = Number(allValues.width || 0);
    const height = Number(allValues.height || 0);
    const volume = (Number.isFinite(length) ? length : 0)
      * (Number.isFinite(width) ? width : 0)
      * (Number.isFinite(height) ? height : 0);
    return { volume: volume.toFixed(3) };
  }, [itemCodeOptions]);

  const columns = useMemo(() => {
    return COLUMNS.map((col) => {
      if (col.key === "combined_item") {
        return {
          ...col,
          render: (row) => (
            <span style={{ fontWeight: 600, color: "#0f172a" }}>
              {row.combined_item || [row.item_code, row.item_category, row.item_name].filter(Boolean).join(" _ ") || "—"}
            </span>
          ),
        };
      }
      if (col.key === "total_reqd") {
        return {
          ...col,
          align: "right",
          render: (row) => {
            const val = Number(row.total_reqd || 0);
            const hasReq = val > 0;
            return (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedRequestedItem(row);
                }}
                style={{
                  background: hasReq ? "#e0f2fe" : "#f8fafc",
                  color: hasReq ? "#0284c7" : "#64748b",
                  border: hasReq ? "1px solid #7dd3fc" : "1px solid #e2e8f0",
                  borderRadius: "6px",
                  padding: "2px 8px",
                  fontWeight: 700,
                  cursor: "pointer",
                  fontSize: "0.82rem",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  transition: "all 0.15s ease",
                }}
                title={hasReq ? `View projects requesting ${row.item_code} (${val})` : "No project requirements"}
              >
                <span>{val}</span>
                {hasReq && <span style={{ fontSize: "0.75rem", opacity: 0.85 }}>📋</span>}
              </button>
            );
          },
        };
      }
      if (col.key === "ordered_qty") {
        return {
          ...col,
          align: "right",
          render: (row) => {
            const val = Number(row.ordered_qty || 0);
            const hasOrdered = val > 0;
            return (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedOrderedItem(row);
                }}
                style={{
                  background: hasOrdered ? "#ecfdf5" : "#f8fafc",
                  color: hasOrdered ? "#047857" : "#64748b",
                  border: hasOrdered ? "1px solid #a7f3d0" : "1px solid #e2e8f0",
                  borderRadius: "6px",
                  padding: "2px 8px",
                  fontWeight: 700,
                  cursor: "pointer",
                  fontSize: "0.82rem",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  transition: "all 0.15s ease",
                }}
                title={hasOrdered ? `View purchase orders for ${row.item_code} (${val})` : "No placed orders"}
              >
                <span>{val}</span>
                {hasOrdered && <span style={{ fontSize: "0.75rem", opacity: 0.85 }}>📦</span>}
              </button>
            );
          },
        };
      }
      if (col.key === "consumed_qty") {
        return {
          ...col,
          align: "right",
          render: (row) => {
            const val = Number(row.consumed_qty || 0);
            const hasConsumed = val > 0;
            return (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedConsumedItem(row);
                }}
                style={{
                  background: hasConsumed ? "#fef3c7" : "#f8fafc",
                  color: hasConsumed ? "#b45309" : "#64748b",
                  border: hasConsumed ? "1px solid #fcd34d" : "1px solid #e2e8f0",
                  borderRadius: "6px",
                  padding: "2px 8px",
                  fontWeight: 700,
                  cursor: "pointer",
                  fontSize: "0.82rem",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                }}
                title={`View consumed quantities by project for ${row.item_code}`}
              >
                <span>{val}</span>
                {hasConsumed && <span style={{ fontSize: "0.75rem" }}>📋</span>}
              </button>
            );
          },
        };
      }
      if (col.key === "to_order_qty" || col.key === "to_order_qty_including_free_stock") {
        return {
          ...col,
          align: "right",
          render: (row) => {
            const val = Number(row[col.key] || 0);
            const hasToOrder = val > 0;
            const hasReq = Number(row.total_reqd || 0) > 0;
            return (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (hasReq || hasToOrder) {
                    setSelectedRequestedItem(row);
                  }
                }}
                style={{
                  background: hasToOrder ? "#fee2e2" : "#f8fafc",
                  color: hasToOrder ? "#b91c1c" : "#64748b",
                  border: hasToOrder ? "1px solid #fca5a5" : "1px solid #e2e8f0",
                  borderRadius: "6px",
                  padding: "2px 8px",
                  fontWeight: 700,
                  cursor: hasReq || hasToOrder ? "pointer" : "default",
                  fontSize: "0.82rem",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  transition: "all 0.15s ease",
                }}
                title={hasToOrder ? `View requirements for ${row.item_code} (${val} to order)` : (hasReq ? "View project requirements" : "No order required")}
              >
                <span>{val}</span>
                {hasToOrder && <span style={{ fontSize: "0.75rem", opacity: 0.85 }}>📋</span>}
              </button>
            );
          },
        };
      }
      return col;
    });
  }, []);

  return (
    <>
      <CrudPage
        title="Item Master"
        columns={columns}
        fields={fields}
        fetchFn={fetchFn}
        createFn={createFn}
        updateFn={updateFn}
        deleteFn={deleteLabFurnitureItem}
        computeValues={computeValues}
        tableMaxHeight="58vh"
        tableWrapClassName="users-table-wrap--item-master"
        modalCardClassName="modal-card--item-master"
        stickyHeader
      />
      {selectedRequestedItem && (
        <TotalReqdProjectsModal
          item={selectedRequestedItem}
          onClose={() => setSelectedRequestedItem(null)}
        />
      )}
      {selectedOrderedItem && (
        <OrderedQtyPosModal
          item={selectedOrderedItem}
          onClose={() => setSelectedOrderedItem(null)}
        />
      )}
      {selectedConsumedItem && (
        <ConsumedQtyProjectsModal
          item={selectedConsumedItem}
          onClose={() => setSelectedConsumedItem(null)}
        />
      )}
    </>
  );
}

export default StockItemsPage;
